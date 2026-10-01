import asyncio
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select

from app.db.session import AsyncSessionFactory
from app.models.document import Document
from app.models.processing_job import ProcessingJob
from app.processing.docling import DoclingProcessor, ProcessingError
from app.storage.local import LocalStorage

processor = DoclingProcessor()
storage = LocalStorage()
async def run_processing_job(job_id: UUID) -> None:
    async with AsyncSessionFactory() as db:
        row = await db.execute(
            select(ProcessingJob, Document)
            .join(Document, Document.id == ProcessingJob.document_id)
            .where(ProcessingJob.id == job_id)
        )
        pair = row.one_or_none()
        if not pair:
            return
        job, document = pair
        if job.status != "queued":
            return
        now = datetime.now(UTC)
        job.status = "claimed"
        job.started_at = now
        job.lease_expires_at = now + timedelta(minutes=30)
        document.status = "processing"
        document.processing_stage = "extracting"
        document.processing_progress = 25
        document.processing_started_at = now
        await db.commit()

        try:
            source = storage.path_for(document.storage_key)
            markdown = await asyncio.to_thread(processor.convert_to_markdown, source)
            document.structured_json = {"markdown": markdown}
            document.status = "ready"
            document.processing_stage = "completed"
            document.processing_progress = 100
            document.processing_error = None
            document.processing_completed_at = datetime.now(UTC)
            job.status = "completed"
            job.completed_at = datetime.now(UTC)
            job.lease_expires_at = None
            await db.commit()
        except ProcessingError as error:
            await mark_failed(db, job, document, str(error))
        except Exception:
            await mark_failed(db, job, document, "PROCESSING_FAILED")


async def mark_failed(db, job: ProcessingJob, document: Document, error_code: str) -> None:
    job.status = "failed"
    job.last_error = error_code[:64]
    job.lease_expires_at = None
    document.status = "failed"
    document.processing_stage = "failed"
    document.processing_error = error_code[:64]
    await db.commit()
