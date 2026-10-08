import asyncio
from typing import Protocol
from uuid import UUID

from app.processing.runner import run_processing_job


class JobDispatcher(Protocol):
    """Async job-ID dispatch contract independent of HTTP framework and broker."""

    async def enqueue_processing(self, job_id: UUID) -> None: ...


class InProcessJobDispatcher:
    """Local-development adapter; production should use a durable broker adapter."""

    async def enqueue_processing(self, job_id: UUID) -> None:
        asyncio.create_task(run_processing_job(job_id))


def build_job_dispatcher() -> JobDispatcher:
    from app.core.config import get_settings

    settings = get_settings()
    if settings.job_queue_backend == "inprocess":
        return InProcessJobDispatcher()
    if settings.job_queue_backend == "celery":
        from app.jobs.celery_dispatcher import CeleryJobDispatcher

        return CeleryJobDispatcher(settings.celery_broker_url or "")
    raise ValueError(f"Unsupported job queue backend: {settings.job_queue_backend}")


job_dispatcher = build_job_dispatcher()
