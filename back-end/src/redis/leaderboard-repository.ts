// AI Generated code <PURPOSE>: store efficient Redis live leaderboard state
import { redisClient, wrapRedisError, type RedisClient } from './client.js'

export type LiveLeaderboardEntry = Readonly<{
  participantId: string
  displayName?: string
  rank: number
  score: number
  correctAnswerCount: number
  lastCorrectSubmissionAt: Date | null
  joinedAt: Date
}>

export type LiveLeaderboardParticipantState = Omit<LiveLeaderboardEntry, 'rank'>

export type UpsertLeaderboardParticipantInput = Readonly<{
  quizSessionId: string
  participantId: string
  displayName?: string
  joinedAt: Date
}>

export type RecordAnswerScoreInput = UpsertLeaderboardParticipantInput &
  Readonly<{
    isCorrect: boolean
    scoreAwarded: number
    submittedAt: Date
  }>

type StoredLeaderboardEntry = Readonly<{
  participantId: string
  displayName?: string
  score: number
  correctAnswerCount: number
  lastCorrectSubmissionAt: string | null
  lastCorrectSubmissionAtMillis: number | null
  joinedAt: string
  joinedAtMillis: number
}>

const MAX_PADDED_MILLIS = '999999999999999'

const leaderboardKey = (quizSessionId: string): string => `quiz:${quizSessionId}:leaderboard`
const participantsKey = (quizSessionId: string): string =>
  `quiz:${quizSessionId}:leaderboard:participants`
const rankMembersKey = (quizSessionId: string): string =>
  `quiz:${quizSessionId}:leaderboard:rank-members`

const required = (value: string, field: string): string => {
  if (!value.trim()) {
    throw new Error(`${field} is required`)
  }

  return value
}

const assertScore = (scoreAwarded: number): void => {
  if (!Number.isInteger(scoreAwarded) || scoreAwarded < 0) {
    throw new Error('Score awarded must be a non-negative integer')
  }
}

const assertAnswerScoreInput = (input: RecordAnswerScoreInput): void => {
  assertScore(input.scoreAwarded)

  if (input.isCorrect && input.scoreAwarded < 1) {
    throw new Error('Correct answers must award a positive score')
  }

  if (!input.isCorrect && input.scoreAwarded !== 0) {
    throw new Error('Incorrect answers must not award score')
  }
}

const participantIdFromRankMember = (member: string): string => {
  const firstSeparator = member.indexOf(':')
  const secondSeparator = member.indexOf(':', firstSeparator + 1)

  return member.slice(secondSeparator + 1)
}

const toLiveEntry = (
  entry: StoredLeaderboardEntry,
  rank: number,
): LiveLeaderboardEntry => ({
  participantId: entry.participantId,
  displayName: entry.displayName,
  rank,
  score: entry.score,
  correctAnswerCount: entry.correctAnswerCount,
  lastCorrectSubmissionAt:
    entry.lastCorrectSubmissionAt === null ? null : new Date(entry.lastCorrectSubmissionAt),
  joinedAt: new Date(entry.joinedAt),
})

const toParticipantState = (
  entry: StoredLeaderboardEntry,
): LiveLeaderboardParticipantState => ({
  participantId: entry.participantId,
  displayName: entry.displayName,
  score: entry.score,
  correctAnswerCount: entry.correctAnswerCount,
  lastCorrectSubmissionAt:
    entry.lastCorrectSubmissionAt === null ? null : new Date(entry.lastCorrectSubmissionAt),
  joinedAt: new Date(entry.joinedAt),
})

const parseStoredEntry = (rawEntry: string | null): StoredLeaderboardEntry | null =>
  rawEntry === null ? null : JSON.parse(rawEntry) as StoredLeaderboardEntry

