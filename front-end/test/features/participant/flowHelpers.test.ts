// AI Generated code <PURPOSE> verify participant flow guard helpers
import { describe, expect, test } from 'bun:test'
import {
  canSubmitParticipantAnswer,
  getSavedParticipantSessionPath,
} from '../../../src/features/participant/flow'
import { createTokenStore } from '../../../src/lib'
import type { ParticipantSessionStateEvent } from '../../../src/types'

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

const activeState: ParticipantSessionStateEvent = {
  type: 'session_state',
  view: 'participant',
  quizSessionId: 'session-1',
  quizCode: 'ABCD12',
  status: 'question_active',
  currentQuestionPosition: 1,
  totalQuestions: 2,
  startedAt: '2026-06-17T10:00:00.000Z',
  endsAt: '2026-06-17T10:00:30.000Z',
  question: {
    id: 'question-1',
    position: 1,
    options: [
      { id: 'option-1', position: 1 },
      { id: 'option-2', position: 2 },
    ],
  },
  hasAnswered: false,
  canSubmit: true,
}

describe('participant flow helpers', () => {
  test('restores a saved participant session only when its private token exists', () => {
    const tokens = createTokenStore(new MemoryStorage())

    tokens.saveParticipantSessionForQuizCode('ABCD12', 'session-1')
    expect(getSavedParticipantSessionPath(tokens, 'ABCD12')).toBeNull()

    tokens.saveParticipantToken('session-1', 'participant-token')
    expect(getSavedParticipantSessionPath(tokens, 'abcd12')).toBe(
      '/participant/session-1',
    )
  })

  test('allows answer submission only for the open unanswered active question', () => {
    expect(
      canSubmitParticipantAnswer({
        state: activeState,
        selectedOptionId: 'option-1',
        isAnswerPending: false,
        acceptedOptionId: null,
      }),
    ).toBe(true)

    const blockedInputs = [
      { selectedOptionId: 'missing-option', isAnswerPending: false, acceptedOptionId: null },
      { selectedOptionId: 'option-1', isAnswerPending: true, acceptedOptionId: null },
      { selectedOptionId: 'option-1', isAnswerPending: false, acceptedOptionId: 'option-1' },
    ] as const

    for (const input of blockedInputs) {
      expect(
        canSubmitParticipantAnswer({
          state: activeState,
          ...input,
        }),
      ).toBe(false)
    }

    expect(
      canSubmitParticipantAnswer({
        state: { ...activeState, hasAnswered: true, canSubmit: false },
        selectedOptionId: 'option-1',
        isAnswerPending: false,
        acceptedOptionId: null,
      }),
    ).toBe(false)
  })
})
