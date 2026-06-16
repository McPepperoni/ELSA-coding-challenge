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
    deferScore?: boolean
    scoreRejects?: boolean
    leaderboardRejects?: boolean
    clockNow?: Date
    participants?: Participant[]
    useRecordedLeaderboard?: boolean
  }> = {},
) => {
  const activeQuestionDeferred = createDeferred()
  const scoreDeferred = createDeferred()
  let currentTime = options.clockNow ?? later
  let sessionParticipants = [...(options.participants ?? [participant, otherParticipant])]
  let shouldRejectScore = options.scoreRejects ?? false
  let shouldRejectLeaderboard = options.leaderboardRejects ?? false
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
  let hasAnsweredOverride: boolean | null = null
  let acceptedLock = true
  const answeredParticipantIdsByQuestion = new Map<string, Set<string>>()
  const leaderboardStatesByParticipant = new Map<string, LiveLeaderboardParticipantState>()
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
  const scoreAttempts: Array<{
    quizSessionId: string
    participantId: string
    isCorrect: boolean
    scoreAwarded: number
    submittedAt: Date
  }> = []
  const operations: string[] = []
  const persistenceEvents: PersistenceEvent[] = []
  const releasedAnswers: Array<{ quizSessionId: string; questionId: string; participantId: string }> = []
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

  const answeredParticipantsForQuestion = (questionId: string): Set<string> => {
    const existing = answeredParticipantIdsByQuestion.get(questionId)
    if (existing) {
      return existing
    }

    const next = new Set<string>()
    answeredParticipantIdsByQuestion.set(questionId, next)
    return next
  }

  const readRecordedLeaderboard = (limit?: number): LiveLeaderboardEntry[] => {
    const entries = Array.from(leaderboardStatesByParticipant.values())
      .sort((left, right) => {
        const scoreOrder = right.score - left.score
        if (scoreOrder !== 0) {
          return scoreOrder
        }

        const leftCorrectAt = left.lastCorrectSubmissionAt?.getTime() ?? Number.MAX_SAFE_INTEGER
        const rightCorrectAt = right.lastCorrectSubmissionAt?.getTime() ?? Number.MAX_SAFE_INTEGER
        if (leftCorrectAt !== rightCorrectAt) {
          return leftCorrectAt - rightCorrectAt
        }

        const joinedOrder = left.joinedAt.getTime() - right.joinedAt.getTime()
        if (joinedOrder !== 0) {
          return joinedOrder
        }

        return left.participantId.localeCompare(right.participantId)
      })
      .slice(0, limit)

    return entries.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }))
  }

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
    clock: { now: () => currentTime },
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
      listBySession: async () => sessionParticipants,
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
      async acceptFirstAnswer(input) {
        const answeredParticipants = answeredParticipantsForQuestion(input.questionId)
        if (acceptedLock && !answeredParticipants.has(input.participantId)) {
          answeredParticipants.add(input.participantId)
        }
        return { accepted: acceptedLock, answeredCount: answeredParticipants.size }
      },
      readAnsweredCount: async (input) => answeredParticipantsForQuestion(input.questionId).size,
      hasParticipantAnswered: async (input) =>
        hasAnsweredOverride ?? answeredParticipantsForQuestion(input.questionId).has(input.participantId),
      async releaseAnswer(input) {
        releasedAnswers.push(input)
        answeredParticipantsForQuestion(input.questionId).delete(input.participantId)
      },
      async resetQuestionAnswers(input) {
        resetLocks.push(input)
        hasAnsweredOverride = null
        answeredParticipantIdsByQuestion.delete(input.questionId)
      },
    },
    leaderboard: {
      async recordAnswerScore(input) {
        scoreAttempts.push(input)
        if (options.deferScore) {
          await scoreDeferred.promise
        }
        if (shouldRejectScore) {
          throw new Error('score unavailable')
        }
        operations.push('score')
        scoredAnswers.push(input)
        if (options.useRecordedLeaderboard) {
          const previous = leaderboardStatesByParticipant.get(input.participantId)
          const next = {
            participantId: input.participantId,
            displayName: input.displayName,
            score: (previous?.score ?? 0) + input.scoreAwarded,
            correctAnswerCount: (previous?.correctAnswerCount ?? 0) + (input.isCorrect ? 1 : 0),
            lastCorrectSubmissionAt: input.isCorrect
              ? input.submittedAt
              : previous?.lastCorrectSubmissionAt ?? null,
            joinedAt: input.joinedAt,
          } satisfies LiveLeaderboardParticipantState
          leaderboardStatesByParticipant.set(input.participantId, next)
          return next
        }
        return {
          participantId: input.participantId,
          displayName: input.displayName,
          score: input.scoreAwarded,
          correctAnswerCount: input.isCorrect ? 1 : 0,
          lastCorrectSubmissionAt: input.isCorrect ? input.submittedAt : null,
          joinedAt: input.joinedAt,
        } satisfies LiveLeaderboardParticipantState
      },
      async readLeaderboard() {
        operations.push('readLeaderboard')
        if (shouldRejectLeaderboard) {
          throw new Error('leaderboard unavailable')
        }
        if (options.useRecordedLeaderboard) {
          return readRecordedLeaderboard()
        }
        return leaderboardEntries
      },
      readTopLeaderboardEntries: async (_quizSessionId, count) =>
        options.useRecordedLeaderboard
          ? readRecordedLeaderboard(count ?? 3)
          : leaderboardEntries.slice(0, count),
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
    setClock: (value: Date) => {
      currentTime = value
    },
    setDurableSession: (session: QuizSession) => {
      durableSession = session
    },
    setLiveSession: (state: LiveSessionState | null) => {
      liveSession = state
    },
    setParticipants: (participants: Participant[]) => {
      sessionParticipants = participants
    },
    setHasAnswered: (value: boolean) => {
      hasAnsweredOverride = value
    },
    setAcceptedLock: (value: boolean) => {
      acceptedLock = value
    },
    setScoreRejects: (value: boolean) => {
      shouldRejectScore = value
    },
    setLeaderboardRejects: (value: boolean) => {
      shouldRejectLeaderboard = value
    },
    releaseActiveQuestion: () => {
      activeQuestionDeferred.resolve()
    },
    releaseScore: () => {
      scoreDeferred.resolve()
    },
    activeQuestions,
    cancelledTimers,
    finishedLiveSessions,
    hostEvents,
    operations,
    participantEvents,
    persistenceEvents,
    releasedAnswers,
    resetLocks,
    reveals,
    scheduledTimers,
    scoreAttempts,
    scoredAnswers,
    updates,
  }
}

