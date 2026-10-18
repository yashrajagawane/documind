# DocuMind — API Reference

All application endpoints are versioned under `/api/v1`. Interactive Swagger/OpenAPI documentation is available at `http://localhost:8000/docs` when running locally.

---

## 1. Error Envelope

All non-2xx responses adhere to a consistent error envelope. Internal stack traces, raw SQL queries, and filesystem storage paths are never leaked to clients:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Document not found.",
    "request_id": "c0a80101-8b2f-4c1d-9e3a-7a5f6e8b9c0d"
  }
}
```

### Standard Error Codes

| Code | HTTP Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Request body or query parameters failed schema validation |
| `UNAUTHORIZED` | 401 | Missing, malformed, or expired access token |
| `NOT_FOUND` | 404 | Resource does not exist or belongs to another user (anti-enumeration) |
| `RATE_LIMITED` | 429 | Request volume exceeded sliding window quota |
| `SERVICE_UNAVAILABLE` | 503 | Database or Redis dependency unreachable (fail-closed) |
| `INTERNAL_ERROR` | 500 | Unexpected server error; refer to `request_id` in logs |

---

## 2. Authentication Endpoints

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | None | Register a new account with email and password (min 12 characters). |
| `POST` | `/api/v1/auth/login` | None | Authenticate credentials. Returns short-lived access JWT in JSON body and sets HttpOnly refresh cookie. |
| `POST` | `/api/v1/auth/refresh` | Cookie | Rotate refresh session family. Returns fresh access JWT and sets new cookie. |
| `POST` | `/api/v1/auth/logout` | Cookie | Invalidate entire refresh session family and expire cookie. |

---

## 3. User Endpoints

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `GET` | `/api/v1/users/me` | Bearer JWT | Returns current authenticated user profile (`id`, `email`, `created_at`). |

---

## 4. Document Management Endpoints

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `POST` | `/api/v1/documents` | Bearer JWT | Upload a file via `multipart/form-data`. Supports optional `Idempotency-Key` header. |
| `GET` | `/api/v1/documents` | Bearer JWT | List all documents owned by authenticated user, sorted by recency. |
| `GET` | `/api/v1/documents/{id}` | Bearer JWT | Retrieve lifecycle status, parsing progress, and error details for a document. |
| `GET` | `/api/v1/documents/{id}/preview` | Bearer JWT | Returns parsed Markdown content, document metrics, and extracted table cells. |
| `POST` | `/api/v1/documents/{id}/index` | Bearer JWT | Chunks parsed Markdown, computes local embeddings, and upserts to Qdrant. Returns `{"indexed_chunks": count}`. |
| `GET` | `/api/v1/documents/{id}/raw` | Bearer JWT | Streams original uploaded file bytes with verified MIME content-type headers. |
| `GET` | `/api/v1/documents/{id}/export` | Bearer JWT | Download parsed artifact in requested format via `?format=markdown|txt|json|html|original`. |
| `POST` | `/api/v1/documents/{id}/retry` | Bearer JWT | Requeues a document that encountered a recoverable error (`failed` status). |
| `DELETE` | `/api/v1/documents/{id}` | Bearer JWT | Permanently purges document record, private storage object, and vector points. Returns `204 No Content`. |

---

## 5. Grounded Chat Endpoints

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `POST` | `/api/v1/documents/{id}/chat` | Bearer JWT | Ask a question against an indexed document using grounded RAG. |

### Request Payload

```json
{
  "question": "What is the liability cap specified in Section 9?"
}
```

### Response Payload (Evidence Found)

```json
{
  "answer": "According to Section 9.1, total liability is capped at the fees paid in the preceding twelve months.",
  "citations": [
    {
      "chunk_id": "chunk_014",
      "section": "9. Limitation of Liability",
      "score": 0.89,
      "page": null
    }
  ]
}
```

### Response Payload (No Evidence Meets `RETRIEVAL_MIN_SCORE`)

```json
{
  "answer": "I could not find enough information in the uploaded document to answer that.",
  "citations": []
}
```

---

## 6. Observability & Health Endpoints

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `GET` | `/api/v1/health` | None | Basic liveness probe. Returns `{"status": "healthy"}`. |
| `GET` | `/api/v1/ready` | None | Readiness probe. Validates active PostgreSQL and Redis connections. Returns `503` if dependencies fail. |
| `GET` | `/api/v1/metrics` | `X-Metrics-Token` | Prometheus-compatible operational metrics for request rates, latencies, and worker job stats. |
