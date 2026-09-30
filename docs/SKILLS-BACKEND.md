---
name: documind-backend
description: Backend engineering conventions for DocuMind's FastAPI service — service-layer isolation, async patterns, auth, database, security, and testing. Read before implementing or reviewing any backend code for DocuMind.
---

# DocuMind — Backend Skills & Conventions

Companion to `documind-master-v3.md` (what to build) and `ARCHITECTURE.md` (how it fits together). This document is *how to write it*: the conventions that keep the backend consistent as it grows past what one person holds in their head.

---

## Purpose

Anyone — human or agent — implementing or reviewing backend code for DocuMind should follow these conventions. They exist so that service boundaries stay clean, security checks aren't reinvented inconsistently per-route, and the codebase reads the same regardless of which phase it was written in.

---

## Core Principles

1. **Service-layer isolation is not optional.** `DoclingService`, `GeminiService`, `EmbeddingService`, `QdrantService` are the *only* places their respective SDKs are imported. A route or another service calling `docling.SomeInternalClass` directly instead of going through `DoclingService` is a defect, not a shortcut.
2. **Fail loud in logs, fail safe in responses.** Internal errors get full detail in structured logs (see Logging below) and a generic, non-leaking message in the API response.
3. **Every document-touching route re-derives ownership.** Never trust that a document ID "must be theirs" because the frontend only shows their own documents — the frontend is not a security boundary.
4. **No abstraction ahead of need.** Build the service interfaces this spec defines; don't add speculative plugin systems or generic "provider" abstractions beyond what `ARCHITECTURE.md`'s ADRs actually call for.

---

## Project Layout Conventions

```
backend/app/
├── api/routes/        one file per resource (auth, documents, processing, chat, export)
├── services/          all third-party SDK integration lives here, nowhere else
├── models/            SQLAlchemy models — one file per table
├── schemas/           Pydantic request/response schemas — mirror models, never expose them directly
├── db/                engine/session setup
├── middleware/         request-id correlation, etc.
└── core/              config.py (env loading) and security.py (JWT + password hashing)
```

Routes depend on services; services depend on nothing in `api/`. If you find yourself importing from `api/` inside `services/`, the boundary has been crossed — restructure instead of adding the import.

---

## API Design Conventions

- All routes versioned under `/api/v1`.
- Resource-oriented paths (`/documents/{id}`), not verb-oriented (`/getDocument`).
- Status codes mean what they say: `200` success, `201` created, `204` no-content (delete), `400` bad request, `401` unauthenticated, `403` authenticated-but-forbidden, `404` not found *or hidden-for-ownership* (see note below), `413` payload too large, `422` validation error, `429` rate limited, `500` unhandled.
- **Ownership failures return `404`, not `403`.** Returning `403` on someone else's document confirms the document ID exists; `404` doesn't. Prefer the response that leaks less.
- List endpoints (`GET /documents/`) accept `page`, `page_size`, and `sort` query params — never return an unbounded list.
- Every error response uses the standard envelope from `documind-master-v3.md` — no ad hoc error shapes per route.

---

## Async & Concurrency Patterns

- Route handlers are `async def`.
- Database access uses SQLAlchemy's async engine + `AsyncSession`, one session per request via dependency injection — never shared across requests, never held open longer than the request.
- **Docling and `sentence-transformers` are synchronous, CPU-bound libraries.** Calling them inside an `async def` blocks the event loop for every concurrent user. Always dispatch them through a thread/process executor (`anyio.to_thread.run_sync` or `loop.run_in_executor`) — including from inside Phase 1's `BackgroundTasks`, which itself still runs on the same event loop.
- The Gemini SDK call is I/O-bound; if the installed SDK offers an async client, prefer it — otherwise wrap the sync call the same way as above rather than blocking.

---

## Database Conventions