const waitForCondition = async (
  condition: () => boolean,
  message: string,
): Promise<void> => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (condition()) {
      return
    }

    await Promise.resolve()
  }

  throw new Error(message)
}

test('full runtime flow broadcasts waiting room, two questions, reveal leaderboard, final state, and secret participant payloads', async () => {
  const firstQuestionStartedAt = new Date('2026-06-16T10:01:00.000Z')
  const firstQuestionEndsAt = new Date('2026-06-16T10:01:10.000Z')
  const secondQuestionStartedAt = new Date('2026-06-16T10:01:11.000Z')
  const secondQuestionEndsAt = new Date('2026-06-16T10:01:41.000Z')
  const deps = createDependencies({
    clockNow: firstQuestionStartedAt,
    participants: [participant],
    useRecordedLeaderboard: true,
  })
  const hostSocket = createSocket()
  const adaSocket = createSocket()
  const graceSocket = createSocket()

  const latestParticipantState = (participantId: string): ServerEvent | undefined =>
    deps.participantEvents
      .filter(({ participantId: eventParticipantId, event }) =>
        eventParticipantId === participantId &&
        event.type === 'session_state' &&
        event.view === 'participant')
      .at(-1)?.event

  const expectSecretParticipantPayload = (
    event: ServerEvent | undefined,
    hiddenTexts: readonly string[],
  ): void => {
    expect(event).toMatchObject({
      type: 'session_state',
      view: 'participant',
      status: 'question_active',
      question: {
        options: [
          { id: expect.any(String), position: 1 },
          { id: expect.any(String), position: 2 },
        ],
      },
    })
    const serializedEvent = JSON.stringify(event)
    for (const hiddenText of hiddenTexts) {
      expect(serializedEvent).not.toContain(hiddenText)
    }
    expect(serializedEvent).not.toContain('correctOptionId')
  }

  await deps.runtime.handleHostConnected?.({
    connection: { role: 'host', quizSession },
    socket: hostSocket,
  })

  expect(deps.hostEvents.at(-1)).toMatchObject({
    type: 'session_state',
    view: 'host',
    status: 'waiting_room',
    participantCount: 1,
    participants: [{ id: participant.id, displayName: participant.displayName }],
  })

  deps.setParticipants([participant, otherParticipant])
  await deps.runtime.handleParticipantConnected?.({
    connection: { role: 'participant', participant: otherParticipant, quizSession },
    socket: graceSocket,
  })

  expect(deps.hostEvents.at(-1)).toMatchObject({
    type: 'session_state',
    view: 'host',
    status: 'waiting_room',
    participantCount: 2,
    participants: [
      { id: participant.id, displayName: participant.displayName },
      { id: otherParticipant.id, displayName: otherParticipant.displayName },
    ],
  })

  await deps.runtime.handleHostEvent({
    connection: { role: 'host', quizSession },
    event: { type: 'start_quiz' },
    socket: hostSocket,
  })

  expect(deps.activeQuestions[0]).toMatchObject({
    quizSessionId: quizSession.id,
    questionId: 'question-1',
    questionPosition: 1,
    startedAt: firstQuestionStartedAt,
    endsAt: firstQuestionEndsAt,
  })
  expect(deps.scheduledTimers[0]).toMatchObject({
    quizSessionId: quizSession.id,
    endsAt: firstQuestionEndsAt,
  })
  expect(deps.hostEvents.at(-1)).toMatchObject({
    type: 'session_state',
    view: 'host',
    status: 'question_active',
    question: { id: 'question-1', prompt: 'Who wrote the first compiler?', timeLimitSeconds: 10 },
    answeredCount: 0,
  })
  expectSecretParticipantPayload(latestParticipantState(participant.id), [
    'Who wrote the first compiler?',
    'Grace Hopper',
    'Ada Lovelace',
  ])
  expectSecretParticipantPayload(latestParticipantState(otherParticipant.id), [
    'Who wrote the first compiler?',
    'Grace Hopper',
    'Ada Lovelace',
  ])

  deps.setClock(new Date('2026-06-16T10:01:02.000Z'))
  await deps.runtime.handleParticipantEvent({
    connection: { role: 'participant', participant, quizSession },
    event: { type: 'submit_answer', selectedOptionId: 'option-1' },
    socket: adaSocket,
  })

  expect(parseSent(adaSocket)).toEqual({
    type: 'answer_result',
    status: 'accepted',
    selectedOptionId: 'option-1',
  })
  expect(deps.hostEvents.at(-1)).toMatchObject({
    type: 'session_state',
    view: 'host',
    status: 'question_active',
    answeredCount: 1,
  })
  expect(latestParticipantState(participant.id)).toMatchObject({
    type: 'session_state',
    view: 'participant',
    status: 'question_active',
    hasAnswered: true,
    canSubmit: false,
  })
  expect(latestParticipantState(otherParticipant.id)).toMatchObject({
    type: 'session_state',
    view: 'participant',
    status: 'question_active',
    hasAnswered: false,
    canSubmit: true,
  })

  await deps.runtime.handleParticipantEvent({
    connection: { role: 'participant', participant, quizSession },
    event: { type: 'submit_answer', selectedOptionId: 'option-2' },
    socket: adaSocket,
  })

  expect(parseSent(adaSocket, 1)).toMatchObject({
    type: 'answer_result',
    status: 'rejected',
    selectedOptionId: 'option-2',
    reason: 'duplicate_answer',
  })

  deps.setClock(new Date('2026-06-16T10:01:04.000Z'))
  await deps.runtime.handleParticipantEvent({
    connection: { role: 'participant', participant: otherParticipant, quizSession },
    event: { type: 'submit_answer', selectedOptionId: 'option-2' },
    socket: graceSocket,
  })

  expect(parseSent(graceSocket)).toEqual({
    type: 'answer_result',
    status: 'accepted',
    selectedOptionId: 'option-2',
  })
  expect(deps.hostEvents.at(-1)).toMatchObject({
    type: 'session_state',
    view: 'host',
    status: 'question_active',
    answeredCount: 2,
  })

  deps.setClock(firstQuestionEndsAt)
  await deps.scheduledTimers[0]?.onExpire(quizSession.id)

  expect(deps.reveals[0]).toEqual({
    quizSessionId: quizSession.id,
    questionId: 'question-1',
    questionPosition: 1,
    startedAt: firstQuestionStartedAt,
  })
  expect(deps.hostEvents.at(-1)).toMatchObject({
    type: 'session_state',
    view: 'host',
    status: 'question_reveal',
    correctOptionId: 'option-1',
    answeredCount: 2,
    leaderboard: [
      { participantId: participant.id, rank: 1, score: 100, correctAnswerCount: 1 },
      { participantId: otherParticipant.id, rank: 2, score: 0, correctAnswerCount: 0 },
    ],
  })
  expect(latestParticipantState(participant.id)).toMatchObject({
    type: 'session_state',
    view: 'participant',
    status: 'question_reveal',
  })
  expect(JSON.stringify(latestParticipantState(participant.id))).not.toContain('Who wrote the first compiler?')

  await deps.runtime.handleParticipantEvent({
    connection: { role: 'participant', participant: otherParticipant, quizSession },
    event: { type: 'submit_answer', selectedOptionId: 'option-1' },
    socket: graceSocket,
  })

  expect(parseSent(graceSocket, 1)).toMatchObject({
    type: 'answer_result',
    status: 'rejected',
    selectedOptionId: 'option-1',
    reason: 'wrong_state',
  })

  deps.setClock(secondQuestionStartedAt)
  await deps.runtime.handleHostEvent({
    connection: { role: 'host', quizSession },
    event: { type: 'next_question' },
    socket: hostSocket,
  })

  expect(deps.activeQuestions[1]).toMatchObject({
    quizSessionId: quizSession.id,
    questionId: 'question-2',
    questionPosition: 2,
    startedAt: secondQuestionStartedAt,
    endsAt: secondQuestionEndsAt,
  })
  expect(deps.scheduledTimers[1]).toMatchObject({
    quizSessionId: quizSession.id,
    endsAt: secondQuestionEndsAt,
  })
  expect(deps.hostEvents.at(-1)).toMatchObject({
    type: 'session_state',
    view: 'host',
    status: 'question_active',
    question: { id: 'question-2', timeLimitSeconds: 30 },
    answeredCount: 0,
  })
  expectSecretParticipantPayload(latestParticipantState(participant.id), [
    'What does CPU stand for?',
    'Central Processing Unit',
    'Computer Personal Unit',
  ])

  deps.setClock(new Date('2026-06-16T10:01:15.000Z'))
  await deps.runtime.handleParticipantEvent({
    connection: { role: 'participant', participant: otherParticipant, quizSession },
    event: { type: 'submit_answer', selectedOptionId: 'option-3' },
    socket: graceSocket,
  })

  expect(parseSent(graceSocket, 2)).toEqual({
    type: 'answer_result',
    status: 'accepted',
    selectedOptionId: 'option-3',
  })
  expect(deps.hostEvents.at(-1)).toMatchObject({
    type: 'session_state',
    view: 'host',
    status: 'question_active',
    answeredCount: 1,
  })

  deps.setClock(secondQuestionEndsAt)
  await deps.scheduledTimers[1]?.onExpire(quizSession.id)

  expect(deps.hostEvents.at(-1)).toMatchObject({
    type: 'session_state',
    view: 'host',
    status: 'question_reveal',
    correctOptionId: 'option-3',
    answeredCount: 1,
    leaderboard: [
      { participantId: participant.id, rank: 1, score: 100, correctAnswerCount: 1 },
      { participantId: otherParticipant.id, rank: 2, score: 100, correctAnswerCount: 1 },
    ],
  })

  await deps.runtime.handleHostEvent({
    connection: { role: 'host', quizSession },
    event: { type: 'next_question' },
    socket: hostSocket,
  })

  expect(deps.finishedLiveSessions).toEqual([quizSession.id])
  expect(deps.cancelledTimers).toContain(quizSession.id)
  expect(deps.persistenceEvents.at(-1)).toMatchObject({
    type: 'final_leaderboard',
    quizSessionId: quizSession.id,
    entries: [
      { participantId: participant.id, rank: 1, score: 100, correctAnswerCount: 1 },
      { participantId: otherParticipant.id, rank: 2, score: 100, correctAnswerCount: 1 },
    ],
    recordedAt: secondQuestionEndsAt,
  })
  expect(deps.hostEvents.at(-1)).toMatchObject({
    type: 'session_state',
    view: 'host',
    status: 'finished',
    leaderboard: [
      { participantId: participant.id, rank: 1, score: 100 },
      { participantId: otherParticipant.id, rank: 2, score: 100 },
    ],
  })
  expect(latestParticipantState(participant.id)).toMatchObject({
    type: 'session_state',
    view: 'participant',
    status: 'finished',
    leaderboard: [
      { participantId: participant.id, rank: 1, score: 100 },
    ],
  })
  expect(JSON.stringify(latestParticipantState(participant.id))).not.toContain(
    otherParticipant.displayName,
  )
})

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

