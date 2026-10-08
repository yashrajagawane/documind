import asyncio
from uuid import UUID

from celery import Celery


class CeleryJobDispatcher:
    def __init__(self, broker_url: str) -> None:
        self.app = Celery("documind", broker=broker_url)

    async def enqueue_processing(self, job_id: UUID) -> None:
        await asyncio.to_thread(
            self.app.send_task,
            "app.jobs.tasks.process_document",
            args=[str(job_id)],
            queue="document-processing",
        )