- **Alembic from commit one.** `Base.metadata.create_all()` is fine for a throwaway local script, never for anything with data you intend to keep — it has no migration history and breaks the first time a column's shape needs to change after rows exist.
- One `AsyncSession` per request, injected via `Depends`.
- Multi-step writes that must be atomic (e.g., deleting a document: remove Qdrant vectors, remove the file, remove the Postgres row) are not automatically transactional across three different systems — sequence them deliberately (see `ARCHITECTURE.md` §9 for the specific order and why) rather than assuming a DB transaction covers all three.
- Raw SQL is a last resort; the ORM's parameterized queries are the default and close off a whole class of injection bugs by construction.

---

## Security Checklist

Consolidated from the conventions scattered through the master prompt — treat this as the working checklist for any new endpoint:

- [ ] Requires a valid JWT (`Authorization: Bearer`) unless it's `/auth/*` or `/health`
- [ ] `current_user_id` comes only from the verified token dependency — never from the request body, query string, or a client header
- [ ] Any document/resource lookup re-checks `resource.user_id == current_user_id`
- [ ] Uploaded filenames are sanitized and never used to build a filesystem path directly
- [ ] File type validated by both MIME type and extension whitelist
- [ ] Rate limit applied if the route triggers an LLM call or a write
- [ ] No secret, stack trace, or filesystem path can appear in the response body
- [ ] No secret, password, or token can appear in a log line

---

## Error Handling Pattern

Define a small hierarchy of custom exceptions (`DocumentNotFoundError`, `ProcessingFailedError`, `OwnershipError`, `RateLimitExceededError`, ...) raised from services and routes, caught by **one** global FastAPI exception handler that maps each to the standard error envelope and the right status code. This beats a `try/except` block copy-pasted into every route — the mapping lives in one place, so the response shape can't drift route-by-route.

---

## External Service Calls

- Wrap `GeminiService.generate()` calls with a retry policy (`tenacity` — verify version): exponential backoff, 2–3 attempts, transient errors only (timeouts, 5xx, rate-limit responses). Don't retry on a genuine 4xx (bad request) — retrying won't fix a malformed prompt.
- Set explicit timeouts on every outbound call (Gemini, Qdrant) — an outbound call with no timeout is a latent hang waiting to take down a worker.
- On retry exhaustion, surface a clear, specific error ("the assistant is temporarily unavailable") — never an empty string treated as a valid answer.

---

## Testing Conventions

- `pytest` + `pytest-asyncio` for the async routes and services.
- External services (Gemini, Qdrant, Docling) are mocked in unit tests via fixtures or dependency overrides — tests should not make real network calls or cost real API credits.
- Use a fast local test database (SQLite or a disposable test Postgres) for unit tests; reserve a real Postgres + Qdrant integration test tier for CI, run less frequently than the unit suite if speed becomes a concern.
- Every new endpoint ships with: a happy-path test, an ownership-violation test (user A can't touch user B's resource), and a validation-failure test. See `documind-master-v3.md` → Testing Requirements for the full per-file minimums.

---

## Logging Conventions

- Structured logs include: request ID (propagated via middleware), document ID, processing stage, duration, error type + message.
- Never log: API keys, passwords, JWTs, raw document content.
- A log line should be useful to someone debugging at 2am with no other context — include enough to reconstruct what happened, not just that something failed.

---

## Do's and Don'ts

| Do | Don't |
|---|---|
| Call Docling/Gemini/Qdrant only through their `*Service` class | Import a third-party SDK inside a route file |
| Derive `current_user_id` from the verified JWT dependency | Accept a `user_id` field from the request body |
| Return `404` for another user's document | Return `403` and confirm the document exists |
| Run sync ML/parsing libraries off the event loop | Call Docling or `sentence-transformers` directly inside `async def` |
| Use Alembic migrations | Rely on `create_all()` once real data exists |
| Retry Gemini calls on timeouts/5xx only | Retry blindly on every exception, including bad requests |
