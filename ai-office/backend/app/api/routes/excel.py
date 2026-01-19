from __future__ import annotations

import asyncio
import shutil
import tempfile
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.responses import PlainTextResponse

from ...core.config import get_settings
from ...db.session import get_db
from ...queue.rq_queue import get_queue
from ...schemas.excel import ExcelJobCreateResponse, ExcelJobInfo, ExcelJobListResponse
from ...services.excel_job_runner import run_excel_job
from ...services.excel_paths import artifact_paths, job_dir
from ...store.excel_jobs_db import (
    create_excel_job as db_create_excel_job,
    delete_excel_job as db_delete_excel_job,
    get_excel_job as db_get_excel_job,
    list_excel_jobs as db_list_excel_jobs,
    parse_summary,
)


router = APIRouter()


@router.post("/jobs", response_model=ExcelJobCreateResponse)
async def create_excel_job(
    prompt: str = Form(...),
    file: UploadFile = File(...),
    db=Depends(get_db),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")
    if not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Only .xlsx supported for now")

    job_id = uuid4().hex
    work_dir = job_dir(job_id)
    work_dir.mkdir(parents=True, exist_ok=True)

    input_path, _, _, _ = artifact_paths(job_id)
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

    job = db_create_excel_job(
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
            queue.enqueue("app.workers.tasks.process_excel_job", job_id)
        else:
            asyncio.create_task(run_excel_job(job_id))
    except Exception:
        asyncio.create_task(run_excel_job(job_id))

    return ExcelJobCreateResponse(job_id=job_id, status=job.status)


@router.get("/jobs", response_model=ExcelJobListResponse)
async def list_excel_jobs(db=Depends(get_db)):
    jobs = db_list_excel_jobs(db)
    return ExcelJobListResponse(
        jobs=[
            ExcelJobInfo(
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


@router.get("/jobs/{job_id}", response_model=ExcelJobInfo)
async def get_excel_job(job_id: str, db=Depends(get_db)):
    job = db_get_excel_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return ExcelJobInfo(
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


@router.get("/jobs/{job_id}/download")
async def download_excel_output(job_id: str, db=Depends(get_db)):
    job = db_get_excel_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != "succeeded":
        raise HTTPException(status_code=400, detail=f"Job not succeeded (status={job.status})")
    _, _, output_path, _ = artifact_paths(job_id)
    if not output_path.exists():
        raise HTTPException(status_code=404, detail="Output not found")
    return FileResponse(
        path=str(output_path),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=f"processed-{job.input_filename.rsplit('.', 1)[0]}.xlsx",
    )


@router.get("/jobs/{job_id}/summary")
async def get_excel_job_summary(job_id: str, db=Depends(get_db)):
    job = db_get_excel_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"job_id": job_id, "summary": parse_summary(job), "error": job.error, "status": job.status}


@router.get("/jobs/{job_id}/code", response_class=PlainTextResponse)
async def get_excel_job_code(job_id: str, db=Depends(get_db)):
    job = db_get_excel_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    _, code_path, _, _ = artifact_paths(job_id)
    if not code_path.exists():
        raise HTTPException(status_code=404, detail="Code not found")
    return code_path.read_text(encoding="utf-8")


@router.get("/jobs/{job_id}/artifacts")
async def get_excel_job_artifacts(job_id: str, db=Depends(get_db)):
    job = db_get_excel_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    input_path, code_path, output_path, summary_path = artifact_paths(job_id)
    paths = [
        ("input.xlsx", input_path),
        ("generated.py", code_path),
        ("output.xlsx", output_path),
        ("summary.json", summary_path),
    ]
    return {
        "job_id": job_id,
        "artifacts": [
            {
                "name": name,
                "exists": path.exists(),
                "size_bytes": path.stat().st_size if path.exists() else None,
            }
            for name, path in paths
        ],
    }


@router.delete("/jobs/{job_id}")
async def delete_excel_job(job_id: str, db=Depends(get_db)):
    job = db_get_excel_job(db, job_id)
    if not job:
        return {"deleted": False}
    # remove files
    try:
        shutil.rmtree(job_dir(job_id), ignore_errors=True)
    except Exception:
        pass
    db_delete_excel_job(db, job_id)
    return {"deleted": True}
