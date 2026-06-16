# Backend Data Model

Status: completed
Priority: 03

## Goal

Implement the durable PostgreSQL data model using Drizzle ORM and migrations.

## SPEC References

- `SPEC.md` > Backend Data Access Stack
- `SPEC.md` > PostgreSQL
- `SPEC.md` > Data Concepts
- `SPEC.md` > Validation Rules
- `SPEC.md` > AI Agent Delivery Checklist

## Context

PostgreSQL is the long-term source of truth for created quiz content and completed quiz records. Drizzle ORM is required for durable data access. The data model must support question sets, questions, answer options, quiz sessions, participants, answer submissions, and final quiz results.

## Dependencies

- Task 01 for backend structure and env.
- Task 02 if using Docker for local PostgreSQL.

## Implementation Scope

- Install and configure `drizzle-orm`, `drizzle-kit`, and `pg` / `node-postgres`.
- Define Drizzle schema in the backend `db` layer.
- Add migration generation and migration run scripts.
- Add repository functions for durable records needed by REST, WebSocket, and persistence worker tasks.
- Model quiz codes, host tokens, participant tokens, ordered questions/options, timestamps, answer correctness, awarded score, and final leaderboard records.

## Out Of Scope

- Do not implement REST routes or WebSocket event handling.
- Do not implement Redis live state.
- Do not build frontend screens.

## Expected Files And Folders

- `back-end/src/db/`
- `back-end/src/db/schema.ts`
- `back-end/src/db/client.ts`
- `back-end/src/db/repositories/`
- `back-end/drizzle.config.ts`
- `back-end/drizzle/` or `back-end/migrations/`
- `back-end/package.json`

## Acceptance Criteria

- Drizzle schema represents all durable data concepts from `SPEC.md`.
- Each question set can have one or more ordered questions.
- Each question can have two to six ordered answer options and exactly one correct answer at validation time.
- Quiz sessions store status, quiz code, current question position, host control identity, and timestamps.
- Participants store display name, unique identity, join timestamp, and session association.
- Answer submissions store selected option, correctness result, score awarded, and timestamp.
- Migrations can be generated and applied against local PostgreSQL.

## Verification

- Run backend typecheck.
- Run Drizzle migration generation.
- Apply migrations to a local PostgreSQL database.
- Run a small repository smoke test or script that creates a question set, quiz session, participant, and answer submission.

