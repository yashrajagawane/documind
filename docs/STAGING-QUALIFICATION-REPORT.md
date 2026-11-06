# DocuMind Staging Qualification Report

Copy this file for each release candidate. Store completed reports in the
approved private release record location; do not commit credentials, customer
documents, or sensitive logs to Git.

## Release identity

- Release tag:
- Full Git commit SHA:
- Backend image SHA tag:
- Frontend image SHA tag:
- Migration head:
- Staging hostname and region:
- Qualification operator:
- Start/end time (UTC):

## Environment evidence

- Production configuration validator result:
- Staging environment isolation verified:
- Public ports observed (expected 80/443 only):
- HTTPS certificate and redirect result:
- Browser origin/CORS and secure cookie result:
- Database, Redis, Qdrant, and object storage service versions:

## Functional results

| Check | Result | Evidence reference / notes |
|---|---|---|
| Liveness and database readiness | | |
| Register/login, refresh, logout | | |
| Missing and invalid access tokens rejected | | |
| Upload validation and private object persistence | | |
| Queue dispatch and worker reaches ready | | |
| Worker restart/recovery and bounded retries | | |
| Preview and Markdown/JSON/HTML/TXT exports | | |
| Cross-user document access returns 404 | | |
| Qdrant user/document/version filtering | | |
| No-evidence refusal has zero citations | | |
| Grounded answer citations map to retrieved chunks | | |
| Redis outage fails closed; 429 has Retry-After | | |
| Delete removes document artifact and vectors | | |

## RAG evaluation

- Evaluation command:
- Model identifier:
- Dataset revision/hash:
- Passed / total:
- Report artifact reference:
- Failed cases and disposition:

## Operational checks

- API/worker/scheduler logs and request IDs reviewed:
- Metrics endpoint authorization verified:
- Staging database/bucket/Qdrant are distinct from production:
- Backup/restore evidence reference (when required):

## Decision

- Open defects or risks (owner and target date):
- Accepted exceptions (approver and expiry):
- Qualification decision: **GO / NO-GO**
- Approver:
- Approval timestamp:

