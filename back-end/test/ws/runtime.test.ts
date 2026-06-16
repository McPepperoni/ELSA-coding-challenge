// AI Generated code <PURPOSE>: verify live quiz runtime orchestration behavior
import { expect, spyOn, test } from 'bun:test'

import type { Participant, QuizSession } from '@/db/schema.js'
import type { FullQuestionSet } from '@/db/repositories/question-sets.js'
import type { LiveLeaderboardEntry, LiveLeaderboardParticipantState } from '@/redis/leaderboard-repository.js'
import type { LiveSessionState } from '@/redis/live-session-repository.js'
import type { ServerEvent } from '@/types/events.js'
import type { PersistenceEvent } from '@/workers/persistence-events.js'
import { createLiveQuizRuntime } from '@/ws/runtime.js'
import type { SocketHub } from '@/ws/broadcasts.js'
import type { ScheduleQuestionTimerInput } from '@/ws/timers.js'

const now = new Date('2026-06-16T10:00:00.000Z')
const later = new Date('2026-06-16T10:00:05.000Z')

const quizSession: QuizSession = {
  id: 'session-1',
  questionSetId: 'set-1',
  quizCode: 'ABC12345',
  status: 'waiting_room',
  currentQuestionPosition: null,
  questionOrderIds: ['question-1', 'question-2'],
  hostTokenHash: 'host-hash',
  startedAt: null,
  finishedAt: null,
  createdAt: now,
  updatedAt: now,
}

const participant: Participant = {
  id: 'participant-1',
  quizSessionId: quizSession.id,
  displayName: 'Ada',
  participantTokenHash: 'participant-hash',
  joinedAt: now,
  lastSeenAt: null,
}

const otherParticipant: Participant = {
  ...participant,
  id: 'participant-2',
  displayName: 'Grace',
  participantTokenHash: 'other-hash',
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
      prompt: 'Who wrote the first compiler?',
      timeLimitSeconds: 10,
      createdAt: now,
      options: [
        {
          id: 'option-1',
          questionId: 'question-1',
          optionText: 'Grace Hopper',
          position: 1,
          isCorrect: true,
          createdAt: now,
        },
        {
          id: 'option-2',
          questionId: 'question-1',
          optionText: 'Ada Lovelace',
          position: 2,
          isCorrect: false,
          createdAt: now,
        },
      ],
    },
    {
      id: 'question-2',
      questionSetId: quizSession.questionSetId,
      prompt: 'What does CPU stand for?',
      timeLimitSeconds: null,
      createdAt: now,
      options: [
        {
          id: 'option-3',
          questionId: 'question-2',
          optionText: 'Central Processing Unit',
          position: 1,
          isCorrect: true,
          createdAt: now,
        },
        {
          id: 'option-4',
          questionId: 'question-2',
          optionText: 'Computer Personal Unit',
          position: 2,
          isCorrect: false,
          createdAt: now,
        },
      ],
    },
  ],
}

type SentSocket = {
  sent: string[]
  send(message: string): void
  close(): void
}

const createSocket = (): SentSocket => ({
  sent: [],
  send(message) {
    this.sent.push(message)
  },
  close() {
    return undefined
  },
})

const createThrowingSocket = (): SentSocket => ({
  sent: [],
  send() {
    throw new Error('socket unavailable')
  },
  close() {
    return undefined
  },
})

const parseSent = (socket: SentSocket, index = 0): ServerEvent =>
  JSON.parse(socket.sent[index] ?? '{}')

const createDeferred = <Value = void>() => {
  let resolve!: (value: Value) => void

  const promise = new Promise<Value>((innerResolve) => {
    resolve = innerResolve
  })

  return { promise, resolve }
}

const activeLiveState = (overrides: Partial<LiveSessionState> = {}): LiveSessionState => ({
  quizSessionId: quizSession.id,
  status: 'question_active',
  questionOrderIds: quizSession.questionOrderIds,
  currentQuestionId: 'question-1',
  currentQuestionPosition: 1,
  startedAt: now,
  endsAt: new Date('2026-06-16T10:00:10.000Z'),
  ...overrides,
})

