from __future__ import annotations

from pathlib import Path

from ..core.config import get_settings


def job_dir(job_id: str) -> Path:
    settings = get_settings()
    return settings.data_dir / "analytics_jobs" / job_id


def artifact_paths(job_id: str, *, input_ext: str) -> tuple[Path, Path, Path, Path]:
    work_dir = job_dir(job_id)
    input_path = work_dir / f"input.{input_ext.lstrip('.')}"
    code_path = work_dir / "generated.py"
    output_dir = work_dir / "outputs"
    summary_path = output_dir / "summary.json"
    return input_path, code_path, output_dir, summary_path

