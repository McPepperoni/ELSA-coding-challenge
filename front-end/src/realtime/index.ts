// AI Generated code <PURPOSE> provide realtime socket URL and event helpers
import type {
  AnswerResultEvent,
  AnswerRejectionReason,
  ClientEventByRole,
  RealtimeRole,
  ServerEventParseResult,
  SessionStateEvent,
} from '@/types'

type SocketUrlOptions<TRole extends RealtimeRole = RealtimeRole> = Readonly<{
  apiUrl: string
  role: TRole
  token: string
}>

type WebSocketLike = Readonly<{
  send: (message: string) => void
}>

type WebSocketConstructor<TSocket extends WebSocketLike> = new (
  url: string,
) => TSocket

type RealtimeConnectionOptions<
  TRole extends RealtimeRole,
  TSocket extends WebSocketLike,
> =
  SocketUrlOptions<TRole> &
    Readonly<{
      WebSocketCtor?: WebSocketConstructor<TSocket>
    }>

export type RealtimeConnection<
  TRole extends RealtimeRole = RealtimeRole,
  TSocket extends WebSocketLike = WebSocket,
> =
  Readonly<{
    socket: TSocket
    send: (event: ClientEventByRole[TRole]) => void
  }>

export const buildRealtimeSocketUrl = (
  options: SocketUrlOptions,
): string => {
  const url = new URL(options.apiUrl)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = `${url.pathname.replace(/\/$/, '')}/ws/${options.role}`
  url.search = ''
  url.searchParams.set('token', options.token)
  return url.toString()
}

export const createRealtimeConnection = <
  TRole extends RealtimeRole,
  TSocket extends WebSocketLike = WebSocket,
>(
  options: RealtimeConnectionOptions<TRole, TSocket>,
): RealtimeConnection<TRole, TSocket> => {
  const WebSocketCtor =
    options.WebSocketCtor ??
    (WebSocket as unknown as WebSocketConstructor<TSocket>)
  const socket = new WebSocketCtor(buildRealtimeSocketUrl(options))

  return {
    socket,
    send: (event) => socket.send(JSON.stringify(event)),
  }
}

export const parseServerEvent = (payload: unknown): ServerEventParseResult => {
  if (!isRecord(payload)) {
    return { ok: false, error: 'Server event must be an object' }
  }

  switch (payload.type) {
    case 'session_state':
      return parseSessionState(payload)
    case 'answer_result':
      return parseAnswerResult(payload)
    case 'protocol_error':
    case 'runtime_error':
      return parseErrorEvent(payload, payload.type)
    case 'pong':
      return { ok: true, event: { type: 'pong' } }
    default:
      return { ok: false, error: 'Unknown server event type' }
  }
}

export const parseSocketMessage = (message: string): ServerEventParseResult => {
  try {
    return parseServerEvent(JSON.parse(message) as unknown)
  } catch {
    return { ok: false, error: 'Socket message was not valid JSON' }
  }
}

const parseSessionState = (
  payload: Record<string, unknown>,
): ServerEventParseResult => {
  if (
    payload.view !== 'host' &&
    payload.view !== 'participant'
  ) {
    return { ok: false, error: 'session_state requires a known view' }
  }

  if (!isSessionStatus(payload.status)) {
    return { ok: false, error: 'session_state requires a backend status' }
  }

  if (
    typeof payload.quizSessionId !== 'string' ||
    typeof payload.quizCode !== 'string' ||
    !isNumberOrNull(payload.currentQuestionPosition) ||
    typeof payload.totalQuestions !== 'number' ||
    !isStringOrNull(payload.startedAt) ||
    !isStringOrNull(payload.endsAt)
  ) {
    return { ok: false, error: 'session_state is missing required fields' }
  }

  if (payload.view === 'host' && !isValidHostSessionState(payload)) {
    return { ok: false, error: 'session_state has malformed host fields' }
  }

  if (
    payload.view === 'participant' &&
    !isValidParticipantSessionState(payload)
  ) {
    return {
      ok: false,
      error: 'session_state has malformed participant fields',
    }
  }

  return {
    ok: true,
    event: payload as SessionStateEvent,
  }
}

