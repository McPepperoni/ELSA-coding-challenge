// AI Generated code <PURPOSE> define shared frontend REST and realtime contracts
export type ApiError = Readonly<{
  code: string
  message: string
}>

export type ApiSuccess<T> = Readonly<{
  ok: true
  data: T
}>

export type ApiFailure = Readonly<{
  ok: false
  error: ApiError
}>

export type ApiResult<T> = ApiSuccess<T> | ApiFailure

export type QuestionOptionDraft = Readonly<{
  text: string
  isCorrect: boolean
}>

export type QuestionDraft = Readonly<{
  prompt: string
  timeLimitSeconds?: number
  options: readonly QuestionOptionDraft[]
}>

export type QuestionSetDraft = Readonly<{
  title: string
  defaultTimeLimitSeconds: number
  questions: readonly QuestionDraft[]
}>

export type CreateQuizSessionInput = Readonly<{
  questionSetId: string
}>

export type JoinParticipantInput = Readonly<{
  quizCode: string
  displayName: string
}>

export type IsoDateString = string

export type QuestionOption = Readonly<{
  id: string
  text: string
  position: number
  isCorrect: boolean
  createdAt: IsoDateString
}>

export type Question = Readonly<{
  id: string
  prompt: string
  timeLimitSeconds: number | null
  createdAt: IsoDateString
  options: readonly QuestionOption[]
}>

export type QuestionSet = Readonly<{
  id: string
  title: string
  defaultTimeLimitSeconds: number
  createdAt: IsoDateString
  updatedAt: IsoDateString
  questions: readonly Question[]
}>

export type QuizSession = Readonly<{
  id: string
  questionSetId: string
  quizCode: string
  status: SessionStatus
  questionOrderIds: readonly string[]
  currentQuestionPosition: number | null
  joinPath: string
  startedAt: IsoDateString | null
  finishedAt: IsoDateString | null
  createdAt: IsoDateString
  updatedAt: IsoDateString
}>

export type Participant = Readonly<{
  id: string
  quizSessionId: string
  displayName: string
  joinedAt: IsoDateString
  lastSeenAt: IsoDateString | null
}>

export type QuestionSetResponse = Readonly<{
  questionSet: QuestionSet
}>

export type QuizSessionResponse = Readonly<{
  quizSession: QuizSession
  hostToken: string
}>

export type ParticipantJoinResponse = Readonly<{
  participant: Participant
  quizSession: QuizSession
  participantToken: string
}>

export type ParticipantMetadataResponse = Readonly<{
  participant: Participant
  quizSession: QuizSession
}>

export type HostMetadataResponse = Readonly<{
  quizSession: QuizSession
  participantCount: number
  participants: readonly Participant[]
  questionSet: QuestionSet
}>

export type RealtimeRole = 'host' | 'participant'

export type ClientEvent =
  | HostClientEvent
  | ParticipantClientEvent

export type HostClientEvent =
  | Readonly<{ type: 'start_quiz' }>
  | Readonly<{ type: 'next_question' }>
  | Readonly<{ type: 'finish_quiz' }>
  | Readonly<{ type: 'ping' }>

export type ParticipantClientEvent =
  | Readonly<{ type: 'submit_answer'; selectedOptionId: string }>
  | Readonly<{ type: 'ping' }>

export type ClientEventByRole = Readonly<{
  host: HostClientEvent
  participant: ParticipantClientEvent
}>

export type SessionStatus =
  | 'waiting_room'
  | 'question_active'
  | 'question_reveal'
  | 'finished'

type SessionStateBase = Readonly<{
  type: 'session_state'
  view: 'host' | 'participant'
  quizSessionId: string
  quizCode: string
  status: SessionStatus
  currentQuestionPosition: number | null
  totalQuestions: number
  startedAt: string | null
  endsAt: string | null
}>

export type HostSessionStateEvent = SessionStateBase &
  Readonly<{
    view: 'host'
    participantCount: number
    participants?: readonly SessionStateParticipant[]
    question?: HostStateQuestion
    correctOptionId?: string
    answeredCount?: number
    leaderboard?: readonly SessionStateLeaderboardEntry[]
  }>

export type ParticipantSessionStateEvent = SessionStateBase &
  Readonly<{
    view: 'participant'
    question?: ParticipantStateQuestion
    hasAnswered?: boolean
    canSubmit?: boolean
    leaderboard?: readonly SessionStateLeaderboardEntry[]
  }>

export type ServerQuestionOption = Readonly<{
  id: string
  text: string
  position: number
}>

export type HostStateQuestion = Readonly<{
  id: string
  prompt: string
  timeLimitSeconds: number
  options: readonly ServerQuestionOption[]
}>

export type ParticipantStateQuestion = Readonly<{
  id: string
  position: number
  options: readonly Readonly<{
    id: string
    position: number
  }>[]
}>

export type SessionStateParticipant = Readonly<{
  id: string
  displayName: string
  joinedAt: IsoDateString
}>

export type SessionStateLeaderboardEntry = Readonly<{
  participantId: string
  displayName?: string
  rank: number
  score: number
  correctAnswerCount: number
  lastCorrectSubmissionAt: IsoDateString | null
  joinedAt: IsoDateString
}>

export type SessionStateEvent =
  | HostSessionStateEvent
  | ParticipantSessionStateEvent

export type AnswerResultEvent =
  | Readonly<{
      type: 'answer_result'
      status: 'accepted'
      selectedOptionId: string
    }>
  | Readonly<{
      type: 'answer_result'
      status: 'rejected'
      selectedOptionId: string
      reason: AnswerRejectionReason
      message: string
    }>

export type AnswerRejectionReason =
  | 'duplicate_answer'
  | 'late_answer'
  | 'invalid_option'
  | 'unknown_participant'
  | 'wrong_state'
  | 'inactive_question'

export type ServerEvent =
  | SessionStateEvent
  | AnswerResultEvent
  | Readonly<{ type: 'protocol_error'; code: string; message: string }>
  | Readonly<{ type: 'runtime_error'; code: string; message: string }>
  | Readonly<{ type: 'pong' }>

export type ServerEventParseResult =
  | Readonly<{ ok: true; event: ServerEvent }>
  | Readonly<{ ok: false; error: string }>
