// AI Generated code <PURPOSE>: verify persistence event sink contract
import { expect, test } from 'bun:test'

import {
  noopPersistenceEventSink,
  type AcceptedAnswerPersistenceEvent,
  type FinalLeaderboardPersistenceEvent,
} from '@/workers/index.js'

test('noop persistence event sink accepts accepted answer events', async () => {
  const event = {
    type: 'accepted_answer',
    quizSessionId: 'session-1',
    participantId: 'participant-1',
    questionId: 'question-1',
    selectedOptionId: 'option-1',
    isCorrect: true,
    scoreAwarded: 100,
    submittedAt: new Date('2026-06-16T10:00:05.000Z'),
  } satisfies AcceptedAnswerPersistenceEvent

  await expect(noopPersistenceEventSink.enqueue(event)).resolves.toBeUndefined()
})

test('noop persistence event sink accepts final leaderboard events', async () => {
  const event = {
    type: 'final_leaderboard',
    quizSessionId: 'session-1',
    recordedAt: new Date('2026-06-16T10:05:00.000Z'),
    entries: [
      {
        participantId: 'participant-1',
        rank: 1,
        score: 100,
        correctAnswerCount: 1,
        lastCorrectSubmissionAt: new Date('2026-06-16T10:00:05.000Z'),
        joinedAt: new Date('2026-06-16T09:59:00.000Z'),
      },
      {
        participantId: 'participant-2',
        rank: 2,
        score: 0,
        correctAnswerCount: 0,
        lastCorrectSubmissionAt: null,
        joinedAt: new Date('2026-06-16T09:59:30.000Z'),
      },
    ],
  } satisfies FinalLeaderboardPersistenceEvent

  await expect(noopPersistenceEventSink.enqueue(event)).resolves.toBeUndefined()
})
