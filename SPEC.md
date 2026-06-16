<!-- Document summary brainstorm session generated with ChatGPT-->

# Real-Time Quiz App Specification

Problem Reference: https://github.com/elsa/coding-challenges

## Purpose

Build a real-time quiz application where a host creates a question set, starts a live quiz session, and participants join with a quiz code or join link. The experience is optimized for a shared quiz-room format: the host screen displays the full question and answer options, while participant screens only display selectable option buttons.

This specification is intended for an AI implementation agent. It describes the required system behavior, product flow, architecture, data concepts, and quality expectations. It does not prescribe application code.

## Product Summary

The application supports live multiple-choice quiz sessions.

A host can create a question set. Each question set has a default time limit per question. Each individual question may optionally override that default timer. Each question must have between two and six answer options and exactly one correct answer.

After creating a question set, the host can initialize it as a live quiz session. The session generates a short quiz code and a join link. Participants can join by opening the link or entering the code manually.

Participants enter a display name and wait in a waiting room until the host starts the quiz. During each active question, participants select one option. After selecting an answer, the participant waits until the question timer ends. When the timer ends, the host sees the correct answer and current top scores, while participants see a waiting state until the next question begins.

The system updates answer counts, scores, and leaderboard state in real time.

## Primary Actors

### Host

The host creates the question set, starts the quiz, controls question progression, and views the full quiz display.

The host can:

- Create a question set.
- Define a default timer for the set.
- Add questions.
- Add two to six answer options per question.
- Mark one correct answer per question.
- Optionally set a custom timer per question.
- Start a live quiz session.
- Share the quiz code or join link.
- See participants in the waiting room.
- Start the quiz.
- See the active question, answer options, timer, and answered count.
- See the correct answer after each question ends.
- See the top three participants after each question.
- End the quiz and view final results.

### Participant

The participant joins a live quiz session and answers questions.

The participant can:

- Join using a quiz code or join link.
- Enter a display name.
- Wait in the waiting room before the quiz starts.
- View option buttons during each question.
- Submit one answer per question.
- Wait after submitting an answer.
- See a waiting state between questions.
- See final result information when the quiz ends.

## Technology Stack

### React SPA

The client application is a React single-page app.

Responsibilities:

- Host quiz creation interface.
- Host live quiz control screen.
- Participant join screen.
- Participant live quiz screen.
- WebSocket connection management.
- Rendering real-time quiz state from server events.
- Local persistence of host and participant session tokens for reconnect support.

### Hono Server

The backend is a Hono server containing two internal components.

#### REST API Component

The REST component handles setup and non-live actions.

Responsibilities:

- Create question sets.
- Create quiz sessions.
- Create participant records when someone joins.
- Return quiz session metadata.
- Validate host and participant access tokens.
- Read and write durable quiz data.
- Initialize live session state.

#### WebSocket Component

The WebSocket component handles real-time quiz behavior.

Responsibilities:

- Accept host and participant socket connections.
- Track waiting room membership.
- Broadcast participant count updates.
- Start questions.
- Broadcast question state to host and participants.
- Receive participant answers.
- Enforce one answer per participant per question.
- Reject late, duplicate, or invalid answers.
- Update answered count.
- Update live scores.
- Broadcast host-only answer progress.
- End questions when the server timer expires.
- Broadcast reveal state and leaderboard.
- Move to the next question.
- Finish the quiz.

### Backend Data Access Stack

The backend must use Drizzle ORM for PostgreSQL durable data access.

Required PostgreSQL libraries:

- `drizzle-orm` for type-safe schema definitions and query building.
- `drizzle-kit` for schema-driven SQL migration generation.
- `pg` / `node-postgres` as the PostgreSQL driver used by Drizzle.

Drizzle schemas should live in the backend database layer. They should represent durable quiz data concepts such as question sets, questions, answer options, quiz sessions, participants, answer submissions, and final quiz results.

Redis must be accessed with the official Redis Node.js client.

Required Redis library:

- `redis` / `node-redis` for command-oriented Redis access.

Redis is not managed through an ORM. Live quiz state should be accessed through a small backend Redis repository or service layer that owns session state, answer locks, counters, timers, and leaderboards.

Drizzle is only for durable PostgreSQL data. Redis remains command-oriented for low-latency live-session state.

### PostgreSQL

PostgreSQL stores durable data.

Responsibilities:

- Question sets.
- Questions.
- Answer options.
- Quiz sessions.
- Participants.
- Answer submissions.
- Final quiz results.

PostgreSQL is the long-term source of truth for created quiz content and completed quiz records. Durable records are read and written through Drizzle ORM using `pg` / `node-postgres`.

