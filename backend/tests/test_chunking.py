from uuid import UUID, uuid4

from app.indexing.chunking import chunk_markdown
from app.indexing.qdrant import QdrantIndexer


def test_chunking_is_deterministic_and_preserves_section_context() -> None:
    markdown = "# Overview\n\nAlpha\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nBeta"

    first = chunk_markdown(markdown, max_chars=40, overlap=5)
    second = chunk_markdown(markdown, max_chars=40, overlap=5)

    assert first == second
    assert first[0].section == "Overview"
    assert any("| A | B |" in chunk.text for chunk in first)


def test_qdrant_point_ids_are_stable_and_document_scoped() -> None:
    document_id = uuid4()
    first = QdrantIndexer.point_id(document_id, 1, "chunk-000001")
    second = QdrantIndexer.point_id(document_id, 1, "chunk-000001")
    other_document = QdrantIndexer.point_id(UUID(int=document_id.int + 1), 1, "chunk-000001")

    assert first == second
    assert first != other_document
