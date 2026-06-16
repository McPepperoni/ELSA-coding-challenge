// AI Generated code <PURPOSE> safely send host realtime commands
import type { HostClientEvent } from '../../types'

type HostAction = 'start_quiz' | 'next_question' | 'finish_quiz'
type HostCommandEvent = Extract<HostClientEvent, Readonly<{ type: HostAction }>>

type SendHostCommandOptions = Readonly<{
  isSocketReady: boolean
  event: HostCommandEvent
  send: (event: HostCommandEvent) => void
}>

type SendHostCommandResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; error: string }>

export const sendHostCommand = (
  options: SendHostCommandOptions,
): SendHostCommandResult => {
  if (!options.isSocketReady) {
    return {
      ok: false,
      error: 'Live connection is not ready yet.',
    }
  }

  try {
    options.send(options.event)
    return { ok: true }
  } catch {
    return {
      ok: false,
      error: 'Command could not be sent. Reconnect and try again.',
    }
  }
}
