from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id
from app.core.config import get_settings
from app.db.session import get_db_session
from app.indexing.qdrant import IndexingUnavailable, QdrantIndexer
from app.models.document import Document
from app.rag.generator import GeminiGenerator, GenerationUnavailable
from app.rag.grounding import NO_EVIDENCE_MESSAGE, RetrievedChunk, build_grounded_prompt
from app.schemas.chat import ChatRequest, ChatResponse, Citation

router = APIRouter(prefix="/documents")


@router.post("/{document_id}/chat", response_model=ChatResponse)
async def chat(
    document_id: UUID,
    request: ChatRequest,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session),
) -> ChatResponse:
    document = await db.scalar(
        select(Document).where(Document.id == document_id, Document.user_id == user_id)
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found.")
    if document.status != "ready":
        raise HTTPException(status_code=409, detail="Document is not ready for questions.")

    settings = get_settings()
    try:
        points = await QdrantIndexer().search(
            user_id,
            document_id,
            request.question,
            settings.retrieval_top_k,
            settings.retrieval_min_score,
        )
    except IndexingUnavailable as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Retrieval is not configured.",
        ) from error
    chunks = [RetrievedChunk(p.chunk_id, p.text, p.section, p.score, p.page) for p in points]
    if not chunks:
        return ChatResponse(answer=NO_EVIDENCE_MESSAGE, citations=[])

    try:
        answer = await GeminiGenerator().answer(build_grounded_prompt(request.question, chunks))
    except GenerationUnavailable as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Grounded generation is not configured.",
        ) from error
    return ChatResponse(
        answer=answer,
        citations=[
            Citation(chunk_id=p.chunk_id, section=p.section, score=p.score, page=p.page)
            for p in points
        ],
    )
