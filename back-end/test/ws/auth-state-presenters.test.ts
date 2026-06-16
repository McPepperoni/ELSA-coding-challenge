// AI Generated code <PURPOSE>: verify WebSocket auth and reconnect presenter contracts
import { expect, test } from 'bun:test'

import type { Participant, QuizSession } from '@/db/schema.js'
import type { FullQuestionSet } from '@/db/repositories/question-sets.js'
import {
  authenticateHostSocket,
  authenticateParticipantSocket,
} from '@/ws/auth.js'
import {
  createHostStatePresenter,
  createParticipantStatePresenter,
} from '@/ws/state-presenters.js'

const now = new Date('2026-06-16T10:00:00.000Z')
const activeEndsAt = new Date('2026-06-16T10:00:30.000Z')

const quizSession: QuizSession = {
  id: 'session-1',
  questionSetId: 'set-1',
  quizCode: 'ABC12345',
  status: 'waiting_room',
  currentQuestionPosition: null,
  questionOrderIds: ['question-1', 'question-2'],
  hostTokenHash: 'hash:host-token',
  startedAt: null,
  finishedAt: null,
  createdAt: now,
  updatedAt: now,
}

const participant: Participant = {
  id: 'participant-1',
  quizSessionId: quizSession.id,
  displayName: 'Ada',
  participantTokenHash: 'hash:participant-token',
  joinedAt: new Date('2026-06-16T09:59:00.000Z'),
  lastSeenAt: null,
}

const secondParticipant: Participant = {
  ...participant,
  id: 'participant-2',
  displayName: 'Grace',
  participantTokenHash: 'hash:participant-2-token',
  joinedAt: new Date('2026-06-16T09:59:30.000Z'),
}

const questionSet: FullQuestionSet = {
  id: quizSession.questionSetId,
  title: 'Computer history',
  defaultTimeLimitSeconds: 30,
  createdAt: now,
  updatedAt: now,
  questions: [
    {
      id: 'question-1',
      questionSetId: quizSession.questionSetId,
      prompt: 'Who wrote the first computer program?',
      timeLimitSeconds: 20,
      createdAt: now,
      options: [
        {
          id: 'option-1',
          questionId: 'question-1',
          optionText: 'Ada Lovelace',
          position: 1,
          isCorrect: true,
          createdAt: now,
        },
        {
          id: 'option-2',
          questionId: 'question-1',
          optionText: 'Grace Hopper',
          position: 2,
          isCorrect: false,
          createdAt: now,
        },
      ],
    },
    {
      id: 'question-2',
      questionSetId: quizSession.questionSetId,
      prompt: 'Which machine used punched cards?',
      timeLimitSeconds: null,
      createdAt: now,
      options: [
        {
          id: 'option-3',
          questionId: 'question-2',
          optionText: 'Analytical Engine',
          position: 1,
          isCorrect: true,
          createdAt: now,
        },
        {
          id: 'option-4',
          questionId: 'question-2',
          optionText: 'Difference Engine',
          position: 2,
          isCorrect: false,
          createdAt: now,
        },
      ],
    },
  ],
}

const createAuthDependencies = () => ({
  tokenService: {
    hashToken: (token: string) => `hash:${token}`,
  },
  quizSessions: {
    findByHostTokenHash: async (tokenHash: string) =>
      tokenHash === quizSession.hostTokenHash ? quizSession : null,
    findById: async (quizSessionId: string) =>
      quizSessionId === quizSession.id ? quizSession : null,
  },
  participants: {
    findByTokenHash: async (tokenHash: string) =>
      tokenHash === participant.participantTokenHash ? participant : null,
  },
})

const createPresenterDependencies = (
  status: QuizSession['status'],
  options: {
    answeredCount?: number
    hasAnswered?: boolean
  } = {},
) => ({
  questionSets: {
    findFullQuestionSetById: async (questionSetId: string) =>
      questionSetId === questionSet.id ? questionSet : null,
  },
  participants: {
    listBySession: async () => [participant, secondParticipant],
  },
  liveSessions: {
    readLiveSession: async () => ({
      quizSessionId: quizSession.id,
      status,
      questionOrderIds: quizSession.questionOrderIds,
      currentQuestionId: status === 'waiting_room' || status === 'finished' ? null : 'question-1',
      currentQuestionPosition: status === 'waiting_room' || status === 'finished' ? null : 1,
      startedAt: status === 'waiting_room' ? null : now,
      endsAt: status === 'question_active' ? activeEndsAt : null,
    }),
  },
  answerLocks: {
    readAnsweredCount: async () => options.answeredCount ?? 0,
    hasParticipantAnswered: async () => options.hasAnswered ?? false,
  },
  leaderboard: {
    readTopLeaderboardEntries: async () => [
      {
        participantId: participant.id,
        displayName: participant.displayName,
        rank: 1,
        score: 1000,
        correctAnswerCount: 1,
        lastCorrectSubmissionAt: now,
        joinedAt: participant.joinedAt,
      },
    ],
    readLeaderboard: async () => [
      {
        participantId: participant.id,
        displayName: participant.displayName,
        rank: 1,
        score: 1000,
        correctAnswerCount: 1,
        lastCorrectSubmissionAt: now,
        joinedAt: participant.joinedAt,
      },
      {
        participantId: secondParticipant.id,
        displayName: secondParticipant.displayName,
        rank: 2,
        score: 500,
        correctAnswerCount: 1,
        lastCorrectSubmissionAt: now,
        joinedAt: secondParticipant.joinedAt,
      },
    ],
  },
})

