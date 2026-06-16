// AI Generated code <PURPOSE>: verify pure quiz validation domain rules
import { expect, test } from 'bun:test'

import {
  DISPLAY_NAME_MAX_LENGTH,
  TIMER_MAX_SECONDS,
  TIMER_MIN_SECONDS,
  validateAnswerSubmission,
  validateParticipantDisplayName,
  validateQuestionSet,
  validateQuizSessionStart,
  validateTimerSeconds,
} from '@/domain/validation.js'

const validQuestionSet = () => ({
  title: 'Launch Quiz',
  defaultTimeLimitSeconds: 30,
  questions: [
    {
      id: 'question-1',
      prompt: 'Which datastore keeps live quiz state?',
      timeLimitSeconds: 20,
      options: [
        { id: 'option-1', text: 'Redis', isCorrect: true },
        { id: 'option-2', text: 'PostgreSQL', isCorrect: false },
      ],
    },
  ],
})

const validAnswerInput = () => ({
  participantId: 'participant-1',
  knownParticipantIds: ['participant-1', 'participant-2'],
  state: 'question_active',
  activeQuestionId: 'question-1',
  questionId: 'question-1',
  selectedOptionId: 'option-1',
  options: [
    { id: 'option-1', isCorrect: true },
    { id: 'option-2', isCorrect: false },
  ],
  alreadyAnsweredParticipantIds: ['participant-2'],
  submittedAt: new Date('2026-01-01T00:00:04.999Z'),
  questionEndsAt: new Date('2026-01-01T00:00:05.000Z'),
})

test('validates integer timer range boundaries', () => {
  expect(validateTimerSeconds(TIMER_MIN_SECONDS)).toEqual({
    ok: true,
    value: TIMER_MIN_SECONDS,
  })
  expect(validateTimerSeconds(TIMER_MAX_SECONDS)).toEqual({
    ok: true,
    value: TIMER_MAX_SECONDS,
  })
  expect(validateTimerSeconds(4, 'defaultTimeLimitSeconds')).toMatchObject({
    ok: false,
    reason: 'timer_out_of_range',
  })
  expect(validateTimerSeconds(30.5)).toMatchObject({
    ok: false,
    reason: 'timer_not_integer',
  })
})

test('normalizes valid participant display names', () => {
  expect(validateParticipantDisplayName('  Ada Lovelace  ')).toEqual({
    ok: true,
    value: 'Ada Lovelace',
  })
})

test('rejects blank and oversized participant display names', () => {
  expect(validateParticipantDisplayName('   ')).toMatchObject({
    ok: false,
    reason: 'display_name_required',
  })
  expect(validateParticipantDisplayName('A'.repeat(DISPLAY_NAME_MAX_LENGTH + 1))).toMatchObject({
    ok: false,
    reason: 'display_name_too_long',
  })
})

test('accepts a valid question set', () => {
  expect(validateQuestionSet(validQuestionSet())).toEqual({
    ok: true,
    value: validQuestionSet(),
  })
})

test('rejects invalid question set structure with reason codes', () => {
  expect(validateQuestionSet({ ...validQuestionSet(), title: ' ' })).toMatchObject({
    ok: false,
    reason: 'question_set_title_required',
  })
  expect(validateQuestionSet({ ...validQuestionSet(), questions: [] })).toMatchObject({
    ok: false,
    reason: 'question_required',
  })
  expect(
    validateQuestionSet({
      ...validQuestionSet(),
      questions: [{ ...validQuestionSet().questions[0], prompt: ' ' }],
    }),
  ).toMatchObject({ ok: false, reason: 'question_prompt_required' })
  expect(
    validateQuestionSet({
      ...validQuestionSet(),
      questions: [{ ...validQuestionSet().questions[0], options: [{ text: 'Only', isCorrect: true }] }],
    }),
  ).toMatchObject({ ok: false, reason: 'option_count_invalid' })
  expect(
    validateQuestionSet({
      ...validQuestionSet(),
      questions: [
        {
          ...validQuestionSet().questions[0],
          options: validQuestionSet().questions[0].options.map((option) => ({
            ...option,
            isCorrect: false,
          })),
        },
      ],
    }),
  ).toMatchObject({ ok: false, reason: 'correct_option_count_invalid' })
  expect(
    validateQuestionSet({
      ...validQuestionSet(),
      questions: [
        {
          ...validQuestionSet().questions[0],
          options: [{ id: 'option-1', text: ' ', isCorrect: true }, { id: 'option-2', text: 'B', isCorrect: false }],
        },
      ],
    }),
  ).toMatchObject({ ok: false, reason: 'option_text_required' })
  expect(
    validateQuestionSet({
      ...validQuestionSet(),
      questions: [{ ...validQuestionSet().questions[0], timeLimitSeconds: 301 }],
    }),
  ).toMatchObject({ ok: false, reason: 'timer_out_of_range' })
})

test('validates quiz session start question order', () => {
  const input = {
    questionIds: ['question-1', 'question-2'],
    questionOrderIds: ['question-2', 'question-1'],
  }

  expect(validateQuizSessionStart(input)).toEqual({ ok: true, value: input.questionOrderIds })
  expect(validateQuizSessionStart({ questionIds: [], questionOrderIds: [] })).toMatchObject({
    ok: false,
    reason: 'session_question_required',
  })
  expect(
    validateQuizSessionStart({
      questionIds: ['question-1', 'question-2'],
      questionOrderIds: ['question-1', 'question-1'],
    }),
  ).toMatchObject({ ok: false, reason: 'question_order_duplicate' })
  expect(
    validateQuizSessionStart({
      questionIds: ['question-1', 'question-2'],
      questionOrderIds: ['question-1'],
    }),
  ).toMatchObject({ ok: false, reason: 'question_order_missing' })
  expect(
    validateQuizSessionStart({
      questionIds: ['question-1'],
      questionOrderIds: ['question-1', 'foreign-question'],
    }),
  ).toMatchObject({ ok: false, reason: 'question_order_foreign' })
})

test('accepts valid answer submissions with selected option correctness', () => {
  expect(validateAnswerSubmission(validAnswerInput())).toEqual({
    ok: true,
    value: { selectedOptionId: 'option-1', isCorrect: true },
  })
})

test('rejects answer submissions with reason-specific errors', () => {
  expect(
    validateAnswerSubmission({ ...validAnswerInput(), participantId: 'unknown-participant' }),
  ).toMatchObject({ ok: false, reason: 'unknown_participant' })
  expect(validateAnswerSubmission({ ...validAnswerInput(), state: 'waiting_room' })).toMatchObject({
    ok: false,
    reason: 'wrong_state',
  })
  expect(validateAnswerSubmission({ ...validAnswerInput(), activeQuestionId: null })).toMatchObject({
    ok: false,
    reason: 'inactive_question',
  })
  expect(validateAnswerSubmission({ ...validAnswerInput(), selectedOptionId: 'missing-option' })).toMatchObject({
    ok: false,
    reason: 'invalid_option',
  })
  expect(
    validateAnswerSubmission({
      ...validAnswerInput(),
      alreadyAnsweredParticipantIds: ['participant-1'],
    }),
  ).toMatchObject({ ok: false, reason: 'duplicate_answer' })
  expect(
    validateAnswerSubmission({
      ...validAnswerInput(),
      submittedAt: new Date('2026-01-01T00:00:05.000Z'),
    }),
  ).toMatchObject({ ok: false, reason: 'late_answer' })
})
