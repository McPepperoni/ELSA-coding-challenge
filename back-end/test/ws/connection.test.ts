// AI Generated code <PURPOSE>: verify WebSocket connection route and lifecycle behavior
import { expect, spyOn, test } from 'bun:test'
import { readFile } from 'node:fs/promises'

import type { Participant, QuizSession } from '@/db/schema.js'
import { createDefaultHttpApp } from '@/http/index.js'
import type { ServerEvent } from '@/types/events.js'
import {
  createHostConnectionEvents,
  createParticipantConnectionEvents,
  createWebSocketRoutes,
  type ConnectionEvents,
  type RuntimeHandlers,
  type WebSocketUpgrade,
} from '@/ws/connection.js'
import type { SocketHub } from '@/ws/broadcasts.js'

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

const flushAsyncWork = async () => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

const createDeferred = <Value>() => {
  let resolve!: (value: Value) => void

  const promise = new Promise<Value>((innerResolve) => {
    resolve = innerResolve
  })

  return { promise, resolve }
}

const createTrackingHub = () => {
  const registeredHosts: string[] = []
  const unregisteredHosts: string[] = []
  const registeredParticipants: string[] = []
  const unregisteredParticipants: string[] = []

  const hub: SocketHub = {
    registerHostSocket(input) {
      registeredHosts.push(input.quizSessionId)
      return () => {
        unregisteredHosts.push(input.quizSessionId)
      }
    },
    registerParticipantSocket(input) {
      registeredParticipants.push(`${input.quizSessionId}:${input.participantId}`)
      return () => {
        unregisteredParticipants.push(`${input.quizSessionId}:${input.participantId}`)
      }
    },
    sendToHostSockets() {
      return undefined
    },
    sendToParticipantSockets() {
      return undefined
    },
    sendToParticipantSocket() {
      return undefined
    },
  }

  return {
    hub,
    registeredHosts,
    unregisteredHosts,
    registeredParticipants,
    unregisteredParticipants,
  }
}

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
    connectionId: string
    connectedAt: Date
  }> = []
  const clearedParticipantConnections: Array<{
    quizSessionId: string
    participantId: string
    connectionId: string
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
          connectionId: string
          connectedAt: Date
        }) => {
          participantConnections.push(input)
        },
        clearParticipantConnection: async (input: {
          quizSessionId: string
          participantId: string
          connectionId: string
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

test('host route factory injects runtime handlers into connection events', async () => {
  const { dependencies } = createDependencies()
  const socket = createSocket()
  const handledHostEvents: string[] = []
  const captured: { createEvents?: Parameters<WebSocketUpgrade>[0] } = {}
  const app = createWebSocketRoutes(
    {
      ...dependencies,
      runtimeHandlers: {
        handleHostEvent(input) {
          handledHostEvents.push(input.event.type)
        },
        handleParticipantEvent() {
          return undefined
        },
      },
    },
    (createEvents) => {
      captured.createEvents = createEvents
      return () => new Response('upgraded', { status: 200 })
    },
  )

  const response = await app.request('/host?token=host-token')
  if (!captured.createEvents) {
    throw new Error('upgrade factory was not called')
  }
  const events = captured.createEvents({} as never) as ConnectionEvents
  events?.onMessage?.(new MessageEvent('message', { data: '{"type":"start_quiz"}' }), socket)

  expect(response.status).toBe(200)
  expect(handledHostEvents).toEqual(['start_quiz'])
  expect(socket.sent).toEqual([])
})

test('missing and invalid participant tokens return HTTP 401 JSON before upgrade', async () => {
  const { dependencies } = createDependencies()
  let upgradeCalls = 0
  const app = createWebSocketRoutes(dependencies, () => {
    upgradeCalls += 1
    return () => new Response(null, { status: 101 })
  })

  const missingResponse = await app.request('/participant')
  const invalidResponse = await app.request('/participant?token=wrong-token')

  expect(missingResponse.status).toBe(401)
  expect(await missingResponse.json()).toEqual({
    error: { code: 'missing_token', message: 'WebSocket token is required.' },
  })
  expect(invalidResponse.status).toBe(401)
  expect(await invalidResponse.json()).toEqual({
    error: {
      code: 'invalid_participant_token',
      message: 'Participant WebSocket token is invalid.',
    },
  })
  expect(upgradeCalls).toBe(0)
})

test('valid participant route reaches the upgrade factory', async () => {
  const { dependencies } = createDependencies()
  const app = createWebSocketRoutes(dependencies, () => {
    return () => new Response('upgraded', { status: 200 })
  })

  const response = await app.request('/participant?token=participant-token')

  expect(response.status).toBe(200)
  expect(await response.text()).toBe('upgraded')
})

test('participant route factory injects runtime handlers into connection events', async () => {
  const { dependencies } = createDependencies()
  const socket = createSocket()
  const handledParticipantSelections: string[] = []
  const captured: { createEvents?: Parameters<WebSocketUpgrade>[0] } = {}
  const app = createWebSocketRoutes(
    {
      ...dependencies,
      runtimeHandlers: {
        handleHostEvent() {
          return undefined
        },
        handleParticipantEvent(input) {
          if (input.event.type === 'submit_answer') {
            handledParticipantSelections.push(input.event.selectedOptionId)
          }
        },
      },
    },
    (createEvents) => {
      captured.createEvents = createEvents
      return () => new Response('upgraded', { status: 200 })
    },
  )

  const response = await app.request('/participant?token=participant-token')
  if (!captured.createEvents) {
    throw new Error('upgrade factory was not called')
  }
  const events = captured.createEvents({} as never) as ConnectionEvents
  events?.onMessage?.(
    new MessageEvent('message', {
      data: '{"type":"submit_answer","selectedOptionId":"option-1"}',
    }),
    socket,
  )

  expect(response.status).toBe(200)
  expect(handledParticipantSelections).toEqual(['option-1'])
  expect(socket.sent).toEqual([])
})

test('default backend app factory exposes WebSocket host route behavior', async () => {
  const app = createDefaultHttpApp()

  const response = await app.request('/ws/host')

  expect(response.status).toBe(401)
  expect(await response.json()).toEqual({
    error: { code: 'missing_token', message: 'WebSocket token is required.' },
  })
})

test('host onOpen sends current host session state', async () => {
  const socket = createSocket()
  const events = createHostConnectionEvents({
    connection: { role: 'host', quizSession },
    presenter: {
      presentHostState: async () => hostState,
    },
  })

  events.onOpen?.(new Event('open'), socket)
  await flushAsyncWork()

  expect(parseSent(socket)).toEqual(hostState)
})

test('host onOpen registers in injected hub after successful initial state and onClose unregisters', async () => {
  const socket = createSocket()
  const { hub, registeredHosts, unregisteredHosts } = createTrackingHub()
  const events = createHostConnectionEvents({
    connection: { role: 'host', quizSession },
    presenter: {
      presentHostState: async () => hostState,
    },
    hub,
  })

  events.onOpen?.(new Event('open'), socket)
  await flushAsyncWork()
  events.onClose?.(new CloseEvent('close'), socket)

  expect(registeredHosts).toEqual([quizSession.id])
  expect(unregisteredHosts).toEqual([quizSession.id])
})

test('failed host initial state does not register in injected hub', async () => {
  const socket = createSocket()
  const { hub, registeredHosts } = createTrackingHub()
  const events = createHostConnectionEvents({
    connection: { role: 'host', quizSession },
    presenter: {
      async presentHostState() {
        throw new Error('state unavailable')
      },
    },
    hub,
  })

  events.onOpen?.(new Event('open'), socket)
  await flushAsyncWork()

  expect(registeredHosts).toEqual([])
})

test('host close before initial state resolves prevents later hub registration', async () => {
  const socket = createSocket()
  const { promise, resolve } = createDeferred<ServerEvent>()
  const { hub, registeredHosts, unregisteredHosts } = createTrackingHub()
  const events = createHostConnectionEvents({
    connection: { role: 'host', quizSession },
    presenter: {
      presentHostState: async () => promise,
    },
    hub,
  })

  events.onOpen?.(new Event('open'), socket)
  events.onClose?.(new CloseEvent('close'), socket)
  resolve(hostState)
  await flushAsyncWork()

  expect(registeredHosts).toEqual([])
  expect(unregisteredHosts).toEqual([])
})

test('host onOpen starts initial-state work without returning a promise', () => {
  const socket = createSocket()
  const events = createHostConnectionEvents({
    connection: { role: 'host', quizSession },
    presenter: {
      presentHostState: async () => hostState,
    },
  })

  const result = events.onOpen?.(new Event('open'), socket)

  expect(result).toBeUndefined()
})

test('host onOpen presenter failure sends protocol error and closes socket', async () => {
  const socket = createSocket()
  const events = createHostConnectionEvents({
    connection: { role: 'host', quizSession },
    presenter: {
      async presentHostState() {
        throw new Error('state unavailable')
      },
    },
  })

  events.onOpen?.(new Event('open'), socket)
  await flushAsyncWork()

  expect(parseSent(socket)).toEqual({
    type: 'protocol_error',
    code: 'connection_state_unavailable',
    message: 'Connection state is not available.',
  })
  expect(socket.closed).toBe(true)
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

  events.onOpen?.(new Event('open'), socket)
  await flushAsyncWork()

  expect(participantConnections).toHaveLength(1)
  expect(participantConnections[0]).toMatchObject({
    quizSessionId: quizSession.id,
    participantId: participant.id,
    connectionId: expect.any(String),
  })
  expect(participantConnections[0]?.connectionId).not.toBe('')
  expect(participantConnections[0]?.connectedAt).toBeInstanceOf(Date)
  expect(parseSent(socket)).toEqual(participantState)
})

test('participant onOpen registers in injected hub after Redis record and initial state, and onClose unregisters and clears Redis connection', async () => {
  const { dependencies, participantConnections, clearedParticipantConnections } = createDependencies()
  const socket = createSocket()
  const { hub, registeredParticipants, unregisteredParticipants } = createTrackingHub()
  const events = createParticipantConnectionEvents({
    connection: { role: 'participant', participant, quizSession },
    presenter: {
      presentParticipantState: async () => participantState,
    },
    liveSessions: dependencies.liveSessions,
    hub,
  })

  events.onOpen?.(new Event('open'), socket)
  await flushAsyncWork()
  events.onClose?.(new CloseEvent('close'), socket)
  await flushAsyncWork()

  expect(participantConnections).toHaveLength(1)
  expect(registeredParticipants).toEqual([`${quizSession.id}:${participant.id}`])
  expect(unregisteredParticipants).toEqual([`${quizSession.id}:${participant.id}`])
  expect(clearedParticipantConnections).toEqual([
    {
      quizSessionId: quizSession.id,
      participantId: participant.id,
      connectionId: participantConnections[0]?.connectionId,
    },
  ])
})

test('participant close before initial state resolves prevents later hub registration and still clears Redis connection', async () => {
  const recordConnection = createDeferred<void>()
  const socket = createSocket()
  const participantConnections: Array<{
    quizSessionId: string
    participantId: string
    connectionId: string
    connectedAt: Date
  }> = []
  const clearedParticipantConnections: Array<{
    quizSessionId: string
    participantId: string
    connectionId: string
  }> = []
  const { hub, registeredParticipants, unregisteredParticipants } = createTrackingHub()
  const events = createParticipantConnectionEvents({
    connection: { role: 'participant', participant, quizSession },
    presenter: {
      presentParticipantState: async () => participantState,
    },
    liveSessions: {
      async recordParticipantConnection(input) {
        participantConnections.push(input)
        await recordConnection.promise
      },
      async clearParticipantConnection(input) {
        clearedParticipantConnections.push(input)
      },
    },
    hub,
  })

  events.onOpen?.(new Event('open'), socket)
  events.onClose?.(new CloseEvent('close'), socket)
  await flushAsyncWork()
  recordConnection.resolve()
  await flushAsyncWork()

  expect(participantConnections).toHaveLength(1)
  expect(clearedParticipantConnections.length).toBeGreaterThanOrEqual(1)
  expect(clearedParticipantConnections).toEqual(
    expect.arrayContaining([
      {
        quizSessionId: quizSession.id,
        participantId: participant.id,
        connectionId: participantConnections[0]?.connectionId,
      },
    ]),
  )
  expect(registeredParticipants).toEqual([])
  expect(unregisteredParticipants).toEqual([])
})

test('participant close before Redis record resolves clears the completed connection and skips registration', async () => {
  const recordConnection = createDeferred<void>()
  const socket = createSocket()
  const { hub, registeredParticipants } = createTrackingHub()
  let storedConnectionId: string | null = null
  const events = createParticipantConnectionEvents({
    connection: { role: 'participant', participant, quizSession },
    presenter: {
      presentParticipantState: async () => participantState,
    },
    liveSessions: {
      async recordParticipantConnection(input) {
        await recordConnection.promise
        storedConnectionId = input.connectionId
      },
      async clearParticipantConnection(input) {
        if (storedConnectionId === input.connectionId) {
          storedConnectionId = null
        }
      },
    },
    hub,
  })

  events.onOpen?.(new Event('open'), socket)
  events.onClose?.(new CloseEvent('close'), socket)
  await flushAsyncWork()
  recordConnection.resolve()
  await flushAsyncWork()

  expect(storedConnectionId).toBeNull()
  expect(registeredParticipants).toEqual([])
  expect(socket.sent).toEqual([])
})

test('participant initial-state send failure clears recorded connection and skips registration', async () => {
  const socket = {
    sent: [] as string[],
    closed: false,
    send() {
      throw new Error('socket unavailable')
    },
    close() {
      this.closed = true
    },
  }
  const participantConnections: Array<{
    quizSessionId: string
    participantId: string
    connectionId: string
    connectedAt: Date
  }> = []
  const clearedParticipantConnections: Array<{
    quizSessionId: string
    participantId: string
    connectionId: string
  }> = []
  const { hub, registeredParticipants } = createTrackingHub()
  const events = createParticipantConnectionEvents({
    connection: { role: 'participant', participant, quizSession },
    presenter: {
      presentParticipantState: async () => participantState,
    },
    liveSessions: {
      async recordParticipantConnection(input) {
        participantConnections.push(input)
      },
      async clearParticipantConnection(input) {
        clearedParticipantConnections.push(input)
      },
    },
    hub,
  })

  events.onOpen?.(new Event('open'), socket)
  await flushAsyncWork()

  expect(participantConnections).toHaveLength(1)
  expect(clearedParticipantConnections).toEqual([
    {
      quizSessionId: quizSession.id,
      participantId: participant.id,
      connectionId: participantConnections[0]?.connectionId,
    },
  ])
  expect(registeredParticipants).toEqual([])
})

test('participant presenter failure after Redis record clears connection and closes socket', async () => {
  const socket = createSocket()
  const participantConnections: Array<{
    quizSessionId: string
    participantId: string
    connectionId: string
    connectedAt: Date
  }> = []
  const clearedParticipantConnections: Array<{
    quizSessionId: string
    participantId: string
    connectionId: string
  }> = []
  const events = createParticipantConnectionEvents({
    connection: { role: 'participant', participant, quizSession },
    presenter: {
      async presentParticipantState() {
        throw new Error('state unavailable')
      },
    },
    liveSessions: {
      async recordParticipantConnection(input) {
        participantConnections.push(input)
      },
      async clearParticipantConnection(input) {
        clearedParticipantConnections.push(input)
      },
    },
  })

  events.onOpen?.(new Event('open'), socket)
  await flushAsyncWork()

  expect(participantConnections).toHaveLength(1)
  expect(clearedParticipantConnections).toEqual([
    {
      quizSessionId: quizSession.id,
      participantId: participant.id,
      connectionId: participantConnections[0]?.connectionId,
    },
  ])
  expect(parseSent(socket)).toEqual({
    type: 'protocol_error',
    code: 'connection_state_unavailable',
    message: 'Connection state is not available.',
  })
  expect(socket.closed).toBe(true)
})

test('participant presenter failure with throwing socket still clears connection', async () => {
  const socket = {
    sent: [] as string[],
    closed: false,
    send() {
      throw new Error('socket unavailable')
    },
    close() {
      this.closed = true
    },
  }
  const participantConnections: Array<{
    quizSessionId: string
    participantId: string
    connectionId: string
    connectedAt: Date
  }> = []
  const clearedParticipantConnections: Array<{
    quizSessionId: string
    participantId: string
    connectionId: string
  }> = []
  const events = createParticipantConnectionEvents({
    connection: { role: 'participant', participant, quizSession },
    presenter: {
      async presentParticipantState() {
        throw new Error('state unavailable')
      },
    },
    liveSessions: {
      async recordParticipantConnection(input) {
        participantConnections.push(input)
      },
      async clearParticipantConnection(input) {
        clearedParticipantConnections.push(input)
      },
    },
  })

  events.onOpen?.(new Event('open'), socket)
  await flushAsyncWork()

  expect(participantConnections).toHaveLength(1)
  expect(clearedParticipantConnections).toEqual([
    {
      quizSessionId: quizSession.id,
      participantId: participant.id,
      connectionId: participantConnections[0]?.connectionId,
    },
  ])
  expect(socket.closed).toBe(true)
})

test('participant stale socket close does not clear a newer connection', async () => {
  const connectionStore: {
    connectedParticipantId: string | null
    storedConnectionId: string | null
  } = {
    connectedParticipantId: null,
    storedConnectionId: null,
  }
  const liveSessions = {
    readLiveSession: async () => null,
    async recordParticipantConnection(input: {
      participantId: string
      connectionId: string
    }) {
      connectionStore.connectedParticipantId = input.participantId
      connectionStore.storedConnectionId = input.connectionId
    },
    async clearParticipantConnection(input: {
      participantId: string
      connectionId: string
    }) {
      if (input.connectionId === connectionStore.storedConnectionId) {
        connectionStore.connectedParticipantId = null
        connectionStore.storedConnectionId = null
      }
    },
  }
  const firstSocketEvents = createParticipantConnectionEvents({
    connection: { role: 'participant', participant, quizSession },
    presenter: {
      presentParticipantState: async () => participantState,
    },
    liveSessions,
  })
  const secondSocketEvents = createParticipantConnectionEvents({
    connection: { role: 'participant', participant, quizSession },
    presenter: {
      presentParticipantState: async () => participantState,
    },
    liveSessions,
  })

  firstSocketEvents.onOpen?.(new Event('open'), createSocket())
  await flushAsyncWork()
  const firstConnectionId = connectionStore.storedConnectionId

  secondSocketEvents.onOpen?.(new Event('open'), createSocket())
  await flushAsyncWork()
  const secondConnectionId = connectionStore.storedConnectionId

  firstSocketEvents.onClose?.(new CloseEvent('close'), createSocket())
  await flushAsyncWork()

  expect(firstConnectionId).toEqual(expect.any(String))
  expect(secondConnectionId).toEqual(expect.any(String))
  expect(secondConnectionId).not.toBe(firstConnectionId)
  expect(connectionStore.connectedParticipantId).toBe(participant.id)
  expect(connectionStore.storedConnectionId).toBe(secondConnectionId)
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

  events.onClose?.(new CloseEvent('close'), socket)
  await flushAsyncWork()

  expect(clearedParticipantConnections).toEqual([
    {
      quizSessionId: quizSession.id,
      participantId: participant.id,
      connectionId: expect.any(String),
    },
  ])
})

test('participant onClose starts cleanup without returning a promise', () => {
  const socket = createSocket()
  const events = createParticipantConnectionEvents({
    connection: { role: 'participant', participant, quizSession },
    presenter: {
      presentParticipantState: async () => participantState,
    },
    liveSessions: {
      recordParticipantConnection: async () => undefined,
      clearParticipantConnection: async () => undefined,
    },
  })

  const result = events.onClose?.(new CloseEvent('close'), socket)

  expect(result).toBeUndefined()
})

test('participant onClose logs and swallows cleanup failures', async () => {
  const socket = createSocket()
  const consoleError = spyOn(console, 'error').mockImplementation(() => undefined)
  const events = createParticipantConnectionEvents({
    connection: { role: 'participant', participant, quizSession },
    presenter: {
      presentParticipantState: async () => participantState,
    },
    liveSessions: {
      recordParticipantConnection: async () => undefined,
      async clearParticipantConnection() {
        throw new Error('redis unavailable')
      },
    },
  })

  try {
    events.onClose?.(new CloseEvent('close'), socket)
    await flushAsyncWork()

    expect(consoleError).toHaveBeenCalledTimes(1)
    expect(consoleError.mock.calls[0]?.[0]).toBe('Failed to clear participant WebSocket connection')
  } finally {
    consoleError.mockRestore()
  }
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

test('injected runtime handlers receive valid non-ping host and participant events with connection and socket', () => {
  const hostSocket = createSocket()
  const participantSocket = createSocket()
  const handledHostEvents: string[] = []
  const handledParticipantSelections: string[] = []
  const runtimeHandlers: RuntimeHandlers = {
    handleHostEvent(input) {
      expect(input.connection.quizSession.id).toBe(quizSession.id)
      expect(input.socket).toBe(hostSocket)
      handledHostEvents.push(input.event.type)
    },
    handleParticipantEvent(input) {
      expect(input.connection.participant.id).toBe(participant.id)
      expect(input.socket).toBe(participantSocket)
      if (input.event.type === 'submit_answer') {
        handledParticipantSelections.push(input.event.selectedOptionId)
      }
    },
  }
  const hostEvents = createHostConnectionEvents({
    connection: { role: 'host', quizSession },
    presenter: {
      presentHostState: async () => hostState,
    },
    runtimeHandlers,
  })
  const participantEvents = createParticipantConnectionEvents({
    connection: { role: 'participant', participant, quizSession },
    presenter: {
      presentParticipantState: async () => participantState,
    },
    liveSessions: {
      recordParticipantConnection: async () => undefined,
      clearParticipantConnection: async () => undefined,
    },
    runtimeHandlers,
  })

  hostEvents.onMessage?.(new MessageEvent('message', { data: '{"type":"start_quiz"}' }), hostSocket)
  participantEvents.onMessage?.(
    new MessageEvent('message', {
      data: '{"type":"submit_answer","selectedOptionId":"option-1"}',
    }),
    participantSocket,
  )

  expect(handledHostEvents).toEqual(['start_quiz'])
  expect(handledParticipantSelections).toEqual(['option-1'])
  expect(hostSocket.sent).toEqual([])
  expect(participantSocket.sent).toEqual([])
})

test('default valid host runtime event sends not-handled protocol error', () => {
  const socket = createSocket()
  const events = createHostConnectionEvents({
    connection: { role: 'host', quizSession },
    presenter: {
      presentHostState: async () => hostState,
    },
  })

  events.onMessage?.(new MessageEvent('message', { data: '{"type":"start_quiz"}' }), socket)

  expect(parseSent(socket)).toEqual({
    type: 'protocol_error',
    code: 'runtime_not_available',
    message: 'Runtime event handling is not available in this task.',
  })
})

test('rejected host runtime handler sends generic runtime error', async () => {
  const socket = createSocket()
  const consoleError = spyOn(console, 'error').mockImplementation(() => undefined)
  const events = createHostConnectionEvents({
    connection: { role: 'host', quizSession },
    presenter: {
      presentHostState: async () => hostState,
    },
    runtimeHandlers: {
      async handleHostEvent() {
        throw new Error('boom')
      },
      handleParticipantEvent() {
        return undefined
      },
    },
  })

  try {
    events.onMessage?.(new MessageEvent('message', { data: '{"type":"start_quiz"}' }), socket)
    await flushAsyncWork()

    expect(parseSent(socket)).toEqual({
      type: 'runtime_error',
      code: 'command_failed',
      message: 'Runtime command failed.',
    })
    expect(consoleError).toHaveBeenCalledTimes(1)
    expect(consoleError.mock.calls[0]?.[0]).toBe('Runtime event handler failed')
  } finally {
    consoleError.mockRestore()
  }
})

test('synchronous host runtime handler throw sends generic runtime error', async () => {
  const socket = createSocket()
  const consoleError = spyOn(console, 'error').mockImplementation(() => undefined)
  const events = createHostConnectionEvents({
    connection: { role: 'host', quizSession },
    presenter: {
      presentHostState: async () => hostState,
    },
    runtimeHandlers: {
      handleHostEvent() {
        throw new Error('boom')
      },
      handleParticipantEvent() {
        return undefined
      },
    },
  })

  try {
    expect(() =>
      events.onMessage?.(new MessageEvent('message', { data: '{"type":"start_quiz"}' }), socket),
    ).not.toThrow()
    await flushAsyncWork()

    expect(parseSent(socket)).toEqual({
      type: 'runtime_error',
      code: 'command_failed',
      message: 'Runtime command failed.',
    })
    expect(consoleError).toHaveBeenCalledTimes(1)
    expect(consoleError.mock.calls[0]?.[0]).toBe('Runtime event handler failed')
  } finally {
    consoleError.mockRestore()
  }
})

test('rejected host runtime handler does not leak when runtime error send fails', async () => {
  const socket = {
    sent: [] as string[],
    closed: false,
    send() {
      throw new Error('socket unavailable')
    },
    close() {
      this.closed = true
    },
  }
  const consoleError = spyOn(console, 'error').mockImplementation(() => undefined)
  const events = createHostConnectionEvents({
    connection: { role: 'host', quizSession },
    presenter: {
      presentHostState: async () => hostState,
    },
    runtimeHandlers: {
      async handleHostEvent() {
        throw new Error('boom')
      },
      handleParticipantEvent() {
        return undefined
      },
    },
  })

  try {
    events.onMessage?.(new MessageEvent('message', { data: '{"type":"start_quiz"}' }), socket)
    await flushAsyncWork()

    expect(consoleError).toHaveBeenCalledWith('Runtime event handler failed')
    expect(consoleError).toHaveBeenCalledWith('Failed to send runtime error response')
  } finally {
    consoleError.mockRestore()
  }
})

test('default runtime handler send failure does not throw from onMessage', async () => {
  const socket = {
    sent: [] as string[],
    closed: false,
    send() {
      throw new Error('socket unavailable')
    },
    close() {
      this.closed = true
    },
  }
  const consoleError = spyOn(console, 'error').mockImplementation(() => undefined)
  const events = createHostConnectionEvents({
    connection: { role: 'host', quizSession },
    presenter: {
      presentHostState: async () => hostState,
    },
  })

  try {
    expect(() =>
      events.onMessage?.(new MessageEvent('message', { data: '{"type":"start_quiz"}' }), socket),
    ).not.toThrow()
    await flushAsyncWork()

    expect(consoleError).toHaveBeenCalledWith('Runtime event handler failed')
    expect(consoleError).toHaveBeenCalledWith('Failed to send runtime error response')
  } finally {
    consoleError.mockRestore()
  }
})

test('rejected participant runtime handler sends generic runtime error', async () => {
  const socket = createSocket()
  const consoleError = spyOn(console, 'error').mockImplementation(() => undefined)
  const events = createParticipantConnectionEvents({
    connection: { role: 'participant', participant, quizSession },
    presenter: {
      presentParticipantState: async () => participantState,
    },
    liveSessions: {
      recordParticipantConnection: async () => undefined,
      clearParticipantConnection: async () => undefined,
    },
    runtimeHandlers: {
      handleHostEvent() {
        return undefined
      },
      async handleParticipantEvent() {
        throw new Error('boom')
      },
    },
  })

  try {
    events.onMessage?.(
      new MessageEvent('message', {
        data: '{"type":"submit_answer","selectedOptionId":"option-1"}',
      }),
      socket,
    )
    await flushAsyncWork()

    expect(parseSent(socket)).toEqual({
      type: 'runtime_error',
      code: 'command_failed',
      message: 'Runtime command failed.',
    })
    expect(consoleError).toHaveBeenCalledTimes(1)
    expect(consoleError.mock.calls[0]?.[0]).toBe('Runtime event handler failed')
  } finally {
    consoleError.mockRestore()
  }
})

test('Bun server entrypoint exports Hono websocket handler', async () => {
  const source = await readFile(new URL('../../src/index.ts', import.meta.url), 'utf8')

  expect(source).toContain("import { websocket } from 'hono/bun'")
  expect(source).toContain('websocket,')
})

test('default WebSocket routes wire the real persistence worker into the runtime', async () => {
  const source = await readFile(new URL('../../src/ws/connection.ts', import.meta.url), 'utf8')

  expect(source).toContain("import { createPersistenceWorker } from '@/workers/index.js'")
  expect(source).toContain('persistenceSink: createPersistenceWorker()')
  expect(source).not.toContain('persistenceSink: noopPersistenceEventSink')
})