const parseAnswerResult = (
  payload: Record<string, unknown>,
): ServerEventParseResult => {
  if (
    payload.status === 'accepted' &&
    typeof payload.selectedOptionId === 'string'
  ) {
    return {
      ok: true,
      event: {
        type: 'answer_result',
        status: 'accepted',
        selectedOptionId: payload.selectedOptionId,
      },
    }
  }

  if (
    payload.status === 'rejected' &&
    typeof payload.selectedOptionId === 'string' &&
    isAnswerRejectionReason(payload.reason) &&
    typeof payload.message === 'string'
  ) {
    return {
      ok: true,
      event: {
        type: 'answer_result',
        status: 'rejected',
        selectedOptionId: payload.selectedOptionId,
        reason: payload.reason,
        message: payload.message,
      } satisfies AnswerResultEvent,
    }
  }

  return { ok: false, error: 'answer_result is missing required fields' }
}

const parseErrorEvent = (
  payload: Record<string, unknown>,
  type: 'protocol_error' | 'runtime_error',
): ServerEventParseResult => {
  if (
    typeof payload.code !== 'string' ||
    typeof payload.message !== 'string'
  ) {
    return { ok: false, error: `${type} requires code and message` }
  }

  return {
    ok: true,
    event: { type, code: payload.code, message: payload.message },
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNumberOrNull = (value: unknown): value is number | null =>
  typeof value === 'number' || value === null

const isStringOrNull = (value: unknown): value is string | null =>
  typeof value === 'string' || value === null

const isSessionStatus = (value: unknown): boolean =>
  value === 'waiting_room' ||
  value === 'question_active' ||
  value === 'question_reveal' ||
  value === 'finished'

const isAnswerRejectionReason = (
  value: unknown,
): value is AnswerRejectionReason =>
  value === 'duplicate_answer' ||
  value === 'late_answer' ||
  value === 'invalid_option' ||
  value === 'unknown_participant' ||
  value === 'wrong_state' ||
  value === 'inactive_question'

const isValidHostSessionState = (payload: Record<string, unknown>): boolean =>
  typeof payload.participantCount === 'number' &&
  isOptionalArrayOf(payload.participants, isSessionStateParticipant) &&
  isOptionalValue(payload.question, isHostStateQuestion) &&
  isOptionalValue(payload.correctOptionId, isString) &&
  isOptionalValue(payload.answeredCount, isNumber) &&
  isOptionalArrayOf(payload.leaderboard, isLeaderboardEntry)

const isValidParticipantSessionState = (
  payload: Record<string, unknown>,
): boolean =>
  isOptionalValue(payload.question, isParticipantStateQuestion) &&
  isOptionalValue(payload.hasAnswered, isBoolean) &&
  isOptionalValue(payload.canSubmit, isBoolean) &&
  (payload.leaderboard === undefined ||
    (payload.status === 'finished' &&
      isOptionalArrayOf(payload.leaderboard, isLeaderboardEntry)))

const isHostStateQuestion = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.prompt === 'string' &&
  typeof value.timeLimitSeconds === 'number' &&
  Array.isArray(value.options) &&
  value.options.every(isServerQuestionOption)

const isParticipantStateQuestion = (value: unknown): boolean =>
  isRecord(value) &&
  !hasOwn(value, 'prompt') &&
  !hasOwn(value, 'timeLimitSeconds') &&
  typeof value.id === 'string' &&
  typeof value.position === 'number' &&
  Array.isArray(value.options) &&
  value.options.every(isParticipantQuestionOption)

const isServerQuestionOption = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.text === 'string' &&
  typeof value.position === 'number'

const isParticipantQuestionOption = (value: unknown): boolean =>
  isRecord(value) &&
  !hasOwn(value, 'text') &&
  !hasOwn(value, 'isCorrect') &&
  typeof value.id === 'string' &&
  typeof value.position === 'number'

const hasOwn = (value: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key)

const isSessionStateParticipant = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.displayName === 'string' &&
  typeof value.joinedAt === 'string'

const isLeaderboardEntry = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.participantId === 'string' &&
  isOptionalValue(value.displayName, isString) &&
  typeof value.rank === 'number' &&
  typeof value.score === 'number' &&
  typeof value.correctAnswerCount === 'number' &&
  isStringOrNull(value.lastCorrectSubmissionAt) &&
  typeof value.joinedAt === 'string'

const isOptionalArrayOf = (
  value: unknown,
  predicate: (item: unknown) => boolean,
): boolean => value === undefined || (Array.isArray(value) && value.every(predicate))

const isOptionalValue = (
  value: unknown,
  predicate: (item: unknown) => boolean,
): boolean => value === undefined || predicate(value)

const isString = (value: unknown): value is string => typeof value === 'string'

const isNumber = (value: unknown): value is number => typeof value === 'number'

const isBoolean = (value: unknown): value is boolean =>
  typeof value === 'boolean'
