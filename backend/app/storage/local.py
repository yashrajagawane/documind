import asyncio
import hashlib
import os
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
from pathlib import Path, PurePosixPath
from typing import BinaryIO
from uuid import UUID

from app.core.config import get_settings


class StorageError(Exception):
    """Raised when a private storage operation cannot be completed safely."""


class LocalStorage:
    def __init__(self, root: str | None = None) -> None:
        self.root = Path(root or get_settings().storage_dir).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _resolve(self, key: str) -> Path:
        path = (self.root / PurePosixPath(key)).resolve()
        if path != self.root and self.root not in path.parents:
            raise StorageError("Storage key escaped the private storage root.")
        return path

    def path_for(self, key: str) -> Path:
        return self._resolve(key)

    @asynccontextmanager
    async def materialize(self, key: str) -> AsyncIterator[Path]:
        path = self._resolve(key)
        if not path.is_file():
            raise StorageError("The requested private object does not exist.")
        yield path

    async def save_stream(
        self, source: BinaryIO, key: str, max_bytes: int, suffix: str
    ) -> tuple[int, str]:
        path = self._resolve(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        return await asyncio.to_thread(self._save_stream, source, path, max_bytes, suffix)

    @staticmethod
    def _save_stream(
        source: BinaryIO, path: Path, max_bytes: int, suffix: str
    ) -> tuple[int, str]:
        digest = hashlib.sha256()
        total = 0
        temporary = path.with_name(f".{path.name}.uploading")
        try:
            with temporary.open("wb") as target:
                first_chunk = True
                while chunk := source.read(1024 * 1024):
                    total += len(chunk)
                    if total > max_bytes:
                        raise StorageError("The uploaded file exceeds the configured size limit.")
                    if first_chunk:
                        if suffix == ".pdf" and not chunk.startswith(b"%PDF-"):
                            raise StorageError(
                                "The uploaded file does not match its PDF extension."
                            )
                        if suffix in {".docx", ".xlsx", ".pptx"} and not chunk.startswith(b"PK"):
                            raise StorageError(
                                "The uploaded file does not match its Office extension."
                            )
                        first_chunk = False
                    digest.update(chunk)
                    target.write(chunk)
            os.replace(temporary, path)
        except Exception:
            temporary.unlink(missing_ok=True)
            raise
        return total, digest.hexdigest()

    async def delete(self, key: str) -> None:
        await asyncio.to_thread(self._resolve(key).unlink, missing_ok=True)


def build_upload_key(user_id: UUID, suffix: str) -> str:
    from uuid import uuid4

    return f"uploads/{user_id}/{uuid4()}{suffix.lower()}"
