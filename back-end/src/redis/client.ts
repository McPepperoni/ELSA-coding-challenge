// AI Generated code <PURPOSE>: provide a typed Redis client boundary for live quiz state
import { createClient } from 'redis'

import { env } from '@/config/env.js'

export type RedisClient = ReturnType<typeof createClient>

export const wrapRedisError = (operation: string, error: unknown): Error =>
  new Error(`Redis operation failed: ${operation}`, { cause: error })

export const redisClient: RedisClient = createClient({
  url: env.REDIS_URL,
})

redisClient.on('error', (error) => {
  console.error(wrapRedisError('client error', error))
})

export const connectRedis = async (): Promise<RedisClient> => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect()
    }

    return redisClient
  } catch (error) {
    throw wrapRedisError('connect', error)
  }
}

export const closeRedis = async (): Promise<void> => {
  try {
    if (redisClient.isOpen) {
      await redisClient.close()
    }
  } catch (error) {
    throw wrapRedisError('close', error)
  }
}