const createDependencies = (
  options: Readonly<{
    persistenceRejects?: boolean
    deferActiveQuestion?: boolean
    activeQuestionRejects?: boolean
  }> = {},
) => {
  const activeQuestionDeferred = createDeferred()
  let durableSession: QuizSession = { ...quizSession }
  let liveSession: LiveSessionState | null = {
    quizSessionId: quizSession.id,
    status: 'waiting_room',
    questionOrderIds: quizSession.questionOrderIds,
    currentQuestionId: null,
    currentQuestionPosition: null,
    startedAt: null,
    endsAt: null,
  }
  let hasAnswered = false
  let acceptedLock = true
  let answeredCount = 0
  const updates: Array<{ id: string; input: Partial<QuizSession> }> = []
  const activeQuestions: Array<{
    quizSessionId: string
    questionId: string
    questionPosition: number
    startedAt: Date
    endsAt: Date
  }> = []
  const reveals: Array<{
    quizSessionId: string
    questionId: string
    questionPosition: number
    startedAt: Date
  }> = []
  const finishedLiveSessions: string[] = []
  const resetLocks: Array<{ quizSessionId: string; questionId: string }> = []
  const scoredAnswers: Array<{
    quizSessionId: string
    participantId: string
    isCorrect: boolean
    scoreAwarded: number
    submittedAt: Date
  }> = []
  const persistenceEvents: PersistenceEvent[] = []
  const scheduledTimers: ScheduleQuestionTimerInput[] = []
  const cancelledTimers: string[] = []
  const hostEvents: ServerEvent[] = []
  const participantEvents: Array<{ participantId: string; event: ServerEvent }> = []
  const leaderboardEntries: LiveLeaderboardEntry[] = [
    {
      participantId: participant.id,
      displayName: participant.displayName,
      rank: 1,
      score: 100,
      correctAnswerCount: 1,
      lastCorrectSubmissionAt: later,
      joinedAt: participant.joinedAt,
    },
  ]

  const hub: SocketHub = {
    registerHostSocket() {
      return () => undefined
    },
    registerParticipantSocket() {
      return () => undefined
    },
    sendToHostSockets(_quizSessionId, event) {
      hostEvents.push(event)
    },
    sendToParticipantSockets(_quizSessionId, event) {
      participantEvents.push({ participantId: '*', event })
    },
    sendToParticipantSocket(input) {
      participantEvents.push({ participantId: input.participantId, event: input.event })
    },
  }

  const runtime = createLiveQuizRuntime({
    clock: { now: () => later },
    quizSessions: {
      findById: async () => durableSession,
      async updateQuizSessionState(id, input) {
        updates.push({ id, input })
        durableSession = {
          ...durableSession,
          ...input,
          updatedAt: later,
        }
        return durableSession
      },
    },
    questionSets: {
      findFullQuestionSetById: async () => questionSet,
    },
    participants: {
      listBySession: async () => [participant, otherParticipant],
    },
    liveSessions: {
      readLiveSession: async () => liveSession,
      async setActiveQuestion(input) {
        if (options.deferActiveQuestion) {
          await activeQuestionDeferred.promise
        }
        if (options.activeQuestionRejects) {
          throw new Error('live state unavailable')
        }
        activeQuestions.push(input)
        liveSession = activeLiveState({
          currentQuestionId: input.questionId,
          currentQuestionPosition: input.questionPosition,
          startedAt: input.startedAt,
          endsAt: input.endsAt,
        })
      },
      async setQuestionReveal(input) {
        reveals.push(input)
        liveSession = {
          ...activeLiveState({
            currentQuestionId: input.questionId,
            currentQuestionPosition: input.questionPosition,
            startedAt: input.startedAt,
          }),
          status: 'question_reveal',
          endsAt: null,
        }
      },
      async finishLiveSession(id) {
        finishedLiveSessions.push(id)
        liveSession = {
          quizSessionId: id,
          status: 'finished',
          questionOrderIds: quizSession.questionOrderIds,
          currentQuestionId: null,
          currentQuestionPosition: null,
          startedAt: null,
          endsAt: null,
        }
      },
    },
    answerLocks: {
      async acceptFirstAnswer() {
        if (acceptedLock) {
          hasAnswered = true
          answeredCount += 1
        }
        return { accepted: acceptedLock, answeredCount }
      },
      readAnsweredCount: async () => answeredCount,
      hasParticipantAnswered: async () => hasAnswered,
      async resetQuestionAnswers(input) {
        resetLocks.push(input)
        hasAnswered = false
        answeredCount = 0
      },
    },
    leaderboard: {
      async recordAnswerScore(input) {
        scoredAnswers.push(input)
        return {
          participantId: input.participantId,
          displayName: input.displayName,
          score: input.scoreAwarded,
          correctAnswerCount: input.isCorrect ? 1 : 0,
          lastCorrectSubmissionAt: input.isCorrect ? input.submittedAt : null,
          joinedAt: input.joinedAt,
        } satisfies LiveLeaderboardParticipantState
      },
      readLeaderboard: async () => leaderboardEntries,
      readTopLeaderboardEntries: async () => leaderboardEntries,
    },
    timers: {
      scheduleQuestionEnd(input) {
        scheduledTimers.push(input)
      },
      cancelQuestionTimer(id) {
        cancelledTimers.push(id)
      },
      cancelAllQuestionTimers() {
        return undefined
      },
    },
    hub,
    persistenceSink: {
      async enqueue(event) {
        if (options.persistenceRejects) {
          throw new Error('persistence unavailable')
        }
        persistenceEvents.push(event)
      },
    },
  })

  return {
    runtime,
    setDurableSession: (session: QuizSession) => {
      durableSession = session
    },
    setLiveSession: (state: LiveSessionState | null) => {
      liveSession = state
    },
    setHasAnswered: (value: boolean) => {
      hasAnswered = value
    },
    setAcceptedLock: (value: boolean) => {
      acceptedLock = value
    },
    releaseActiveQuestion: () => {
      activeQuestionDeferred.resolve()
    },
    activeQuestions,
    cancelledTimers,
    finishedLiveSessions,
    hostEvents,
    participantEvents,
    persistenceEvents,
    resetLocks,
    reveals,
    scheduledTimers,
    scoredAnswers,
    updates,
  }
}

