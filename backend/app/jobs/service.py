import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import update

from app.core.metrics import metrics
from app.db.session import AsyncSessionFactory
from app.jobs.dispatcher import job_dispatcher
from app.models.processing_job import ProcessingJob

logger = logging.getLogger(__name__)


async def dispatch_processing_job(job_id: UUID) -> bool:
    """Publish a persisted job; leave it discoverable if the broker is unavailable."""
    try:
        await job_dispatcher.enqueue_processing(job_id)
    except Exception:
        metrics.increment("documind_job_dispatch_errors_total")
        logger.exception("Processing job dispatch failed", extra={"job_id": str(job_id)})
        return False
    try:
        async with AsyncSessionFactory() as db:
            await db.execute(
                update(ProcessingJob)
                .where(ProcessingJob.id == job_id, ProcessingJob.status == "queued")
                .values(dispatched_at=datetime.now(UTC))
            )
            await db.commit()
    except Exception:
        metrics.increment("documind_job_dispatch_tracking_errors_total")
        logger.exception(
            "Could not persist processing dispatch timestamp", extra={"job_id": str(job_id)}
        )
    return True
