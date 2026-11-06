# DocuMind Production Launch Report

Complete this record for each production launch. Store the completed copy in
the approved release evidence location. Do not include credentials, private
documents, or unredacted user data.

## Release and approval

- Release tag:
- Full Git commit SHA:
- Backend image SHA reference:
- Frontend image SHA reference:
- Migration head:
- Pre-deploy backup identifier:
- Prior known-good backend/frontend image references:
- GitHub Actions production deployment run:
- Production environment approver:
- Deployment operator:
- Launch timestamp (UTC):

## Go/no-go preflight

| Gate | Evidence reference | Result |
|---|---|---|
| Staging qualification passed for this exact SHA | | |
| CI/security checks passed | | |
| Production config validator passed | | |
| Public ports limited to 80/443; observability bound to loopback | | |
| Backup completed and object verified | | |
| DNS, TLS, secure cookie, and exact CORS verified | | |
| Migration reviewed and prior image/schema compatibility checked | | |
| Operator alert channel received a test notification | | |

**Decision before traffic:** GO / NO-GO  
**Approver and timestamp:**

## Post-deploy checks

- Public health/readiness result:
- Authenticated smoke result:
- Browser register/login/refresh/logout result:
- Synthetic upload, processing, preview, chat, citation, and deletion result:
- Queue age and failed-job counts at launch:
- API, worker, scheduler, database, Redis, Qdrant, and storage health:
- Security/privacy incidents observed:
- Relevant dashboard/log evidence links:

## Observation window

Observe for at least 24 hours after first public traffic. Extend the window if
traffic is too low to exercise the critical paths.

| Checkpoint (UTC) | API errors/availability | Queue and worker | Storage/vector/LLM | Incidents/actions |
|---|---|---|---|---|
| Launch | | | | |
| +1 hour | | | | |
| +4 hours | | | | |
| +24 hours | | | | |

Rollback triggers include a confirmed cross-user data exposure, data loss,
corrupt migrations, sustained inability to authenticate/upload/process, or an
unrecoverable dependency outage. Stop new traffic, preserve evidence, deploy the
prior known-good image, and use a reviewed forward migration or rehearsed restore
if the schema cannot be read safely. Do not downgrade migrations automatically.

## Closeout

- Final decision: GO / ROLLBACK
- Observation window start/end:
- Unresolved incidents or accepted risks (owner/date):
- Follow-up actions:
- Operator:
- Approver:
- Closeout timestamp (UTC):

