// AI Generated code <PURPOSE> verify host live stage server render output
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  HostActiveQuestionView,
  HostFinalView,
  HostLiveSessionView,
  HostRevealView,
} from '../../../src/features/host'
import type {
  HostMetadataResponse,
  HostSessionStateEvent,
  QuestionSet,
} from '../../../src/types'

const questionSet: QuestionSet = {
  id: 'set-1',
  title: 'Science Bowl',
  defaultTimeLimitSeconds: 30,
  createdAt: '2026-06-17T10:00:00.000Z',
  updatedAt: '2026-06-17T10:00:00.000Z',
  questions: [
    {
      id: 'question-1',
      prompt: 'What gas do plants absorb?',
      timeLimitSeconds: null,
      createdAt: '2026-06-17T10:00:00.000Z',
      options: [
        {
          id: 'option-1',
          text: 'Carbon dioxide',
          position: 1,
          isCorrect: true,
          createdAt: '2026-06-17T10:00:00.000Z',
        },
        {
          id: 'option-2',
          text: 'Helium',
          position: 2,
          isCorrect: false,
          createdAt: '2026-06-17T10:00:00.000Z',
        },
      ],
    },
  ],
}

const baseState: HostSessionStateEvent = {
  type: 'session_state',
  view: 'host',
  quizSessionId: 'session-1',
  quizCode: 'ABCD12',
  status: 'question_active',
  currentQuestionPosition: 1,
  totalQuestions: 1,
  startedAt: '2026-06-17T10:00:00.000Z',
  endsAt: '2026-06-17T10:00:30.000Z',
  participantCount: 4,
}

const metadata: HostMetadataResponse = {
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
  participantCount: 0,
  participants: [],
  questionSet,
}

describe('host live stage views', () => {
  test('active question renders the full prompt and full options for hosts', () => {
    const html = renderToStaticMarkup(
      <HostActiveQuestionView
        state={{
          ...baseState,
          answeredCount: 2,
          question: {
            id: 'question-1',
            prompt: 'What gas do plants absorb?',
            timeLimitSeconds: 30,
            options: [
              { id: 'option-1', text: 'Carbon dioxide', position: 1 },
              { id: 'option-2', text: 'Helium', position: 2 },
            ],
          },
        }}
        secondsRemaining={18}
        onFinish={() => undefined}
      />,
    )

    expect(html).toContain('What gas do plants absorb?')
    expect(html).toContain('Carbon dioxide')
    expect(html).toContain('Helium')
    expect(html).toContain('Question 1 of 1')
    expect(html).toContain('2 of 4 answered')
    expect(html).toContain('18s')
  })

  test('active question disables finish while commands are unavailable', () => {
    const html = renderToStaticMarkup(
      <HostActiveQuestionView
        state={{
          ...baseState,
          question: {
            id: 'question-1',
            prompt: 'What gas do plants absorb?',
            timeLimitSeconds: 30,
            options: [{ id: 'option-1', text: 'Carbon dioxide', position: 1 }],
          },
        }}
        secondsRemaining={18}
        isCommandDisabled
        commandStatus="Waiting for server confirmation."
        onFinish={() => undefined}
      />,
    )

    expect(html).toContain('disabled')
    expect(html).toContain('Waiting for server confirmation.')
  })

  test('reveal view renders correct answer by 1-based question position fallback', () => {
    const html = renderToStaticMarkup(
      <HostRevealView
        questionSet={questionSet}
        state={{
          ...baseState,
          status: 'question_reveal',
          correctOptionId: 'option-1',
          leaderboard: [
            {
              participantId: 'participant-1',
              displayName: 'Ari',
              rank: 1,
              score: 100,
              correctAnswerCount: 1,
              lastCorrectSubmissionAt: '2026-06-17T10:00:12.000Z',
              joinedAt: '2026-06-17T09:59:00.000Z',
            },
            {
              participantId: 'participant-2',
              displayName: 'Bo',
              rank: 2,
              score: 80,
              correctAnswerCount: 1,
              lastCorrectSubmissionAt: '2026-06-17T10:00:14.000Z',
              joinedAt: '2026-06-17T09:59:05.000Z',
            },
          ],
        }}
        isCommandDisabled={false}
        onContinue={() => undefined}
        onFinish={() => undefined}
      />,
    )

    expect(html).toContain('Correct answer')
    expect(html).toContain('Carbon dioxide')
    expect(html).toContain('Ari')
    expect(html).toContain('Bo')
  })

  test('reveal view disables continue and finish while commands are unavailable', () => {
    const html = renderToStaticMarkup(
      <HostRevealView
        questionSet={questionSet}
        state={{
          ...baseState,
          status: 'question_reveal',
          correctOptionId: 'option-1',
        }}
        isCommandDisabled
        commandStatus="Waiting for server confirmation."
        onContinue={() => undefined}
        onFinish={() => undefined}
      />,
    )

    expect(html.match(/disabled/g)?.length).toBe(2)
    expect(html).toContain('Waiting for server confirmation.')
  })

  test('final view renders completion state and final leaderboard rows', () => {
    const html = renderToStaticMarkup(
      <HostFinalView
        state={{
          ...baseState,
          status: 'finished',
          leaderboard: [
            {
              participantId: 'participant-1',
              displayName: 'Ari',
              rank: 1,
              score: 200,
              correctAnswerCount: 2,
              lastCorrectSubmissionAt: '2026-06-17T10:01:12.000Z',
              joinedAt: '2026-06-17T09:59:00.000Z',
            },
          ],
        }}
      />,
    )

    expect(html).toContain('Quiz complete')
    expect(html).toContain('Final leaderboard')
    expect(html).toContain('Ari')
    expect(html).toContain('200')
  })

  test('live session waits for server session_state before rendering a stage', () => {
    const html = renderToStaticMarkup(
      <HostLiveSessionView
        metadata={metadata}
        state={null}
        secondsRemaining={null}
        isCommandDisabled
        commandStatus="Waiting for server state..."
        onStart={() => undefined}
        onContinue={() => undefined}
        onFinish={() => undefined}
      />,
    )

    expect(html).toContain('Science Bowl')
    expect(html).toContain('Waiting for server state...')
    expect(html).not.toContain('Waiting room')
    expect(html).not.toContain('Quiz code ABCD12')
  })
})
