# DocuMind Production Deployment Runbook

This runbook deploys DocuMind to a single Docker-capable host using the
production Compose overlay. It is the supported Phase 1 baseline. It replaces
the zero-cost guide for any deployment that handles private user documents.

## Before You Begin

Prepare the following before changing DNS or exposing the host:

- A Linux host with Docker Engine, Docker Compose v2, a firewall, and persistent
  disk space for PostgreSQL, Redis, Qdrant, Caddy certificates, and model cache.
- A domain whose DNS A/AAAA record points to that host. Ports 80 and 443 must be
  reachable by Caddy for TLS certificate issuance.
- A private S3-compatible bucket with credentials limited to that bucket. Enable
  server-side encryption and versioning or an equivalent recovery control.
- A Gemini API key and independently generated secrets for PostgreSQL, JWT,
  Qdrant, and metrics.
- A staging host/domain with a separate database, bucket, Qdrant collection,
  Redis instance, and distinct credentials.

Do not expose PostgreSQL, Redis, or Qdrant through host ports or public
firewall rules. The production overlay deliberately makes them Compose-network
services only.

## Release Automation Setup

The GitHub Actions workflows test pull requests, build backend and frontend
images, scan code/dependencies/secrets, and publish immutable images to GHCR on
pushes outside pull requests. Each image is tagged with the full Git commit SHA;
release tags are added as human-readable aliases. Deployments use the SHA tag.

Prepare each VM once:

1. Install Git, Docker Engine, and Compose v2. Create `/opt/documind`, clone the
   repository there, and place that environment's protected `.env.production`
   file beside `docker-compose.yml`.
2. Give the VM read-only access to the private GHCR packages using a narrowly
   scoped registry credential. Log Docker into `ghcr.io` on the VM and verify it
   can pull both images. Do not put the registry credential in GitHub workflow
   output or the deployment env file.
3. Add GitHub repository environments named `staging` and `production`. Set
   `STAGING_APP_DIR` and `PRODUCTION_APP_DIR` as environment variables. Add
   environment secrets for `*_HOST`, `*_USER`, `*_SSH_PRIVATE_KEY`, and
   `*_SSH_KNOWN_HOSTS`. Keep staging and production host keys and users separate.
4. Configure required reviewers and branch/tag restrictions on the `production`
   environment in GitHub Settings. The workflow waits for this environment's
   approval before connecting to production.
5. Restrict each SSH account and firewall to deployment administration. Pin the
   expected SSH host key in `*_SSH_KNOWN_HOSTS`; do not discover it dynamically
   in the deployment job.

## Release Flow

1. Merge a release candidate to `main`; CI and security workflows complete and
   GHCR receives SHA tagged images.
2. Create and push a semantic release tag such as `v1.2.3` from the approved
   commit. The CI workflow publishes that version alias as well as the full SHA.
3. Run **Deploy staging** from GitHub Actions with the release tag. Verify the
   tag, then monitor the deployment job and staging release checklist.
4. After staging qualification, run **Deploy production** with the same tag.
   A required reviewer must approve the protected `production` environment.
5. Record the Git SHA, both image references, migration head, approver, smoke
   results, and prior known-good SHA in the release record.

The production workflow runs authenticated health and auth checks after deploy.
It then reads the migration head from the running API and uploads a sanitized
release record. Configure production environment variables
`PRODUCTION_BASE_URL`, `PRODUCTION_APP_DIR`, `ROLLBACK_BACKEND_IMAGE`, and
`ROLLBACK_FRONTEND_IMAGE`, plus matching host/SSH/smoke-account secrets. Provide
the ID of a verified pre-deploy backup when starting the workflow.

The deploy script checks out the selected commit, pulls the matching images,
runs one migration task to completion, then starts the API/worker/scheduler and
frontend without building images on the server. It uses forward migrations only.
The previous image remains available by its SHA tag for application rollback.

## Registry Retention

Keep all production deployed SHA tagged images and the latest two known-good
release tags. Configure GHCR cleanup to remove only untagged images and stale
pull-request artifacts; never delete image tags referenced by a release record
or rollback plan.

## 1. Prepare the Production Environment File

On the deployment host, create a protected environment file:

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

Replace every placeholder. Important values include:

- `CADDY_DOMAIN`: the exact public hostname, without a scheme.
- `CADDY_EMAIL`: contact address for TLS certificate notices.
- `CORS_ORIGINS`: exactly match the public HTTPS frontend origin.
- `NEXT_PUBLIC_API_BASE_URL=/api/v1`: browser API calls stay on the same HTTPS
  origin and pass through Caddy's `/api/*` route.
