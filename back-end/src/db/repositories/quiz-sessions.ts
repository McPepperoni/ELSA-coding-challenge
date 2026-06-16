// AI Generated code <PURPOSE>: persist and update quiz sessions
import { type SQL, eq } from 'drizzle-orm'

import { db } from '../client.js'
import {
  type QuizSession,
  type QuizSessionStatus,
  quizSessions,
} from '../schema.js'

export type CreateQuizSessionInput = Readonly<{
  questionSetId: string
  quizCode: string
  hostTokenHash: string
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

    const inserted = (
      await db
        .insert(quizSessions)
        .values({
          questionSetId: input.questionSetId,
          quizCode: input.quizCode.trim(),
          hostTokenHash: input.hostTokenHash.trim(),
        })
        .returning()
    )[0]

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
