from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db.models import ExcelJobModel


def create_excel_job(
    db: Session,
    *,
    job_id: str,
    status: str,
    input_filename: str,
    prompt: str,
    work_dir: str,
) -> ExcelJobModel:
    now = datetime.utcnow()
    job = ExcelJobModel(
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


def get_excel_job(db: Session, job_id: str) -> Optional[ExcelJobModel]:
    return db.get(ExcelJobModel, job_id)


def list_excel_jobs(db: Session, *, limit: int = 100) -> list[ExcelJobModel]:
    stmt = select(ExcelJobModel).order_by(ExcelJobModel.created_at.desc()).limit(limit)
    return list(db.execute(stmt).scalars().all())


def update_excel_job(
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
) -> ExcelJobModel:
    job = db.get(ExcelJobModel, job_id)
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


def parse_summary(job: ExcelJobModel) -> Optional[dict[str, Any]]:
    if not job.summary_json:
        return None
    try:
        return json.loads(job.summary_json)
    except Exception:
        return {"raw": job.summary_json}


def delete_excel_job(db: Session, job_id: str) -> None:
    job = db.get(ExcelJobModel, job_id)
    if not job:
        return
    db.delete(job)
    db.commit()
