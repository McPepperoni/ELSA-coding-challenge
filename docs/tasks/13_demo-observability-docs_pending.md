# Demo Observability Docs

Status: pending
Priority: 13

## Goal

Add observability hooks, setup documentation, and final demo/acceptance guidance for the complete real-time quiz flow.

## SPEC References

- `SPEC.md` > Observability Expectations
- `SPEC.md` > Testing Expectations
- `SPEC.md` > Demo Expectations
- `SPEC.md` > AI Agent Delivery Checklist
- `SPEC.md` > Completion Criteria

## Context

The final product should support a demo with one host browser and multiple participant browser windows. The system should expose enough logs and metrics to debug live quiz behavior, including session creation, participant joins, socket connections, quiz start, question start/end, answer accepted/rejected, leaderboard calculation, quiz finish, disconnects, reconnects, and persistence failure.

## Dependencies

- Tasks 01 through 12.

## Implementation Scope

- Add structured logging around key backend events from `SPEC.md`.
- Add lightweight metrics or counters where practical for active sessions, active WebSocket connections, participants per session, answer latency, rejection count by reason, Redis failures, and database failures.
- Document local setup using env files and Docker Compose.
- Document manual demo flow from host creation through final leaderboard.
- Document testing commands and known acceptance scenarios.
- Perform a final pass against `SPEC.md` completion criteria.

## Out Of Scope

- Do not add a production monitoring stack unless explicitly requested.
- Do not expand product scope beyond the quiz flow in `SPEC.md`.

## Expected Files And Folders

- `README.md` or project documentation files.
- Backend logging/metrics helpers under `back-end/src/`.
- Optional demo notes under `docs/`.
- Existing frontend/backend source files only where needed for observability hooks.

## Acceptance Criteria

- Setup docs explain how to run the app locally.
- Demo docs explain how to run one host and multiple participant browser windows.
- Logs cover the recommended events from `SPEC.md`.
- Metrics or counters cover the recommended metrics where practical.
- Final acceptance checklist maps to `SPEC.md` completion criteria.
- A full demo can show quiz creation, join, waiting room updates, active questions, answer submission, answered count, reveal, next question, and final results.

## Verification

- Run backend tests and typecheck.
- Run frontend build.
- Run the local Docker Compose startup if available.
- Execute the manual demo flow with one host and at least two participant windows.
- Confirm logs show the key lifecycle events.

