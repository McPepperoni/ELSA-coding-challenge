// AI Generated code <PURPOSE>: orchestrate live quiz runtime commands and broadcasts
import { transitionQuizState, type QuizStatus } from '@/domain/state.js'
import { calculateAcceptedAnswerScore } from '@/domain/scoring.js'
import { createQuestionTimerWindow, resolveQuestionTimerSeconds } from '@/domain/timers.js'
import {
  validateAnswerSubmission,
  type ValidationErrorReason,
} from '@/domain/validation.js'
import type { Participant, QuizSession } from '@/db/schema.js'
import type { FullQuestion, FullQuestionSet } from '@/db/repositories/question-sets.js'
import type {
  LiveLeaderboardEntry,
  LiveLeaderboardParticipantState,
} from '@/redis/leaderboard-repository.js'
import type { LiveSessionState } from '@/redis/live-session-repository.js'
import type {
  AnswerRejectionReason,
  RuntimeErrorCode,
  RuntimeErrorEvent,
  ServerEvent,
} from '@/types/events.js'
import type { PersistenceEventSink } from '@/workers/persistence-events.js'
import type { PersistenceEvent } from '@/workers/persistence-events.js'
import { noopPersistenceEventSink } from '@/workers/persistence-events.js'

import type { SocketHub } from './broadcasts.js'
import defaultSocketHub from './broadcasts.js'
import type { RuntimeHandlers, ConnectionSocket } from './connection.js'
import {
  createHostStatePresenter,
  createParticipantStatePresenter,
  type StatePresenterDependencies,
} from './state-presenters.js'
import { quizTimerScheduler, type ScheduleQuestionTimerInput } from './timers.js'
import { serializeServerEvent } from './protocol.js'

type RuntimeClock = Readonly<{
  now(): Date
}>

type QuizSessionsRuntimeRepository = Readonly<{
  findById(id: string): Promise<QuizSession | null>
  updateQuizSessionState(
    id: string,
    input: Readonly<{
      status?: QuizStatus
      currentQuestionPosition?: number | null
      startedAt?: Date | null
      finishedAt?: Date | null
    }>,
  ): Promise<QuizSession | null>
}>

type LiveSessionsRuntimeRepository = StatePresenterDependencies['liveSessions'] &
  Readonly<{
    setActiveQuestion(input: {
      quizSessionId: string
      questionId: string
      questionPosition: number
      startedAt: Date
      endsAt: Date
    }): Promise<void>
    setQuestionReveal(input: {
      quizSessionId: string
      questionId: string
      questionPosition: number
      startedAt: Date
    }): Promise<void>
    finishLiveSession(quizSessionId: string): Promise<void>
  }>

type AnswerLocksRuntimeRepository = StatePresenterDependencies['answerLocks'] &
  Readonly<{
    acceptFirstAnswer(input: {
      quizSessionId: string
      questionId: string
      participantId: string
    }): Promise<{ accepted: boolean; answeredCount: number }>
    releaseAnswer(input: {
      quizSessionId: string
      questionId: string
      participantId: string
    }): Promise<void>
    resetQuestionAnswers(input: {
      quizSessionId: string
      questionId: string
    }): Promise<void>
  }>

type LeaderboardRuntimeRepository = NonNullable<StatePresenterDependencies['leaderboard']> &
  Readonly<{
    recordAnswerScore(input: {
      quizSessionId: string
      participantId: string
      displayName?: string
      joinedAt: Date
      isCorrect: boolean
      scoreAwarded: number
      submittedAt: Date
    }): Promise<LiveLeaderboardParticipantState>
    readLeaderboard(quizSessionId: string, limit?: number): Promise<LiveLeaderboardEntry[]>
  }>

type TimerRuntimeScheduler = Readonly<{
  scheduleQuestionEnd(input: ScheduleQuestionTimerInput): void
  cancelQuestionTimer(quizSessionId: string): void
  cancelAllQuestionTimers(): void
}>

export type LiveQuizRuntimeDependencies = Readonly<{
  clock?: RuntimeClock
  quizSessions: QuizSessionsRuntimeRepository
  questionSets: StatePresenterDependencies['questionSets']
  participants: StatePresenterDependencies['participants']
  liveSessions: LiveSessionsRuntimeRepository
  answerLocks: AnswerLocksRuntimeRepository
  leaderboard: LeaderboardRuntimeRepository
  timers?: TimerRuntimeScheduler
  hub?: SocketHub
  persistenceSink?: PersistenceEventSink
}>

