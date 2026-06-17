// AI Generated code <PURPOSE> verify participant join input validation
import { describe, expect, test } from 'bun:test'
import { validateParticipantJoinInput } from '../../../src/features/participant/validation'

describe('validateParticipantJoinInput', () => {
  test('normalizes valid quiz code and display name values', () => {
    const result = validateParticipantJoinInput({
      quizCode: ' ab12cd ',
      displayName: '  Riley  Stone  ',
    })

    expect(result).toEqual({
      ok: true,
      value: {
        quizCode: 'AB12CD',
        displayName: 'Riley Stone',
      },
    })
  })

  test('returns clear errors for missing join values', () => {
    const result = validateParticipantJoinInput({
      quizCode: '',
      displayName: ' ',
    })

    expect(result).toEqual({
      ok: false,
      errors: ['Quiz code is required.', 'Display name is required.'],
    })
  })

  test('rejects unsupported quiz code characters', () => {
    const result = validateParticipantJoinInput({
      quizCode: 'AB-123',
      displayName: 'Riley',
    })

    expect(result).toEqual({
      ok: false,
      errors: ['Quiz code can use letters and numbers only.'],
    })
  })

  test('rejects display names over the backend limit', () => {
    const result = validateParticipantJoinInput({
      quizCode: 'AB1234',
      displayName: 'A'.repeat(41),
    })

    expect(result).toEqual({
      ok: false,
      errors: ['Display name must be 40 characters or fewer.'],
    })
  })
})
