# DocuMind V1 release checklist

This checklist is required before calling a deployment demo-ready. A green local unit-test run is not a substitute for the live-service gates below.

## Preflight

- [ ] Use a Docker-enabled host with enough disk for PostgreSQL, Qdrant, and model caches.
- [ ] Copy `.env.example` to `.env`; set a unique long `JWT_SECRET_KEY`, strong `POSTGRES_PASSWORD`, and `REFRESH_COOKIE_SECURE=true` outside local development.
- [ ] Set `GEMINI_API_KEY` only in the deployment secret store; never commit it.
- [ ] Confirm CORS contains only the deployed frontend origin.
- [ ] Review the current commit and migration head before rollout.

## Deploy and smoke test

```powershell
docker compose up --build -d
docker compose ps
python scripts/smoke_test.py --base-url http://localhost:8000
python scripts/smoke_test.py --base-url http://localhost:8000 --email smoke@example.test --password "use-a-12-character-test-password"
```

- [ ] `/api/v1/health` returns healthy.
- [ ] `/api/v1/ready` returns ready with database available.
- [ ] Registration/login returns an access token and refresh cookie.
- [ ] `/users/me` rejects missing/invalid tokens and accepts a valid token.
- [ ] Upload creates a private document and queued processing job.
- [ ] Processing reaches ready or a truthful failed state; it never reports ready without an artifact.
- [ ] Preview/export works only for the owning user.
- [ ] Qdrant indexing uses mandatory user/document/version filters.
- [ ] No-evidence chat returns the refusal message and no fabricated citation.
- [ ] Grounded chat citations map only to retrieved chunks.
- [ ] Rate limiting returns 429 with `Retry-After` when a route threshold is exceeded.

## Backup and restore rehearsal

1. Take a PostgreSQL logical backup with `pg_dump` from the running Compose service.
2. Record the backup timestamp, migration head, image tags, and object/storage snapshot identifier.
3. Restore into a separate disposable PostgreSQL database; never experiment on the only live database.
4. Run `alembic current` and confirm the restored database reaches the expected head.
5. Run the smoke test against the restored stack and verify user/document ownership, preview, and citations.
6. Record restore duration, missing data, and corrective actions.

Uploaded files and Qdrant vectors are derived/replaceable differently: preserve the private storage snapshot and verify that Qdrant can be rebuilt from authoritative artifacts before declaring recovery complete.

## Rollback and exit

- [ ] If application checks fail, stop traffic, preserve logs/request IDs, and roll back the image to the previous known-good commit.
- [ ] Never downgrade a database migration automatically; use a reviewed forward migration or restore rehearsal.
- [ ] Confirm the previous image can read the current schema before rollback.
- [ ] Record go/no-go decision, operator, commit, migration head, backup ID, and outstanding risks.
