from __future__ import annotations

import asyncio
import json
from datetime import datetime
from pathlib import Path

from ..core.config import get_settings
from ..db.session import SessionLocal
from ..services.deepseek_client import DeepSeekClient
from ..services.report_analysis import analyze_inputs_and_charts
from ..services.report_codegen import generate_report_markdown_stream
from ..services.report_paths import artifact_paths
from ..store.report_jobs_db import get_report_job as db_get_job
from ..store.report_jobs_db import update_report_job as db_update_job


async def run_report_job(job_id: str) -> None:
    settings = get_settings()

    async def _update(stage: str, progress: float | None = None, detail: str | None = None) -> None:
        with SessionLocal() as db:
            db_update_job(db, job_id, stage=stage, progress=progress, detail=detail)

    with SessionLocal() as db:
        job = db_get_job(db, job_id)
        if not job:
            return
        db_update_job(db, job_id, status="running", started_at=datetime.utcnow(), stage="starting", progress=0.01)
        title = job.title
        template = job.template
        notes = job.notes or ""
        user_prompt = job.prompt or ""

    inputs_dir, outputs_dir, analysis_path, report_path = artifact_paths(job_id)
    outputs_dir.mkdir(parents=True, exist_ok=True)

    try:
        if not settings.deepseek_api_key:
            raise RuntimeError("DEEPSEEK_API_KEY is not set.")

        await _update("reading_inputs", 0.08, "读取并分析文件中…")
        inputs = sorted([p for p in inputs_dir.glob("*") if p.is_file()])
        if not inputs:
            raise RuntimeError("No input files.")

        analysis_result = await asyncio.to_thread(analyze_inputs_and_charts, inputs, output_dir=outputs_dir)
        analysis_path.write_text(json.dumps(analysis_result.analysis, ensure_ascii=False), encoding="utf-8")

        client = DeepSeekClient(
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url,
            timeout_seconds=settings.deepseek_timeout_seconds,
        )

        async def on_llm_update(text: str) -> None:
            await _update("generating_report", 0.65, (text or "")[-2000:])

        await _update("generating_report", 0.6, "DeepSeek 生成深度报告中…")
        codegen = await generate_report_markdown_stream(
            client=client,
            model=settings.deepseek_model,
            temperature=max(0.2, min(0.6, settings.deepseek_temperature or 0.2)),
            title=title,
            template=template,
            notes=notes,
            user_prompt=user_prompt,
            analysis=analysis_result.analysis,
            on_update=on_llm_update,
        )
        report_path.write_text(codegen.markdown, encoding="utf-8")

        summary = {
            "analysis": analysis_result.analysis,
            "llm": {"model": codegen.llm_model, "report_artifact": "report.md"},
        }

        with SessionLocal() as db:
            db_update_job(
                db,
                job_id,
                status="succeeded",
                finished_at=datetime.utcnow(),
                llm_model=codegen.llm_model,
                summary=summary,
                error=None,
                stage="done",
                progress=1.0,
                detail=None,
            )
    except Exception as exc:
        message = str(exc) or repr(exc)
        with SessionLocal() as db:
            db_update_job(
                db,
                job_id,
                status="failed",
                finished_at=datetime.utcnow(),
                error=message,
                stage="failed",
            )


def run_report_job_sync(job_id: str) -> None:
    asyncio.run(run_report_job(job_id))

