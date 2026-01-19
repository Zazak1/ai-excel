from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

from ..core.config import get_settings
from ..db.session import SessionLocal
from ..sandbox.validator import SandboxValidationError, validate_generated_code
from ..services.deepseek_client import DeepSeekClient
from ..services.excel_codegen import generate_excel_code
from ..services.excel_metadata import extract_workbook_metadata
from ..store.excel_jobs_db import get_excel_job as db_get_excel_job
from ..store.excel_jobs_db import update_excel_job as db_update_excel_job
from .excel_paths import artifact_paths


def _backend_root() -> Path:
    # .../backend/app/services/excel_job_runner.py -> backend root
    return Path(__file__).resolve().parents[2]


async def run_excel_job(job_id: str) -> None:
    settings = get_settings()
    with SessionLocal() as db:
        job = db_get_excel_job(db, job_id)
        if not job:
            return
        db_update_excel_job(db, job_id, status="running", started_at=datetime.utcnow())
        prompt = job.prompt

    input_path, code_path, output_path, summary_path = artifact_paths(job_id)

    try:
        if not settings.deepseek_api_key:
            raise RuntimeError("DEEPSEEK_API_KEY is not set.")

        metadata = await asyncio.to_thread(extract_workbook_metadata, input_path)
        client = DeepSeekClient(
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url,
            timeout_seconds=settings.deepseek_timeout_seconds,
        )
        codegen = await generate_excel_code(
            client=client,
            model=settings.deepseek_model,
            temperature=settings.deepseek_temperature,
            metadata=metadata,
            user_prompt=prompt,
        )

        code_path.write_text(codegen.python_code, encoding="utf-8")
        validate_generated_code(codegen.python_code, required_function="transform")

        cmd = [
            sys.executable,
            "-m",
            "app.sandbox.subprocess_runner",
            str(code_path),
            str(input_path),
            str(output_path),
            str(summary_path),
            str(settings.sandbox_timeout_seconds),
        ]
        env = {
            **os.environ,
            "PYTHONUNBUFFERED": "1",
        }

        completed = await asyncio.to_thread(
            subprocess.run,
            cmd,
            cwd=str(_backend_root()),
            env=env,
            capture_output=True,
            text=True,
            timeout=settings.sandbox_timeout_seconds,
            check=False,
        )

        if completed.returncode != 0:
            stderr = (completed.stderr or "").strip()
            stdout = (completed.stdout or "").strip()
            raise RuntimeError(
                "Sandbox execution failed.\n"
                f"exit={completed.returncode}\n"
                f"stdout={stdout[:2000]}\n"
                f"stderr={stderr[:2000]}"
            )

        if not output_path.exists():
            raise RuntimeError("No output.xlsx generated.")

        output_size_mb = output_path.stat().st_size / (1024 * 1024)
        if output_size_mb > settings.sandbox_max_output_mb:
            raise RuntimeError(f"Output too large: {output_size_mb:.1f} MB")

        summary: Optional[dict] = None
        if summary_path.exists():
            summary = json.loads(summary_path.read_text(encoding="utf-8"))

        with SessionLocal() as db:
            db_update_excel_job(
                db,
                job_id,
                status="succeeded",
                finished_at=datetime.utcnow(),
                llm_model=codegen.llm_model,
                summary=summary,
                error=None,
            )
    except SandboxValidationError as exc:
        with SessionLocal() as db:
            db_update_excel_job(
                db,
                job_id,
                status="failed",
                finished_at=datetime.utcnow(),
                error=f"ValidationError: {exc}",
            )
    except Exception as exc:
        message = str(exc) or repr(exc)
        with SessionLocal() as db:
            db_update_excel_job(
                db,
                job_id,
                status="failed",
                finished_at=datetime.utcnow(),
                error=message,
            )


def run_excel_job_sync(job_id: str) -> None:
    asyncio.run(run_excel_job(job_id))
