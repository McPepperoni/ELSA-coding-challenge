# Home Assignment Review Prep

Use this as a 15-minute walkthrough plus a follow-up Q&A bank. The goal is to sound clear, concrete, and candid: explain what was built, why the architecture looks this way, where correctness lives, and what would change for a larger production deployment.

## 15-Minute Talk Track

### 0:00-1:30 - Product Goal

"I built a real-time multiple-choice quiz app for a host-led room experience. A host creates a question set, starts a live session, shares a quiz code or join link, and controls progression. Participants join, enter a display name, answer each active question once, and wait for the host between questions.

The most important product constraint is role separation: the host sees the full question, answer text, progress, reveal state, and leaderboard. Participants intentionally do not see the full question or answer option text during active play. Their screen only shows numbered option buttons."

Good repo anchors:

- `README.md`: challenge coverage, implemented component, demo flow, verification.
- `SPEC.md`: original behavior and architecture reference.
- `docs/SYSTEM_DESIGN.md`: component diagram and data flow.

### 1:30-3:30 - Architecture Overview

"The app is split into a React/Vite SPA and a Hono server running on Bun. The frontend owns the host and participant screens, local token storage, REST setup calls, and WebSocket client handling. The backend owns all authoritative quiz behavior.

I used REST for setup-style operations: creating question sets, creating sessions, joining participants, and loading reconnect metadata. Once the live quiz starts, WebSockets handle host commands, participant answers, state broadcasts, and timer-driven transitions."

Key decision:

- REST is a better fit for setup because those actions are request/response and durable.
- WebSocket is a better fit for live gameplay because the host and participants need immediate state updates.
- The backend remains authoritative so client refreshes or clock drift do not decide quiz outcomes.

Good repo anchors:

- `back-end/src/http/routes/question-sets.ts`
- `back-end/src/http/routes/quiz-sessions.ts`
- `back-end/src/http/routes/participants.ts`
- `back-end/src/ws/runtime.ts`
- `front-end/src/features/host/index.tsx`
- `front-end/src/features/participant/index.tsx`

### 3:30-5:30 - Data Storage Split and Redis Decision

"I split storage by access pattern. PostgreSQL is the durable store for question sets, questions, options, sessions, participants, answer submissions, and final results. Redis is the live-session store for current status, active question, timers, answer locks, answered counts, connection state, and leaderboard data.

The Redis decision came from the shape of the live path. During an active question, many participants can submit at about the same time, and the host needs answered count and leaderboard updates quickly. I did not want that path to depend on scanning answer submissions in PostgreSQL or waiting on a durable insert before the host sees progress. Redis gives me atomic primitives for exactly the live concerns: sets for one-answer-per-participant locks, hashes for current session state and participant metadata, and sorted-set ordering for leaderboard reads.

PostgreSQL still remains the durable source for quiz content and final history. Redis is not replacing the database; it is the fast coordination layer for an active room. Accepted answers update Redis first for live responsiveness, then a persistence worker writes the durable record asynchronously."

Key decision:

- PostgreSQL gives relational integrity, constraints, migrations, and final auditability.
- Redis gives low-latency, session-scoped coordination for active state, duplicate-answer prevention, answered counts, and live leaderboard ordering.
- The choice is intentionally not "Redis instead of PostgreSQL." It is "PostgreSQL for durable facts, Redis for live state that changes frequently during a game."
- The trade-off is consistency between Redis and PostgreSQL. The runtime reduces that risk with per-session mutation locks, rollback paths for some failures, idempotent answer persistence, and final leaderboard persistence when the quiz finishes.

Good repo anchors:

- `back-end/src/db/schema.ts`
- `back-end/src/redis/live-session-repository.ts`
- `back-end/src/redis/answer-lock-repository.ts`
- `back-end/src/redis/leaderboard-repository.ts`
- `back-end/src/workers/persistence-worker.ts`

### 5:30-7:30 - Correctness Model

"Correctness is concentrated in the backend. The domain modules define pure rules for validation, timers, scoring, state transitions, and leaderboard ranking. The WebSocket runtime applies those rules when commands arrive.

