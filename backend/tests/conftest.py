"""
Shared test fixtures for DocuMind backend tests.

Uses a function-scoped in-memory SQLite async engine so each test that
depends on the `client` fixture gets a fresh, isolated database without
needing a live PostgreSQL container.
"""

from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


import app.models.document  # noqa: F401 — registers Document table
import app.models.processing_job  # noqa: F401 — registers ProcessingJob table
import app.models.refresh_session  # noqa: F401 — registers RefreshSession table
import app.models.user  # noqa: F401 — registers User table
from app.db.base import Base
from app.db.session import get_db_session
from app.main import app
from app.middleware.security import InMemoryRateLimitMiddleware


@pytest.fixture(autouse=True)
def reset_rate_limits():
    InMemoryRateLimitMiddleware.reset_all()
    yield
    InMemoryRateLimitMiddleware.reset_all()


@pytest_asyncio.fixture()
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Fresh in-memory SQLite session for each test."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with factory() as session:
        yield session

    await engine.dispose()


@pytest.fixture()
def client(db_session: AsyncSession) -> TestClient:
    """FastAPI TestClient wired to the in-memory SQLite session."""

    async def override_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db_session] = override_db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.pop(get_db_session, None)
