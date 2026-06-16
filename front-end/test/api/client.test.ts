// AI Generated code <PURPOSE> verify frontend REST client foundation
import { describe, expect, test } from 'bun:test'
import { createQuizApiClient, isApiError } from '../../src/api'
import type {
  HostMetadataResponse,
  ParticipantJoinResponse,
  ParticipantMetadataResponse,
  QuestionSetDraft,
  QuestionSetResponse,
  QuizSessionResponse,
} from '../../src/types'

const questionSetDraft: QuestionSetDraft = {
  title: 'Team trivia',
  defaultTimeLimitSeconds: 20,
  questions: [
    {
      prompt: 'Which color is the sky?',
      options: [
        { text: 'Blue', isCorrect: true },
        { text: 'Green', isCorrect: false },
      ],
    },
  ],
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const quizSessionResponse: QuizSessionResponse = {
  quizSession: {
    id: 'session-1',
    questionSetId: 'set-1',
    quizCode: 'ABCD12',
    status: 'waiting_room',
    questionOrderIds: ['question-1'],
    currentQuestionPosition: null,
    joinPath: '/join/ABCD12',
    startedAt: null,
    finishedAt: null,
    createdAt: '2026-06-17T10:00:00.000Z',
    updatedAt: '2026-06-17T10:00:00.000Z',
  },
  hostToken: 'host-token',
}

const questionSetResponse: QuestionSetResponse = {
  questionSet: {
    id: 'set-1',
    title: 'Team trivia',
    defaultTimeLimitSeconds: 20,
    createdAt: '2026-06-17T10:00:00.000Z',
    updatedAt: '2026-06-17T10:00:00.000Z',
    questions: [
      {
        id: 'question-1',
        prompt: 'Which color is the sky?',
        timeLimitSeconds: null,
        createdAt: '2026-06-17T10:00:00.000Z',
        options: [
          {
            id: 'option-1',
            text: 'Blue',
            position: 1,
            isCorrect: true,
            createdAt: '2026-06-17T10:00:00.000Z',
          },
        ],
      },
    ],
  },
}

const participantJoinResponse: ParticipantJoinResponse = {
  participant: {
    id: 'participant-1',
    quizSessionId: 'session-1',
    displayName: 'Riley',
    joinedAt: '2026-06-17T10:00:00.000Z',
    lastSeenAt: null,
  },
  quizSession: quizSessionResponse.quizSession,
  participantToken: 'participant-token',
}

const hostMetadataResponse: HostMetadataResponse = {
  quizSession: quizSessionResponse.quizSession,
  participantCount: 1,
  participants: [participantJoinResponse.participant],
  questionSet: questionSetResponse.questionSet,
}

const participantMetadataResponse: ParticipantMetadataResponse = {
  participant: participantJoinResponse.participant,
  quizSession: quizSessionResponse.quizSession,
}

describe('createQuizApiClient', () => {
  test('posts question set drafts to the question set endpoint as JSON', async () => {
    const calls: Request[] = []
    const client = createQuizApiClient({
      apiUrl: 'https://quiz.example.test/root/',
      fetch: async (input) => {
        calls.push(input as Request)
        return jsonResponse(questionSetResponse)
      },
    })

    await client.createQuestionSet(questionSetDraft)

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://quiz.example.test/root/api/question-sets')
    expect(calls[0].method).toBe('POST')
    expect(calls[0].headers.get('content-type')).toBe('application/json')
    expect(await calls[0].json()).toEqual(questionSetDraft)
  })

  test('sends bearer tokens for protected host and participant metadata', async () => {
    const authHeaders: Array<string | null> = []
    const client = createQuizApiClient({
      apiUrl: 'http://localhost:3000',
      fetch: async (input) => {
        const request = input as Request
        authHeaders.push(request.headers.get('authorization'))
        return jsonResponse(
          request.url.includes('/api/participants/me')
            ? participantMetadataResponse
            : hostMetadataResponse,
        )
      },
    })

    await client.getHostSession('session-1', 'host-token')
    await client.getParticipantMe('participant-token')

    const hostResult = await client.getHostSession('session-1', 'host-token')
    const participantResult = await client.getParticipantMe('participant-token')

    expect(authHeaders).toEqual([
      'Bearer host-token',
      'Bearer participant-token',
      'Bearer host-token',
      'Bearer participant-token',
    ])
    expect(hostResult.ok).toBe(true)
    expect(participantResult.ok).toBe(true)
    if (hostResult.ok) {
      expect(hostResult.data.participantCount).toBe(1)
      expect(hostResult.data.participants).toHaveLength(1)
      expect(hostResult.data.questionSet.id).toBe('set-1')
    }
    if (participantResult.ok) {
      expect(participantResult.data.participant.id).toBe('participant-1')
      expect(participantResult.data.quizSession.id).toBe('session-1')
    }
  })

  test('posts session and participant creation requests to the expected endpoints', async () => {
    const bodies: unknown[] = []
    const urls: string[] = []
    const client = createQuizApiClient({
      apiUrl: 'http://localhost:3000',
      fetch: async (input) => {
        const request = input as Request
        urls.push(request.url)
        bodies.push(await request.json())
        return jsonResponse(
          request.url.endsWith('/api/participants')
            ? participantJoinResponse
            : quizSessionResponse,
        )
      },
    })

    await client.createQuizSession({ questionSetId: 'set-1' })
    await client.joinParticipant({ quizCode: 'ABCD12', displayName: 'Riley' })

    expect(urls).toEqual([
      'http://localhost:3000/api/quiz-sessions',
      'http://localhost:3000/api/participants',
    ])
    expect(bodies).toEqual([
      { questionSetId: 'set-1' },
      { quizCode: 'ABCD12', displayName: 'Riley' },
    ])
  })

  test('maps API error envelopes to typed error results', async () => {
    const client = createQuizApiClient({
      apiUrl: 'http://localhost:3000',
      fetch: async () =>
        jsonResponse(
          { error: { code: 'invalid_question_set', message: 'Need more options' } },
          400,
        ),
    })

    const result = await client.createQuestionSet(questionSetDraft)

    expect(isApiError(result)).toBe(true)
    if (isApiError(result)) {
      expect(result.error).toEqual({
        code: 'invalid_question_set',
        message: 'Need more options',
      })
    }
  })

  test('maps fetch rejection to a stable network error result', async () => {
    const client = createQuizApiClient({
      apiUrl: 'http://localhost:3000',
      fetch: async () => {
        throw new Error('connection reset')
      },
    })

    const result = await client.createQuestionSet(questionSetDraft)

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'network_error',
        message: 'Network request failed',
      },
    })
  })

  test('maps malformed JSON responses to a stable invalid response result', async () => {
    const client = createQuizApiClient({
      apiUrl: 'http://localhost:3000',
      fetch: async () =>
        new Response('not-json', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        }),
    })

    const result = await client.createQuizSession({ questionSetId: 'set-1' })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'invalid_response',
        message: 'Server response was not valid JSON',
      },
    })
  })
})
