# Project Foundation

Status: pending
Priority: 01

## Goal

Prepare the repository for the real-time quiz implementation with consistent tooling, source folders, environment handling, and baseline checks across the React frontend and Hono backend.

## SPEC References

- `SPEC.md` > Technology Stack > React SPA
- `SPEC.md` > Technology Stack > Hono Server
- `SPEC.md` > Backend Data Access Stack
- `SPEC.md` > AI Agent Delivery Checklist
- `SPEC.md` > Non-Functional Requirements > Maintainability

## Context

The product is a real-time multiple-choice quiz app. The frontend is a React single-page app for host and participant screens. The backend is a Hono server with REST setup routes and WebSocket live quiz behavior. PostgreSQL is durable storage through Drizzle ORM, and Redis is live-session state through `node-redis`.

This task does not implement quiz behavior. It creates the baseline structure and scripts that later tasks rely on.

## Dependencies

- None.

## Implementation Scope

- Ensure frontend and backend package scripts support install, typecheck/build, lint where applicable, and local dev.
- Keep all runtime environment reads centralized in:
  - `front-end/src/config/env.ts`
  - `back-end/src/config/env.ts`
- Create target source directories from `AGENTS.md` so later tasks have stable homes.
- Add missing backend development scripts needed by later backend tasks.
- Keep AI-generated code comments aligned with `AGENTS.md`.

## Out Of Scope

- Do not implement REST endpoints, WebSocket events, database schemas, Redis repositories, or UI flows.
- Do not create Docker or Compose files; that is task 02.

## Expected Files And Folders

- `front-end/package.json`
- `back-end/package.json`
- `front-end/src/config/env.ts`
- `back-end/src/config/env.ts`
- `front-end/src/api/`
- `front-end/src/realtime/`
- `front-end/src/features/`
- `front-end/src/components/`
- `front-end/src/lib/`
- `front-end/src/types/`
- `back-end/src/http/`
- `back-end/src/ws/`
- `back-end/src/domain/`
- `back-end/src/db/`
- `back-end/src/redis/`
- `back-end/src/workers/`
- `back-end/src/types/`

## Acceptance Criteria

- The repo has the frontend and backend source folders needed by later tasks.
- Frontend env variables use Vite-public names such as `VITE_API_URL`.
- Backend env variables include `DATABASE_URL`, `REDIS_URL`, and `PORT`.
- No source file reads raw environment variables outside the two `config/env.ts` files.
- Backend has a repeatable typecheck command.
- Existing scaffold app still builds.

## Verification

- Run a raw environment access search over `front-end/src` and `back-end/src` and confirm matches are limited to allowed env modules.
- Run `bun run build` from `front-end`.
- Run the backend typecheck command from `back-end`.
- Run `git status --short` and confirm only foundation-related files changed.
