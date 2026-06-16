// AI Generated code <PURPOSE>: provide pure quiz validation domain rules
export const TIMER_MIN_SECONDS = 5
export const TIMER_MAX_SECONDS = 300
export const DISPLAY_NAME_MAX_LENGTH = 40

export type ValidationErrorReason =
  | 'timer_required'
  | 'timer_not_integer'
  | 'timer_out_of_range'
  | 'display_name_required'
  | 'display_name_too_long'
  | 'question_set_title_required'
  | 'question_required'
  | 'question_prompt_required'
  | 'option_count_invalid'
  | 'option_text_required'
  | 'correct_option_count_invalid'
  | 'session_question_required'
  | 'question_order_duplicate'
  | 'question_order_missing'
  | 'question_order_foreign'
  | 'unknown_participant'
  | 'wrong_state'
  | 'inactive_question'
  | 'invalid_option'
  | 'duplicate_answer'
  | 'late_answer'

export type ValidationResult<T = undefined> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; reason: ValidationErrorReason; message: string }>

type ValidationFailure = Extract<ValidationResult, Readonly<{ ok: false }>>

export type QuestionSetOptionInput = Readonly<{
  id?: string
  text?: string
  optionText?: string
  isCorrect: boolean
}>

export type QuestionSetQuestionInput = Readonly<{
  id?: string
  prompt: string
  timeLimitSeconds?: number | null
  options: readonly QuestionSetOptionInput[]
}>

export type QuestionSetInput = Readonly<{
  title: string
  defaultTimeLimitSeconds: number
  questions: readonly QuestionSetQuestionInput[]
}>

export type QuizSessionStartInput = Readonly<{
  questionIds: readonly string[]
  questionOrderIds: readonly string[]
}>

export type AnswerOptionInput = Readonly<{
  id: string
  isCorrect: boolean
}>

export type AnswerSubmissionInput = Readonly<{
  participantId: string
  knownParticipantIds: readonly string[]
  state: string
  activeQuestionId?: string | null
  questionId: string
  selectedOptionId: string
  options: readonly AnswerOptionInput[]
  alreadyAnsweredParticipantIds: readonly string[]
  submittedAt: Date
  questionEndsAt: Date
}>

export type AcceptedAnswer = Readonly<{
  selectedOptionId: string
  isCorrect: boolean
}>

const success = <T>(value: T): ValidationResult<T> => ({ ok: true, value })

const failure = (reason: ValidationErrorReason, message: string): ValidationFailure => ({
  ok: false,
  reason,
  message,
})

export const validateTimerSeconds = (
  value: number | null | undefined,
  field = 'timer',
): ValidationResult<number> => {
  if (value === null || value === undefined) {
    return failure('timer_required', `${field} is required`)
  }

  if (!Number.isInteger(value)) {
    return failure('timer_not_integer', `${field} must be an integer number of seconds`)
  }

  if (value < TIMER_MIN_SECONDS || value > TIMER_MAX_SECONDS) {
    return failure(
      'timer_out_of_range',
      `${field} must be between ${TIMER_MIN_SECONDS} and ${TIMER_MAX_SECONDS} seconds`,
    )
  }

  return success(value)
}

export const validateParticipantDisplayName = (
  displayName: string,
): ValidationResult<string> => {
  const normalizedName = displayName.trim()

  if (normalizedName.length === 0) {
    return failure('display_name_required', 'Display name is required')
  }

  if (normalizedName.length > DISPLAY_NAME_MAX_LENGTH) {
    return failure(
      'display_name_too_long',
      `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer`,
    )
  }

  return success(normalizedName)
}

export const validateQuestionSet = <TInput extends QuestionSetInput>(
  input: TInput,
): ValidationResult<TInput> => {
  if (input.title.trim().length === 0) {
    return failure('question_set_title_required', 'Question set title is required')
  }

  const defaultTimer = validateTimerSeconds(input.defaultTimeLimitSeconds, 'defaultTimeLimitSeconds')
  if (!defaultTimer.ok) {
    return defaultTimer
  }

  if (input.questions.length === 0) {
    return failure('question_required', 'Question set must include at least one question')
  }

  for (const [questionIndex, question] of input.questions.entries()) {
    if (question.prompt.trim().length === 0) {
      return failure('question_prompt_required', `Question ${questionIndex + 1} prompt is required`)
    }

    if (question.timeLimitSeconds !== null && question.timeLimitSeconds !== undefined) {
      const questionTimer = validateTimerSeconds(
        question.timeLimitSeconds,
        `questions[${questionIndex}].timeLimitSeconds`,
      )
      if (!questionTimer.ok) {
        return questionTimer
      }
    }

    if (question.options.length < 2 || question.options.length > 6) {
      return failure('option_count_invalid', 'Questions must include two to six options')
    }

    let correctOptionCount = 0
    for (const [optionIndex, option] of question.options.entries()) {
      const optionText = option.text ?? option.optionText ?? ''
      if (optionText.trim().length === 0) {
        return failure(
          'option_text_required',
          `Question ${questionIndex + 1} option ${optionIndex + 1} text is required`,
        )
      }

      if (option.isCorrect) {
        correctOptionCount += 1
      }
    }

    if (correctOptionCount !== 1) {
      return failure('correct_option_count_invalid', 'Questions must have exactly one correct option')
    }
  }

  return success(input)
}

export const validateQuizSessionStart = ({
  questionIds,
  questionOrderIds,
}: QuizSessionStartInput): ValidationResult<readonly string[]> => {
  if (questionIds.length === 0) {
    return failure('session_question_required', 'Quiz session requires at least one question')
  }

  const orderSet = new Set(questionOrderIds)
  if (orderSet.size !== questionOrderIds.length) {
    return failure('question_order_duplicate', 'Question order must not contain duplicate question IDs')
  }

  const questionSet = new Set(questionIds)
  if (questionOrderIds.some((questionId) => !questionSet.has(questionId))) {
    return failure(
      'question_order_foreign',
      'Question order must only contain IDs from the question set',
    )
  }

  if (questionIds.some((questionId) => !orderSet.has(questionId))) {
    return failure('question_order_missing', 'Question order must contain every question ID')
  }

  return success(questionOrderIds)
}

export const validateAnswerSubmission = ({
  participantId,
  knownParticipantIds,
  state,
  activeQuestionId,
  questionId,
  selectedOptionId,
  options,
  alreadyAnsweredParticipantIds,
  submittedAt,
  questionEndsAt,
}: AnswerSubmissionInput): ValidationResult<AcceptedAnswer> => {
  if (!knownParticipantIds.includes(participantId)) {
    return failure('unknown_participant', 'Participant is not known for this session')
  }

  if (state !== 'question_active') {
    return failure('wrong_state', 'Answers are only accepted while a question is active')
  }

  if (!activeQuestionId || activeQuestionId !== questionId) {
    return failure('inactive_question', 'Submitted answer does not target the active question')
  }

  const selectedOption = options.find((option) => option.id === selectedOptionId)
  if (!selectedOption) {
    return failure('invalid_option', 'Selected option does not belong to the active question')
  }

  if (alreadyAnsweredParticipantIds.includes(participantId)) {
    return failure('duplicate_answer', 'Participant has already answered this question')
  }

  if (submittedAt.getTime() >= questionEndsAt.getTime()) {
    return failure('late_answer', 'Answer was submitted after the question timer ended')
  }

  return success({ selectedOptionId: selectedOption.id, isCorrect: selectedOption.isCorrect })
}
