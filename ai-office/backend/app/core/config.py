from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Optional

from .dataclass_compat import frozen_dataclass

try:
    from dotenv import find_dotenv, load_dotenv
except Exception:  # pragma: no cover
    find_dotenv = None
    load_dotenv = None

if load_dotenv and find_dotenv:
    load_dotenv(find_dotenv(usecwd=True), override=False)


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@frozen_dataclass
class Settings:
    env: str
    cors_allow_origins: list[str]

    data_dir: Path
    database_url: Optional[str]
    redis_url: Optional[str]
    max_upload_mb: int

    deepseek_api_key: Optional[str]
    deepseek_base_url: str
    deepseek_model: str
    deepseek_temperature: float
    deepseek_timeout_seconds: float

    sandbox_timeout_seconds: float
    sandbox_max_output_mb: int


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    env = os.getenv("ENV", "development")
    cors_allow_origins = _split_csv(
        os.getenv("CORS_ALLOW_ORIGINS", "http://localhost:5173,http://localhost:3000")
    )

    data_dir = Path(os.getenv("DATA_DIR", "./data")).resolve()
    database_url = os.getenv("DATABASE_URL") or None
    redis_url = os.getenv("REDIS_URL") or None
    max_upload_mb = int(os.getenv("MAX_UPLOAD_MB", "50"))

    deepseek_api_key = os.getenv("DEEPSEEK_API_KEY") or None
    deepseek_base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1").rstrip("/")
    deepseek_model = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
    deepseek_temperature = float(os.getenv("DEEPSEEK_TEMPERATURE", "0"))
    deepseek_timeout_seconds = float(os.getenv("DEEPSEEK_TIMEOUT_SECONDS", "180"))

    sandbox_timeout_seconds = float(os.getenv("SANDBOX_TIMEOUT_SECONDS", "120"))
    sandbox_max_output_mb = int(os.getenv("SANDBOX_MAX_OUTPUT_MB", "50"))

    return Settings(
        env=env,
        cors_allow_origins=cors_allow_origins,
        data_dir=data_dir,
        database_url=database_url,
        redis_url=redis_url,
        max_upload_mb=max_upload_mb,
        deepseek_api_key=deepseek_api_key,
        deepseek_base_url=deepseek_base_url,
        deepseek_model=deepseek_model,
        deepseek_temperature=deepseek_temperature,
        deepseek_timeout_seconds=deepseek_timeout_seconds,
        sandbox_timeout_seconds=sandbox_timeout_seconds,
        sandbox_max_output_mb=sandbox_max_output_mb,
    )
