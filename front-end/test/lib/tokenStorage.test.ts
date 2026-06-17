// AI Generated code <PURPOSE> verify token persistence helper behavior
import { describe, expect, test } from 'bun:test'
import { createTokenStore } from '../../src/lib'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

describe('createTokenStore', () => {
  test('saves reads and clears tokens by quiz session id with injected storage', () => {
    const storage = new MemoryStorage()
    const tokens = createTokenStore(storage)

    tokens.saveHostToken('session-1', 'host-token')
    tokens.saveHostToken('session-2', 'other-host-token')
    tokens.saveParticipantToken('session-1', 'participant-token')
    tokens.saveParticipantToken('session-2', 'other-participant-token')

    expect(tokens.readHostToken('session-1')).toBe('host-token')
    expect(tokens.readHostToken('session-2')).toBe('other-host-token')
    expect(tokens.readParticipantToken('session-1')).toBe('participant-token')
    expect(tokens.readParticipantToken('session-2')).toBe(
      'other-participant-token',
    )

    tokens.clearHostToken('session-1')
    tokens.clearParticipantToken('session-1')

    expect(tokens.readHostToken('session-1')).toBeNull()
    expect(tokens.readHostToken('session-2')).toBe('other-host-token')
    expect(tokens.readParticipantToken('session-1')).toBeNull()
    expect(tokens.readParticipantToken('session-2')).toBe(
      'other-participant-token',
    )
  })

  test('saves reads and clears quiz code to participant session mappings', () => {
    const storage = new MemoryStorage()
    const tokens = createTokenStore(storage)

    tokens.saveParticipantSessionForQuizCode(' abcd12 ', 'session-1')

    expect(tokens.readParticipantSessionForQuizCode('ABCD12')).toBe('session-1')
    expect(tokens.readParticipantSessionForQuizCode('abcd12')).toBe('session-1')

    tokens.clearParticipantSessionForQuizCode('ABCD12')

    expect(tokens.readParticipantSessionForQuizCode('ABCD12')).toBeNull()
  })
})
