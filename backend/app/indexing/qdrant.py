import asyncio
import hashlib
from dataclasses import dataclass
from uuid import UUID

from app.core.config import get_settings
from app.indexing.chunking import Chunk


@dataclass(frozen=True)
class RetrievedPoint:
    chunk_id: str
    text: str
    section: str | None
    score: float
    page: int | None


class IndexingUnavailable(Exception):
    """Raised when optional embedding or Qdrant dependencies are not installed."""


class EmbeddingService:
    def __init__(self) -> None:
        self._model = None

    def embed(self, texts: list[str]) -> list[list[float]]:
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as error:
            raise IndexingUnavailable("EMBEDDING_UNAVAILABLE") from error
        if self._model is None:
            self._model = SentenceTransformer(get_settings().embedding_model)
        return self._model.encode(texts, normalize_embeddings=True).tolist()


class QdrantIndexer:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.embeddings = EmbeddingService()

    @staticmethod
    def point_id(document_id: UUID, artifact_version: int, chunk_id: str) -> str:
        value = f"{document_id}:{artifact_version}:{chunk_id}".encode()
        return str(UUID(bytes=hashlib.sha256(value).digest()[:16]))

    async def upsert(
        self, user_id: UUID, document_id: UUID, artifact_version: int, chunks: list[Chunk]
    ) -> None:
        try:
            from qdrant_client import AsyncQdrantClient, models
        except ImportError as error:
            raise IndexingUnavailable("VECTOR_INDEX_UNAVAILABLE") from error
        if not chunks:
            return
        vectors = await asyncio.to_thread(self.embeddings.embed, [chunk.text for chunk in chunks])
        client = AsyncQdrantClient(
            url=self.settings.qdrant_url, api_key=self.settings.qdrant_api_key
        )
        try:
            collections = await client.collection_exists(self.settings.qdrant_collection)
            if not collections:
                await client.create_collection(
                    collection_name=self.settings.qdrant_collection,
                    vectors_config=models.VectorParams(
                        size=self.settings.embedding_dimensions, distance=models.Distance.COSINE
                    ),
                )
            await client.upsert(
                collection_name=self.settings.qdrant_collection,
                points=[
                    models.PointStruct(
                        id=self.point_id(document_id, artifact_version, chunk.chunk_id),
                        vector=vector,
                        payload={
                            "user_id": str(user_id),
                            "document_id": str(document_id),
                            "artifact_version": artifact_version,
                            "chunk_id": chunk.chunk_id,
                            "section": chunk.section,
                            "text": chunk.text,
                        },
                    )
                    for chunk, vector in zip(chunks, vectors, strict=True)
                ],
            )
        finally:
            await client.close()

    async def search(
        self, user_id: UUID, document_id: UUID, query: str, limit: int, min_score: float
    ) -> list[RetrievedPoint]:
        try:
            from qdrant_client import AsyncQdrantClient, models
        except ImportError as error:
            raise IndexingUnavailable("VECTOR_INDEX_UNAVAILABLE") from error
        vector = (await asyncio.to_thread(self.embeddings.embed, [query]))[0]
        client = AsyncQdrantClient(
            url=self.settings.qdrant_url, api_key=self.settings.qdrant_api_key
        )
        try:
            result = await client.query_points(
                collection_name=self.settings.qdrant_collection,
                query=vector,
                query_filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="user_id", match=models.MatchValue(value=str(user_id))
                        ),
                        models.FieldCondition(
                            key="document_id", match=models.MatchValue(value=str(document_id))
                        ),
                    ]
                ),
                limit=limit,
                score_threshold=min_score,
                with_payload=True,
            )
            return [
                RetrievedPoint(
                    chunk_id=str(point.payload.get("chunk_id", "")),
                    text=str(point.payload.get("text", "")),
                    section=point.payload.get("section"),
                    score=float(point.score),
                    page=point.payload.get("page"),
                )
                for point in result.points
            ]
        finally:
            await client.close()
