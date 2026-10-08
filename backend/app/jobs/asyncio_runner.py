import asyncio
from collections.abc import Coroutine
from typing import Any

_worker_loop: asyncio.AbstractEventLoop | None = None


def run_on_worker_loop(coroutine: Coroutine[Any, Any, Any]) -> Any:
    """Reuse one event loop per Celery process for SQLAlchemy async engine pools."""
    global _worker_loop
    if _worker_loop is None or _worker_loop.is_closed():
        _worker_loop = asyncio.new_event_loop()
    return _worker_loop.run_until_complete(coroutine)