const upsertLeaderboardScript = `
local leaderboardKey = KEYS[1]
local participantsKey = KEYS[2]
local rankMembersKey = KEYS[3]

local participantId = ARGV[1]
local displayName = ARGV[2]
local joinedAt = ARGV[3]
local joinedAtMillis = tonumber(ARGV[4])
local isCorrect = ARGV[5] == '1'
local scoreAwarded = tonumber(ARGV[6])
local submittedAt = ARGV[7]
local submittedAtMillis = tonumber(ARGV[8])
local maxPaddedMillis = ARGV[9]

local rawEntry = redis.call('HGET', participantsKey, participantId)
local previousMember = redis.call('HGET', rankMembersKey, participantId)
local entry = nil

if rawEntry then
  entry = cjson.decode(rawEntry)
else
  entry = {
    participantId = participantId,
    score = 0,
    correctAnswerCount = 0,
    lastCorrectSubmissionAt = cjson.null,
    lastCorrectSubmissionAtMillis = cjson.null,
    joinedAt = joinedAt,
    joinedAtMillis = joinedAtMillis
  }
end

if displayName ~= '' then
  entry.displayName = displayName
end

entry.score = tonumber(entry.score or 0) + scoreAwarded
entry.correctAnswerCount = tonumber(entry.correctAnswerCount or 0)

if isCorrect then
  entry.correctAnswerCount = entry.correctAnswerCount + 1
  entry.lastCorrectSubmissionAt = submittedAt
  entry.lastCorrectSubmissionAtMillis = submittedAtMillis
end

local function padded(value)
  if value == nil or value == cjson.null then
    return maxPaddedMillis
  end

  local paddedValue = tostring(math.floor(tonumber(value)))
  while string.len(paddedValue) < string.len(maxPaddedMillis) do
    paddedValue = '0' .. paddedValue
  end

  return paddedValue
end

local nextMember = padded(entry.lastCorrectSubmissionAtMillis) .. ':' .. padded(entry.joinedAtMillis) .. ':' .. participantId
if previousMember then
  redis.call('ZREM', leaderboardKey, previousMember)
end

local encodedEntry = cjson.encode(entry)
redis.call('HSET', participantsKey, participantId, encodedEntry)
redis.call('HSET', rankMembersKey, participantId, nextMember)
redis.call('ZADD', leaderboardKey, -entry.score, nextMember)

return encodedEntry
`

export const createLeaderboardRepository = (client: RedisClient = redisClient) => {
  const runAtomicUpsert = async (
    input: RecordAnswerScoreInput,
  ): Promise<StoredLeaderboardEntry> => {
    const rawEntry = await client.eval(upsertLeaderboardScript, {
      keys: [
        leaderboardKey(input.quizSessionId),
        participantsKey(input.quizSessionId),
        rankMembersKey(input.quizSessionId),
      ],
      arguments: [
        input.participantId,
        input.displayName ?? '',
        input.joinedAt.toISOString(),
        String(input.joinedAt.getTime()),
        input.isCorrect ? '1' : '0',
        String(input.scoreAwarded),
        input.submittedAt.toISOString(),
        String(input.submittedAt.getTime()),
        MAX_PADDED_MILLIS,
      ],
    })

    return JSON.parse(String(rawEntry)) as StoredLeaderboardEntry
  }

  const readLeaderboard = async (
    quizSessionId: string,
    limit?: number,
  ): Promise<LiveLeaderboardEntry[]> => {
    try {
      required(quizSessionId, 'Quiz session id')

      if (limit !== undefined) {
        if (!Number.isInteger(limit) || limit < 0) {
          throw new Error('Leaderboard limit must be a non-negative integer')
        }

        if (limit === 0) {
          return []
        }
      }

      const stop = limit === undefined ? -1 : limit - 1
      const orderedMembers = await client.zRange(leaderboardKey(quizSessionId), 0, stop)
      const participantIds = orderedMembers.map(participantIdFromRankMember)
      const rawEntries =
        participantIds.length === 0 ? [] : await client.hmGet(participantsKey(quizSessionId), participantIds)
      const entries: LiveLeaderboardEntry[] = []

      for (const [index, participantId] of participantIds.entries()) {
        const entry = parseStoredEntry(rawEntries[index] ?? null)

        if (!entry) {
          throw new Error(`Missing leaderboard metadata for participant ${participantId}`)
        }

        entries.push(toLiveEntry(entry, entries.length + 1))
      }

      return entries
    } catch (error) {
      throw wrapRedisError('read leaderboard', error)
    }
  }

  return {
    async upsertParticipant(input: UpsertLeaderboardParticipantInput): Promise<LiveLeaderboardParticipantState> {
      try {
        required(input.quizSessionId, 'Quiz session id')
        required(input.participantId, 'Participant id')

        const entry = await runAtomicUpsert({
          ...input,
          isCorrect: false,
          scoreAwarded: 0,
          submittedAt: input.joinedAt,
        })

        return toParticipantState(entry)
      } catch (error) {
        throw wrapRedisError('upsert leaderboard participant', error)
      }
    },

    async recordAnswerScore(input: RecordAnswerScoreInput): Promise<LiveLeaderboardParticipantState> {
      try {
        required(input.quizSessionId, 'Quiz session id')
        required(input.participantId, 'Participant id')
        assertAnswerScoreInput(input)

        return toParticipantState(await runAtomicUpsert(input))
      } catch (error) {
        throw wrapRedisError('record leaderboard score', error)
      }
    },

    readLeaderboard,

    async readTopLeaderboardEntries(
      quizSessionId: string,
      count = 3,
    ): Promise<LiveLeaderboardEntry[]> {
      try {
        if (!Number.isInteger(count) || count < 0) {
          throw new Error('Leaderboard count must be a non-negative integer')
        }

        return readLeaderboard(quizSessionId, count)
      } catch (error) {
        throw wrapRedisError('read top leaderboard entries', error)
      }
    },
  }
}

export const leaderboardRepository = createLeaderboardRepository()
