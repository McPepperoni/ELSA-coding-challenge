// AI Generated code <PURPOSE>: run durable quiz database smoke verification
import { randomUUID } from 'node:crypto'

import { eq } from 'drizzle-orm'

import { closeDb, db } from '@/db/client.js'
import { answerSubmissionsRepository } from '@/db/repositories/answer-submissions.js'
import { finalResultsRepository } from '@/db/repositories/final-results.js'
import { participantsRepository } from '@/db/repositories/participants.js'
import { questionSetsRepository } from '@/db/repositories/question-sets.js'
import { quizSessionsRepository } from '@/db/repositories/quiz-sessions.js'
import { questionSets, quizSessions } from '@/db/schema.js'

const runSmoke = async (): Promise<void> => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()
  const quizCode = `DB${suffix.slice(0, 6)}`
  let questionSetId: string | undefined
  let quizSessionId: string | undefined

  try {
    const questionSet = await questionSetsRepository.createFullQuestionSet({
      title: `Database Smoke ${suffix}`,
      defaultTimeLimitSeconds: 30,
      questions: [
        {
          prompt: 'Which database stores durable quiz data?',
          options: [
            { optionText: 'PostgreSQL', isCorrect: true },
            { optionText: 'Redis', isCorrect: false },
          ],
        },
      ],
    })
    questionSetId = questionSet.id

    const session = await quizSessionsRepository.createQuizSession({
      questionSetId,
      quizCode,
      hostTokenHash: `host-smoke-${suffix}`,
    })
    quizSessionId = session.id

    const participant = await participantsRepository.createParticipant({
      quizSessionId: session.id,
      displayName: 'Smoke Tester',
      participantTokenHash: `participant-smoke-${suffix}`,
    })

    const activeQuestionId = session.questionOrderIds[0]
    const question = questionSet.questions.find((candidate) => candidate.id === activeQuestionId)
    const correctOption = question?.options.find((option) => option.isCorrect)

    if (!activeQuestionId || !question || !correctOption) {
      throw new Error('Smoke question did not include a correct option')
    }

    await answerSubmissionsRepository.insertAcceptedAnswerIdempotently({
      quizSessionId: session.id,
      participantId: participant.id,
      questionId: question.id,
      selectedOptionId: correctOption.id,
      isCorrect: true,
      scoreAwarded: 100,
      submittedAt: new Date(),
    })

    await finalResultsRepository.replaceFinalResults(session.id, [
      {
        participantId: participant.id,
        rank: 1,
        score: 100,
        correctAnswerCount: 1,
        lastCorrectSubmissionAt: new Date(),
        joinedAt: participant.joinedAt,
      },
    ])

    const loadedQuestionSet = await questionSetsRepository.findFullQuestionSetById(questionSet.id)
    const loadedSession = await quizSessionsRepository.findByQuizCode(quizCode)
    const leaderboard = await finalResultsRepository.readLeaderboard(session.id)

    if (!loadedQuestionSet || !loadedSession || leaderboard.length !== 1) {
      throw new Error('Smoke verification did not read all durable records')
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          questionSetId: questionSet.id,
          quizSessionId: session.id,
          questionOrderIds: session.questionOrderIds,
          participantId: participant.id,
          leaderboardRows: leaderboard.length,
        },
        null,
        2,
      ),
    )
  } finally {
    if (quizSessionId) {
      await db.delete(quizSessions).where(eq(quizSessions.id, quizSessionId))
    }

    if (questionSetId) {
      await db.delete(questionSets).where(eq(questionSets.id, questionSetId))
    }
  }
}

try {
  await runSmoke()
} finally {
  await closeDb()
}
