// AI Generated code <PURPOSE>: verify backend REST API setup flows
import { randomUUID } from 'node:crypto'

import { expect, test } from 'bun:test'

import type { QuizSession } from '@/db/schema.js'
import { createHttpApp, type HttpDependencies } from '@/http/app.js'

type QuestionSetInput = Parameters<HttpDependencies['questionSets']['createFullQuestionSet']>[0]
type QuizSessionInput = Parameters<HttpDependencies['quizSessions']['createQuizSession']>[0]
type ParticipantInput = Parameters<HttpDependencies['participants']['createParticipant']>[0]

const isoDate = new Date('2026-01-01T00:00:00.000Z')

const makeQuestionSet = (input: QuestionSetInput) => ({
  id: 'question-set-1',
  title: input.title,
  defaultTimeLimitSeconds: input.defaultTimeLimitSeconds,
  createdAt: isoDate,
  updatedAt: isoDate,
  questions: input.questions.map((question, questionIndex) => ({
    id: `question-${questionIndex + 1}`,
    questionSetId: 'question-set-1',
    prompt: question.prompt,
    timeLimitSeconds: question.timeLimitSeconds ?? null,
    createdAt: isoDate,
    options: question.options.map((option, optionIndex) => ({
      id: `option-${questionIndex + 1}-${optionIndex + 1}`,
      questionId: `question-${questionIndex + 1}`,
      optionText: option.optionText,
      position: optionIndex + 1,
      isCorrect: option.isCorrect,
      createdAt: isoDate,
    })),
  })),
})

const createDependencies = (overrides: Partial<HttpDependencies> = {}) => {
  const state = {
    questionSet: makeQuestionSet({
      title: 'General Knowledge',
      defaultTimeLimitSeconds: 30,
      questions: [
        {
          prompt: 'Which datastore stores durable quiz records?',
          options: [
            { optionText: 'PostgreSQL', isCorrect: true },
            { optionText: 'Redis', isCorrect: false },
          ],
        },
      ],
    }),
    quizSession: {
      id: 'quiz-session-1',
      questionSetId: 'question-set-1',
      quizCode: 'QUIZ2026',
      status: 'waiting_room' as const,
      currentQuestionPosition: null,
      questionOrderIds: ['question-1'],
      hostTokenHash: 'hash-host-token',
      startedAt: null,
      finishedAt: null,
      createdAt: isoDate,
      updatedAt: isoDate,
    } as QuizSession,
    participant: {
      id: 'participant-1',
      quizSessionId: 'quiz-session-1',
      displayName: 'Ada',
      participantTokenHash: 'hash-participant-token',
      joinedAt: isoDate,
      lastSeenAt: null,
    },
    createdQuestionSetInput: null as QuestionSetInput | null,
    createdQuizSessionInput: null as QuizSessionInput | null,
    createdParticipantInput: null as ParticipantInput | null,
    deletedQuizSessionIds: [] as string[],
    deletedParticipantIds: [] as string[],
    initializedLiveSessions: [] as string[],
    upsertedParticipants: [] as string[],
    generatedCodes: ['QUIZ2026'] as string[],
    generatedTokens: ['host-token', 'participant-token'] as string[],
  }

  const dependencies: HttpDependencies = {
    questionSets: {
      async createFullQuestionSet(input) {
        state.createdQuestionSetInput = input
        state.questionSet = makeQuestionSet(input)
        return state.questionSet
      },
      async findFullQuestionSetById(id) {
        return id === state.questionSet.id ? state.questionSet : null
      },
    },
    quizSessions: {
      async createQuizSession(input) {
        state.createdQuizSessionInput = input
        state.quizSession = {
          ...state.quizSession,
          id: `quiz-session-${randomUUID()}`,
          questionSetId: input.questionSetId,
          quizCode: input.quizCode,
          hostTokenHash: input.hostTokenHash,
          questionOrderIds: ['question-1'],
        }
        return state.quizSession
      },
      async findByQuizCode(quizCode) {
        return quizCode === state.quizSession.quizCode ? state.quizSession : null
      },
      async findByHostTokenHash(hostTokenHash) {
        return hostTokenHash === state.quizSession.hostTokenHash ? state.quizSession : null
      },
      async findById(id) {
        return id === state.quizSession.id ? state.quizSession : null
      },
      async deleteQuizSession(id) {
        state.deletedQuizSessionIds.push(id)
      },
    },
    participants: {
      async createParticipant(input) {
        state.createdParticipantInput = input
        state.participant = {
          ...state.participant,
          quizSessionId: input.quizSessionId,
          displayName: input.displayName,
          participantTokenHash: input.participantTokenHash,
        }
        return state.participant
      },
      async findByTokenHash(participantTokenHash) {
        return participantTokenHash === state.participant.participantTokenHash
          ? state.participant
          : null
      },
      async listBySession(quizSessionId) {
        return quizSessionId === state.quizSession.id ? [state.participant] : []
      },
      async deleteParticipant(id) {
        state.deletedParticipantIds.push(id)
      },
    },
    liveSessions: {
      async initializeLiveSession(input) {
        state.initializedLiveSessions.push(input.quizSessionId)
        return {
          quizSessionId: input.quizSessionId,
          status: 'waiting_room',
          questionOrderIds: input.questionOrderIds,
          currentQuestionId: null,
          currentQuestionPosition: null,
          startedAt: null,
          endsAt: null,
        }
      },
    },
    leaderboard: {
      async upsertParticipant(input) {
        state.upsertedParticipants.push(input.participantId)
        return {
          participantId: input.participantId,
          displayName: input.displayName,
          score: 0,
          correctAnswerCount: 0,
          lastCorrectSubmissionAt: null,
          joinedAt: input.joinedAt,
        }
      },
    },
    tokenService: {
      generateQuizCode() {
        return state.generatedCodes.shift() ?? 'NEXT2026'
      },
      generateToken() {
        return state.generatedTokens.shift() ?? 'fallback-token'
      },
      hashToken(token) {
        return `hash-${token}`
      },
    },
    ...overrides,
  }

  return { dependencies, state }
}

