// AI Generated code <PURPOSE>: persist quiz participants
import { asc, eq } from 'drizzle-orm'

import { db } from '../client.js'
import { type Participant, participants } from '../schema.js'

export type CreateParticipantInput = Readonly<{
  quizSessionId: string
  displayName: string
  participantTokenHash: string
}>

export const participantsRepository = {
  async createParticipant(input: CreateParticipantInput): Promise<Participant> {
    if (!input.displayName.trim()) {
      throw new Error('Display name is required')
    }

    if (!input.participantTokenHash.trim()) {
      throw new Error('Participant token hash is required')
    }

    const inserted = (
      await db
        .insert(participants)
        .values({
          quizSessionId: input.quizSessionId,
          displayName: input.displayName.trim(),
          participantTokenHash: input.participantTokenHash.trim(),
        })
        .returning()
    )[0]

    if (!inserted) {
      throw new Error('Failed to insert participant')
    }

    return inserted
  },

  async findByTokenHash(participantTokenHash: string): Promise<Participant | null> {
    return (
      (await db
        .select()
        .from(participants)
        .where(eq(participants.participantTokenHash, participantTokenHash.trim()))
        .limit(1))[0] ?? null
    )
  },

  async listBySession(quizSessionId: string): Promise<Participant[]> {
    return db
      .select()
      .from(participants)
      .where(eq(participants.quizSessionId, quizSessionId))
      .orderBy(asc(participants.joinedAt), asc(participants.id))
  },

  async deleteParticipant(id: string): Promise<void> {
    await db.delete(participants).where(eq(participants.id, id))
  },
}
