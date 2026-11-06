# DocuMind Deployment Completion Plan

**Status:** Phases 0–1 repository gates complete; Phase 2 release automation implemented; staging execution pending
**Owner:** Project maintainer  
**Scope:** Production deployment qualification for the current V1 application  
**Baseline revision:** `91e9910`  

## 1. Purpose

This plan turns the existing application and local Docker Compose stack into a
secure, repeatable, and supportable production deployment. It does not expand
the product feature set. Its completion means that a user can safely access the
application over HTTPS, upload private documents, receive grounded answers, and
recover service data after an operational failure.

The target is a paid-ready deployment. A free public demo may be produced later,
but it must be clearly labelled as demo-grade and must not be represented as a
durable production service.

## 2. Definition of Done

Production deployment is approved only when all of the following are true:

- The API, worker, scheduler, Redis, PostgreSQL, Qdrant, storage, and frontend
  are deployed through a documented and reproducible workflow.
- Public traffic reaches only the HTTPS ingress and the frontend/API routes.
  PostgreSQL, Redis, and Qdrant are private-network services.
- Secrets are held only in the chosen platform's secret store or a protected
  deployment environment; no production secret is committed to Git.
- Document artifacts live in persistent private object storage, not ephemeral
  container disk.
- Automated checks, live smoke tests, security checks, and a restore rehearsal
  pass against staging before production traffic is enabled.
- The operator has rollback, backup, incident, and release runbooks.

## 3. Recommended Target Architecture

Use a production-capable container host or VM for the application services and
an HTTPS reverse proxy at the edge. The frontend may be deployed independently
only if its configured API origin and cookie behavior are validated in staging.

```text
Internet
  |
HTTPS reverse proxy / load balancer
  |-- Frontend (public)
  '-- API (public, authenticated)
        |-- PostgreSQL (private)
        |-- Redis (private)
        |-- Qdrant (private, authenticated)
        |-- Celery worker (private)
        |-- Celery scheduler (private)
        '-- S3-compatible object storage (private bucket)
```

This preserves the existing modular-monolith design and durable job contract.
It also follows the project ADRs: PostgreSQL remains canonical, Qdrant remains
rebuildable, and object storage remains the authority for uploaded artifacts.

## 4. Phase Plan

> **Implementation note (2026-11-03):** The repository now includes a portable
> production Compose overlay, Caddy TLS ingress, private data-service ports,
> production environment validation, S3-only production settings, Qdrant
> authentication, network separation, non-root application containers, role
> health checks, graceful shutdown, HTTPS security headers, and an operator
> runbook. The Phase 1 repository implementation is complete; live qualification
> still requires the chosen host, domain, bucket, secrets, and staging deployment.

### Phase 0 — Deployment Decision and Project Controls

> **Decision recorded (2026-11-03):** The initial deployment uses one Linux VM
> per environment, Docker Compose, Caddy HTTPS ingress, private Compose data
> services, and a private S3-compatible bucket. Staging and production are
> isolated. Initial recovery objectives are 24-hour RPO and 8-hour RTO. See
> [DEPLOYMENT-DECISION.md](DEPLOYMENT-DECISION.md). Provider, region, domain,
> budget cap, and account credentials remain provisioning inputs; no resources
> have been created.

**Goal:** Select one supported production target before implementing provider
specific configuration.

**Actions**

1. Use the approved initial topology recorded in `DEPLOYMENT-DECISION.md`.
2. Enter the actual provider, regions, budget ceiling, public domain, DNS owner,
   and access owners in the private environment inventory before provisioning.
3. Confirm the privacy notice, account-support contact, and
   whether public account registration is permitted at launch.
4. Provision separate **staging** and **production** environments. They must not
   share databases, buckets, Qdrant collections, Redis instances, or secrets.
5. Retire the current zero-cost public-hosting instructions or relabel them as
   an explicitly non-production demo path.

**Deliverables**

- Approved deployment decision record with topology, data classification,
  isolation, and initial recovery objectives.
- Private environment inventory and access-owner list populated during provisioning.
- Production and staging domains provisioned from the maintainer-owned domain.
- Updated deployment documentation with a single supported path.

**Repository decision gate:** Complete; the initial architecture and operating
defaults are recorded. **Provisioning gate:** Pending provider, domain, budget,
and credentials supplied by the maintainer.

### Phase 1 — Production Packaging, Networking, and Security

**Goal:** Make the deployment private by default, externally reachable only
through controlled HTTPS endpoints, and repeatable from versioned configuration.

**Actions**

1. Create a production Compose overlay or equivalent infrastructure definition.
   Keep local-development defaults separate from production settings.
2. Expose only the reverse proxy/frontend/API ports. Remove host-port mappings
   for PostgreSQL and Qdrant; keep Redis private as well.
3. Add private service networks and explicit service-to-service connectivity.
   The API and worker may reach data services; public clients may not.