- `STORAGE_BACKEND=s3`: production documents must use the private bucket.
- `QDRANT_API_KEY`: a unique secret shared only by the API, worker, and Qdrant.
- `JWT_SECRET_KEY`, `POSTGRES_PASSWORD`, and `METRICS_TOKEN`: unique secrets,
  not template values.

Validate the file before deployment:

```bash
python scripts/validate_production_config.py --env-file .env.production
```

The command rejects missing secrets, template values, wildcard/non-HTTPS CORS,
local storage, public Qdrant URLs, and inconsistent public API origins.

For an initial host firewall using UFW, allow SSH from trusted operator IPs
first, then allow only the public ingress ports:

```bash
sudo ufw allow from <trusted-operator-cidr> to any port 22 proto tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw enable
sudo ufw status verbose
```

Replace the SSH CIDR before enabling the firewall and confirm your provider
firewall matches these rules. Do not add rules for ports 3000, 5432, 6333,
6379, or 8000.

## 2. Build and Start

Use the base file plus the production overlay. Keep this exact command in the
deployment record with the Git revision being deployed.

```bash
git checkout <approved-release-commit>
docker compose --env-file .env.production \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up -d --build
```

The API starts only after PostgreSQL is healthy and applies forward migrations
before serving requests. Caddy is the only public service; it terminates TLS and
routes `/api/*` to the API and all other paths to the frontend.

The production overlay places proxy, frontend, and API on the edge network.
PostgreSQL, Redis, Qdrant, worker, and scheduler use the data network; only API
joins both networks. Data services have no published host ports. Worker health
uses Celery's worker ping, while scheduler health checks its Beat process.

Inspect role health immediately:

```bash
docker compose --env-file .env.production \
  -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose --env-file .env.production \
  -f docker-compose.yml -f docker-compose.prod.yml logs --tail=100 backend worker scheduler proxy
```

## 3. Verify Network Boundaries

From the host, inspect the published ports:

```bash
docker compose --env-file .env.production \
  -f docker-compose.yml -f docker-compose.prod.yml ps --format json
```

Only Caddy should publish host ports 80 and 443. PostgreSQL, Redis, Qdrant,
backend, worker, scheduler, and frontend must not show public host-port
mappings. Also restrict the host firewall to SSH administration and HTTP/HTTPS
as required by your operating policy.

## 4. Smoke Test

After DNS and TLS are live, run public health checks and an authenticated smoke
test using a disposable account:

```bash
python scripts/smoke_test.py --base-url https://app.example.com
python scripts/smoke_test.py --base-url https://app.example.com \
  --email smoke@example.test \
  --password "use-a-12-character-test-password"
```

Then run the full live checklist in `docs/RELEASE-CHECKLIST.md`, including a
representative document upload, processing recovery test, preview/export,
grounded citation checks, rate-limit test, and backup/restore rehearsal.

For the staging qualification run, use a non-sensitive sample document and a
dedicated staging test account. The authenticated smoke test removes the
uploaded document after its end-to-end checks pass. Save the RAG output outside
the repository and complete `docs/STAGING-QUALIFICATION-REPORT.md`:

```bash
python scripts/smoke_test.py \
  --base-url https://staging.example.com \
  --email "$STAGING_SMOKE_EMAIL" \
  --password "$STAGING_SMOKE_PASSWORD" \
  --document ./qualification-samples/qualification.pdf \
  --processing-timeout 900
python tests/evals/evaluator.py --live --report ./artifacts/staging-rag-evaluation.json
```

Repeat upload/preview/export for each supported format (PDF, DOCX, XLSX, PPTX,
TXT, CSV, Markdown). Keep sample content synthetic. The automated deployment
workflow runs health, readiness, and auth checks; document processing and live
RAG qualification remain an operator controlled staging step.

## 5. Rollback

If an application check fails after a release:

1. Stop new traffic at the proxy/load balancer.
2. Preserve Caddy, API, worker, scheduler, and database logs with request IDs.
3. Deploy the prior known-good image or Git revision.
4. Do not automatically downgrade an Alembic migration. Use a reviewed forward
   migration or restore the database from a rehearsed backup procedure.
5. Record the incident, deployed revision, migration head, backup identifier,
   decision maker, and remediation work.

