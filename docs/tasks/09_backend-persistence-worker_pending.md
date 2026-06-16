# Backend Persistence Worker

Status: completed
Priority: 09

## Goal

Implement the persistence worker that writes live answer, score, and final leaderboard results to PostgreSQL without slowing down real-time gameplay.

## SPEC References

- `SPEC.md` > Persistence Worker
- `SPEC.md` > PostgreSQL
- `SPEC.md` > Redis
- `SPEC.md` > Performance Expectations
- `SPEC.md` > Observability Expectations
- `SPEC.md` > Error Handling

## Context

The live quiz runtime should keep answer submission latency low. Durable writes should not block time-sensitive socket broadcasts when avoidable. The persistence worker stores answer submissions, score changes, and final leaderboard results into PostgreSQL and should recover from temporary database delays where possible.

## Dependencies

- Task 03 for durable repositories.
- Task 05 for Redis live state.
- Task 08 for answer and leaderboard events to persist.

## Implementation Scope

- Define persistence event contracts for answer submissions, score changes, and final leaderboard results.
- Queue persistence work from live runtime without blocking broadcasts.
- Write accepted answer submissions to PostgreSQL.
- Write score changes or final score records to PostgreSQL.
- Persist final leaderboard when quiz finishes.
- Log persistence failures with enough context to debug.
- Add retry or recovery behavior appropriate for temporary database failures.

## Out Of Scope

- Do not build UI.
- Do not define new product scoring rules beyond `SPEC.md`.
- Do not make Redis the durable source of truth.

## Expected Files And Folders

- `back-end/src/workers/persistence-worker.ts`
- `back-end/src/workers/persistence-events.ts`
- `back-end/src/db/repositories/`
- `back-end/src/ws/` integration point for enqueueing events.

## Acceptance Criteria

- Valid accepted answers are eventually persisted.
- Final leaderboard is persisted at quiz finish.
- Socket broadcasts are not blocked by normal database writes.
- Temporary PostgreSQL failures are logged and retried or made recoverable.
- Duplicate persistence events do not create duplicate durable answer records.

## Verification

- Run backend worker unit tests.
- Run integration test that submits answers and confirms durable rows are written.
- Simulate temporary PostgreSQL failure if feasible and confirm failure logging/retry behavior.
- Run backend typecheck.

