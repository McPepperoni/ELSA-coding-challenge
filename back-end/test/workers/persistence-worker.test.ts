// AI Generated code <PURPOSE>: verify backend persistence worker queue and retry behavior
import { randomUUID } from 'node:crypto'

import { afterAll, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

import { closeDb, db } from '@/db/client.js'
import { answerSubmissionsRepository } from '@/db/repositories/answer-submissions.js'
import { finalResultsRepository } from '@/db/repositories/final-results.js'
import { participantsRepository } from '@/db/repositories/participants.js'
import { questionSetsRepository } from '@/db/repositories/question-sets.js'
import { quizSessionsRepository } from '@/db/repositories/quiz-sessions.js'
import { questionSets, quizSessions } from '@/db/schema.js'
import { createPersistenceWorker } from '@/workers/persistence-worker.js'
import type {
  AcceptedAnswerPersistenceEvent,
  FinalLeaderboardPersistenceEvent,
} from '@/workers/persistence-events.js'

afterAll(async () => {
  await closeDb()
})

type InsertAcceptedAnswer = (input: {
  quizSessionId: string
  participantId: string
  questionId: string
  selectedOptionId: string
  isCorrect: boolean
  scoreAwarded: number
  submittedAt: Date
}) => Promise<unknown>

const acceptedAnswerEvent = {
  type: 'accepted_answer',
  quizSessionId: 'session-1',
  participantId: 'participant-1',
  questionId: 'question-1',
  selectedOptionId: 'option-1',
  isCorrect: true,
  scoreAwarded: 100,
  submittedAt: new Date('2026-06-16T10:00:05.000Z'),
} satisfies AcceptedAnswerPersistenceEvent

const finalLeaderboardEvent = {
  type: 'final_leaderboard',
  quizSessionId: 'session-1',
  recordedAt: new Date('2026-06-16T10:05:00.000Z'),
  entries: [
    {
      participantId: 'participant-1',
      rank: 1,
      score: 200,
      correctAnswerCount: 2,
      lastCorrectSubmissionAt: new Date('2026-06-16T10:04:05.000Z'),
      joinedAt: new Date('2026-06-16T09:59:00.000Z'),
    },
    {
      participantId: 'participant-2',
      rank: 2,
      score: 100,
      correctAnswerCount: 1,
      lastCorrectSubmissionAt: null,
      joinedAt: new Date('2026-06-16T09:59:30.000Z'),
    },
  ],
} satisfies FinalLeaderboardPersistenceEvent

const deferred = <T = void>(): {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
} => {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, resolve, reject }
}

const flushMicrotasks = async (): Promise<void> => {
  for (let index = 0; index < 50; index += 1) {
    await Promise.resolve()
  }
}

const waitForCondition = async (
  condition: () => Promise<boolean>,
  message: string,
): Promise<void> => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (await condition()) {
      return
    }

    await new Promise<void>((resolve) => setTimeout(resolve, 10))
  }

  throw new Error(message)
}

test('enqueue resolves before repository write finishes', async () => {
  const write = deferred()
  let writeStarted = false
  let writeFinished = false
  const insertAcceptedAnswerIdempotently: InsertAcceptedAnswer = async () => {
    writeStarted = true
    await write.promise
    writeFinished = true
  }
  const worker = createPersistenceWorker({
    repositories: {
      answerSubmissions: { insertAcceptedAnswerIdempotently },
      finalResults: { replaceFinalResults: async () => [] },
    },
    delay: async () => {},
    logger: () => {},
  })

  await expect(worker.enqueue(acceptedAnswerEvent)).resolves.toBeUndefined()

  expect(writeStarted).toBe(true)
  expect(writeFinished).toBe(false)
  write.resolve()
  await flushMicrotasks()
  expect(writeFinished).toBe(true)
})

test('accepted_answer maps and writes to answer submission repository', async () => {
  const inputs: unknown[] = []
  const worker = createPersistenceWorker({
    repositories: {
      answerSubmissions: {
        insertAcceptedAnswerIdempotently: async (input) => {
          inputs.push(input)
          return {}
        },
      },
      finalResults: { replaceFinalResults: async () => [] },
    },
    delay: async () => {},
    logger: () => {},
  })

  await worker.enqueue(acceptedAnswerEvent)
  await flushMicrotasks()

  expect(inputs).toEqual([
    {
      quizSessionId: 'session-1',
      participantId: 'participant-1',
      questionId: 'question-1',
      selectedOptionId: 'option-1',
      isCorrect: true,
      scoreAwarded: 100,
      submittedAt: new Date('2026-06-16T10:00:05.000Z'),
    },
  ])
})

