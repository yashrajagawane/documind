from celery import Celery
from celery.schedules import crontab

from app.core.config import get_settings

settings = get_settings()
if not settings.celery_broker_url:
    raise RuntimeError("CELERY_BROKER_URL is required to start the Celery worker.")

celery_app = Celery(
    "documind",
    broker=settings.celery_broker_url,
    include=["app.jobs.tasks"],
)
celery_app.conf.update(
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_ignore_result=True,
    worker_prefetch_multiplier=1,
    broker_transport_options={"visibility_timeout": settings.processing_lease_minutes * 120},
    beat_schedule={
        "recover-and-dispatch-processing-jobs": {
            "task": "app.jobs.tasks.recover_and_dispatch_jobs",
            "schedule": 30.0,
        }
    },
)