test('answer score failure releases the answer lock so the participant can retry', async () => {
  const deps = createDependencies({ scoreRejects: true })
  const firstSocket = createSocket()
  const secondSocket = createSocket()
  deps.setDurableSession({ ...quizSession, status: 'question_active', currentQuestionPosition: 1 })
  deps.setLiveSession(activeLiveState())
  let thrown: unknown

  try {
    await deps.runtime.handleParticipantEvent({
      connection: { role: 'participant', participant, quizSession },
      event: { type: 'submit_answer', selectedOptionId: 'option-1' },
      socket: firstSocket,
    })
  } catch (error) {
    thrown = error
  }

  expect(thrown).toBeInstanceOf(Error)
  expect((thrown as Error).message).toBe('score unavailable')
  expect(firstSocket.sent).toEqual([])
  expect(deps.releasedAnswers).toEqual([
    { quizSessionId: quizSession.id, questionId: 'question-1', participantId: participant.id },
  ])
  expect(deps.scoredAnswers).toEqual([])
  expect(deps.persistenceEvents).toEqual([])

  deps.setScoreRejects(false)
  await deps.runtime.handleParticipantEvent({
    connection: { role: 'participant', participant, quizSession },
    event: { type: 'submit_answer', selectedOptionId: 'option-1' },
    socket: secondSocket,
  })

  expect(parseSent(secondSocket)).toEqual({
    type: 'answer_result',
    status: 'accepted',
    selectedOptionId: 'option-1',
  })
  expect(deps.scoredAnswers).toHaveLength(1)
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

test('finish remains retryable when final leaderboard read fails', async () => {
  const deps = createDependencies({ leaderboardRejects: true })
  const firstSocket = createSocket()
  const secondSocket = createSocket()
  deps.setDurableSession({ ...quizSession, status: 'question_active', currentQuestionPosition: 1 })
  deps.setLiveSession(activeLiveState())
  let thrown: unknown

  try {
    await deps.runtime.handleHostEvent({
      connection: { role: 'host', quizSession },
      event: { type: 'finish_quiz' },
      socket: firstSocket,
    })
  } catch (error) {
    thrown = error
  }

  expect(thrown).toBeInstanceOf(Error)
  expect((thrown as Error).message).toBe('leaderboard unavailable')
  expect(deps.updates).toEqual([])
  expect(deps.finishedLiveSessions).toEqual([])
  expect(deps.cancelledTimers).toEqual([])
  expect(deps.persistenceEvents).toEqual([])
  expect(deps.hostEvents).toEqual([])

  deps.setLeaderboardRejects(false)
  await deps.runtime.handleHostEvent({
    connection: { role: 'host', quizSession },
    event: { type: 'finish_quiz' },
    socket: secondSocket,
  })

  expect(deps.finishedLiveSessions).toEqual([quizSession.id])
  expect(deps.hostEvents.at(-1)).toMatchObject({
    type: 'session_state',
    view: 'host',
    status: 'finished',
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
  const updateCount = deps.updates.length
  const hostEventCount = deps.hostEvents.length
  const participantEventCount = deps.participantEvents.length

  await deps.scheduledTimers[0]?.onExpire(quizSession.id)

  expect(deps.reveals).toEqual([])
  expect(deps.updates).toHaveLength(updateCount)
  expect(deps.hostEvents).toHaveLength(hostEventCount)
  expect(deps.participantEvents).toHaveLength(participantEventCount)
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

test('finish waits for an in-flight accepted answer before final leaderboard read', async () => {
  const deps = createDependencies({ deferScore: true })
  const answerSocket = createSocket()
  const finishSocket = createSocket()
  deps.setDurableSession({ ...quizSession, status: 'question_active', currentQuestionPosition: 1 })
  deps.setLiveSession(activeLiveState())

  const answer = deps.runtime.handleParticipantEvent({
    connection: { role: 'participant', participant, quizSession },
    event: { type: 'submit_answer', selectedOptionId: 'option-1' },
    socket: answerSocket,
  })

  await waitForCondition(
    () => deps.scoreAttempts.length === 1,
    'Accepted answer did not reach scoring before finish race setup.',
  )

  const finish = deps.runtime.handleHostEvent({
    connection: { role: 'host', quizSession },
    event: { type: 'finish_quiz' },
    socket: finishSocket,
  })

  await Promise.resolve()
  expect(deps.finishedLiveSessions).toEqual([])
  expect(deps.updates.some(({ input }) => input.status === 'finished')).toBe(false)

  deps.releaseScore()
  await Promise.all([answer, finish])

  expect(deps.scoredAnswers).toHaveLength(1)
  expect(deps.finishedLiveSessions).toEqual([quizSession.id])
  expect(deps.operations.indexOf('score')).toBeLessThan(
    deps.operations.indexOf('readLeaderboard'),
  )
  expect(deps.persistenceEvents.some((event) => event.type === 'accepted_answer')).toBe(true)
  expect(deps.persistenceEvents.at(-1)).toMatchObject({
    type: 'final_leaderboard',
    quizSessionId: quizSession.id,
  })
})
