// AI Generated code <PURPOSE> verify host question set draft validation
import { describe, expect, test } from 'bun:test'
import { validateHostQuestionSetDraft } from '../../../src/features/host/validation'
import type { QuestionSetDraft } from '../../../src/types'

const validDraft: QuestionSetDraft = {
  title: 'Space basics',
  defaultTimeLimitSeconds: 30,
  questions: [
    {
      prompt: 'Which planet is known as the red planet?',
      timeLimitSeconds: 25,
      options: [
        { text: 'Mars', isCorrect: true },
        { text: 'Venus', isCorrect: false },
      ],
    },
  ],
}

describe('validateHostQuestionSetDraft', () => {
  test('accepts a valid host draft', () => {
    expect(validateHostQuestionSetDraft(validDraft)).toEqual([])
  })

  test('accepts backend maximum 300 second timers', () => {
    expect(
      validateHostQuestionSetDraft({
        ...validDraft,
        defaultTimeLimitSeconds: 300,
        questions: [
          {
            ...validDraft.questions[0],
            timeLimitSeconds: 300,
          },
        ],
      }),
    ).toEqual([])
  })

  test('rejects an empty question set title', () => {
    const errors = validateHostQuestionSetDraft({ ...validDraft, title: '   ' })

    expect(errors).toContain('Question set title is required.')
  })

  test('rejects drafts with no questions', () => {
    const errors = validateHostQuestionSetDraft({
      ...validDraft,
      questions: [],
    })

    expect(errors).toContain('Add at least one question.')
  })

  test('rejects questions with fewer than two or more than six options', () => {
    const tooFew = validateHostQuestionSetDraft({
      ...validDraft,
      questions: [
        {
          ...validDraft.questions[0],
          options: [{ text: 'Mars', isCorrect: true }],
        },
      ],
    })
    const tooMany = validateHostQuestionSetDraft({
      ...validDraft,
      questions: [
        {
          ...validDraft.questions[0],
          options: Array.from({ length: 7 }, (_, index) => ({
            text: `Option ${index + 1}`,
            isCorrect: index === 0,
          })),
        },
      ],
    })

    expect(tooFew).toContain('Question 1 must have between 2 and 6 options.')
    expect(tooMany).toContain('Question 1 must have between 2 and 6 options.')
  })

  test('requires exactly one correct option per question', () => {
    const noCorrect = validateHostQuestionSetDraft({
      ...validDraft,
      questions: [
        {
          ...validDraft.questions[0],
          options: validDraft.questions[0].options.map((option) => ({
            ...option,
            isCorrect: false,
          })),
        },
      ],
    })
    const twoCorrect = validateHostQuestionSetDraft({
      ...validDraft,
      questions: [
        {
          ...validDraft.questions[0],
          options: validDraft.questions[0].options.map((option) => ({
            ...option,
            isCorrect: true,
          })),
        },
      ],
    })

    expect(noCorrect).toContain('Question 1 needs exactly one correct option.')
    expect(twoCorrect).toContain('Question 1 needs exactly one correct option.')
  })

  test('rejects default and question timers outside the allowed range', () => {
    const defaultTimerErrors = validateHostQuestionSetDraft({
      ...validDraft,
      defaultTimeLimitSeconds: 4,
    })
    const questionTimerErrors = validateHostQuestionSetDraft({
      ...validDraft,
      questions: [
        {
          ...validDraft.questions[0],
          timeLimitSeconds: 301,
        },
      ],
    })

    expect(defaultTimerErrors).toContain(
      'Default timer must be between 5 and 300 seconds.',
    )
    expect(questionTimerErrors).toContain(
      'Question 1 timer must be between 5 and 300 seconds.',
    )
  })
})