test('rejects missing and invalid host tokens', async () => {
  await expect(authenticateHostSocket(createAuthDependencies(), '   ')).resolves.toEqual({
    ok: false,
    event: {
      type: 'protocol_error',
      code: 'missing_token',
      message: 'WebSocket token is required.',
    },
  })

  await expect(authenticateHostSocket(createAuthDependencies(), 'wrong-token')).resolves.toEqual({
    ok: false,
    event: {
      type: 'protocol_error',
      code: 'invalid_host_token',
      message: 'Host WebSocket token is invalid.',
    },
  })
})

test('accepts a valid host token', async () => {
  await expect(authenticateHostSocket(createAuthDependencies(), 'host-token')).resolves.toEqual({
    ok: true,
    connection: {
      role: 'host',
      quizSession,
    },
  })
})

test('accepts a valid participant token and resolves its session', async () => {
  await expect(
    authenticateParticipantSocket(createAuthDependencies(), 'participant-token'),
  ).resolves.toEqual({
    ok: true,
    connection: {
      role: 'participant',
      participant,
      quizSession,
    },
  })
})

test('presents host waiting-room reconnect state', async () => {
  const event = await createHostStatePresenter(
    createPresenterDependencies('waiting_room'),
  ).presentHostState(quizSession)

  expect(event).toMatchObject({
    type: 'session_state',
    view: 'host',
    quizSessionId: quizSession.id,
    quizCode: quizSession.quizCode,
    status: 'waiting_room',
    currentQuestionPosition: null,
    totalQuestions: 2,
    participantCount: 2,
    participants: [
      { id: participant.id, displayName: participant.displayName, joinedAt: participant.joinedAt },
      {
        id: secondParticipant.id,
        displayName: secondParticipant.displayName,
        joinedAt: secondParticipant.joinedAt,
      },
    ],
  })
})

test('presents host active reconnect state without revealing correctness', async () => {
  const event = await createHostStatePresenter(
    createPresenterDependencies('question_active', { answeredCount: 1 }),
  ).presentHostState(quizSession)

  expect(event).toMatchObject({
    type: 'session_state',
    view: 'host',
    status: 'question_active',
    currentQuestionPosition: 1,
    answeredCount: 1,
    participantCount: 2,
    question: {
      id: 'question-1',
      prompt: 'Who wrote the first computer program?',
      timeLimitSeconds: 20,
      options: [
        { id: 'option-1', text: 'Ada Lovelace', position: 1 },
        { id: 'option-2', text: 'Grace Hopper', position: 2 },
      ],
    },
  })
  expect(JSON.stringify(event)).not.toContain('isCorrect')
  expect(JSON.stringify(event)).not.toContain('correctOptionId')
})

test('presents host reveal reconnect state with correct answer and top leaderboard', async () => {
  const event = await createHostStatePresenter(
    createPresenterDependencies('question_reveal', { answeredCount: 2 }),
  ).presentHostState(quizSession)

  expect(event).toMatchObject({
    type: 'session_state',
    view: 'host',
    status: 'question_reveal',
    currentQuestionPosition: 1,
    answeredCount: 2,
    participantCount: 2,
    correctOptionId: 'option-1',
    leaderboard: [{ participantId: participant.id, rank: 1, score: 1000 }],
  })
})

test('presents host finished reconnect state with leaderboard and no active question', async () => {
  const event = await createHostStatePresenter(
    createPresenterDependencies('finished'),
  ).presentHostState(quizSession)

  expect(event).toMatchObject({
    type: 'session_state',
    view: 'host',
    status: 'finished',
    currentQuestionPosition: null,
    leaderboard: [
      { participantId: participant.id, rank: 1, score: 1000 },
      { participantId: secondParticipant.id, rank: 2, score: 500 },
    ],
  })
  expect(event).not.toHaveProperty('question')
})

test('presents participant active reconnect state with answered status', async () => {
  const event = await createParticipantStatePresenter(
    createPresenterDependencies('question_active', { hasAnswered: true }),
  ).presentParticipantState(participant, quizSession)

  expect(event).toMatchObject({
    type: 'session_state',
    view: 'participant',
    status: 'question_active',
    currentQuestionPosition: 1,
    question: {
      id: 'question-1',
      position: 1,
      options: [
        { id: 'option-1', position: 1 },
        { id: 'option-2', position: 2 },
      ],
    },
    hasAnswered: true,
    canSubmit: false,
  })
})

test('presents participant finished reconnect state with leaderboard and no question payload', async () => {
  const event = await createParticipantStatePresenter(
    createPresenterDependencies('finished'),
  ).presentParticipantState(participant, quizSession)

  expect(event).toMatchObject({
    type: 'session_state',
    view: 'participant',
    status: 'finished',
    currentQuestionPosition: null,
    leaderboard: [
      { participantId: participant.id, rank: 1, score: 1000 },
      { participantId: secondParticipant.id, rank: 2, score: 500 },
    ],
  })
  expect(event).not.toHaveProperty('question')

  const payload = JSON.stringify(event)

  expect(payload).not.toContain('Who wrote the first computer program?')
  expect(payload).not.toContain('Ada Lovelace')
  expect(payload).not.toContain('Grace Hopper')
  expect(payload).not.toContain('isCorrect')
  expect(payload).not.toContain('correctOptionId')
})

test('participant active payload does not expose prompt, option text, or correctness', async () => {
  const event = await createParticipantStatePresenter(
    createPresenterDependencies('question_active', { hasAnswered: true }),
  ).presentParticipantState(participant, quizSession)

  const payload = JSON.stringify(event)

  expect(payload).not.toContain('Who wrote the first computer program?')
  expect(payload).not.toContain('Ada Lovelace')
  expect(payload).not.toContain('Grace Hopper')
  expect(payload).not.toContain('isCorrect')
  expect(payload).not.toContain('correctOptionId')
})
