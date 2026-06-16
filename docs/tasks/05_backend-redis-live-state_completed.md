# Backend Redis Live State

Status: completed
Priority: 05

## Goal

Implement the Redis-backed live-session state layer using the official `redis` / `node-redis` client.

## SPEC References

- `SPEC.md` > Backend Data Access Stack
- `SPEC.md` > Redis
- `SPEC.md` > Real-Time State Model
- `SPEC.md` > Performance Expectations
- `SPEC.md` > Error Handling

## Context

Redis stores active quiz state for low-latency WebSocket operations. Redis is command-oriented and is not managed through an ORM. It owns current quiz status, current question index/position, question start/end times, participant connection state, answer locks, answered count, live leaderboard, and short-lived session state. Durable question order comes from `quiz_sessions.question_order_ids` in PostgreSQL.

## Dependencies

- Task 01 for backend env and folders.
- Task 02 for local Redis via Docker Compose.
- Task 04 for domain state and leaderboard rules.

## Implementation Scope

- Install and configure `redis` / `node-redis`.
- Create a typed Redis client using `back-end/src/config/env.ts`.
- Add a repository/service layer under `back-end/src/redis/`.
- Implement live session initialization, status reads/writes, current question tracking, timer timestamps, participant connection tracking, answer locks, answered count, and leaderboard storage.
- Use Redis operations that support low-latency concurrent answer submissions.

## Out Of Scope

- Do not implement WebSocket protocol or broadcasts.
- Do not persist final results to PostgreSQL.
- Do not build frontend behavior.

## Expected Files And Folders

- `back-end/src/redis/client.ts`
- `back-end/src/redis/live-session-repository.ts`
- `back-end/src/redis/leaderboard-repository.ts`
- `back-end/src/redis/answer-lock-repository.ts`
- Tests or integration checks for Redis operations.

## Acceptance Criteria

- A live quiz session can be initialized in Redis from a quiz session id.
- Active question metadata includes status, question index/position within the durable session order, start time, and end time.
- Participant connection state can be recorded and cleared.
- Answer locks prevent one participant from answering the same question twice.
- Answered count increments only for accepted first answers.
- Leaderboard reads are efficient and do not scan PostgreSQL during active gameplay.
- Temporary Redis failures surface clear errors to callers.

## Verification

- Start local Redis.
- Run backend Redis integration tests or smoke scripts.
- Verify duplicate answer lock attempts only accept the first attempt.
- Run backend typecheck.

