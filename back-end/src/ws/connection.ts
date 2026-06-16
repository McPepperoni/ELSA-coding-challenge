// AI Generated code <PURPOSE>: handle WebSocket upgrade routes and socket lifecycle events
import { randomUUID } from 'node:crypto'

import { Hono } from 'hono'
import { upgradeWebSocket } from 'hono/bun'
import type { Context, Handler } from 'hono'
import type { WSContext } from 'hono/ws'

import {
  participantsRepository,
  questionSetsRepository,
  quizSessionsRepository,
} from '@/db/repositories/index.js'
import type { Participant, QuizSession } from '@/db/schema.js'
import { defaultTokenService, type TokenService } from '@/http/tokens.js'
import {
  answerLockRepository,
  leaderboardRepository,
  liveSessionRepository,
  type ClearParticipantConnectionInput,
  type ParticipantConnectionInput,
} from '@/redis/index.js'
import type {
  HostClientEvent,
  ParticipantClientEvent,
  ServerEvent,
} from '@/types/events.js'

import {
  authenticateHostSocket,
  authenticateParticipantSocket,
  type HostSocketConnection,
  type ParticipantSocketConnection,
} from './auth.js'
import defaultSocketHub, { type SocketHub } from './broadcasts.js'
import { parseClientEvent, serializeServerEvent } from './protocol.js'
import {
  createHostStatePresenter,
  createParticipantStatePresenter,
  type StatePresenterDependencies,
} from './state-presenters.js'

export type WebSocketRouteDependencies = StatePresenterDependencies &
  Readonly<{
    tokenService: Pick<TokenService, 'hashToken'>
    quizSessions: Readonly<{
      findByHostTokenHash: (hostTokenHash: string) => Promise<QuizSession | null>
      findById: (id: string) => Promise<QuizSession | null>
    }>
    participants: StatePresenterDependencies['participants'] &
      Readonly<{
        findByTokenHash: (participantTokenHash: string) => Promise<Participant | null>
      }>
    liveSessions: StatePresenterDependencies['liveSessions'] &
      Readonly<{
        recordParticipantConnection: (input: ParticipantConnectionInput) => Promise<void>
        clearParticipantConnection: (input: ClearParticipantConnectionInput) => Promise<void>
      }>
    socketHub?: SocketHub
  }>

export type ConnectionSocket = Pick<WSContext, 'send' | 'close'>

export type ConnectionEvents = Readonly<{
  onOpen?: (event: Event, socket: ConnectionSocket) => void
  onMessage?: (event: MessageEvent, socket: ConnectionSocket) => void
  onClose?: (event: CloseEvent, socket: ConnectionSocket) => void
}>

export type WebSocketUpgrade = (
  createEvents: (c: Context) => ConnectionEvents,
) => Handler

const defaultUpgradeWebSocket: WebSocketUpgrade = (createEvents) => upgradeWebSocket(createEvents)

export type RuntimeHandlers = Readonly<{
  handleHostEvent(input: {
    connection: HostSocketConnection
    event: Exclude<HostClientEvent, { type: 'ping' }>
    socket: ConnectionSocket
  }): void | Promise<void>
  handleParticipantEvent(input: {
    connection: ParticipantSocketConnection
    event: Exclude<ParticipantClientEvent, { type: 'ping' }>
    socket: ConnectionSocket
  }): void | Promise<void>
}>

export type HostConnectionEventsInput = Readonly<{
  connection: HostSocketConnection
  presenter: Readonly<{
    presentHostState: (quizSession: QuizSession) => Promise<ServerEvent>
  }>
  hub?: SocketHub
  runtimeHandlers?: RuntimeHandlers
}>

export type ParticipantConnectionEventsInput = Readonly<{
  connection: ParticipantSocketConnection
  presenter: Readonly<{
    presentParticipantState: (
      participant: Participant,
      quizSession: QuizSession,
    ) => Promise<ServerEvent>
  }>
  liveSessions: Readonly<{
    recordParticipantConnection: (input: ParticipantConnectionInput) => Promise<void>
    clearParticipantConnection: (input: ClearParticipantConnectionInput) => Promise<void>
  }>
  hub?: SocketHub
  runtimeHandlers?: RuntimeHandlers
}>

export const createWebSocketRoutes = (
  dependencies: WebSocketRouteDependencies,
  upgrade: WebSocketUpgrade = defaultUpgradeWebSocket,
): Hono => {
  const app = new Hono()

  app.get('/host', async (c) => {
    const result = await authenticateHostSocket(dependencies, c.req.query('token'))

    if (!result.ok) {
      return unauthorized(c, result.event)
    }

    const presenter = createHostStatePresenter(dependencies)
    const handler = upgrade(() =>
      createHostConnectionEvents({
        connection: result.connection,
        presenter,
        hub: dependencies.socketHub ?? defaultSocketHub,
      }),
    )

    return handler(c, async () => undefined)
  })

  app.get('/participant', async (c) => {
    const result = await authenticateParticipantSocket(dependencies, c.req.query('token'))

    if (!result.ok) {
      return unauthorized(c, result.event)
    }

    const presenter = createParticipantStatePresenter(dependencies)
    const handler = upgrade(() =>
      createParticipantConnectionEvents({
        connection: result.connection,
        presenter,
        liveSessions: dependencies.liveSessions,
        hub: dependencies.socketHub ?? defaultSocketHub,
      }),
    )

    return handler(c, async () => undefined)
  })

  return app
}

