# Elsa Quiz

Real-time multiple-choice quiz app for the [ELSA real-time quiz coding challenge](https://github.com/elsa/coding-challenges). The implementation provides a React host/participant experience, a Hono backend, WebSocket live gameplay, Redis live state, PostgreSQL durable storage, and Docker Compose startup for a local production-style demo.

Demo video: [https://youtu.be/0iy5Q9hLy-A](https://youtu.be/0iy5Q9hLy-A)

## Challenge Coverage

- User participation: participants join a live quiz session by quiz code or join link, enter a display name, and wait for the host to start.
- Real-time score updates: participant answers are submitted over WebSocket, validated by the server, scored consistently, and reflected in live session state.
- Real-time leaderboard: Redis stores session-scoped leaderboard rows, and the host sees top scores after each question plus the final leaderboard.
- System design: see [docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md).
- AI collaboration: meaningful AI-assisted code is marked with comments containing `AI Generated code <PURPOSE>`, and the workflow is documented below.

## Implemented Component

This repository implements the real-time quiz flow as a small full-stack system:

- `front-end`: React/Vite SPA for host quiz creation, host live control, participant join, participant answer, waiting, reveal, and final states.
- `back-end`: Hono/Bun server with REST setup routes and WebSocket runtime for live quiz participation, scoring, timers, answer validation, and broadcasts.
- PostgreSQL: durable question sets, questions, answer options, sessions, participants, answer submissions, and final results through Drizzle.
- Redis: active live-session state, answer locks, answered count, participant membership, and leaderboard state through node-redis.
- Persistence worker: records accepted answer events and final leaderboard entries without blocking live WebSocket broadcasts.

The server is authoritative for quiz state, timers, accepted answers, scores, and leaderboard ordering. Participant active screens intentionally show answer buttons only, while the host sees full question and answer text.

## Production Docker Setup

Docker is required for the production-style Compose stack. From the repository root, start the full stack with one of the helper scripts:

```powershell
.\scripts\start-prod.ps1
```

If local PowerShell script execution is blocked, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-prod.ps1
```

On macOS or Linux shells:

```sh
sh scripts/start-prod.sh
```

The startup scripts create a missing root `.env` with editable production defaults without overwriting an existing file, then run:

```sh
docker compose up --build
```

Edit `.env` before running this stack in a real production environment.

Once running, use these local URLs:

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend root check: [http://localhost:3000/](http://localhost:3000/)

Stop the stack without deleting volumes:

```sh
docker compose down
```

Reset containers and volumes only as an explicit manual destructive action. This deletes local PostgreSQL and Redis data volumes:

```sh
docker compose down --volumes --remove-orphans
```

## Tests and Verification

Backend checks:

```sh
cd back-end
bun test
bun run typecheck
```

Frontend checks:

```sh
cd front-end
bun test
bun run build
bun run lint
```

The test suites cover domain validation, scoring, timers, leaderboard behavior, Redis repositories, REST routes, WebSocket protocol/runtime/broadcast behavior, persistence worker behavior, frontend API mapping, token storage, realtime parsing, and host/participant UI states.

## Demo Flow

1. Open the frontend at `http://localhost:5173`.
2. Choose `Host a quiz`, create a question set, and create the host session.
3. Open one or more participant browser windows with the join link or `Join a quiz`.
4. Participants enter the quiz code and display names.
5. Confirm the host waiting room shows joined participants.
6. Start the quiz from the host screen.
7. Participants select answer buttons while the host sees the full question, options, timer, and answered count.
8. Let the server timer expire or continue through the host controls.
9. Confirm the host reveal screen shows the correct answer and top three participants.
10. Advance through all questions and confirm the final leaderboard appears.

## AI Collaboration Workflow

I used AI as a structured pair throughout the challenge:

1. Brainstormed with ChatGPT to create a rough product and architecture specification.
2. Captured that rough specification in [SPEC.md](SPEC.md), which became the implementation reference.
3. Worked with AI to break the spec into manageable, self-contained tasks under `docs/tasks/`.
4. Planned each task with AI before implementation.
5. Implemented with TDD and the Superpowers plugin, keeping tests close to each project ownership area.
6. After implementation, used AI self-review with subagents to get fresh-context feedback.
7. Reviewed by hand, made final tweaks, and created pull requests for pair review.

## AI-Assisted Code Documentation

Code sections that were generated or significantly assisted by AI include comments containing `AI Generated code <PURPOSE>`. Examples include the HTTP app composition, WebSocket protocol/runtime, persistence worker, database repositories, Redis repositories, frontend REST/realtime clients, token storage, and host/participant screens.

Verification for AI-assisted output included:

- Failing tests first for domain rules, routes, realtime contracts, and UI behavior where practical.
- Passing backend and frontend test suites after implementation.
- Typechecking and frontend build checks.
- Manual review of generated code for security-sensitive behavior such as host tokens, participant tokens, role-specific WebSocket events, duplicate answer locks, late answer rejection, and participant answer visibility.
- Fresh-context AI review with subagents followed by manual review and PR pair review.

## Future-Facing Design Notes

- Scalability: live quiz state is stored in Redis by session, leaderboard data is session-scoped, and HTTP/WebSocket handlers can remain mostly stateless behind shared PostgreSQL and Redis services.
- Performance: answer submission uses Redis answer locks and leaderboard updates so the hot path avoids scanning durable answer records during active gameplay.
- Reliability: server-authoritative timers, token validation, duplicate/late/invalid answer rejection, rollback paths, and a persistence worker reduce inconsistent live state and avoid blocking broadcasts on durable writes.
- Maintainability: frontend code is separated by host, participant, shared, API, realtime, config, and library concerns; backend code is separated into domain, HTTP, WebSocket, database, Redis, worker, config, and types layers.
- Observability: the current implementation includes runtime errors and targeted logging for failed sends, timer expiration failures, rollback failures, and persistence enqueue failures. A production version should add structured logs, metrics for active sessions/connections, answer latency, rejection counts by reason, Redis/database failures, and dashboards/alerts around those signals.