### Redis

Redis stores active live-session state.

Responsibilities:

- Current quiz status.
- Current question index.
- Question start and end time.
- Participant connection state.
- Answer locks.
- Answered count.
- Live leaderboard.
- Short-lived session state needed for fast WebSocket operations.

Redis is used for low-latency state operations during active quiz sessions.

Redis live state is managed through `redis` / `node-redis` command APIs, not through Drizzle or a Redis ORM.

### Persistence Worker

The persistence worker stores live quiz results into PostgreSQL without slowing down real-time gameplay.

Responsibilities:

- Persist answer submissions.
- Persist score changes.
- Persist final leaderboard results.
- Recover from temporary database write delays where possible.

## System Architecture

The system has four main runtime areas:

- React SPA for host and participant screens.
- Hono Server with REST and WebSocket components.
- PostgreSQL for durable records.
- Redis for active live-session state.

The REST component is used for setup, joining, and session metadata. The WebSocket component is used once a host or participant enters the live quiz experience.

The Hono Server is the authority for quiz state, timers, answer validation, scoring, and leaderboard updates.

## Business Flow

### 1. Question Set Creation

The host creates a question set.

The host provides:

- Question set title.
- Default time per question.
- One or more questions.
- Two to six answer options per question.
- One correct answer per question.
- Optional custom timer per question.

The system validates the question set before allowing a live session to be created.

Validation rules:

- A question set must have at least one question.
- Each question must have between two and six answer options.
- Each question must have exactly one correct answer.
- The default timer must be valid.
- A question-specific timer must be valid when provided.

### 2. Quiz Session Creation

The host initializes a question set into a live quiz session.

The system creates:

- A quiz session.
- A unique quiz code.
- A public join link.
- A private host control token.
- A persisted randomized question ID order for this session.
- Initial live state in Redis.

The quiz starts in the waiting-room state.

### 3. Participant Join Flow

A participant joins using a quiz code or join link.

The participant provides a display name.

The system creates:

- A participant record.
- A participant session token.
- A waiting-room membership entry.

The participant is placed into the waiting room.

The host sees the participant count update in real time.

### 4. Waiting Room Flow

Before the quiz starts:

- The host sees the quiz code and join link.
- The host sees the number of joined participants.
- Participants see a waiting message.
- The quiz remains inactive until the host starts it.

### 5. Starting the Quiz

The host starts the quiz from the host screen.

The server:

- Verifies the host control token.
- Sets the first question as active.
- Determines the active timer using question-specific timer first, then the set default timer.
- Stores the server-authoritative start and end time.
- Broadcasts the question state.

Host receives:

- Question text.
- Full answer option text.
- Timer.
- Answered count.

Participants receive:

- Option buttons only.
- Timer.
- Submission availability state.

### 6. Answer Submission Flow

During an active question, a participant may submit one answer.

The server validates:

- The participant is part of the quiz session.
- The question is currently active.
- The selected option belongs to the active question.
- The question timer has not expired.
- The participant has not already answered this question.

When valid:

- The answer is accepted.
- The participant is locked from changing the answer.
- The answered count is updated.
- The participant receives an answer accepted state.
- The host receives an updated answered count.
- The score is calculated and stored in live state.
- The answer submission is queued or persisted for durable storage.

When invalid:

- The answer is rejected.
- The participant receives a reason-specific rejection state.
- Score and answered count are not changed.

### 7. Active Question Timer Flow

The server owns the timer.

The client timer is only visual. The server decides when the question starts and when it ends.

When the server-side question end time is reached:

- The question stops accepting answers.
- The system transitions to the reveal state.
- Live scores are finalized for that question.
- The current leaderboard is calculated.
- The host receives the correct answer and top three participants.
- Participants receive a waiting state for the next question.

### 8. Between-Question Reveal Flow

During the reveal state:

Host screen shows:

- The question.
- The answer options.
- The correct answer.
- Current top three participants.
- Control to continue.

Participant screen shows:

- Waiting state.
- No correct answer text.
- No full leaderboard unless explicitly added later.

### 9. Next Question Flow

The host advances to the next question.

The server:

- Verifies the host control token.
- Moves to the next question.
- Applies the appropriate timer.
- Broadcasts the next active question state.
- Resets answered count for the question.
- Prepares answer locks for the new question.

If there are no questions remaining, the quiz moves to the finished state.

### 10. Quiz Finish Flow

When the quiz ends:

- The server marks the quiz as finished.
- The final leaderboard is calculated.
- Final results are persisted.
- Host sees final standings.
- Participants see completion state.

## Real-Time State Model

