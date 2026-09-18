from __future__ import annotations

import logging
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.core.security import verify_token

logger = logging.getLogger("request_logger")


class RequestLoggerMiddleware(BaseHTTPMiddleware):
    """Logs method, path, status, latency, and user id without request-body PII."""

    async def dispatch(self, request: Request, call_next):
        started = time.perf_counter()
        user_id = "anonymous"

        auth_header = request.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            token = auth_header.split(" ", 1)[1].strip()
            payload = verify_token(token)
            if payload and payload.get("sub"):
                user_id = str(payload["sub"])

        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - started) * 1000.0

        logger.info(
            "request method=%s path=%s status=%s latency_ms=%.2f user_id=%s",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
            user_id,
        )
        return response
