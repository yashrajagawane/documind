from io import BytesIO

import pytest

from app.storage.local import LocalStorage, StorageError, build_upload_key


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
