import asyncio
from uuid import UUID

from sqlalchemy import select

from app.db.session import AsyncSessionFactory
from app.jobs.celery_app import celery_app
from app.models.processing_job import ProcessingJob
from app.processing.recovery import recover_expired_processing_leases
from app.processing.runner import run_processing_job


@celery_app.task(name="app.jobs.tasks.process_document")
def process_document(job_id: str) -> None:
    asyncio.run(run_processing_job(UUID(job_id)))


@celery_app.task(name="app.jobs.tasks.recover_and_dispatch_jobs")
def recover_and_dispatch_jobs() -> int:
    return asyncio.run(_recover_and_dispatch_jobs())


async def _recover_and_dispatch_jobs() -> int:
    await recover_expired_processing_leases()
    async with AsyncSessionFactory() as db:
        job_ids = await db.scalars(
            select(ProcessingJob.id)
            .where(ProcessingJob.status == "queued")
            .order_by(ProcessingJob.created_at)
            .limit(500)
        )
        pending = list(job_ids)
    for job_id in pending:
        process_document.apply_async(
            args=[str(job_id)],
            queue="document-processing",
        )
    return len(pending)
