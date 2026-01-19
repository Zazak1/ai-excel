from __future__ import annotations

import asyncio
import os
import shutil
import tempfile
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from ...core.config import get_settings
from ...db.session import get_db
from ...queue.rq_queue import get_queue
from ...schemas.analytics import AnalyticsJobCreateResponse, AnalyticsJobInfo, AnalyticsJobListResponse
from ...services.analytics_job_runner import run_analytics_job
from ...services.analytics_paths import artifact_paths, job_dir
from ...store.analytics_jobs_db import (
    create_analytics_job as db_create_job,
    delete_analytics_job as db_delete_job,
    get_analytics_job as db_get_job,
    list_analytics_jobs as db_list_jobs,
    parse_summary,
)


router = APIRouter()


def _allowed_ext(filename: str) -> str | None:
    suffix = Path(filename).suffix.lower()
    if suffix in {".csv", ".txt", ".xlsx"}:
        return suffix.lstrip(".")
    return None


@router.post("/jobs", response_model=AnalyticsJobCreateResponse)
async def create_analytics_job(prompt: str = Form(...), file: UploadFile = File(...), db=Depends(get_db)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")
    ext = _allowed_ext(file.filename)
    if not ext:
        raise HTTPException(status_code=400, detail="Only .csv/.txt/.xlsx supported")

    job_id = uuid4().hex
    work_dir = job_dir(job_id)
    work_dir.mkdir(parents=True, exist_ok=True)

    input_path, _, _, _ = artifact_paths(job_id, input_ext=ext)
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        max_bytes = get_settings().max_upload_mb * 1024 * 1024
        written = 0
        with tmp_path.open("wb") as f:
            while True:
                chunk = file.file.read(1024 * 1024)
                if not chunk:
                    break
                written += len(chunk)
                if written > max_bytes:
                    raise HTTPException(status_code=413, detail="File too large")
                f.write(chunk)
        tmp_path.replace(input_path)
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except Exception:
            pass

    job = db_create_job(
        db,
        job_id=job_id,
        status="queued",
        input_filename=file.filename,
        prompt=prompt,
        work_dir=str(work_dir),
    )

    try:
        queue = get_queue()
        if queue:
            queue.enqueue("app.workers.tasks.process_analytics_job", job_id)
        else:
            asyncio.create_task(run_analytics_job(job_id))
    except Exception:
        asyncio.create_task(run_analytics_job(job_id))

    return AnalyticsJobCreateResponse(job_id=job_id, status=job.status)


@router.get("/jobs", response_model=AnalyticsJobListResponse)
async def list_analytics_jobs(db=Depends(get_db)):
    jobs = db_list_jobs(db)
    return AnalyticsJobListResponse(
        jobs=[
            AnalyticsJobInfo(
                job_id=j.job_id,
                status=j.status,
                created_at=j.created_at,
                started_at=j.started_at,
                finished_at=j.finished_at,
                stage=j.stage,
                progress=j.progress,
                detail=j.detail,
                input_filename=j.input_filename,
                prompt=j.prompt,
                llm_model=j.llm_model,
                summary=parse_summary(j),
                error=j.error,
            )
            for j in jobs
        ]
    )


@router.get("/jobs/{job_id}", response_model=AnalyticsJobInfo)
async def get_analytics_job(job_id: str, db=Depends(get_db)):
    job = db_get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return AnalyticsJobInfo(
        job_id=job.job_id,
        status=job.status,
        created_at=job.created_at,
        started_at=job.started_at,
        finished_at=job.finished_at,
        stage=job.stage,
        progress=job.progress,
        detail=job.detail,
        input_filename=job.input_filename,
        prompt=job.prompt,
        llm_model=job.llm_model,
        summary=parse_summary(job),
        error=job.error,
    )


@router.get("/jobs/{job_id}/artifacts")
async def list_artifacts(job_id: str, db=Depends(get_db)):
    job = db_get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    ext = _allowed_ext(job.input_filename) or "csv"
    input_path, code_path, output_dir, summary_path = artifact_paths(job_id, input_ext=ext)

    artifacts: list[dict] = []
    for name, path in [
        (f"input.{ext}", input_path),
        ("generated.py", code_path),
        ("summary.json", summary_path),
    ]:
        artifacts.append(
            {"name": name, "exists": path.exists(), "size_bytes": path.stat().st_size if path.exists() else None}
        )

    if output_dir.exists():
        for p in sorted(output_dir.glob("*.png")):
            artifacts.append({"name": p.name, "exists": True, "size_bytes": p.stat().st_size})

    return {"job_id": job_id, "artifacts": artifacts}


@router.get("/jobs/{job_id}/artifacts/{name}")
async def download_artifact(job_id: str, name: str, db=Depends(get_db)):
    job = db_get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    ext = _allowed_ext(job.input_filename) or "csv"
    input_path, code_path, output_dir, summary_path = artifact_paths(job_id, input_ext=ext)

    if name == "generated.py":
        path = code_path
        media = "text/plain"
    elif name == "summary.json":
        path = summary_path
        media = "application/json"
    elif name.startswith("input."):
        path = input_path
        media = "application/octet-stream"
    else:
        # Only allow png files in outputs
        safe = os.path.basename(name)
        if not safe.lower().endswith(".png"):
            raise HTTPException(status_code=400, detail="Only .png artifacts supported here")
        path = (output_dir / safe).resolve()
        if output_dir.resolve() not in path.parents:
            raise HTTPException(status_code=400, detail="Invalid artifact name")
        media = "image/png"

    if not path.exists():
        raise HTTPException(status_code=404, detail="Artifact not found")

    return FileResponse(path=str(path), media_type=media, filename=path.name)


@router.delete("/jobs/{job_id}")
async def delete_analytics_job(job_id: str, db=Depends(get_db)):
    job = db_get_job(db, job_id)
    if not job:
        return {"deleted": False}
    shutil.rmtree(job_dir(job_id), ignore_errors=True)
    db_delete_job(db, job_id)
    return {"deleted": True}
