// AI Generated code <PURPOSE>: persist and read full question sets
import { asc, eq, inArray } from 'drizzle-orm'

import { db } from '../client.js'
import {
  answerOptions,
  type AnswerOption,
  type Question,
  questions,
  type QuestionSet,
  questionSets,
} from '../schema.js'

type CreateAnswerOptionInput = Readonly<{
  optionText: string
  isCorrect: boolean
}>

type CreateQuestionInput = Readonly<{
  prompt: string
  timeLimitSeconds?: number | null
  options: readonly CreateAnswerOptionInput[]
}>

export type CreateQuestionSetInput = Readonly<{
  title: string
  defaultTimeLimitSeconds: number
  questions: readonly CreateQuestionInput[]
}>

export type FullQuestion = Question & Readonly<{ options: AnswerOption[] }>
export type FullQuestionSet = QuestionSet & Readonly<{ questions: FullQuestion[] }>

const assertTimer = (value: number, field: string): void => {
  if (!Number.isInteger(value) || value < 5 || value > 300) {
    throw new Error(`${field} must be an integer between 5 and 300`)
  }
}

const assertFullQuestionSetInput = (input: CreateQuestionSetInput): void => {
  if (!input.title.trim()) {
    throw new Error('Question set title is required')
  }

  assertTimer(input.defaultTimeLimitSeconds, 'Default time limit')

  if (input.questions.length < 1) {
    throw new Error('Question set must include at least one question')
  }

  input.questions.forEach((question, questionIndex) => {
    if (!question.prompt.trim()) {
      throw new Error(`Question ${questionIndex + 1} prompt is required`)
    }

    if (question.timeLimitSeconds !== undefined && question.timeLimitSeconds !== null) {
      assertTimer(question.timeLimitSeconds, `Question ${questionIndex + 1} time limit`)
    }

    if (question.options.length < 2 || question.options.length > 6) {
      throw new Error(`Question ${questionIndex + 1} must include two to six options`)
    }

    const correctCount = question.options.filter((option) => option.isCorrect).length

    if (correctCount !== 1) {
      throw new Error(`Question ${questionIndex + 1} must include exactly one correct option`)
    }

    question.options.forEach((option, optionIndex) => {
      if (!option.optionText.trim()) {
        throw new Error(`Question ${questionIndex + 1} option ${optionIndex + 1} text is required`)
      }
    })
  })
}

const requireInserted = <T>(rows: T[], label: string): T => {
  const row = rows[0]

  if (!row) {
    throw new Error(`Failed to insert ${label}`)
  }

  return row
}

const composeFullQuestionSet = (
  questionSet: QuestionSet,
  questionRows: Question[],
  optionRows: AnswerOption[],
): FullQuestionSet => ({
  ...questionSet,
  questions: questionRows.map((question) => ({
    ...question,
    options: optionRows.filter((option) => option.questionId === question.id),
  })),
})

export const questionSetsRepository = {
  async createFullQuestionSet(input: CreateQuestionSetInput): Promise<FullQuestionSet> {
    assertFullQuestionSetInput(input)

    return db.transaction(async (tx) => {
      const insertedQuestionSet = requireInserted(
        await tx
          .insert(questionSets)
          .values({
            title: input.title.trim(),
            defaultTimeLimitSeconds: input.defaultTimeLimitSeconds,
          })
          .returning(),
        'question set',
      )

      const insertedQuestions: Question[] = []
      const insertedOptions: AnswerOption[] = []

      for (const questionInput of input.questions) {
        const insertedQuestion = requireInserted(
          await tx
            .insert(questions)
            .values({
              questionSetId: insertedQuestionSet.id,
              prompt: questionInput.prompt.trim(),
              timeLimitSeconds: questionInput.timeLimitSeconds ?? null,
            })
            .returning(),
          'question',
        )

        insertedQuestions.push(insertedQuestion)

        for (const [optionIndex, optionInput] of questionInput.options.entries()) {
          const insertedOption = requireInserted(
            await tx
              .insert(answerOptions)
              .values({
                questionId: insertedQuestion.id,
                optionText: optionInput.optionText.trim(),
                position: optionIndex + 1,
                isCorrect: optionInput.isCorrect,
              })
              .returning(),
            'answer option',
          )

          insertedOptions.push(insertedOption)
        }
      }

      return composeFullQuestionSet(insertedQuestionSet, insertedQuestions, insertedOptions)
    })
  },

  async findFullQuestionSetById(id: string): Promise<FullQuestionSet | null> {
    return db.transaction(async (tx) => {
      const questionSet = (
        await tx.select().from(questionSets).where(eq(questionSets.id, id)).limit(1)
      )[0]

      if (!questionSet) {
        return null
      }

      const questionRows = await tx
        .select()
        .from(questions)
        .where(eq(questions.questionSetId, id))
        .orderBy(asc(questions.createdAt), asc(questions.id))

      if (questionRows.length === 0) {
        return composeFullQuestionSet(questionSet, [], [])
      }

      const optionRows = await tx
        .select()
        .from(answerOptions)
        .where(
          inArray(
            answerOptions.questionId,
            questionRows.map((question) => question.id),
          ),
        )
        .orderBy(asc(answerOptions.position))

      return composeFullQuestionSet(questionSet, questionRows, optionRows)
    })
  },
}
