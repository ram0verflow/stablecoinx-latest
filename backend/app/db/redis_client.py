import logging
from typing import Optional

import redis
from app.core.config import settings

logger = logging.getLogger(__name__)

_redis_client: Optional[redis.Redis] = None


def get_redis() -> Optional[redis.Redis]:
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = redis.Redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            _redis_client.ping()
            logger.info("Redis connected successfully")
        except Exception as e:
            logger.warning(f"Redis unavailable: {e}. Caching disabled.")
            _redis_client = None
    return _redis_client


def close_redis() -> None:
    global _redis_client
    if _redis_client:
        try:
            _redis_client.close()
        except Exception:
            pass
        _redis_client = None
