// AI Generated code <PURPOSE>: process persistence events through durable repositories
import {
  answerSubmissionsRepository,
  type InsertAcceptedAnswerInput,
} from '../db/repositories/answer-submissions.js'
import {
  finalResultsRepository,
  type ReplaceFinalResultInput,
} from '../db/repositories/final-results.js'
import type {
  AcceptedAnswerPersistenceEvent,
  FinalLeaderboardPersistenceEvent,
  PersistenceEvent,
  PersistenceEventSink,
} from './persistence-events.js'

type PersistenceWorkerRepositories = Readonly<{
  answerSubmissions: Readonly<{
    insertAcceptedAnswerIdempotently(input: InsertAcceptedAnswerInput): Promise<unknown>
  }>
  finalResults: Readonly<{
    replaceFinalResults(
      quizSessionId: string,
      rows: readonly ReplaceFinalResultInput[],
    ): Promise<unknown>
  }>
}>

type PersistenceWorkerOptions = Readonly<{
  repositories?: PersistenceWorkerRepositories
  delay?: (delayMs: number) => Promise<void>
  logger?: (...args: unknown[]) => void
  retryDelaysMs?: readonly number[]
}>

const defaultRetryDelaysMs = [100, 200, 400, 800, 1600] as const

const defaultRepositories = {
  answerSubmissions: answerSubmissionsRepository,
  finalResults: finalResultsRepository,
} satisfies PersistenceWorkerRepositories

const defaultDelay = async (delayMs: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs)
  })
}

const mapAcceptedAnswer = (
  event: AcceptedAnswerPersistenceEvent,
): InsertAcceptedAnswerInput => ({
  quizSessionId: event.quizSessionId,
  participantId: event.participantId,
  questionId: event.questionId,
  selectedOptionId: event.selectedOptionId,
  isCorrect: event.isCorrect,
  scoreAwarded: event.scoreAwarded,
  submittedAt: event.submittedAt,
})

const mapFinalLeaderboard = (
  event: FinalLeaderboardPersistenceEvent,
): readonly ReplaceFinalResultInput[] =>
  event.entries.map((entry) => ({
    participantId: entry.participantId,
    rank: entry.rank,
    score: entry.score,
    correctAnswerCount: entry.correctAnswerCount,
    lastCorrectSubmissionAt: entry.lastCorrectSubmissionAt,
    joinedAt: entry.joinedAt,
    recordedAt: event.recordedAt,
  }))

const eventContext = (event: PersistenceEvent): Record<string, unknown> => ({
  type: event.type,
  quizSessionId: event.quizSessionId,
  participantId: event.type === 'accepted_answer' ? event.participantId : undefined,
  questionId: event.type === 'accepted_answer' ? event.questionId : undefined,
})

export const createPersistenceWorker = (
  options: PersistenceWorkerOptions = {},
): PersistenceEventSink => {
  const repositories = options.repositories ?? defaultRepositories
  const delay = options.delay ?? defaultDelay
  const logger = options.logger ?? console.error
  const retryDelaysMs = options.retryDelaysMs ?? defaultRetryDelaysMs
  const queue: PersistenceEvent[] = []
  let draining = false

  const writeEvent = async (event: PersistenceEvent): Promise<void> => {
    if (event.type === 'accepted_answer') {
      await repositories.answerSubmissions.insertAcceptedAnswerIdempotently(mapAcceptedAnswer(event))
      return
    }

    await repositories.finalResults.replaceFinalResults(
      event.quizSessionId,
      mapFinalLeaderboard(event),
    )
  }

  const processEvent = async (event: PersistenceEvent): Promise<void> => {
    const totalAttempts = retryDelaysMs.length + 1

    for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
      try {
        await writeEvent(event)
        return
      } catch (error) {
        logger('Persistence event write failed', {
          ...eventContext(event),
          attempt,
          error,
        })

        if (attempt === totalAttempts) {
          logger('Persistence event retries exhausted', {
            ...eventContext(event),
            attempt,
            error,
          })
          return
        }

        await delay(retryDelaysMs[attempt - 1] ?? 0)
      }
    }
  }

  const drain = async (): Promise<void> => {
    if (draining) {
      return
    }

    draining = true
    try {
      while (queue.length > 0) {
        const event = queue.shift()
        if (event) {
          await processEvent(event)
        }
      }
    } finally {
      draining = false
      if (queue.length > 0) {
        void drain()
      }
    }
  }

  return {
    async enqueue(event): Promise<void> {
      queue.push(event)
      void drain()
    },
  }
}
