// AI Generated code <PURPOSE>: persist accepted answer submissions idempotently
import { and, asc, eq } from 'drizzle-orm'

import { db } from '../client.js'
import {
  type AnswerSubmission,
  answerOptions,
  answerSubmissions,
  participants,
  questions,
  quizSessions,
} from '../schema.js'

export type InsertAcceptedAnswerInput = Readonly<{
  quizSessionId: string
  participantId: string
  questionId: string
  selectedOptionId: string
  isCorrect: boolean
  scoreAwarded: number
  submittedAt: Date
}>

export type IdempotentAnswerSubmissionResult = Readonly<{
  submission: AnswerSubmission
  inserted: boolean
}>

export const answerSubmissionsRepository = {
  async insertAcceptedAnswerIdempotently(
    input: InsertAcceptedAnswerInput,
  ): Promise<IdempotentAnswerSubmissionResult> {
    if (!Number.isInteger(input.scoreAwarded) || input.scoreAwarded < 0) {
      throw new Error('Score awarded must be a non-negative integer')
    }

    return db.transaction(async (tx) => {
      const session = (
        await tx
          .select({ questionSetId: quizSessions.questionSetId })
          .from(quizSessions)
          .where(eq(quizSessions.id, input.quizSessionId))
          .limit(1)
      )[0]

      if (!session) {
        throw new Error('Quiz session does not exist')
      }

      const participant = (
        await tx
          .select({ quizSessionId: participants.quizSessionId })
          .from(participants)
          .where(eq(participants.id, input.participantId))
          .limit(1)
      )[0]

      if (!participant || participant.quizSessionId !== input.quizSessionId) {
        throw new Error('Participant does not belong to quiz session')
      }

      const question = (
        await tx
          .select({ questionSetId: questions.questionSetId })
          .from(questions)
          .where(eq(questions.id, input.questionId))
          .limit(1)
      )[0]

      if (!question || question.questionSetId !== session.questionSetId) {
        throw new Error('Question does not belong to quiz session question set')
      }

      const selectedOption = (
        await tx
          .select({ questionId: answerOptions.questionId, isCorrect: answerOptions.isCorrect })
          .from(answerOptions)
          .where(eq(answerOptions.id, input.selectedOptionId))
          .limit(1)
      )[0]

      if (!selectedOption || selectedOption.questionId !== input.questionId) {
        throw new Error('Selected option does not belong to question')
      }

      if (selectedOption.isCorrect !== input.isCorrect) {
        throw new Error('Answer correctness does not match selected option')
      }

      const inserted = (
        await tx
          .insert(answerSubmissions)
          .values(input)
          .onConflictDoNothing({
            target: [
              answerSubmissions.quizSessionId,
              answerSubmissions.participantId,
              answerSubmissions.questionId,
            ],
          })
          .returning()
      )[0]

      if (inserted) {
        return { submission: inserted, inserted: true }
      }

      const existing = (
        await tx
          .select()
          .from(answerSubmissions)
          .where(
            and(
              eq(answerSubmissions.quizSessionId, input.quizSessionId),
              eq(answerSubmissions.participantId, input.participantId),
              eq(answerSubmissions.questionId, input.questionId),
            ),
          )
          .limit(1)
      )[0]

      if (!existing) {
        throw new Error('Failed to read existing answer submission after conflict')
      }

      if (
        existing.selectedOptionId !== input.selectedOptionId ||
        existing.isCorrect !== input.isCorrect ||
        existing.scoreAwarded !== input.scoreAwarded ||
        existing.submittedAt.getTime() !== input.submittedAt.getTime()
      ) {
        throw new Error('Conflicting accepted answer already exists')
      }

      return { submission: existing, inserted: false }
    })
  },

  async listBySession(quizSessionId: string): Promise<AnswerSubmission[]> {
    return db
      .select()
      .from(answerSubmissions)
      .where(eq(answerSubmissions.quizSessionId, quizSessionId))
      .orderBy(asc(answerSubmissions.submittedAt), asc(answerSubmissions.id))
  },
}
