// AI Generated code <PURPOSE> implement participant join and live quiz screens
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { createQuizApiClient, isApiError } from '../../api'
import { env } from '../../config/env'
import { createTokenStore } from '../../lib'
import { createRealtimeConnection, parseSocketMessage } from '../../realtime'
import { getVisualSecondsRemaining } from '../shared'
import {
  canSubmitParticipantAnswer,
  getSavedParticipantSessionPath,
} from './flow'
import { formatAnswerResultMessage } from './messages'
import { validateParticipantJoinInput } from './validation'
import type {
  ParticipantMetadataResponse,
  ParticipantSessionStateEvent,
} from '../../types'

type ConnectionState = Readonly<{
  readyState: () => number
  send: (event: Readonly<{ type: 'submit_answer'; selectedOptionId: string }>) => void
}>

const openSocketReadyState = 1

export function ParticipantJoinPage() {
  const { quizCode: routeQuizCode } = useParams()
  const navigate = useNavigate()
  const tokenStore = useMemo(
    () => createTokenStore(window.localStorage),
    [],
  )

  useEffect(() => {
    if (!routeQuizCode) {
      return
    }

    const savedSessionPath = getSavedParticipantSessionPath(
      tokenStore,
      routeQuizCode,
    )

    if (savedSessionPath) {
      navigate(savedSessionPath, { replace: true })
    }
  }, [navigate, routeQuizCode, tokenStore])

  return (
    <ParticipantJoinForm
      key={routeQuizCode ?? ''}
      routeQuizCode={routeQuizCode ?? ''}
    />
  )
}

function ParticipantJoinForm({
  routeQuizCode,
}: Readonly<{
  routeQuizCode: string
}>) {
  const navigate = useNavigate()
  const [quizCode, setQuizCode] = useState(routeQuizCode)
  const [displayName, setDisplayName] = useState('')
  const [errors, setErrors] = useState<readonly string[]>([])
  const [status, setStatus] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const apiClient = useMemo(
    () => createQuizApiClient({ apiUrl: env.API_URL }),
    [],
  )
  const tokenStore = useMemo(
    () => createTokenStore(window.localStorage),
    [],
  )

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validation = validateParticipantJoinInput({ quizCode, displayName })

    if (!validation.ok) {
      setErrors(validation.errors)
      setStatus('Review the join details.')
      return
    }

    setIsSubmitting(true)
    setErrors([])
    setStatus('Joining quiz...')

    const result = await apiClient.joinParticipant(validation.value)

    if (!result.ok) {
      const message = isApiError(result)
        ? formatJoinApiError(result.error.code, result.error.message)
        : 'Could not join this quiz.'
      setErrors([message])
      setStatus('Could not join this quiz.')
      setIsSubmitting(false)
      return
    }

    tokenStore.saveParticipantToken(
      result.data.quizSession.id,
      result.data.participantToken,
    )
    tokenStore.saveParticipantSessionForQuizCode(
      result.data.quizSession.quizCode,
      result.data.quizSession.id,
    )
    setStatus('Joined quiz.')
    navigate(`/participant/${result.data.quizSession.id}`)
  }

  return (
    <main className="app-shell participant-join">
      <section className="page-heading">
        <p className="eyebrow">Participant</p>
        <h1>Join a live quiz</h1>
        <p>Enter the quiz code from your host and the name shown in the room.</p>
      </section>

      <form className="quiz-form join-form" onSubmit={submit}>
        <StatusPanel status={status} errors={errors} />
        <div className="field-grid two">
          <label className="field">
            <span>Quiz code</span>
            <input
              autoComplete="off"
              inputMode="text"
              value={quizCode}
              onChange={(event) => setQuizCode(event.currentTarget.value)}
              placeholder="ABCD12"
            />
          </label>
          <label className="field">
            <span>Display name</span>
            <input
              autoComplete="name"
              value={displayName}
              onChange={(event) => setDisplayName(event.currentTarget.value)}
              placeholder="Riley"
            />
          </label>
        </div>
        {routeQuizCode ? (
          <p className="join-confirmation">
            Confirming quiz code {routeQuizCode.toUpperCase()}.
          </p>
        ) : null}
        <div className="form-actions">
          <Link className="button ghost" to="/">
            Back
          </Link>
          <button className="button primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Joining...' : 'Join quiz'}
          </button>
        </div>
      </form>
    </main>
  )
}

