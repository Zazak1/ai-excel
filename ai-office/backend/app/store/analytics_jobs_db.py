from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db.models import AnalyticsJobModel


def create_analytics_job(
    db: Session,
    *,
    job_id: str,
    status: str,
    input_filename: str,
    prompt: str,
    work_dir: str,
) -> AnalyticsJobModel:
    now = datetime.utcnow()
    job = AnalyticsJobModel(
        job_id=job_id,
        status=status,
        created_at=now,
        started_at=None,
        finished_at=None,
        input_filename=input_filename,
        prompt=prompt,
        llm_model=None,
        summary_json=None,
        error=None,
        stage="queued",
        progress=0.0,
        detail=None,
        work_dir=work_dir,
    )
    db.add(job)
    db.commit()
    return job


def get_analytics_job(db: Session, job_id: str) -> AnalyticsJobModel | None:
    return db.get(AnalyticsJobModel, job_id)


def list_analytics_jobs(db: Session, *, limit: int = 100) -> list[AnalyticsJobModel]:
    stmt = select(AnalyticsJobModel).order_by(AnalyticsJobModel.created_at.desc()).limit(limit)
    return list(db.execute(stmt).scalars().all())


def update_analytics_job(
    db: Session,
    job_id: str,
    *,
    status: str | None = None,
    started_at: datetime | None = None,
    finished_at: datetime | None = None,
    llm_model: str | None = None,
    summary: dict[str, Any] | None = None,
    error: str | None = None,
    stage: str | None = None,
    progress: float | None = None,
    detail: str | None = None,
) -> AnalyticsJobModel:
    job = db.get(AnalyticsJobModel, job_id)
    if not job:
        raise KeyError(job_id)

    if status is not None:
        job.status = status
    if started_at is not None:
        job.started_at = started_at
    if finished_at is not None:
        job.finished_at = finished_at
    if llm_model is not None:
        job.llm_model = llm_model
    if summary is not None:
        job.summary_json = json.dumps(summary, ensure_ascii=False)
    if error is not None:
        job.error = error
    if stage is not None:
        job.stage = stage
    if progress is not None:
        job.progress = progress
    if detail is not None:
        if len(detail) > 8000:
            detail = detail[-8000:]
        job.detail = detail

    db.add(job)
    db.commit()
    return job


def parse_summary(job: AnalyticsJobModel) -> dict[str, Any] | None:
    if not job.summary_json:
        return None
    try:
        return json.loads(job.summary_json)
    except Exception:
        return {"raw": job.summary_json}


def delete_analytics_job(db: Session, job_id: str) -> None:
    job = db.get(AnalyticsJobModel, job_id)
    if not job:
        return
    db.delete(job)
    db.commit()
