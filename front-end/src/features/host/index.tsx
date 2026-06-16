// AI Generated code <PURPOSE> implement host quiz creation and live control screens
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { createQuizApiClient, isApiError } from '../../api'
import { env } from '../../config/env'
import { getVisualSecondsRemaining } from '../shared'
import { createTokenStore } from '../../lib'
import { createRealtimeConnection, parseSocketMessage } from '../../realtime'
import { sendHostCommand } from './connection'
import {
  hostQuestionSetConstraints,
  validateHostQuestionSetDraft,
} from './validation'
import type {
  HostClientEvent,
  HostMetadataResponse,
  HostSessionStateEvent,
  Question,
  QuestionDraft,
  QuestionOptionDraft,
  QuestionSet,
  QuestionSetDraft,
  SessionStateLeaderboardEntry,
  SessionStateParticipant,
} from '../../types'

const {
  minTimerSeconds,
  maxTimerSeconds,
  minOptionCount,
  maxOptionCount,
} = hostQuestionSetConstraints

type HostAction = 'start_quiz' | 'next_question' | 'finish_quiz'
type HostCommandEvent = Extract<HostClientEvent, Readonly<{ type: HostAction }>>

type EditableQuestion = Readonly<{
  prompt: string
  timeLimitSeconds: string
  options: readonly QuestionOptionDraft[]
}>

type EditableQuestionSet = Readonly<{
  title: string
  defaultTimeLimitSeconds: string
  questions: readonly EditableQuestion[]
}>

type ConnectionState = Readonly<{
  readyState: () => number
  send: (event: HostCommandEvent) => void
}>

const openSocketReadyState = 1

export function HostCreatePage() {
  const navigate = useNavigate()
  const [draft, setDraft] = useState<EditableQuestionSet>(createInitialDraft)
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
    const questionSetDraft = toQuestionSetDraft(draft)
    const validationErrors = validateHostQuestionSetDraft(questionSetDraft)

    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      setStatus('Review the highlighted question set details.')
      return
    }

    setIsSubmitting(true)
    setErrors([])
    setStatus('Creating question set...')

    const questionSetResult =
      await apiClient.createQuestionSet(questionSetDraft)

    if (!questionSetResult.ok) {
      const message = isApiError(questionSetResult)
        ? questionSetResult.error.message
        : 'Question set was not created.'
      setErrors([message])
      setStatus('Question set was not created.')
      setIsSubmitting(false)
      return
    }

    setStatus('Starting host session...')
    const sessionResult = await apiClient.createQuizSession({
      questionSetId: questionSetResult.data.questionSet.id,
    })

    if (!sessionResult.ok) {
      const message = isApiError(sessionResult)
        ? sessionResult.error.message
        : 'Host session was not created.'
      setErrors([message])
      setStatus('Host session was not created.')
      setIsSubmitting(false)
      return
    }

    tokenStore.saveHostToken(
      sessionResult.data.quizSession.id,
      sessionResult.data.hostToken,
    )
    setStatus('Host session ready.')
    navigate(`/host/${sessionResult.data.quizSession.id}`)
  }

  return (
    <main className="app-shell host-create">
      <section className="page-heading">
        <p className="eyebrow">Host control</p>
        <h1>Create a live quiz</h1>
        <p>
          Build a question set, choose timers, mark one correct answer, then open
          the waiting room.
        </p>
      </section>

      <form className="quiz-form" onSubmit={submit}>
        <StatusPanel status={status} errors={errors} />
        <div className="field-grid two">
          <label className="field">
            <span>Question set title</span>
            <input
              value={draft.title}
              onChange={(event) =>
                setDraft({ ...draft, title: event.currentTarget.value })
              }
              placeholder="Friday review"
            />
          </label>
          <label className="field">
            <span>Default timer seconds</span>
            <input
              min={minTimerSeconds}
              max={maxTimerSeconds}
              type="number"
              value={draft.defaultTimeLimitSeconds}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  defaultTimeLimitSeconds: event.currentTarget.value,
                })
              }
            />
          </label>
        </div>

        <div className="question-stack">
          {draft.questions.map((question, questionIndex) => (
            <QuestionEditor
              key={questionIndex}
              question={question}
              questionIndex={questionIndex}
              canRemove={draft.questions.length > 1}
              onChange={(nextQuestion) =>
                setDraft({
                  ...draft,
                  questions: replaceAt(
                    draft.questions,
                    questionIndex,
                    nextQuestion,
                  ),
                })
              }
              onRemove={() =>
                setDraft({
                  ...draft,
                  questions: draft.questions.filter(
                    (_, index) => index !== questionIndex,
                  ),
                })
              }
            />
          ))}
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="button secondary"
            onClick={() =>
              setDraft({
                ...draft,
                questions: [...draft.questions, createEditableQuestion()],
              })
            }
          >
            Add question
          </button>
          <button type="submit" className="button primary" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create host session'}
          </button>
        </div>
      </form>
    </main>
  )
}

