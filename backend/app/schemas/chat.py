from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)


class Citation(BaseModel):
    chunk_id: str
    section: str | None
    score: float
    page: int | None


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]
