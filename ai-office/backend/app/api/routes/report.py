from __future__ import annotations

import asyncio
import os
import shutil
import tempfile
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, PlainTextResponse

from ...core.config import get_settings
from ...db.session import get_db
from ...queue.rq_queue import get_queue
from ...schemas.report import ReportJobCreateResponse, ReportJobInfo, ReportJobListResponse
from ...services.report_job_runner import run_report_job
from ...services.report_paths import artifact_paths, job_dir
from ...store.report_jobs_db import (
    create_report_job as db_create_job,
    delete_report_job as db_delete_job,
    get_report_job as db_get_job,
    list_report_jobs as db_list_jobs,
    parse_inputs,
    parse_summary,
)


router = APIRouter()


def _allowed_ext(filename: str) -> bool:
    suffix = Path(filename).suffix.lower()
    return suffix in {".csv", ".txt", ".md", ".xlsx"}


@router.post("/jobs", response_model=ReportJobCreateResponse)
async def create_report_job(
    title: str = Form(...),
    template: str = Form("weekly"),
    notes: str = Form(""),
    prompt: str = Form(""),
    files: list[UploadFile] = File(...),
    db=Depends(get_db),
):
    if not files:
        raise HTTPException(status_code=400, detail="Missing files")
    for f in files:
        if not f.filename:
            raise HTTPException(status_code=400, detail="Missing filename")
        if not _allowed_ext(f.filename):
            raise HTTPException(status_code=400, detail="Only .csv/.xlsx/.txt/.md supported")

    job_id = uuid4().hex
    work_dir = job_dir(job_id)
    inputs_dir, outputs_dir, _, _ = artifact_paths(job_id)
    inputs_dir.mkdir(parents=True, exist_ok=True)
    outputs_dir.mkdir(parents=True, exist_ok=True)

    input_manifest: list[dict] = []
    max_bytes = get_settings().max_upload_mb * 1024 * 1024

    for f in files:
        safe_name = os.path.basename(f.filename)
        dest = (inputs_dir / safe_name).resolve()
        if inputs_dir.resolve() not in dest.parents:
            raise HTTPException(status_code=400, detail="Invalid filename")

        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp_path = Path(tmp.name)
        try:
            written = 0
            with tmp_path.open("wb") as out:
                while True:
                    chunk = f.file.read(1024 * 1024)
                    if not chunk:
                        break
                    written += len(chunk)
                    if written > max_bytes:
                        raise HTTPException(status_code=413, detail="File too large")
                    out.write(chunk)
            tmp_path.replace(dest)
        finally:
            try:
                tmp_path.unlink(missing_ok=True)
            except Exception:
                pass

        input_manifest.append({"filename": safe_name, "size_bytes": dest.stat().st_size})

    job = db_create_job(
        db,
        job_id=job_id,
        status="queued",
        title=title,
        template=template,
        notes=notes or None,
        prompt=prompt or None,
        input_manifest=input_manifest,
        work_dir=str(work_dir),
    )

    try:
        queue = get_queue()
        if queue:
            queue.enqueue("app.workers.tasks.process_report_job", job_id)
        else:
            asyncio.create_task(run_report_job(job_id))
    except Exception:
        asyncio.create_task(run_report_job(job_id))

    return ReportJobCreateResponse(job_id=job_id, status=job.status)


@router.get("/jobs", response_model=ReportJobListResponse)
async def list_report_jobs(db=Depends(get_db)):
    jobs = db_list_jobs(db)
    return ReportJobListResponse(
        jobs=[
            ReportJobInfo(
                job_id=j.job_id,
                status=j.status,
                created_at=j.created_at,
                started_at=j.started_at,
                finished_at=j.finished_at,
                stage=j.stage,
                progress=j.progress,
                detail=j.detail,
                title=j.title,
                template=j.template,
                notes=j.notes,
                prompt=j.prompt,
                inputs=parse_inputs(j),
                llm_model=j.llm_model,
                summary=parse_summary(j),
                error=j.error,
            )
            for j in jobs
        ]
    )


@router.get("/jobs/{job_id}", response_model=ReportJobInfo)
async def get_report_job(job_id: str, db=Depends(get_db)):
    job = db_get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return ReportJobInfo(
        job_id=job.job_id,
        status=job.status,
        created_at=job.created_at,
        started_at=job.started_at,
        finished_at=job.finished_at,
        stage=job.stage,
        progress=job.progress,
        detail=job.detail,
        title=job.title,
        template=job.template,
        notes=job.notes,
        prompt=job.prompt,
        inputs=parse_inputs(job),
        llm_model=job.llm_model,
        summary=parse_summary(job),
        error=job.error,
    )


@router.get("/jobs/{job_id}/artifacts")
async def list_report_artifacts(job_id: str, db=Depends(get_db)):
    job = db_get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    inputs_dir, outputs_dir, analysis_path, report_path = artifact_paths(job_id)

    artifacts: list[dict] = []
    if inputs_dir.exists():
        for p in sorted(inputs_dir.glob("*")):
            if p.is_file():
                artifacts.append({"name": f"inputs/{p.name}", "exists": True, "size_bytes": p.stat().st_size})

    for name, path in [
        ("analysis.json", analysis_path),
        ("report.md", report_path),
    ]:
        artifacts.append({"name": name, "exists": path.exists(), "size_bytes": path.stat().st_size if path.exists() else None})

    if outputs_dir.exists():
        for p in sorted(outputs_dir.glob("*.png")):
            artifacts.append({"name": p.name, "exists": True, "size_bytes": p.stat().st_size})

    return {"job_id": job_id, "artifacts": artifacts}


@router.get("/jobs/{job_id}/artifacts/{name}")
async def download_report_artifact(job_id: str, name: str, db=Depends(get_db)):
    job = db_get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    inputs_dir, outputs_dir, analysis_path, report_path = artifact_paths(job_id)

    if name == "analysis.json":
        if not analysis_path.exists():
            raise HTTPException(status_code=404, detail="Artifact not found")
        return FileResponse(path=str(analysis_path), media_type="application/json", filename=analysis_path.name)

    if name == "report.md":
        if not report_path.exists():
            raise HTTPException(status_code=404, detail="Artifact not found")
        return PlainTextResponse(report_path.read_text(encoding="utf-8"), media_type="text/markdown")

    if name.startswith("inputs/"):
        safe = os.path.basename(name[len("inputs/") :])
        path = (inputs_dir / safe).resolve()
        if inputs_dir.resolve() not in path.parents:
            raise HTTPException(status_code=400, detail="Invalid artifact name")
        if not path.exists():
            raise HTTPException(status_code=404, detail="Artifact not found")
        return FileResponse(path=str(path), media_type="application/octet-stream", filename=path.name)

    safe = os.path.basename(name)
    if not safe.lower().endswith(".png"):
        raise HTTPException(status_code=400, detail="Only .png artifacts supported here")
    path = (outputs_dir / safe).resolve()
    if outputs_dir.resolve() not in path.parents:
        raise HTTPException(status_code=400, detail="Invalid artifact name")
    if not path.exists():
        raise HTTPException(status_code=404, detail="Artifact not found")
    return FileResponse(path=str(path), media_type="image/png", filename=path.name)


@router.delete("/jobs/{job_id}")
async def delete_report_job(job_id: str, db=Depends(get_db)):
    job = db_get_job(db, job_id)
    if not job:
        return {"deleted": False}
    shutil.rmtree(job_dir(job_id), ignore_errors=True)
    db_delete_job(db, job_id)
    return {"deleted": True}

