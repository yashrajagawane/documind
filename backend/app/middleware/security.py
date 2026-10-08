from collections import defaultdict, deque
from ipaddress import IPv4Address, IPv6Address, ip_address, ip_network
from time import monotonic
from uuid import uuid4

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
    """Use an atomic Redis window when configured; otherwise limit this process."""

    def __init__(
        self,
        app,
        window_seconds: int,
        limits: dict[str, int],
        redis_url: str | None = None,
        key_prefix: str = "documind:rate-limit",
        trusted_proxy_cidrs: list[str] | None = None,
    ) -> None:
        super().__init__(app)
        self.window_seconds = window_seconds
        self.limits = limits
        self.events: defaultdict[tuple[str, str], deque[float]] = defaultdict(deque)
        self.redis = None
        if redis_url:
            from redis.asyncio import Redis

            self.redis = Redis.from_url(redis_url, decode_responses=False)
        self.key_prefix = key_prefix
        self.trusted_proxy_cidrs = tuple(ip_network(value) for value in trusted_proxy_cidrs or [])

    async def dispatch(self, request: Request, call_next):  # type: ignore[no-untyped-def]
        bucket = self._bucket(request)
        if bucket is None:
            return await call_next(request)
        now = monotonic()
        key = (self._client_ip(request), bucket)
        if self.redis is not None:
            try:
                allowed, retry_after_ms = await self.redis.eval(
                    _SLIDING_WINDOW_SCRIPT,
                    1,
                    f"{self.key_prefix}:{bucket}:{key[0]}",
                    self.window_seconds * 1000,
                    self.limits[bucket],
                    str(uuid4()),
                )
            except Exception:
                metrics.increment("documind_rate_limit_backend_errors_total")
                return JSONResponse(
                    status_code=503,
                    content={
                        "success": False,
                        "error": {
                            "code": "RATE_LIMIT_UNAVAILABLE",
                            "message": "Request protection is temporarily unavailable.",
                            "request_id": getattr(request.state, "request_id", None),
                        },
                    },
                    headers={"Retry-After": "1"},
                )
            if not allowed:
                metrics.increment("documind_rate_limit_rejections_total", bucket=bucket)
                return self._rejected_response(request, retry_after_ms)
            return await call_next(request)
        events = self.events[key]
        while events and events[0] <= now - self.window_seconds:
            events.popleft()
        if len(events) >= self.limits[bucket]:
            metrics.increment("documind_rate_limit_rejections_total", bucket=bucket)
            return self._rejected_response(request, self.window_seconds * 1000)
        events.append(now)
        return await call_next(request)

    @staticmethod
    def _rejected_response(request: Request, retry_after_ms: int) -> JSONResponse:
        retry_after = max(1, (retry_after_ms + 999) // 1000)
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
            headers={"Retry-After": str(retry_after)},
        )

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

    def _client_ip(self, request: Request) -> str:
        remote = request.client.host if request.client else "unknown"
        try:
            current = ip_address(remote)
        except ValueError:
            return remote
        if not self.trusted_proxy_cidrs or not self._is_trusted(current):
            return str(current)
        forwarded = request.headers.get("x-forwarded-for", "")
        for hop in reversed([value.strip() for value in forwarded.split(",") if value.strip()]):
            if not self._is_trusted(current):
                break
            try:
                current = ip_address(hop)
            except ValueError:
                break
        return str(current)

    def _is_trusted(self, address: IPv4Address | IPv6Address) -> bool:
        return any(
            address.version == network.version and address in network
            for network in self.trusted_proxy_cidrs
        )


_SLIDING_WINDOW_SCRIPT = """
local window = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local member = ARGV[3]
local time = redis.call('TIME')
local now = (tonumber(time[1]) * 1000) + math.floor(tonumber(time[2]) / 1000)
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - window)
local count = redis.call('ZCARD', KEYS[1])
if count >= limit then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  return {0, math.max(1, tonumber(oldest[2]) + window - now)}
end
redis.call('ZADD', KEYS[1], now, member)
redis.call('PEXPIRE', KEYS[1], window)
return {1, 0}
"""