For answers, the server checks that the participant belongs to the session, the session is in `question_active`, the selected option belongs to the active question, the timer has not expired, and the participant has not already answered. Rejected answers do not change score or answered count."

Key decision:

- Server-owned timers prevent client clock manipulation.
- Redis answer locks enforce one accepted answer per participant per question.
- Domain functions are pure, which makes them easy to unit test without Hono, Redis, or PostgreSQL.

Good repo anchors:

- `back-end/src/domain/validation.ts`
- `back-end/src/domain/state.ts`
- `back-end/src/domain/timers.ts`
- `back-end/src/domain/scoring.ts`
- `back-end/src/domain/leaderboard.ts`
- `back-end/test/domain/`

### 7:30-9:30 - Live Runtime and Concurrency

"The WebSocket runtime orchestrates state transitions. Host commands can start the quiz, advance to the next question, or finish. Participant events submit answers. Timer expiry also enters through the same runtime.

I added a per-session mutation lock so overlapping commands serialize. That matters for races such as two host start commands, a finish command during an in-flight answer, or stale timer callbacks after the host already advanced."

Key decision:

- Commands are serialized per quiz session, not globally.
- Timer expiry includes expected question and expected end time checks, so stale scheduled timers no-op if the active question changed.
- Accepted answers update leaderboard before finalization, so finish waits behind in-flight answer mutation and reads a consistent final leaderboard.

Good repo anchors:

- `back-end/src/ws/runtime.ts`
- `back-end/src/ws/timers.ts`
- `back-end/test/ws/runtime.test.ts`

### 9:30-11:00 - Host vs Participant Payloads

"The host and participant do not receive the same state payload. The host state presenter includes the prompt, answer option text, correct answer on reveal, answered count, and leaderboard. The participant presenter strips prompt, option text, correct answer, and other participants' leaderboard data during active play.

The frontend also defends this boundary by validating parsed server events: participant question payloads must not include prompt, time limit, option text, or correctness."

Key decision:

- Sensitive role separation is enforced on the backend presenter layer.
- Frontend parsing adds another guard against accidentally rendering malformed participant payloads.
- Tests assert that participant payloads do not contain hidden question or answer text.

Good repo anchors:

- `back-end/src/ws/state-presenters.ts`
- `back-end/src/types/events.ts`
- `front-end/src/realtime/index.ts`
- `front-end/test/realtime/serverEvents.test.ts`
- `back-end/test/ws/runtime.test.ts`

### 11:00-12:30 - Performance Choices

"The main performance choice is to keep live gameplay on Redis and WebSockets. Answer submission does not need to scan PostgreSQL. Redis set operations handle answer locks and answered count, and a sorted-set-backed leaderboard model supports efficient top score reads.

Durable writes are queued through a persistence worker so normal WebSocket broadcasts are not blocked by PostgreSQL latency."

Key decision:

- Low-latency answer handling is prioritized over synchronous durable writes.
- Persistence failures are logged and retried, answer insertion is idempotent, and retry exhaustion is an explicit production-hardening gap because the assignment worker does not have durable replay or dead-letter storage.
- The current worker is in-process, which is fine for the assignment scope. In production I would move this to a durable queue or outbox pattern.

Good repo anchors:

- `back-end/src/redis/answer-lock-repository.ts`
- `back-end/src/redis/leaderboard-repository.ts`
- `back-end/src/workers/persistence-worker.ts`
- `back-end/test/workers/persistence-worker.test.ts`

### 12:30-14:00 - Trade-Offs and Limitations

"I optimized for a clear, demonstrable full-stack system rather than broad product scope. The current design has a strong correctness core, role-specific payloads, and a local production-style Docker setup.

The biggest production trade-offs are around hardening rather than core behavior. The persistence worker is in-process instead of a durable background system. Observability is targeted logging rather than full metrics and dashboards. The frontend supports token-based recovery on refresh, but it is not a full automatic reconnect/backoff strategy. Horizontal scaling is feasible because live state is in Redis and durable state is in PostgreSQL, but WebSocket fanout and cross-instance command ordering would need sticky sessions, shared pub/sub, or a distributed session lock."

Good repo anchors:

- `compose.yaml`
- `README.md`
- `docs/tasks/13_demo-observability-docs_pending.md`

