from io import BytesIO
from unittest.mock import MagicMock, patch

import pytest

from app.storage.local import LocalStorage, StorageError, build_upload_key
from app.storage.s3 import S3Storage, validate_object_key


@pytest.mark.asyncio
async def test_local_storage_streams_private_pdf_and_returns_checksum(tmp_path) -> None:
    storage = LocalStorage(str(tmp_path))
    key = build_upload_key("00000000-0000-0000-0000-000000000001", ".pdf")

    size, checksum = await storage.save_stream(BytesIO(b"%PDF-1.7\ncontent"), key, 1024, ".pdf")

    assert size == 16
    assert len(checksum) == 64
    assert (tmp_path / key).read_bytes() == b"%PDF-1.7\ncontent"
    assert "00000000-0000-0000-0000-000000000001" in key


@pytest.mark.asyncio
async def test_local_storage_rejects_spoofed_pdf_and_path_escape(tmp_path) -> None:
    storage = LocalStorage(str(tmp_path))

    with pytest.raises(StorageError):
        await storage.save_stream(BytesIO(b"not a pdf"), "uploads/user/file.pdf", 1024, ".pdf")

    with pytest.raises(StorageError):
        await storage.save_stream(BytesIO(b"%PDF-1.7"), "../outside.pdf", 1024, ".pdf")


@pytest.mark.asyncio
async def test_local_storage_enforces_size_limit(tmp_path) -> None:
    storage = LocalStorage(str(tmp_path))

    with pytest.raises(StorageError):
        await storage.save_stream(BytesIO(b"%PDF-1.7\nlarge"), "uploads/file.pdf", 4, ".pdf")


def test_s3_key_validation() -> None:
    assert validate_object_key("uploads/user1/doc.pdf") == "uploads/user1/doc.pdf"

    with pytest.raises(StorageError):
        validate_object_key("/leading_slash/doc.pdf")

    with pytest.raises(StorageError):
        validate_object_key("traversal/../escape.pdf")

    with pytest.raises(StorageError):
        validate_object_key("")


@pytest.mark.asyncio
async def test_s3_storage_operations() -> None:
    mock_boto_client = MagicMock()

    with patch("app.storage.s3.get_settings") as mock_settings, \
         patch("app.storage.s3.boto3.client", return_value=mock_boto_client):
        mock_settings.return_value = MagicMock(
            s3_bucket="test-bucket",
            s3_region="us-east-1",
            s3_endpoint_url=None,
            s3_force_path_style=False,
            s3_access_key_id="test-key",
            s3_secret_access_key="test-secret",
            s3_session_token=None,
            s3_server_side_encryption="AES256",
            s3_kms_key_id=None,
        )

        storage = S3Storage()
        assert storage.bucket == "test-bucket"

        # Test save_stream
        key = "uploads/user/test.pdf"
        size, checksum = await storage.save_stream(
            BytesIO(b"%PDF-1.7\ns3 content"), key, 1024, ".pdf"
        )
        assert size == 19
        assert len(checksum) == 64
        mock_boto_client.upload_file.assert_called_once()

        # Test delete
        await storage.delete(key)
        mock_boto_client.delete_object.assert_called_once_with(
            Bucket="test-bucket", Key=key
        )
