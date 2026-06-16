# Backend REST API

Status: pending
Priority: 06

## Goal

Implement REST API routes for setup and non-live quiz actions.

## SPEC References

- `SPEC.md` > Technology Stack > REST API Component
- `SPEC.md` > Business Flow > Question Set Creation
- `SPEC.md` > Business Flow > Quiz Session Creation
- `SPEC.md` > Business Flow > Participant Join Flow
- `SPEC.md` > Access and Session Rules
- `SPEC.md` > Error Handling

## Context

REST handles setup and non-live actions before users enter the live quiz experience. It creates question sets, creates quiz sessions, creates participant records, returns session metadata, validates tokens, writes durable data, and initializes live state in Redis.

## Dependencies

- Task 03 for durable repositories.
- Task 04 for validation rules.
- Task 05 for Redis live state initialization.

## Implementation Scope

- Add Hono routes for creating question sets.
- Add route to create a quiz session from a question set.
- Generate unique quiz code, public join link data, and private host control token.
- Persist a randomized question order for each created quiz session.
- Add route for participant join by quiz code.
- Generate private participant session token.
- Add metadata routes needed by host and participant screens.
- Ensure any question-order replacement endpoint or action is only valid before the quiz starts.
- Return clear user-facing errors for invalid quiz code, invalid tokens, expired/finished session, and invalid question set input.

## Out Of Scope

- Do not implement WebSocket event handling.
- Do not build frontend forms.
- Do not implement persistence worker.

## Expected Files And Folders

- `back-end/src/http/`
- `back-end/src/http/routes/question-sets.ts`
- `back-end/src/http/routes/quiz-sessions.ts`
- `back-end/src/http/routes/participants.ts`
- `back-end/src/http/errors.ts`
- `back-end/src/index.ts`

## Acceptance Criteria

- A host can create a valid question set through REST.
- Invalid question sets are rejected before session creation.
- A host can initialize a quiz session from a valid question set.
- Session creation persists a randomized ordered array of question IDs for the session.
- Question-order replacement, if exposed, is rejected after the waiting-room state.
- Session creation writes durable data and initializes Redis live state.
- A participant can join a waiting-room quiz with a display name.
- Participant join creates durable participant data and waiting-room membership.
- Host and participant tokens are unguessable and required for protected actions.

## Verification

- Run backend route tests.
- Manually call REST endpoints with valid and invalid payloads.
- Confirm Redis live state exists after session creation.
- Run backend typecheck.

