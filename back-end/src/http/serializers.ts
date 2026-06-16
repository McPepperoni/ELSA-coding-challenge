// AI Generated code <PURPOSE>: serialize backend quiz records into REST response payloads
import type { FullQuestionSet } from '@/db/repositories/question-sets.js'
import type { Participant, QuizSession } from '@/db/schema.js'

export const joinPathForQuizCode = (quizCode: string): string => `/join/${quizCode}`

export const serializeQuestionSet = (questionSet: FullQuestionSet) => ({
  id: questionSet.id,
  title: questionSet.title,
  defaultTimeLimitSeconds: questionSet.defaultTimeLimitSeconds,
  createdAt: questionSet.createdAt.toISOString(),
  updatedAt: questionSet.updatedAt.toISOString(),
  questions: questionSet.questions.map((question) => ({
    id: question.id,
    prompt: question.prompt,
    timeLimitSeconds: question.timeLimitSeconds,
    createdAt: question.createdAt.toISOString(),
    options: question.options.map((option) => ({
      id: option.id,
      text: option.optionText,
      position: option.position,
      isCorrect: option.isCorrect,
      createdAt: option.createdAt.toISOString(),
    })),
  })),
})

export const serializeQuizSession = (quizSession: QuizSession) => ({
  id: quizSession.id,
  questionSetId: quizSession.questionSetId,
  quizCode: quizSession.quizCode,
  status: quizSession.status,
  questionOrderIds: quizSession.questionOrderIds,
  currentQuestionPosition: quizSession.currentQuestionPosition,
  joinPath: joinPathForQuizCode(quizSession.quizCode),
  startedAt: quizSession.startedAt?.toISOString() ?? null,
  finishedAt: quizSession.finishedAt?.toISOString() ?? null,
  createdAt: quizSession.createdAt.toISOString(),
  updatedAt: quizSession.updatedAt.toISOString(),
})

export const serializeParticipant = (participant: Participant) => ({
  id: participant.id,
  quizSessionId: participant.quizSessionId,
  displayName: participant.displayName,
  joinedAt: participant.joinedAt.toISOString(),
  lastSeenAt: participant.lastSeenAt?.toISOString() ?? null,
})
