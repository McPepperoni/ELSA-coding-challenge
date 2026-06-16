// AI Generated code <PURPOSE>: verify durable quiz repository behavior
import { randomUUID } from 'node:crypto'

import { afterAll, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

import { closeDb, db } from '@/db/client.js'
import { answerSubmissionsRepository } from '@/db/repositories/answer-submissions.js'
import { finalResultsRepository } from '@/db/repositories/final-results.js'
import { participantsRepository } from '@/db/repositories/participants.js'
import { questionSetsRepository } from '@/db/repositories/question-sets.js'
import { quizSessionsRepository } from '@/db/repositories/quiz-sessions.js'
import { questionSets, quizSessions } from '@/db/schema.js'

afterAll(async () => {
  await closeDb()
})

type TestBundle = Readonly<{
  questionSetId: string
  quizSessionId: string
  participantId: string
  participantJoinedAt: Date
  questionId: string
  correctOptionId: string
}>

const createTestBundle = async (label: string): Promise<TestBundle> => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()
  const questionSet = await questionSetsRepository.createFullQuestionSet({
    title: `${label} Quiz ${suffix}`,
    defaultTimeLimitSeconds: 30,
    questions: [
      {
        prompt: `${label} durable prompt`,
        options: [
          { optionText: `${label} correct`, isCorrect: true },
          { optionText: `${label} wrong`, isCorrect: false },
        ],
      },
    ],
  })
  const session = await quizSessionsRepository.createQuizSession({
    questionSetId: questionSet.id,
    quizCode: `${label.slice(0, 2).toUpperCase()}${suffix.slice(0, 6)}`,
    hostTokenHash: `host-${label}-${suffix}`,
  })
  const participant = await participantsRepository.createParticipant({
    quizSessionId: session.id,
    displayName: `${label} Participant`,
    participantTokenHash: `participant-${label}-${suffix}`,
  })
  const question = questionSet.questions[0]
  const correctOption = question?.options.find((option) => option.isCorrect)

  if (!question || !correctOption) {
    throw new Error('Test bundle did not create a correct option')
  }

  return {
    questionSetId: questionSet.id,
    quizSessionId: session.id,
    participantId: participant.id,
    participantJoinedAt: participant.joinedAt,
    questionId: question.id,
    correctOptionId: correctOption.id,
  }
}

const cleanupBundles = async (bundles: readonly TestBundle[]): Promise<void> => {
  for (const bundle of bundles) {
    await db.delete(quizSessions).where(eq(quizSessions.id, bundle.quizSessionId))
  }

  for (const bundle of bundles) {
    await db.delete(questionSets).where(eq(questionSets.id, bundle.questionSetId))
  }
}

const expectRejectsWithMessage = async (
  promise: Promise<unknown>,
  expectedMessage: string,
): Promise<void> => {
  let caught: unknown

  try {
    await promise
  } catch (error) {
    caught = error
  }

  expect(caught).toBeInstanceOf(Error)
  expect((caught as Error).message).toBe(expectedMessage)
}

