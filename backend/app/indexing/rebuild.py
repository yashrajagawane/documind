"""Rebuild the derived Qdrant index from ready PostgreSQL document artifacts."""

from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select

from app.db.session import AsyncSessionFactory
from app.indexing.qdrant import QdrantIndexer
from app.indexing.runner import index_artifact
from app.models.document import Document

logger = logging.getLogger(__name__)


async def rebuild() -> int:
    """Reindex each ready artifact after first removing its stale points."""
    async with AsyncSessionFactory() as db:
        rows = await db.execute(
            select(Document.id, Document.user_id, Document.structured_json)
            .where(Document.status == "ready", Document.structured_json.is_not(None))
            .order_by(Document.created_at)
        )
        documents = rows.all()

    indexer = QdrantIndexer()
    indexed = 0
    failures: list[str] = []
    for document_id, user_id, artifact in documents:
        markdown = str((artifact or {}).get("markdown", ""))
        try:
            await indexer.delete_document_points(user_id, document_id)
            chunk_count = await index_artifact(user_id, document_id, 1, markdown)
            indexed += 1
            logger.info(
                "Rebuilt Qdrant document index document_id=%s chunks=%s",
                document_id,
                chunk_count,
            )
        except Exception:
            logger.exception("Failed to rebuild Qdrant document index document_id=%s", document_id)
            failures.append(str(document_id))

    print(f"Qdrant rebuild summary: indexed={indexed} failed={len(failures)}")
    if failures:
        print("Failed document IDs: " + ", ".join(failures))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(rebuild()))