const validQuestionSetBody = () => ({
  title: 'General Knowledge',
  defaultTimeLimitSeconds: 30,
  questions: [
    {
      prompt: 'Which datastore stores durable quiz records?',
      timeLimitSeconds: 45,
      options: [
        { text: 'PostgreSQL', isCorrect: true },
        { text: 'Redis', isCorrect: false },
      ],
    },
  ],
})

test('allows any origin on REST route responses', async () => {
  const { dependencies } = createDependencies()
  const app = createHttpApp(dependencies)

  const response = await app.request('/api/question-sets', {
    method: 'POST',
    body: JSON.stringify(validQuestionSetBody()),
    headers: {
      'content-type': 'application/json',
      origin: 'https://host.example.test',
    },
  })

  expect(response.status).toBe(201)
  expect(response.headers.get('access-control-allow-origin')).toBe('*')
})

test('answers JSON route preflight requests with wildcard CORS headers', async () => {
  const { dependencies } = createDependencies()
  const app = createHttpApp(dependencies)

  const response = await app.request('/api/question-sets', {
    method: 'OPTIONS',
    headers: {
      origin: 'https://participant.example.test',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type',
    },
  })

  expect(response.status).toBe(204)
  expect(response.headers.get('access-control-allow-origin')).toBe('*')
  expect(response.headers.get('access-control-allow-methods')).toContain('POST')
  expect(response.headers.get('access-control-allow-methods')).toContain('OPTIONS')
  expect(response.headers.get('access-control-allow-headers')).toContain('Content-Type')
})

test('allows authorization headers on protected route preflights', async () => {
  const { dependencies, state } = createDependencies()
  const app = createHttpApp(dependencies)

  const response = await app.request(`/api/quiz-sessions/${state.quizSession.id}/host`, {
    method: 'OPTIONS',
    headers: {
      origin: 'https://host.example.test',
      'access-control-request-method': 'GET',
      'access-control-request-headers': 'authorization',
    },
  })

  expect(response.status).toBe(204)
  expect(response.headers.get('access-control-allow-origin')).toBe('*')
  expect(response.headers.get('access-control-allow-headers')).toContain('Authorization')
})

test('creates a valid question set through REST and maps option text', async () => {
  const { dependencies, state } = createDependencies()
  const app = createHttpApp(dependencies)

  const response = await app.request('/api/question-sets', {
    method: 'POST',
    body: JSON.stringify(validQuestionSetBody()),
    headers: { 'content-type': 'application/json' },
  })

  expect(response.status).toBe(201)
  expect(state.createdQuestionSetInput?.questions[0]?.options[0]?.optionText).toBe('PostgreSQL')
  expect(await response.json()).toMatchObject({
    questionSet: {
      id: 'question-set-1',
      title: 'General Knowledge',
      questions: [
        {
          id: 'question-1',
          prompt: 'Which datastore stores durable quiz records?',
          options: [
            { id: 'option-1-1', text: 'PostgreSQL', position: 1, isCorrect: true },
            { id: 'option-1-2', text: 'Redis', position: 2, isCorrect: false },
          ],
        },
      ],
    },
  })
})

