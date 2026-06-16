// AI Generated code <PURPOSE>: provide pure quiz leaderboard ranking domain rules
export type LeaderboardEntry = Readonly<{
  participantId: string
  displayName?: string
  score: number
  correctAnswerCount?: number
  lastCorrectSubmissionAt?: Date | null
  joinedAt: Date
}>

export type RankedLeaderboardEntry = LeaderboardEntry &
  Readonly<{
    rank: number
  }>

const nullableDateTime = (date: Date | null | undefined): number => date?.getTime() ?? Number.POSITIVE_INFINITY

const compareLeaderboardEntries = (left: LeaderboardEntry, right: LeaderboardEntry): number =>
  right.score - left.score ||
  nullableDateTime(left.lastCorrectSubmissionAt) - nullableDateTime(right.lastCorrectSubmissionAt) ||
  left.joinedAt.getTime() - right.joinedAt.getTime() ||
  left.participantId.localeCompare(right.participantId)

export const rankLeaderboard = (
  entries: readonly LeaderboardEntry[],
): readonly RankedLeaderboardEntry[] =>
  [...entries]
    .sort(compareLeaderboardEntries)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }))

export const selectTopLeaderboardEntries = (
  entries: readonly LeaderboardEntry[],
  count = 3,
): readonly RankedLeaderboardEntry[] => rankLeaderboard(entries).slice(0, Math.max(0, count))

export const selectTopThreeLeaderboardEntries = (
  entries: readonly LeaderboardEntry[],
): readonly RankedLeaderboardEntry[] => selectTopLeaderboardEntries(entries, 3)
