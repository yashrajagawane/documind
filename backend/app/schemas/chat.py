from typing import Literal

from pydantic import BaseModel, Field


class ChatHistoryItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=10000)


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    history: list[ChatHistoryItem] = Field(default_factory=list)


class Citation(BaseModel):
    chunk_id: str
    section: str | None
    score: float
    page: int | None


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]
