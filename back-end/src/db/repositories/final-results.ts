// AI Generated code <PURPOSE>: persist and read final quiz leaderboards
import { and, asc, eq, inArray } from 'drizzle-orm'

import { db } from '../client.js'
import { type FinalResult, finalResults, participants } from '../schema.js'

export type ReplaceFinalResultInput = Readonly<{
  participantId: string
  rank: number
  score: number
  correctAnswerCount: number
  lastCorrectSubmissionAt?: Date | null
  joinedAt: Date
  recordedAt?: Date
}>

const assertFinalResultInput = (input: ReplaceFinalResultInput): void => {
  if (!Number.isInteger(input.rank) || input.rank < 1) {
    throw new Error('Final result rank must be a positive integer')
  }

  if (!Number.isInteger(input.score) || input.score < 0) {
    throw new Error('Final result score must be a non-negative integer')
  }

  if (!Number.isInteger(input.correctAnswerCount) || input.correctAnswerCount < 0) {
    throw new Error('Final result correct answer count must be a non-negative integer')
  }
}

export const finalResultsRepository = {
  async replaceFinalResults(
    quizSessionId: string,
    rows: readonly ReplaceFinalResultInput[],
  ): Promise<FinalResult[]> {
    rows.forEach(assertFinalResultInput)

    return db.transaction(async (tx) => {
      if (rows.length > 0) {
        const participantIds = [...new Set(rows.map((row) => row.participantId))]
        const matchingParticipants = await tx
          .select({ id: participants.id })
          .from(participants)
          .where(
            and(
              eq(participants.quizSessionId, quizSessionId),
              inArray(participants.id, participantIds),
            ),
          )
        const matchingParticipantIds = new Set(
          matchingParticipants.map((participant) => participant.id),
        )

        if (participantIds.some((participantId) => !matchingParticipantIds.has(participantId))) {
          throw new Error('Final result participant does not belong to quiz session')
        }
      }

      await tx.delete(finalResults).where(eq(finalResults.quizSessionId, quizSessionId))

      if (rows.length === 0) {
        return []
      }

      await tx.insert(finalResults).values(
        rows.map((row) => ({
          quizSessionId,
          participantId: row.participantId,
          rank: row.rank,
          score: row.score,
          correctAnswerCount: row.correctAnswerCount,
          lastCorrectSubmissionAt: row.lastCorrectSubmissionAt ?? null,
          joinedAt: row.joinedAt,
          recordedAt: row.recordedAt,
        })),
      )

      return tx
        .select()
        .from(finalResults)
        .where(eq(finalResults.quizSessionId, quizSessionId))
        .orderBy(asc(finalResults.rank))
    })
  },

  async readLeaderboard(quizSessionId: string): Promise<FinalResult[]> {
    return db
      .select()
      .from(finalResults)
      .where(eq(finalResults.quizSessionId, quizSessionId))
      .orderBy(asc(finalResults.rank))
  },
}