4. Configure Qdrant server authentication and supply its API key only to the
   API and worker through the secret store.
5. Add a reverse proxy/load balancer with TLS, HTTP-to-HTTPS redirect, request
   size limits, trusted-proxy configuration, and access logging.
6. Add production health checks and restart behavior for API, worker, scheduler,
   Redis, PostgreSQL, Qdrant, and the proxy. A health check must reflect the
   role it is assigned to, not merely whether its process exists.
7. Configure private, durable S3-compatible storage. Validate bucket policy,
   encryption, credential scope, lifecycle policy, deletion behavior, and
   restore procedure. Do not use container filesystem storage in production.
8. Enforce production configuration at startup:
   - `ENVIRONMENT=production`
   - unique `JWT_SECRET_KEY` with adequate entropy
   - `REFRESH_COOKIE_SECURE=true`
   - exact comma-separated frontend origins; never wildcard CORS
   - Celery and Redis configuration enabled for the API, worker, and scheduler
   - a non-empty metrics token if the metrics endpoint is enabled
9. Add a production configuration validation command that fails before rollout
   when required settings, service reachability, or unsafe port exposure are
   detected.

**Deliverables**

- Versioned production infrastructure configuration.
- Secret inventory with rotation owner and storage location (never secret values).
- Network/port exposure diagram and firewall rules.
- S3 bucket policy and Qdrant authentication configuration.
- Operator setup guide.

**Exit gate:** A fresh staging environment starts from versioned configuration,
exposes no data service publicly, and accepts HTTPS traffic successfully.

### Phase 2 — Build, Test, and Release Automation

> **Implementation note (2026-11-06):** CI now builds full commit SHA tagged
> backend/frontend images, security workflows scan code/dependencies/secrets,
> staging and production deployment workflows use GitHub protected environments,
> and the remote Compose script applies migrations once before starting app
> services. The live exit gate awaits staging host/registry/GitHub environment
> setup and a successful tagged release deployment.

**Goal:** Ensure a release candidate is tested and immutable before it can reach
staging or production.

**Actions**

1. Keep the existing frontend lint, type-check, test, and build jobs; add
   backend dependency installation for all release-critical adapters when
   appropriate.
2. Run backend lint, unit tests, migration SQL generation, and a container image
   build on every pull request.
3. Build API/worker and frontend images from the release commit. Tag images with
   both the immutable Git SHA and the release version; never deploy `latest`.
4. Add dependency and secret scanning to continuous integration. Resolve or
   formally accept findings before release.
5. Add a staging deployment workflow triggered only from an approved branch or
   release tag. It must apply migrations exactly once before API traffic starts.
6. Require protected-environment approval for production. Record the release
   commit, image digests, migration head, operator, and change ticket/reference.
7. Preserve a previous known-good image digest and document rollback conditions.

**Deliverables**

- CI workflow updates and release workflow.
- Image registry and retention policy.
- Migration, rollback, and release runbook.

**Exit gate:** A tagged revision produces traceable images, deploys to staging,
and can be rolled back to the immediately preceding known-good image without a
database downgrade.

### Phase 3 — Staging Qualification and End-to-End Validation

> **Qualification tooling (2026-11-06):** The smoke script now supports a
> disposable document lifecycle through processing, preview, exports, no-evidence
> refusal, grounded citations, and deletion. Staging deployment runs health and
> auth checks automatically, and the RAG evaluator can write a JSON report.
> Staging host execution, provider cases, and approval evidence remain pending.

**Goal:** Prove that the real distributed system works, not only its unit-test
components.

**Actions**

1. Run the repository release checklist against staging using production-like
   secrets and network boundaries.
2. Execute the authenticated smoke test with a disposable staging account.
3. Upload representative PDF, DOCX, XLSX, PPTX, TXT, CSV, and Markdown samples;
   verify validation, object persistence, queued processing, preview, export,
   indexing, and deletion.
4. Validate the complete lifecycle: `queued -> processing -> ready` and each
   truthful failure/retry path. Confirm the worker and scheduler recover after a
   controlled restart.
5. Confirm Qdrant queries enforce user, document, and artifact-version filters;
   validate cross-user access attempts return the expected non-enumerating result.
6. Run grounded-chat cases: correct citations, no-evidence refusal, malformed
   provider response, prompt-injection content, and provider outage behavior.
7. Test auth/session behavior from the final frontend origin, including refresh
   cookie, logout, token rotation, CORS preflight, and HTTPS-only cookies.
8. Confirm rate-limit behavior, Redis outage fail-closed behavior, request IDs,
   structured logs, and protected metrics access.
9. Run the RAG evaluation harness against the selected provider and record its
   inputs, model version, results, failures, and acceptance threshold.

**Deliverables**

- Signed staging qualification report.
- Smoke-test transcript and representative test artifacts.
- Security and RAG evaluation evidence.
- List of accepted risks and remediation owners.

