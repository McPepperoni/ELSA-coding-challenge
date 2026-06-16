// AI Generated code <PURPOSE> verify realtime socket URL derivation
import { describe, expect, test } from 'bun:test'
import {
  buildRealtimeSocketUrl,
  createRealtimeConnection,
  parseSocketMessage,
} from '../../src/realtime'

describe('buildRealtimeSocketUrl', () => {
  test('converts http API URLs to host WebSocket URLs', () => {
    expect(
      buildRealtimeSocketUrl({
        apiUrl: 'http://localhost:3000/api-root',
        role: 'host',
        token: 'host token',
      }),
    ).toBe('ws://localhost:3000/api-root/ws/host?token=host+token')
  })

  test('converts https API URLs to participant WebSocket URLs', () => {
    expect(
      buildRealtimeSocketUrl({
        apiUrl: 'https://quiz.example.test',
        role: 'participant',
        token: 'participant-token',
      }),
    ).toBe('wss://quiz.example.test/ws/participant?token=participant-token')
  })

  test('creates sockets with derived URLs and serializes client events', () => {
    const sentMessages: string[] = []
    class FakeWebSocket {
      readonly url: string

      constructor(url: string) {
        this.url = url
      }

      send(message: string): void {
        sentMessages.push(message)
      }
    }

    const connection = createRealtimeConnection({
      apiUrl: 'https://quiz.example.test',
      role: 'host',
      token: 'host-token',
      WebSocketCtor: FakeWebSocket,
    })

    connection.send({ type: 'submit_answer', selectedOptionId: 'option-1' })

    expect(connection.socket.url).toBe(
      'wss://quiz.example.test/ws/host?token=host-token',
    )
    expect(sentMessages).toEqual([
      '{"type":"submit_answer","selectedOptionId":"option-1"}',
    ])
  })

  test('parses socket message JSON before validating server events', () => {
    expect(parseSocketMessage('{"type":"pong"}')).toEqual({
      ok: true,
      event: { type: 'pong' },
    })
    expect(parseSocketMessage('not-json')).toEqual({
      ok: false,
      error: 'Socket message was not valid JSON',
    })
  })
})
