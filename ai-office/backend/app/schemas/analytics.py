from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


AnalyticsJobStatus = Literal["queued", "running", "succeeded", "failed"]


class AnalyticsJobCreateResponse(BaseModel):
    job_id: str
    status: AnalyticsJobStatus


class AnalyticsJobInfo(BaseModel):
    job_id: str
    status: AnalyticsJobStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    stage: Optional[str] = None
    progress: Optional[float] = None
    detail: Optional[str] = None

    input_filename: str
    prompt: str

    llm_model: Optional[str] = None
    summary: Optional[dict[str, Any]] = None
    error: Optional[str] = None


class AnalyticsJobListResponse(BaseModel):
    jobs: list[AnalyticsJobInfo] = Field(default_factory=list)
