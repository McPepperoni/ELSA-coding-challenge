// AI Generated code <PURPOSE>: authenticate WebSocket host and participant tokens
import type { Participant, QuizSession } from '@/db/schema.js'
import type { TokenService } from '@/http/tokens.js'
import type { ProtocolErrorEvent } from '@/types/events.js'

export type HostSocketConnection = Readonly<{
  role: 'host'
  quizSession: QuizSession
}>

export type ParticipantSocketConnection = Readonly<{
  role: 'participant'
  participant: Participant
  quizSession: QuizSession
}>

export type AuthenticateHostDependencies = Readonly<{
  tokenService: Pick<TokenService, 'hashToken'>
  quizSessions: Readonly<{
    findByHostTokenHash: (hostTokenHash: string) => Promise<QuizSession | null>
  }>
}>

export type AuthenticateParticipantDependencies = Readonly<{
  tokenService: Pick<TokenService, 'hashToken'>
  participants: Readonly<{
    findByTokenHash: (participantTokenHash: string) => Promise<Participant | null>
  }>
  quizSessions: Readonly<{
    findById: (id: string) => Promise<QuizSession | null>
  }>
}>

export type AuthenticateHostResult =
  | Readonly<{ ok: true; connection: HostSocketConnection }>
  | Readonly<{ ok: false; event: ProtocolErrorEvent }>

export type AuthenticateParticipantResult =
  | Readonly<{ ok: true; connection: ParticipantSocketConnection }>
  | Readonly<{ ok: false; event: ProtocolErrorEvent }>

export const authenticateHostSocket = async (
  dependencies: AuthenticateHostDependencies,
  token: string | null | undefined,
): Promise<AuthenticateHostResult> => {
  if (!token?.trim()) {
    return protocolError('missing_token', 'WebSocket token is required.')
  }

  const quizSession = await dependencies.quizSessions.findByHostTokenHash(
    dependencies.tokenService.hashToken(token),
  )

  if (!quizSession) {
    return protocolError('invalid_host_token', 'Host WebSocket token is invalid.')
  }

  return {
    ok: true,
    connection: {
      role: 'host',
      quizSession,
    },
  }
}

export const authenticateParticipantSocket = async (
  dependencies: AuthenticateParticipantDependencies,
  token: string | null | undefined,
): Promise<AuthenticateParticipantResult> => {
  if (!token?.trim()) {
    return protocolError('missing_token', 'WebSocket token is required.')
  }

  const participant = await dependencies.participants.findByTokenHash(
    dependencies.tokenService.hashToken(token),
  )

  if (!participant) {
    return protocolError('invalid_participant_token', 'Participant WebSocket token is invalid.')
  }

  const quizSession = await dependencies.quizSessions.findById(participant.quizSessionId)

  if (!quizSession) {
    return protocolError('quiz_session_not_found', 'Quiz session was not found.')
  }

  return {
    ok: true,
    connection: {
      role: 'participant',
      participant,
      quizSession,
    },
  }
}

const protocolError = (
  code: ProtocolErrorEvent['code'],
  message: string,
): Readonly<{ ok: false; event: ProtocolErrorEvent }> => ({
  ok: false,
  event: {
    type: 'protocol_error',
    code,
    message,
  },
})