test('rejects invalid question sets with a user-facing error', async () => {
  const { dependencies } = createDependencies()
  const app = createHttpApp(dependencies)

  const response = await app.request('/api/question-sets', {
    method: 'POST',
    body: JSON.stringify({ ...validQuestionSetBody(), title: '   ' }),
    headers: { 'content-type': 'application/json' },
  })

  expect(response.status).toBe(400)
  expect(await response.json()).toEqual({
    error: {
      code: 'question_set_title_required',
      message: 'Question set title is required',
    },
  })
})

test('rejects nonnumeric optional question timers as invalid input', async () => {
  const { dependencies } = createDependencies()
  const app = createHttpApp(dependencies)
  const [question] = validQuestionSetBody().questions

  const response = await app.request('/api/question-sets', {
    method: 'POST',
    body: JSON.stringify({
      ...validQuestionSetBody(),
      questions: [{ ...question, timeLimitSeconds: 'slow' }],
    }),
    headers: { 'content-type': 'application/json' },
  })

  expect(response.status).toBe(400)
  expect(await response.json()).toEqual({
    error: {
      code: 'timer_not_integer',
      message: 'questions[0].timeLimitSeconds must be an integer number of seconds',
    },
  })
})

test('returns clear JSON for malformed request bodies', async () => {
  const { dependencies } = createDependencies()
  const app = createHttpApp(dependencies)

  const response = await app.request('/api/question-sets', {
    method: 'POST',
    body: '{',
    headers: { 'content-type': 'application/json' },
  })

  expect(response.status).toBe(400)
  expect(await response.json()).toEqual({
    error: {
      code: 'invalid_json',
      message: 'Request body must be valid JSON',
    },
  })
})

test('creates a quiz session with a private host token and initializes Redis state', async () => {
  const { dependencies, state } = createDependencies()
  state.generatedCodes = ['TAKEN001', 'QUIZ2026']
  const app = createHttpApp({
    ...dependencies,
    quizSessions: {
      ...dependencies.quizSessions,
      async findByQuizCode(quizCode) {
        return quizCode === 'TAKEN001' ? state.quizSession : null
      },
    },
  })

  const response = await app.request('/api/quiz-sessions', {
    method: 'POST',
    body: JSON.stringify({ questionSetId: 'question-set-1' }),
    headers: { 'content-type': 'application/json' },
  })

  expect(response.status).toBe(201)
  expect(state.createdQuizSessionInput).toMatchObject({
    questionSetId: 'question-set-1',
    quizCode: 'QUIZ2026',
    hostTokenHash: 'hash-host-token',
  })
  expect(state.initializedLiveSessions).toEqual([state.quizSession.id])
  expect(await response.json()).toMatchObject({
    quizSession: {
      id: state.quizSession.id,
      questionSetId: 'question-set-1',
      quizCode: 'QUIZ2026',
      status: 'waiting_room',
      questionOrderIds: ['question-1'],
      currentQuestionPosition: null,
      joinPath: '/join/QUIZ2026',
    },
    hostToken: 'host-token',
  })
})

test('rejects session creation when the stored question set is no longer valid', async () => {
  const { dependencies, state } = createDependencies()
  state.questionSet = { ...state.questionSet, questions: [] }
  const app = createHttpApp(dependencies)

  const response = await app.request('/api/quiz-sessions', {
    method: 'POST',
    body: JSON.stringify({ questionSetId: 'question-set-1' }),
    headers: { 'content-type': 'application/json' },
  })

  expect(response.status).toBe(409)
  expect(state.createdQuizSessionInput).toBeNull()
  expect(await response.json()).toEqual({
    error: {
      code: 'question_required',
      message: 'Question set must include at least one question',
    },
  })
})

