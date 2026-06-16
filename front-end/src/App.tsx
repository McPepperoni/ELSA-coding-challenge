// AI Generated code <PURPOSE> configure frontend router for quiz flows
import { Link } from 'react-router'
import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { HostCreatePage, HostLivePage } from '@/features/host'
import { ParticipantJoinPage, ParticipantLivePage } from '@/features/participant'

const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/host',
    element: <HostCreatePage />,
  },
  {
    path: '/host/:quizSessionId',
    element: <HostLivePage />,
  },
  {
    path: '/join',
    element: <ParticipantJoinPage />,
  },
  {
    path: '/join/:quizCode',
    element: <ParticipantJoinPage />,
  },
  {
    path: '/participant/:quizSessionId',
    element: <ParticipantLivePage />,
  },
])

function App() {
  return <RouterProvider router={router} />
}

function HomePage() {
  return (
    <main className="app-shell home">
      <section className="page-heading">
        <p className="eyebrow">Real-time quiz</p>
        <h1>Run a live multiple-choice session</h1>
        <p>
          Create a question set, open a waiting room, and control quiz progress
          from the host dashboard.
        </p>
      </section>
      <nav className="home-actions" aria-label="Primary routes">
        <Link className="button primary" to="/host">
          Host a quiz
        </Link>
        <Link className="button secondary" to="/join">
          Join a quiz
        </Link>
      </nav>
    </main>
  )
}

export default App
