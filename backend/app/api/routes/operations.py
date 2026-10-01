import secrets

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import PlainTextResponse

from app.core.config import get_settings
from app.core.metrics import metrics

router = APIRouter()


@router.get("/metrics", include_in_schema=False, response_class=PlainTextResponse)
async def metrics_endpoint(x_metrics_token: str | None = Header(default=None)) -> PlainTextResponse:
    """Expose process metrics only when a dedicated operations token is configured."""
    configured_token = get_settings().metrics_token
    if not configured_token or not x_metrics_token:
        raise HTTPException(status_code=404, detail="Not found.")
    if not secrets.compare_digest(configured_token, x_metrics_token):
        raise HTTPException(status_code=404, detail="Not found.")
    return PlainTextResponse(metrics.render_prometheus())
