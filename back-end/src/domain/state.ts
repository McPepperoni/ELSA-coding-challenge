// AI Generated code <PURPOSE>: provide pure quiz state transition domain rules
export const QUIZ_STATUSES = [
  'waiting_room',
  'question_active',
  'question_reveal',
  'finished',
] as const

export type QuizStatus = (typeof QUIZ_STATUSES)[number]

export type QuizState = Readonly<{
  status: QuizStatus
  currentQuestionPosition: number | null
  totalQuestions: number
}>

export type QuizStateTransitionAction =
  | 'start'
  | 'timer_expired'
  | 'next_question'
  | 'finish'

export type StateTransitionErrorReason =
  | 'already_finished'
  | 'no_questions'
  | 'start_requires_waiting_room'
  | 'timer_expired_requires_question_active'
  | 'next_question_requires_question_reveal'
  | 'missing_current_question'
  | 'invalid_current_question_position'

export type StateTransitionResult =
  | Readonly<{ ok: true; state: QuizState }>
  | Readonly<{ ok: false; reason: StateTransitionErrorReason; message: string }>

export type TransitionQuizStateInput = Readonly<{
  state: QuizState
  action: QuizStateTransitionAction
}>

const fail = (
  reason: StateTransitionErrorReason,
  message: string,
): StateTransitionResult => ({
  ok: false,
  reason,
  message,
})

const finishQuiz = (state: QuizState): StateTransitionResult => ({
  ok: true,
  state: {
    ...state,
    status: 'finished',
  },
})

const validateCurrentQuestionPosition = (state: QuizState): StateTransitionResult | null => {
  if (state.currentQuestionPosition === null) {
    return null
  }

  if (
    !Number.isInteger(state.currentQuestionPosition) ||
    state.currentQuestionPosition < 1 ||
    state.currentQuestionPosition > state.totalQuestions
  ) {
    return fail(
      'invalid_current_question_position',
      'Current question position must be an integer within the quiz question range.',
    )
  }

  return null
}

export const transitionQuizState = ({
  state,
  action,
}: TransitionQuizStateInput): StateTransitionResult => {
  if (state.status === 'finished') {
    return fail('already_finished', 'Finished quizzes cannot transition.')
  }

  if (action === 'finish') {
    return finishQuiz(state)
  }

  if (action === 'start') {
    if (state.status !== 'waiting_room') {
      return fail('start_requires_waiting_room', 'Only waiting room quizzes can start.')
    }

    if (state.totalQuestions < 1) {
      return fail('no_questions', 'A quiz requires at least one question to start.')
    }

    return {
      ok: true,
      state: {
        ...state,
        status: 'question_active',
        currentQuestionPosition: 1,
      },
    }
  }

  if (action === 'timer_expired') {
    if (state.status !== 'question_active') {
      return fail('timer_expired_requires_question_active', 'Only active questions can expire.')
    }

    if (state.currentQuestionPosition === null) {
      return fail('missing_current_question', 'An active question requires a current position.')
    }

    const invalidCurrentQuestionPosition = validateCurrentQuestionPosition(state)
    if (invalidCurrentQuestionPosition !== null) {
      return invalidCurrentQuestionPosition
    }

    return {
      ok: true,
      state: {
        ...state,
        status: 'question_reveal',
      },
    }
  }

  if (state.status !== 'question_reveal') {
    return fail('next_question_requires_question_reveal', 'Only revealed questions can advance.')
  }

  if (state.currentQuestionPosition === null) {
    return fail('missing_current_question', 'A revealed question requires a current position.')
  }

  const invalidCurrentQuestionPosition = validateCurrentQuestionPosition(state)
  if (invalidCurrentQuestionPosition !== null) {
    return invalidCurrentQuestionPosition
  }

  if (state.currentQuestionPosition >= state.totalQuestions) {
    return finishQuiz(state)
  }

  return {
    ok: true,
    state: {
      ...state,
      status: 'question_active',
      currentQuestionPosition: state.currentQuestionPosition + 1,
    },
  }
}
