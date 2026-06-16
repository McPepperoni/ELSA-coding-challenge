# Backend Domain Rules

Status: completed
Priority: 04

## Goal

Implement pure backend domain logic for quiz validation, scoring, state transitions, timers, and leaderboard ordering.

## SPEC References

- `SPEC.md` > Business Flow
- `SPEC.md` > Real-Time State Model
- `SPEC.md` > Scoring Rules
- `SPEC.md` > Leaderboard Rules
- `SPEC.md` > Validation Rules
- `SPEC.md` > Consistency Requirements

## Context

The Hono backend is authoritative for quiz state, timers, answer validation, scoring, and leaderboard updates. Clients only render server state. Correct answers receive a fixed positive score, while incorrect, duplicate, late, and invalid answers receive zero.

## Dependencies

- Task 01 for backend structure.
- Task 03 for durable data types, if domain types are shared with repositories.

## Implementation Scope

- Add validation functions for question sets, timers, quiz session start requirements, participant display names, and answers.
- Add scoring logic with fixed positive score for correct answers and zero for all other outcomes.
- Add state transition helpers for waiting room, question active, question reveal, and finished.
- Add timer helper for question-specific timer override falling back to set default timer.
- Add leaderboard ordering by score descending with deterministic tie-breaker.
- Keep domain functions pure where possible so they can be unit tested without database or Redis.

## Out Of Scope

- Do not persist data.
- Do not broadcast WebSocket events.
- Do not implement UI.

## Expected Files And Folders

- `back-end/src/domain/validation.ts`
- `back-end/src/domain/scoring.ts`
- `back-end/src/domain/state.ts`
- `back-end/src/domain/timers.ts`
- `back-end/src/domain/leaderboard.ts`
- `back-end/src/domain/*.test.ts` or the repo's chosen test location.

## Acceptance Criteria

- Invalid question sets are rejected with reason-specific errors.
- Timer selection uses question override first, then default timer.
- Duplicate, late, invalid-option, unknown-participant, and wrong-state answers do not change score.
- Leaderboard ordering is deterministic for equal scores.
- State transitions only allow valid quiz flow.

## Verification

- Run backend unit tests for validation, scoring, state transitions, timers, and leaderboard ordering.
- Run backend typecheck.
- Confirm no test requires PostgreSQL or Redis.

