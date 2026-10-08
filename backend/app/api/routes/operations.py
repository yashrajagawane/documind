import secrets
from datetime import UTC, datetime

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy import extract, func, select

from app.core.config import get_settings
from app.core.metrics import metrics
from app.db.session import AsyncSessionFactory
from app.models.processing_job import ProcessingJob

router = APIRouter()


@router.get("/metrics", include_in_schema=False, response_class=PlainTextResponse)
async def metrics_endpoint(
    x_metrics_token: str | None = Header(default=None),
) -> PlainTextResponse:
    """Expose process metrics only when a dedicated operations token is configured."""
    configured_token = get_settings().metrics_token
    if not configured_token or not x_metrics_token:
        raise HTTPException(status_code=404, detail="Not found.")
    if not secrets.compare_digest(configured_token, x_metrics_token):
        raise HTTPException(status_code=404, detail="Not found.")
    try:
        async with AsyncSessionFactory() as db:
            status_counts = await db.execute(
                select(ProcessingJob.status, func.count(ProcessingJob.id)).group_by(
                    ProcessingJob.status
                )
            )
            counts = dict(status_counts.all())
            for state in ("queued", "claimed", "retryable", "failed", "completed", "cancelled"):
                metrics.set_gauge("documind_processing_jobs", counts.get(state, 0), status=state)
            retry_count = await db.scalar(
                select(func.count(ProcessingJob.id)).where(ProcessingJob.attempt_count > 1)
            )
            metrics.set_gauge("documind_processing_jobs_retried", retry_count or 0)
            expired_count = await db.scalar(
                select(func.count(ProcessingJob.id)).where(
                    ProcessingJob.last_error == "PROCESSING_LEASE_EXPIRED"
                )
            )
            metrics.set_gauge("documind_processing_jobs_with_expired_lease", expired_count or 0)
            oldest_queued = await db.scalar(
                select(func.min(ProcessingJob.created_at)).where(ProcessingJob.status == "queued")
            )
            queue_age = (
                max(0.0, (datetime.now(UTC) - oldest_queued).total_seconds())
                if oldest_queued
                else 0.0
            )
            metrics.set_gauge("documind_processing_queue_oldest_age_seconds", queue_age)
            average_duration = await db.scalar(
                select(
                    func.avg(
                        extract("epoch", ProcessingJob.completed_at - ProcessingJob.started_at)
                    )
                ).where(
                    ProcessingJob.status == "completed",
                    ProcessingJob.completed_at.is_not(None),
                    ProcessingJob.started_at.is_not(None),
                )
            )
            metrics.set_gauge(
                "documind_processing_duration_seconds_average", average_duration or 0
            )
    except Exception as error:
        metrics.increment("documind_metrics_database_errors_total")
        raise HTTPException(
            status_code=503, detail="Metrics are temporarily unavailable."
        ) from error
    return PlainTextResponse(metrics.render_prometheus())
