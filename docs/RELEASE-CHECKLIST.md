# DocuMind V1 release checklist

This checklist is required before calling a deployment demo-ready. A green local unit-test run is not a substitute for the live-service gates below.

## Preflight

- [ ] Use a Docker-enabled host with enough disk for PostgreSQL, Qdrant, and model caches.
- [ ] Copy `.env.example` to `.env`; set a unique long `JWT_SECRET_KEY`, strong `POSTGRES_PASSWORD`, and `REFRESH_COOKIE_SECURE=true` outside local development.
- [ ] Set `GEMINI_API_KEY` only in the deployment secret store; never commit it.
- [ ] Confirm CORS contains only the deployed frontend origin.
- [ ] Review the current commit and migration head before rollout.
- [ ] Run `python scripts/validate_production_config.py --env-file .env.production`.
- [ ] Confirm Docker publishes only proxy ports `80` and `443`; PostgreSQL, Redis, Qdrant, API, and frontend remain private.
- [ ] Confirm the release tag points to a green CI run and record the full commit SHA and GHCR image references.

## Deploy and smoke test

```powershell
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml up --build -d
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml ps
python scripts/smoke_test.py --base-url https://YOUR_DOMAIN
python scripts/smoke_test.py --base-url https://YOUR_DOMAIN --email "$SMOKE_EMAIL" --password "$SMOKE_PASSWORD" --document ./qualification-samples/qualification.pdf
python tests/evals/evaluator.py --live --report ./artifacts/rag-evaluation.json
```

- [ ] `/api/v1/health` returns healthy.
- [ ] `/api/v1/ready` returns ready with database available.
- [ ] Registration/login returns an access token and refresh cookie.
- [ ] `/users/me` rejects missing/invalid tokens and accepts a valid token.
- [ ] Staging smoke test uploads a representative document, polls until `ready`, validates preview and Markdown/JSON/HTML/TXT exports, and removes the test document.
- [ ] Processing reaches ready; controlled failure tests report a truthful failed state and bounded retries.
- [ ] Preview/export works only for the owning user; a second test identity receives 404 for the document.
- [ ] Qdrant indexing uses mandatory user/document/version filters.
- [ ] No-evidence chat returns the refusal message and no fabricated citation.
- [ ] Grounded chat returns verified citations above the configured threshold and the report is saved.
- [ ] Rate limiting returns 429 with `Retry-After` when a route threshold is exceeded.

## Backup and restore rehearsal

1. Confirm the daily backup timer ran and the encrypted backup object exists with the expected retention/versioning.
2. Record the backup timestamp, migration head, image tags, age key identifier (not key), and object-storage snapshot identifier.
3. Restore into a separate disposable PostgreSQL database with `scripts/restore_postgres_disposable.sh`; never experiment on the only live database.
4. Confirm the restored migration head, expected row counts, and user/document ownership in an isolated stack.
5. Rebuild Qdrant with `python -m app.indexing.rebuild` in the isolated API container and verify retrieval/citations.
6. Record restore duration against the 8-hour RTO, data loss against the 24-hour RPO, missing data, and corrective actions.

## Observability and alerts

- [ ] Prometheus scrapes `/api/v1/metrics` using bearer-token authentication.
- [ ] Grafana dashboard loads and is reachable only through host loopback/SSH tunnel.
- [ ] Alertmanager delivers a test alert to the configured operator channel.
- [ ] Queue backlog, failed jobs, API scrape failure, Redis rate-limit errors, and metrics/database errors trigger expected alerts.
- [ ] Container logs retain request IDs and rotate within configured disk limits.

Uploaded files and Qdrant vectors are derived/replaceable differently: preserve the private storage snapshot and verify that Qdrant can be rebuilt from authoritative artifacts before declaring recovery complete.

## Rollback and exit

- [ ] If application checks fail, stop traffic, preserve logs/request IDs, and roll back the image to the previous known-good commit.
- [ ] Never downgrade a database migration automatically; use a reviewed forward migration or restore rehearsal.
- [ ] Confirm the previous image can read the current schema before rollback.
- [ ] Record go/no-go decision, operator, commit, migration head, backup ID, and outstanding risks.
