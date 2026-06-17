// AI Generated code <PURPOSE> verify participant live stage server render output
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  ParticipantActiveQuestionView,
  ParticipantFinalView,
  ParticipantLiveSessionView,
  ParticipantRevealView,
  ParticipantWaitingRoomView,
} from '../../../src/features/participant'
import type {
  ParticipantMetadataResponse,
  ParticipantSessionStateEvent,
} from '../../../src/types'

const metadata: ParticipantMetadataResponse = {
  participant: {
    id: 'participant-1',
    quizSessionId: 'session-1',
    displayName: 'Riley',
    joinedAt: '2026-06-17T10:00:00.000Z',
    lastSeenAt: null,
  },
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
}

const baseState: ParticipantSessionStateEvent = {
  type: 'session_state',
  view: 'participant',
  quizSessionId: 'session-1',
  quizCode: 'ABCD12',
  status: 'question_active',
  currentQuestionPosition: 1,
  totalQuestions: 3,
  startedAt: '2026-06-17T10:00:00.000Z',
  endsAt: '2026-06-17T10:00:30.000Z',
}

describe('participant live stage views', () => {
  test('active question renders option positions without full prompt or option text', () => {
    const html = renderToStaticMarkup(
      <ParticipantActiveQuestionView
        state={{
          ...baseState,
          question: {
            id: 'question-1',
            position: 1,
            prompt: 'SECRET_PROMPT_DO_NOT_RENDER',
            options: [
              {
                id: 'option-1',
                position: 1,
                text: 'SECRET_CORRECT_OPTION_DO_NOT_RENDER',
              },
              {
                id: 'option-2',
                position: 2,
                text: 'SECRET_WRONG_OPTION_DO_NOT_RENDER',
              },
            ],
          } as ParticipantSessionStateEvent['question'],
          canSubmit: true,
          hasAnswered: false,
        }}
        secondsRemaining={12}
        isSubmitDisabled={false}
        resultMessage=""
        onSubmit={() => undefined}
      />,
    )

    expect(html).toContain('Question 1 of 3')
    expect(html).toContain('Option 1')
    expect(html).toContain('Option 2')
    expect(html).toContain('12s')
    expect(html).not.toContain('SECRET_PROMPT_DO_NOT_RENDER')
    expect(html).not.toContain('SECRET_CORRECT_OPTION_DO_NOT_RENDER')
    expect(html).not.toContain('SECRET_WRONG_OPTION_DO_NOT_RENDER')
  })

  test('submitted active question prevents changing answers', () => {
    const html = renderToStaticMarkup(
      <ParticipantActiveQuestionView
        state={{
          ...baseState,
          question: {
            id: 'question-1',
            position: 1,
            options: [{ id: 'option-1', position: 1 }],
          },
          canSubmit: false,
          hasAnswered: true,
        }}
        secondsRemaining={8}
        isSubmitDisabled
        resultMessage="Answer submitted. Waiting for the host."
        onSubmit={() => undefined}
      />,
    )

    expect(html).toContain('Submitted')
    expect(html).toContain('Answer submitted. Waiting for the host.')
    expect(html).toContain('disabled')
  })

  test('waiting room renders host-waiting and connection feedback', () => {
    const html = renderToStaticMarkup(
      <ParticipantWaitingRoomView
        metadata={metadata}
        state={{ ...baseState, status: 'waiting_room', question: undefined }}
        connectionStatus="Live connection open."
      />,
    )

    expect(html).toContain('Waiting for the host')
    expect(html).toContain('Riley')
    expect(html).toContain('Live connection open.')
  })

  test('reveal view waits for next question without revealing answers or leaderboard', () => {
    const html = renderToStaticMarkup(
      <ParticipantRevealView
        state={{
          ...baseState,
          status: 'question_reveal',
          leaderboard: [
            {
              participantId: 'participant-1',
              displayName: 'Riley',
              rank: 1,
              score: 100,
              correctAnswerCount: 1,
              lastCorrectSubmissionAt: '2026-06-17T10:00:12.000Z',
              joinedAt: '2026-06-17T10:00:00.000Z',
            },
          ],
        }}
        resultMessage="Answer submitted. Waiting for the host."
      />,
    )

    expect(html).toContain('Waiting for the next question')
    expect(html).toContain('Answer submitted. Waiting for the host.')
    expect(html).not.toContain('Correct answer')
    expect(html).not.toContain('Riley')
    expect(html).not.toContain('100')
  })

  test('final view renders only the current participant result from leaderboard', () => {
    const html = renderToStaticMarkup(
      <ParticipantFinalView
        metadata={metadata}
        state={{
          ...baseState,
          status: 'finished',
          leaderboard: [
            {
              participantId: 'participant-2',
              displayName: 'Avery',
              rank: 1,
              score: 200,
              correctAnswerCount: 2,
              lastCorrectSubmissionAt: '2026-06-17T10:01:12.000Z',
              joinedAt: '2026-06-17T09:59:00.000Z',
            },
            {
              participantId: 'participant-1',
              displayName: 'Riley',
              rank: 2,
              score: 120,
              correctAnswerCount: 1,
              lastCorrectSubmissionAt: '2026-06-17T10:00:12.000Z',
              joinedAt: '2026-06-17T10:00:00.000Z',
            },
          ],
        }}
      />,
    )

    expect(html).toContain('Quiz complete')
    expect(html).toContain('Rank #2')
    expect(html).toContain('120 pts')
    expect(html).not.toContain('Avery')
    expect(html).not.toContain('200')
  })

  test('live session waits for server state before rendering a stage', () => {
    const html = renderToStaticMarkup(
      <ParticipantLiveSessionView
        metadata={metadata}
        state={null}
        secondsRemaining={null}
        isSubmitDisabled
        connectionStatus="Waiting for server state..."
        resultMessage=""
        errors={[]}
        onSubmit={() => undefined}
      />,
    )

    expect(html).toContain('Riley')
    expect(html).toContain('Waiting for server state...')
    expect(html).not.toContain('Option 1')
  })
})
