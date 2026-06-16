# Production Docker Compose And Startup

Status: completed
Priority: 02

## Goal

Create a production-style Docker Compose environment and startup scripts so the frontend, backend, PostgreSQL, and Redis run together from optimized container images.

## SPEC References

- `SPEC.md` > Technology Stack > React SPA
- `SPEC.md` > Technology Stack > Hono Server
- `SPEC.md` > Backend Data Access Stack
- `SPEC.md` > PostgreSQL
- `SPEC.md` > Redis
- `SPEC.md` > Demo Expectations

## Context

The app needs four runtime services: React frontend, Hono backend, PostgreSQL, and Redis. PostgreSQL stores durable quiz data. Redis stores active live-session state. The Docker setup should support production-style local startup and demo flow, not cloud deployment infrastructure.

## Dependencies

- Task 01 should define baseline package scripts and env templates.

## Implementation Scope

- Add root `compose.yaml` using Docker Compose v2 conventions.
- Define services:
  - `postgres`
  - `redis`
  - `back-end`
  - `front-end`
- Add named volumes for PostgreSQL and Redis local persistence.
- Add healthchecks for PostgreSQL and Redis.
- Make backend startup depend on healthy PostgreSQL and Redis services.
- Read configurable Compose values from a generated root `.env` file.
- Use optimized multi-stage production Dockerfiles for the frontend and backend.
- Add startup scripts:
- `scripts/start-prod.ps1`
- `scripts/start-prod.sh`
- Startup scripts must check Docker availability and run `docker compose up --build`.
- Startup scripts must generate a missing root `.env` with editable defaults and never overwrite an existing `.env`.
- Document stop/reset guidance. Destructive volume reset must require an explicit manual command or separate script.

## Out Of Scope

- Do not implement app features.
- Do not add cloud deployment infrastructure.
- Do not run destructive reset commands by default.

## Expected Files And Folders

- `compose.yaml`
- `scripts/start-prod.ps1`
- `scripts/start-prod.sh`
- Optional `.dockerignore` files where needed.
- Multi-stage `Dockerfile` files under `front-end/` and `back-end/`.

## Acceptance Criteria

- `docker compose config` succeeds from the repo root.
- `docker compose up --build` starts frontend, backend, PostgreSQL, and Redis.
- Frontend is reachable on its configured local port.
- Backend health or root endpoint is reachable on its configured local port.
- PostgreSQL and Redis containers report healthy.
- `compose.yaml` reads configurable app URLs, credentials, and ports from environment variables instead of hardcoding them.
- Startup scripts create root `.env` defaults only when missing.
- Reset guidance does not delete volumes unless the user explicitly runs the reset command.

## Verification

- Run `docker compose config`.
- Run `docker compose up --build`.
- In another terminal, run `docker compose ps` and confirm service health.
- Open the frontend local URL.
- Request the backend root or health endpoint.
- Stop with `docker compose down`.

