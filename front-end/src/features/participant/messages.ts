// AI Generated code <PURPOSE> map participant answer results to UI messages
import type { AnswerRejectionReason, AnswerResultEvent } from '../../types'

export const formatAnswerResultMessage = (
  event: AnswerResultEvent,
): string => {
  if (event.status === 'accepted') {
    return 'Answer submitted. Waiting for the host.'
  }

  return answerRejectionMessages[event.reason]
}

const answerRejectionMessages: Record<AnswerRejectionReason, string> = {
  duplicate_answer: 'Your first answer was already submitted.',
  late_answer: 'That answer arrived after the question closed.',
  invalid_option: 'That option is not available for this question.',
  wrong_state: 'Answers are not open right now.',
  inactive_question: 'The active question changed before that answer arrived.',
  unknown_participant: 'This participant session is no longer recognized.',
}
