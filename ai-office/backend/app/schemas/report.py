from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


ReportJobStatus = Literal["queued", "running", "succeeded", "failed"]


class ReportJobCreateResponse(BaseModel):
    job_id: str
    status: ReportJobStatus


class ReportJobInfo(BaseModel):
    job_id: str
    status: ReportJobStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    stage: Optional[str] = None
    progress: Optional[float] = None
    detail: Optional[str] = None

    title: str
    template: str
    notes: Optional[str] = None
    prompt: Optional[str] = None
    inputs: list[dict[str, Any]] = Field(default_factory=list)

    llm_model: Optional[str] = None
    summary: Optional[dict[str, Any]] = None
    error: Optional[str] = None


class ReportJobListResponse(BaseModel):
    jobs: list[ReportJobInfo] = Field(default_factory=list)

