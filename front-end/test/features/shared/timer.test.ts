// AI Generated code <PURPOSE> verify visual timer helper behavior
import { describe, expect, test } from 'bun:test'
import { getVisualSecondsRemaining } from '../../../src/features/shared'

describe('getVisualSecondsRemaining', () => {
  test('returns rounded-up non-negative seconds remaining from endsAt', () => {
    expect(
      getVisualSecondsRemaining({
        endsAt: '2026-06-17T10:00:05.100Z',
        now: () => new Date('2026-06-17T10:00:00.000Z').getTime(),
      }),
    ).toBe(6)

    expect(
      getVisualSecondsRemaining({
        endsAt: '2026-06-17T10:00:00.000Z',
        now: () => new Date('2026-06-17T10:00:05.000Z').getTime(),
      }),
    ).toBe(0)
  })
})
