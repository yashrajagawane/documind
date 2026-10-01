from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration loaded only from environment variables or `.env`."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "DocuMind API"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql+asyncpg://documind:documind@localhost:5432/documind"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    log_level: str = "INFO"
    jwt_secret_key: str = "dev-only-change-this-secret"
    jwt_algorithm: str = "HS256"
    jwt_access_expire_minutes: int = 60
    jwt_refresh_expire_days: int = 14
    refresh_cookie_secure: bool = False
    storage_dir: str = "storage"
    max_upload_bytes: int = 25 * 1024 * 1024
    allowed_upload_extensions: list[str] = Field(
        default_factory=lambda: [".pdf", ".docx", ".xlsx", ".pptx", ".txt", ".csv", ".md"]
    )
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str | None = None
    qdrant_collection: str = "documind_chunks"
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    embedding_dimensions: int = 384

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("allowed_upload_extensions", mode="before")
    @classmethod
    def parse_upload_extensions(cls, value: str | list[str]) -> list[str]:
        values = value.split(",") if isinstance(value, str) else value
        return [extension.strip().lower() for extension in values if extension.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