The quiz session has the following states:

- Waiting room.
- Question active.
- Question reveal.
- Finished.

Only the server can change the authoritative state.

State transitions are controlled by:

- Host start action.
- Server timer expiration.
- Host next-question action.
- Host or server finish action.

## Screen Behavior Requirements

### Host Waiting Room Screen

Must show:

- Quiz code.
- Join link.
- Participant count.
- Start control.

### Host Active Question Screen

Must show:

- Question text.
- Full answer option text.
- Timer.
- Answered count.
- Total participant count.

### Host Reveal Screen

Must show:

- Correct answer.
- Top three participants.
- Control to continue.

### Host Final Screen

Must show:

- Final leaderboard.
- Quiz completion state.

### Participant Join Screen

Must show:

- Quiz code confirmation.
- Display name input.
- Join action.

### Participant Waiting Room Screen

Must show:

- Waiting for host message.
- Connection status if needed.

### Participant Active Question Screen

Must show:

- Option buttons.
- Timer.
- Submission state.

Participant active screen must not show full question text or full answer option text.

### Participant Submitted Screen

Must show:

- Answer submitted confirmation.
- Waiting message.

### Participant Between-Question Screen

Must show:

- Waiting for next question message.

### Participant Final Screen

Must show:

- Quiz completion state.
- Participant score if available.
- Optional final standing if available.

## Scoring Rules

The scoring model is intentionally simple.

- Correct answer gives a fixed positive score.
- Incorrect answer gives zero score.
- Duplicate answers do not change score.
- Late answers do not change score.
- Invalid answers do not change score.

Scores are updated in live state when valid answers are processed.

Leaderboard visibility is controlled by quiz state. The system may calculate scores during the active question, while showing leaderboard updates at reveal or final states according to the screen behavior requirements.

## Leaderboard Rules

The leaderboard is scoped to a single quiz session.

The leaderboard is ordered by score descending.

For equal scores, use a deterministic tie-breaker such as earlier latest correct submission or earlier join time.

The host reveal screen shows the top three participants after each question.

The final screen shows the final leaderboard.

## Access and Session Rules

### Host Access

The host receives a private control token when the quiz session is created.

Host-only actions require this token.

Host-only actions include:

- Start quiz.
- Advance to next question.
- End quiz.
- View correct answer during reveal.
- View host-specific quiz state.

### Participant Access

A participant receives a private participant token after joining.

Participant actions require this token.

Participant actions include:

- Connect to the live quiz session.
- Submit an answer.
- Recover participant state after reconnecting.

### Reconnect Behavior

If a host reconnects with a valid control token, the server sends the current host state.

If a participant reconnects with a valid participant token, the server sends the current participant state.

Participant reconnect behavior must preserve whether the participant has already answered the active question.

## Data Concepts

### Question Set

Represents reusable quiz content.

Contains:

- Title.
- Default time per question.
- Questions.

### Question

Represents one quiz prompt.

Contains:

- Question text.
- Optional timer override.
- Answer options.

### Answer Option

Represents one selectable answer.

Contains:

- Option text.
- Order.
- Correctness flag.

### Quiz Session

Represents one live run of a question set.

Contains:

- Quiz code.
- Session status.
- Question order as an ordered array of question IDs.
- Current question position as the current index within the stored question order.
- Host control identity.
- Start and finish timestamps.

### Participant

Represents one joined participant within a quiz session.

Contains:

- Display name.
- Participant identity.
- Join timestamp.
- Connection status.

### Answer Submission

Represents one participant's answer to one question.

Contains:

- Quiz session.
- Participant.
- Question.
- Selected option.
- Correctness result.
- Score awarded.
- Submission timestamp.

## Validation Rules

Question set validation:

- A question set must have at least one question.
- Each question must have two to six options.
- Each question must have exactly one correct option.
- Timers must be positive and within a reasonable quiz range.

Quiz session validation:

- A quiz code must be unique among active sessions.
- A quiz session must be tied to one question set.
- A quiz cannot start without at least one valid question.
- The question order must contain every question from the linked question set exactly once.
- The question order must not contain duplicate, missing, or foreign question IDs.
- The question order can only be replaced before the quiz starts.

Participant validation:

- Display name is required.
- Display name should be trimmed and length-limited.
- Duplicate display names may be allowed, but participant identity must remain unique.

Answer validation:

- A participant may answer each question once.
- Answers are accepted only during the active question window.
- Answers must reference an option belonging to the active question.
- Answers from unknown participants are rejected.

## Error Handling

The system should handle:

