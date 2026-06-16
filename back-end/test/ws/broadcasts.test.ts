// AI Generated code <PURPOSE>: verify WebSocket broadcast hub routing behavior
import { expect, test } from 'bun:test'

import type { ServerEvent } from '@/types/events.js'
import { createSocketHub } from '@/ws/broadcasts.js'

type SentSocket = {
  sent: string[]
  send: (message: string) => void
}

const createSocket = (): SentSocket => ({
  sent: [],
  send(message) {
    this.sent.push(message)
  },
})

const sessionStateEvent: ServerEvent = {
  type: 'session_state',
  view: 'host',
  quizSessionId: 'session-1',
  quizCode: 'ABC12345',
  status: 'waiting_room',
  currentQuestionPosition: null,
  totalQuestions: 1,
  startedAt: null,
  endsAt: null,
  participantCount: 0,
}

test('host sockets receive serialized events', () => {
  const hub = createSocketHub()
  const socket = createSocket()

  hub.registerHostSocket({ quizSessionId: 'session-1', socket })
  hub.sendToHostSockets('session-1', sessionStateEvent)

  expect(socket.sent).toEqual([JSON.stringify(sessionStateEvent)])
})

test('participant session broadcast sends to all participant sockets in a session', () => {
  const hub = createSocketHub()
  const firstSocket = createSocket()
  const secondSocket = createSocket()
  const otherSessionSocket = createSocket()
  const event: ServerEvent = { type: 'pong' }

  hub.registerParticipantSocket({
    quizSessionId: 'session-1',
    participantId: 'participant-1',
    socket: firstSocket,
  })
  hub.registerParticipantSocket({
    quizSessionId: 'session-1',
    participantId: 'participant-2',
    socket: secondSocket,
  })
  hub.registerParticipantSocket({
    quizSessionId: 'session-2',
    participantId: 'participant-3',
    socket: otherSessionSocket,
  })

  hub.sendToParticipantSockets('session-1', event)

  expect(firstSocket.sent).toEqual([JSON.stringify(event)])
  expect(secondSocket.sent).toEqual([JSON.stringify(event)])
  expect(otherSessionSocket.sent).toEqual([])
})

test('targeted participant send sends only to that participant sockets', () => {
  const hub = createSocketHub()
  const firstSocket = createSocket()
  const secondSocket = createSocket()
  const otherParticipantSocket = createSocket()
  const event: ServerEvent = {
    type: 'answer_result',
    status: 'accepted',
    selectedOptionId: 'option-1',
  }

  hub.registerParticipantSocket({
    quizSessionId: 'session-1',
    participantId: 'participant-1',
    socket: firstSocket,
  })
  hub.registerParticipantSocket({
    quizSessionId: 'session-1',
    participantId: 'participant-1',
    socket: secondSocket,
  })
  hub.registerParticipantSocket({
    quizSessionId: 'session-1',
    participantId: 'participant-2',
    socket: otherParticipantSocket,
  })

  hub.sendToParticipantSocket({
    quizSessionId: 'session-1',
    participantId: 'participant-1',
    event,
  })

  expect(firstSocket.sent).toEqual([JSON.stringify(event)])
  expect(secondSocket.sent).toEqual([JSON.stringify(event)])
  expect(otherParticipantSocket.sent).toEqual([])
})

test('unregister stops future sends and is idempotent', () => {
  const hub = createSocketHub()
  const socket = createSocket()
  const unregister = hub.registerHostSocket({ quizSessionId: 'session-1', socket })

  unregister()
  unregister()
  hub.sendToHostSockets('session-1', { type: 'pong' })

  expect(socket.sent).toEqual([])
})

test('throwing socket is removed and does not prevent other sockets receiving', () => {
  const hub = createSocketHub()
  const throwingSocket = {
    send() {
      throw new Error('socket closed')
    },
  }
  const healthySocket = createSocket()
  const event: ServerEvent = { type: 'pong' }

  hub.registerHostSocket({ quizSessionId: 'session-1', socket: throwingSocket })
  hub.registerHostSocket({ quizSessionId: 'session-1', socket: healthySocket })

  hub.sendToHostSockets('session-1', event)
  hub.sendToHostSockets('session-1', event)

  expect(healthySocket.sent).toEqual([JSON.stringify(event), JSON.stringify(event)])
})
