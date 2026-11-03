"""Fail fast when a production environment file is incomplete or unsafe."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.core.config import Settings  # noqa: E402


REQUIRED_VALUES = (
    "CADDY_DOMAIN",
    "CADDY_EMAIL",
    "POSTGRES_PASSWORD",
    "DATABASE_URL",
    "CELERY_BROKER_URL",
    "RATE_LIMIT_REDIS_URL",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "QDRANT_API_KEY",
    "GEMINI_API_KEY",
    "JWT_SECRET_KEY",
    "METRICS_TOKEN",
)
PLACEHOLDER_MARKERS = ("replace-with", "example.com", "change-me", "your_")


def read_env_file(path: Path) -> dict[str, str]:
    """Parse the simple KEY=VALUE format used by DocuMind environment files."""
    values: dict[str, str] = {}
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if "=" not in stripped:
            raise ValueError(f"{path}:{number}: expected KEY=VALUE.")
        key, value = stripped.split("=", maxsplit=1)
        if not key or not key.replace("_", "").isalnum() or key.upper() != key:
            raise ValueError(f"{path}:{number}: invalid environment variable name.")
        values[key] = value
    return values


def validate(values: dict[str, str]) -> None:
    missing = [name for name in REQUIRED_VALUES if not values.get(name)]
    placeholders = [
        name
        for name, value in values.items()
        if any(marker in value.lower() for marker in PLACEHOLDER_MARKERS)
    ]
    if values.get("ENVIRONMENT", "").lower() != "production":
        raise ValueError("ENVIRONMENT must be production.")
    if missing:
        raise ValueError(f"Missing required values: {', '.join(missing)}.")
    if placeholders:
        raise ValueError(f"Replace placeholder values: {', '.join(sorted(placeholders))}.")
    if values.get("STORAGE_BACKEND") != "s3":
        raise ValueError("STORAGE_BACKEND must be s3 for production.")
    if values.get("JOB_QUEUE_BACKEND") != "celery":
        raise ValueError("JOB_QUEUE_BACKEND must be celery for production.")
    if values.get("RATE_LIMIT_BACKEND") != "redis":
        raise ValueError("RATE_LIMIT_BACKEND must be redis for production.")
    if values.get("REFRESH_COOKIE_SECURE", "").lower() != "true":
        raise ValueError("REFRESH_COOKIE_SECURE must be true for production.")
    if values.get("POSTGRES_USER") != "documind" or values.get("POSTGRES_DB") != "documind":
        raise ValueError("POSTGRES_USER and POSTGRES_DB must match the Compose service defaults.")
    if values.get("QDRANT_URL") != "http://qdrant:6333":
        raise ValueError("QDRANT_URL must target the private Compose service.")
    if values.get("CADDY_DOMAIN", "").startswith(("http://", "https://")):
        raise ValueError("CADDY_DOMAIN must be a hostname without a URL scheme.")
    if values.get("NEXT_PUBLIC_API_BASE_URL") != f"https://{values['CADDY_DOMAIN']}/api/v1":
        raise ValueError("NEXT_PUBLIC_API_BASE_URL must use the public HTTPS domain.")
    if values.get("CORS_ORIGINS") != f"https://{values['CADDY_DOMAIN']}":
        raise ValueError("CORS_ORIGINS must contain only the public HTTPS domain.")

    # Convert all-uppercase environment names to Settings field names and apply
    # the application's production validation in addition to deployment checks.
    Settings(**{name.lower(): value for name, value in values.items()})


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, default=ROOT / ".env.production")
    args = parser.parse_args()
    try:
        if not args.env_file.is_file():
            raise ValueError(f"Environment file does not exist: {args.env_file}")
        validate(read_env_file(args.env_file))
    except (OSError, ValueError) as error:
        print(f"FAIL {error}", file=sys.stderr)
        return 1
    print(f"PASS production configuration: {args.env_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
