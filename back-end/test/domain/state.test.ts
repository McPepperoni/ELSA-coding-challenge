// AI Generated code <PURPOSE>: verify pure quiz state transition domain rules
import { expect, test } from 'bun:test'

import {
  transitionQuizState,
  type QuizState,
  type QuizStateTransitionAction,
} from '@/domain/state.js'

test('starts a waiting room quiz at the first question when questions exist', () => {
  expect(
    transitionQuizState({
      state: { status: 'waiting_room', currentQuestionPosition: null, totalQuestions: 3 },
      action: 'start',
    }),
  ).toEqual({
    ok: true,
    state: { status: 'question_active', currentQuestionPosition: 1, totalQuestions: 3 },
  })
})

test('rejects start when the quiz has no questions', () => {
  expect(
    transitionQuizState({
      state: { status: 'waiting_room', currentQuestionPosition: null, totalQuestions: 0 },
      action: 'start',
    }),
  ).toMatchObject({
    ok: false,
    reason: 'no_questions',
  })
})

test('reveals the current question when its timer expires', () => {
  expect(
    transitionQuizState({
      state: { status: 'question_active', currentQuestionPosition: 2, totalQuestions: 3 },
      action: 'timer_expired',
    }),
  ).toEqual({
    ok: true,
    state: { status: 'question_reveal', currentQuestionPosition: 2, totalQuestions: 3 },
  })
})

test('advances from reveal to next active question when one remains', () => {
  expect(
    transitionQuizState({
      state: { status: 'question_reveal', currentQuestionPosition: 2, totalQuestions: 3 },
      action: 'next_question',
    }),
  ).toEqual({
    ok: true,
    state: { status: 'question_active', currentQuestionPosition: 3, totalQuestions: 3 },
  })
})

test('finishes from reveal when no question remains', () => {
  expect(
    transitionQuizState({
      state: { status: 'question_reveal', currentQuestionPosition: 3, totalQuestions: 3 },
      action: 'next_question',
    }),
  ).toEqual({
    ok: true,
    state: { status: 'finished', currentQuestionPosition: 3, totalQuestions: 3 },
  })
})

test('finishes early from non-terminal states', () => {
  const states: readonly QuizState[] = [
    { status: 'waiting_room', currentQuestionPosition: null, totalQuestions: 3 },
    { status: 'question_active', currentQuestionPosition: 1, totalQuestions: 3 },
    { status: 'question_reveal', currentQuestionPosition: 1, totalQuestions: 3 },
  ]

  expect(
    states.map((state) => transitionQuizState({ state, action: 'finish' })),
  ).toEqual([
    {
      ok: true,
      state: { status: 'finished', currentQuestionPosition: null, totalQuestions: 3 },
    },
    {
      ok: true,
      state: { status: 'finished', currentQuestionPosition: 1, totalQuestions: 3 },
    },
    {
      ok: true,
      state: { status: 'finished', currentQuestionPosition: 1, totalQuestions: 3 },
    },
  ])
})

test('keeps finished state terminal for every action', () => {
  const state = { status: 'finished', currentQuestionPosition: 3, totalQuestions: 3 } as const
  const actions: readonly QuizStateTransitionAction[] = [
    'start',
    'timer_expired',
    'next_question',
    'finish',
  ]

  expect(
    actions.map((action) => transitionQuizState({ state, action })),
  ).toEqual([
    { ok: false, reason: 'already_finished', message: 'Finished quizzes cannot transition.' },
    { ok: false, reason: 'already_finished', message: 'Finished quizzes cannot transition.' },
    { ok: false, reason: 'already_finished', message: 'Finished quizzes cannot transition.' },
    { ok: false, reason: 'already_finished', message: 'Finished quizzes cannot transition.' },
  ])
})

test('returns wrong-state errors for actions outside their valid flow step', () => {
  expect(
    [
      transitionQuizState({
        state: { status: 'question_reveal', currentQuestionPosition: 1, totalQuestions: 2 },
        action: 'start',
      }),
      transitionQuizState({
        state: { status: 'waiting_room', currentQuestionPosition: null, totalQuestions: 2 },
        action: 'timer_expired',
      }),
      transitionQuizState({
        state: { status: 'question_active', currentQuestionPosition: 1, totalQuestions: 2 },
        action: 'next_question',
      }),
    ],
  ).toEqual([
    { ok: false, reason: 'start_requires_waiting_room', message: 'Only waiting room quizzes can start.' },
    {
      ok: false,
      reason: 'timer_expired_requires_question_active',
      message: 'Only active questions can expire.',
    },
    {
      ok: false,
      reason: 'next_question_requires_question_reveal',
      message: 'Only revealed questions can advance.',
    },
  ])
})

test('rejects timer expiration when active current question position is missing or invalid', () => {
  const states: readonly QuizState[] = [
    { status: 'question_active', currentQuestionPosition: null, totalQuestions: 3 },
    { status: 'question_active', currentQuestionPosition: 0, totalQuestions: 3 },
    { status: 'question_active', currentQuestionPosition: 4, totalQuestions: 3 },
    { status: 'question_active', currentQuestionPosition: 1.5, totalQuestions: 3 },
  ]

  expect(
    states.map((state) => transitionQuizState({ state, action: 'timer_expired' })),
  ).toEqual([
    {
      ok: false,
      reason: 'missing_current_question',
      message: 'An active question requires a current position.',
    },
    {
      ok: false,
      reason: 'invalid_current_question_position',
      message: 'Current question position must be an integer within the quiz question range.',
    },
    {
      ok: false,
      reason: 'invalid_current_question_position',
      message: 'Current question position must be an integer within the quiz question range.',
    },
    {
      ok: false,
      reason: 'invalid_current_question_position',
      message: 'Current question position must be an integer within the quiz question range.',
    },
  ])
})

test('rejects next question when revealed current question position is missing or invalid', () => {
  const states: readonly QuizState[] = [
    { status: 'question_reveal', currentQuestionPosition: null, totalQuestions: 3 },
    { status: 'question_reveal', currentQuestionPosition: 0, totalQuestions: 3 },
    { status: 'question_reveal', currentQuestionPosition: 4, totalQuestions: 3 },
    { status: 'question_reveal', currentQuestionPosition: -1, totalQuestions: 3 },
  ]

  expect(
    states.map((state) => transitionQuizState({ state, action: 'next_question' })),
  ).toEqual([
    {
      ok: false,
      reason: 'missing_current_question',
      message: 'A revealed question requires a current position.',
    },
    {
      ok: false,
      reason: 'invalid_current_question_position',
      message: 'Current question position must be an integer within the quiz question range.',
    },
    {
      ok: false,
      reason: 'invalid_current_question_position',
      message: 'Current question position must be an integer within the quiz question range.',
    },
    {
      ok: false,
      reason: 'invalid_current_question_position',
      message: 'Current question position must be an integer within the quiz question range.',
    },
  ])
})
