# Frontend Host Experience

Status: pending
Priority: 11

## Goal

Implement the host-facing UI for creating a quiz, managing the waiting room, controlling live questions, viewing reveal results, and final leaderboard.

## SPEC References

- `SPEC.md` > Primary Actors > Host
- `SPEC.md` > Business Flow > Question Set Creation
- `SPEC.md` > Business Flow > Waiting Room Flow
- `SPEC.md` > Business Flow > Starting the Quiz
- `SPEC.md` > Business Flow > Between-Question Reveal Flow
- `SPEC.md` > Screen Behavior Requirements > Host Screens

## Context

The host creates the question set, starts the quiz, controls progression, and views the full quiz display. The host can see full question text, answer options, timer, answered count, participant count, correct answer during reveal, top three after each question, and final standings.

## Dependencies

- Task 10 for frontend foundation.
- Task 06 for REST endpoints.
- Task 08 for live runtime events.

## Implementation Scope

- Build question set creation UI with title, default timer, one or more questions, two to six options, one correct option, and optional question timer.
- Validate form constraints before submit and show server validation errors.
- Create quiz session and show quiz code and join link.
- Show waiting room participant count.
- Add host start control.
- Render active question with full question, full options, timer, answered count, and total participant count.
- Render reveal screen with correct answer, top three, and continue control.
- Render final screen with final leaderboard and completion state.
- Support host reconnect with stored host token.

## Out Of Scope

- Do not implement participant UI.
- Do not calculate authoritative score on the client.
- Do not accept host-only actions without server confirmation.

## Expected Files And Folders

- `front-end/src/features/host/`
- `front-end/src/features/shared/`
- `front-end/src/api/`
- `front-end/src/realtime/`
- `front-end/src/components/`

## Acceptance Criteria

- Host can create a valid question set.
- Host cannot submit invalid question sets.
- Host can start a live session and share quiz code/link.
- Waiting-room participant count updates live.
- Host can start quiz and advance after reveal.
- Host sees full active question and options.
- Host sees correct answer and top three during reveal.
- Host sees final leaderboard at quiz end.
- Host reconnect restores current host state.

## Verification

- Run frontend build.
- Run UI tests if configured.
- Manually complete host flow with a local backend.
- Confirm host-only controls fail gracefully when token is invalid or expired.

