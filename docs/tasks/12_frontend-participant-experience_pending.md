# Frontend Participant Experience

Status: pending
Priority: 12

## Goal

Implement participant-facing UI for joining a quiz, waiting for the host, answering with option buttons only, submitted/waiting states, and final result state.

## SPEC References

- `SPEC.md` > Primary Actors > Participant
- `SPEC.md` > Business Flow > Participant Join Flow
- `SPEC.md` > Business Flow > Answer Submission Flow
- `SPEC.md` > Screen Behavior Requirements > Participant Screens
- `SPEC.md` > Access and Session Rules > Participant Access

## Context

Participants join with a quiz code or link and enter a display name. Before the quiz starts, they wait. During an active question, participant screens must show option buttons, timer, and submission state only. Participant active screens must not show full question text or full answer option text. After submitting, the participant waits until the next question or final state.

## Dependencies

- Task 10 for frontend foundation.
- Task 06 for participant join REST endpoint.
- Task 08 for live runtime events.

## Implementation Scope

- Build join screen with quiz code confirmation, display name input, and join action.
- Store participant token locally for reconnect.
- Render waiting room before quiz start.
- Render active question state with option buttons only, timer, and submission availability.
- Submit one selected option through WebSocket.
- Render submitted confirmation and waiting state.
- Render between-question waiting state.
- Render final completion state with participant score and optional final standing when available.
- Show clear errors for invalid code, finished session, invalid token, duplicate answer, late answer, and connection loss.

## Out Of Scope

- Do not show full question text or full answer option text during active participant view.
- Do not show correct answer between questions unless the spec is changed.
- Do not build host controls.

## Expected Files And Folders

- `front-end/src/features/participant/`
- `front-end/src/features/shared/`
- `front-end/src/api/`
- `front-end/src/realtime/`
- `front-end/src/components/`

## Acceptance Criteria

- Participant can join a waiting-room quiz with a display name.
- Invalid quiz code shows a clear error.
- Waiting room displays waiting-for-host state.
- Active question displays option buttons only.
- Participant can submit one answer per question.
- Submitted state prevents changing the answer.
- Participant waits between questions.
- Participant final screen shows completion and score when available.
- Participant reconnect preserves already-answered state.

## Verification

- Run frontend build.
- Run UI tests if configured.
- Manually join as multiple participants against local backend.
- Inspect participant active UI and event handling to confirm no full question or full option text is displayed.

