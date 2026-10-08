# DocuMind


DocuMind is a private document-intelligence workspace: authenticated users upload documents, process them, inspect/export results, and ask grounded questions with source citations.

## Run locally

Requirements: Docker Desktop with Compose, Git, and a browser.

```powershell
Copy-Item .env.example .env
# Edit .env and set POSTGRES_PASSWORD plus a long JWT_SECRET_KEY.
docker compose up --build
```

Open http://localhost:3000. The backend is at http://localhost:8000; liveness is `/api/v1/health` and readiness is `/api/v1/ready`.

Compose starts PostgreSQL, Qdrant, the backend, and the Next.js frontend. The backend applies Alembic migrations before starting. Uploaded bytes stay under private `storage/` and are never returned as public URLs.

Compose also starts Redis with append-only persistence, a Celery worker, and a Celery Beat scheduler. The scheduler republishes queued jobs whose dispatch was missed and recovers expired worker leases. The worker runs with concurrency 1 by default to bound parser memory use.

## Development checks

Backend:

```powershell
cd backend
python -m pip install ".[dev]"
ruff check .
pytest
alembic upgrade head --sql
```

Frontend:

```powershell
cd frontend
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Optional processing, indexing, and grounded-generation dependencies:

```powershell
python -m pip install ".[processing,indexing,rag]"
```

## Security and operations

- Access tokens stay in frontend memory; refresh tokens are rotating, hashed server sessions in an HttpOnly cookie.
- Document queries always scope by the verified JWT user ID; raw storage keys never leave the backend.
- Uploads enforce size, extension, magic-byte, checksum, and path-safety checks.
- Qdrant payloads carry mandatory `user_id`, `document_id`, and artifact-version filters.
- The rate limiter supports process-local development mode and an atomic Redis sliding window. Compose uses Redis mode; set `RATE_LIMIT_BACKEND=redis` and `RATE_LIMIT_REDIS_URL` in deployed environments. Redis failures return 503 so protected routes are not silently left unthrottled.
- Processing jobs are persisted before dispatch, atomically claimed with fencing tokens, and retried with bounded exponential delays. Celery acknowledges after task completion; the scheduler reconciles missed dispatches and expired leases. Keep worker concurrency low enough for the memory available to Docling.
- `GET /api/v1/metrics` is intentionally hidden unless `METRICS_TOKEN` is configured and supplied as `X-Metrics-Token`. Job counts, retry totals, queue age, and average processing duration are read from PostgreSQL; rate-limit and dispatch error counters are process-local.
- `STORAGE_BACKEND=local` is for development and Compose. Set `STORAGE_BACKEND=s3` and configure `S3_BUCKET`, `S3_REGION`, and credentials or the runtime credential chain to use the S3-compatible adapter. Uploads use server-side encryption by default, processing downloads objects into temporary files, and clients never receive object URLs or keys.
- The S3 adapter is implemented, but provider-specific credentials, bucket policy, lifecycle, deletion behavior, and recovery still need live qualification before a public deployment.
- Scrape every API replica and aggregate centrally; configure dashboards/alerts for queue age/depth, processing failures, rate-limit backend errors, and storage failures. The target deployment still needs its scraper, logs, dashboards, and alerts configured.
- Never commit `.env`, API keys, uploaded files, model caches, or database volumes.

See `docs/IMPLEMENTATION-PROGRESS.md` for phase status and `docs/MASTER-IMPLEMENTATION-PLAN.md` for the engineering contract.
