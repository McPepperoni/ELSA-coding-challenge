// AI Generated code <PURPOSE>: compose dependency-injected Hono REST API app
import { Hono } from 'hono'

import type { FullQuestionSet } from '@/db/repositories/question-sets.js'
import type {
  CreateParticipantInput,
  CreateQuestionSetInput,
  CreateQuizSessionInput,
} from '@/db/repositories/index.js'
import type { Participant, QuizSession } from '@/db/schema.js'
import type {
  InitializeLiveSessionInput,
  LiveSessionState,
  UpsertLeaderboardParticipantInput,
  LiveLeaderboardParticipantState,
} from '@/redis/index.js'

import { handleRouteError } from './errors.js'
import { createParticipantRoutes } from './routes/participants.js'
import { createQuestionSetRoutes } from './routes/question-sets.js'
import { createQuizSessionRoutes } from './routes/quiz-sessions.js'
import type { TokenService } from './tokens.js'

export type HttpDependencies = Readonly<{
  questionSets: Readonly<{
    createFullQuestionSet: (input: CreateQuestionSetInput) => Promise<FullQuestionSet>
    findFullQuestionSetById: (id: string) => Promise<FullQuestionSet | null>
  }>
  quizSessions: Readonly<{
    createQuizSession: (input: CreateQuizSessionInput) => Promise<QuizSession>
    findByQuizCode: (quizCode: string) => Promise<QuizSession | null>
    findByHostTokenHash: (hostTokenHash: string) => Promise<QuizSession | null>
    findById: (id: string) => Promise<QuizSession | null>
    deleteQuizSession: (id: string) => Promise<void>
  }>
  participants: Readonly<{
    createParticipant: (input: CreateParticipantInput) => Promise<Participant>
    findByTokenHash: (participantTokenHash: string) => Promise<Participant | null>
    listBySession: (quizSessionId: string) => Promise<Participant[]>
    deleteParticipant: (id: string) => Promise<void>
  }>
  liveSessions: Readonly<{
    initializeLiveSession: (input: InitializeLiveSessionInput) => Promise<LiveSessionState>
  }>
  leaderboard: Readonly<{
    upsertParticipant: (
      input: UpsertLeaderboardParticipantInput,
    ) => Promise<LiveLeaderboardParticipantState>
  }>
  tokenService: TokenService
}>

export const createHttpApp = (dependencies: HttpDependencies): Hono => {
  const app = new Hono()

  app.onError(handleRouteError)

  app.get('/', (c) => c.json({ status: 'ok' }))
  app.route('/api/question-sets', createQuestionSetRoutes(dependencies))
  app.route('/api/quiz-sessions', createQuizSessionRoutes(dependencies))
  app.route('/api/participants', createParticipantRoutes(dependencies))

  return app
}
