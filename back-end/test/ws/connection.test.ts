// AI Generated code <PURPOSE>: verify WebSocket connection route and lifecycle behavior
import { expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'

import type { Participant, QuizSession } from '@/db/schema.js'
import type { ServerEvent } from '@/types/events.js'
import {
  createHostConnectionEvents,
  createParticipantConnectionEvents,
  createWebSocketRoutes,
} from '@/ws/connection.js'

const now = new Date('2026-06-16T10:00:00.000Z')

const quizSession: QuizSession = {
  id: 'session-1',
  questionSetId: 'set-1',
  quizCode: 'ABC12345',
  status: 'waiting_room',
  currentQuestionPosition: null,
  questionOrderIds: ['question-1'],
  hostTokenHash: 'hash:host-token',
  startedAt: null,
  finishedAt: null,
  createdAt: now,
  updatedAt: now,
}

const participant: Participant = {
  id: 'participant-1',
  quizSessionId: quizSession.id,
  displayName: 'Ada',
  participantTokenHash: 'hash:participant-token',
  joinedAt: now,
  lastSeenAt: null,
}

type SentSocket = {
  sent: string[]
  closed: boolean
  send: (message: string) => void
  close: () => void
}

const createSocket = (): SentSocket => ({
  sent: [],
  closed: false,
  send(message) {
    this.sent.push(message)
  },
  close() {
    this.closed = true
  },
})

const parseSent = (socket: SentSocket, index = 0): ServerEvent => JSON.parse(socket.sent[index] ?? '{}')

const hostState = {
  type: 'session_state',
  view: 'host',
  quizSessionId: quizSession.id,
  quizCode: quizSession.quizCode,
  status: 'waiting_room',
  currentQuestionPosition: null,
  totalQuestions: 1,
  startedAt: null,
  endsAt: null,
  participantCount: 0,
} as const

const participantState = {
  type: 'session_state',
  view: 'participant',
  quizSessionId: quizSession.id,
  quizCode: quizSession.quizCode,
  status: 'waiting_room',
  currentQuestionPosition: null,
  totalQuestions: 1,
  startedAt: null,
  endsAt: null,
} as const

const createDependencies = () => {
  const participantConnections: Array<{
    quizSessionId: string
    participantId: string
    connectedAt: Date
  }> = []
  const clearedParticipantConnections: Array<{
    quizSessionId: string
    participantId: string
  }> = []

  return {
    participantConnections,
    clearedParticipantConnections,
    dependencies: {
      tokenService: {
        hashToken: (token: string) => `hash:${token}`,
      },
      quizSessions: {
        findByHostTokenHash: async (tokenHash: string) =>
          tokenHash === quizSession.hostTokenHash ? quizSession : null,
        findById: async (quizSessionId: string) =>
          quizSessionId === quizSession.id ? quizSession : null,
      },
      participants: {
        findByTokenHash: async (tokenHash: string) =>
          tokenHash === participant.participantTokenHash ? participant : null,
        listBySession: async () => [],
      },
      liveSessions: {
        readLiveSession: async () => null,
        recordParticipantConnection: async (input: {
          quizSessionId: string
          participantId: string
          connectedAt: Date
        }) => {
          participantConnections.push(input)
        },
        clearParticipantConnection: async (input: {
          quizSessionId: string
          participantId: string
        }) => {
          clearedParticipantConnections.push(input)
        },
      },
      questionSets: {
        findFullQuestionSetById: async () => ({
          id: quizSession.questionSetId,
          title: 'Computer history',
          defaultTimeLimitSeconds: 30,
          createdAt: now,
          updatedAt: now,
          questions: [],
        }),
      },
      answerLocks: {
        readAnsweredCount: async () => 0,
        hasParticipantAnswered: async () => false,
      },
    },
  }
}

test('missing and invalid host tokens return HTTP 401 JSON before upgrade', async () => {
  const { dependencies } = createDependencies()
  let upgradeCalls = 0
  const app = createWebSocketRoutes(dependencies, () => {
    upgradeCalls += 1
    return () => new Response(null, { status: 101 })
  })

  const missingResponse = await app.request('/host')
  const invalidResponse = await app.request('/host?token=wrong-token')

  expect(missingResponse.status).toBe(401)
  expect(await missingResponse.json()).toEqual({
    error: { code: 'missing_token', message: 'WebSocket token is required.' },
  })
  expect(invalidResponse.status).toBe(401)
  expect(await invalidResponse.json()).toEqual({
    error: { code: 'invalid_host_token', message: 'Host WebSocket token is invalid.' },
  })
  expect(upgradeCalls).toBe(0)
})

test('valid host route reaches the upgrade factory', async () => {
  const { dependencies } = createDependencies()
  const app = createWebSocketRoutes(dependencies, () => {
    return () => new Response('upgraded', { status: 200 })
  })

  const response = await app.request('/host?token=host-token')

  expect(response.status).toBe(200)
  expect(await response.text()).toBe('upgraded')
})

test('host onOpen sends current host session state', async () => {
  const socket = createSocket()
  const events = createHostConnectionEvents({
    connection: { role: 'host', quizSession },
    presenter: {
      presentHostState: async () => hostState,
    },
  })

  await events.onOpen?.(new Event('open'), socket)

  expect(parseSent(socket)).toEqual(hostState)
})

test('participant onOpen records connection and sends participant session state', async () => {
  const { dependencies, participantConnections } = createDependencies()
  const socket = createSocket()
  const events = createParticipantConnectionEvents({
    connection: { role: 'participant', participant, quizSession },
    presenter: {
      presentParticipantState: async () => participantState,
    },
    liveSessions: dependencies.liveSessions,
  })

  await events.onOpen?.(new Event('open'), socket)

  expect(participantConnections).toHaveLength(1)
  expect(participantConnections[0]).toMatchObject({
    quizSessionId: quizSession.id,
    participantId: participant.id,
  })
  expect(participantConnections[0]?.connectedAt).toBeInstanceOf(Date)
  expect(parseSent(socket)).toEqual(participantState)
})

test('participant onClose clears participant connection', async () => {
  const { dependencies, clearedParticipantConnections } = createDependencies()
  const socket = createSocket()
  const events = createParticipantConnectionEvents({
    connection: { role: 'participant', participant, quizSession },
    presenter: {
      presentParticipantState: async () => participantState,
    },
    liveSessions: dependencies.liveSessions,
  })

  await events.onClose?.(new CloseEvent('close'), socket)

  expect(clearedParticipantConnections).toEqual([
    { quizSessionId: quizSession.id, participantId: participant.id },
  ])
})

test('ping sends pong', async () => {
  const socket = createSocket()
  const events = createHostConnectionEvents({
    connection: { role: 'host', quizSession },
    presenter: {
      presentHostState: async () => hostState,
    },
  })

  events.onMessage?.(new MessageEvent('message', { data: '{"type":"ping"}' }), socket)

  expect(parseSent(socket)).toEqual({ type: 'pong' })
})

test('participant sending host-only event sends forbidden protocol error', async () => {
  const { dependencies } = createDependencies()
  const socket = createSocket()
  const events = createParticipantConnectionEvents({
    connection: { role: 'participant', participant, quizSession },
    presenter: {
      presentParticipantState: async () => participantState,
    },
    liveSessions: dependencies.liveSessions,
  })

  events.onMessage?.(new MessageEvent('message', { data: '{"type":"start_quiz"}' }), socket)

  expect(parseSent(socket)).toEqual({
    type: 'protocol_error',
    code: 'forbidden_event_type',
    message: 'Event type is not allowed for this socket role.',
  })
})

test('valid runtime event sends not-handled protocol error without side effects', async () => {
  const { dependencies, participantConnections, clearedParticipantConnections } = createDependencies()
  const socket = createSocket()
  const events = createParticipantConnectionEvents({
    connection: { role: 'participant', participant, quizSession },
    presenter: {
      presentParticipantState: async () => participantState,
    },
    liveSessions: dependencies.liveSessions,
  })

  events.onMessage?.(
    new MessageEvent('message', {
      data: '{"type":"submit_answer","selectedOptionId":"option-1"}',
    }),
    socket,
  )

  expect(parseSent(socket)).toEqual({
    type: 'protocol_error',
    code: 'runtime_not_available',
    message: 'Runtime event handling is not available in this task.',
  })
  expect(participantConnections).toEqual([])
  expect(clearedParticipantConnections).toEqual([])
})

test('Bun server entrypoint exports Hono websocket handler', async () => {
  const source = await readFile(new URL('../../src/index.ts', import.meta.url), 'utf8')

  expect(source).toContain("import { websocket } from 'hono/bun'")
  expect(source).toContain('websocket,')
})
