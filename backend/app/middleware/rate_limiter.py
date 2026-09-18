from __future__ import annotations

import asyncio
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.security import RATE_LIMIT_REQUESTS_PER_MINUTE, get_redis_client


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """Simple per-IP rate limiter backed by Redis (async-safe)."""

    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)

        redis_client = get_redis_client()
        if redis_client:
            try:
                ip = request.client.host if request.client else "unknown"
                key = f"rate_limit:{ip}"

                # Run sync Redis calls in a thread to avoid blocking the event loop
                def _check_rate():
                    count = redis_client.incr(key)
                    if count == 1:
                        redis_client.expire(key, 60)
                    return count

                count = await asyncio.to_thread(_check_rate)

                if count > RATE_LIMIT_REQUESTS_PER_MINUTE:
                    ttl = await asyncio.to_thread(redis_client.ttl, key)
                    return JSONResponse(
                        status_code=429,
                        content={
                            "detail": (
                                f"Rate limit exceeded: "
                                f"max {RATE_LIMIT_REQUESTS_PER_MINUTE} requests/minute."
                            )
                        },
                        headers={"Retry-After": str(max(int(ttl), 1))},
                    )
            except Exception as e:
                # Redis unavailable — allow request through
                pass

        return await call_next(request)
