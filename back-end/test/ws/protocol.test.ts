// AI Generated code <PURPOSE>: verify WebSocket protocol parsing and serialization contracts
import { expect, test } from 'bun:test'

import {
  parseClientEvent,
  serializeServerEvent,
} from '@/ws/protocol.js'

test('parses valid host control events', () => {
  expect(parseClientEvent('host', '{"type":"start_quiz"}')).toEqual({
    ok: true,
    event: { type: 'start_quiz' },
  })

  expect(parseClientEvent('host', '{"type":"next_question"}')).toEqual({
    ok: true,
    event: { type: 'next_question' },
  })

  expect(parseClientEvent('host', '{"type":"finish_quiz"}')).toEqual({
    ok: true,
    event: { type: 'finish_quiz' },
  })
})

test('parses valid participant answer submission', () => {
  expect(parseClientEvent('participant', '{"type":"submit_answer","selectedOptionId":"option-1"}')).toEqual({
    ok: true,
    event: { type: 'submit_answer', selectedOptionId: 'option-1' },
  })
})

test('rejects invalid JSON with protocol error event', () => {
  expect(parseClientEvent('host', '{bad json')).toEqual({
    ok: false,
    event: {
      type: 'protocol_error',
      code: 'invalid_json',
      message: 'Message must be valid JSON.',
    },
  })
})

test('rejects host-only event types from participant sockets', () => {
  expect(parseClientEvent('participant', '{"type":"start_quiz"}')).toEqual({
    ok: false,
    event: {
      type: 'protocol_error',
      code: 'forbidden_event_type',
      message: 'Event type is not allowed for this socket role.',
    },
  })
})

test('serializes protocol error server events', () => {
  expect(
    serializeServerEvent({
      type: 'protocol_error',
      code: 'invalid_event_shape',
      message: 'Message shape is not supported.',
    }),
  ).toBe('{"type":"protocol_error","code":"invalid_event_shape","message":"Message shape is not supported."}')
})
