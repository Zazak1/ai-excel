from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db.models import ReportJobModel


def create_report_job(
    db: Session,
    *,
    job_id: str,
    status: str,
    title: str,
    template: str,
    notes: Optional[str],
    prompt: Optional[str],
    input_manifest: list[dict[str, Any]],
    work_dir: str,
) -> ReportJobModel:
    now = datetime.utcnow()
    job = ReportJobModel(
        job_id=job_id,
        status=status,
        created_at=now,
        started_at=None,
        finished_at=None,
        title=title,
        template=template,
        notes=notes,
        prompt=prompt,
        input_manifest_json=json.dumps(input_manifest, ensure_ascii=False),
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


def get_report_job(db: Session, job_id: str) -> Optional[ReportJobModel]:
    return db.get(ReportJobModel, job_id)


def list_report_jobs(db: Session, *, limit: int = 100) -> list[ReportJobModel]:
    stmt = select(ReportJobModel).order_by(ReportJobModel.created_at.desc()).limit(limit)
    return list(db.execute(stmt).scalars().all())


def update_report_job(
    db: Session,
    job_id: str,
    *,
    status: Optional[str] = None,
    started_at: Optional[datetime] = None,
    finished_at: Optional[datetime] = None,
    llm_model: Optional[str] = None,
    summary: Optional[dict[str, Any]] = None,
    error: Optional[str] = None,
    stage: Optional[str] = None,
    progress: Optional[float] = None,
    detail: Optional[str] = None,
) -> ReportJobModel:
    job = db.get(ReportJobModel, job_id)
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


def parse_summary(job: ReportJobModel) -> Optional[dict[str, Any]]:
    if not job.summary_json:
        return None
    try:
        return json.loads(job.summary_json)
    except Exception:
        return {"raw": job.summary_json}


def parse_inputs(job: ReportJobModel) -> list[dict[str, Any]]:
    try:
        data = json.loads(job.input_manifest_json or "[]")
        if isinstance(data, list):
            return [x for x in data if isinstance(x, dict)]
    except Exception:
        pass
    return []


def delete_report_job(db: Session, job_id: str) -> None:
    job = db.get(ReportJobModel, job_id)
    if not job:
        return
    db.delete(job)
    db.commit()