- Invalid quiz code.
- Expired or finished quiz session.
- Invalid host control token.
- Invalid participant token.
- Participant joining after the quiz has started.
- Duplicate answer submission.
- Late answer submission.
- WebSocket disconnect.
- WebSocket reconnect.
- Temporary Redis unavailability.
- Temporary PostgreSQL unavailability.

For the initial build, a clear user-facing error state is sufficient for unrecoverable failures.

## Consistency Requirements

The server is the source of truth for:

- Current quiz state.
- Current question.
- Timer start and end times.
- Accepted answers.
- Scores.
- Leaderboard.

Clients must render the state received from the server and must not independently decide whether an answer is accepted or whether a timer has expired.

## Performance Expectations

The system should support multiple participants joining the same quiz session simultaneously.

The system should keep answer submission latency low by using Redis for active quiz operations.

Leaderboard reads should be efficient and should not require scanning all durable answer records during active gameplay.

Database writes should not block time-sensitive socket broadcasts when avoidable.

## Observability Expectations

The system should expose enough logs and metrics to debug live quiz behavior.

Recommended events to log:

- Quiz session created.
- Participant joined.
- Host connected.
- Participant connected.
- Quiz started.
- Question started.
- Answer accepted.
- Answer rejected.
- Question ended.
- Leaderboard calculated.
- Quiz finished.
- Socket disconnected.
- Reconnect handled.
- Persistence failure.

Recommended metrics:

- Active quiz sessions.
- Active WebSocket connections.
- Participants per session.
- Answer submission latency.
- Answer rejection count by reason.
- Redis operation failures.
- Database persistence failures.

## Testing Expectations

The implementation agent should produce tests or test scenarios covering:

- Creating a valid question set.
- Rejecting invalid question sets.
- Creating a quiz session.
- Joining with a valid quiz code.
- Rejecting an invalid quiz code.
- Starting a quiz as host.
- Broadcasting question start.
- Accepting a valid answer.
- Rejecting duplicate answer.
- Rejecting late answer.
- Updating answered count.
- Updating score.
- Producing top three leaderboard.
- Moving to next question.
- Finishing the quiz.
- Reconnecting as participant.
- Reconnecting as host.

## Demo Expectations

The final demo should allow one host browser and multiple participant browser windows to show the real-time flow.

A successful demo should show:

- Host creates or loads a question set.
- Host starts a quiz session.
- Participants join by code or link.
- Waiting room participant count updates live.
- Host starts the quiz.
- Participants receive answer buttons.
- Participants submit answers.
- Host sees answered count update.
- Timer ends.
- Host sees correct answer and top three.
- Quiz advances through questions.
- Final results are displayed.

## AI Agent Delivery Checklist

The AI implementation agent should deliver:

- React SPA with host and participant flows.
- Hono server with REST and WebSocket components.
- PostgreSQL-backed durable data model.
- Drizzle-backed PostgreSQL schema and migrations.
- Redis-backed live quiz state.
- Redis client-backed live state repositories.
- Server-authoritative quiz timer.
- Real-time answer submission.
- One-answer-per-question enforcement.
- Live answered count.
- Score calculation.
- Top-three leaderboard.
- Final leaderboard.
- Basic reconnect behavior.
- Error states for invalid quiz access and invalid answer submission.
- Documentation explaining setup, architecture, data flow, and AI collaboration process.

## Non-Functional Requirements

### Simplicity

Prefer a small, reliable implementation over a broad feature set.

### Correctness

Answer validation, timer enforcement, and scoring must happen on the server.

### Real-Time Responsiveness

The host should see participant count and answered count changes promptly.

### Recoverability

Participants and host should be able to reconnect to the current session state when valid session tokens are available.

### Maintainability

Separate responsibilities between:

- React UI.
- REST setup flow.
- WebSocket live flow.
- Durable persistence.
- Redis live state.
- Scoring logic.
- Timer lifecycle.

### Security

Private host and participant tokens must be unguessable.

Host-only actions must never be allowed from a participant connection.

Participant submissions must never be accepted without validating session identity and question state.

## Completion Criteria

The system is complete when:

- A host can create a quiz session from a question set.
- Participants can join using a code or link.
- Participants wait until the host starts the quiz.
- The host can start the quiz.
- Each question plays according to its effective timer.
- Host screen shows full question and options.
- Participant screen shows only option buttons.
- Participants can submit one answer per question.
- Participants wait after submitting.
- Late and duplicate answers are rejected.
- Host sees answered count during each active question.
- Host sees correct answer and top three after each question.
- Scores are calculated consistently.
- Final leaderboard is available at quiz end.
- Live state is managed through Redis.
- Durable records are persisted in PostgreSQL
