from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.core.errors import install_exception_handlers
from app.core.logging import configure_logging
from app.middleware.request_id import RequestIDMiddleware
from app.middleware.security import InMemoryRateLimitMiddleware, SecurityHeadersMiddleware


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_logging()
    yield


settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    InMemoryRateLimitMiddleware,
    window_seconds=settings.rate_limit_window_seconds,
    limits={
        "auth": settings.rate_limit_auth_requests,
        "upload": settings.rate_limit_upload_requests,
        "chat": settings.rate_limit_chat_requests,
    },
    redis_url=(settings.rate_limit_redis_url if settings.rate_limit_backend == "redis" else None),
    key_prefix=settings.rate_limit_key_prefix,
    trusted_proxy_cidrs=settings.trusted_proxy_cidrs,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID", "Idempotency-Key"],
)
app.include_router(api_router, prefix=settings.api_v1_prefix)
install_exception_handlers(app)
