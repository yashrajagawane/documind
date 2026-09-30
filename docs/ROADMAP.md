# DocuMind — Roadmap

Companion to `documind-master-v3.md` (build spec) and `ARCHITECTURE.md` (system design). This document covers *sequencing and direction*: what ships when, and what comes after V1.

---

## Vision

Turn complex documents into structured, searchable knowledge — not just stored files, but something you can question, trust the answers from, and pull structured data out of. V1 proves that loop for one user and one document at a time; everything past V1 is about extending that loop across more documents, more people, and more places DocuMind's knowledge can be reached from.

---

## Guiding Principles

- A smaller number of reliable, tested features beats a longer list of half-finished ones — this governs milestone scope, not just code quality.
- Nothing ships to "done" without the grounding guarantee holding: an answer is either sourced from the document or the app says it doesn't know.
- Every milestone after V1 should be deferrable without breaking what came before — no milestone should require re-architecting the one before it (see `ARCHITECTURE.md` §10 for the two migrations that *are* pre-planned).

---

## V1 Release Plan

V1 is the four phases from `documind-master-v3.md`, reframed here as milestones with a theme and a one-line "what a user can do now" check.

| Milestone | Timeframe | Theme | User can now... |
|---|---|---|---|
| M0 — Foundations | Days 1–3 | Identity + ingestion | Register, log in, upload a document, and watch it move through real processing stages |
| M1 — Understand | Days 4–6 | Structure surfaced | Preview the parsed document, browse extracted tables, see stats, export in five formats |
| M2 — Converse | Days 7–10 | Grounded Q&A | Ask questions about a document and get answers with page/section citations, with no hallucination when the answer isn't there |
| M3 — Harden ("V1.0") | Days 11–14 | Ready to show | Use the app without hitting an unhandled error, on mobile or desktop, with rate limits and tests protecting it, and a README that lets someone else run it |

M3 is the "V1.0" tag — the point where `documind-master-v3.md`'s Success Criteria are fully met.

---

## Post-V1 Roadmap

Ordered by dependency, not strict calendar time — a solo build should treat this as "what's next," not a committed schedule.

### V1.1 — Quality of Life
Small, high-leverage additions that don't touch the architecture:
- Multi-file batch upload
- Folders/collections and tagging for documents
- Saved chat threads per document (persist Q&A history, not just the current session)
- Shareable read-only view link for a single document's summary
- Keyboard shortcuts for power users (upload, focus chat input, switch documents)

### V1.2 — Reliability & Scale
The two migrations `ARCHITECTURE.md` §10 pre-planned, plus their prerequisites:
- Celery + Redis for background processing (crash-safe, retryable jobs)
- Object storage (S3-compatible) for uploaded files, removing the single-host filesystem constraint
- Shared Qdrant collection with `user_id`/`document_id` filtering, replacing per-document collections
- `/api/v1/metrics` endpoint + a small dashboard (request volume, processing duration, chat volume)
- Redis-backed rate limiting (so limits hold across more than one backend instance)

### V2.0 — Cross-Document Intelligence
The features that only make sense once V1.2's shared-collection migration is done:
- "Ask across all your documents" — retrieval scoped to a user's entire library, not one document
- Document comparison ("what changed between these two contracts?")
- Auto-tagging/classification on ingest
- Scheduled re-summarization when a document is re-uploaded or replaced

### V2.5 — Collaboration
- Workspaces/teams, replacing the single-user-per-account model
- Role-based access (owner / editor / viewer) per workspace
- Shared document libraries within a workspace
- Comments or annotations anchored to a specific citation/source chunk

### V3.0 — Platform & Integrations
- Public API with issued API keys for third-party developers
- Inbound connectors (Slack, Notion, Google Drive, Dropbox) for auto-ingest
- Outbound webhooks (`document.ready`, `document.failed`)
- Self-hosted/on-prem deployment guide
- Enterprise-track hardening (audit logging, SSO) if there's real demand — see Non-Goals below before committing to this

---

## Explicitly Deferred / Not Planned

Mirrors `documind-master-v3.md`'s Non-Goals, kept here so the roadmap doesn't quietly reintroduce them:

- Native mobile app — revisit only if the web app's responsive layout genuinely proves insufficient
- SSO/enterprise auth — revisit only under real enterprise demand, not speculatively
- Self-serve billing — out of scope until there's a pricing model to bill against
- Fine-tuned or self-hosted models — Gemini via API is the bet for as long as quality/cost hold up

---

## Success Metrics Per Stage

Qualitative, matching a portfolio/demo-scale project rather than a company with traffic analytics:

- **V1:** a stranger can upload a 20-page PDF and get a correctly-cited answer to a real question about it in under two minutes, end to end.
- **V1.2:** the same flow survives a backend restart mid-processing without losing the job.
- **V2.0:** a user with ten documents can ask a question that only cross-document retrieval could answer, and get a correctly-sourced answer naming which document it came from.
- **V2.5:** two people in the same workspace can see the same document library and know who can edit vs. only view.

---

## Dependencies & Risks

| Risk | Watch for |
|---|---|
| Gemini API pricing/quota changes | `GeminiService`'s isolation (per `ARCHITECTURE.md` ADR table) means switching providers touches one file, not the whole app — but budget for the migration effort itself, not just the code change |
| Docling API instability across versions | The Library Version Rule exists specifically for this; re-verify on every Docling upgrade, not just at initial build |
| Qdrant self-hosted operational burden as data grows | This is the concrete trigger to evaluate Qdrant Cloud (managed) alongside the V1.2 migration, rather than scaling the self-hosted instance indefinitely |
| Scope creep into V2+ features before V1's grounding guarantee is airtight | Hold the line per Guiding Principles — a milestone doesn't start until the previous one's success criteria are met |

---

## Proposing a Change

For a solo build, keep this light: log a new idea under whichever milestone it best fits (or a new "Under Consideration" note at the bottom of this file) before promoting it into active work, so scope changes are visible in the document itself rather than only in memory.
