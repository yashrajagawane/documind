from functools import lru_cache
from ipaddress import ip_network

from pydantic import Field, field_validator, model_validator
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
    storage_backend: str = "local"
    s3_bucket: str | None = None
    s3_region: str = "us-east-1"
    s3_endpoint_url: str | None = None
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None
    s3_session_token: str | None = None
    s3_force_path_style: bool = False
    s3_server_side_encryption: str = "AES256"
    s3_kms_key_id: str | None = None
    job_queue_backend: str = "inprocess"
    celery_broker_url: str | None = None
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
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.8-flash"
    retrieval_top_k: int = 5
    retrieval_min_score: float = 0.35
    rate_limit_window_seconds: int = 60
    rate_limit_auth_requests: int = 10
    rate_limit_upload_requests: int = 20
    rate_limit_chat_requests: int = 30
    rate_limit_backend: str = "memory"
    rate_limit_redis_url: str | None = None
    rate_limit_key_prefix: str = "documind:rate-limit"
    trusted_proxy_cidrs: list[str] = Field(default_factory=list)
    processing_lease_minutes: int = 30
    processing_max_attempts: int = 3
    processing_dispatch_stale_seconds: int = 300
    metrics_token: str | None = None

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

    @field_validator("trusted_proxy_cidrs", mode="before")
    @classmethod
    def parse_proxy_cidrs(cls, value: str | list[str]) -> list[str]:
        values = value.split(",") if isinstance(value, str) else value
        networks = [
            str(ip_network(network.strip(), strict=False))
            for network in values
            if network.strip()
        ]
        return networks

    @model_validator(mode="after")
    def validate_deployment_secrets(self) -> "Settings":
        if self.storage_backend not in {"local", "s3"}:
            raise ValueError("STORAGE_BACKEND must be either local or s3.")
        if self.rate_limit_backend not in {"memory", "redis"}:
            raise ValueError("RATE_LIMIT_BACKEND must be either memory or redis.")
        if self.processing_max_attempts < 1 or self.processing_lease_minutes < 1:
            raise ValueError("Processing attempts and lease duration must be positive.")
        if bool(self.s3_access_key_id) != bool(self.s3_secret_access_key):
            raise ValueError("Configure both S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY, or neither.")
        if self.environment.lower() != "development":
            if self.jwt_secret_key == "dev-only-change-this-secret":
                raise ValueError("JWT_SECRET_KEY must be changed outside development.")
            if not self.refresh_cookie_secure:
                raise ValueError("REFRESH_COOKIE_SECURE must be true outside development.")
        if self.job_queue_backend == "celery" and not self.celery_broker_url:
            raise ValueError("CELERY_BROKER_URL is required when JOB_QUEUE_BACKEND=celery.")
        if self.storage_backend == "s3" and not self.s3_bucket:
            raise ValueError("S3_BUCKET is required when STORAGE_BACKEND=s3.")
        if self.rate_limit_backend == "redis" and not self.rate_limit_redis_url:
            raise ValueError("RATE_LIMIT_REDIS_URL is required when RATE_LIMIT_BACKEND=redis.")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