export const createDefaultWebSocketRoutes = (): Hono =>
  createWebSocketRoutes({
    tokenService: defaultTokenService,
    quizSessions: quizSessionsRepository,
    participants: participantsRepository,
    questionSets: questionSetsRepository,
    liveSessions: liveSessionRepository,
    answerLocks: answerLockRepository,
    leaderboard: leaderboardRepository,
    socketHub: defaultSocketHub,
  })

export const createHostConnectionEvents = ({
  connection,
  presenter,
  hub = defaultSocketHub,
  runtimeHandlers = defaultRuntimeHandlers,
}: HostConnectionEventsInput): ConnectionEvents => {
  let unregisterSocket: (() => void) | null = null

  return {
    onOpen(_event, socket) {
      void sendInitialState(socket, () => presenter.presentHostState(connection.quizSession)).then(
        (didSendInitialState) => {
          if (didSendInitialState) {
            unregisterSocket = hub.registerHostSocket({
              quizSessionId: connection.quizSession.id,
              socket,
            })
          }
        },
      )
    },

    onMessage(event, socket) {
      handleHostClientMessage(connection, event.data, socket, runtimeHandlers)
    },

    onClose() {
      unregisterSocket?.()
      unregisterSocket = null
    },
  }
}

export const createParticipantConnectionEvents = ({
  connection,
  presenter,
  liveSessions,
  hub = defaultSocketHub,
  runtimeHandlers = defaultRuntimeHandlers,
}: ParticipantConnectionEventsInput): ConnectionEvents => {
  const connectionId = randomUUID()
  let unregisterSocket: (() => void) | null = null

  return {
    onOpen(_event, socket) {
      void sendInitialState(socket, async () => {
        await liveSessions.recordParticipantConnection({
          quizSessionId: connection.quizSession.id,
          participantId: connection.participant.id,
          connectionId,
          connectedAt: new Date(),
        })

        return presenter.presentParticipantState(connection.participant, connection.quizSession)
      }).then((didSendInitialState) => {
        if (didSendInitialState) {
          unregisterSocket = hub.registerParticipantSocket({
            quizSessionId: connection.quizSession.id,
            participantId: connection.participant.id,
            socket,
          })
        }
      })
    },

    onMessage(event, socket) {
      handleParticipantClientMessage(connection, event.data, socket, runtimeHandlers)
    },

    onClose() {
      unregisterSocket?.()
      unregisterSocket = null
      void liveSessions
        .clearParticipantConnection({
          quizSessionId: connection.quizSession.id,
          participantId: connection.participant.id,
          connectionId,
        })
        .catch((error: unknown) => {
          console.error('Failed to clear participant WebSocket connection', error)
        })
    },
  }
}

const defaultRuntimeHandlers: RuntimeHandlers = {
  handleHostEvent({ socket }) {
    sendRuntimeNotAvailable(socket)
  },
  handleParticipantEvent({ socket }) {
    sendRuntimeNotAvailable(socket)
  },
}

const handleHostClientMessage = (
  connection: HostSocketConnection,
  data: MessageEvent['data'],
  socket: ConnectionSocket,
  runtimeHandlers: RuntimeHandlers,
): void => {
  if (typeof data !== 'string') {
    sendEvent(socket, {
      type: 'protocol_error',
      code: 'invalid_event_shape',
      message: 'Message shape is not supported.',
    })
    return
  }

  const result = parseClientEvent('host', data)

  if (!result.ok) {
    sendEvent(socket, result.event)
    return
  }

  if (result.event.type === 'ping') {
    sendEvent(socket, { type: 'pong' })
    return
  }

  void runtimeHandlers.handleHostEvent({
    connection,
    event: result.event,
    socket,
  })
}

const handleParticipantClientMessage = (
  connection: ParticipantSocketConnection,
  data: MessageEvent['data'],
  socket: ConnectionSocket,
  runtimeHandlers: RuntimeHandlers,
): void => {
  if (typeof data !== 'string') {
    sendEvent(socket, {
      type: 'protocol_error',
      code: 'invalid_event_shape',
      message: 'Message shape is not supported.',
    })
    return
  }

  const result = parseClientEvent('participant', data)

  if (!result.ok) {
    sendEvent(socket, result.event)
    return
  }

  if (result.event.type === 'ping') {
    sendEvent(socket, { type: 'pong' })
    return
  }

  void runtimeHandlers.handleParticipantEvent({
    connection,
    event: result.event,
    socket,
  })
}

const sendInitialState = async (
  socket: ConnectionSocket,
  createEvent: () => Promise<ServerEvent>,
): Promise<boolean> => {
  try {
    sendEvent(socket, await createEvent())
    return true
  } catch {
    sendEvent(socket, {
      type: 'protocol_error',
      code: 'connection_state_unavailable',
      message: 'Connection state is not available.',
    })
    socket.close()
    return false
  }
}

const sendEvent = (socket: ConnectionSocket, event: ServerEvent): void => {
  socket.send(serializeServerEvent(event))
}

const sendRuntimeNotAvailable = (socket: ConnectionSocket): void => {
  sendEvent(socket, {
    type: 'protocol_error',
    code: 'runtime_not_available',
    message: 'Runtime event handling is not available in this task.',
  })
}

const unauthorized = (
  c: Context,
  event: ServerEvent & { type: 'protocol_error' },
): Response =>
  c.json(
    {
      error: {
        code: event.code,
        message: event.message,
      },
    },
    401,
  )
