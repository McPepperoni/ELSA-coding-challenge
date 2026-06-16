// AI Generated code <PURPOSE>: verify Redis live-session repository behavior
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, expect, test } from 'bun:test'
import { createClient } from 'redis'

import { createAnswerLockRepository } from '@/redis/answer-lock-repository.js'
import { createLeaderboardRepository } from '@/redis/leaderboard-repository.js'
import { createLiveSessionRepository } from '@/redis/live-session-repository.js'
import type { RedisClient } from '@/redis/client.js'

const requireRedisIntegration = process.env.REDIS_INTEGRATION_REQUIRED === 'true'
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
const testRunId = `redis-test-${randomUUID()}`
const testKeyPattern = `quiz:${testRunId}-*`

let client: RedisClient | null = null
let redisUnavailableReason: string | null = null

beforeAll(async () => {
  const redis = createClient({
    url: redisUrl,
    socket: {
      connectTimeout: 250,
      reconnectStrategy: false,
    },
  }) as RedisClient
  redis.on('error', () => undefined)

  try {
    await redis.connect()
    client = redis
  } catch (error) {
    redisUnavailableReason = error instanceof Error ? error.message : String(error)
    if (redis.isOpen) {
      await redis.destroy()
    }
  }
})

afterAll(async () => {
  if (client) {
    const keys = await client.keys(testKeyPattern)
    if (keys.length > 0) {
      await client.del(keys)
    }
    await client.destroy()
  }
})

const sessionId = () => `${testRunId}-${randomUUID()}`

const getClientOrSkip = (): RedisClient | null => {
  if (!client) {
    if (requireRedisIntegration) {
      throw new Error(`Redis integration test requires reachable REDIS_URL ${redisUrl}: ${redisUnavailableReason}`)
    }

    console.warn(
      `Skipping Redis integration test because Redis is unavailable at ${redisUrl}: ${redisUnavailableReason}`,
    )
    return null
  }

  return client
}

test('initializes and reads live quiz session state', async () => {
  const redis = getClientOrSkip()
  if (!redis) {
    return
  }

  const liveSessions = createLiveSessionRepository(redis)
  const quizSessionId = sessionId()
  const questionOrderIds = ['question-1', 'question-2', 'question-3']

  await liveSessions.initializeLiveSession({
    quizSessionId,
    questionOrderIds,
  })

  expect(await liveSessions.readLiveSession(quizSessionId)).toEqual({
    quizSessionId,
    status: 'waiting_room',
    questionOrderIds,
    currentQuestionId: null,
    currentQuestionPosition: null,
    startedAt: null,
    endsAt: null,
  })
})

test('stores active question metadata and participant connection state', async () => {
  const redis = getClientOrSkip()
  if (!redis) {
    return
  }

  const liveSessions = createLiveSessionRepository(redis)
  const quizSessionId = sessionId()
  const startedAt = new Date('2026-01-01T00:00:00.000Z')
  const endsAt = new Date('2026-01-01T00:00:30.000Z')

  await liveSessions.initializeLiveSession({
    quizSessionId,
    questionOrderIds: ['question-1', 'question-2'],
  })
  await liveSessions.setActiveQuestion({
    quizSessionId,
    questionId: 'question-2',
    questionPosition: 2,
    startedAt,
    endsAt,
  })
  await liveSessions.recordParticipantConnection({
    quizSessionId,
    participantId: 'participant-1',
    connectedAt: new Date('2026-01-01T00:00:05.000Z'),
  })
  await liveSessions.recordParticipantConnection({
    quizSessionId,
    participantId: 'participant-2',
    connectedAt: new Date('2026-01-01T00:00:06.000Z'),
  })
  await liveSessions.clearParticipantConnection({
    quizSessionId,
    participantId: 'participant-1',
  })

  expect(await liveSessions.readLiveSession(quizSessionId)).toMatchObject({
    status: 'question_active',
    currentQuestionId: 'question-2',
    currentQuestionPosition: 2,
    startedAt,
    endsAt,
  })
  expect(await liveSessions.readConnectedParticipantIds(quizSessionId)).toEqual([
    'participant-2',
  ])
})

