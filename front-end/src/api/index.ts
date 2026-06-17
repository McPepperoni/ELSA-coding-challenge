// AI Generated code <PURPOSE> provide typed REST client foundation
import type {
  ApiError,
  ApiResult,
  CreateQuizSessionInput,
  HostMetadataResponse,
  JoinParticipantInput,
  ParticipantJoinResponse,
  ParticipantMetadataResponse,
  QuestionSetDraft,
  QuestionSetResponse,
  QuizSessionResponse,
} from '@/types'

type FetchLike = (input: Request) => Promise<Response>

type ApiClientOptions = Readonly<{
  apiUrl: string
  fetch?: FetchLike
}>

type RequestOptions = Readonly<{
  method?: 'GET' | 'POST'
  body?: unknown
  token?: string
}>

export type QuizApiClient = Readonly<{
  createQuestionSet: (
    input: QuestionSetDraft,
  ) => Promise<ApiResult<QuestionSetResponse>>
  createQuizSession: (
    input: CreateQuizSessionInput,
  ) => Promise<ApiResult<QuizSessionResponse>>
  getHostSession: (
    quizSessionId: string,
    hostToken: string,
  ) => Promise<ApiResult<HostMetadataResponse>>
  joinParticipant: (
    input: JoinParticipantInput,
  ) => Promise<ApiResult<ParticipantJoinResponse>>
  getParticipantMe: (
    participantToken: string,
  ) => Promise<ApiResult<ParticipantMetadataResponse>>
}>

export const isApiError = <T>(result: ApiResult<T>): result is ApiResult<T> & {
  ok: false
} => !result.ok

export const createQuizApiClient = (options: ApiClientOptions): QuizApiClient => {
  const fetcher = options.fetch ?? fetch
  const apiUrl = normalizeApiUrl(options.apiUrl)

  const requestJson = async <T>(
    path: string,
    requestOptions: RequestOptions = {},
  ): Promise<ApiResult<T>> => {
    const request = new Request(`${apiUrl}${path}`, {
      method: requestOptions.method ?? 'GET',
      headers: buildHeaders(requestOptions),
      body:
        requestOptions.body === undefined
          ? undefined
          : JSON.stringify(requestOptions.body),
    })
    const response = await fetchResponse(fetcher, request)

    if (!response.ok) {
      return response
    }

    const payloadResult = await readJson(response.data)

    if (!payloadResult.ok) {
      return payloadResult
    }

    const payload = payloadResult.data

    if (isApiErrorPayload(payload)) {
      return { ok: false, error: payload.error }
    }

    if (!response.data.ok) {
      return {
        ok: false,
        error: {
          code: 'http_error',
          message: `Request failed with status ${response.data.status}`,
        },
      }
    }

    return { ok: true, data: payload as T }
  }

  return {
    createQuestionSet: (input) =>
      requestJson<QuestionSetResponse>('/api/question-sets', {
        method: 'POST',
        body: input,
      }),
    createQuizSession: (input) =>
      requestJson<QuizSessionResponse>('/api/quiz-sessions', {
        method: 'POST',
        body: input,
      }),
    getHostSession: (quizSessionId, hostToken) =>
      requestJson<HostMetadataResponse>(
        `/api/quiz-sessions/${encodeURIComponent(quizSessionId)}/host`,
        { token: hostToken },
      ),
    joinParticipant: (input) =>
      requestJson<ParticipantJoinResponse>('/api/participants', {
        method: 'POST',
        body: input,
      }),
    getParticipantMe: (participantToken) =>
      requestJson<ParticipantMetadataResponse>('/api/participants/me', {
        token: participantToken,
      }),
  }
}

const normalizeApiUrl = (apiUrl: string): string =>
  new URL(apiUrl).toString().replace(/\/$/, '')

const buildHeaders = (options: RequestOptions): Headers => {
  const headers = new Headers()

  if (options.body !== undefined) {
    headers.set('content-type', 'application/json')
  }

  if (options.token) {
    headers.set('authorization', `Bearer ${options.token}`)
  }

  return headers
}

const isApiErrorPayload = (
  payload: unknown,
): payload is Readonly<{ error: ApiError }> =>
  isRecord(payload) &&
  isRecord(payload.error) &&
  typeof payload.error.code === 'string' &&
  typeof payload.error.message === 'string'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const fetchResponse = async (
  fetcher: FetchLike,
  request: Request,
): Promise<ApiResult<Response>> => {
  try {
    return { ok: true, data: await fetcher(request) }
  } catch {
    return {
      ok: false,
      error: {
        code: 'network_error',
        message: 'Network request failed',
      },
    }
  }
}

const readJson = async (response: Response): Promise<ApiResult<unknown>> => {
  try {
    return { ok: true, data: (await response.json()) as unknown }
  } catch {
    return {
      ok: false,
      error: {
        code: 'invalid_response',
        message: 'Server response was not valid JSON',
      },
    }
  }
}
