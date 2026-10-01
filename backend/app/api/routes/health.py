from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.schemas.health import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse, summary="Liveness check")
async def health_check(response: Response) -> HealthResponse:
    """Return a non-secret, dependency-free liveness response."""
    response.status_code = status.HTTP_200_OK
    return HealthResponse(status="healthy", services={"api": "healthy"})


@router.get("/ready", response_model=HealthResponse, summary="Dependency readiness check")
async def readiness_check(
    response: Response, db: AsyncSession = Depends(get_db_session)
) -> HealthResponse:
    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return HealthResponse(
            status="unready", services={"api": "healthy", "database": "unavailable"}
        )
    return HealthResponse(status="ready", services={"api": "healthy", "database": "healthy"})
