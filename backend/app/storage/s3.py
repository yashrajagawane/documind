import asyncio
import tempfile
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path, PurePosixPath
from typing import BinaryIO

import boto3
from botocore.config import Config

from app.core.config import get_settings
from app.storage.local import LocalStorage, StorageError


def validate_object_key(key: str) -> str:
    normalized = PurePosixPath(key)
    if not key or key.startswith("/") or ".." in normalized.parts:
        raise StorageError("Storage key is invalid.")
    return str(normalized)


class S3Storage:
    """Private S3-compatible storage; file transfers stay off the event loop."""

    def __init__(self) -> None:
        settings = get_settings()
        if not settings.s3_bucket:
            raise StorageError("S3_BUCKET must be configured for S3 storage.")
        client_options: dict[str, object] = {
            "region_name": settings.s3_region,
            "endpoint_url": settings.s3_endpoint_url,
            "config": Config(
                s3={"addressing_style": "path" if settings.s3_force_path_style else "auto"}
            ),
        }
        if settings.s3_access_key_id and settings.s3_secret_access_key:
            client_options["aws_access_key_id"] = settings.s3_access_key_id
            client_options["aws_secret_access_key"] = settings.s3_secret_access_key
        if settings.s3_session_token:
            client_options["aws_session_token"] = settings.s3_session_token
        self.client = boto3.client("s3", **client_options)
        self.bucket = settings.s3_bucket
        self.server_side_encryption = settings.s3_server_side_encryption
        self.kms_key_id = settings.s3_kms_key_id

    async def save_stream(
        self, source: BinaryIO, key: str, max_bytes: int, suffix: str
    ) -> tuple[int, str]:
        safe_key = validate_object_key(key)
        with tempfile.TemporaryDirectory(prefix="documind-upload-") as directory:
            path = Path(directory) / "upload"
            try:
                size, checksum = await asyncio.to_thread(
                    LocalStorage._save_stream, source, path, max_bytes, suffix
                )
            except StorageError:
                raise
            except OSError as error:
                raise StorageError("The upload could not be staged safely.") from error
            extra_args: dict[str, str] = {}
            if self.server_side_encryption:
                extra_args["ServerSideEncryption"] = self.server_side_encryption
            if self.kms_key_id:
                extra_args["SSEKMSKeyId"] = self.kms_key_id
            try:
                await asyncio.to_thread(
                    self.client.upload_file,
                    str(path),
                    self.bucket,
                    safe_key,
                    ExtraArgs=extra_args,
                )
            except Exception as error:
                raise StorageError("The private object could not be stored.") from error
        return size, checksum

    @asynccontextmanager
    async def materialize(self, key: str) -> AsyncIterator[Path]:
        safe_key = validate_object_key(key)
        with tempfile.TemporaryDirectory(prefix="documind-processing-") as directory:
            path = Path(directory) / Path(safe_key).name
            try:
                await asyncio.to_thread(
                    self.client.download_file, self.bucket, safe_key, str(path)
                )
            except Exception as error:
                raise StorageError("The private object could not be retrieved.") from error
            yield path

    async def delete(self, key: str) -> None:
        safe_key = validate_object_key(key)
        try:
            await asyncio.to_thread(self.client.delete_object, Bucket=self.bucket, Key=safe_key)
        except Exception as error:
            raise StorageError("The private object could not be deleted.") from error