**Exit gate:** Every checklist item passes, or an exception has an explicit
owner, expiry date, and launch approval.

### Phase 4 — Observability, Backup, and Recovery Readiness

**Goal:** Detect failures promptly and restore authoritative data predictably.

**Actions**

1. Centralize structured application, proxy, worker, and scheduler logs with
   request IDs and retention appropriate to the privacy policy.
2. Scrape protected metrics and create alerts for API unavailability, worker
   backlog, repeated job failures, expired leases, Redis errors, storage errors,
   Qdrant errors, high latency, and disk/capacity exhaustion.
3. Schedule encrypted PostgreSQL backups and storage snapshots/versioning. Keep
   retention and access policies documented.
4. Treat Qdrant as rebuildable: document and test the rebuild process from
   canonical PostgreSQL/object-storage artifacts.
5. Rehearse restore into an isolated environment. Measure restore duration,
   verify migrations, then run the authenticated smoke test and ownership checks.
6. Publish incident runbooks for API outage, worker backlog, provider outage,
   credential compromise, accidental deletion, and rollback.

**Deliverables**

- Dashboard and alert definitions.
- Backup schedule and retention record.
- Successful restore-rehearsal report.
- Incident and on-call runbooks.

**Exit gate:** The team can detect a failed component and restore canonical data
within the chosen objectives without operating on the only production database.

### Phase 5 — Production Launch and Post-Launch Verification

**Goal:** Release incrementally with a documented decision trail and verify
real-user behavior.

**Actions**

1. Complete the production preflight: DNS, TLS, secrets, exact CORS origin,
   database migration head, image digests, backups, capacity, and monitoring.
2. Deploy the approved release using the immutable images already qualified in
   staging. Apply forward migrations before traffic cutover.
3. Run public liveness/readiness checks and the authenticated smoke test.
4. Perform a controlled upload, processing, retrieval, citation, and deletion
   check using a production test account and non-sensitive test document.
5. Monitor error rate, queue depth, worker retries, provider errors, and host
   capacity during the defined launch observation window.
6. Record the final go/no-go decision, deployment metadata, known risks, and
   rollback location. Do not automatically downgrade database migrations.
7. Hold a post-launch review; convert any observation-window issue into a tracked
   remediation item with owner and priority.

**Deliverables**

- Production release record.
- Launch verification evidence.
- Post-launch review and prioritized follow-up backlog.

**Exit gate:** The observation window completes without unresolved security,
data-loss, or availability incidents.

## 5. Mandatory Release Gates

| Gate | Evidence required | Approval condition |
|---|---|---|
| Architecture | Decision record and environment inventory | One complete, supported topology selected |
| Security | Port review, TLS proof, secret review, exact CORS test | No public data-service endpoint or wildcard browser access |
| Durability | Bucket validation, backup configuration, restore rehearsal | Canonical data can be restored into an isolated environment |
| Functional | Authenticated staging smoke test and lifecycle test | Upload through grounded citation flow passes |
| Quality | CI result, immutable image digests, migration review | Release commit is reproducible and traceable |
| Operations | Dashboards, alerts, rollback and incident runbooks | On-call owner can act on a failure |
| Launch | Production verification transcript | Named operator records go/no-go decision |

## 6. Work Breakdown and Dependencies

| Workstream | Starts after | Must finish before |
|---|---|---|
| Provider and topology decision | Immediately | All provider-specific work |
| Production packaging and network isolation | Topology decision | Staging deployment |
| Persistent object storage | Topology decision | Any document-upload qualification |
| CI/CD and image registry | Topology decision | Staging release automation |
| Staging qualification | Packaging, secrets, storage, CI/CD | Production launch |
| Backup/restore and observability | Staging services available | Production approval |
| Production launch | All preceding gates approved | Post-launch review |

## 7. Immediate Next Actions

1. Approve the hosting topology and record the decision.
2. Replace the current free-hosting guide with one tested production path.
3. Create production infrastructure configuration that keeps PostgreSQL, Redis,
   and Qdrant private and uses durable S3-compatible storage.
4. Provision staging secrets and services, then deploy the first staging stack.
5. Run the full live release checklist, including processing recovery, citation
   validation, and backup/restore rehearsal.

## 8. Release Record Template

Use this template for every production release:

```text
Release version / Git commit:
Image digests:
Migration head:
Staging qualification reference:
Backup identifier and timestamp:
Restore rehearsal reference:
Deployment operator:
Production smoke-test reference:
Known accepted risks (owner and expiry):
Rollback image digest:
Final decision (GO / NO-GO):
Approver and timestamp:
```

## 9. Out of Scope

- Product features unrelated to deployment readiness.
- Horizontal scaling or multi-region availability beyond the selected initial
  availability target.
- A claim that a zero-cost public hosting option provides production durability
  or uptime guarantees.

