# DocuMind

DocuMind is a document intelligence workspace: users upload documents, the backend parses and indexes them, and a grounded chat experience answers questions with source citations.

## Repository structure

```text
backend/    FastAPI application, services, models, schemas, and backend tests
frontend/   Next.js application, components, client data access, and frontend tests
docs/       Product specification, architecture, design, roadmap, and engineering conventions
infra/      Docker Compose, environment templates, and deployment configuration
scripts/    Development and maintenance scripts
storage/    Local runtime storage for uploaded files (not committed)
```

## Planned runtime

- Frontend: Next.js, TypeScript, Tailwind CSS, TanStack Query
- Backend: FastAPI, async SQLAlchemy, Alembic
- Data: PostgreSQL, Qdrant, local filesystem in V1
- AI: Docling for parsing, sentence-transformers for embeddings, Gemini for generation

Read the documents in `docs/` before implementing a feature. The master specification defines scope; the architecture document defines system boundaries; the design and skills documents define UI and coding conventions.

## Current status

The repository currently contains the planning and engineering documentation. Application code will be added incrementally according to the roadmap, beginning with the V1 foundation.
