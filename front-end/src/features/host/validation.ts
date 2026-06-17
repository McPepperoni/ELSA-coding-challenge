// AI Generated code <PURPOSE> validate host-authored question set drafts
import type { QuestionSetDraft } from '../../types'

const minTimerSeconds = 5
const maxTimerSeconds = 300
const minOptionCount = 2
const maxOptionCount = 6

export const hostQuestionSetConstraints = {
  minTimerSeconds,
  maxTimerSeconds,
  minOptionCount,
  maxOptionCount,
} as const

export const validateHostQuestionSetDraft = (
  draft: QuestionSetDraft,
): readonly string[] => {
  const errors: string[] = []

  if (!draft.title.trim()) {
    errors.push('Question set title is required.')
  }

  if (!isTimerInRange(draft.defaultTimeLimitSeconds)) {
    errors.push('Default timer must be between 5 and 300 seconds.')
  }

  if (draft.questions.length < 1) {
    errors.push('Add at least one question.')
  }

  draft.questions.forEach((question, questionIndex) => {
    const questionNumber = questionIndex + 1

    if (!question.prompt.trim()) {
      errors.push(`Question ${questionNumber} prompt is required.`)
    }

    if (
      question.timeLimitSeconds !== undefined &&
      !isTimerInRange(question.timeLimitSeconds)
    ) {
      errors.push(
        `Question ${questionNumber} timer must be between 5 and 300 seconds.`,
      )
    }

    if (
      question.options.length < minOptionCount ||
      question.options.length > maxOptionCount
    ) {
      errors.push(
        `Question ${questionNumber} must have between 2 and 6 options.`,
      )
    }

    question.options.forEach((option, optionIndex) => {
      if (!option.text.trim()) {
        errors.push(
          `Question ${questionNumber} option ${optionIndex + 1} text is required.`,
        )
      }
    })

    if (question.options.filter((option) => option.isCorrect).length !== 1) {
      errors.push(`Question ${questionNumber} needs exactly one correct option.`)
    }
  })

  return errors
}

const isTimerInRange = (seconds: number): boolean =>
  Number.isInteger(seconds) &&
  seconds >= minTimerSeconds &&
  seconds <= maxTimerSeconds
