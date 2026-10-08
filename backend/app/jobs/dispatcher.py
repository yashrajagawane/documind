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


job_dispatcher: JobDispatcher = InProcessJobDispatcher()
