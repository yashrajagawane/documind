import pytest
from pydantic import ValidationError

from app.core.config import Settings


def production_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "environment": "production",
        "jwt_secret_key": "a-production-secret-that-is-longer-than-32-characters",
        "refresh_cookie_secure": True,
        "cors_origins": "https://app.example.com",
        "storage_backend": "s3",
        "s3_bucket": "documind-private-artifacts",
        "qdrant_api_key": "a-long-qdrant-service-api-key",
    }
    values.update(overrides)
    return Settings(**values)


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"jwt_secret_key": "short"}, "JWT_SECRET_KEY"),
        ({"refresh_cookie_secure": False}, "REFRESH_COOKIE_SECURE"),
        ({"cors_origins": "*"}, "CORS_ORIGINS"),
        ({"cors_origins": "http://app.example.com"}, "CORS_ORIGINS"),
        ({"storage_backend": "local"}, "STORAGE_BACKEND"),
        ({"qdrant_api_key": None}, "QDRANT_API_KEY"),
    ],
)
def test_production_settings_reject_unsafe_deployment_configuration(
    overrides: dict[str, object], message: str
) -> None:
    with pytest.raises(ValidationError, match=message):
        production_settings(**overrides)


def test_production_settings_accept_a_private_https_configuration() -> None:
    settings = production_settings()
    assert settings.environment == "production"
    assert settings.cors_origins == ["https://app.example.com"]
