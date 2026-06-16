# Backend Live Quiz Runtime

Status: pending
Priority: 08

## Goal

Implement the live quiz runtime over WebSockets: waiting room, quiz start, active question, answer submission, reveal, next question, and finish.

## SPEC References

- `SPEC.md` > Business Flow
- `SPEC.md` > Real-Time State Model
- `SPEC.md` > Screen Behavior Requirements
- `SPEC.md` > Scoring Rules
- `SPEC.md` > Leaderboard Rules
- `SPEC.md` > Consistency Requirements

## Context

The server owns quiz state and timers. Clients display the state received from the server. During an active question, participants submit one answer. The server rejects late, duplicate, invalid, or wrong-state answers. When the server timer expires, the quiz transitions to reveal, the host sees the correct answer and top three participants, and participants wait for the next question.

## Dependencies

- Task 04 for domain rules.
- Task 05 for Redis state.
- Task 06 for REST-created sessions and participants.
- Task 07 for WebSocket protocol.

## Implementation Scope

- Track waiting-room membership and broadcast participant count.
- Let host start quiz from waiting room.
- Start active questions with server-authoritative start and end times.
- Broadcast host question state with question text, full option text, timer, and answered count.
- Broadcast participant active state with option buttons only, timer, and submission availability.
- Accept valid participant answers once per question.
- Reject duplicate, late, invalid-option, unknown-participant, and wrong-state answers.
- Update answered count and live score.
- End question when server timer expires.
- Broadcast reveal state and top three leaderboard to host.
- Move to next question by host action or finish when no questions remain.

## Out Of Scope

- Do not persist final durable results directly here except through the persistence worker interface.
- Do not build frontend screens.

## Expected Files And Folders

- `back-end/src/ws/handlers/`
- `back-end/src/ws/broadcasts.ts`
- `back-end/src/ws/timers.ts`
- `back-end/src/domain/`
- `back-end/src/redis/`

## Acceptance Criteria

- Waiting-room participant count updates promptly.
- Host can start quiz only with valid host token.
- Active question uses question-specific timer override before set default timer.
- Participants can submit one answer per active question.
- Late and duplicate answers are rejected without score or count changes.
- Host receives answered count updates.
- Host receives correct answer and top three after timer ends.
- Participant remains in waiting/submitted states between questions.
- Final state is reached after the last question.

## Verification

- Run backend live runtime tests with fake timers.
- Run integration test for one host and two participants through a full two-question quiz.
- Confirm participant payloads never include full question or answer text during active question.
- Run backend typecheck.