Use [PRODUCTION-LAUNCH-REPORT.md](PRODUCTION-LAUNCH-REPORT.md) to capture the
preflight approval, launch checks, at least 24 hours of observation, rollback
decision, and closeout. Pause launch and roll back immediately for confirmed
cross-user exposure, data loss, corrupt migrations, or inability to safely
authenticate or process uploaded documents.

## 6. Monitoring, Backups, and Recovery

Start the private monitoring stack when the production secrets are present:

```bash
docker compose --env-file .env.production \
  -f docker-compose.yml -f docker-compose.prod.yml \
  --profile observability up -d prometheus alertmanager grafana
```

Prometheus scrapes the API with the protected metrics token. Grafana and
Prometheus bind only to host loopback ports 3001 and 9090; connect from an
operator workstation through SSH port forwarding. Grafana's initial admin
password comes from `GRAFANA_ADMIN_PASSWORD`; change it after first login.
Alertmanager shows fired alerts locally, but the default receiver has no email,
chat, or webhook integration. Configure and validate an operator notification
channel before relying on alerts during an incident.

The dashboard covers metrics exposed by the current API process: scrape health,
job state counts, oldest queued-job age, retries, expired leases, processing
duration, and rate-limit backend errors. These metrics do not provide a complete
host CPU, disk, memory, database, Redis, object-storage, or Qdrant health view;
add provider/host monitoring for those dependencies. The Compose overlay caps
Docker JSON logs at five 10 MB files per service. Export logs to a protected
central destination if longer retention or cross-host incident review is needed.

Prepare backup tooling on the host (`age`, AWS CLI, and instance-role or other
approved object-storage credentials). Store the age recipient and backup bucket
in a root-owned `/etc/documind/backup.env` with mode `0600`; never put the age
identity/decryption key on the production host. Install the supplied daily
systemd timer:

```bash
sudo install -o root -g root -m 600 ./infra/systemd/documind-backup.service /etc/systemd/system/
sudo install -o root -g root -m 644 ./infra/systemd/documind-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now documind-backup.timer
sudo systemctl start documind-backup.service
sudo systemctl status documind-backup.service documind-backup.timer
```

The backup is PostgreSQL custom format encrypted with age before upload and
server-side encrypted by the bucket. Enable bucket versioning and lifecycle
retention independently. S3-compatible object storage remains the source for
uploaded originals; confirm versioning/replication and retention in the
provider. Qdrant remains derived and is rebuilt from ready PostgreSQL artifacts.

For a restore rehearsal, download an encrypted backup to an isolated staging
operator machine, keep the age identity there, create a fresh staging database,
and restore into a name beginning `documind_restore_`:

```bash
aws s3 cp s3://YOUR_BACKUP_BUCKET/postgres/YOUR_BACKUP.dump.age ./restore.dump.age
export RESTORE_ENVIRONMENT=staging
export AGE_IDENTITY_FILE=/secure/path/age-identity.txt
bash scripts/restore_postgres_disposable.sh .env.staging ./restore.dump.age documind_restore_rehearsal
```

The restore helper refuses to run unless `RESTORE_ENVIRONMENT=staging` and the
target name matches the disposable prefix. Verify migration head, row counts,
ownership boundaries, and a smoke test against an isolated API configured to
use that restored database. Record elapsed restore time against the 8-hour RTO.

To rebuild Qdrant after loss, keep staging/production API traffic paused, verify
PostgreSQL and S3 artifacts are healthy, then run the idempotent per-document
reindex command from the API container:

```bash
docker compose --env-file .env.production \
  -f docker-compose.yml -f docker-compose.prod.yml \
  exec -T backend python -m app.indexing.rebuild
```

It removes and recreates vectors for each ready document from its canonical
stored Markdown artifact. Review its summary and rerun the staging retrieval
qualification before restoring traffic. Do not run concurrent manual indexing
or document deletion during a rebuild.

## Operational Boundaries

- The overlay supplies restart policies and API/frontend health checks, but
  runtime health and disaster-recovery evidence must be captured on the chosen
  host before production approval. PostgreSQL and Redis have native service
  health checks; Qdrant currently relies on API calls failing safely and needs
  provider/host monitoring for availability alerts.
- S3 bucket policy, encryption, versioning, deletion, and restore behavior are
  provider-specific and require a live staging qualification.
- This runbook provides recovery procedures; Phase 4 is complete only after
  alert delivery, scheduled backups, and isolated restore/Qdrant rebuild have
  been rehearsed successfully in staging.
