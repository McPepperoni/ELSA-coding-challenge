// AI Generated code <PURPOSE>: provide pure quiz timer domain helpers
export type ResolveQuestionTimerInput = Readonly<{
  defaultTimeLimitSeconds: number
  questionTimeLimitSeconds?: number | null
}>

export type QuestionTimerWindow = Readonly<{
  startedAt: Date
  endsAt: Date
  durationSeconds: number
}>

export const resolveQuestionTimerSeconds = ({
  defaultTimeLimitSeconds,
  questionTimeLimitSeconds,
}: ResolveQuestionTimerInput): number => questionTimeLimitSeconds ?? defaultTimeLimitSeconds

export const createQuestionTimerWindow = ({
  startedAt,
  durationSeconds,
}: Readonly<{
  startedAt: Date
  durationSeconds: number
}>): QuestionTimerWindow => ({
  startedAt,
  endsAt: new Date(startedAt.getTime() + durationSeconds * 1000),
  durationSeconds,
})
