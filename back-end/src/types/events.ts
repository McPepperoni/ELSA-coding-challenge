// AI Generated code <PURPOSE>: define backend WebSocket event contracts
import type { QuizStatus } from '@/domain/state.js'

export type SocketRole = 'host' | 'participant'

export type PingClientEvent = {
  type: 'ping'
}

export type HostClientEvent =
  | PingClientEvent
  | { type: 'start_quiz' }
  | { type: 'next_question' }
  | { type: 'finish_quiz' }

export type ParticipantClientEvent =
  | PingClientEvent
  | {
      type: 'submit_answer'
      selectedOptionId: string
    }

export type ClientEventByRole = {
  host: HostClientEvent
  participant: ParticipantClientEvent
}

export type ClientEvent = HostClientEvent | ParticipantClientEvent

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
  joinedAt: Date
}>

export type SessionStateLeaderboardEntry = Readonly<{
  participantId: string
  displayName?: string
  rank: number
  score: number
  correctAnswerCount: number
  lastCorrectSubmissionAt: Date | null
  joinedAt: Date
}>

export type BaseSessionStateEvent = Readonly<{
  type: 'session_state'
  view: 'host' | 'participant'
  quizSessionId: string
  quizCode: string
  status: QuizStatus
  currentQuestionPosition: number | null
  totalQuestions: number
  startedAt: Date | null
  endsAt: Date | null
}>

export type HostSessionStateEvent = BaseSessionStateEvent & Readonly<{
  view: 'host'
  participantCount: number
  participants?: readonly SessionStateParticipant[]
  question?: HostStateQuestion
  correctOptionId?: string
  answeredCount?: number
  leaderboard?: readonly SessionStateLeaderboardEntry[]
}>

export type ParticipantSessionStateEvent = BaseSessionStateEvent & Readonly<{
  view: 'participant'
  question?: ParticipantStateQuestion
  hasAnswered?: boolean
  canSubmit?: boolean
  leaderboard?: readonly SessionStateLeaderboardEntry[]
}>

export type ServerStateEvent =
  | {
      type: 'pong'
    }
  | HostSessionStateEvent
  | ParticipantSessionStateEvent

export type ProtocolErrorCode =
  | 'invalid_json'
  | 'invalid_event_shape'
  | 'forbidden_event_type'
  | 'missing_token'
  | 'invalid_host_token'
  | 'invalid_participant_token'
  | 'quiz_session_not_found'
  | 'connection_state_unavailable'
  | 'runtime_not_available'

export type ProtocolErrorEvent = {
  type: 'protocol_error'
  code: ProtocolErrorCode
  message: string
}

export type ServerEvent = ServerStateEvent | ProtocolErrorEvent
