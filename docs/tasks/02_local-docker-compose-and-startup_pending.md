# Local Docker Compose And Startup

Status: pending
Priority: 02

## Goal

Create a local Docker Compose development environment and startup scripts so developers can run the frontend, backend, PostgreSQL, and Redis together.

## SPEC References

- `SPEC.md` > Technology Stack > React SPA
- `SPEC.md` > Technology Stack > Hono Server
- `SPEC.md` > Backend Data Access Stack
- `SPEC.md` > PostgreSQL
- `SPEC.md` > Redis
- `SPEC.md` > Demo Expectations

## Context

The app needs four local runtime services: React frontend, Hono backend, PostgreSQL, and Redis. PostgreSQL stores durable quiz data. Redis stores active live-session state. The Docker setup should support local development and demo flow, not production deployment.

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
- Wire env values from existing templates or generated local env files:
  - `front-end/.env.template`
  - `back-end/.env.template`
- Add startup scripts:
  - `scripts/start-dev.ps1`
  - `scripts/start-dev.sh`
- Startup scripts must check Docker availability and run `docker compose up --build`.
- Document stop/reset guidance. Destructive volume reset must require an explicit manual command or separate script.

## Out Of Scope

- Do not implement app features.
- Do not add production deployment infrastructure.
- Do not run destructive reset commands by default.

## Expected Files And Folders

- `compose.yaml`
- `scripts/start-dev.ps1`
- `scripts/start-dev.sh`
- Optional `.dockerignore` files where needed.
- Optional `Dockerfile` files under `front-end/` and `back-end/` if compose builds local images.

## Acceptance Criteria

- `docker compose config` succeeds from the repo root.
- `docker compose up --build` starts frontend, backend, PostgreSQL, and Redis.
- Frontend is reachable on its configured local port.
- Backend health or root endpoint is reachable on its configured local port.
- PostgreSQL and Redis containers report healthy.
- Reset guidance does not delete volumes unless the user explicitly runs the reset command.

## Verification

- Run `docker compose config`.
- Run `docker compose up --build`.
- In another terminal, run `docker compose ps` and confirm service health.
- Open the frontend local URL.
- Request the backend root or health endpoint.
- Stop with `docker compose down`.