test('persists and reads the durable quiz data flow', async () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()
  const quizCode = `SM${suffix.slice(0, 6)}`
  const hostTokenHash = `host-${suffix}`
  const participantTokenHash = `participant-${suffix}`
  let questionSetId: string | undefined
  let quizSessionId: string | undefined

  try {
    const createdQuestionSet = await questionSetsRepository.createFullQuestionSet({
      title: `Smoke Quiz ${suffix}`,
      defaultTimeLimitSeconds: 30,
      questions: [
        {
          prompt: 'Which datastore keeps durable quiz records?',
          timeLimitSeconds: 45,
          options: [
            { optionText: 'PostgreSQL', isCorrect: true },
            { optionText: 'Redis', isCorrect: false },
          ],
        },
      ],
    })
    questionSetId = createdQuestionSet.id

    expect(createdQuestionSet.questions).toHaveLength(1)
    expect(createdQuestionSet.questions[0]?.position).toBe(1)
    expect(createdQuestionSet.questions[0]?.options).toHaveLength(2)
    expect(createdQuestionSet.questions[0]?.options[0]?.position).toBe(1)

    const loadedQuestionSet = await questionSetsRepository.findFullQuestionSetById(questionSetId)

    expect(loadedQuestionSet?.title).toBe(createdQuestionSet.title)
    expect(loadedQuestionSet?.questions[0]?.options.map((option) => option.optionText)).toEqual([
      'PostgreSQL',
      'Redis',
    ])

    const session = await quizSessionsRepository.createQuizSession({
      questionSetId,
      quizCode,
      hostTokenHash,
    })
    quizSessionId = session.id

    expect(await quizSessionsRepository.findByQuizCode(quizCode)).toMatchObject({
      id: session.id,
      hostTokenHash,
      status: 'waiting_room',
    })
    expect(await quizSessionsRepository.findByHostTokenHash(hostTokenHash)).toMatchObject({
      id: session.id,
    })

    const updatedSession = await quizSessionsRepository.updateQuizSessionState(session.id, {
      status: 'question_active',
      currentQuestionPosition: 1,
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
    })

    expect(updatedSession?.status).toBe('question_active')
    expect(updatedSession?.currentQuestionPosition).toBe(1)

    const updatedByCode = await quizSessionsRepository.updateQuizSessionStateByQuizCode(quizCode, {
      status: 'question_reveal',
    })
    const updatedByHostTokenHash =
      await quizSessionsRepository.updateQuizSessionStateByHostTokenHash(hostTokenHash, {
        status: 'finished',
        finishedAt: new Date('2026-01-01T00:01:00.000Z'),
      })

    expect(updatedByCode?.status).toBe('question_reveal')
    expect(updatedByHostTokenHash?.status).toBe('finished')
    expect(updatedByHostTokenHash?.finishedAt?.toISOString()).toBe('2026-01-01T00:01:00.000Z')

    const participant = await participantsRepository.createParticipant({
      quizSessionId: session.id,
      displayName: 'Ada Lovelace',
      participantTokenHash,
    })

    expect(await participantsRepository.findByTokenHash(participantTokenHash)).toMatchObject({
      id: participant.id,
      displayName: 'Ada Lovelace',
    })
    expect(await participantsRepository.listBySession(session.id)).toHaveLength(1)

    const question = createdQuestionSet.questions[0]
    const selectedOption = question?.options.find((option) => option.isCorrect)

    expect(question).toBeDefined()
    expect(selectedOption).toBeDefined()

    const firstSubmission = await answerSubmissionsRepository.insertAcceptedAnswerIdempotently({
      quizSessionId: session.id,
      participantId: participant.id,
      questionId: question!.id,
      selectedOptionId: selectedOption!.id,
      isCorrect: true,
      scoreAwarded: 100,
      submittedAt: new Date('2026-01-01T00:00:05.000Z'),
    })
    const duplicateSubmission = await answerSubmissionsRepository.insertAcceptedAnswerIdempotently({
      quizSessionId: session.id,
      participantId: participant.id,
      questionId: question!.id,
      selectedOptionId: selectedOption!.id,
      isCorrect: true,
      scoreAwarded: 100,
      submittedAt: new Date('2026-01-01T00:00:05.000Z'),
    })

    expect(firstSubmission.inserted).toBe(true)
    expect(duplicateSubmission.inserted).toBe(false)
    expect(duplicateSubmission.submission.id).toBe(firstSubmission.submission.id)
    expect(await answerSubmissionsRepository.listBySession(session.id)).toHaveLength(1)

    await finalResultsRepository.replaceFinalResults(session.id, [
      {
        participantId: participant.id,
        rank: 1,
        score: 100,
        correctAnswerCount: 1,
        lastCorrectSubmissionAt: new Date('2026-01-01T00:00:05.000Z'),
        joinedAt: participant.joinedAt,
      },
    ])

    expect(await finalResultsRepository.readLeaderboard(session.id)).toMatchObject([
      {
        participantId: participant.id,
        rank: 1,
        score: 100,
        correctAnswerCount: 1,
      },
    ])
  } finally {
    if (quizSessionId) {
      await db.delete(quizSessions).where(eq(quizSessions.id, quizSessionId))
    }

    if (questionSetId) {
      await db.delete(questionSets).where(eq(questionSets.id, questionSetId))
    }
  }
})