test('accepts only the first answer lock for a participant question pair', async () => {
  const redis = getClientOrSkip()
  if (!redis) {
    return
  }

  const answerLocks = createAnswerLockRepository(redis)
  const quizSessionId = sessionId()
  const input = {
    quizSessionId,
    questionId: 'question-1',
    participantId: 'participant-1',
  }

  await answerLocks.resetQuestionAnswers({
    quizSessionId,
    questionId: 'question-1',
  })

  expect(await answerLocks.acceptFirstAnswer(input)).toEqual({
    accepted: true,
    answeredCount: 1,
  })
  expect(await answerLocks.acceptFirstAnswer(input)).toEqual({
    accepted: false,
    answeredCount: 1,
  })
  expect(
    await answerLocks.acceptFirstAnswer({
      quizSessionId,
      questionId: 'question-1',
      participantId: 'participant-2',
    }),
  ).toEqual({
    accepted: true,
    answeredCount: 2,
  })
  expect(
    await answerLocks.readAnsweredCount({
      quizSessionId,
      questionId: 'question-1',
    }),
  ).toBe(2)
})

test('orders live leaderboard using score and deterministic tie breakers', async () => {
  const redis = getClientOrSkip()
  if (!redis) {
    return
  }

  const leaderboard = createLeaderboardRepository(redis)
  const quizSessionId = sessionId()

  await leaderboard.upsertParticipant({
    quizSessionId,
    participantId: 'participant-zero-b',
    joinedAt: new Date('2026-01-01T00:00:01.000Z'),
  })
  await leaderboard.upsertParticipant({
    quizSessionId,
    participantId: 'participant-zero-a',
    joinedAt: new Date('2026-01-01T00:00:01.000Z'),
  })
  await leaderboard.recordAnswerScore({
    quizSessionId,
    participantId: 'participant-late-correct',
    displayName: 'Late Correct',
    joinedAt: new Date('2026-01-01T00:00:02.000Z'),
    isCorrect: true,
    scoreAwarded: 200,
    submittedAt: new Date('2026-01-01T00:00:10.000Z'),
  })
  await leaderboard.recordAnswerScore({
    quizSessionId,
    participantId: 'participant-early-correct',
    displayName: 'Early Correct',
    joinedAt: new Date('2026-01-01T00:00:03.000Z'),
    isCorrect: true,
    scoreAwarded: 200,
    submittedAt: new Date('2026-01-01T00:00:05.000Z'),
  })
  await leaderboard.recordAnswerScore({
    quizSessionId,
    participantId: 'participant-high-score',
    displayName: 'High Score',
    joinedAt: new Date('2026-01-01T00:00:04.000Z'),
    isCorrect: true,
    scoreAwarded: 300,
    submittedAt: new Date('2026-01-01T00:00:30.000Z'),
  })

  expect(
    (await leaderboard.readLeaderboard(quizSessionId)).map((entry) => ({
      participantId: entry.participantId,
      rank: entry.rank,
      score: entry.score,
      correctAnswerCount: entry.correctAnswerCount,
      lastCorrectSubmissionAt: entry.lastCorrectSubmissionAt,
    })),
  ).toEqual([
    {
      participantId: 'participant-high-score',
      rank: 1,
      score: 300,
      correctAnswerCount: 1,
      lastCorrectSubmissionAt: new Date('2026-01-01T00:00:30.000Z'),
    },
    {
      participantId: 'participant-early-correct',
      rank: 2,
      score: 200,
      correctAnswerCount: 1,
      lastCorrectSubmissionAt: new Date('2026-01-01T00:00:05.000Z'),
    },
    {
      participantId: 'participant-late-correct',
      rank: 3,
      score: 200,
      correctAnswerCount: 1,
      lastCorrectSubmissionAt: new Date('2026-01-01T00:00:10.000Z'),
    },
    {
      participantId: 'participant-zero-a',
      rank: 4,
      score: 0,
      correctAnswerCount: 0,
      lastCorrectSubmissionAt: null,
    },
    {
      participantId: 'participant-zero-b',
      rank: 5,
      score: 0,
      correctAnswerCount: 0,
      lastCorrectSubmissionAt: null,
    },
  ])
  expect((await leaderboard.readTopLeaderboardEntries(quizSessionId, 3)).map((entry) => entry.rank)).toEqual([
    1,
    2,
    3,
  ])
})

test('rejects score awards that disagree with answer correctness before Redis writes', async () => {
  const leaderboard = createLeaderboardRepository({} as RedisClient)
  let caught: unknown

  try {
    await leaderboard.recordAnswerScore({
      quizSessionId: 'session-score-guard',
      participantId: 'participant-wrong',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
      isCorrect: false,
      scoreAwarded: 100,
      submittedAt: new Date('2026-01-01T00:00:05.000Z'),
    })
  } catch (error) {
    caught = error
  }

  expect(caught).toBeInstanceOf(Error)
  expect((caught as Error).message).toBe('Redis operation failed: record leaderboard score')
  expect((caught as Error).cause).toBeInstanceOf(Error)
  expect(((caught as Error).cause as Error).message).toBe('Incorrect answers must not award score')
})
