// AI Generated code <PURPOSE>: provide pure quiz answer scoring domain rules
export const CORRECT_ANSWER_POINTS = 100

export type AcceptedAnswerScoreInput = Readonly<{
  isCorrect: boolean
}>

export type RejectedAnswerScoreReason =
  | 'duplicate_answer'
  | 'late_answer'
  | 'invalid_option'
  | 'unknown_participant'
  | 'wrong_state'

export type RejectedAnswerScoreInput = Readonly<{
  reason: RejectedAnswerScoreReason
}>

export const calculateAcceptedAnswerScore = ({ isCorrect }: AcceptedAnswerScoreInput): number =>
  isCorrect ? CORRECT_ANSWER_POINTS : 0

export const calculateRejectedAnswerScore = (_input: RejectedAnswerScoreInput): number => 0
