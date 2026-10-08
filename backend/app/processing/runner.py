import asyncio
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy import select, update

from app.core.config import get_settings
from app.core.metrics import metrics
from app.db.session import AsyncSessionFactory
from app.models.document import Document
from app.models.processing_job import ProcessingJob
from app.processing.docling import DoclingProcessor, ProcessingError
from app.storage.factory import get_storage

processor = DoclingProcessor()
storage = get_storage()


async def run_processing_job(job_id: UUID) -> None:
    lease_token = uuid4()
    async with AsyncSessionFactory() as db:
        now = datetime.now(UTC)
        claim = await db.execute(
            update(ProcessingJob)
            .where(ProcessingJob.id == job_id, ProcessingJob.status == "queued")
            .values(
                status="claimed",
                attempt_count=ProcessingJob.attempt_count + 1,
                started_at=now,
                lease_expires_at=now
                + timedelta(minutes=get_settings().processing_lease_minutes),
                lease_token=lease_token,
            )
            .returning(ProcessingJob.document_id)
        )
        document_id = claim.scalar_one_or_none()
        if document_id is None:
            return
        document = await db.get(Document, document_id)
        if document is None:
            await db.rollback()
            return
        storage_key = document.storage_key
        document.status = "processing"
        document.processing_stage = "extracting"
        document.processing_progress = 25
        document.processing_started_at = now
        await db.commit()

    try:
        async with storage.materialize(storage_key) as source:
            markdown = await asyncio.to_thread(processor.convert_to_markdown, source)
        async with AsyncSessionFactory() as db:
            finalized = await db.execute(
                update(ProcessingJob)
                .where(ProcessingJob.id == job_id, ProcessingJob.lease_token == lease_token)
                .values(
                    status="completed",
                    completed_at=datetime.now(UTC),
                    lease_expires_at=None,
                    lease_token=None,
                )
                .returning(ProcessingJob.document_id)
            )
            document_id = finalized.scalar_one_or_none()
            if document_id is None:
                await db.rollback()
                return
            document = await db.get(Document, document_id)
            if document is None:
                await db.rollback()
                return
            document.structured_json = {
                "markdown": markdown,
                "metadata": {
                    "character_count": len(markdown),
                    "line_count": len(markdown.splitlines()),
                    "word_count": len(markdown.split()),
                },
                "tables": [],
            }
            document.status = "ready"
            document.processing_stage = "completed"
            document.processing_progress = 100
            document.processing_error = None
            document.processing_completed_at = datetime.now(UTC)
            await db.commit()
        metrics.increment("documind_processing_jobs_total", outcome="completed")
    except ProcessingError as error:
        await mark_failed(job_id, lease_token, str(error))
    except Exception:
        await mark_failed(job_id, lease_token, "PROCESSING_FAILED")


async def mark_failed(job_id: UUID, lease_token: UUID, error_code: str) -> None:
    async with AsyncSessionFactory() as db:
        failed = await db.execute(
            update(ProcessingJob)
            .where(ProcessingJob.id == job_id, ProcessingJob.lease_token == lease_token)
            .values(
                status="failed",
                last_error=error_code[:64],
                lease_expires_at=None,
                lease_token=None,
            )
            .returning(ProcessingJob.document_id)
        )
        document_id = failed.scalar_one_or_none()
        if document_id is None:
            await db.rollback()
            return
        document = await db.get(Document, document_id)
        if document is not None:
            document.status = "failed"
            document.processing_stage = "failed"
            document.processing_error = error_code[:64]
        await db.commit()
    metrics.increment("documind_processing_jobs_total", outcome="failed")
