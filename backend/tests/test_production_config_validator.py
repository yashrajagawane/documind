import runpy
from pathlib import Path

import pytest

MODULE = runpy.run_path(
    str(Path(__file__).resolve().parents[2] / "scripts" / "validate_production_config.py")
)
validate = MODULE["validate"]


def valid_values() -> dict[str, str]:
    return {
        "ENVIRONMENT": "production",
        "CADDY_DOMAIN": "app.documind.test",
        "CADDY_EMAIL": "operations@documind.test",
        "CORS_ORIGINS": "https://app.documind.test",
        "NEXT_PUBLIC_API_BASE_URL": "https://app.documind.test/api/v1",
        "POSTGRES_PASSWORD": "database-password-not-a-placeholder",
        "DATABASE_URL": "postgresql+asyncpg://documind:database-password-not-a-placeholder@postgres:5432/documind",
        "CELERY_BROKER_URL": "redis://redis:6379/0",
        "RATE_LIMIT_REDIS_URL": "redis://redis:6379/1",
        "STORAGE_BACKEND": "s3",
        "S3_BUCKET": "documind-private-artifacts",
        "S3_ACCESS_KEY_ID": "storage-access-key",
        "S3_SECRET_ACCESS_KEY": "storage-secret-key",
        "QDRANT_URL": "http://qdrant:6333",
        "QDRANT_API_KEY": "qdrant-service-api-key",
        "GEMINI_API_KEY": "gemini-api-key",
        "JWT_SECRET_KEY": "a-production-secret-that-is-longer-than-32-characters",
        "REFRESH_COOKIE_SECURE": "true",
        "METRICS_TOKEN": "metrics-token-value",
    }


def test_validator_accepts_a_complete_private_production_configuration() -> None:
    validate(valid_values())


@pytest.mark.parametrize(
    ("name", "value", "message"),
    [
        ("CADDY_DOMAIN", "app.example.com", "placeholder"),
        ("STORAGE_BACKEND", "local", "STORAGE_BACKEND"),
        ("QDRANT_URL", "https://qdrant.example.net", "QDRANT_URL"),
    ],
)
def test_validator_rejects_unsafe_deployment_values(
    name: str, value: str, message: str
) -> None:
    values = valid_values()
    values[name] = value
    with pytest.raises(ValueError, match=message):
        validate(values)
