// AI Generated code <PURPOSE>: handle WebSocket upgrade routes and socket lifecycle events
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
import type { ServerEvent, SocketRole } from '@/types/events.js'

import {
  authenticateHostSocket,
  authenticateParticipantSocket,
  type HostSocketConnection,
  type ParticipantSocketConnection,
} from './auth.js'
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

export type HostConnectionEventsInput = Readonly<{
  connection: HostSocketConnection
  presenter: Readonly<{
    presentHostState: (quizSession: QuizSession) => Promise<ServerEvent>
  }>
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
  })

export const createHostConnectionEvents = ({
  connection,
  presenter,
}: HostConnectionEventsInput): ConnectionEvents => ({
  onOpen(_event, socket) {
    void sendInitialState(socket, () => presenter.presentHostState(connection.quizSession))
  },

  onMessage(event, socket) {
    handleClientMessage('host', event.data, socket)
  },
})

export const createParticipantConnectionEvents = ({
  connection,
  presenter,
  liveSessions,
}: ParticipantConnectionEventsInput): ConnectionEvents => ({
  onOpen(_event, socket) {
    void sendInitialState(socket, async () => {
      await liveSessions.recordParticipantConnection({
        quizSessionId: connection.quizSession.id,
        participantId: connection.participant.id,
        connectedAt: new Date(),
      })

      return presenter.presentParticipantState(connection.participant, connection.quizSession)
    })
  },

  onMessage(event, socket) {
    handleClientMessage('participant', event.data, socket)
  },

  onClose() {
    void liveSessions
      .clearParticipantConnection({
        quizSessionId: connection.quizSession.id,
        participantId: connection.participant.id,
      })
      .catch((error: unknown) => {
        console.error('Failed to clear participant WebSocket connection', error)
      })
  },
})

const handleClientMessage = (
  role: SocketRole,
  data: MessageEvent['data'],
  socket: ConnectionSocket,
): void => {
  if (typeof data !== 'string') {
    sendEvent(socket, {
      type: 'protocol_error',
      code: 'invalid_event_shape',
      message: 'Message shape is not supported.',
    })
    return
  }

  const result = parseClientEvent(role, data)

  if (!result.ok) {
    sendEvent(socket, result.event)
    return
  }

  if (result.event.type === 'ping') {
    sendEvent(socket, { type: 'pong' })
    return
  }

  sendEvent(socket, {
    type: 'protocol_error',
    code: 'runtime_not_available',
    message: 'Runtime event handling is not available in this task.',
  })
}

const sendInitialState = async (
  socket: ConnectionSocket,
  createEvent: () => Promise<ServerEvent>,
): Promise<void> => {
  try {
    sendEvent(socket, await createEvent())
  } catch {
    sendEvent(socket, {
      type: 'protocol_error',
      code: 'connection_state_unavailable',
      message: 'Connection state is not available.',
    })
    socket.close()
  }
}

const sendEvent = (socket: ConnectionSocket, event: ServerEvent): void => {
  socket.send(serializeServerEvent(event))
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
