from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import or_, select

from app.core.config import get_settings
from app.db.session import AsyncSessionFactory
from app.jobs.celery_app import celery_app
from app.jobs.asyncio_runner import run_on_worker_loop
from app.jobs.service import dispatch_processing_job
from app.models.processing_job import ProcessingJob
from app.processing.recovery import recover_expired_processing_leases
from app.processing.runner import run_processing_job


@celery_app.task(name="app.jobs.tasks.process_document")
def process_document(job_id: str) -> None:
    run_on_worker_loop(run_processing_job(UUID(job_id)))


@celery_app.task(name="app.jobs.tasks.recover_and_dispatch_jobs")
def recover_and_dispatch_jobs() -> int:
    return run_on_worker_loop(_recover_and_dispatch_jobs())


async def _recover_and_dispatch_jobs() -> int:
    await recover_expired_processing_leases()
    settings = get_settings()
    now = datetime.now(UTC)
    stale_before = now - timedelta(seconds=settings.processing_dispatch_stale_seconds)
    async with AsyncSessionFactory() as db:
        job_ids = await db.scalars(
            select(ProcessingJob.id)
            .where(
                ProcessingJob.status == "queued",
                or_(ProcessingJob.next_attempt_at.is_(None), ProcessingJob.next_attempt_at <= now),
                or_(
                    ProcessingJob.dispatched_at.is_(None),
                    ProcessingJob.dispatched_at < stale_before,
                ),
            )
            .order_by(ProcessingJob.created_at)
            .limit(500)
        )
        pending = list(job_ids)
    for job_id in pending:
        await dispatch_processing_job(job_id)
    return len(pending)