export type LiveQuizRuntime = RuntimeHandlers &
  Readonly<{
    expireQuestion(quizSessionId: string): Promise<void>
  }>

const defaultClock: RuntimeClock = {
  now: () => new Date(),
}

const answerRejectionReasons = new Set<ValidationErrorReason>([
  'duplicate_answer',
  'late_answer',
  'invalid_option',
  'unknown_participant',
  'wrong_state',
  'inactive_question',
])

const sessionMutationLocks = new Map<string, Promise<void>>()

export const createLiveQuizRuntime = (
  dependencies: LiveQuizRuntimeDependencies,
): LiveQuizRuntime => {
  const clock = dependencies.clock ?? defaultClock
  const hub = dependencies.hub ?? defaultSocketHub
  const timers = dependencies.timers ?? quizTimerScheduler
  const persistenceSink = dependencies.persistenceSink ?? noopPersistenceEventSink
  const presenterDependencies = {
    questionSets: dependencies.questionSets,
    participants: dependencies.participants,
    liveSessions: dependencies.liveSessions,
    answerLocks: dependencies.answerLocks,
    leaderboard: dependencies.leaderboard,
  } satisfies StatePresenterDependencies
  const hostPresenter = createHostStatePresenter(presenterDependencies)
  const participantPresenter = createParticipantStatePresenter(presenterDependencies)

  const runtime = {
    async handleHostConnected({ connection }) {
      await handleLifecycleConnected(connection.quizSession.id, connection.quizSession)
    },

    async handleParticipantConnected({ connection }) {
      await handleLifecycleConnected(connection.quizSession.id, connection.quizSession)
    },

    async handleHostEvent({ connection, event, socket }) {
      await withSessionMutationLock(connection.quizSession.id, async () => {
        if (event.type === 'start_quiz') {
          await startQuiz(connection.quizSession, socket)
          return
        }

        if (event.type === 'next_question') {
          await advanceOrFinishQuiz(connection.quizSession, socket)
          return
        }

        await finishQuiz(connection.quizSession, socket)
      })
    },

    async handleParticipantEvent({ connection, event, socket }) {
      await withSessionMutationLock(connection.quizSession.id, async () => {
        await submitAnswer(connection.quizSession, connection.participant, event.selectedOptionId, socket)
      })
    },

    async expireQuestion(quizSessionId) {
      await expireQuestion({ quizSessionId })
    },
  } satisfies LiveQuizRuntime

  const handleLifecycleConnected = async (
    quizSessionId: string,
    fallbackSession: QuizSession,
  ): Promise<void> => {
    const [quizSession, liveSession] = await Promise.all([
      readQuizSession(quizSessionId, fallbackSession),
      dependencies.liveSessions.readLiveSession(quizSessionId),
    ])

    if (liveSession?.status === 'question_active' && liveSession.endsAt) {
      if (liveSession.endsAt.getTime() <= clock.now().getTime()) {
        await expireQuestion({
          quizSessionId,
          expectedQuestionId: liveSession.currentQuestionId ?? undefined,
          expectedEndsAt: liveSession.endsAt,
        })
      } else {
        scheduleQuestionEnd({
          quizSessionId,
          questionId: liveSession.currentQuestionId,
          endsAt: liveSession.endsAt,
        })
      }
      return
    }

    if ((liveSession?.status ?? quizSession.status) === 'waiting_room') {
      await broadcastHostState(quizSession)
    }
  }

  const startQuiz = async (
    fallbackSession: QuizSession,
    socket: ConnectionSocket,
  ): Promise<void> => {
    const quizSession = await readQuizSession(fallbackSession.id, fallbackSession)
    const questionSet = await readQuestionSet(quizSession, socket)
    if (!questionSet) {
      return
    }

    const liveSession = await dependencies.liveSessions.readLiveSession(quizSession.id)
    const currentState = resolveCurrentState(quizSession, liveSession, questionSet)
    const transition = transitionQuizState({ state: currentState, action: 'start' })

    if (!transition.ok) {
      sendRuntimeError(socket, { code: 'invalid_runtime_state', message: transition.message })
      return
    }

    const question = findQuestionByPosition(questionSet, currentState.questionOrderIds, 1)
    if (!question) {
      sendRuntimeError(socket, {
        code: 'current_question_not_found',
        message: 'The first quiz question could not be found.',
      })
      return
    }

    const startedAt = clock.now()
    const timerWindow = createQuestionTimerWindow({
      startedAt,
      durationSeconds: resolveQuestionTimerSeconds({
        defaultTimeLimitSeconds: questionSet.defaultTimeLimitSeconds,
        questionTimeLimitSeconds: question.timeLimitSeconds,
      }),
    })

    await dependencies.answerLocks.resetQuestionAnswers({
      quizSessionId: quizSession.id,
      questionId: question.id,
    })
    const updatedSession = await updateQuizSession(socket, quizSession, {
      status: 'question_active',
      currentQuestionPosition: 1,
      startedAt,
    })
    if (!updatedSession) {
      return
    }

    try {
      await dependencies.liveSessions.setActiveQuestion({
        quizSessionId: quizSession.id,
        questionId: question.id,
        questionPosition: 1,
        startedAt: timerWindow.startedAt,
        endsAt: timerWindow.endsAt,
      })
    } catch (error) {
      await rollbackQuizSessionState(quizSession)
      throw error
    }

    scheduleQuestionEnd({
      quizSessionId: quizSession.id,
      questionId: question.id,
      endsAt: timerWindow.endsAt,
    })
    await broadcastSessionState(updatedSession)
  }

  const advanceOrFinishQuiz = async (
    fallbackSession: QuizSession,
    socket: ConnectionSocket,
  ): Promise<void> => {
    const quizSession = await readQuizSession(fallbackSession.id, fallbackSession)
    const questionSet = await readQuestionSet(quizSession, socket)
    if (!questionSet) {
      return
    }

    const liveSession = await dependencies.liveSessions.readLiveSession(quizSession.id)
    const currentState = resolveCurrentState(quizSession, liveSession, questionSet)
    const transition = transitionQuizState({ state: currentState, action: 'next_question' })

    if (!transition.ok) {
      sendRuntimeError(socket, { code: 'invalid_runtime_state', message: transition.message })
      return
    }

    if (transition.state.status === 'finished') {
      await finishQuiz(quizSession, socket)
      return
    }

    const nextPosition = transition.state.currentQuestionPosition
    if (nextPosition === null) {
      sendRuntimeError(socket, {
        code: 'current_question_not_found',
        message: 'The next quiz question could not be found.',
      })
      return
    }

    await startQuestion(quizSession, questionSet, currentState.questionOrderIds, nextPosition, socket)
  }

  const startQuestion = async (
    quizSession: QuizSession,
    questionSet: FullQuestionSet,
    questionOrderIds: readonly string[],
    questionPosition: number,
    socket: ConnectionSocket,
  ): Promise<void> => {
    const question = findQuestionByPosition(questionSet, questionOrderIds, questionPosition)
    if (!question) {
      sendRuntimeError(socket, {
        code: 'current_question_not_found',
        message: 'The next quiz question could not be found.',
      })
      return
    }

    const timerWindow = createQuestionTimerWindow({
      startedAt: clock.now(),
      durationSeconds: resolveQuestionTimerSeconds({
        defaultTimeLimitSeconds: questionSet.defaultTimeLimitSeconds,
        questionTimeLimitSeconds: question.timeLimitSeconds,
      }),
    })

    await dependencies.answerLocks.resetQuestionAnswers({
      quizSessionId: quizSession.id,
      questionId: question.id,
    })
    const updatedSession = await updateQuizSession(socket, quizSession, {
      status: 'question_active',
      currentQuestionPosition: questionPosition,
    })
    if (!updatedSession) {
      return
    }

    try {
      await dependencies.liveSessions.setActiveQuestion({
        quizSessionId: quizSession.id,
        questionId: question.id,
        questionPosition,
        startedAt: timerWindow.startedAt,
        endsAt: timerWindow.endsAt,
      })
    } catch (error) {
      await rollbackQuizSessionState(quizSession)
      throw error
    }

    scheduleQuestionEnd({
      quizSessionId: quizSession.id,
      questionId: question.id,
      endsAt: timerWindow.endsAt,
    })
    await broadcastSessionState(updatedSession)
  }

  const finishQuiz = async (
    fallbackSession: QuizSession,
    socket: ConnectionSocket,
  ): Promise<void> => {
    const quizSession = await readQuizSession(fallbackSession.id, fallbackSession)
    const liveSession = await dependencies.liveSessions.readLiveSession(quizSession.id)
    const currentStatus = liveSession?.status ?? quizSession.status

    if (currentStatus === 'finished') {
      sendRuntimeError(socket, {
        code: 'invalid_runtime_state',
        message: 'Finished quizzes cannot transition.',
      })
      return
    }

    const finishedAt = clock.now()
    const leaderboard = await dependencies.leaderboard.readLeaderboard(quizSession.id)
    const updatedSession = await updateQuizSession(socket, quizSession, {
      status: 'finished',
      currentQuestionPosition: null,
      finishedAt,
    })
    if (!updatedSession) {
      return
    }

    try {
      await dependencies.liveSessions.finishLiveSession(quizSession.id)
    } catch (error) {
      await rollbackQuizSessionState(quizSession)
      throw error
    }

    timers.cancelQuestionTimer(quizSession.id)
    enqueuePersistenceEvent({
      type: 'final_leaderboard',
      quizSessionId: quizSession.id,
      entries: leaderboard.map((entry) => ({
        participantId: entry.participantId,
        rank: entry.rank,
        score: entry.score,
        correctAnswerCount: entry.correctAnswerCount,
        lastCorrectSubmissionAt: entry.lastCorrectSubmissionAt,
        joinedAt: entry.joinedAt,
      })),
      recordedAt: finishedAt,
    })
    await broadcastSessionState(updatedSession)
  }

  const expireQuestion = async (
    input: Readonly<{
      quizSessionId: string
      expectedQuestionId?: string
      expectedEndsAt?: Date
    }>,
  ): Promise<void> => {
    await withSessionMutationLock(input.quizSessionId, async () => {
      const [quizSession, liveSession] = await Promise.all([
        dependencies.quizSessions.findById(input.quizSessionId),
        dependencies.liveSessions.readLiveSession(input.quizSessionId),
      ])

      if (!quizSession || quizSession.status === 'finished' || liveSession?.status !== 'question_active') {
        return
      }

      const questionId = liveSession.currentQuestionId
      const questionPosition = liveSession.currentQuestionPosition
      const startedAt = liveSession.startedAt

      if (!questionId || !questionPosition || !startedAt) {
        return
      }

      if (
        (input.expectedQuestionId && input.expectedQuestionId !== questionId) ||
        (input.expectedEndsAt &&
          (!liveSession.endsAt || liveSession.endsAt.getTime() !== input.expectedEndsAt.getTime()))
      ) {
        return
      }

      const questionSet = await dependencies.questionSets.findFullQuestionSetById(quizSession.questionSetId)
      if (!questionSet) {
        return
      }

      const currentState = resolveCurrentState(quizSession, liveSession, questionSet)
      const transition = transitionQuizState({ state: currentState, action: 'timer_expired' })
      if (!transition.ok) {
        return
      }

      const updatedSession = await dependencies.quizSessions.updateQuizSessionState(input.quizSessionId, {
        status: 'question_reveal',
        currentQuestionPosition: questionPosition,
      })

      if (!updatedSession) {
        return
      }

      try {
        await dependencies.liveSessions.setQuestionReveal({
          quizSessionId: input.quizSessionId,
          questionId,
          questionPosition,
          startedAt,
        })
      } catch (error) {
        await rollbackQuizSessionState(quizSession)
        throw error
      }

      await broadcastSessionState(updatedSession)
    })
  }

  const submitAnswer = async (
    quizSession: QuizSession,
    participant: Participant,
    selectedOptionId: string,
    socket: ConnectionSocket,
  ): Promise<void> => {
    const [liveSession, questionSet, knownParticipants] = await Promise.all([
      dependencies.liveSessions.readLiveSession(quizSession.id),
      dependencies.questionSets.findFullQuestionSetById(quizSession.questionSetId),
      dependencies.participants.listBySession(quizSession.id),
    ])

    const question = questionSet
      ? findQuestionById(questionSet, liveSession?.currentQuestionId ?? null)
      : null
    const submittedAt = clock.now()
    const alreadyAnswered = question
      ? await dependencies.answerLocks.hasParticipantAnswered({
          quizSessionId: quizSession.id,
          questionId: question.id,
          participantId: participant.id,
        })
      : false
    const validation = validateAnswerSubmission({
      participantId: participant.id,
      knownParticipantIds: knownParticipants.map(({ id }) => id),
      state: liveSession?.status ?? quizSession.status,
      activeQuestionId: liveSession?.currentQuestionId ?? null,
      questionId: question?.id ?? '',
      selectedOptionId,
      options: question?.options.map(({ id, isCorrect }) => ({ id, isCorrect })) ?? [],
      alreadyAnsweredParticipantIds: alreadyAnswered ? [participant.id] : [],
      submittedAt,
      questionEndsAt: liveSession?.endsAt ?? new Date(0),
    })

    if (!validation.ok) {
      sendRejectedAnswer(socket, selectedOptionId, validation.reason, validation.message)
      return
    }

    const answerLock = await dependencies.answerLocks.acceptFirstAnswer({
      quizSessionId: quizSession.id,
      questionId: question?.id ?? '',
      participantId: participant.id,
    })
    if (!answerLock.accepted) {
      sendRejectedAnswer(socket, selectedOptionId, 'duplicate_answer', 'Participant has already answered this question')
      return
    }

    const scoreAwarded = calculateAcceptedAnswerScore({
      isCorrect: validation.value.isCorrect,
    })
    try {
      await dependencies.leaderboard.recordAnswerScore({
        quizSessionId: quizSession.id,
        participantId: participant.id,
        displayName: participant.displayName,
        joinedAt: participant.joinedAt,
        isCorrect: validation.value.isCorrect,
        scoreAwarded,
        submittedAt,
      })
    } catch (error) {
      await rollbackAnswerLock({
        quizSessionId: quizSession.id,
        questionId: question?.id ?? '',
        participantId: participant.id,
      })
      throw error
    }
    enqueuePersistenceEvent({
      type: 'accepted_answer',
      quizSessionId: quizSession.id,
      participantId: participant.id,
      questionId: question?.id ?? '',
      selectedOptionId,
      isCorrect: validation.value.isCorrect,
      scoreAwarded,
      submittedAt,
    })

    trySendEvent(socket, {
      type: 'answer_result',
      status: 'accepted',
      selectedOptionId,
    })
    await broadcastSessionState(quizSession)
  }

  const readQuizSession = async (
    quizSessionId: string,
    fallbackSession: QuizSession,
  ): Promise<QuizSession> =>
    (await dependencies.quizSessions.findById(quizSessionId)) ?? fallbackSession

  const readQuestionSet = async (
    quizSession: QuizSession,
    socket: ConnectionSocket,
  ): Promise<FullQuestionSet | null> => {
    const questionSet = await dependencies.questionSets.findFullQuestionSetById(quizSession.questionSetId)

    if (!questionSet) {
      sendRuntimeError(socket, {
        code: 'question_set_not_found',
        message: 'Quiz question set was not found.',
      })
    }

    return questionSet
  }

  const updateQuizSession = async (
    socket: ConnectionSocket,
    quizSession: QuizSession,
    input: Parameters<QuizSessionsRuntimeRepository['updateQuizSessionState']>[1],
  ): Promise<QuizSession | null> => {
    const updatedSession = await dependencies.quizSessions.updateQuizSessionState(quizSession.id, input)

    if (!updatedSession) {
      sendRuntimeError(socket, {
        code: 'live_state_unavailable',
        message: 'Quiz session state could not be updated.',
      })
    }

    return updatedSession
  }

  const broadcastSessionState = async (quizSession: QuizSession): Promise<void> => {
    await Promise.all([broadcastHostState(quizSession), broadcastParticipantStates(quizSession)])
  }

  const broadcastHostState = async (quizSession: QuizSession): Promise<void> => {
    hub.sendToHostSockets(quizSession.id, await hostPresenter.presentHostState(quizSession))
  }

  const broadcastParticipantStates = async (quizSession: QuizSession): Promise<void> => {
    const participants = await dependencies.participants.listBySession(quizSession.id)

    await Promise.all(
      participants.map(async (participant) => {
        hub.sendToParticipantSocket({
          quizSessionId: quizSession.id,
          participantId: participant.id,
          event: await participantPresenter.presentParticipantState(participant, quizSession),
        })
      }),
    )
  }

  const enqueuePersistenceEvent = (event: PersistenceEvent): void => {
    void persistenceSink.enqueue(event).catch((error: unknown) => {
      console.error('Failed to enqueue persistence event', error)
    })
  }

  const rollbackQuizSessionState = async (quizSession: QuizSession): Promise<void> => {
    try {
      await dependencies.quizSessions.updateQuizSessionState(quizSession.id, {
        status: quizSession.status,
        currentQuestionPosition: quizSession.currentQuestionPosition,
        startedAt: quizSession.startedAt,
        finishedAt: quizSession.finishedAt,
      })
    } catch (error) {
      console.error('Failed to roll back quiz session runtime state', error)
    }
  }

  const rollbackAnswerLock = async (input: Readonly<{
    quizSessionId: string
    questionId: string
    participantId: string
  }>): Promise<void> => {
    try {
      await dependencies.answerLocks.releaseAnswer(input)
    } catch (error) {
      console.error('Failed to roll back accepted answer lock', error)
    }
  }

  const scheduleQuestionEnd = (input: Readonly<{
    quizSessionId: string
    questionId: string | null
    endsAt: Date
  }>): void => {
    timers.scheduleQuestionEnd({
      quizSessionId: input.quizSessionId,
      endsAt: input.endsAt,
      onExpire: () =>
        expireQuestion({
          quizSessionId: input.quizSessionId,
          expectedQuestionId: input.questionId ?? undefined,
          expectedEndsAt: input.endsAt,
        }),
    })
  }

  return runtime
}

