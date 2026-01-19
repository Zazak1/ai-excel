from __future__ import annotations

from pathlib import Path

from ..core.config import get_settings


def job_dir(job_id: str) -> Path:
    settings = get_settings()
    return settings.data_dir / "report_jobs" / job_id


def artifact_paths(job_id: str) -> tuple[Path, Path, Path, Path]:
    work_dir = job_dir(job_id)
    inputs_dir = work_dir / "inputs"
    outputs_dir = work_dir / "outputs"
    analysis_path = outputs_dir / "analysis.json"
    report_path = outputs_dir / "report.md"
    return inputs_dir, outputs_dir, analysis_path, report_path

