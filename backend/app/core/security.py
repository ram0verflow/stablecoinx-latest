from datetime import datetime, timedelta, timezone
from typing import Optional, Any

from jose import JWTError, jwt
from passlib.context import CryptContext
import redis

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
RATE_LIMIT_REQUESTS_PER_MINUTE = 100


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
    data: dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta
        if expires_delta
        else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def verify_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        exp = payload.get("exp")
        if exp is None:
            return None
        now_ts = int(datetime.now(timezone.utc).timestamp())
        if int(exp) < now_ts:
            return None
        return payload
    except JWTError:
        return None


# Build the Redis client once at import time — no blocking ping.
# The client is lazy: it only opens a socket on the first actual command.
# If Redis is unavailable, the first command raises an exception which
# the caller catches and handles gracefully.
try:
    _redis_client_cache: Optional[redis.Redis] = redis.Redis.from_url(
        settings.REDIS_URL,
        decode_responses=True,
        socket_connect_timeout=0.5,
        socket_timeout=0.5,
    )
except Exception:
    _redis_client_cache = None


def get_redis_client() -> Optional[redis.Redis]:
    """Return the module-level Redis client (no blocking I/O)."""
    return _redis_client_cache


def redact_wallet(value: str) -> str:
    if not value or len(value) < 12:
        return "REDACTED"
    return f"{value[:6]}...{value[-4:]}"