### 14:00-15:00 - Closing Summary

"The core architectural idea is simple: PostgreSQL stores durable quiz facts, Redis stores fast live state, and the Hono WebSocket runtime is the authority that connects them. React renders separate host and participant experiences, but it does not decide correctness. That separation lets me explain and test the key risks: timing, duplicate answers, score consistency, privacy between roles, and final persistence."

## Architecture Review: What I Would Improve For Scale

Use this as an appendix. In the 15-minute walkthrough, summarize only the first sentence and one or two priorities unless the interviewer asks for deeper production detail.

"The current architecture is a good assignment-sized version of the system. It has the right separation points: the browser renders role-specific state, Hono owns the live commands, Redis owns fast active-session coordination, PostgreSQL owns durable records, and the persistence worker keeps gameplay from waiting on database writes.

For production scale, I would keep those boundaries but replace the in-process pieces with shared or durable infrastructure."

Priority improvements:

1. WebSocket fanout and multi-instance command ordering

   The current socket hub and per-session mutation lock are in memory, so they work cleanly for one backend process. With multiple backend instances, a participant could connect to one process while the host connects to another, and local socket maps would not be enough to broadcast across all connected clients. The in-process mutation lock also would not protect shared Redis/PostgreSQL mutations across instances unless routing keeps a quiz session on one backend.

   Production options:

   - Use sticky sessions so all sockets and commands for a quiz session land on the same backend instance.
   - Add Redis pub/sub or a broker-based fanout layer so any backend instance can publish quiz events and every instance can deliver them to its local sockets.
   - Add a distributed session-scoped lock, such as a Redis lock or database advisory lock, if commands for the same quiz session can reach multiple backend instances.
   - Keep Redis/PostgreSQL as shared state so reconnect can recover even if a socket process changes.

2. Durable background processing

   The current persistence worker is in-process, which is enough to demonstrate that answer broadcasts do not block on PostgreSQL. The scaling risk is process loss: queued but unwritten events can disappear if the backend crashes. After retry exhaustion, the current assignment worker logs the failure and continues; it does not have durable replay or dead-letter storage.

   Production options:

   - Move accepted-answer and final-leaderboard events to a durable queue.
   - Or use a PostgreSQL outbox table written transactionally, then drained by separate workers.
   - Track queue depth, retry count, dead-letter events, and persistence lag.

3. Broadcast efficiency

   The runtime currently favors correctness and simplicity by rebroadcasting session state after important events. As participant count grows, recalculating and sending participant-specific state after every answer can become expensive.

   Production options:

   - Send smaller delta events for high-frequency updates, such as answered count changes.
   - Batch or throttle host progress updates when many answers arrive at once.
   - Keep full `session_state` messages for reconnects, question transitions, and recovery paths.
   - Avoid recomputing participant views that did not change.

4. Redis lifecycle and recovery

   Redis is the right live coordination layer, but production needs clearer lifecycle rules around active quiz keys.

   Production options:

   - Add TTLs for finished or abandoned session keys.
   - Define a recovery path if Redis loses active state during a quiz.
   - Reconcile final results from persisted answer submissions if needed.
   - Monitor Redis errors, latency, memory usage, key count, and persistence-worker lag.

5. Observability

   The current implementation has targeted errors and logs. Production needs enough observability to debug live incidents quickly.

   Production options:

   - Structured logs for session created, participant joined, socket connected, question started, answer accepted/rejected, question ended, leaderboard persisted, and reconnect handled.
   - Metrics for active sessions, active sockets, participants per session, answer latency, rejection reasons, Redis failures, database failures, worker queue depth, retry count, and timer transition failures.
   - Tracing around answer submission from WebSocket receive through Redis update, persistence enqueue, and broadcast.

6. Load and resilience testing

   The current tests cover domain rules, runtime races, persistence retries, Redis repositories, and frontend parsing. The next level is scenario testing under load.

   Production options:

   - Simulate many participants answering at once.
   - Test reconnect storms after network interruption.
   - Test Redis downtime and recovery behavior.
   - Test worker retry exhaustion and dead-letter handling.
   - Test multi-instance WebSocket fanout and distributed-lock behavior.

