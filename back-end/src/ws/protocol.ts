// AI Generated code <PURPOSE>: parse and serialize backend WebSocket protocol messages
import type {
  ClientEventByRole,
  HostClientEvent,
  ParticipantClientEvent,
  ProtocolErrorCode,
  ProtocolErrorEvent,
  ServerEvent,
  SocketRole,
} from '@/types/events.js'

export type ParsedClientEvent<Role extends SocketRole> =
  | { ok: true; event: ClientEventByRole[Role] }
  | { ok: false; event: ProtocolErrorEvent }

const hostEventTypeValues = [
  'start_quiz',
  'next_question',
  'finish_quiz',
  'ping',
] as const satisfies readonly HostClientEvent['type'][]

const participantEventTypeValues = [
  'submit_answer',
  'ping',
] as const satisfies readonly ParticipantClientEvent['type'][]

const hostEventTypes = new Set<HostClientEvent['type']>(hostEventTypeValues)
const participantEventTypes = new Set<ParticipantClientEvent['type']>(participantEventTypeValues)

export const parseClientEvent = <Role extends SocketRole>(
  role: Role,
  rawMessage: string,
): ParsedClientEvent<Role> => {
  let value: unknown

  try {
    value = JSON.parse(rawMessage)
  } catch {
    return protocolError('invalid_json', 'Message must be valid JSON.')
  }

  if (!isRecord(value) || typeof value.type !== 'string') {
    return protocolError('invalid_event_shape', 'Message shape is not supported.')
  }

  if (!isAllowedForRole(role, value.type)) {
    return protocolError('forbidden_event_type', 'Event type is not allowed for this socket role.')
  }

  const event = role === 'host' ? parseHostEvent(value) : parseParticipantEvent(value)

  if (!event) {
    return protocolError('invalid_event_shape', 'Message shape is not supported.')
  }

  return { ok: true, event } as ParsedClientEvent<Role>
}

export const serializeServerEvent = (event: ServerEvent): string => JSON.stringify(event)

const parseHostEvent = (value: Record<string, unknown>): HostClientEvent | null => {
  if (typeof value.type === 'string' && isHostEventType(value.type)) {
    return { type: value.type }
  }

  return null
}

const parseParticipantEvent = (value: Record<string, unknown>): ParticipantClientEvent | null => {
  if (typeof value.type !== 'string' || !isParticipantEventType(value.type)) {
    return null
  }

  if (value.type === 'ping') {
    return { type: 'ping' }
  }

  if (
    value.type === 'submit_answer' &&
    typeof value.selectedOptionId === 'string' &&
    value.selectedOptionId.trim().length > 0
  ) {
    return { type: 'submit_answer', selectedOptionId: value.selectedOptionId }
  }

  return null
}

const isAllowedForRole = (role: SocketRole, eventType: string): boolean => {
  return role === 'host' ? isHostEventType(eventType) : isParticipantEventType(eventType)
}

const isHostEventType = (eventType: string): eventType is HostClientEvent['type'] => {
  return hostEventTypes.has(eventType as HostClientEvent['type'])
}

const isParticipantEventType = (
  eventType: string,
): eventType is ParticipantClientEvent['type'] => {
  return participantEventTypes.has(eventType as ParticipantClientEvent['type'])
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const protocolError = <Role extends SocketRole>(
  code: ProtocolErrorCode,
  message: string,
): ParsedClientEvent<Role> => ({
  ok: false,
  event: {
    type: 'protocol_error',
    code,
    message,
  },
})