test('final_leaderboard maps and writes to final results repository', async () => {
  const writes: { quizSessionId: string; rows: unknown }[] = []
  const worker = createPersistenceWorker({
    repositories: {
      answerSubmissions: { insertAcceptedAnswerIdempotently: async () => ({}) },
      finalResults: {
        replaceFinalResults: async (quizSessionId, rows) => {
          writes.push({ quizSessionId, rows })
          return []
        },
      },
    },
    delay: async () => {},
    logger: () => {},
  })

  await worker.enqueue(finalLeaderboardEvent)
  await flushMicrotasks()

  expect(writes).toEqual([
    {
      quizSessionId: 'session-1',
      rows: [
        {
          participantId: 'participant-1',
          rank: 1,
          score: 200,
          correctAnswerCount: 2,
          lastCorrectSubmissionAt: new Date('2026-06-16T10:04:05.000Z'),
          joinedAt: new Date('2026-06-16T09:59:00.000Z'),
          recordedAt: new Date('2026-06-16T10:05:00.000Z'),
        },
        {
          participantId: 'participant-2',
          rank: 2,
          score: 100,
          correctAnswerCount: 1,
          lastCorrectSubmissionAt: null,
          joinedAt: new Date('2026-06-16T09:59:30.000Z'),
          recordedAt: new Date('2026-06-16T10:05:00.000Z'),
        },
      ],
    },
  ])
})

test('temporary failure retries and eventually succeeds', async () => {
  const delays: number[] = []
  const logs: unknown[][] = []
  let attempts = 0
  const worker = createPersistenceWorker({
    repositories: {
      answerSubmissions: {
        insertAcceptedAnswerIdempotently: async () => {
          attempts += 1
          if (attempts < 3) {
            throw new Error(`temporary-${attempts}`)
          }
          return {}
        },
      },
      finalResults: { replaceFinalResults: async () => [] },
    },
    delay: async (delayMs) => {
      delays.push(delayMs)
    },
    logger: (...args) => {
      logs.push(args)
    },
  })

  await worker.enqueue(acceptedAnswerEvent)
  await flushMicrotasks()

  expect(attempts).toBe(3)
  expect(delays).toEqual([100, 200])
  expect(logs).toHaveLength(2)
  expect(logs[0]?.[0]).toBe('Persistence event write failed')
  expect(logs[0]?.[1]).toMatchObject({
    type: acceptedAnswerEvent.type,
    quizSessionId: acceptedAnswerEvent.quizSessionId,
    attempt: 1,
    participantId: acceptedAnswerEvent.participantId,
    questionId: acceptedAnswerEvent.questionId,
  })
})

test('retry exhaustion logs and drops so a later event can continue', async () => {
  const delays: number[] = []
  const logs: unknown[][] = []
  let acceptedAttempts = 0
  const finalWrites: string[] = []
  const worker = createPersistenceWorker({
    repositories: {
      answerSubmissions: {
        insertAcceptedAnswerIdempotently: async () => {
          acceptedAttempts += 1
          throw new Error(`permanent-${acceptedAttempts}`)
        },
      },
      finalResults: {
        replaceFinalResults: async (quizSessionId) => {
          finalWrites.push(quizSessionId)
          return []
        },
      },
    },
    delay: async (delayMs) => {
      delays.push(delayMs)
    },
    logger: (...args) => {
      logs.push(args)
    },
  })

  await worker.enqueue(acceptedAnswerEvent)
  await worker.enqueue(finalLeaderboardEvent)
  await flushMicrotasks()

  expect(acceptedAttempts).toBe(6)
  expect(delays).toEqual([100, 200, 400, 800, 1600])
  expect(finalWrites).toEqual(['session-1'])
  expect(logs).toHaveLength(7)
  expect(logs.at(-1)?.[0]).toBe('Persistence event retries exhausted')
  expect(logs.at(-1)?.[1]).toMatchObject({
    type: acceptedAnswerEvent.type,
    quizSessionId: acceptedAnswerEvent.quizSessionId,
    attempt: 6,
    participantId: acceptedAnswerEvent.participantId,
    questionId: acceptedAnswerEvent.questionId,
  })
})

