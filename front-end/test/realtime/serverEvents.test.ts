// AI Generated code <PURPOSE> verify server realtime event parsing
import { describe, expect, test } from 'bun:test'
import { parseServerEvent } from '../../src/realtime'

describe('parseServerEvent', () => {
  test('rejects non-object and unknown event payloads', () => {
    expect(parseServerEvent('pong')).toEqual({
      ok: false,
      error: 'Server event must be an object',
    })
    expect(parseServerEvent({ type: 'mystery_event' })).toEqual({
      ok: false,
      error: 'Unknown server event type',
    })
    expect(
      parseServerEvent({
        type: 'session_state',
        view: 'host',
        quizSessionId: 'session-1',
        quizCode: 'ABCD12',
        status: 'active',
        currentQuestionPosition: 1,
        totalQuestions: 2,
        startedAt: '2026-06-17T10:00:00.000Z',
        endsAt: '2026-06-17T10:00:30.000Z',
      }),
    ).toEqual({
      ok: false,
      error: 'session_state requires a backend status',
    })
  })

  test('accepts host and participant session_state events as flat envelopes', () => {
    const hostState = {
      type: 'session_state',
      view: 'host',
      quizSessionId: 'session-1',
      quizCode: 'ABCD12',
      status: 'question_active',
      currentQuestionPosition: 1,
      totalQuestions: 2,
      startedAt: '2026-06-17T10:00:00.000Z',
      endsAt: '2026-06-17T10:00:30.000Z',
      participantCount: 2,
      participants: [
        {
          id: 'participant-1',
          displayName: 'Riley',
          joinedAt: '2026-06-17T09:59:00.000Z',
        },
      ],
      question: {
        id: 'question-1',
        prompt: 'Which color is the sky?',
        timeLimitSeconds: 30,
        options: [
          { id: 'option-1', position: 1, text: 'Blue' },
          { id: 'option-2', position: 2, text: 'Green' },
        ],
      },
      correctOptionId: 'option-1',
      answeredCount: 1,
      leaderboard: [
        {
          participantId: 'participant-1',
          displayName: 'Riley',
          rank: 1,
          score: 100,
          correctAnswerCount: 1,
          lastCorrectSubmissionAt: '2026-06-17T10:00:10.000Z',
          joinedAt: '2026-06-17T09:59:00.000Z',
        },
      ],
    } as const
    const participantState = {
      type: 'session_state',
      view: 'participant',
      quizSessionId: 'session-1',
      quizCode: 'ABCD12',
      status: 'question_active',
      currentQuestionPosition: 1,
      totalQuestions: 2,
      startedAt: '2026-06-17T10:00:00.000Z',
      endsAt: '2026-06-17T10:00:30.000Z',
      question: {
        id: 'question-1',
        position: 1,
        options: [
          { id: 'option-1', position: 1 },
          { id: 'option-2', position: 2 },
        ],
      },
      hasAnswered: false,
      canSubmit: true,
    } as const

    expect(parseServerEvent(hostState)).toEqual({
      ok: true,
      event: hostState,
    })
    expect(parseServerEvent(participantState)).toEqual({
      ok: true,
      event: participantState,
    })
  })

  test('accepts known non-state server event envelopes', () => {
    expect(parseServerEvent({ type: 'pong' })).toEqual({
      ok: true,
      event: { type: 'pong' },
    })
    expect(
      parseServerEvent({
        type: 'answer_result',
        status: 'accepted',
        selectedOptionId: 'option-1',
      }),
    ).toEqual({
      ok: true,
      event: {
        type: 'answer_result',
        status: 'accepted',
        selectedOptionId: 'option-1',
      },
    })
    expect(
      parseServerEvent({
        type: 'answer_result',
        status: 'rejected',
        selectedOptionId: 'option-2',
        reason: 'wrong_state',
        message: 'Question is not accepting answers',
      }),
    ).toEqual({
      ok: true,
      event: {
        type: 'answer_result',
        status: 'rejected',
        selectedOptionId: 'option-2',
        reason: 'wrong_state',
        message: 'Question is not accepting answers',
      },
    })
    expect(
      parseServerEvent({
        type: 'protocol_error',
        code: 'bad_event',
        message: 'Unsupported event',
      }),
    ).toEqual({
      ok: true,
      event: {
        type: 'protocol_error',
        code: 'bad_event',
        message: 'Unsupported event',
      },
    })
    expect(
      parseServerEvent({
        type: 'runtime_error',
        code: 'failed',
        message: 'Try again',
      }),
    ).toEqual({
      ok: true,
      event: {
        type: 'runtime_error',
        code: 'failed',
        message: 'Try again',
      },
    })
  })

  test('rejects malformed nested session_state fields', () => {
    const baseHostState = {
      type: 'session_state',
      view: 'host',
      quizSessionId: 'session-1',
      quizCode: 'ABCD12',
      status: 'question_active',
      currentQuestionPosition: 1,
      totalQuestions: 2,
      startedAt: '2026-06-17T10:00:00.000Z',
      endsAt: '2026-06-17T10:00:30.000Z',
      participantCount: 2,
    } as const

    const malformedEvents = [
      { ...baseHostState, participantCount: '2' },
      { ...baseHostState, participants: [{ id: 'participant-1' }] },
      {
        ...baseHostState,
        question: {
          id: 'question-1',
          prompt: 'Prompt',
          timeLimitSeconds: '30',
          options: [{ id: 'option-1', text: 'Blue', position: 1 }],
        },
      },
      {
        ...baseHostState,
        question: {
          id: 'question-1',
          prompt: 'Prompt',
          timeLimitSeconds: 30,
          options: [{ id: 'option-1', position: 1 }],
        },
      },
      { ...baseHostState, correctOptionId: null },
      { ...baseHostState, answeredCount: '1' },
      {
        ...baseHostState,
        leaderboard: [
          {
            participantId: 'participant-1',
            rank: 1,
            score: 100,
            correctAnswerCount: 1,
            lastCorrectSubmissionAt: null,
          },
        ],
      },
      {
        ...baseHostState,
        view: 'participant',
        hasAnswered: 'false',
      },
      {
        ...baseHostState,
        view: 'participant',
        canSubmit: 'true',
      },
      {
        ...baseHostState,
        view: 'participant',
        question: {
          id: 'question-1',
          position: 1,
          prompt: 'Hidden prompt',
          options: [{ id: 'option-1', position: 1 }],
        },
      },
      {
        ...baseHostState,
        view: 'participant',
        question: {
          id: 'question-1',
          position: 1,
          options: [{ id: 'option-1', position: 1, text: 'Hidden option' }],
        },
      },
      {
        ...baseHostState,
        view: 'participant',
        leaderboard: [
          {
            participantId: 'participant-1',
            rank: 1,
            score: 100,
            correctAnswerCount: 1,
            lastCorrectSubmissionAt: null,
            joinedAt: '2026-06-17T09:59:00.000Z',
          },
        ],
      },
    ]

    for (const event of malformedEvents) {
      expect(parseServerEvent(event).ok).toBe(false)
    }
  })

  test('rejects answer_result events with unknown rejection reasons', () => {
    expect(
      parseServerEvent({
        type: 'answer_result',
        status: 'rejected',
        selectedOptionId: 'option-2',
        reason: 'not_a_backend_reason',
        message: 'Nope',
      }).ok,
    ).toBe(false)
  })
})
