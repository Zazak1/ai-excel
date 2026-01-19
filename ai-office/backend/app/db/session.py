from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from ..core.config import get_settings


def create_db_engine() -> Engine:
    settings = get_settings()
    url = settings.database_url
    if not url:
        # default: sqlite under DATA_DIR
        url = f"sqlite:///{(settings.data_dir / 'app.db').as_posix()}"

    connect_args = {}
    if url.startswith("sqlite:///"):
        connect_args = {"check_same_thread": False}

    return create_engine(url, connect_args=connect_args, pool_pre_ping=True)


engine = create_db_engine()
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