How to say this in the interview:

"The assignment architecture is intentionally small, but it has the right seams. Shared Redis and PostgreSQL mean the next scaling step is not a rewrite. I would mainly replace in-process pieces with durable or shared infrastructure: distributed WebSocket fanout, distributed session command ordering, a durable queue or outbox for persistence, better observability, and load tests around bursty answer submission."

## Likely Q&A Appendix

### Why React SPA plus Hono on Bun?

React/Vite keeps the UI small and easy to iterate, while Hono on Bun gives a compact TypeScript backend with REST and WebSocket support in the same project. For an interview assignment, that is a good balance: enough separation to show real architecture, without overbuilding multiple services.

If this became a larger product, I would keep the API boundary but consider stronger operational conventions around deployments, migrations, telemetry, and background processing.

### Why both PostgreSQL and Redis?

They solve different problems. PostgreSQL is the durable source for authored content, participants, sessions, submissions, and final results. Redis is the live state engine for active sessions, answer locks, answered counts, connection state, and leaderboard reads.

The interview way to say it:

"I chose Redis because the active quiz path is coordination-heavy and latency-sensitive. When many people answer at once, Redis can atomically handle first-answer locking and answered count. The runtime then updates leaderboard state, queues persistence, and broadcasts progress quickly. PostgreSQL is still where the durable facts live."

Using only PostgreSQL would simplify consistency but make the active answer path heavier, especially for duplicate-answer checks, answered counts, and leaderboard reads under bursty submissions. Using only Redis would make the demo responsive but weaker for durable history, relational constraints, migrations, and auditability.

### Why not just use PostgreSQL transactions for live state?

That would be a reasonable simpler version for a smaller or slower-paced app. I chose Redis because this assignment specifically emphasizes real-time participation and leaderboard updates. Redis lets the runtime keep hot operations narrow and session-scoped:

- `SADD` plus `SCARD` accepts the first answer and gets answered count.
- Hashes store the current live session state and connection metadata.
- A sorted set plus metadata hashes supports ordered leaderboard reads without recomputing from all submissions.

The trade-off is having two stores. I mitigated that by making PostgreSQL the durable system of record, keeping Redis scoped to active quiz runtime state, and persisting accepted answers/final results through the worker.

### What Redis data structures matter most?

The most important ones are:

- Live session hash: stores status, question order, active question id, position, start time, and end time.
- Answered participant set: one key per session/question to enforce one accepted answer per participant and calculate answered count.
- Leaderboard sorted set: orders participants by negative score, with tie-break information embedded in the sorted-set member.
- Participant metadata hashes: keep display name, score, correct count, join time, and latest correct submission time available for leaderboard rows.

This is why Redis was a natural fit: the runtime needed atomic set membership, fast counters, and ordered reads more than it needed relational joins during active play.

### Where does hashing happen in the app?

There are two different meanings of "hash" in this codebase, and I would explain them separately in the interview.

Cryptographic token hashing:

- `back-end/src/http/tokens.ts` generates private host and participant tokens with `randomBytes(32).toString('base64url')`.
- The same token service hashes private tokens with SHA-256: `createHash('sha256').update(token).digest('hex')`.
- `back-end/src/http/routes/quiz-sessions.ts` returns the raw host token once to the client, but stores only `hostTokenHash` in PostgreSQL.
- `back-end/src/http/routes/participants.ts` returns the raw participant token once to the client, but stores only `participantTokenHash`.
- `back-end/src/db/schema.ts` has unique indexes for `quiz_sessions.host_token_hash` and `participants.participant_token_hash`.
- REST metadata routes and WebSocket auth hash the incoming token again, then look up the stored hash through `findByHostTokenHash` or `findByTokenHash`.

How to say it:

"The server never needs to store the raw host or participant control token. It generates a high-entropy private token, gives it to the browser once, stores a SHA-256 hash, and authenticates later requests by hashing the presented token and looking up the hash."

Redis hashes:

- Redis "hashes" are data structures, not cryptographic hashes.
- `back-end/src/redis/live-session-repository.ts` uses Redis hashes for live session fields and participant connection state.
- `back-end/src/redis/leaderboard-repository.ts` uses metadata hashes alongside a sorted set so leaderboard reads can fetch participant display name, score, correct count, and tie-break fields.

