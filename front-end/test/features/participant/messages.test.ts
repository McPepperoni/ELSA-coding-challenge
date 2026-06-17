// AI Generated code <PURPOSE> verify participant answer result messages
import { describe, expect, test } from 'bun:test'
import { formatAnswerResultMessage } from '../../../src/features/participant/messages'
import type { AnswerRejectionReason } from '../../../src/types'

describe('formatAnswerResultMessage', () => {
  test('confirms accepted answers without scoring locally', () => {
    expect(
      formatAnswerResultMessage({
        type: 'answer_result',
        status: 'accepted',
        selectedOptionId: 'option-1',
      }),
    ).toBe('Answer submitted. Waiting for the host.')
  })

  test('maps rejected answer reasons to participant-friendly messages', () => {
    const expected: Record<AnswerRejectionReason, string> = {
      duplicate_answer: 'Your first answer was already submitted.',
      late_answer: 'That answer arrived after the question closed.',
      invalid_option: 'That option is not available for this question.',
      wrong_state: 'Answers are not open right now.',
      inactive_question: 'The active question changed before that answer arrived.',
      unknown_participant: 'This participant session is no longer recognized.',
    }

    for (const [reason, message] of Object.entries(expected)) {
      expect(
        formatAnswerResultMessage({
          type: 'answer_result',
          status: 'rejected',
          selectedOptionId: 'option-1',
          reason: reason as AnswerRejectionReason,
          message: 'Backend wording should not leak into the UI.',
        }),
      ).toBe(message)
    }
  })
})