test('retries quiz code creation when the database reports a unique collision', async () => {
  const { dependencies, state } = createDependencies()
  state.generatedCodes = ['RACE2026', 'SAFE2026']
  let createAttempts = 0
  const app = createHttpApp({
    ...dependencies,
    quizSessions: {
      ...dependencies.quizSessions,
      async createQuizSession(input) {
        createAttempts += 1
        if (createAttempts === 1) {
          const error = new Error('duplicate key value violates unique constraint')
          Object.assign(error, { code: '23505' })
          throw error
        }
        state.createdQuizSessionInput = input
        state.quizSession = {
          ...state.quizSession,
          quizCode: input.quizCode,
          hostTokenHash: input.hostTokenHash,
        }
        return state.quizSession
      },
    },
  })

  const response = await app.request('/api/quiz-sessions', {
    method: 'POST',
    body: JSON.stringify({ questionSetId: 'question-set-1' }),
    headers: { 'content-type': 'application/json' },
  })

  expect(response.status).toBe(201)
  expect(createAttempts).toBe(2)
  expect(state.createdQuizSessionInput?.quizCode).toBe('SAFE2026')
})

test('removes a durable quiz session when Redis initialization fails before token return', async () => {
  const { dependencies, state } = createDependencies()
  const app = createHttpApp({
    ...dependencies,
    liveSessions: {
      async initializeLiveSession() {
        throw new Error('redis unavailable')
      },
    },
  })

  const response = await app.request('/api/quiz-sessions', {
    method: 'POST',
    body: JSON.stringify({ questionSetId: 'question-set-1' }),
    headers: { 'content-type': 'application/json' },
  })

  expect(response.status).toBe(503)
  expect(state.deletedQuizSessionIds).toEqual([state.quizSession.id])
  expect(await response.json()).toEqual({
    error: {
      code: 'live_state_unavailable',
      message: 'Live session state could not be initialized',
    },
  })
})

test('rejects quiz session creation for unknown question set ids', async () => {
  const { dependencies } = createDependencies()
  const app = createHttpApp(dependencies)

  const response = await app.request('/api/quiz-sessions', {
    method: 'POST',
    body: JSON.stringify({ questionSetId: 'missing-question-set' }),
    headers: { 'content-type': 'application/json' },
  })

  expect(response.status).toBe(404)
  expect(await response.json()).toEqual({
    error: {
      code: 'question_set_not_found',
      message: 'Question set was not found',
    },
  })
})

test('joins a waiting-room quiz and records live participant membership', async () => {
  const { dependencies, state } = createDependencies()
  state.generatedTokens = ['participant-token']
  const app = createHttpApp(dependencies)

  const response = await app.request('/api/participants', {
    method: 'POST',
    body: JSON.stringify({ quizCode: 'quiz2026', displayName: ' Ada ' }),
    headers: { 'content-type': 'application/json' },
  })

  expect(response.status).toBe(201)
  expect(state.createdParticipantInput).toMatchObject({
    quizSessionId: 'quiz-session-1',
    displayName: 'Ada',
    participantTokenHash: 'hash-participant-token',
  })
  expect(state.upsertedParticipants).toEqual(['participant-1'])
  expect(await response.json()).toMatchObject({
    participant: {
      id: 'participant-1',
      displayName: 'Ada',
    },
    quizSession: {
      id: 'quiz-session-1',
      quizCode: 'QUIZ2026',
      status: 'waiting_room',
      joinPath: '/join/QUIZ2026',
    },
    participantToken: 'participant-token',
  })
})

test('rejects invalid quiz codes and joins outside the waiting room', async () => {
  const { dependencies, state } = createDependencies()
  const app = createHttpApp(dependencies)

  const invalidCode = await app.request('/api/participants', {
    method: 'POST',
    body: JSON.stringify({ quizCode: 'missing', displayName: 'Ada' }),
    headers: { 'content-type': 'application/json' },
  })

  expect(invalidCode.status).toBe(404)
  expect(await invalidCode.json()).toEqual({
    error: {
      code: 'invalid_quiz_code',
      message: 'Quiz code was not found',
    },
  })

  state.quizSession = { ...state.quizSession, status: 'finished' }
  const finished = await app.request('/api/participants', {
    method: 'POST',
    body: JSON.stringify({ quizCode: 'QUIZ2026', displayName: 'Ada' }),
    headers: { 'content-type': 'application/json' },
  })

  expect(finished.status).toBe(409)
  expect(await finished.json()).toEqual({
    error: {
      code: 'quiz_finished',
      message: 'Quiz session has finished',
    },
  })

  for (const status of ['question_active', 'question_reveal'] as const) {
    state.quizSession = { ...state.quizSession, status }
    const active = await app.request('/api/participants', {
      method: 'POST',
      body: JSON.stringify({ quizCode: 'QUIZ2026', displayName: 'Ada' }),
      headers: { 'content-type': 'application/json' },
    })

    expect(active.status).toBe(409)
    expect(await active.json()).toEqual({
      error: {
        code: 'quiz_already_started',
        message: 'Quiz session has already started',
      },
    })
  }
})

