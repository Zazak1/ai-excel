from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

from ..core.config import get_settings
from ..db.session import SessionLocal
from ..sandbox.validator import SandboxValidationError, validate_generated_code
from ..services.deepseek_client import DeepSeekClient
from ..services.analytics_codegen import generate_analytics_code_stream
from ..services.analytics_metadata import extract_dataset_metadata
from ..services.analytics_summarizer import summarize_analytics_result
from ..store.analytics_jobs_db import get_analytics_job as db_get_job
from ..store.analytics_jobs_db import update_analytics_job as db_update_job
from .analytics_paths import artifact_paths, job_dir


def _backend_root() -> Path:
    return Path(__file__).resolve().parents[2]


async def run_analytics_job(job_id: str) -> None:
    settings = get_settings()

    async def _update(stage: str, progress: float | None = None, detail: str | None = None) -> None:
        with SessionLocal() as db:
            db_update_job(db, job_id, stage=stage, progress=progress, detail=detail)

    with SessionLocal() as db:
        job = db_get_job(db, job_id)
        if not job:
            return
        db_update_job(db, job_id, status="running", started_at=datetime.utcnow(), stage="starting", progress=0.01)
        prompt = job.prompt
        input_filename = job.input_filename

    ext = Path(input_filename).suffix.lower().lstrip(".") or "csv"
    input_path, code_path, output_dir, summary_path = artifact_paths(job_id, input_ext=ext)
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        if not settings.deepseek_api_key:
            raise RuntimeError("DEEPSEEK_API_KEY is not set.")

        await _update("reading_metadata", 0.1, "读取数据元信息中…")
        metadata = await asyncio.to_thread(extract_dataset_metadata, input_path, sample_rows=20, max_columns=60)

        client = DeepSeekClient(
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url,
            timeout_seconds=settings.deepseek_timeout_seconds,
        )

        async def on_llm_update(text: str) -> None:
            snippet = (text or "")[-2000:]
            await _update("generating_code", 0.35, snippet)

        codegen = None
        last_exc: Exception | None = None
        for attempt in range(2):
            try:
                await _update("generating_code", 0.3, "DeepSeek 生成分析代码中…")
                codegen = await generate_analytics_code_stream(
                    client=client,
                    model=settings.deepseek_model,
                    temperature=settings.deepseek_temperature,
                    metadata=metadata,
                    user_prompt=prompt,
                    on_update=on_llm_update,
                )
                break
            except Exception as exc:
                last_exc = exc
                message = str(exc) or repr(exc)
                is_timeout = "ReadTimeout" in message or "timed out" in message.lower()
                if attempt == 0 and is_timeout:
                    await _update("retrying", 0.32, "DeepSeek 超时，正在重试（1/1）…")
                    await asyncio.sleep(1.5)
                    continue
                raise
        if codegen is None and last_exc is not None:
            raise last_exc

        await _update("validating_code", 0.55, "校验生成代码中…")
        code_path.write_text(codegen.python_code, encoding="utf-8")
        validate_generated_code(codegen.python_code, required_function="analyze")

        await _update("running_sandbox", 0.7, "运行 Python 分析任务中…")
        cmd = [
            sys.executable,
            "-m",
            "app.sandbox.analytics_runner",
            str(code_path),
            str(input_path),
            str(output_dir),
            str(summary_path),
            str(settings.sandbox_timeout_seconds),
        ]
        env = {
            **os.environ,
            "PYTHONUNBUFFERED": "1",
            "MPLBACKEND": "Agg",
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

        if not summary_path.exists():
            raise RuntimeError("No summary.json generated.")

        await _update("finalizing", 0.9, "生成摘要中…")
        analysis = json.loads(summary_path.read_text(encoding="utf-8"))

        llm_summary: dict[str, object] | None = None
        try:
            await _update("summarizing", 0.94, "DeepSeek 生成自然语言摘要中…")
            llm = await summarize_analytics_result(
                client=client,
                model=settings.deepseek_model,
                temperature=min(0.3, settings.deepseek_temperature),
                analysis=analysis if isinstance(analysis, dict) else {"analysis": analysis},
                user_prompt=prompt,
            )
            llm_summary = {
                "text": llm.text,
                "highlights": llm.highlights,
                "anomalies": llm.anomalies,
                "suggestions": llm.suggestions,
            }
        except Exception:
            llm_summary = None

        summary: dict[str, object] = {"analysis": analysis}
        if llm_summary is not None:
            summary["llm"] = llm_summary

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
    except SandboxValidationError as exc:
        with SessionLocal() as db:
            db_update_job(
                db,
                job_id,
                status="failed",
                finished_at=datetime.utcnow(),
                error=f"ValidationError: {exc}",
                stage="failed",
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


def run_analytics_job_sync(job_id: str) -> None:
    asyncio.run(run_analytics_job(job_id))
