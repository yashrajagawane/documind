from pathlib import Path
from typing import BinaryIO, Protocol


class PrivateStorage(Protocol):
    """Private-object interface shared by local and future object storage adapters."""

    def path_for(self, key: str) -> Path: ...

    async def save_stream(
        self, source: BinaryIO, key: str, max_bytes: int, suffix: str
    ) -> tuple[int, str]: ...

    async def delete(self, key: str) -> None: ...