test('host start begins first question with question-specific timer and secret participant payloads', async () => {
  const deps = createDependencies()
  const socket = createSocket()

  await deps.runtime.handleHostEvent({
    connection: { role: 'host', quizSession },
    event: { type: 'start_quiz' },
    socket,
  })

  expect(deps.activeQuestions).toHaveLength(1)
  expect(deps.activeQuestions[0]).toMatchObject({
    quizSessionId: quizSession.id,
    questionId: 'question-1',
    questionPosition: 1,
    startedAt: later,
    endsAt: new Date('2026-06-16T10:00:15.000Z'),
  })
  expect(deps.updates[0]).toEqual({
    id: quizSession.id,
    input: { status: 'question_active', currentQuestionPosition: 1, startedAt: later },
  })
  expect(deps.resetLocks).toEqual([{ quizSessionId: quizSession.id, questionId: 'question-1' }])
  expect(deps.scheduledTimers[0]).toMatchObject({
    quizSessionId: quizSession.id,
    endsAt: new Date('2026-06-16T10:00:15.000Z'),
  })
  expect(deps.hostEvents[0]).toMatchObject({
    type: 'session_state',
    view: 'host',
    status: 'question_active',
    question: { id: 'question-1', prompt: 'Who wrote the first compiler?', timeLimitSeconds: 10 },
  })
  const participantEvent = deps.participantEvents[0]?.event
  expect(participantEvent).toMatchObject({
    type: 'session_state',
    view: 'participant',
    status: 'question_active',
    question: { id: 'question-1', position: 1 },
    canSubmit: true,
  })
  expect(JSON.stringify(participantEvent)).not.toContain('Who wrote the first compiler?')
  expect(JSON.stringify(participantEvent)).not.toContain('Grace Hopper')
  expect(JSON.stringify(participantEvent)).not.toContain('correctOptionId')
  expect(socket.sent).toEqual([])
})

