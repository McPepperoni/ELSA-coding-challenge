// AI Generated code <PURPOSE>: wire production repositories into REST API dependencies
import {
  participantsRepository,
  questionSetsRepository,
  quizSessionsRepository,
} from '@/db/repositories/index.js'
import { leaderboardRepository, liveSessionRepository } from '@/redis/index.js'

import type { HttpDependencies } from './app.js'
import { defaultTokenService } from './tokens.js'

export const createDefaultHttpDependencies = (): HttpDependencies => ({
  questionSets: questionSetsRepository,
  quizSessions: quizSessionsRepository,
  participants: participantsRepository,
  liveSessions: liveSessionRepository,
  leaderboard: leaderboardRepository,
  tokenService: defaultTokenService,
})
