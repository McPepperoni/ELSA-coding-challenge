// AI Generated code <PURPOSE>: persist and update quiz sessions
import { type SQL, asc, eq } from 'drizzle-orm'

import { db } from '../client.js'
import {
  type QuizSession,
  type QuizSessionStatus,
  questions,
  quizSessions,
} from '../schema.js'

export type CreateQuizSessionInput = Readonly<{
  questionSetId: string
  quizCode: string
  hostTokenHash: string
  questionOrderIds?: readonly string[]
}>

export type UpdateQuizSessionStateInput = Readonly<{
  status?: QuizSessionStatus
  currentQuestionPosition?: number | null
  startedAt?: Date | null
  finishedAt?: Date | null
}>

const findSingleSession = async (
  column: typeof quizSessions.quizCode | typeof quizSessions.hostTokenHash | typeof quizSessions.id,
  value: string,
): Promise<QuizSession | null> => {
  return (await db.select().from(quizSessions).where(eq(column, value)).limit(1))[0] ?? null
}

const assertStateInput = (input: UpdateQuizSessionStateInput): void => {
  if (
    input.currentQuestionPosition !== undefined &&
    input.currentQuestionPosition !== null &&
    (!Number.isInteger(input.currentQuestionPosition) || input.currentQuestionPosition < 1)
  ) {
    throw new Error('Current question position must be a positive integer')
  }
}

const shuffleQuestionIds = (questionIds: readonly string[]): string[] => {
  const shuffled = [...questionIds]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = shuffled[index]

    shuffled[index] = shuffled[swapIndex]
    shuffled[swapIndex] = current
  }

  return shuffled
}

const assertQuestionOrder = (
  questionIds: readonly string[],
  questionOrderIds: readonly string[],
): void => {
  const validQuestionIds = new Set(questionIds)
  const seenQuestionIds = new Set<string>()

  for (const questionId of questionOrderIds) {
    if (seenQuestionIds.has(questionId)) {
      throw new Error('Question order must not contain duplicate question IDs')
    }

    if (!validQuestionIds.has(questionId)) {
      throw new Error('Question order must only contain questions from the session question set')
    }

    seenQuestionIds.add(questionId)
  }

  if (questionOrderIds.length !== questionIds.length || seenQuestionIds.size !== questionIds.length) {
    throw new Error('Question order must include every question exactly once')
  }
}

const updateQuizSessionStateWhere = async (
  predicate: SQL,
  input: UpdateQuizSessionStateInput,
): Promise<QuizSession | null> => {
  assertStateInput(input)

  const updated = (
    await db
      .update(quizSessions)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(predicate)
      .returning()
  )[0]

  return updated ?? null
}

export const quizSessionsRepository = {
  async createQuizSession(input: CreateQuizSessionInput): Promise<QuizSession> {
    if (!input.quizCode.trim()) {
      throw new Error('Quiz code is required')
    }

    if (!input.hostTokenHash.trim()) {
      throw new Error('Host token hash is required')
    }

    const inserted = await db.transaction(async (tx) => {
      const questionRows = await tx
        .select({ id: questions.id })
        .from(questions)
        .where(eq(questions.questionSetId, input.questionSetId))
        .orderBy(asc(questions.createdAt), asc(questions.id))

      const questionIds = questionRows.map((question) => question.id)

      if (questionIds.length === 0) {
        throw new Error('Quiz session question set must include at least one question')
      }

      const questionOrderIds = input.questionOrderIds
        ? [...input.questionOrderIds]
        : shuffleQuestionIds(questionIds)

      assertQuestionOrder(questionIds, questionOrderIds)

      return (
        await tx
          .insert(quizSessions)
          .values({
            questionSetId: input.questionSetId,
            quizCode: input.quizCode.trim(),
            questionOrderIds,
            hostTokenHash: input.hostTokenHash.trim(),
          })
          .returning()
      )[0]
    })

    if (!inserted) {
      throw new Error('Failed to insert quiz session')
    }

    return inserted
  },

  async findByQuizCode(quizCode: string): Promise<QuizSession | null> {
    return findSingleSession(quizSessions.quizCode, quizCode.trim())
  },

  async findByHostTokenHash(hostTokenHash: string): Promise<QuizSession | null> {
    return findSingleSession(quizSessions.hostTokenHash, hostTokenHash.trim())
  },

  async findById(id: string): Promise<QuizSession | null> {
    return findSingleSession(quizSessions.id, id)
  },

  async deleteQuizSession(id: string): Promise<void> {
    await db.delete(quizSessions).where(eq(quizSessions.id, id))
  },

  async replaceQuizSessionQuestionOrder(
    id: string,
    questionOrderIds: readonly string[],
  ): Promise<QuizSession | null> {
    return db.transaction(async (tx) => {
      const session = (await tx.select().from(quizSessions).where(eq(quizSessions.id, id)).limit(1))[0]

      if (!session) {
        return null
      }

      if (session.status !== 'waiting_room') {
        throw new Error('Question order can only be replaced before the quiz starts')
      }

      const questionRows = await tx
        .select({ id: questions.id })
        .from(questions)
        .where(eq(questions.questionSetId, session.questionSetId))
        .orderBy(asc(questions.createdAt), asc(questions.id))
      const questionIds = questionRows.map((question) => question.id)

      assertQuestionOrder(questionIds, questionOrderIds)

      return (
        await tx
          .update(quizSessions)
          .set({
            questionOrderIds: [...questionOrderIds],
            currentQuestionPosition: null,
            updatedAt: new Date(),
          })
          .where(eq(quizSessions.id, id))
          .returning()
      )[0] ?? null
    })
  },

  async updateQuizSessionState(
    id: string,
    input: UpdateQuizSessionStateInput,
  ): Promise<QuizSession | null> {
    return updateQuizSessionStateWhere(eq(quizSessions.id, id), input)
  },

  async updateQuizSessionStateByQuizCode(
    quizCode: string,
    input: UpdateQuizSessionStateInput,
  ): Promise<QuizSession | null> {
    return updateQuizSessionStateWhere(eq(quizSessions.quizCode, quizCode.trim()), input)
  },

  async updateQuizSessionStateByHostTokenHash(
    hostTokenHash: string,
    input: UpdateQuizSessionStateInput,
  ): Promise<QuizSession | null> {
    return updateQuizSessionStateWhere(eq(quizSessions.hostTokenHash, hostTokenHash.trim()), input)
  },
}