test('accepted answer sends result, scores, persists, and broadcasts answered count', async () => {
  const deps = createDependencies()
  const socket = createSocket()
  deps.setDurableSession({ ...quizSession, status: 'question_active', currentQuestionPosition: 1 })
  deps.setLiveSession(activeLiveState())

  await deps.runtime.handleParticipantEvent({
    connection: { role: 'participant', participant, quizSession },
    event: { type: 'submit_answer', selectedOptionId: 'option-1' },
    socket,
  })

  expect(parseSent(socket)).toEqual({
    type: 'answer_result',
    status: 'accepted',
    selectedOptionId: 'option-1',
  })
  expect(deps.scoredAnswers).toEqual([
    expect.objectContaining({
      quizSessionId: quizSession.id,
      participantId: participant.id,
      isCorrect: true,
      scoreAwarded: 100,
      submittedAt: later,
    }),
  ])
  expect(deps.persistenceEvents).toEqual([
    expect.objectContaining({
      type: 'accepted_answer',
      quizSessionId: quizSession.id,
      participantId: participant.id,
      questionId: 'question-1',
      selectedOptionId: 'option-1',
      isCorrect: true,
      scoreAwarded: 100,
      submittedAt: later,
    }),
  ])
  expect(deps.hostEvents.at(-1)).toMatchObject({
    type: 'session_state',
    view: 'host',
    status: 'question_active',
    answeredCount: 1,
  })
})

test('duplicate late invalid and wrong-state answer rejections do not score', async () => {
  const cases = [
    {
      name: 'duplicate',
      selectedOptionId: 'option-1',
      prepare(deps: ReturnType<typeof createDependencies>) {
        deps.setLiveSession(activeLiveState())
        deps.setHasAnswered(true)
      },
      reason: 'duplicate_answer',
    },
    {
      name: 'late',
      selectedOptionId: 'option-1',
      prepare(deps: ReturnType<typeof createDependencies>) {
        deps.setLiveSession(activeLiveState({ endsAt: later }))
      },
      reason: 'late_answer',
    },
    {
      name: 'invalid',
      selectedOptionId: 'missing-option',
      prepare(deps: ReturnType<typeof createDependencies>) {
        deps.setLiveSession(activeLiveState())
      },
      reason: 'invalid_option',
    },
    {
      name: 'wrong-state',
      selectedOptionId: 'option-1',
      prepare(deps: ReturnType<typeof createDependencies>) {
        deps.setLiveSession({ ...activeLiveState(), status: 'question_reveal', endsAt: null })
      },
      reason: 'wrong_state',
    },
  ] as const

  for (const rejection of cases) {
    const deps = createDependencies()
    const socket = createSocket()
    rejection.prepare(deps)

    await deps.runtime.handleParticipantEvent({
      connection: { role: 'participant', participant, quizSession },
      event: { type: 'submit_answer', selectedOptionId: rejection.selectedOptionId },
      socket,
    })

    expect(parseSent(socket), rejection.name).toMatchObject({
      type: 'answer_result',
      status: 'rejected',
      selectedOptionId: rejection.selectedOptionId,
      reason: rejection.reason,
    })
    expect(deps.scoredAnswers, rejection.name).toEqual([])
    expect(deps.persistenceEvents, rejection.name).toEqual([])
  }
})

test('timer expiry reveals the active question and broadcasts state', async () => {
  const deps = createDependencies()
  deps.setDurableSession({ ...quizSession, status: 'question_active', currentQuestionPosition: 1 })
  deps.setLiveSession(activeLiveState())

  await deps.runtime.expireQuestion(quizSession.id)

  expect(deps.reveals).toEqual([
    { quizSessionId: quizSession.id, questionId: 'question-1', questionPosition: 1, startedAt: now },
  ])
  expect(deps.updates[0]).toEqual({
    id: quizSession.id,
    input: { status: 'question_reveal', currentQuestionPosition: 1 },
  })
  expect(deps.hostEvents.at(-1)).toMatchObject({
    type: 'session_state',
    view: 'host',
    status: 'question_reveal',
    correctOptionId: 'option-1',
  })
})

