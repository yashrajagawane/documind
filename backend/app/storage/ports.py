from contextlib import AbstractAsyncContextManager
from pathlib import Path
from typing import BinaryIO, Protocol


class PrivateStorage(Protocol):
    """Private-object interface shared by local and S3-compatible adapters."""

    def materialize(self, key: str) -> AbstractAsyncContextManager[Path]: ...

    async def save_stream(
        self, source: BinaryIO, key: str, max_bytes: int, suffix: str
    ) -> tuple[int, str]: ...

    async def delete(self, key: str) -> None: ...
from collections.abc import AsyncIterator
from contextlib import AbstractAsyncContextManager
