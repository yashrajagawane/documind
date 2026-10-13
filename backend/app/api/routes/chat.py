from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
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

    history_tuples = [(item.role, item.content) for item in request.history] if request.history else None
    try:
        answer = await GeminiGenerator().answer(
            build_grounded_prompt(request.question, chunks, history=history_tuples)
        )
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


@router.post("/{document_id}/chat/stream")
async def chat_stream(
    document_id: UUID,
    request: ChatRequest,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session),
) -> StreamingResponse:
    import json
    from collections.abc import AsyncIterator
    from fastapi.responses import StreamingResponse

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
    citations_data = [
        {"chunk_id": p.chunk_id, "section": p.section, "score": p.score, "page": p.page}
        for p in points
    ]

    async def sse_event_generator() -> AsyncIterator[str]:
        # 1. Send citations immediately so UI surfaces verified sources first
        yield f"event: citations\ndata: {json.dumps({'citations': citations_data})}\n\n"

        if not chunks:
            yield f"event: token\ndata: {json.dumps({'token': NO_EVIDENCE_MESSAGE})}\n\n"
            yield f"event: done\ndata: {json.dumps({'done': True})}\n\n"
            return

        history_tuples = (
            [(item.role, item.content) for item in request.history] if request.history else None
        )
        prompt = build_grounded_prompt(request.question, chunks, history=history_tuples)

        try:
            generator = GeminiGenerator()
            async for token in generator.answer_stream(prompt):
                yield f"event: token\ndata: {json.dumps({'token': token})}\n\n"
            yield f"event: done\ndata: {json.dumps({'done': True})}\n\n"
        except GenerationUnavailable:
            yield f"event: error\ndata: {json.dumps({'error': 'Grounded generation is not configured.'})}\n\n"
        except Exception:
            yield f"event: error\ndata: {json.dumps({'error': 'An error occurred during generation.'})}\n\n"

    return StreamingResponse(
        sse_event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