const resolveCurrentState = (
  quizSession: QuizSession,
  liveSession: LiveSessionState | null,
  questionSet: FullQuestionSet,
): {
  status: QuizStatus
  currentQuestionPosition: number | null
  totalQuestions: number
  questionOrderIds: readonly string[]
} => {
  const questionOrderIds =
    liveSession?.questionOrderIds.length ? liveSession.questionOrderIds : quizSession.questionOrderIds

  return {
    status: liveSession?.status ?? quizSession.status,
    currentQuestionPosition:
      liveSession?.currentQuestionPosition ?? quizSession.currentQuestionPosition,
    totalQuestions: questionOrderIds.length || questionSet.questions.length,
    questionOrderIds,
  }
}

const findQuestionByPosition = (
  questionSet: FullQuestionSet,
  questionOrderIds: readonly string[],
  position: number,
): FullQuestion | null => {
  const questionId = questionOrderIds[position - 1]

  return questionId ? findQuestionById(questionSet, questionId) : null
}

const findQuestionById = (
  questionSet: FullQuestionSet,
  questionId: string | null,
): FullQuestion | null =>
  questionId ? questionSet.questions.find((question) => question.id === questionId) ?? null : null

const sendRejectedAnswer = (
  socket: ConnectionSocket,
  selectedOptionId: string,
  reason: ValidationErrorReason,
  message: string,
): void => {
  const answerReason = answerRejectionReasons.has(reason)
    ? reason as AnswerRejectionReason
    : 'wrong_state'

  trySendEvent(socket, {
    type: 'answer_result',
    status: 'rejected',
    selectedOptionId,
    reason: answerReason,
    message,
  })
}

