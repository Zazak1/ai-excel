from __future__ import annotations

from ..services.excel_job_runner import run_excel_job_sync
from ..services.analytics_job_runner import run_analytics_job_sync
from ..services.report_job_runner import run_report_job_sync


def process_excel_job(job_id: str) -> None:
    run_excel_job_sync(job_id)


def process_analytics_job(job_id: str) -> None:
    run_analytics_job_sync(job_id)


def process_report_job(job_id: str) -> None:
    run_report_job_sync(job_id)
