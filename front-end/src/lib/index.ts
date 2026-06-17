// AI Generated code <PURPOSE> persist private quiz session tokens
const hostTokenKey = (quizSessionId: string): string =>
  `elsa.hostToken.${quizSessionId}`
const participantTokenKey = (quizSessionId: string): string =>
  `elsa.participantToken.${quizSessionId}`
const normalizeQuizCodeKey = (quizCode: string): string =>
  quizCode.trim().toUpperCase()
const participantSessionKey = (quizCode: string): string =>
  `elsa.participantSession.${normalizeQuizCodeKey(quizCode)}`

export type TokenStore = Readonly<{
  saveHostToken: (quizSessionId: string, token: string) => void
  readHostToken: (quizSessionId: string) => string | null
  clearHostToken: (quizSessionId: string) => void
  saveParticipantToken: (quizSessionId: string, token: string) => void
  readParticipantToken: (quizSessionId: string) => string | null
  clearParticipantToken: (quizSessionId: string) => void
  saveParticipantSessionForQuizCode: (
    quizCode: string,
    quizSessionId: string,
  ) => void
  readParticipantSessionForQuizCode: (quizCode: string) => string | null
  clearParticipantSessionForQuizCode: (quizCode: string) => void
}>

export const createTokenStore = (storage: Storage): TokenStore => ({
  saveHostToken: (quizSessionId, token) =>
    storage.setItem(hostTokenKey(quizSessionId), token),
  readHostToken: (quizSessionId) => storage.getItem(hostTokenKey(quizSessionId)),
  clearHostToken: (quizSessionId) =>
    storage.removeItem(hostTokenKey(quizSessionId)),
  saveParticipantToken: (quizSessionId, token) =>
    storage.setItem(participantTokenKey(quizSessionId), token),
  readParticipantToken: (quizSessionId) =>
    storage.getItem(participantTokenKey(quizSessionId)),
  clearParticipantToken: (quizSessionId) =>
    storage.removeItem(participantTokenKey(quizSessionId)),
  saveParticipantSessionForQuizCode: (quizCode, quizSessionId) =>
    storage.setItem(participantSessionKey(quizCode), quizSessionId),
  readParticipantSessionForQuizCode: (quizCode) =>
    storage.getItem(participantSessionKey(quizCode)),
  clearParticipantSessionForQuizCode: (quizCode) =>
    storage.removeItem(participantSessionKey(quizCode)),
})
