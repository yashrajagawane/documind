from pathlib import Path
from uuid import UUID

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Header,
    HTTPException,
    Response,
    UploadFile,
    status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id
from app.core.config import get_settings
from app.db.session import get_db_session
from app.models.document import Document
from app.models.processing_job import ProcessingJob
from app.processing.runner import run_processing_job
from app.schemas.documents import DocumentSummary
from app.storage.local import LocalStorage, StorageError, build_upload_key

router = APIRouter(prefix="/documents")
settings = get_settings()
storage = LocalStorage(settings.storage_dir)


def safe_original_name(filename: str | None) -> tuple[str, str]:
    if not filename:
        raise HTTPException(status_code=422, detail="A filename is required.")
    original_name = Path(filename).name
    suffix = Path(original_name).suffix.lower()
    if not original_name or suffix not in settings.allowed_upload_extensions:
        raise HTTPException(status_code=415, detail="That file type is not supported.")
    return original_name, suffix


@router.post("", response_model=DocumentSummary, status_code=status.HTTP_201_CREATED)
async def upload_document(
    response: Response,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session),
) -> Document:
    original_name, suffix = safe_original_name(file.filename)
    if idempotency_key:
        existing = await db.scalar(
            select(Document).where(
                Document.user_id == user_id, Document.idempotency_key == idempotency_key
            )
        )
        if existing:
            response.status_code = status.HTTP_200_OK
            return existing

    key = build_upload_key(user_id, suffix)
    try:
        size, checksum = await storage.save_stream(
            file.file, key, settings.max_upload_bytes, suffix
        )
    except StorageError as error:
        raise HTTPException(status_code=413, detail=str(error)) from error
    if size == 0:
        await storage.delete(key)
        raise HTTPException(status_code=422, detail="The uploaded file is empty.")

    duplicate = await db.scalar(
        select(Document).where(Document.user_id == user_id, Document.checksum_sha256 == checksum)
    )
    if duplicate:
        await storage.delete(key)
        response.status_code = status.HTTP_200_OK
        return duplicate

    document = Document(
        user_id=user_id,
        storage_key=key,
        original_name=original_name,
        checksum_sha256=checksum,
        idempotency_key=idempotency_key,
        status="queued",
        processing_stage="queued",
        processing_progress=0,
    )
    db.add(document)
    await db.flush()
    job = ProcessingJob(document_id=document.id, status="queued", attempt_count=0)
    db.add(job)
    try:
        await db.commit()
    except Exception:
        await storage.delete(key)
        raise
    await db.refresh(document)
    background_tasks.add_task(run_processing_job, job.id)
    return document


@router.get("", response_model=list[DocumentSummary])
async def list_documents(
    user_id: UUID = Depends(get_current_user_id), db: AsyncSession = Depends(get_db_session)
) -> list[Document]:
    result = await db.scalars(
        select(Document)
        .where(Document.user_id == user_id)
        .order_by(Document.created_at.desc())
    )
    return list(result)


@router.get("/{document_id}", response_model=DocumentSummary)
async def get_document(
    document_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session),
) -> Document:
    document = await db.scalar(
        select(Document).where(Document.id == document_id, Document.user_id == user_id)
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found.")
    return document


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    document = await db.scalar(
        select(Document).where(Document.id == document_id, Document.user_id == user_id)
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found.")
    await storage.delete(document.storage_key)
    await db.delete(document)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{document_id}/retry", response_model=DocumentSummary, status_code=202)
async def retry_document(
    document_id: UUID,
    background_tasks: BackgroundTasks,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session),
) -> Document:
    document = await db.scalar(
        select(Document).where(Document.id == document_id, Document.user_id == user_id)
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found.")
    if document.status != "failed":
        raise HTTPException(status_code=409, detail="Only failed documents can be retried.")
    document.status = "queued"
    document.processing_stage = "queued"
    document.processing_progress = 0
    document.processing_error = None
    job = ProcessingJob(document_id=document.id, status="queued", attempt_count=0)
    db.add(job)
    await db.commit()
    await db.refresh(document)
    background_tasks.add_task(run_processing_job, job.id)
    return document
