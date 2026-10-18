# DocuMind — Configuration Reference

All environment variables are validated at startup using Pydantic Settings ([backend/app/core/config.py](file:///c:/Users/agawa/OneDrive/Desktop/documind/backend/app/core/config.py)). Invalid or missing required variables will prevent the application from starting in production.

Copy `.env.example` to `.env` to start:

```bash
cp .env.example .env
```

---

## Complete Environment Variable Reference

| Variable | Default | Required | Description |
|---|---|---|---|
| `ENVIRONMENT` | `development` | Yes | Runtime environment (`development`, `staging`, `production`). In `production`, secret strengths and origins are strictly enforced. |
| `CORS_ORIGINS` | `http://localhost:3000` | Yes | Comma-separated list of allowed browser origins for cross-origin requests. |
| `DATABASE_URL` | *(see .env.example)* | Yes | Async PostgreSQL connection string (`postgresql+asyncpg://user:pass@host:5432/db`). |
| `POSTGRES_DB` | `documind` | Yes | PostgreSQL database name used by Docker Compose. |
| `POSTGRES_USER` | `documind` | Yes | PostgreSQL username used by Docker Compose. |
| `POSTGRES_PASSWORD` | — | **Yes** | Master password for PostgreSQL instance. |
| `JWT_SECRET_KEY` | `replace-with-a-long-random-secret` | **Yes** | Secret used to sign access JWTs. Generate with `openssl rand -hex 32`. Must be changed outside development. |
| `JWT_ALGORITHM` | `HS256` | No | Cryptographic algorithm for signing JWT tokens. |
| `JWT_ACCESS_EXPIRE_MINUTES` | `60` | No | Lifespan of the in-memory access token in minutes. |
| `JWT_REFRESH_EXPIRE_DAYS` | `14` | No | Lifespan of the HttpOnly refresh cookie session family in days. |
| `REFRESH_COOKIE_SECURE` | `false` | No | Enforces `Secure` flag on refresh cookies. Must be `true` in production when serving over HTTPS. |
| `JOB_QUEUE_BACKEND` | `celery` | No | Asynchronous task queue backend: `celery` (distributed queue) or `inprocess` (local synchronous execution). |
| `CELERY_BROKER_URL` | `redis://redis:6379/0` | If Celery | Redis connection URL for Celery broker tasks. |
| `RATE_LIMIT_BACKEND` | `redis` | No | Sliding-window rate limiter storage: `redis` (multi-replica distributed) or `memory`. |
| `RATE_LIMIT_REDIS_URL` | `redis://redis:6379/1` | If Redis | Dedicated Redis database index for atomic Lua sliding-window rate tracking. |
| `STORAGE_BACKEND` | `local` | No | Private file storage engine: `local` (filesystem volume) or `s3` (S3-compatible bucket). |
| `STORAGE_DIR` | `storage` | If local | Directory path for local file storage volume. |
| `S3_BUCKET` | — | If S3 | Target AWS S3 or MinIO bucket name. |
| `S3_REGION` | `us-east-1` | If S3 | AWS region for target S3 bucket. |
| `S3_ENDPOINT_URL` | — | If S3 | Custom S3 endpoint URL (for MinIO, Cloudflare R2, or LocalStack). |
| `S3_ACCESS_KEY_ID` | — | If S3 | S3 authentication access key. |
| `S3_SECRET_ACCESS_KEY` | — | If S3 | S3 authentication secret key. |
| `S3_SERVER_SIDE_ENCRYPTION` | `AES256` | If S3 | S3 server-side encryption algorithm (`AES256` or `aws:kms`). |
| `S3_KMS_KEY_ID` | — | If S3 + KMS | AWS KMS Customer Managed Key ID when using SSE-KMS. |
| `MAX_UPLOAD_BYTES` | `26214400` (25 MB) | No | Maximum permitted file upload size in bytes. |
| `ALLOWED_UPLOAD_EXTENSIONS` | `.pdf,.docx,.xlsx,.pptx,.txt,.csv,.md` | No | Comma-separated list of permitted file extensions. |
| `QDRANT_URL` | `http://qdrant:6333` | Yes | HTTP endpoint for Qdrant vector database. |
| `QDRANT_API_KEY` | — | If auth | Optional API key for managed Qdrant Cloud clusters. |
| `QDRANT_COLLECTION` | `documind_chunks` | No | Name of the shared vector collection in Qdrant. |
| `EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | No | Hugging Face transformer model used for local vector embeddings. |
| `EMBEDDING_DIMENSIONS` | `384` | No | Vector dimensional size (must match embedding model specification). |
| `GEMINI_API_KEY` | — | Optional | Google Gemini API key. Required only for grounded chat synthesis. |
| `GEMINI_MODEL` | `gemini-3.8-flash` | No | Gemini model name used for grounded reasoning. |
| `RETRIEVAL_TOP_K` | `5` | No | Maximum number of vector chunk evidence items returned per query. |
| `RETRIEVAL_MIN_SCORE` | `0.35` | No | Minimum cosine similarity threshold for evidence acceptance. |
| `PROCESSING_LEASE_MINUTES` | `30` | No | Duration of worker lease lock before Celery Beat considers it expired. |
| `PROCESSING_MAX_ATTEMPTS` | `3` | No | Maximum processing attempts before permanently marking a document as failed. |
| `PROCESSING_DISPATCH_STALE_SECONDS` | `300` | No | Threshold before an unacknowledged queued job is re-dispatched. |
| `METRICS_TOKEN` | — | Optional | Secret token required in `X-Metrics-Token` header to access `/api/v1/metrics`. |
| `TRUSTED_PROXY_CIDRS` | — | Optional | Comma-separated list of trusted reverse proxy CIDR ranges for IP resolution. |
