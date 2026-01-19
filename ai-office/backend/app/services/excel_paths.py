from __future__ import annotations

from pathlib import Path

from ..core.config import get_settings


def job_dir(job_id: str) -> Path:
    settings = get_settings()
    return settings.data_dir / "excel_jobs" / job_id


def artifact_paths(job_id: str) -> tuple[Path, Path, Path, Path]:
    work_dir = job_dir(job_id)
    return (
        work_dir / "input.xlsx",
        work_dir / "generated.py",
        work_dir / "output.xlsx",
        work_dir / "summary.json",
    )

