// AI Generated code <PURPOSE>: manage live quiz WebSocket broadcast subscriptions
import type { ServerEvent } from '@/types/events.js'

import { serializeServerEvent } from './protocol.js'

export type BroadcastSocket = Readonly<{
  send(message: string): void
}>

export type RegisterHostSocketInput = {
  quizSessionId: string
  socket: BroadcastSocket
}

export type RegisterParticipantSocketInput = {
  quizSessionId: string
  participantId: string
  socket: BroadcastSocket
}

export type SendParticipantEventInput = {
  quizSessionId: string
  participantId: string
  event: ServerEvent
}

export type SocketHub = Readonly<{
  registerHostSocket(input: RegisterHostSocketInput): () => void
  registerParticipantSocket(input: RegisterParticipantSocketInput): () => void
  sendToHostSockets(quizSessionId: string, event: ServerEvent): void
  sendToParticipantSockets(quizSessionId: string, event: ServerEvent): void
  sendToParticipantSocket(input: SendParticipantEventInput): void
}>

export const createSocketHub = (): SocketHub => {
  const hostSocketsBySession = new Map<string, Set<BroadcastSocket>>()
  const participantSocketsBySession = new Map<string, Map<string, Set<BroadcastSocket>>>()

  return {
    registerHostSocket(input) {
      const quizSessionId = requireNonblank(input.quizSessionId, 'quizSessionId')
      const sockets = getOrCreateHostSockets(hostSocketsBySession, quizSessionId)

      sockets.add(input.socket)

      return createUnregister(() => {
        sockets.delete(input.socket)
        cleanupHostSession(hostSocketsBySession, quizSessionId)
      })
    },

    registerParticipantSocket(input) {
      const quizSessionId = requireNonblank(input.quizSessionId, 'quizSessionId')
      const participantId = requireNonblank(input.participantId, 'participantId')
      const sockets = getOrCreateParticipantSockets(
        participantSocketsBySession,
        quizSessionId,
        participantId,
      )

      sockets.add(input.socket)

      return createUnregister(() => {
        sockets.delete(input.socket)
        cleanupParticipant(participantSocketsBySession, quizSessionId, participantId)
      })
    },

    sendToHostSockets(quizSessionId, event) {
      const normalizedQuizSessionId = requireNonblank(quizSessionId, 'quizSessionId')
      sendToSocketSet(hostSocketsBySession.get(normalizedQuizSessionId), event, () => {
        cleanupHostSession(hostSocketsBySession, normalizedQuizSessionId)
      })
    },

    sendToParticipantSockets(quizSessionId, event) {
      const normalizedQuizSessionId = requireNonblank(quizSessionId, 'quizSessionId')
      const participantSockets = participantSocketsBySession.get(normalizedQuizSessionId)

      if (!participantSockets) {
        return
      }

      for (const [participantId, sockets] of participantSockets) {
        sendToSocketSet(sockets, event, () => {
          cleanupParticipant(participantSocketsBySession, normalizedQuizSessionId, participantId)
        })
      }
    },

    sendToParticipantSocket(input) {
      const quizSessionId = requireNonblank(input.quizSessionId, 'quizSessionId')
      const participantId = requireNonblank(input.participantId, 'participantId')
      const sockets = participantSocketsBySession.get(quizSessionId)?.get(participantId)

      sendToSocketSet(sockets, input.event, () => {
        cleanupParticipant(participantSocketsBySession, quizSessionId, participantId)
      })
    },
  }
}

export const socketHub = createSocketHub()

export default socketHub

const getOrCreateHostSockets = (
  sessions: Map<string, Set<BroadcastSocket>>,
  quizSessionId: string,
): Set<BroadcastSocket> => {
  const existing = sessions.get(quizSessionId)

  if (existing) {
    return existing
  }

  const sockets = new Set<BroadcastSocket>()
  sessions.set(quizSessionId, sockets)
  return sockets
}

const getOrCreateParticipantSockets = (
  sessions: Map<string, Map<string, Set<BroadcastSocket>>>,
  quizSessionId: string,
  participantId: string,
): Set<BroadcastSocket> => {
  let participants = sessions.get(quizSessionId)

  if (!participants) {
    participants = new Map<string, Set<BroadcastSocket>>()
    sessions.set(quizSessionId, participants)
  }

  let sockets = participants.get(participantId)

  if (!sockets) {
    sockets = new Set<BroadcastSocket>()
    participants.set(participantId, sockets)
  }

  return sockets
}

const sendToSocketSet = (
  sockets: Set<BroadcastSocket> | undefined,
  event: ServerEvent,
  cleanup: () => void,
): void => {
  if (!sockets || sockets.size === 0) {
    cleanup()
    return
  }

  const message = serializeServerEvent(event)

  for (const socket of sockets) {
    try {
      socket.send(message)
    } catch {
      sockets.delete(socket)
    }
  }

  cleanup()
}

const cleanupHostSession = (
  sessions: Map<string, Set<BroadcastSocket>>,
  quizSessionId: string,
): void => {
  if (sessions.get(quizSessionId)?.size === 0) {
    sessions.delete(quizSessionId)
  }
}

const cleanupParticipant = (
  sessions: Map<string, Map<string, Set<BroadcastSocket>>>,
  quizSessionId: string,
  participantId: string,
): void => {
  const participants = sessions.get(quizSessionId)

  if (!participants) {
    return
  }

  if (participants.get(participantId)?.size === 0) {
    participants.delete(participantId)
  }

  if (participants.size === 0) {
    sessions.delete(quizSessionId)
  }
}

const createUnregister = (unregister: () => void): (() => void) => {
  let isRegistered = true

  return () => {
    if (!isRegistered) {
      return
    }

    isRegistered = false
    unregister()
  }
}

const requireNonblank = (value: string, fieldName: string): string => {
  const trimmed = value.trim()

  if (trimmed.length === 0) {
    throw new TypeError(`${fieldName} must be nonblank.`)
  }

  return trimmed
}
