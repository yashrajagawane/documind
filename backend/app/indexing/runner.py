from uuid import UUID

from app.indexing.chunking import chunk_markdown
from app.indexing.qdrant import QdrantIndexer


async def index_artifact(
    user_id: UUID, document_id: UUID, artifact_version: int, markdown: str
) -> int:
    chunks = chunk_markdown(markdown)
    await QdrantIndexer().upsert(user_id, document_id, artifact_version, chunks)
    return len(chunks)
