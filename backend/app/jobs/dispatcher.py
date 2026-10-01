from typing import Protocol
from uuid import UUID

from fastapi import BackgroundTasks

from app.processing.runner import run_processing_job


class JobDispatcher(Protocol):
    """Queues durable job IDs without coupling API routes to a worker vendor."""

    def enqueue_processing(self, background_tasks: BackgroundTasks, job_id: UUID) -> None: ...


class InProcessJobDispatcher:
    """V1 adapter; replace with a durable queue adapter without changing routes."""

    def enqueue_processing(self, background_tasks: BackgroundTasks, job_id: UUID) -> None:
        background_tasks.add_task(run_processing_job, job_id)


job_dispatcher: JobDispatcher = InProcessJobDispatcher()
