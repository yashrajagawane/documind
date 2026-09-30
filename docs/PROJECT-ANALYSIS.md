# DocuMind — Project Analysis

## What the documents establish

DocuMind is a focused document-upload, parsing, retrieval, and conversation product. The core user journey is:

1. Register or sign in.
2. Upload a supported document.
3. Track asynchronous processing until the document is ready.
4. Inspect extracted content and metadata.
5. Ask questions and receive grounded answers with clickable source citations.

## System boundaries

The Next.js frontend communicates only with the FastAPI API. The backend owns authentication, document ownership checks, parsing, chunking, embeddings, vector search, generation, and lifecycle state. PostgreSQL is the source of truth for users and document metadata; Qdrant is a rebuildable retrieval index; the filesystem stores uploaded bytes in V1.

## Key implementation rules

- Third-party SDKs belong only in their service classes.
- Every document operation derives the user identity from the verified JWT and re-checks ownership.
- Ownership failures should be returned as `404` so document existence is not disclosed.
- CPU-bound parsing and embedding work must run outside the async event loop.
- Database schema changes use Alembic migrations, not `create_all()` for persistent data.
- API errors use one consistent envelope and must not leak secrets, stack traces, or paths.
- Frontend HTTP calls go through `frontend/lib/api.ts`; components do not call `fetch` directly.
- TanStack Query owns server state; local React state owns UI state.
- Access tokens remain in memory and are never stored in `localStorage`.
- New interactive UI must include keyboard access, visible focus, semantic HTML, labels, live status announcements, reduced-motion support, and non-color status signals.

## Product/design direction

The interface is intentionally calm and reading-oriented: dark surfaces, restrained purple accent, Inter/Geist Sans for UI and prose, and a monospace face for verbatim source content. Layouts are an application shell with navigation and a document detail view split between preview and chat. Real processing progress and verifiable citations are the primary sources of personality.

## Delivery sequence

V1 should establish the vertical slice: authentication, upload, background processing, document library, detail view, grounded chat, source citations, and export. The roadmap then moves reliability to Celery/Redis, enables cross-document search, adds collaboration, and later considers integrations and enterprise hardening.

## Main risks and mitigations

| Risk | Mitigation |
|---|---|
| In-process background work is lost on restart | Document the limitation in V1; migrate to Celery/Redis in V1.2 when reliability requires it |
| Provider/library APIs change | Keep Docling, embeddings, Qdrant, and Gemini behind service boundaries and verify versions before upgrades |
| Cross-user data exposure | Derive identity only from JWTs and apply ownership filters to Postgres and Qdrant queries |
| Qdrant collection sprawl | Start simple per document; migrate to a shared filtered collection when cross-document search approaches |
| Scope creep | Require the current milestone's success criteria before starting the next milestone |

## Recommended first implementation slice

Build the backend foundation first: configuration, logging/request IDs, Alembic, async database session, user/document models, JWT auth, and health checks. Then add the upload-to-ready pipeline and a minimal frontend vertical slice. This keeps the security and lifecycle boundaries in place before UI breadth grows.
