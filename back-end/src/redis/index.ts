// AI Generated code <PURPOSE>: expose Redis live-state infrastructure utilities
export {
  closeRedis,
  connectRedis,
  redisClient,
  wrapRedisError,
  type RedisClient,
} from './client.js'
export {
  answerLockRepository,
  createAnswerLockRepository,
  type AcceptFirstAnswerInput,
  type AcceptFirstAnswerResult,
  type HasParticipantAnsweredInput,
  type QuestionAnswerInput,
} from './answer-lock-repository.js'
export {
  createLeaderboardRepository,
  leaderboardRepository,
  type LiveLeaderboardEntry,
  type LiveLeaderboardParticipantState,
  type RecordAnswerScoreInput,
  type UpsertLeaderboardParticipantInput,
} from './leaderboard-repository.js'
export {
  createLiveSessionRepository,
  liveSessionRepository,
  type ClearParticipantConnectionInput,
  type InitializeLiveSessionInput,
  type LiveSessionState,
  type ParticipantConnectionInput,
  type SetActiveQuestionInput,
} from './live-session-repository.js'
