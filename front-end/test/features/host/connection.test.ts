// AI Generated code <PURPOSE> verify host socket command safety
import { describe, expect, test } from 'bun:test'
import { sendHostCommand } from '../../../src/features/host/connection'

describe('sendHostCommand', () => {
  test('returns an error when the socket is not ready', () => {
    const result = sendHostCommand({
      isSocketReady: false,
      event: { type: 'start_quiz' },
      send: () => {
        throw new Error('send should not run')
      },
    })

    expect(result).toEqual({
      ok: false,
      error: 'Live connection is not ready yet.',
    })
  })

  test('catches socket send failures', () => {
    const result = sendHostCommand({
      isSocketReady: true,
      event: { type: 'finish_quiz' },
      send: () => {
        throw new Error('socket closed')
      },
    })

    expect(result).toEqual({
      ok: false,
      error: 'Command could not be sent. Reconnect and try again.',
    })
  })
})
