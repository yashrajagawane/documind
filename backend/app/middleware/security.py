from collections import defaultdict, deque
from time import monotonic

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.metrics import metrics


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):  # type: ignore[no-untyped-def]
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response


class InMemoryRateLimitMiddleware(BaseHTTPMiddleware):
    """Single-instance guardrail; use a shared limiter before horizontal scaling."""

    def __init__(self, app, window_seconds: int, limits: dict[str, int]) -> None:
        super().__init__(app)
        self.window_seconds = window_seconds
        self.limits = limits
        self.events: defaultdict[tuple[str, str], deque[float]] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next):  # type: ignore[no-untyped-def]
        bucket = self._bucket(request)
        if bucket is None:
            return await call_next(request)
        now = monotonic()
        key = (request.client.host if request.client else "unknown", bucket)
        events = self.events[key]
        while events and events[0] <= now - self.window_seconds:
            events.popleft()
        if len(events) >= self.limits[bucket]:
            metrics.increment("documind_rate_limit_rejections_total", bucket=bucket)
            return JSONResponse(
                status_code=429,
                content={
                    "success": False,
                    "error": {
                        "code": "RATE_LIMITED",
                        "message": "Too many requests. Please try again later.",
                        "request_id": getattr(request.state, "request_id", None),
                    },
                },
                headers={"Retry-After": str(self.window_seconds)},
            )
        events.append(now)
        return await call_next(request)

    @staticmethod
    def _bucket(request: Request) -> str | None:
        path = request.url.path
        if request.method == "POST" and path.endswith(
            ("/auth/login", "/auth/register", "/auth/refresh")
        ):
            return "auth"
        if request.method == "POST" and path.endswith("/documents"):
            return "upload"
        if request.method == "POST" and path.endswith("/chat"):
            return "chat"
        return None
