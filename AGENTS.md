# AI Agent Context

## Required Rules

- All AI-generated code must include a comment containing: `AI Generated code <PURPOSE>`.
- Keep generated code small, typed, and aligned with the existing React and Hono TypeScript stacks.
- Tests must live under each project's `test/` folder, not beside implementation files in `src/`.
- Test folders must mirror source ownership after `src/`; for example, `back-end/src/db/repositories/*` tests belong in `back-end/test/db/repositories/`.
- Each project must configure the `@/*` import alias to resolve to that project's `src/*`.
- Before creating a new work branch, switch to `main`, pull the latest `origin/main`, and create the branch from that updated `main`.
- When asked about a library, framework, SDK, API, CLI, or cloud service, use Context7 before answering:
  - Run `npx ctx7@latest library <name> "<user question>"`.
  - Pick the best `/org/project` match.
  - Run `npx ctx7@latest docs <libraryId> "<user question>"`.
  - Use at most 3 Context7 commands per question. Do not put secrets in queries.
  - If Context7 reports quota issues, tell the user to run `npx ctx7@latest login` or set `CONTEXT7_API_KEY`.

## Product Context

This repo is a real-time multiple-choice quiz app.

- A host creates question sets, starts live sessions, shares a quiz code or join link, controls progression, sees full questions/options, sees answer progress, reveal results, and final leaderboard.
- Participants join by code/link, enter a display name, wait for the host, answer by selecting option buttons, and see waiting/final states.
- Participant active screens must not show full question text or full answer option text.
- The server is authoritative for quiz state, timers, accepted answers, scores, and leaderboard ordering.
- Host-only actions require a private host control token.
- Participant actions require a private participant session token.

## Runtime Architecture

- `front-end`: React SPA for host creation/control screens and participant join/live screens.
- `back-end`: Hono server with REST setup routes and WebSocket live quiz behavior.
- PostgreSQL stores durable quiz data: question sets, questions, options, sessions, participants, submissions, and final results.
- Redis stores active live-session state: status, current question, timers, connection state, answer locks, answered count, and live leaderboard.
- A persistence worker writes live answer/score/final result events to PostgreSQL without blocking real-time broadcasts.

## Frontend Source Structure

Use this target structure under `front-end/src`:

- `config/env.ts`: the only frontend environment initializer.
- `api/`: REST client functions and request/response mapping.
- `realtime/`: WebSocket client, event parsing, reconnect handling.
- `features/host/`: host create, waiting room, active question, reveal, and final screens.
- `features/participant/`: join, waiting room, answer, submitted, between-question, and final screens.
- `features/shared/`: quiz state helpers shared by host and participant flows.
- `components/`: reusable UI components with no quiz business ownership.
- `lib/`: generic helpers.
- `types/`: shared frontend TypeScript types.

## Backend Source Structure

Use this target structure under `back-end/src`:

- `config/env.ts`: the only backend environment initializer.
- `http/`: REST routes for question sets, sessions, joins, and metadata.
- `ws/`: WebSocket connection handling, host events, participant events, and broadcasts.
- `domain/`: quiz validation, scoring, state transitions, timer rules, and leaderboard logic.
- `db/`: PostgreSQL schema/repositories and durable persistence.
- `redis/`: live-session state, locks, counters, and leaderboard storage.
- `workers/`: persistence worker for submissions, scores, and final results.
- `types/`: shared backend TypeScript types and event contracts.

## Environment Convention

- Runtime configuration belongs in `src/config/env.ts`, not `constants`.
- Frontend code imports from `front-end/src/config/env.ts`.
- Backend code imports from `back-end/src/config/env.ts`.
- Do not read Vite's raw env object outside frontend `config/env.ts`.
- Do not read Node or Bun raw env maps outside backend `config/env.ts`.
- Export typed env objects and validate values at runtime before exposing them.
- Frontend env names must use Vite public prefixes, for example `VITE_API_URL`.
- Backend env names should include at least `DATABASE_URL`, `REDIS_URL`, and `PORT` when those services are used.

## Behavior Guardrails

- Validate question sets before session creation: at least one question, two to six options per question, exactly one correct answer, valid default timer, and valid optional question timer.
- The server timer decides question start/end; client timers are visual only.
- Reject late, duplicate, invalid-option, unknown-participant, and wrong-state answers without changing score or answered count.
- Scores are session-scoped. Correct answers receive fixed positive points; incorrect, duplicate, late, and invalid answers receive zero.
- Leaderboards are ordered by score descending with deterministic tie-breaking.
- Reconnect must restore current host or participant state when the token is valid.
