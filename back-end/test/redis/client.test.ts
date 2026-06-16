// AI Generated code <PURPOSE>: verify typed Redis client wrapper error behavior
import { expect, test } from 'bun:test'

process.env.REDIS_URL = 'redis://localhost:6379'

const { connectRedis, redisClient, wrapRedisError } = await import('@/redis/client.js')

test('wrapRedisError adds operation context while preserving the original cause', () => {
  const cause = new Error('connection refused')
  const wrapped = wrapRedisError('connect', cause)

  expect(wrapped.message).toBe('Redis operation failed: connect')
  expect(wrapped.cause).toBe(cause)
})

test('connectRedis wraps client connection failures with Redis operation context', async () => {
  const cause = new Error('socket unavailable')
  const client = redisClient as unknown as {
    connect: () => Promise<unknown>
  }
  const originalConnect = client.connect

  client.connect = async () => {
    throw cause
  }

  try {
    await expect(connectRedis()).rejects.toMatchObject({
      message: 'Redis operation failed: connect',
      cause,
    })
  } finally {
    client.connect = originalConnect
  }
})