const sendRuntimeError = (
  socket: ConnectionSocket,
  input: Readonly<{
    code: RuntimeErrorCode
    message: string
  }>,
): void => {
  trySendEvent(socket, {
    type: 'runtime_error',
    code: input.code,
    message: input.message,
  } satisfies RuntimeErrorEvent)
}

const trySendEvent = (socket: ConnectionSocket, event: ServerEvent): boolean => {
  try {
    socket.send(serializeServerEvent(event))
    return true
  } catch (error) {
    console.error('Failed to send runtime event', error)
    return false
  }
}

const withSessionMutationLock = async <Value>(
  quizSessionId: string,
  mutate: () => Promise<Value>,
): Promise<Value> => {
  const previousMutation = sessionMutationLocks.get(quizSessionId) ?? Promise.resolve()
  let releaseCurrentMutation!: () => void
  const currentMutation = new Promise<void>((resolve) => {
    releaseCurrentMutation = resolve
  })
  const queuedMutation = previousMutation.catch(() => undefined).then(() => currentMutation)

  sessionMutationLocks.set(quizSessionId, queuedMutation)

  await previousMutation.catch(() => undefined)

  try {
    return await mutate()
  } finally {
    releaseCurrentMutation()

    if (sessionMutationLocks.get(quizSessionId) === queuedMutation) {
      sessionMutationLocks.delete(quizSessionId)
    }
  }
}
