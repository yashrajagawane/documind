from fastapi import APIRouter, Response, status

from app.schemas.health import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse, summary="Liveness check")
async def health_check(response: Response) -> HealthResponse:
    """Return a non-secret, dependency-free liveness response."""
    response.status_code = status.HTTP_200_OK
    return HealthResponse(status="healthy", services={"api": "healthy"})
