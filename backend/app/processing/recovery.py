from datetime import UTC, datetime

from sqlalchemy import select

from app.core.config import get_settings
from app.core.metrics import metrics
from app.db.session import AsyncSessionFactory
from app.models.document import Document
from app.models.processing_job import ProcessingJob


def recovery_outcome(attempt_count: int, max_attempts: int) -> str:
    """Choose the next durable state for a job whose worker lease expired."""
    return "failed" if attempt_count >= max_attempts else "queued"


async def recover_expired_processing_leases(now: datetime | None = None) -> int:
    """Requeue abandoned claims, or fail them after their bounded retry budget."""
    settings = get_settings()
    checked_at = now or datetime.now(UTC)
    recovered = 0
    async with AsyncSessionFactory() as db:
        rows = await db.execute(
            select(ProcessingJob, Document)
            .join(Document, Document.id == ProcessingJob.document_id)
            .where(
                ProcessingJob.status == "claimed",
                ProcessingJob.lease_expires_at.is_not(None),
                ProcessingJob.lease_expires_at < checked_at,
            )
        )
        for job, document in rows.all():
            outcome = recovery_outcome(job.attempt_count, settings.processing_max_attempts)
            job.status = outcome
            job.lease_expires_at = None
            job.last_error = "PROCESSING_LEASE_EXPIRED"
            if outcome == "queued":
                document.status = "queued"
                document.processing_stage = "queued"
                document.processing_progress = 0
                document.processing_error = None
            else:
                document.status = "failed"
                document.processing_stage = "failed"
                document.processing_error = "PROCESSING_LEASE_EXPIRED"
            metrics.increment("documind_processing_lease_recoveries_total", outcome=outcome)
            recovered += 1
        if recovered:
            await db.commit()
    return recovered
