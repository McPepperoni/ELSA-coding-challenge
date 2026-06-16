// AI Generated code <PURPOSE>: schedule live quiz question timer expiration callbacks
export type QuestionTimerExpirationHandler = (quizSessionId: string) => void | Promise<void>

export type ScheduleQuestionTimerInput = Readonly<{
  quizSessionId: string
  endsAt: Date
  onExpire: QuestionTimerExpirationHandler
}>

export type TimerHandle = unknown

export type QuizTimerClock = Readonly<{
  now(): Date
  setTimeout(callback: () => void, delayMs: number): TimerHandle
  clearTimeout(handle: TimerHandle): void
}>

const required = (value: string, field: string): string => {
  if (!value.trim()) {
    throw new Error(`${field} is required`)
  }

  return value
}

const defaultClock: QuizTimerClock = {
  now: () => new Date(),
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => {
    clearTimeout(handle as ReturnType<typeof setTimeout>)
  },
}

export const createQuizTimerScheduler = (clock: QuizTimerClock = defaultClock) => {
  const timers = new Map<string, TimerHandle>()

  const cancelQuestionTimer = (quizSessionId: string): void => {
    required(quizSessionId, 'Quiz session id')

    const existingTimer = timers.get(quizSessionId)
    if (existingTimer === undefined) {
      return
    }

    clock.clearTimeout(existingTimer)
    timers.delete(quizSessionId)
  }

  return {
    scheduleQuestionEnd(input: ScheduleQuestionTimerInput): void {
      required(input.quizSessionId, 'Quiz session id')
      cancelQuestionTimer(input.quizSessionId)

      const delayMs = Math.max(0, input.endsAt.getTime() - clock.now().getTime())
      const handle = clock.setTimeout(() => {
        timers.delete(input.quizSessionId)
        try {
          Promise.resolve(input.onExpire(input.quizSessionId)).catch((error: unknown) => {
            console.error('Question timer expiration failed', error)
          })
        } catch (error) {
          console.error('Question timer expiration failed', error)
        }
      }, delayMs)

      timers.set(input.quizSessionId, handle)
    },

    cancelQuestionTimer,

    cancelAllQuestionTimers(): void {
      for (const handle of timers.values()) {
        clock.clearTimeout(handle)
      }

      timers.clear()
    },
  }
}

export const quizTimerScheduler = createQuizTimerScheduler()
