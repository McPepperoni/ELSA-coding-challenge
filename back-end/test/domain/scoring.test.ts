// AI Generated code <PURPOSE>: verify pure quiz answer scoring domain rules
import { expect, test } from 'bun:test'

import {
  CORRECT_ANSWER_POINTS,
  calculateAcceptedAnswerScore,
  calculateRejectedAnswerScore,
} from '@/domain/scoring.js'

test('awards fixed points for a correct accepted answer', () => {
  expect(CORRECT_ANSWER_POINTS).toBe(100)
  expect(calculateAcceptedAnswerScore({ isCorrect: true })).toBe(100)
})

test('awards zero points for an incorrect accepted answer', () => {
  expect(calculateAcceptedAnswerScore({ isCorrect: false })).toBe(0)
})

test('awards zero points for rejected answer reasons', () => {
  const rejectedReasons = [
    'duplicate_answer',
    'late_answer',
    'invalid_option',
    'unknown_participant',
    'wrong_state',
    'inactive_question',
  ] as const

  expect(rejectedReasons.map((reason) => calculateRejectedAnswerScore({ reason }))).toEqual([
    0,
    0,
    0,
    0,
    0,
    0,
  ])
})
