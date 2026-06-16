// AI Generated code <PURPOSE>: expose quiz session creation and host metadata REST routes
import { Hono } from 'hono'

import { validateQuestionSet } from '@/domain/validation.js'

import { httpError } from '../errors.js'
import type { HttpDependencies } from '../app.js'
import { extractBearerToken } from '../tokens.js'
import { isRecord, readJsonBody, stringField } from '../request.js'
import {
  serializeParticipant,
  serializeQuestionSet,
  serializeQuizSession,
} from '../serializers.js'

const MAX_QUIZ_CODE_ATTEMPTS = 10

const isUniqueConstraintError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: unknown }).code === '23505'

const createSessionWithUniqueCode = async (
  dependencies: HttpDependencies,
  questionSetId: string,
) => {
  for (let attempt = 0; attempt < MAX_QUIZ_CODE_ATTEMPTS; attempt += 1) {
    const quizCode = dependencies.tokenService.generateQuizCode()
    const existingSession = await dependencies.quizSessions.findByQuizCode(quizCode)

    if (existingSession) {
      continue
    }

    const hostToken = dependencies.tokenService.generateToken()

    try {
      return {
        quizSession: await dependencies.quizSessions.createQuizSession({
          questionSetId,
          quizCode,
          hostTokenHash: dependencies.tokenService.hashToken(hostToken),
        }),
        hostToken,
      }
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        continue
      }

      throw error
    }
  }

  throw httpError(500, 'quiz_code_generation_failed', 'Could not generate a unique quiz code')
}

const requireHostSession = async (dependencies: HttpDependencies, authorizationHeader?: string) => {
  const token = extractBearerToken(authorizationHeader)

  if (!token) {
    throw httpError(401, 'missing_bearer_token', 'Authorization bearer token is required')
  }

  const session = await dependencies.quizSessions.findByHostTokenHash(
    dependencies.tokenService.hashToken(token),
  )

  if (!session) {
    throw httpError(401, 'invalid_host_token', 'Invalid host control token')
  }

  return session
}

export const createQuizSessionRoutes = (dependencies: HttpDependencies): Hono => {
  const app = new Hono()

  app.post('/', async (c) => {
    const body = await readJsonBody(c)
    const record = isRecord(body) ? body : {}
    const questionSetId = stringField(record, 'questionSetId').trim()

    if (!questionSetId) {
      throw httpError(400, 'question_set_id_required', 'Question set id is required')
    }

    const questionSet = await dependencies.questionSets.findFullQuestionSetById(questionSetId)

    if (!questionSet) {
      throw httpError(404, 'question_set_not_found', 'Question set was not found')
    }

    const validation = validateQuestionSet(questionSet)
    if (!validation.ok) {
      throw httpError(409, validation.reason, validation.message)
    }

    const { quizSession, hostToken } = await createSessionWithUniqueCode(
      dependencies,
      questionSet.id,
    )

    try {
      await dependencies.liveSessions.initializeLiveSession({
        quizSessionId: quizSession.id,
        questionOrderIds: quizSession.questionOrderIds,
      })
    } catch (error) {
      try {
        await dependencies.quizSessions.deleteQuizSession(quizSession.id)
      } catch (cleanupError) {
        console.error(cleanupError)
      }

      throw httpError(
        503,
        'live_state_unavailable',
        'Live session state could not be initialized',
      )
    }

    return c.json(
      {
        quizSession: serializeQuizSession(quizSession),
        hostToken,
      },
      201,
    )
  })

  app.get('/:id/host', async (c) => {
    const routeSessionId = c.req.param('id')
    const quizSession = await requireHostSession(dependencies, c.req.header('authorization'))

    if (quizSession.id !== routeSessionId) {
      throw httpError(403, 'host_token_session_mismatch', 'Host token does not match quiz session')
    }

    const questionSet = await dependencies.questionSets.findFullQuestionSetById(
      quizSession.questionSetId,
    )

    if (!questionSet) {
      throw httpError(404, 'question_set_not_found', 'Question set was not found')
    }

    const participants = await dependencies.participants.listBySession(quizSession.id)

    return c.json({
      quizSession: serializeQuizSession(quizSession),
      participantCount: participants.length,
      participants: participants.map(serializeParticipant),
      questionSet: serializeQuestionSet(questionSet),
    })
  })

  return app
}
