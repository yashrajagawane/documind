# DocuMind Deployment Decision Record

**Decision:** DPL-001 — Initial production deployment  
**Status:** Approved as the repository baseline; account-specific provisioning inputs remain open  
**Date:** 2026-11-03  
**Decision owner:** Project maintainer  

## Decision

Deploy the first production version as a single-host Docker Compose installation
on a Linux VM, with Caddy providing public HTTPS ingress. Keep PostgreSQL,
Redis, Qdrant, API, worker, scheduler, and frontend on private Compose networks;
only ports 80 and 443 are public. Store uploaded documents in a private,
encrypted, versioned S3-compatible bucket.

Use two isolated environments: staging and production. Each environment gets
its own host, database, Redis, Qdrant collection/service, object-storage bucket,
and credentials. Do not copy production documents into staging.

This initial choice favors the already-supported Compose topology and a simple
operating model. It does not claim high availability. Managed PostgreSQL or
other service substitutions can be considered after the first deployment has
measured operational needs.

## Environment and Service Defaults

| Item | Decision |
|---|---|
| Compute topology | One Linux VM per environment, Docker Engine and Compose v2 |
| Application deployment | `docker-compose.yml` plus `docker-compose.prod.yml` |
| Public ingress | Caddy on ports 80/443; automatic HTTPS for the environment hostname |
| Public hostnames | `app.<maintainer-owned-domain>` and `staging.<maintainer-owned-domain>` |
| DNS owner | Project maintainer; DNS records point to the corresponding VM |
| Region | Choose the nearest available region to the initial operator and expected users; use the same region for staging and production where possible |
| Database/vector/queue | Private PostgreSQL, Qdrant, and Redis services per environment |
| File storage | Separate private S3-compatible bucket per environment; encryption and versioning enabled |
| Secret custody | Deployment platform secret store where available; otherwise a mode-0600 env file outside Git, rotated by the project maintainer |
| Budget owner | Project maintainer; a monthly spend ceiling must be approved before provisioning |
| Recovery target | Initial objective: RPO no worse than 24 hours and RTO no worse than 8 hours; validate by restore rehearsal |
| Data classification | Uploaded documents and extracted text are private user data; treat as confidential and minimize operator access |
| Registration | Self-service registration may be enabled for launch only after abuse controls, privacy notice, and support contact are confirmed |

The region and hostname patterns are defaults, not live resources. Replace the
patterns with actual values in each protected environment configuration before
issuing certificates or accepting uploads.

## Required Provisioning Inputs

The architecture decision is complete, while live provisioning needs these
account-specific values:

- A maintainer-owned domain and DNS access for the two hostnames.
- A VM provider, selected region, firewall access, and SSH operator.
- The maintainer-approved monthly budget ceiling.
- Private object-storage provider, bucket names, and restricted credentials.
- Production and staging secrets, generated independently.
- Public privacy/support details and the final registration policy.

These values are intentionally not fabricated in Git. Add them to the private
environment inventory and secret manager during provisioning; never commit
actual values to this repository.

## Consequences

- The Compose overlay and production runbook are the supported initial
  deployment path.
- Staging and production must be separate deployments, not two project names
  on the same unsegmented host.
- A single VM is a single failure domain. The RPO/RTO targets depend on backups
  and must be verified before production approval.
- Provider-specific VM sizing, storage policy, backup scheduling, and firewall
  setup belong in the deployment record for the selected provider.
- The zero-cost guide remains portfolio/demo guidance only.

## Approval and Exit Record

| Decision item | Recorded value |
|---|---|
| Topology decision | Single Linux VM per environment with private Compose services and Caddy HTTPS ingress |
| Data storage decision | Private encrypted/versioned S3-compatible object storage |
| Environment isolation | Separate staging and production hosts and data services |
| Recovery objectives | 24-hour RPO / 8-hour RTO, subject to rehearsal |
| Provider/account/domain/budget values | To be entered by maintainer before provisioning |
| Decision status | Repository-level Phase 0 decision complete; resource provisioning pending |

