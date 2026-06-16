// AI Generated code <PURPOSE> share participant flow guard helpers
import type { TokenStore } from '../../lib'
import type { ParticipantSessionStateEvent } from '../../types'

export const getSavedParticipantSessionPath = (
  tokenStore: Pick<
    TokenStore,
    'readParticipantSessionForQuizCode' | 'readParticipantToken'
  >,
  quizCode: string,
): string | null => {
  const quizSessionId = tokenStore.readParticipantSessionForQuizCode(quizCode)

  if (!quizSessionId || !tokenStore.readParticipantToken(quizSessionId)) {
    return null
  }

  return `/participant/${quizSessionId}`
}

export const canSubmitParticipantAnswer = ({
  state,
  selectedOptionId,
  isAnswerPending,
  acceptedOptionId,
}: Readonly<{
  state: ParticipantSessionStateEvent | null
  selectedOptionId: string
  isAnswerPending: boolean
  acceptedOptionId: string | null
}>): boolean =>
  state?.status === 'question_active' &&
  state.question?.options.some((option) => option.id === selectedOptionId) === true &&
  state.hasAnswered !== true &&
  state.canSubmit !== false &&
  !isAnswerPending &&
  acceptedOptionId === null
