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

## 1. Prepare the Production Environment File

On the deployment host, create a protected environment file:

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

Replace every placeholder. Important values include:

- `CADDY_DOMAIN`: the exact public hostname, without a scheme.
- `CADDY_EMAIL`: contact address for TLS certificate notices.
- `CORS_ORIGINS` and `NEXT_PUBLIC_API_BASE_URL`: exactly match the public HTTPS
  origin and API path.
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

## 5. Rollback

If an application check fails after a release:

1. Stop new traffic at the proxy/load balancer.
2. Preserve Caddy, API, worker, scheduler, and database logs with request IDs.
3. Deploy the prior known-good image or Git revision.
4. Do not automatically downgrade an Alembic migration. Use a reviewed forward
   migration or restore the database from a rehearsed backup procedure.
5. Record the incident, deployed revision, migration head, backup identifier,
   decision maker, and remediation work.

## Operational Boundaries

- The overlay supplies restart policies and API/frontend health checks, but
  runtime health and disaster-recovery evidence must be captured on the chosen
  host before production approval. PostgreSQL and Redis have native service
  health checks; Qdrant currently relies on API calls failing safely and needs
  provider/host monitoring for availability alerts.
- S3 bucket policy, encryption, versioning, deletion, and restore behavior are
  provider-specific and require a live staging qualification.
- This runbook establishes a production-ready deployment baseline; it does not
  replace Phase 3 staging qualification or Phase 4 recovery/observability gates.