Things that are not part of app security:

- Test strings like `hash:host-token` are fake hashes used by unit tests.
- `sha512` entries in lockfiles are package integrity hashes, not application authentication logic.

Production hardening note:

"For this assignment, SHA-256 is reasonable because the token is high entropy and randomly generated, not user-chosen like a password. For production, I would add token expiry/rotation, avoid leaking WebSocket query tokens through logs, and consider secure same-site cookies or another transport that reduces token exposure."

### What are the risks of choosing Redis?

The main risk is consistency drift between live Redis state and durable PostgreSQL records. For example, Redis could accept an answer and update live score before the durable write succeeds. In this implementation, accepted answer events go through an idempotent persistence worker with retries, and final leaderboard rows are queued for persistence at quiz finish.

For production, I would harden this with a durable queue or outbox pattern, plus metrics around persistence lag and retry exhaustion. I would also define an explicit recovery job that can reconcile final results from persisted submissions if Redis state is lost before finish.

### Where is the server authoritative?

The server owns quiz status, current question, timer windows, answer acceptance, scoring, and leaderboard ordering. Client timers are visual only. The backend compares answer submission time against the live session end time before accepting an answer.

Main anchors: `back-end/src/ws/runtime.ts`, `back-end/src/domain/validation.ts`, and `back-end/src/domain/timers.ts`.

### How are duplicate answers prevented?

The backend validates whether the participant has already answered, then uses Redis answer locks to accept only the first answer. The runtime also handles the race where the initial validation says not answered but the lock rejects a duplicate. Rejected duplicate answers do not score, do not increment answered count, and do not enqueue persistence.

Main anchors: `back-end/src/redis/answer-lock-repository.ts` and `back-end/src/ws/runtime.ts`.

### How are late answers prevented?

The live session stores the server-side question end time. On answer submission, validation rejects answers where `submittedAt` is at or after `questionEndsAt`. Timer expiry also transitions the session out of active state, so late submissions can fail either by timestamp or wrong state.

Main anchors: `back-end/src/domain/validation.ts` and `back-end/src/ws/runtime.ts`.

### How does the leaderboard stay deterministic?

Scores sort descending. Ties are broken by earlier latest correct submission, then earlier join time, then participant id. The pure domain version expresses the ranking rule, and the Redis leaderboard repository encodes the same ordering for live reads.

Main anchors: `back-end/src/domain/leaderboard.ts` and `back-end/src/redis/leaderboard-repository.ts`.

### How are host and participant views kept separate?

The backend has separate state presenters. The host presenter maps active questions to prompt plus full option text. The participant presenter maps only question id, position, and option positions. During reveal, the host gets the correct option and top leaderboard; participants stay in a waiting state until final, where they see only their own result row.

Main anchors: `back-end/src/ws/state-presenters.ts`, `back-end/src/types/events.ts`, and `front-end/src/realtime/index.ts`.

### How does reconnect work?

REST and WebSocket auth use private tokens. The frontend stores the host token or participant token in local storage. On refresh or direct navigation back to the session page, the client loads metadata using the token and opens a WebSocket with the same private credential. The backend presenters then return the current host or participant state.

This is token-based recovery, not a fully polished production reconnect system. I would add automatic reconnect with backoff and clearer connection recovery UX as a future improvement.

Main anchors: `back-end/src/http/tokens.ts`, `back-end/src/ws/auth.ts`, `front-end/src/lib/index.ts`, `front-end/src/features/host/index.tsx`, and `front-end/src/features/participant/index.tsx`.

### What happens if persistence fails?

Accepted answer and final leaderboard events are enqueued to the persistence worker. The worker retries temporary failures with backoff and logs contextual failure details. Answer persistence is idempotent, so duplicate events do not create duplicate durable answer rows.

The current worker is in-process. That keeps the assignment simple, but after retry exhaustion it logs and moves on; it does not have durable replay or dead-letter storage. A production system should use a durable queue, outbox table, or separate worker process so queued events survive process restarts and failed events are inspectable.

