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

test('parses ping events for host and participant sockets', () => {
  expect(parseClientEvent('host', '{"type":"ping"}')).toEqual({
    ok: true,
    event: { type: 'ping' },
  })

  expect(parseClientEvent('participant', '{"type":"ping"}')).toEqual({
    ok: true,
    event: { type: 'ping' },
  })
})

test('parses valid participant answer submission', () => {
  expect(parseClientEvent('participant', '{"type":"submit_answer","selectedOptionId":"option-1"}')).toEqual({
    ok: true,
    event: { type: 'submit_answer', selectedOptionId: 'option-1' },
  })
})

test('rejects participant-only event types from host sockets', () => {
  expect(parseClientEvent('host', '{"type":"submit_answer","selectedOptionId":"option-1"}')).toEqual({
    ok: false,
    event: {
      type: 'protocol_error',
      code: 'forbidden_event_type',
      message: 'Event type is not allowed for this socket role.',
    },
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

test('rejects non-object and array JSON payloads', () => {
  const expected = {
    ok: false,
    event: {
      type: 'protocol_error',
      code: 'invalid_event_shape',
      message: 'Message shape is not supported.',
    },
  } as const

  expect(parseClientEvent('host', 'null')).toEqual(expected)
  expect(parseClientEvent('host', '"ping"')).toEqual(expected)
  expect(parseClientEvent('host', '["ping"]')).toEqual(expected)
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

test('rejects invalid participant answer submission shapes', () => {
  const expected = {
    ok: false,
    event: {
      type: 'protocol_error',
      code: 'invalid_event_shape',
      message: 'Message shape is not supported.',
    },
  } as const

  expect(parseClientEvent('participant', '{"type":"submit_answer"}')).toEqual(expected)
  expect(parseClientEvent('participant', '{"type":"submit_answer","selectedOptionId":123}')).toEqual(expected)
  expect(parseClientEvent('participant', '{"type":"submit_answer","selectedOptionId":""}')).toEqual(expected)
  expect(parseClientEvent('participant', '{"type":"submit_answer","selectedOptionId":"   "}')).toEqual(expected)
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

test('serializes session state date fields as ISO strings', () => {
  expect(
    serializeServerEvent({
      type: 'session_state',
      view: 'participant',
      quizSessionId: 'session-1',
      quizCode: 'ABC12345',
      status: 'question_active',
      currentQuestionPosition: 1,
      totalQuestions: 2,
      startedAt: new Date('2026-06-16T10:00:00.000Z'),
      endsAt: new Date('2026-06-16T10:00:30.000Z'),
      question: {
        id: 'question-1',
        position: 1,
        options: [{ id: 'option-1', position: 1 }],
      },
      hasAnswered: false,
      canSubmit: true,
    }),
  ).toBe(
    '{"type":"session_state","view":"participant","quizSessionId":"session-1","quizCode":"ABC12345","status":"question_active","currentQuestionPosition":1,"totalQuestions":2,"startedAt":"2026-06-16T10:00:00.000Z","endsAt":"2026-06-16T10:00:30.000Z","question":{"id":"question-1","position":1,"options":[{"id":"option-1","position":1}]},"hasAnswered":false,"canSubmit":true}',
  )
})