test('next question advances from reveal and finishing persists final leaderboard', async () => {
  const deps = createDependencies()
  const socket = createSocket()
  deps.setDurableSession({ ...quizSession, status: 'question_reveal', currentQuestionPosition: 1 })
  deps.setLiveSession({
    ...activeLiveState(),
    status: 'question_reveal',
    endsAt: null,
  })

  await deps.runtime.handleHostEvent({
    connection: { role: 'host', quizSession },
    event: { type: 'next_question' },
    socket,
  })

  expect(deps.activeQuestions.at(-1)).toMatchObject({
    quizSessionId: quizSession.id,
    questionId: 'question-2',
    questionPosition: 2,
    endsAt: new Date('2026-06-16T10:00:35.000Z'),
  })

  deps.setDurableSession({ ...quizSession, status: 'question_reveal', currentQuestionPosition: 2 })
  deps.setLiveSession({
    ...activeLiveState({
      currentQuestionId: 'question-2',
      currentQuestionPosition: 2,
      startedAt: later,
    }),
    status: 'question_reveal',
    endsAt: null,
  })

  await deps.runtime.handleHostEvent({
    connection: { role: 'host', quizSession },
    event: { type: 'next_question' },
    socket,
  })

  expect(deps.finishedLiveSessions).toEqual([quizSession.id])
  expect(deps.cancelledTimers).toContain(quizSession.id)
  expect(deps.persistenceEvents.at(-1)).toEqual({
    type: 'final_leaderboard',
    quizSessionId: quizSession.id,
    entries: [
      {
        participantId: participant.id,
        rank: 1,
        score: 100,
        correctAnswerCount: 1,
        lastCorrectSubmissionAt: later,
        joinedAt: participant.joinedAt,
      },
    ],
    recordedAt: later,
  })
  expect(deps.hostEvents.at(-1)).toMatchObject({
    type: 'session_state',
    view: 'host',
    status: 'finished',
  })
})

test('finish command cancels timer and enqueues final leaderboard', async () => {
  const deps = createDependencies()
  const socket = createSocket()
  deps.setDurableSession({ ...quizSession, status: 'question_active', currentQuestionPosition: 1 })
  deps.setLiveSession(activeLiveState())

  await deps.runtime.handleHostEvent({
    connection: { role: 'host', quizSession },
    event: { type: 'finish_quiz' },
    socket,
  })

  expect(deps.finishedLiveSessions).toEqual([quizSession.id])
  expect(deps.cancelledTimers).toEqual([quizSession.id])
  expect(deps.updates.at(-1)).toEqual({
    id: quizSession.id,
    input: { status: 'finished', currentQuestionPosition: null, finishedAt: later },
  })
  expect(deps.persistenceEvents.at(-1)).toMatchObject({
    type: 'final_leaderboard',
    quizSessionId: quizSession.id,
    recordedAt: later,
  })
})

test('stale scheduled timer no-ops when a different question is active', async () => {
  const deps = createDependencies()
  const socket = createSocket()

  await deps.runtime.handleHostEvent({
    connection: { role: 'host', quizSession },
    event: { type: 'start_quiz' },
    socket,
  })

  deps.setDurableSession({ ...quizSession, status: 'question_active', currentQuestionPosition: 2 })
  deps.setLiveSession(activeLiveState({
    currentQuestionId: 'question-2',
    currentQuestionPosition: 2,
    startedAt: later,
    endsAt: new Date('2026-06-16T10:00:35.000Z'),
  }))

  await deps.scheduledTimers[0]?.onExpire(quizSession.id)

  expect(deps.reveals).toEqual([])
  expect(deps.hostEvents.at(-1)).toMatchObject({
    type: 'session_state',
    view: 'host',
    status: 'question_active',
    question: { id: 'question-1' },
  })
})

test('accepted answer still broadcasts when persistence enqueue rejects', async () => {
  const deps = createDependencies({ persistenceRejects: true })
  const socket = createSocket()
  const consoleError = spyOn(console, 'error').mockImplementation(() => undefined)
  deps.setDurableSession({ ...quizSession, status: 'question_active', currentQuestionPosition: 1 })
  deps.setLiveSession(activeLiveState())

  try {
    await deps.runtime.handleParticipantEvent({
      connection: { role: 'participant', participant, quizSession },
      event: { type: 'submit_answer', selectedOptionId: 'option-1' },
      socket,
    })
  } finally {
    consoleError.mockRestore()
  }

  expect(parseSent(socket)).toMatchObject({ type: 'answer_result', status: 'accepted' })
  expect(deps.scoredAnswers).toHaveLength(1)
  expect(deps.hostEvents.at(-1)).toMatchObject({
    type: 'session_state',
    view: 'host',
    status: 'question_active',
    answeredCount: 1,
  })
})

