// AI Generated code <PURPOSE>: enforce one accepted Redis answer lock per participant question
import { redisClient, wrapRedisError, type RedisClient } from './client.js'

export type QuestionAnswerInput = Readonly<{
  quizSessionId: string
  questionId: string
}>

export type AcceptFirstAnswerInput = QuestionAnswerInput &
  Readonly<{
    participantId: string
  }>

export type HasParticipantAnsweredInput = AcceptFirstAnswerInput

export type ReleaseAnswerInput = AcceptFirstAnswerInput

export type AcceptFirstAnswerResult = Readonly<{
  accepted: boolean
  answeredCount: number
}>

const answeredParticipantsKey = ({ quizSessionId, questionId }: QuestionAnswerInput): string =>
  `quiz:${quizSessionId}:question:${questionId}:answered-participants`

const required = (value: string, field: string): string => {
  if (!value.trim()) {
    throw new Error(`${field} is required`)
  }

  return value
}

const assertQuestionAnswerInput = (input: QuestionAnswerInput): void => {
  required(input.quizSessionId, 'Quiz session id')
  required(input.questionId, 'Question id')
}

export const createAnswerLockRepository = (client: RedisClient = redisClient) => ({
  async acceptFirstAnswer(input: AcceptFirstAnswerInput): Promise<AcceptFirstAnswerResult> {
    try {
      assertQuestionAnswerInput(input)
      required(input.participantId, 'Participant id')

      const [added, answeredCount] = (await client
        .multi()
        .sAdd(answeredParticipantsKey(input), input.participantId)
        .sCard(answeredParticipantsKey(input))
        .exec()) as unknown as [number, number]

      return {
        accepted: added === 1,
        answeredCount,
      }
    } catch (error) {
      throw wrapRedisError('accept first answer', error)
    }
  },

  async readAnsweredCount(input: QuestionAnswerInput): Promise<number> {
    try {
      assertQuestionAnswerInput(input)

      return client.sCard(answeredParticipantsKey(input))
    } catch (error) {
      throw wrapRedisError('read answered count', error)
    }
  },

  async hasParticipantAnswered(input: HasParticipantAnsweredInput): Promise<boolean> {
    try {
      assertQuestionAnswerInput(input)
      required(input.participantId, 'Participant id')

      return (await client.sIsMember(answeredParticipantsKey(input), input.participantId)) === 1
    } catch (error) {
      throw wrapRedisError('read participant answer lock', error)
    }
  },

  async releaseAnswer(input: ReleaseAnswerInput): Promise<void> {
    try {
      assertQuestionAnswerInput(input)
      required(input.participantId, 'Participant id')

      await client.sRem(answeredParticipantsKey(input), input.participantId)
    } catch (error) {
      throw wrapRedisError('release answer lock', error)
    }
  },

  async resetQuestionAnswers(input: QuestionAnswerInput): Promise<void> {
    try {
      assertQuestionAnswerInput(input)

      await client.del(answeredParticipantsKey(input))
    } catch (error) {
      throw wrapRedisError('reset question answers', error)
    }
  },
})

export const answerLockRepository = createAnswerLockRepository()
