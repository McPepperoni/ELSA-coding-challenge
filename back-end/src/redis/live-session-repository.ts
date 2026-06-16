// AI Generated code <PURPOSE>: store active quiz session state in Redis
import type { QuizStatus } from '@/domain/state.js'

import { redisClient, wrapRedisError, type RedisClient } from './client.js'

export type LiveSessionState = Readonly<{
  quizSessionId: string
  status: QuizStatus
  questionOrderIds: readonly string[]
  currentQuestionId: string | null
  currentQuestionPosition: number | null
  startedAt: Date | null
  endsAt: Date | null
}>

export type InitializeLiveSessionInput = Readonly<{
  quizSessionId: string
  questionOrderIds: readonly string[]
}>

export type SetActiveQuestionInput = Readonly<{
  quizSessionId: string
  questionId: string
  questionPosition: number
  startedAt: Date
  endsAt: Date
}>

export type SetQuestionRevealInput = Readonly<{
  quizSessionId: string
  questionId: string
  questionPosition: number
  startedAt: Date
}>

export type ParticipantConnectionInput = Readonly<{
  quizSessionId: string
  participantId: string
  connectionId: string
  connectedAt: Date
}>

export type ClearParticipantConnectionInput = Readonly<{
  quizSessionId: string
  participantId: string
  connectionId: string
}>

type ParticipantConnectionState = Readonly<{
  connectionId: string
  connectedAt: string
}>

const stateKey = (quizSessionId: string): string => `quiz:${quizSessionId}:live:state`
const connectionsKey = (quizSessionId: string): string => `quiz:${quizSessionId}:live:connections`

const required = (value: string, field: string): string => {
  if (!value.trim()) {
    throw new Error(`${field} is required`)
  }

  return value
}

const nullableString = (value: string | undefined): string | null =>
  value === undefined || value === '' ? null : value

const nullableNumber = (value: string | undefined): number | null =>
  value === undefined || value === '' ? null : Number(value)

const nullableDate = (value: string | undefined): Date | null =>
  value === undefined || value === '' ? null : new Date(value)

const parseLiveSession = (
  quizSessionId: string,
  fields: Record<string, string>,
): LiveSessionState | null => {
  if (Object.keys(fields).length === 0) {
    return null
  }

  return {
    quizSessionId,
    status: fields.status as QuizStatus,
    questionOrderIds: JSON.parse(fields.questionOrderIds ?? '[]') as string[],
    currentQuestionId: nullableString(fields.currentQuestionId),
    currentQuestionPosition: nullableNumber(fields.currentQuestionPosition),
    startedAt: nullableDate(fields.startedAt),
    endsAt: nullableDate(fields.endsAt),
  }
}

const serializeParticipantConnection = (
  input: ParticipantConnectionInput,
): string =>
  JSON.stringify({
    connectionId: input.connectionId,
    connectedAt: input.connectedAt.toISOString(),
  } satisfies ParticipantConnectionState)

const clearParticipantConnectionScript = `
local current = redis.call('HGET', KEYS[1], ARGV[1])
if not current then
  return 0
end

local ok, decoded = pcall(cjson.decode, current)
if ok and decoded["connectionId"] == ARGV[2] then
  return redis.call('HDEL', KEYS[1], ARGV[1])
end

return 0
`

type RedisEvalClient = RedisClient & Readonly<{
  eval: (
    script: string,
    options: Readonly<{
      keys: readonly string[]
      arguments: readonly string[]
    }>,
  ) => Promise<unknown>
}>