export function ParticipantLivePage() {
  const { quizSessionId } = useParams()
  const [metadata, setMetadata] = useState<ParticipantMetadataResponse | null>(
    null,
  )
  const [state, setState] = useState<ParticipantSessionStateEvent | null>(null)
  const [errors, setErrors] = useState<readonly string[]>([])
  const [connectionStatus, setConnectionStatus] = useState(
    'Loading participant session...',
  )
  const [resultMessage, setResultMessage] = useState('')
  const [isSocketReady, setIsSocketReady] = useState(false)
  const [isAnswerPending, setIsAnswerPending] = useState(false)
  const [acceptedOptionId, setAcceptedOptionId] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const connectionRef = useRef<ConnectionState | null>(null)
  const currentQuestionIdRef = useRef<string | null>(null)

  const apiClient = useMemo(
    () => createQuizApiClient({ apiUrl: env.API_URL }),
    [],
  )
  const tokenStore = useMemo(
    () => createTokenStore(window.localStorage),
    [],
  )
  const participantToken = quizSessionId
    ? tokenStore.readParticipantToken(quizSessionId)
    : null

  useEffect(() => {
    const timerId = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timerId)
  }, [])

  useEffect(() => {
    if (!participantToken) {
      return
    }

    let isDisposed = false

    const loadMetadata = async () => {
      setConnectionStatus('Loading participant session...')
      const result = await apiClient.getParticipantMe(participantToken)

      if (isDisposed) {
        return
      }

      if (!result.ok) {
        const message = isApiError(result)
          ? result.error.message
          : 'Could not reconnect this participant session.'
        setErrors([message])
        setConnectionStatus('Could not reconnect this participant session.')
        return
      }

      setMetadata(result.data)
      setConnectionStatus('Participant session loaded.')
    }

    void loadMetadata()

    return () => {
      isDisposed = true
    }
  }, [apiClient, participantToken])

  useEffect(() => {
    if (!participantToken || !metadata) {
      return
    }

    const realtime = createRealtimeConnection({
      apiUrl: env.API_URL,
      role: 'participant',
      token: participantToken,
    })

    connectionRef.current = {
      readyState: () => realtime.socket.readyState,
      send: realtime.send,
    }

    const onMessage = (event: MessageEvent) => {
      const result = parseSocketMessage(String(event.data))

      if (!result.ok) {
        setErrors([result.error])
        return
      }

      if (
        result.event.type === 'session_state' &&
        result.event.view === 'participant'
      ) {
        const nextQuestionId = result.event.question?.id ?? null
        const questionChanged = currentQuestionIdRef.current !== nextQuestionId

        currentQuestionIdRef.current = nextQuestionId
        setState(result.event)
        setIsAnswerPending(false)
        if (
          result.event.status !== 'question_active' ||
          (result.event.hasAnswered === false && questionChanged)
        ) {
          setAcceptedOptionId(null)
        }
        if (
          result.event.status === 'question_active' &&
          questionChanged
        ) {
          setResultMessage('')
        }
        setConnectionStatus('Server state updated.')
        return
      }

      if (result.event.type === 'answer_result') {
        setIsAnswerPending(false)
        if (result.event.status === 'accepted') {
          setAcceptedOptionId(result.event.selectedOptionId)
        } else {
          setAcceptedOptionId(null)
        }
        setResultMessage(formatAnswerResultMessage(result.event))
        return
      }

      if (
        result.event.type === 'protocol_error' ||
        result.event.type === 'runtime_error'
      ) {
        setIsAnswerPending(false)
        setAcceptedOptionId(null)
        setErrors([result.event.message])
      }
    }

    const onOpen = () => {
      setIsSocketReady(true)
      setConnectionStatus('Live connection open. Waiting for server state...')
    }
    const onError = () => {
      setIsSocketReady(false)
      setErrors(['Live connection failed.'])
    }
    const onClose = () => {
      setIsSocketReady(false)
      setIsAnswerPending(false)
      setAcceptedOptionId(null)
      setConnectionStatus('Live connection closed.')
    }

    realtime.socket.addEventListener('message', onMessage)
    realtime.socket.addEventListener('open', onOpen)
    realtime.socket.addEventListener('error', onError)
    realtime.socket.addEventListener('close', onClose)

    return () => {
      realtime.socket.removeEventListener('message', onMessage)
      realtime.socket.removeEventListener('open', onOpen)
      realtime.socket.removeEventListener('error', onError)
      realtime.socket.removeEventListener('close', onClose)
      realtime.socket.close()
      connectionRef.current = null
      setIsSocketReady(false)
    }
  }, [metadata, participantToken])

  const submitAnswer = (selectedOptionId: string) => {
    const connection = connectionRef.current
    const canSubmit = canSubmitParticipantAnswer({
      state,
      selectedOptionId,
      isAnswerPending,
      acceptedOptionId,
    })

    if (!connection || !isSocketReady || connection.readyState() !== openSocketReadyState) {
      setErrors(['Live connection is not ready yet.'])
      return
    }

    if (!canSubmit) {
      return
    }

    try {
      connection.send({ type: 'submit_answer', selectedOptionId })
      setIsAnswerPending(true)
      setResultMessage('Answer sent. Waiting for server confirmation.')
    } catch {
      setIsAnswerPending(false)
      setErrors(['Answer could not be sent. Reconnect and try again.'])
    }
  }

  if (!quizSessionId || !participantToken) {
    return (
      <main className="app-shell">
        <section className="state-panel warning">
          <h1>Participant reconnect unavailable</h1>
          <p>
            This browser does not have the private participant token for this
            session. Join again with the quiz code from your host.
          </p>
          <Link className="button primary" to="/join">
            Back to join
          </Link>
        </section>
      </main>
    )
  }

  if (!metadata) {
    return (
      <main className="app-shell">
        <StatusPanel status={connectionStatus} errors={errors} />
      </main>
    )
  }

  const secondsRemaining =
    state?.endsAt === null || state?.endsAt === undefined
      ? null
      : getVisualSecondsRemaining({
          endsAt: state.endsAt,
          now: () => now,
        })
  const isSubmitDisabled =
    isAnswerPending ||
    !isSocketReady ||
    state?.hasAnswered === true ||
    state?.canSubmit === false ||
    acceptedOptionId !== null

  return (
    <ParticipantLiveSessionView
      metadata={metadata}
      state={state}
      secondsRemaining={secondsRemaining}
      isSubmitDisabled={isSubmitDisabled}
      connectionStatus={connectionStatus}
      resultMessage={resultMessage}
      errors={errors}
      onSubmit={submitAnswer}
    />
  )
}