Main anchors: `back-end/src/workers/persistence-worker.ts` and `back-end/test/workers/persistence-worker.test.ts`.

### What are the main scalability properties?

The state split supports scaling better than a purely in-memory backend. PostgreSQL is shared durable state, Redis is shared live state, and quiz data is scoped by session id. Within one backend process, the runtime uses per-session mutation locks so one quiz session serializes its own critical operations without blocking unrelated sessions.

The main missing production scaling pieces are WebSocket fanout and cross-instance command ordering. I would add sticky sessions or Redis pub/sub so broadcasts reach sockets connected to other nodes, plus a distributed session lock if commands for the same quiz can reach multiple backend instances.

### What is the security model?

Host and participant tokens are unguessable random values. Only hashes are stored in PostgreSQL. Host routes and host WebSocket actions require a host token. Participant routes and answer submissions require a participant token. Participant joins are only allowed while the session is still in the waiting room.

The current client stores tokens in `localStorage`, which is simple for an assignment but vulnerable if the frontend has an XSS issue. WebSocket tokens are also passed in the query string, so production logging and proxy configuration should avoid recording them. For production I would add token expiry/rotation and consider secure same-site cookies or another transport that reduces token exposure.

Main anchors: `back-end/src/http/tokens.ts`, `back-end/src/http/routes/quiz-sessions.ts`, `back-end/src/http/routes/participants.ts`, and `back-end/src/ws/auth.ts`.

### What was the hardest technical trade-off?

The key trade-off was responsiveness versus durability on the answer path. Synchronously writing every answer to PostgreSQL before broadcasting would make consistency easy to reason about but would couple gameplay latency to database latency. I chose Redis for live scoring and queued durable persistence, then added idempotent writes and retries to reduce the risk.

For a production system, I would keep that shape but replace the in-process queue with a durable outbox or message queue.

### What would you improve next?

The next improvements would be operational:

- Add structured logs and metrics for active sessions, WebSocket connections, answer latency, rejection reasons, Redis failures, and database failures.
- Replace the in-process persistence worker with a durable queue or outbox.
- Add automatic WebSocket reconnect/backoff in the frontend.
- Add cross-instance WebSocket fanout with Redis pub/sub or another broker.
- Tighten production CORS and environment-specific security settings.
- Add end-to-end browser coverage for the full host plus multiple participant demo flow.

### How did AI collaboration affect the work?

AI was used as a structured pair: initial brainstorming, rough specification, task breakdown, implementation planning, TDD assistance, and review. Generated or heavily AI-assisted code is marked with `AI Generated code <PURPOSE>`. The README lists the verification commands used for the submission, including backend tests/typecheck and frontend tests/build/lint, plus manual review of token handling, role-specific events, duplicate answer locks, late answer rejection, and participant answer visibility.

The practical benefit was speed and structure. The risk was over-accepting generated code, so the workflow emphasized tests, typed boundaries, security-sensitive manual review, and explicit documentation of AI-assisted areas.

Main anchors: `README.md`, `SPEC.md`, `docs/tasks/`, and the `AI Generated code <PURPOSE>` markers in source and tests.

## Short Answers To Keep Ready

- "The server is authoritative. The frontend renders state; it does not decide whether an answer counts."
- "PostgreSQL is for durable facts. Redis is for live coordination during an active room."
- "I chose Redis because the hot path needs atomic duplicate-answer locks, answered counts, and fast leaderboard reads."
- "Redis is not replacing PostgreSQL; it keeps the live game responsive while PostgreSQL keeps the audit trail."
- "There are two hash stories: SHA-256 token hashes for auth, and Redis hashes as live-state data structures."
- "The server stores token hashes, not raw host or participant control tokens."
- "Participants never receive full prompt or option text during active questions."
- "Duplicate answers are rejected with Redis answer locks."
- "Late answers are rejected against server-side timer windows."
- "The persistence worker keeps WebSocket broadcasts from waiting on PostgreSQL writes."
- "The biggest production hardening item is replacing the in-process worker with a durable queue or outbox."
- "Horizontal backend scaling would need WebSocket fanout and cross-instance command ordering, such as sticky sessions, pub/sub, or a distributed session lock."
