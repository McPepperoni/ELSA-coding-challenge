# Frontend Foundation

Status: pending
Priority: 10

## Goal

Build the frontend foundation for REST calls, WebSocket connection management, app state, and session token persistence.

## SPEC References

- `SPEC.md` > Technology Stack > React SPA
- `SPEC.md` > Access and Session Rules
- `SPEC.md` > Reconnect Behavior
- `SPEC.md` > Screen Behavior Requirements
- `SPEC.md` > Error Handling

## Context

The React SPA hosts both host and participant experiences. It talks to REST for setup/join flows and WebSocket for live quiz state. Host and participant session tokens must be locally persisted for reconnect support. Clients render server state and must not independently decide whether an answer is accepted or a timer has expired.

## Dependencies

- Task 01 for frontend structure and env.
- Task 06 for REST API contracts.
- Task 07 for WebSocket event contracts.

## Implementation Scope

- Replace starter Vite content with an app shell that can route between host and participant flows.
- Add API client functions for question set creation, session creation, participant join, and metadata reads.
- Add WebSocket client with connection status, reconnect handling, and typed event parsing.
- Add local token persistence for host and participant sessions.
- Add shared state helpers for rendering server quiz states.
- Add reusable UI components needed by later host and participant screens.

## Out Of Scope

- Do not implement complete host or participant screens; tasks 11 and 12 own those.
- Do not invent client-side scoring or timer authority.
- Do not show participant full question text during active question.

## Expected Files And Folders

- `front-end/src/api/`
- `front-end/src/realtime/`
- `front-end/src/features/shared/`
- `front-end/src/components/`
- `front-end/src/lib/`
- `front-end/src/types/`
- `front-end/src/App.tsx`

## Acceptance Criteria

- Frontend can call backend REST endpoints through one API layer.
- Frontend can open and recover WebSocket connections through one realtime layer.
- Host and participant tokens persist locally and can be cleared.
- App renders clear connection and unrecoverable error states.
- Client state is derived from server events.
- Frontend build passes.

## Verification

- Run frontend typecheck/build.
- Run frontend lint if configured.
- Manually inspect that raw env access only happens in `front-end/src/config/env.ts`.
- With backend available, smoke test API and WebSocket connection setup.

