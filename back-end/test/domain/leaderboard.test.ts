// AI Generated code <PURPOSE>: verify pure quiz leaderboard ranking domain rules
import { expect, test } from 'bun:test'

import { rankLeaderboard, selectTopLeaderboardEntries } from '@/domain/leaderboard.js'

const leaderboardEntries = () => [
  {
    participantId: 'participant-late-correct',
    displayName: 'Late Correct',
    score: 200,
    correctAnswerCount: 2,
    lastCorrectSubmissionAt: new Date('2026-01-01T00:00:10.000Z'),
    joinedAt: new Date('2026-01-01T00:00:01.000Z'),
  },
  {
    participantId: 'participant-early-correct',
    displayName: 'Early Correct',
    score: 200,
    correctAnswerCount: 2,
    lastCorrectSubmissionAt: new Date('2026-01-01T00:00:05.000Z'),
    joinedAt: new Date('2026-01-01T00:00:03.000Z'),
  },
  {
    participantId: 'participant-high-score',
    displayName: 'High Score',
    score: 300,
    correctAnswerCount: 3,
    lastCorrectSubmissionAt: new Date('2026-01-01T00:00:30.000Z'),
    joinedAt: new Date('2026-01-01T00:00:04.000Z'),
  },
  {
    participantId: 'participant-early-join',
    score: 100,
    joinedAt: new Date('2026-01-01T00:00:01.000Z'),
  },
  {
    participantId: 'participant-late-join',
    score: 100,
    joinedAt: new Date('2026-01-01T00:00:02.000Z'),
  },
  {
    participantId: 'participant-b',
    score: 50,
    joinedAt: new Date('2026-01-01T00:00:01.000Z'),
  },
  {
    participantId: 'participant-a',
    score: 50,
    joinedAt: new Date('2026-01-01T00:00:01.000Z'),
  },
]

test('ranks leaderboard entries by score and deterministic tie breakers', () => {
  expect(rankLeaderboard(leaderboardEntries()).map((entry) => entry.participantId)).toEqual([
    'participant-high-score',
    'participant-early-correct',
    'participant-late-correct',
    'participant-early-join',
    'participant-late-join',
    'participant-a',
    'participant-b',
  ])
})

test('includes one-based rank in ordered output without mutating input', () => {
  const entries = leaderboardEntries()

  expect(rankLeaderboard(entries).map(({ participantId, rank }) => ({ participantId, rank }))).toEqual([
    { participantId: 'participant-high-score', rank: 1 },
    { participantId: 'participant-early-correct', rank: 2 },
    { participantId: 'participant-late-correct', rank: 3 },
    { participantId: 'participant-early-join', rank: 4 },
    { participantId: 'participant-late-join', rank: 5 },
    { participantId: 'participant-a', rank: 6 },
    { participantId: 'participant-b', rank: 7 },
  ])
  expect(entries[0]?.participantId).toBe('participant-late-correct')
})

test('selects the top N and top three leaderboard entries', () => {
  expect(selectTopLeaderboardEntries(leaderboardEntries(), 3).map((entry) => entry.participantId)).toEqual([
    'participant-high-score',
    'participant-early-correct',
    'participant-late-correct',
  ])
  expect(selectTopLeaderboardEntries(leaderboardEntries()).map((entry) => entry.participantId)).toEqual([
    'participant-high-score',
    'participant-early-correct',
    'participant-late-correct',
  ])
})
