from __future__ import annotations

import os

from redis import Redis
from rq import Connection, Worker

from ..core.config import get_settings


def main() -> int:
    settings = get_settings()
    if not settings.redis_url:
        raise RuntimeError("REDIS_URL is not set")

    redis_conn = Redis.from_url(settings.redis_url)
    queues = os.getenv("RQ_QUEUES", "default").split(",")
    queues = [q.strip() for q in queues if q.strip()]

    with Connection(redis_conn):
        worker = Worker(queues)
        worker.work(with_scheduler=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

