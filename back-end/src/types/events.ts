// AI Generated code <PURPOSE>: define backend WebSocket event contracts
export type SocketRole = 'host' | 'participant'

export type PingClientEvent = {
  type: 'ping'
}

export type HostClientEvent =
  | PingClientEvent
  | { type: 'start_quiz' }
  | { type: 'next_question' }
  | { type: 'finish_quiz' }

export type ParticipantClientEvent =
  | PingClientEvent
  | {
      type: 'submit_answer'
      selectedOptionId: string
    }

export type ClientEventByRole = {
  host: HostClientEvent
  participant: ParticipantClientEvent
}

export type ClientEvent = HostClientEvent | ParticipantClientEvent

export type ServerStateEvent =
  | {
      type: 'pong'
    }
  | {
      type: 'session_state'
      status: 'waiting_room' | 'question_active' | 'question_reveal' | 'finished'
      currentQuestionPosition: number | null
      answeredCount: number
      participantCount: number
    }

export type ProtocolErrorCode =
  | 'invalid_json'
  | 'invalid_event_shape'
  | 'forbidden_event_type'

export type ProtocolErrorEvent = {
  type: 'protocol_error'
  code: ProtocolErrorCode
  message: string
}

export type ServerEvent = ServerStateEvent | ProtocolErrorEvent