export const createLiveSessionRepository = (client: RedisClient = redisClient) => {
  const readLiveSession = async (quizSessionId: string): Promise<LiveSessionState | null> => {
    try {
      required(quizSessionId, 'Quiz session id')

      return parseLiveSession(quizSessionId, await client.hGetAll(stateKey(quizSessionId)))
    } catch (error) {
      throw wrapRedisError('read live session', error)
    }
  }

  return {
    async initializeLiveSession(input: InitializeLiveSessionInput): Promise<LiveSessionState> {
    try {
      required(input.quizSessionId, 'Quiz session id')

      if (input.questionOrderIds.length === 0) {
        throw new Error('Question order ids are required')
      }

      await client.hSet(stateKey(input.quizSessionId), {
        status: 'waiting_room',
        questionOrderIds: JSON.stringify([...input.questionOrderIds]),
        currentQuestionId: '',
        currentQuestionPosition: '',
        startedAt: '',
        endsAt: '',
      })

      const initialized = await readLiveSession(input.quizSessionId)
      if (!initialized) {
        throw new Error('Failed to initialize live session state')
      }

      return initialized
    } catch (error) {
      throw wrapRedisError('initialize live session', error)
    }
  },

    readLiveSession,

    async setSessionStatus(quizSessionId: string, status: QuizStatus): Promise<void> {
    try {
      required(quizSessionId, 'Quiz session id')

      await client.hSet(stateKey(quizSessionId), { status })
    } catch (error) {
      throw wrapRedisError('set live session status', error)
    }
    },

    async setActiveQuestion(input: SetActiveQuestionInput): Promise<void> {
    try {
      required(input.quizSessionId, 'Quiz session id')
      required(input.questionId, 'Question id')

      if (!Number.isInteger(input.questionPosition) || input.questionPosition < 1) {
        throw new Error('Question position must be a positive integer')
      }

      await client.hSet(stateKey(input.quizSessionId), {
        status: 'question_active',
        currentQuestionId: input.questionId,
        currentQuestionPosition: String(input.questionPosition),
        startedAt: input.startedAt.toISOString(),
        endsAt: input.endsAt.toISOString(),
      })
    } catch (error) {
      throw wrapRedisError('set active question', error)
    }
    },

    async setQuestionReveal(input: SetQuestionRevealInput): Promise<void> {
    try {
      required(input.quizSessionId, 'Quiz session id')
      required(input.questionId, 'Question id')

      if (!Number.isInteger(input.questionPosition) || input.questionPosition < 1) {
        throw new Error('Question position must be a positive integer')
      }

      await client.hSet(stateKey(input.quizSessionId), {
        status: 'question_reveal',
        currentQuestionId: input.questionId,
        currentQuestionPosition: String(input.questionPosition),
        startedAt: input.startedAt.toISOString(),
        endsAt: '',
      })
    } catch (error) {
      throw wrapRedisError('set question reveal', error)
    }
    },

    async finishLiveSession(quizSessionId: string): Promise<void> {
    try {
      required(quizSessionId, 'Quiz session id')

      await client.hSet(stateKey(quizSessionId), {
        status: 'finished',
        currentQuestionId: '',
        currentQuestionPosition: '',
        startedAt: '',
        endsAt: '',
      })
    } catch (error) {
      throw wrapRedisError('finish live session', error)
    }
    },

    async recordParticipantConnection(input: ParticipantConnectionInput): Promise<void> {
    try {
      required(input.quizSessionId, 'Quiz session id')
      required(input.participantId, 'Participant id')
      required(input.connectionId, 'Connection id')

      await client.hSet(
        connectionsKey(input.quizSessionId),
        input.participantId,
        serializeParticipantConnection(input),
      )
    } catch (error) {
      throw wrapRedisError('record participant connection', error)
    }
    },

    async clearParticipantConnection(input: ClearParticipantConnectionInput): Promise<void> {
    try {
      required(input.quizSessionId, 'Quiz session id')
      required(input.participantId, 'Participant id')
      required(input.connectionId, 'Connection id')

      await (client as RedisEvalClient).eval(clearParticipantConnectionScript, {
        keys: [connectionsKey(input.quizSessionId)],
        arguments: [input.participantId, input.connectionId],
      })
    } catch (error) {
      throw wrapRedisError('clear participant connection', error)
    }
    },

    async readConnectedParticipantIds(quizSessionId: string): Promise<string[]> {
    try {
      required(quizSessionId, 'Quiz session id')

      return Object.keys(await client.hGetAll(connectionsKey(quizSessionId))).sort()
    } catch (error) {
      throw wrapRedisError('read connected participants', error)
    }
    },
  }
}

export const liveSessionRepository = createLiveSessionRepository()