test('duplicate accepted_answer delegates to idempotent repository twice', async () => {
  const inputs: unknown[] = []
  const worker = createPersistenceWorker({
    repositories: {
      answerSubmissions: {
        insertAcceptedAnswerIdempotently: async (input) => {
          inputs.push(input)
          return {}
        },
      },
      finalResults: { replaceFinalResults: async () => [] },
    },
    delay: async () => {},
    logger: () => {},
  })

  await worker.enqueue(acceptedAnswerEvent)
  await worker.enqueue(acceptedAnswerEvent)
  await flushMicrotasks()

  expect(inputs).toHaveLength(2)
  expect(inputs[0]).toEqual(inputs[1])
})

test('persists accepted answers idempotently and final leaderboard through durable repositories', async () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()
  let questionSetId: string | undefined
  let quizSessionId: string | undefined

  try {
    const questionSet = await questionSetsRepository.createFullQuestionSet({
      title: `Worker Persistence Quiz ${suffix}`,
      defaultTimeLimitSeconds: 30,
      questions: [
        {
          prompt: 'Which store keeps durable quiz records?',
          options: [
            { optionText: 'PostgreSQL', isCorrect: true },
            { optionText: 'Redis', isCorrect: false },
          ],
        },
      ],
    })
    questionSetId = questionSet.id
    const question = questionSet.questions[0]
    const correctOption = question?.options.find((option) => option.isCorrect)

    if (!question || !correctOption) {
      throw new Error('Worker persistence test bundle did not create a correct option')
    }

    const quizSession = await quizSessionsRepository.createQuizSession({
      questionSetId,
      quizCode: `WP${suffix.slice(0, 6)}`,
      hostTokenHash: `host-worker-${suffix}`,
    })
    quizSessionId = quizSession.id
    const participant = await participantsRepository.createParticipant({
      quizSessionId,
      displayName: 'Worker Participant',
      participantTokenHash: `participant-worker-${suffix}`,
    })
    const submittedAt = new Date('2026-06-16T10:00:05.000Z')
    const recordedAt = new Date('2026-06-16T10:05:00.000Z')
    const worker = createPersistenceWorker({ logger: () => {} })
    const acceptedAnswer = {
      type: 'accepted_answer',
      quizSessionId,
      participantId: participant.id,
      questionId: question.id,
      selectedOptionId: correctOption.id,
      isCorrect: true,
      scoreAwarded: 100,
      submittedAt,
    } satisfies AcceptedAnswerPersistenceEvent

    await worker.enqueue(acceptedAnswer)
    await worker.enqueue(acceptedAnswer)
    await worker.enqueue({
      type: 'final_leaderboard',
      quizSessionId,
      recordedAt,
      entries: [
        {
          participantId: participant.id,
          rank: 1,
          score: 100,
          correctAnswerCount: 1,
          lastCorrectSubmissionAt: submittedAt,
          joinedAt: participant.joinedAt,
        },
      ],
    } satisfies FinalLeaderboardPersistenceEvent)

    await waitForCondition(
      async () =>
        (await answerSubmissionsRepository.listBySession(quizSession.id)).length === 1 &&
        (await finalResultsRepository.readLeaderboard(quizSession.id)).length === 1,
      'Persistence worker did not write durable answer and final result rows',
    )

    const submissions = await answerSubmissionsRepository.listBySession(quizSession.id)
    expect(submissions).toMatchObject([
      {
        quizSessionId,
        participantId: participant.id,
        questionId: question.id,
        selectedOptionId: correctOption.id,
        isCorrect: true,
        scoreAwarded: 100,
      },
    ])
    expect(submissions[0]?.submittedAt.toISOString()).toBe(submittedAt.toISOString())

    const finalLeaderboard = await finalResultsRepository.readLeaderboard(quizSession.id)
    expect(finalLeaderboard).toMatchObject([
      {
        quizSessionId,
        participantId: participant.id,
        rank: 1,
        score: 100,
        correctAnswerCount: 1,
      },
    ])
    expect(finalLeaderboard[0]?.recordedAt.toISOString()).toBe(recordedAt.toISOString())
  } finally {
    if (quizSessionId) {
      await db.delete(quizSessions).where(eq(quizSessions.id, quizSessionId))
    }

    if (questionSetId) {
      await db.delete(questionSets).where(eq(questionSets.id, questionSetId))
    }
  }
})