export function ParticipantLiveSessionView({
  metadata,
  state,
  secondsRemaining,
  isSubmitDisabled,
  connectionStatus,
  resultMessage,
  errors,
  onSubmit,
}: Readonly<{
  metadata: ParticipantMetadataResponse
  state: ParticipantSessionStateEvent | null
  secondsRemaining: number | null
  isSubmitDisabled: boolean
  connectionStatus: string
  resultMessage: string
  errors: readonly string[]
  onSubmit: (selectedOptionId: string) => void
}>) {
  return (
    <main className="app-shell participant-live">
      <header className="live-header">
        <div>
          <p className="eyebrow">Participant</p>
          <h1>{metadata.participant.displayName}</h1>
        </div>
        <StatusPanel status={connectionStatus} errors={errors} compact />
      </header>
      {state ? (
        <ParticipantStage
          metadata={metadata}
          state={state}
          secondsRemaining={secondsRemaining}
          isSubmitDisabled={isSubmitDisabled}
          connectionStatus={connectionStatus}
          resultMessage={resultMessage}
          onSubmit={onSubmit}
        />
      ) : (
        <section className="state-panel" aria-live="polite">
          <h2>Waiting for server state</h2>
          <p>{connectionStatus}</p>
        </section>
      )}
    </main>
  )
}

export function ParticipantWaitingRoomView({
  metadata,
  state,
  connectionStatus,
}: Readonly<{
  metadata: ParticipantMetadataResponse
  state: ParticipantSessionStateEvent
  connectionStatus: string
}>) {
  return (
    <section className="stage-layout">
      <div className="stage-main">
        <p className="eyebrow">Waiting room</p>
        <h2>Waiting for the host</h2>
        <p>
          You joined as <strong>{metadata.participant.displayName}</strong>.
          Keep this page open while the host starts the quiz.
        </p>
      </div>
      <aside className="stage-side">
        <Metric label="Quiz code" value={state.quizCode} />
        <Metric label="Questions" value={String(state.totalQuestions)} />
        <p aria-live="polite">{connectionStatus}</p>
      </aside>
    </section>
  )
}

