from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


ExcelJobStatus = Literal["queued", "running", "succeeded", "failed"]


class ExcelJobCreateResponse(BaseModel):
    job_id: str
    status: ExcelJobStatus


class ExcelJobInfo(BaseModel):
    job_id: str
    status: ExcelJobStatus
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


class ExcelJobListResponse(BaseModel):
    jobs: list[ExcelJobInfo] = Field(default_factory=list)