test('accepted answer still broadcasts when direct answer result send throws', async () => {
  const deps = createDependencies()
  const socket = createThrowingSocket()
  const consoleError = spyOn(console, 'error').mockImplementation(() => undefined)
  deps.setDurableSession({ ...quizSession, status: 'question_active', currentQuestionPosition: 1 })
  deps.setLiveSession(activeLiveState())

  try {
    await deps.runtime.handleParticipantEvent({
      connection: { role: 'participant', participant, quizSession },
      event: { type: 'submit_answer', selectedOptionId: 'option-1' },
      socket,
    })
  } finally {
    consoleError.mockRestore()
  }

  expect(deps.scoredAnswers).toHaveLength(1)
  expect(deps.persistenceEvents).toHaveLength(1)
  expect(deps.hostEvents.at(-1)).toMatchObject({
    type: 'session_state',
    view: 'host',
    status: 'question_active',
    answeredCount: 1,
  })
})

test('finish still broadcasts final state when final persistence enqueue rejects', async () => {
  const deps = createDependencies({ persistenceRejects: true })
  const socket = createSocket()
  const consoleError = spyOn(console, 'error').mockImplementation(() => undefined)
  deps.setDurableSession({ ...quizSession, status: 'question_active', currentQuestionPosition: 1 })
  deps.setLiveSession(activeLiveState())

  try {
    await deps.runtime.handleHostEvent({
      connection: { role: 'host', quizSession },
      event: { type: 'finish_quiz' },
      socket,
    })
  } finally {
    consoleError.mockRestore()
  }

  expect(deps.finishedLiveSessions).toEqual([quizSession.id])
  expect(deps.hostEvents.at(-1)).toMatchObject({
    type: 'session_state',
    view: 'host',
    status: 'finished',
  })
})

test('next question uses live question order when it differs from durable order', async () => {
  const deps = createDependencies()
  const socket = createSocket()
  deps.setDurableSession({ ...quizSession, status: 'question_reveal', currentQuestionPosition: 1 })
  deps.setLiveSession({
    ...activeLiveState({
      questionOrderIds: ['question-2', 'question-1'],
      currentQuestionId: 'question-2',
      currentQuestionPosition: 1,
    }),
    status: 'question_reveal',
    endsAt: null,
  })

  await deps.runtime.handleHostEvent({
    connection: { role: 'host', quizSession },
    event: { type: 'next_question' },
    socket,
  })

  expect(deps.activeQuestions.at(-1)).toMatchObject({
    quizSessionId: quizSession.id,
    questionId: 'question-1',
    questionPosition: 2,
  })
})

test('concurrent start commands serialize to a single active question mutation', async () => {
  const deps = createDependencies({ deferActiveQuestion: true })
  const firstSocket = createSocket()
  const secondSocket = createSocket()

  const firstStart = deps.runtime.handleHostEvent({
    connection: { role: 'host', quizSession },
    event: { type: 'start_quiz' },
    socket: firstSocket,
  })
  const secondStart = deps.runtime.handleHostEvent({
    connection: { role: 'host', quizSession },
    event: { type: 'start_quiz' },
    socket: secondSocket,
  })

  await Promise.resolve()
  deps.releaseActiveQuestion()
  await Promise.all([firstStart, secondStart])

  expect(deps.activeQuestions).toHaveLength(1)
  expect(parseSent(secondSocket)).toMatchObject({
    type: 'runtime_error',
    code: 'invalid_runtime_state',
  })
})

test('start rolls durable state back when activating live question fails', async () => {
  const deps = createDependencies({ activeQuestionRejects: true })
  const socket = createSocket()
  let thrown: unknown

  try {
    await deps.runtime.handleHostEvent({
      connection: { role: 'host', quizSession },
      event: { type: 'start_quiz' },
      socket,
    })
  } catch (error) {
    thrown = error
  }

  expect(thrown).toBeInstanceOf(Error)
  expect((thrown as Error).message).toBe('live state unavailable')
  expect(deps.updates).toEqual([
    {
      id: quizSession.id,
      input: { status: 'question_active', currentQuestionPosition: 1, startedAt: later },
    },
    {
      id: quizSession.id,
      input: {
        status: 'waiting_room',
        currentQuestionPosition: null,
        startedAt: null,
        finishedAt: null,
      },
    },
  ])
  expect(deps.activeQuestions).toEqual([])
  expect(deps.scheduledTimers).toEqual([])
  expect(deps.hostEvents).toEqual([])
})
