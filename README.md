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
- The V1 rate limiter is process-local. Before running multiple backend replicas, move its event store to a shared Redis or edge limiter.
- Never commit `.env`, API keys, uploaded files, model caches, or database volumes.

See `docs/IMPLEMENTATION-PROGRESS.md` for phase status and `docs/MASTER-IMPLEMENTATION-PLAN.md` for the engineering contract.