test('removes a durable participant when Redis membership write fails before token return', async () => {
  const { dependencies, state } = createDependencies()
  state.generatedTokens = ['participant-token']
  const app = createHttpApp({
    ...dependencies,
    leaderboard: {
      async upsertParticipant() {
        throw new Error('redis unavailable')
      },
    },
  })

  const response = await app.request('/api/participants', {
    method: 'POST',
    body: JSON.stringify({ quizCode: 'QUIZ2026', displayName: 'Ada' }),
    headers: { 'content-type': 'application/json' },
  })

  expect(response.status).toBe(503)
  expect(state.deletedParticipantIds).toEqual([state.participant.id])
  expect(await response.json()).toEqual({
    error: {
      code: 'live_membership_unavailable',
      message: 'Participant live membership could not be initialized',
    },
  })
})

test('returns protected host metadata when host bearer token is valid', async () => {
  const { dependencies, state } = createDependencies()
  const app = createHttpApp(dependencies)

  const response = await app.request(`/api/quiz-sessions/${state.quizSession.id}/host`, {
    headers: { authorization: 'Bearer host-token' },
  })

  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({
    quizSession: {
      id: state.quizSession.id,
      quizCode: 'QUIZ2026',
      joinPath: '/join/QUIZ2026',
    },
    participantCount: 1,
    participants: [{ id: 'participant-1', displayName: 'Ada' }],
    questionSet: {
      id: 'question-set-1',
      questions: [{ prompt: 'Which datastore stores durable quiz records?' }],
    },
  })
})

test('rejects missing and invalid host bearer tokens', async () => {
  const { dependencies, state } = createDependencies()
  const app = createHttpApp(dependencies)

  const missing = await app.request(`/api/quiz-sessions/${state.quizSession.id}/host`)
  expect(missing.status).toBe(401)
  expect(await missing.json()).toEqual({
    error: {
      code: 'missing_bearer_token',
      message: 'Authorization bearer token is required',
    },
  })

  const invalid = await app.request(`/api/quiz-sessions/${state.quizSession.id}/host`, {
    headers: { authorization: 'Bearer wrong-token' },
  })
  expect(invalid.status).toBe(401)
  expect(await invalid.json()).toEqual({
    error: {
      code: 'invalid_host_token',
      message: 'Invalid host control token',
    },
  })

  const malformed = await app.request(`/api/quiz-sessions/${state.quizSession.id}/host`, {
    headers: { authorization: 'Bearer host-token extra' },
  })
  expect(malformed.status).toBe(401)
  expect(await malformed.json()).toEqual({
    error: {
      code: 'missing_bearer_token',
      message: 'Authorization bearer token is required',
    },
  })
})

test('returns protected participant metadata without question or answer text', async () => {
  const { dependencies } = createDependencies()
  const app = createHttpApp(dependencies)

  const response = await app.request('/api/participants/me', {
    headers: { authorization: 'Bearer participant-token' },
  })

  expect(response.status).toBe(200)
  const body = await response.json()
  expect(body).toMatchObject({
    participant: {
      id: 'participant-1',
      displayName: 'Ada',
    },
    quizSession: {
      id: 'quiz-session-1',
      quizCode: 'QUIZ2026',
      status: 'waiting_room',
      currentQuestionPosition: null,
      joinPath: '/join/QUIZ2026',
    },
  })
  expect(JSON.stringify(body)).not.toContain('Which datastore stores durable quiz records?')
  expect(JSON.stringify(body)).not.toContain('PostgreSQL')
})

test('rejects invalid participant bearer tokens', async () => {
  const { dependencies } = createDependencies()
  const app = createHttpApp(dependencies)

  const response = await app.request('/api/participants/me', {
    headers: { authorization: 'Bearer wrong-token' },
  })

  expect(response.status).toBe(401)
  expect(await response.json()).toEqual({
    error: {
      code: 'invalid_participant_token',
      message: 'Invalid participant token',
    },
  })
})
