// AI Generated code <PURPOSE> validate participant join inputs
import type { JoinParticipantInput } from '../../types'

type ParticipantJoinValidationResult =
  | Readonly<{ ok: true; value: JoinParticipantInput }>
  | Readonly<{ ok: false; errors: readonly string[] }>

export const validateParticipantJoinInput = (
  input: JoinParticipantInput,
): ParticipantJoinValidationResult => {
  const quizCode = input.quizCode.trim().toUpperCase()
  const displayName = input.displayName.trim().replace(/\s+/g, ' ')
  const errors: string[] = []

  if (!quizCode) {
    errors.push('Quiz code is required.')
  } else if (!/^[A-Z0-9]+$/.test(quizCode)) {
    errors.push('Quiz code can use letters and numbers only.')
  }

  if (!displayName) {
    errors.push('Display name is required.')
  } else if (displayName.length > 40) {
    errors.push('Display name must be 40 characters or fewer.')
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    value: { quizCode, displayName },
  }
}
