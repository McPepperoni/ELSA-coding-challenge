# Backend WebSocket Protocol

Status: pending
Priority: 07

## Goal

Define and implement the typed WebSocket protocol for host and participant connections, authentication, events, broadcasts, and reconnect state delivery.

## SPEC References

- `SPEC.md` > Technology Stack > WebSocket Component
- `SPEC.md` > Access and Session Rules
- `SPEC.md` > Reconnect Behavior
- `SPEC.md` > Screen Behavior Requirements
- `SPEC.md` > Consistency Requirements

## Context

WebSocket behavior starts once a host or participant enters the live quiz experience. Host and participant sockets receive different state views. Host screens may receive full question text, option text, correct answers during reveal, and leaderboard. Participant active screens must only receive option buttons, timer, and submission state; they must not receive full question text or full answer option text.

## Dependencies

- Task 04 for domain state types.
- Task 05 for Redis state repositories.
- Task 06 for token creation and validation.

## Implementation Scope

- Define typed host-to-server, participant-to-server, and server-to-client event contracts.
- Authenticate host sockets with host control token.
- Authenticate participant sockets with participant session token.
- Send current host state on valid host reconnect.
- Send current participant state on valid participant reconnect.
- Preserve whether a participant has already answered the active question.
- Ensure host-only and participant-only payloads cannot be confused.

## Out Of Scope

- Do not implement full runtime transitions; task 08 owns live quiz behavior.
- Do not build frontend WebSocket client UI.

## Expected Files And Folders

- `back-end/src/types/events.ts`
- `back-end/src/ws/connection.ts`
- `back-end/src/ws/auth.ts`
- `back-end/src/ws/protocol.ts`
- `back-end/src/ws/state-presenters.ts`

## Acceptance Criteria

- Invalid or missing tokens are rejected.
- Host reconnect receives current host state.
- Participant reconnect receives current participant state.
- Participant active payloads omit full question text and full answer option text.
- Host-only actions are not accepted from participant sockets.
- Event contracts are typed and shared internally by WebSocket handlers.

## Verification

- Run backend typecheck.
- Run WebSocket protocol/auth tests.
- Simulate host and participant reconnect states.
- Inspect participant active event payload tests to confirm restricted visibility.

