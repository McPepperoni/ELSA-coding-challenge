// AI Generated code <PURPOSE>: present reconnect session state for WebSocket clients
import type { FullQuestion, FullQuestionSet } from '@/db/repositories/question-sets.js'
import type { Participant, QuizSession } from '@/db/schema.js'
import type { LiveLeaderboardEntry } from '@/redis/leaderboard-repository.js'
import type { LiveSessionState } from '@/redis/live-session-repository.js'
import type {
  HostSessionStateEvent,
  HostStateQuestion,
  ParticipantSessionStateEvent,
  ParticipantStateQuestion,
  SessionStateLeaderboardEntry,
} from '@/types/events.js'

export type StatePresenterDependencies = Readonly<{
  questionSets: Readonly<{
    findFullQuestionSetById: (id: string) => Promise<FullQuestionSet | null>
  }>
  participants: Readonly<{
    listBySession: (quizSessionId: string) => Promise<Participant[]>
  }>
  liveSessions: Readonly<{
    readLiveSession: (quizSessionId: string) => Promise<LiveSessionState | null>
  }>
  answerLocks: Readonly<{
    readAnsweredCount: (input: {
      quizSessionId: string
      questionId: string
    }) => Promise<number>
    hasParticipantAnswered: (input: {
      quizSessionId: string
      questionId: string
      participantId: string
    }) => Promise<boolean>
  }>
  leaderboard?: Readonly<{
    readTopLeaderboardEntries?: (
      quizSessionId: string,
      count?: number,
    ) => Promise<LiveLeaderboardEntry[]>
    readLeaderboard?: (quizSessionId: string, limit?: number) => Promise<LiveLeaderboardEntry[]>
  }>
}>

type ResolvedState = Readonly<{
  liveSession: LiveSessionState | null
  questionSet: FullQuestionSet
  questionOrderIds: readonly string[]
  status: QuizSession['status']
  currentQuestionId: string | null
  currentQuestionPosition: number | null
  startedAt: Date | null
  endsAt: Date | null
}>

export const createHostStatePresenter = (dependencies: StatePresenterDependencies) => ({
  async presentHostState(quizSession: QuizSession): Promise<HostSessionStateEvent> {
    const resolved = await resolveState(dependencies, quizSession)
    const participants = await dependencies.participants.listBySession(quizSession.id)
    const base = {
      type: 'session_state',
      view: 'host',
      quizSessionId: quizSession.id,
      quizCode: quizSession.quizCode,
      status: resolved.status,
      currentQuestionPosition: resolved.currentQuestionPosition,
      totalQuestions: resolved.questionOrderIds.length,
      startedAt: resolved.startedAt,
      endsAt: resolved.endsAt,
      participantCount: participants.length,
    } as const

    if (resolved.status === 'waiting_room') {
      return {
        ...base,
        participants: participants.map((participant) => ({
          id: participant.id,
          displayName: participant.displayName,
          joinedAt: participant.joinedAt,
        })),
      }
    }

    if (resolved.status === 'finished') {
      return {
        ...base,
        leaderboard: await readLeaderboard(dependencies, quizSession.id),
      }
    }

    const question = requireCurrentQuestion(resolved)
    const answeredCount = await dependencies.answerLocks.readAnsweredCount({
      quizSessionId: quizSession.id,
      questionId: question.id,
    })

    if (resolved.status === 'question_reveal') {
      return {
        ...base,
        question: toHostQuestion(question, resolved.questionSet),
        correctOptionId: requireCorrectOptionId(question),
        answeredCount,
        leaderboard: await readTopLeaderboard(dependencies, quizSession.id),
      }
    }

    return {
      ...base,
      question: toHostQuestion(question, resolved.questionSet),
      answeredCount,
    }
  },
})

