# DocuMind — Architecture Decisions

Status: Active  
Last Updated: 2026-10-01

This is the permanent ADR log. New implementation must follow accepted ADRs; changes require a new ADR or a superseding record.

## ADR-001 — Modular monolith with FastAPI service boundaries

**Status:** Accepted  
**Date:** 2026-10-01

**Context/problem:** DocuMind needs identity, document lifecycle, processing, retrieval, and exports, but has a small team and V1 scope.

**Options:** Microservices; a monolithic route-heavy API; a modular FastAPI service-layer application.

**Decision:** Use a modular monolith. Routes validate/delegate; domain and provider work lives in services; provider SDKs are isolated to dedicated services.

**Reason/trade-offs:** It minimizes operational complexity without coupling external SDK behavior to HTTP handlers. It does not independently scale a worker until demand requires it.

**Consequences/migration:** The processing adapter can become a separate worker process without changing routes or service contracts. No microservice split without measured need.

## ADR-002 — PostgreSQL is canonical; Qdrant is a derived index

**Status:** Accepted  
**Date:** 2026-10-01

**Context/problem:** Identity/lifecycle need relational integrity; semantic retrieval needs vector search.

**Options:** Store all data in PostgreSQL/pgvector; make Qdrant authoritative; PostgreSQL canonical with Qdrant derived.

**Decision:** PostgreSQL owns users, documents, jobs, artifact versions, and access. Qdrant holds rebuildable point payload/vector data only.

**Reason/trade-offs:** Canonical ownership supports recovery and deletion correctness. It introduces reconciliation work and separate operational dependency.

**Migration path:** Rebuild the index from active parsed artifact/version when Qdrant is lost or provider changes.

## ADR-003 — Storage abstraction; local volume only for local Compose

**Status:** Accepted  
**Date:** 2026-10-01

**Context/problem:** Existing V1 architecture names a filesystem, but public free hosts have ephemeral disks.

**Options:** Host on local disk; require object storage later; introduce a simple private storage port now.

**Decision:** Implement `StorageService` interface from first upload. Local mounted storage is dev/local Compose. Hosted deployments use a private S3-compatible provider.

**Reason/trade-offs:** A small seam prevents data loss/rewrite and keeps storage vendor-neutral. The initial implementation has two adapters to test.

**Migration path:** Copy objects, update opaque storage keys/checksums, then switch adapter; clients never receive object keys.

## ADR-004 — One shared Qdrant collection with mandatory filters

**Status:** Accepted; reconciles a conflict  
**Date:** 2026-10-01

**Context/problem:** The master prompt suggests per-document collections early; the architecture document plans a future shared collection and cross-document retrieval requires it.

**Options:** Per-document collections then migration; shared collection with strict `user_id`, `document_id`, and `artifact_version` filtering.

**Decision:** Start V1 shared. Every search/delete/upsert has server-controlled metadata filters; PostgreSQL ownership is checked first.

**Reason/trade-offs:** It avoids collection sprawl and a later vector migration. Filtering must be carefully tested to preserve tenant isolation.

**Migration path:** If collection sharding is ever needed, route through QdrantService; external API remains document scoped.

## ADR-005 — Durable job contract now; V1 BackgroundTasks adapter only

**Status:** Accepted  
**Date:** 2026-10-01

**Context/problem:** Documentation chooses BackgroundTasks for V1 but acknowledges crash loss. CPU-heavy parsing must not block the async event loop.

**Options:** Celery/Redis immediately; untracked BackgroundTasks; persisted job contract with BackgroundTasks adapter.

**Decision:** Persist `processing_jobs`, lease/attempt state, and idempotent artifact/version work from the start. V1 adapter dispatches in-process after commit; sync CPU work uses bounded executor. V1.2 replaces only the adapter with durable queue/worker.

**Reason/trade-offs:** Keeps V1 infrastructure light while preventing lifecycle design debt. V1 still cannot claim uninterrupted job execution across process loss.

**Migration path:** Add queue producer/consumer, preserve job IDs/state transitions/leases, run reconciliation during cutover.

## ADR-006 — Access JWT in memory; rotating refresh session in secure cookie

**Status:** Accepted  
**Date:** 2026-10-01

**Context/problem:** Browser auth needs low XSS exposure and controlled session revocation.

**Options:** LocalStorage tokens; cookie-only server sessions; in-memory access JWT plus HTTP-only refresh token.

**Decision:** Short-lived access JWT is React-context memory only. Refresh token is HttpOnly/Secure/SameSite=Lax cookie, represented by hashed, rotating server session record.

**Reason/trade-offs:** Limits script access and permits rotation/revocation. Refresh endpoint/cookie deployment needs careful CORS/domain configuration.

**Migration path:** Token signing/issuer changes invalidate sessions deliberately; user re-authenticates.

## ADR-007 — RAG citations are retrieval-derived, not model-authored

**Status:** Accepted  
**Date:** 2026-10-01

**Context/problem:** A model can hallucinate source references, and uploaded text can be prompt-injection content.

**Options:** Let model format citations; return only retrieved metadata; use retrieval-derived citations plus injection-hardened generation.

**Decision:** Server builds citations only from retrieved, filtered chunk metadata and validates ownership/version before response. Model sees delimited untrusted context and cannot supply source IDs.

**Reason/trade-offs:** Citation precision is tied to retrieval quality; it cannot claim sentence-level support not represented by chunks. It is nevertheless materially safer and auditable.

**Migration path:** Add citation span alignment/reranking only after evaluation demonstrates need.

## ADR-008 — $0 deployment is demo-grade, not production-grade

**Status:** Accepted  
**Date:** 2026-10-01

**Context/problem:** Free services have sleeping, ephemeral storage, quota, deletion, and resource constraints.

**Options:** Claim free stack is production; require paid hosting immediately; support a transparent $0 portfolio deployment with a paid-ready architecture.

**Decision:** Target $0 for local/portfolio demo using free services only where constraints are accepted and visible. Define paid reliability upgrade separately; never lower security/data boundaries to remain free.

**Reason/trade-offs:** Meets initial cost target but cannot provide uptime/durability guarantees. Public document data requires user consent and explicit policy before deployment.

**Migration path:** Upgrade compute, database/storage/vector tiers, queue/limiter and monitoring without client API rewrite.