export function ParticipantActiveQuestionView({
  state,
  secondsRemaining,
  isSubmitDisabled,
  resultMessage,
  onSubmit,
}: Readonly<{
  state: ParticipantSessionStateEvent
  secondsRemaining: number | null
  isSubmitDisabled: boolean
  resultMessage: string
  onSubmit: (selectedOptionId: string) => void
}>) {
  if (!state.question) {
    return (
      <section className="state-panel">
        <h2>Waiting for question</h2>
        <p>The server has not sent answer choices yet.</p>
      </section>
    )
  }

  const hasAnswered = state.hasAnswered === true
  const isDisabled = isSubmitDisabled || hasAnswered || state.canSubmit === false

  return (
    <section className="stage-layout">
      <div className="stage-main">
        <p className="eyebrow">
          Question {state.currentQuestionPosition ?? state.question.position} of{' '}
          {state.totalQuestions}
        </p>
        <h2>{hasAnswered ? 'Submitted' : 'Choose an option'}</h2>
        <div className="answer-grid" role="group" aria-label="Answer options">
          {state.question.options.map((option) => (
            <button
              className="answer-option"
              disabled={isDisabled}
              key={option.id}
              type="button"
              onClick={() => onSubmit(option.id)}
            >
              Option {option.position}
            </button>
          ))}
        </div>
        {resultMessage ? <p aria-live="polite">{resultMessage}</p> : null}
      </div>
      <aside className="stage-side">
        <Metric label="Time remaining" value={formatSeconds(secondsRemaining)} />
        <Metric
          label="Submission"
          value={hasAnswered ? 'Submitted' : 'Available'}
        />
      </aside>
    </section>
  )
}

export function ParticipantRevealView({
  state,
  resultMessage,
}: Readonly<{
  state: ParticipantSessionStateEvent
  resultMessage: string
}>) {
  return (
    <section className="stage-layout">
      <div className="stage-main">
        <p className="eyebrow">Between questions</p>
        <h2>Waiting for the next question</h2>
        <p>The host is reviewing the question before moving on.</p>
        {resultMessage ? <p aria-live="polite">{resultMessage}</p> : null}
      </div>
      <aside className="stage-side">
        <Metric
          label="Question"
          value={`${state.currentQuestionPosition ?? 1} of ${state.totalQuestions}`}
        />
      </aside>
    </section>
  )
}

export function ParticipantFinalView({
  metadata,
  state,
}: Readonly<{
  metadata: ParticipantMetadataResponse
  state: ParticipantSessionStateEvent
}>) {
  const ownResult = state.leaderboard?.find(
    (entry) => entry.participantId === metadata.participant.id,
  )

  return (
    <section className="stage-layout">
      <div className="stage-main">
        <p className="eyebrow">Completion</p>
        <h2>Quiz complete</h2>
        {ownResult ? (
          <div className="result-card">
            <p>Rank #{ownResult.rank}</p>
            <p>{ownResult.score} pts</p>
            <p>{ownResult.correctAnswerCount} correct</p>
          </div>
        ) : (
          <p>Final result is being prepared.</p>
        )}
      </div>
      <aside className="stage-side">
        <Metric label="Questions" value={String(state.totalQuestions)} />
      </aside>
    </section>
  )
}

function ParticipantStage(options: Readonly<{
  metadata: ParticipantMetadataResponse
  state: ParticipantSessionStateEvent
  secondsRemaining: number | null
  isSubmitDisabled: boolean
  connectionStatus: string
  resultMessage: string
  onSubmit: (selectedOptionId: string) => void
}>) {
  switch (options.state.status) {
    case 'waiting_room':
      return (
        <ParticipantWaitingRoomView
          metadata={options.metadata}
          state={options.state}
          connectionStatus={options.connectionStatus}
        />
      )
    case 'question_active':
      return (
        <ParticipantActiveQuestionView
          state={options.state}
          secondsRemaining={options.secondsRemaining}
          isSubmitDisabled={options.isSubmitDisabled}
          resultMessage={options.resultMessage}
          onSubmit={options.onSubmit}
        />
      )
    case 'question_reveal':
      return (
        <ParticipantRevealView
          state={options.state}
          resultMessage={options.resultMessage}
        />
      )
    case 'finished':
      return (
        <ParticipantFinalView
          metadata={options.metadata}
          state={options.state}
        />
      )
  }
}

function StatusPanel({
  status,
  errors,
  compact = false,
}: Readonly<{
  status: string
  errors: readonly string[]
  compact?: boolean
}>) {
  if (!status && errors.length === 0) {
    return null
  }

  return (
    <section
      className={compact ? 'status-panel compact' : 'status-panel'}
      aria-live="polite"
    >
      {status ? <p>{status}</p> : null}
      {errors.length > 0 ? (
        <ul>
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function Metric({
  label,
  value,
}: Readonly<{
  label: string
  value: string
}>) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function formatJoinApiError(code: string, fallback: string): string {
  switch (code) {
    case 'invalid_quiz_code':
      return 'Quiz code was not found. Check the code and try again.'
    case 'quiz_finished':
      return 'This quiz has already finished.'
    case 'quiz_already_started':
      return 'This quiz has already started and is no longer accepting joins.'
    case 'network_error':
      return 'Network request failed. Check your connection and try again.'
    default:
      return fallback || 'Could not join this quiz.'
  }
}

function formatSeconds(seconds: number | null): string {
  return seconds === null ? 'Waiting' : `${seconds}s`
}