export const createParticipantStatePresenter = (dependencies: StatePresenterDependencies) => ({
  async presentParticipantState(
    participant: Participant,
    quizSession: QuizSession,
  ): Promise<ParticipantSessionStateEvent> {
    const resolved = await resolveState(dependencies, quizSession)
    const base = {
      type: 'session_state',
      view: 'participant',
      quizSessionId: quizSession.id,
      quizCode: quizSession.quizCode,
      status: resolved.status,
      currentQuestionPosition: resolved.currentQuestionPosition,
      totalQuestions: resolved.questionOrderIds.length,
      startedAt: resolved.startedAt,
      endsAt: resolved.endsAt,
    } as const

    if (resolved.status === 'finished') {
      return {
        ...base,
        leaderboard: await readLeaderboard(dependencies, quizSession.id),
      }
    }

    if (resolved.status !== 'question_active') {
      return base
    }

    const question = requireCurrentQuestion(resolved)
    const hasAnswered = await dependencies.answerLocks.hasParticipantAnswered({
      quizSessionId: quizSession.id,
      questionId: question.id,
      participantId: participant.id,
    })

    return {
      ...base,
      question: toParticipantQuestion(question, resolved.currentQuestionPosition ?? 1),
      hasAnswered,
      canSubmit: !hasAnswered,
    }
  },
})

const resolveState = async (
  dependencies: StatePresenterDependencies,
  quizSession: QuizSession,
): Promise<ResolvedState> => {
  const [liveSession, questionSet] = await Promise.all([
    dependencies.liveSessions.readLiveSession(quizSession.id),
    dependencies.questionSets.findFullQuestionSetById(quizSession.questionSetId),
  ])

  if (!questionSet) {
    throw new Error('Question set was not found')
  }

  const questionOrderIds =
    liveSession?.questionOrderIds.length ? liveSession.questionOrderIds : quizSession.questionOrderIds

  return {
    liveSession,
    questionSet,
    questionOrderIds,
    status: liveSession?.status ?? quizSession.status,
    currentQuestionId: liveSession?.currentQuestionId ?? questionIdAtPosition(
      questionOrderIds,
      quizSession.currentQuestionPosition,
    ),
    currentQuestionPosition:
      liveSession?.currentQuestionPosition ?? quizSession.currentQuestionPosition,
    startedAt: liveSession?.startedAt ?? quizSession.startedAt,
    endsAt: liveSession?.endsAt ?? null,
  }
}

const questionIdAtPosition = (
  questionOrderIds: readonly string[],
  currentQuestionPosition: number | null,
): string | null => {
  if (currentQuestionPosition === null) {
    return null
  }

  return questionOrderIds[currentQuestionPosition - 1] ?? null
}

const requireCurrentQuestion = (resolved: ResolvedState): FullQuestion => {
  if (!resolved.currentQuestionId) {
    throw new Error('Current question was not found')
  }

  const question = resolved.questionSet.questions.find(({ id }) => id === resolved.currentQuestionId)

  if (!question) {
    throw new Error('Current question was not found')
  }

  return question
}

const toHostQuestion = (
  question: FullQuestion,
  questionSet: FullQuestionSet,
): HostStateQuestion => ({
  id: question.id,
  prompt: question.prompt,
  timeLimitSeconds: question.timeLimitSeconds ?? questionSet.defaultTimeLimitSeconds,
  options: question.options.map((option) => ({
    id: option.id,
    text: option.optionText,
    position: option.position,
  })),
})

const toParticipantQuestion = (
  question: FullQuestion,
  position: number,
): ParticipantStateQuestion => ({
  id: question.id,
  position,
  options: question.options.map((option) => ({
    id: option.id,
    position: option.position,
  })),
})

const requireCorrectOptionId = (question: FullQuestion): string => {
  const correctOption = question.options.find((option) => option.isCorrect)

  if (!correctOption) {
    throw new Error('Correct option was not found')
  }

  return correctOption.id
}

const readTopLeaderboard = async (
  dependencies: StatePresenterDependencies,
  quizSessionId: string,
): Promise<SessionStateLeaderboardEntry[] | undefined> => {
  const entries = await dependencies.leaderboard?.readTopLeaderboardEntries?.(quizSessionId)

  return entries?.map(toLeaderboardEntry)
}

const readLeaderboard = async (
  dependencies: StatePresenterDependencies,
  quizSessionId: string,
): Promise<SessionStateLeaderboardEntry[] | undefined> => {
  const entries = await dependencies.leaderboard?.readLeaderboard?.(quizSessionId)

  return entries?.map(toLeaderboardEntry)
}

const toLeaderboardEntry = (entry: LiveLeaderboardEntry): SessionStateLeaderboardEntry => ({
  participantId: entry.participantId,
  displayName: entry.displayName,
  rank: entry.rank,
  score: entry.score,
  correctAnswerCount: entry.correctAnswerCount,
  lastCorrectSubmissionAt: entry.lastCorrectSubmissionAt,
  joinedAt: entry.joinedAt,
})