export function HostLivePage() {
  const { quizSessionId } = useParams()
  const [metadata, setMetadata] = useState<HostMetadataResponse | null>(null)
  const [state, setState] = useState<HostSessionStateEvent | null>(null)
  const connectionRef = useRef<ConnectionState | null>(null)
  const [errors, setErrors] = useState<readonly string[]>([])
  const [status, setStatus] = useState('Loading host session...')
  const [sendingAction, setSendingAction] = useState<HostAction | null>(null)
  const [isSocketReady, setIsSocketReady] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const apiClient = useMemo(
    () => createQuizApiClient({ apiUrl: env.API_URL }),
    [],
  )
  const tokenStore = useMemo(
    () => createTokenStore(window.localStorage),
    [],
  )
  const hostToken = quizSessionId
    ? tokenStore.readHostToken(quizSessionId)
    : null

  useEffect(() => {
    const timerId = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timerId)
  }, [])

  useEffect(() => {
    if (!quizSessionId || !hostToken) {
      return
    }

    let isDisposed = false

    const loadMetadata = async () => {
      setStatus('Loading host session...')
      const result = await apiClient.getHostSession(quizSessionId, hostToken)

      if (isDisposed) {
        return
      }

      if (!result.ok) {
        const message = isApiError(result)
          ? result.error.message
          : 'Could not reconnect this host session.'
        setErrors([message])
        setStatus('Could not reconnect this host session.')
        return
      }

      setMetadata(result.data)
      setStatus('Host session loaded.')
    }

    void loadMetadata()

    return () => {
      isDisposed = true
    }
  }, [apiClient, hostToken, quizSessionId])

  useEffect(() => {
    if (!hostToken) {
      return
    }

    const realtime = createRealtimeConnection({
      apiUrl: env.API_URL,
      role: 'host',
      token: hostToken,
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

      if (result.event.type === 'session_state' && result.event.view === 'host') {
        setState(result.event)
        setSendingAction(null)
        setStatus('Server state updated.')
        return
      }

      if (
        result.event.type === 'protocol_error' ||
        result.event.type === 'runtime_error'
      ) {
        setErrors([result.event.message])
        setSendingAction(null)
      }
    }

    const onOpen = () => {
      setIsSocketReady(true)
      setStatus('Live connection open. Waiting for server state...')
    }
    const onError = () => {
      setIsSocketReady(false)
      setErrors(['Live connection failed.'])
    }
    const onClose = () => {
      setIsSocketReady(false)
      setSendingAction(null)
      setStatus('Live connection closed.')
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
  }, [hostToken])

  const sendHostAction = (event: HostCommandEvent) => {
    const connection = connectionRef.current

    if (!connection) {
      setErrors(['Live connection is not ready yet.'])
      return
    }

    const result = sendHostCommand({
      isSocketReady:
        isSocketReady && connection.readyState() === openSocketReadyState,
      event,
      send: connection.send,
    })

    if (!result.ok) {
      setErrors([result.error])
      setSendingAction(null)
      return
    }

    setSendingAction(event.type)
    setStatus('Command sent. Waiting for server state...')
  }

  if (!quizSessionId || !hostToken) {
    return (
      <main className="app-shell">
        <section className="state-panel warning">
          <h1>Host reconnect unavailable</h1>
          <p>
            This browser does not have the private host token for this session.
            Return to the original host browser or create a new host session.
          </p>
          {quizSessionId ? (
            <button
              className="button secondary"
              type="button"
              onClick={() => tokenStore.clearHostToken(quizSessionId)}
            >
              Clear saved host token
            </button>
          ) : null}
          <Link className="button primary" to="/host">
            Create host session
          </Link>
        </section>
      </main>
    )
  }

  if (!metadata) {
    return (
      <main className="app-shell">
        <StatusPanel status={status} errors={errors} />
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
  const commandStatus = sendingAction
    ? 'Waiting for server confirmation.'
    : isSocketReady
      ? ''
      : 'Live connection is not ready yet.'

  return (
    <HostLiveSessionView
      metadata={metadata}
      state={state}
      secondsRemaining={secondsRemaining}
      isCommandDisabled={sendingAction !== null || !isSocketReady}
      commandStatus={commandStatus}
      status={status}
      errors={errors}
      onStart={() => sendHostAction({ type: 'start_quiz' })}
      onContinue={() => sendHostAction({ type: 'next_question' })}
      onFinish={() => sendHostAction({ type: 'finish_quiz' })}
    />
  )
}

export function HostLiveSessionView({
  metadata,
  state,
  secondsRemaining,
  isCommandDisabled,
  commandStatus,
  status = '',
  errors = [],
  onStart,
  onContinue,
  onFinish,
}: Readonly<{
  metadata: HostMetadataResponse
  state: HostSessionStateEvent | null
  secondsRemaining: number | null
  isCommandDisabled: boolean
  commandStatus: string
  status?: string
  errors?: readonly string[]
  onStart: () => void
  onContinue: () => void
  onFinish: () => void
}>) {
  return (
    <main className="app-shell host-live">
      <header className="live-header">
        <div>
          <p className="eyebrow">Host dashboard</p>
          <h1>{metadata.questionSet.title}</h1>
        </div>
        <StatusPanel status={status} errors={errors} compact />
      </header>
      {state ? (
        <HostStage
          metadata={metadata}
          state={state}
          secondsRemaining={secondsRemaining}
          isCommandDisabled={isCommandDisabled}
          commandStatus={commandStatus}
          onStart={onStart}
          onContinue={onContinue}
          onFinish={onFinish}
        />
      ) : (
        <section className="state-panel" aria-live="polite">
          <h2>Waiting for server state</h2>
          <p>{commandStatus || 'Waiting for server state...'}</p>
        </section>
      )}
    </main>
  )
}

export function HostActiveQuestionView({
  state,
  secondsRemaining,
  isCommandDisabled = false,
  commandStatus = '',
  onFinish,
}: Readonly<{
  state: HostSessionStateEvent
  secondsRemaining: number | null
  isCommandDisabled?: boolean
  commandStatus?: string
  onFinish: () => void
}>) {
  if (!state.question) {
    return (
      <section className="state-panel">
        <h2>Waiting for question</h2>
        <p>The server has not sent the active question yet.</p>
      </section>
    )
  }

  return (
    <section className="stage-layout">
      <div className="stage-main">
        <p className="eyebrow">
          Question {state.currentQuestionPosition ?? 1} of {state.totalQuestions}
        </p>
        <h2>{state.question.prompt}</h2>
        <ol className="option-list">
          {state.question.options.map((option) => (
            <li key={option.id}>
              <span className="option-position">{option.position}</span>
              <span>{option.text}</span>
            </li>
          ))}
        </ol>
      </div>
      <aside className="stage-side">
        <Metric label="Time remaining" value={formatSeconds(secondsRemaining)} />
        <Metric
          label="Answers"
          value={`${state.answeredCount ?? 0} of ${state.participantCount} answered`}
        />
        {commandStatus ? <p aria-live="polite">{commandStatus}</p> : null}
        <button
          className="button attention"
          type="button"
          disabled={isCommandDisabled}
          onClick={onFinish}
        >
          Finish quiz
        </button>
      </aside>
    </section>
  )
}

export function HostRevealView({
  questionSet,
  state,
  isCommandDisabled = false,
  commandStatus = '',
  onContinue,
  onFinish,
}: Readonly<{
  questionSet: QuestionSet
  state: HostSessionStateEvent
  isCommandDisabled?: boolean
  commandStatus?: string
  onContinue: () => void
  onFinish: () => void
}>) {
  const currentQuestion = findCurrentQuestion(questionSet, state)
  const correctAnswer = currentQuestion?.options.find(
    (option) => option.id === state.correctOptionId,
  )

  return (
    <section className="stage-layout">
      <div className="stage-main">
        <p className="eyebrow">Reveal</p>
        <h2>Correct answer</h2>
        <p className="answer-reveal">
          {correctAnswer?.text ?? 'Waiting for the server to reveal the answer.'}
        </p>
        <Leaderboard
          title="Top three"
          entries={(state.leaderboard ?? []).slice(0, 3)}
        />
      </div>
      <aside className="stage-side">
        <Metric
          label="Question"
          value={`${state.currentQuestionPosition ?? 1} of ${state.totalQuestions}`}
        />
        {commandStatus ? <p aria-live="polite">{commandStatus}</p> : null}
        <button
          className="button primary"
          type="button"
          disabled={isCommandDisabled}
          onClick={onContinue}
        >
          Continue
        </button>
        <button
          className="button attention"
          type="button"
          disabled={isCommandDisabled}
          onClick={onFinish}
        >
          Finish quiz
        </button>
      </aside>
    </section>
  )
}

export function HostFinalView({
  state,
}: Readonly<{
  state: HostSessionStateEvent
}>) {
  return (
    <section className="stage-layout">
      <div className="stage-main">
        <p className="eyebrow">Completion</p>
        <h2>Quiz complete</h2>
        <Leaderboard title="Final leaderboard" entries={state.leaderboard ?? []} />
      </div>
      <aside className="stage-side">
        <Metric label="Participants" value={String(state.participantCount)} />
        <Metric label="Questions" value={String(state.totalQuestions)} />
      </aside>
    </section>
  )
}

function QuestionEditor({
  question,
  questionIndex,
  canRemove,
  onChange,
  onRemove,
}: Readonly<{
  question: EditableQuestion
  questionIndex: number
  canRemove: boolean
  onChange: (question: EditableQuestion) => void
  onRemove: () => void
}>) {
  return (
    <fieldset className="question-editor">
      <legend>Question {questionIndex + 1}</legend>
      <label className="field">
        <span>Prompt</span>
        <textarea
          value={question.prompt}
          onChange={(event) =>
            onChange({ ...question, prompt: event.currentTarget.value })
          }
          placeholder="What should hosts read aloud?"
          rows={3}
        />
      </label>
      <label className="field narrow">
        <span>Optional timer seconds</span>
        <input
          min={minTimerSeconds}
          max={maxTimerSeconds}
          type="number"
          value={question.timeLimitSeconds}
          onChange={(event) =>
            onChange({
              ...question,
              timeLimitSeconds: event.currentTarget.value,
            })
          }
          placeholder="Use default"
        />
      </label>
      <div className="options-editor">
        {question.options.map((option, optionIndex) => (
          <div className="option-editor" key={optionIndex}>
            <label className="radio-field">
              <input
                type="radio"
                name={`question-${questionIndex}-correct`}
                aria-label={`Question ${questionIndex + 1} option ${optionIndex + 1} correct answer`}
                checked={option.isCorrect}
                onChange={() =>
                  onChange({
                    ...question,
                    options: question.options.map((candidate, candidateIndex) => ({
                      ...candidate,
                      isCorrect: candidateIndex === optionIndex,
                    })),
                  })
                }
              />
              <span>Correct</span>
            </label>
            <label className="field">
              <span>Option {optionIndex + 1}</span>
              <input
                value={option.text}
                onChange={(event) =>
                  onChange({
                    ...question,
                    options: replaceAt(question.options, optionIndex, {
                      ...option,
                      text: event.currentTarget.value,
                    }),
                  })
                }
              />
            </label>
            <button
              className="button ghost"
              type="button"
              disabled={question.options.length <= minOptionCount}
              onClick={() =>
                onChange({
                  ...question,
                  options: normalizeCorrectOption(
                    question.options.filter((_, index) => index !== optionIndex),
                  ),
                })
              }
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <div className="form-actions compact">
        <button
          className="button secondary"
          type="button"
          disabled={question.options.length >= maxOptionCount}
          onClick={() =>
            onChange({
              ...question,
              options: [
                ...question.options,
                { text: '', isCorrect: false },
              ],
            })
          }
        >
          Add option
        </button>
        <button
          className="button ghost"
          type="button"
          disabled={!canRemove}
          onClick={onRemove}
        >
          Remove question
        </button>
      </div>
    </fieldset>
  )
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

function WaitingRoomView({
  metadata,
  state,
  isCommandDisabled,
  commandStatus,
  onStart,
}: Readonly<{
  metadata: HostMetadataResponse
  state: HostSessionStateEvent
  isCommandDisabled: boolean
  commandStatus: string
  onStart: () => void
}>) {
  const participants = state.participants ?? metadata.participants
  const joinLink = makeJoinLink(metadata.quizSession.joinPath)

  return (
    <section className="stage-layout">
      <div className="stage-main">
        <p className="eyebrow">Waiting room</p>
        <h2>Quiz code {state.quizCode}</h2>
        <p className="join-link">{joinLink}</p>
        <ParticipantList participants={participants} />
      </div>
      <aside className="stage-side">
        <Metric label="Participants" value={String(state.participantCount)} />
        <Metric label="Questions" value={String(state.totalQuestions)} />
        {commandStatus ? <p aria-live="polite">{commandStatus}</p> : null}
        <button
          className="button primary"
          type="button"
          disabled={isCommandDisabled}
          onClick={onStart}
        >
          Start quiz
        </button>
      </aside>
    </section>
  )
}

function ParticipantList({
  participants,
}: Readonly<{
  participants: readonly SessionStateParticipant[]
}>) {
  return (
    <div>
      <h3>Participants</h3>
      {participants.length === 0 ? (
        <p>No participants have joined yet.</p>
      ) : (
        <ul className="participant-list">
          {participants.map((participant) => (
            <li key={participant.id}>{participant.displayName}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Leaderboard({
  title,
  entries,
}: Readonly<{
  title: string
  entries: readonly SessionStateLeaderboardEntry[]
}>) {
  return (
    <div className="leaderboard">
      <h3>{title}</h3>
      {entries.length === 0 ? (
        <p>No leaderboard rows yet.</p>
      ) : (
        <ol>
          {entries.map((entry) => (
            <li key={entry.participantId}>
              <span>#{entry.rank}</span>
              <strong>{entry.displayName ?? 'Unnamed participant'}</strong>
              <span>{entry.score} pts</span>
              <span>{entry.correctAnswerCount} correct</span>
            </li>
          ))}
        </ol>
      )}
    </div>
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

function HostStage(options: Readonly<{
  metadata: HostMetadataResponse
  state: HostSessionStateEvent
  secondsRemaining: number | null
  isCommandDisabled: boolean
  commandStatus: string
  onStart: () => void
  onContinue: () => void
  onFinish: () => void
}>) {
  switch (options.state.status) {
    case 'waiting_room':
      return (
        <WaitingRoomView
          metadata={options.metadata}
          state={options.state}
          isCommandDisabled={options.isCommandDisabled}
          commandStatus={options.commandStatus}
          onStart={options.onStart}
        />
      )
    case 'question_active':
      return (
        <HostActiveQuestionView
          state={options.state}
          secondsRemaining={options.secondsRemaining}
          isCommandDisabled={options.isCommandDisabled}
          commandStatus={options.commandStatus}
          onFinish={options.onFinish}
        />
      )
    case 'question_reveal':
      return (
        <HostRevealView
          questionSet={options.metadata.questionSet}
          state={options.state}
          isCommandDisabled={options.isCommandDisabled}
          commandStatus={options.commandStatus}
          onContinue={options.onContinue}
          onFinish={options.onFinish}
        />
      )
    case 'finished':
      return <HostFinalView state={options.state} />
  }
}

function createInitialDraft(): EditableQuestionSet {
  return {
    title: '',
    defaultTimeLimitSeconds: '30',
    questions: [createEditableQuestion()],
  }
}

function createEditableQuestion(): EditableQuestion {
  return {
    prompt: '',
    timeLimitSeconds: '',
    options: [
      { text: '', isCorrect: true },
      { text: '', isCorrect: false },
    ],
  }
}

function toQuestionSetDraft(draft: EditableQuestionSet): QuestionSetDraft {
  return {
    title: draft.title,
    defaultTimeLimitSeconds: Number(draft.defaultTimeLimitSeconds),
    questions: draft.questions.map(toQuestionDraft),
  }
}

function toQuestionDraft(question: EditableQuestion): QuestionDraft {
  const timeLimitSeconds = question.timeLimitSeconds.trim()

  return {
    prompt: question.prompt,
    timeLimitSeconds:
      timeLimitSeconds === '' ? undefined : Number(timeLimitSeconds),
    options: question.options,
  }
}

function replaceAt<T>(
  values: readonly T[],
  index: number,
  nextValue: T,
): readonly T[] {
  return values.map((value, valueIndex) =>
    valueIndex === index ? nextValue : value,
  )
}

function normalizeCorrectOption(
  options: readonly QuestionOptionDraft[],
): readonly QuestionOptionDraft[] {
  if (options.some((option) => option.isCorrect)) {
    return options
  }

  return options.map((option, index) => ({
    ...option,
    isCorrect: index === 0,
  }))
}

function findCurrentQuestion(
  questionSet: QuestionSet,
  state: HostSessionStateEvent,
): Question | undefined {
  if (state.question) {
    return questionSet.questions.find((question) => question.id === state.question?.id)
  }

  const position = state.currentQuestionPosition
  return typeof position === 'number'
    ? questionSet.questions[position - 1]
    : undefined
}

function formatSeconds(seconds: number | null): string {
  return seconds === null ? 'Waiting' : `${seconds}s`
}

function makeJoinLink(joinPath: string): string {
  return new URL(joinPath, window.location.origin).toString()
}