test('rejects accepted answers with cross-session or cross-question references', async () => {
  const first = await createTestBundle('first')
  const second = await createTestBundle('second')

  try {
    await expectRejectsWithMessage(
      answerSubmissionsRepository.insertAcceptedAnswerIdempotently({
        quizSessionId: first.quizSessionId,
        participantId: second.participantId,
        questionId: first.questionId,
        selectedOptionId: first.correctOptionId,
        isCorrect: true,
        scoreAwarded: 100,
        submittedAt: new Date('2026-01-01T00:00:05.000Z'),
      }),
      'Participant does not belong to quiz session',
    )

    await expectRejectsWithMessage(
      answerSubmissionsRepository.insertAcceptedAnswerIdempotently({
        quizSessionId: first.quizSessionId,
        participantId: first.participantId,
        questionId: first.questionId,
        selectedOptionId: second.correctOptionId,
        isCorrect: true,
        scoreAwarded: 100,
        submittedAt: new Date('2026-01-01T00:00:05.000Z'),
      }),
      'Selected option does not belong to question',
    )

    await expectRejectsWithMessage(
      answerSubmissionsRepository.insertAcceptedAnswerIdempotently({
        quizSessionId: first.quizSessionId,
        participantId: first.participantId,
        questionId: second.questionId,
        selectedOptionId: second.correctOptionId,
        isCorrect: true,
        scoreAwarded: 100,
        submittedAt: new Date('2026-01-01T00:00:05.000Z'),
      }),
      'Question does not belong to quiz session question set',
    )
  } finally {
    await cleanupBundles([first, second])
  }
})

test('rejects accepted answers when caller correctness disagrees with selected option', async () => {
  const first = await createTestBundle('correctness')
  const questionSet = await questionSetsRepository.findFullQuestionSetById(first.questionSetId)
  const wrongOption = questionSet?.questions[0]?.options.find((option) => !option.isCorrect)

  if (!wrongOption) {
    throw new Error('Correctness test did not create an incorrect option')
  }

  try {
    await expectRejectsWithMessage(
      answerSubmissionsRepository.insertAcceptedAnswerIdempotently({
        quizSessionId: first.quizSessionId,
        participantId: first.participantId,
        questionId: first.questionId,
        selectedOptionId: wrongOption.id,
        isCorrect: true,
        scoreAwarded: 100,
        submittedAt: new Date('2026-01-01T00:00:05.000Z'),
      }),
      'Answer correctness does not match selected option',
    )

    await expectRejectsWithMessage(
      answerSubmissionsRepository.insertAcceptedAnswerIdempotently({
        quizSessionId: first.quizSessionId,
        participantId: first.participantId,
        questionId: first.questionId,
        selectedOptionId: first.correctOptionId,
        isCorrect: false,
        scoreAwarded: 0,
        submittedAt: new Date('2026-01-01T00:00:05.000Z'),
      }),
      'Answer correctness does not match selected option',
    )
  } finally {
    await cleanupBundles([first])
  }
})

test('rejects final leaderboard rows for participants from another session', async () => {
  const first = await createTestBundle('leaderA')
  const second = await createTestBundle('leaderB')

  try {
    await expectRejectsWithMessage(
      finalResultsRepository.replaceFinalResults(first.quizSessionId, [
        {
          participantId: second.participantId,
          rank: 1,
          score: 100,
          correctAnswerCount: 1,
          lastCorrectSubmissionAt: null,
          joinedAt: second.participantJoinedAt,
        },
      ]),
      'Final result participant does not belong to quiz session',
    )
  } finally {
    await cleanupBundles([first, second])
  }
})
