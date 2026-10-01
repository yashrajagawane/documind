from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DocumentSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    original_name: str
    checksum_sha256: str
    status: str
    processing_stage: str | None
    processing_progress: int
    created_at: datetime


class DocumentPreview(DocumentSummary):
    markdown: str
    metadata: dict[str, int]
    tables: list[dict[str, object]]
