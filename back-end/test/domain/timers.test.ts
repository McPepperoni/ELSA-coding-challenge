// AI Generated code <PURPOSE>: verify pure quiz timer domain helpers
import { expect, test } from 'bun:test'

import {
  createQuestionTimerWindow,
  resolveQuestionTimerSeconds,
} from '@/domain/timers.js'

test('resolves question timer from question override before default', () => {
  expect(
    resolveQuestionTimerSeconds({
      defaultTimeLimitSeconds: 30,
      questionTimeLimitSeconds: 45,
    }),
  ).toBe(45)
})

test('resolves question timer from default when override is absent', () => {
  expect(
    resolveQuestionTimerSeconds({
      defaultTimeLimitSeconds: 30,
    }),
  ).toBe(30)
})

test('creates timer window with inclusive start and exclusive end instant', () => {
  const startedAt = new Date('2026-01-01T00:00:00.000Z')

  expect(createQuestionTimerWindow({ startedAt, durationSeconds: 5 })).toEqual({
    startedAt,
    endsAt: new Date('2026-01-01T00:00:05.000Z'),
    durationSeconds: 5,
  })
})
