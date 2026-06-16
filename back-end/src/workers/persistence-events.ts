// AI Generated code <PURPOSE>: define backend persistence event hook contracts
export type AcceptedAnswerPersistenceEvent = Readonly<{
  type: 'accepted_answer'
  quizSessionId: string
  participantId: string
  questionId: string
  selectedOptionId: string
  isCorrect: boolean
  scoreAwarded: number
  submittedAt: Date
}>

export type FinalLeaderboardPersistenceEntry = Readonly<{
  participantId: string
  rank: number
  score: number
  correctAnswerCount: number
  lastCorrectSubmissionAt: Date | null
  joinedAt: Date
}>

export type FinalLeaderboardPersistenceEvent = Readonly<{
  type: 'final_leaderboard'
  quizSessionId: string
  entries: readonly FinalLeaderboardPersistenceEntry[]
  recordedAt: Date
}>

export type PersistenceEvent =
  | AcceptedAnswerPersistenceEvent
  | FinalLeaderboardPersistenceEvent

export type PersistenceEventSink = Readonly<{
  enqueue(event: PersistenceEvent): Promise<void>
}>

export const noopPersistenceEventSink = {
  enqueue: async (_event: PersistenceEvent): Promise<void> => {},
} satisfies PersistenceEventSink
