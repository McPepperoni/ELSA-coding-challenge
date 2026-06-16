// AI Generated code <PURPOSE>: expose participant join and metadata REST routes
import { Hono } from 'hono'

import { validateParticipantDisplayName } from '@/domain/validation.js'

import { httpError } from '../errors.js'
import type { HttpDependencies } from '../app.js'
import { isRecord, readJsonBody, stringField } from '../request.js'
import { serializeParticipant, serializeQuizSession } from '../serializers.js'
import { extractBearerToken } from '../tokens.js'

const requireParticipant = async (dependencies: HttpDependencies, authorizationHeader?: string) => {
  const token = extractBearerToken(authorizationHeader)

  if (!token) {
    throw httpError(401, 'missing_bearer_token', 'Authorization bearer token is required')
  }

  const participant = await dependencies.participants.findByTokenHash(
    dependencies.tokenService.hashToken(token),
  )

  if (!participant) {
    throw httpError(401, 'invalid_participant_token', 'Invalid participant token')
  }

  return participant
}

export const createParticipantRoutes = (dependencies: HttpDependencies): Hono => {
  const app = new Hono()

  app.post('/', async (c) => {
    const body = await readJsonBody(c)
    const record = isRecord(body) ? body : {}
    const quizCode = stringField(record, 'quizCode').trim().toUpperCase()
    const displayName = stringField(record, 'displayName')

    if (!quizCode) {
      throw httpError(400, 'quiz_code_required', 'Quiz code is required')
    }

    const nameValidation = validateParticipantDisplayName(displayName)

    if (!nameValidation.ok) {
      throw httpError(400, nameValidation.reason, nameValidation.message)
    }

    const quizSession = await dependencies.quizSessions.findByQuizCode(quizCode)

    if (!quizSession) {
      throw httpError(404, 'invalid_quiz_code', 'Quiz code was not found')
    }

    if (quizSession.status === 'finished') {
      throw httpError(409, 'quiz_finished', 'Quiz session has finished')
    }

    if (quizSession.status !== 'waiting_room') {
      throw httpError(409, 'quiz_already_started', 'Quiz session has already started')
    }

    const participantToken = dependencies.tokenService.generateToken()
    const participant = await dependencies.participants.createParticipant({
      quizSessionId: quizSession.id,
      displayName: nameValidation.value,
      participantTokenHash: dependencies.tokenService.hashToken(participantToken),
    })

    try {
      await dependencies.leaderboard.upsertParticipant({
        quizSessionId: quizSession.id,
        participantId: participant.id,
        displayName: participant.displayName,
        joinedAt: participant.joinedAt,
      })
    } catch (error) {
      try {
        await dependencies.participants.deleteParticipant(participant.id)
      } catch (cleanupError) {
        console.error(cleanupError)
      }

      throw httpError(
        503,
        'live_membership_unavailable',
        'Participant live membership could not be initialized',
      )
    }

    return c.json(
      {
        participant: serializeParticipant(participant),
        quizSession: serializeQuizSession(quizSession),
        participantToken,
      },
      201,
    )
  })

  app.get('/me', async (c) => {
    const participant = await requireParticipant(dependencies, c.req.header('authorization'))
    const quizSession = await dependencies.quizSessions.findById(participant.quizSessionId)

    if (!quizSession) {
      throw httpError(404, 'quiz_session_not_found', 'Quiz session was not found')
    }

    return c.json({
      participant: serializeParticipant(participant),
      quizSession: serializeQuizSession(quizSession),
    })
  })

  return app
}
