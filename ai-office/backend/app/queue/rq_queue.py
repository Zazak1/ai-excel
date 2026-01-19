from __future__ import annotations

from typing import Optional

from redis import Redis
from rq import Queue

from ..core.config import get_settings


def get_redis() -> Optional[Redis]:
    settings = get_settings()
    if not settings.redis_url:
        return None
    return Redis.from_url(settings.redis_url)


def get_queue(name: str = "default") -> Optional[Queue]:
    conn = get_redis()
    if not conn:
        return None
    return Queue(name, connection=conn)
