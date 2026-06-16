// AI Generated code <PURPOSE>: verify quiz WebSocket timer scheduling behavior
import { expect, test } from 'bun:test'

import {
  createQuizTimerScheduler,
  type QuizTimerClock,
  type TimerHandle,
} from '@/ws/timers.js'

type FakeTimer = {
  callback: () => void
  cleared: boolean
  delayMs: number
  id: number
}

const createFakeClock = (now: Date): QuizTimerClock & {
  fire(handle: TimerHandle): void
  handles: FakeTimer[]
} => {
  let nextId = 1
  const handles: FakeTimer[] = []

  return {
    handles,
    now: () => now,
    setTimeout: (callback: () => void, delayMs: number): TimerHandle => {
      const handle = { callback, cleared: false, delayMs, id: nextId++ }
      handles.push(handle)
      return handle
    },
    clearTimeout: (handle: TimerHandle): void => {
      const timer = handle as FakeTimer
      timer.cleared = true
    },
    fire: (handle: TimerHandle): void => {
      const timer = handle as FakeTimer
      if (!timer.cleared) {
        timer.callback()
      }
    },
  }
}

test('scheduling uses endsAt-now delay and invokes onExpire with quizSessionId', () => {
  const clock = createFakeClock(new Date('2026-01-01T00:00:00.000Z'))
  const scheduler = createQuizTimerScheduler(clock)
  const expiredSessionIds: string[] = []

  scheduler.scheduleQuestionEnd({
    quizSessionId: 'session-1',
    endsAt: new Date('2026-01-01T00:00:30.000Z'),
    onExpire: (quizSessionId) => {
      expiredSessionIds.push(quizSessionId)
    },
  })

  expect(clock.handles[0]?.delayMs).toBe(30_000)

  clock.fire(clock.handles[0] as TimerHandle)

  expect(expiredSessionIds).toEqual(['session-1'])
})

test('fired question timers are removed before later cancellation', () => {
  const clock = createFakeClock(new Date('2026-01-01T00:00:00.000Z'))
  const scheduler = createQuizTimerScheduler(clock)

  scheduler.scheduleQuestionEnd({
    quizSessionId: 'session-1',
    endsAt: new Date('2026-01-01T00:00:30.000Z'),
    onExpire: () => undefined,
  })

  clock.fire(clock.handles[0] as TimerHandle)
  scheduler.cancelQuestionTimer('session-1')

  expect(clock.handles[0]?.cleared).toBe(false)
})

test('scheduling a replacement timer cancels the previous handle', () => {
  const clock = createFakeClock(new Date('2026-01-01T00:00:00.000Z'))
  const scheduler = createQuizTimerScheduler(clock)
  const expiredSessionIds: string[] = []

  scheduler.scheduleQuestionEnd({
    quizSessionId: 'session-1',
    endsAt: new Date('2026-01-01T00:00:30.000Z'),
    onExpire: (quizSessionId) => {
      expiredSessionIds.push(`first:${quizSessionId}`)
    },
  })
  scheduler.scheduleQuestionEnd({
    quizSessionId: 'session-1',
    endsAt: new Date('2026-01-01T00:00:45.000Z'),
    onExpire: (quizSessionId) => {
      expiredSessionIds.push(`second:${quizSessionId}`)
    },
  })

  expect(clock.handles[0]?.cleared).toBe(true)

  clock.fire(clock.handles[0] as TimerHandle)
  clock.fire(clock.handles[1] as TimerHandle)

  expect(expiredSessionIds).toEqual(['second:session-1'])
})

test('expired question timers schedule with zero delay', () => {
  const clock = createFakeClock(new Date('2026-01-01T00:00:30.000Z'))
  const scheduler = createQuizTimerScheduler(clock)

  scheduler.scheduleQuestionEnd({
    quizSessionId: 'session-1',
    endsAt: new Date('2026-01-01T00:00:05.000Z'),
    onExpire: () => undefined,
  })

  expect(clock.handles[0]?.delayMs).toBe(0)
})

test('cancelQuestionTimer clears one handle and prevents its callback', () => {
  const clock = createFakeClock(new Date('2026-01-01T00:00:00.000Z'))
  const scheduler = createQuizTimerScheduler(clock)
  const expiredSessionIds: string[] = []

  scheduler.scheduleQuestionEnd({
    quizSessionId: 'session-1',
    endsAt: new Date('2026-01-01T00:00:30.000Z'),
    onExpire: (quizSessionId) => {
      expiredSessionIds.push(quizSessionId)
    },
  })
  scheduler.cancelQuestionTimer('session-1')

  expect(clock.handles[0]?.cleared).toBe(true)

  clock.fire(clock.handles[0] as TimerHandle)

  expect(expiredSessionIds).toEqual([])
})

test('cancelAllQuestionTimers clears all handles and prevents callbacks', () => {
  const clock = createFakeClock(new Date('2026-01-01T00:00:00.000Z'))
  const scheduler = createQuizTimerScheduler(clock)
  const expiredSessionIds: string[] = []

  scheduler.scheduleQuestionEnd({
    quizSessionId: 'session-1',
    endsAt: new Date('2026-01-01T00:00:30.000Z'),
    onExpire: (quizSessionId) => {
      expiredSessionIds.push(quizSessionId)
    },
  })
  scheduler.scheduleQuestionEnd({
    quizSessionId: 'session-2',
    endsAt: new Date('2026-01-01T00:00:40.000Z'),
    onExpire: (quizSessionId) => {
      expiredSessionIds.push(quizSessionId)
    },
  })
  scheduler.cancelAllQuestionTimers()

  expect(clock.handles.every((handle) => handle.cleared)).toBe(true)

  clock.fire(clock.handles[0] as TimerHandle)
  clock.fire(clock.handles[1] as TimerHandle)

  expect(expiredSessionIds).toEqual([])
})

test('rejected onExpire is caught and logged', async () => {
  const clock = createFakeClock(new Date('2026-01-01T00:00:00.000Z'))
  const scheduler = createQuizTimerScheduler(clock)
  const error = new Error('expire failed')
  const originalError = console.error
  const logs: unknown[][] = []
  console.error = (...args: unknown[]): void => {
    logs.push(args)
  }

  try {
    scheduler.scheduleQuestionEnd({
      quizSessionId: 'session-1',
      endsAt: new Date('2026-01-01T00:00:30.000Z'),
      onExpire: async () => {
        throw error
      },
    })

    clock.fire(clock.handles[0] as TimerHandle)
    await Promise.resolve()
    await Promise.resolve()

    expect(logs).toEqual([['Question timer expiration failed', error]])
  } finally {
    console.error = originalError
  }
})
