from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class ExcelJobModel(Base):
    __tablename__ = "excel_jobs"

    job_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    status: Mapped[str] = mapped_column(String(32), index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), index=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=False), nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=False), nullable=True)

    input_filename: Mapped[str] = mapped_column(String(512))
    prompt: Mapped[str] = mapped_column(Text)

    llm_model: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    summary_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    stage: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    progress: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    work_dir: Mapped[str] = mapped_column(String(1024))


class AnalyticsJobModel(Base):
    __tablename__ = "analytics_jobs"

    job_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    status: Mapped[str] = mapped_column(String(32), index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), index=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=False), nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=False), nullable=True)

    input_filename: Mapped[str] = mapped_column(String(512))
    prompt: Mapped[str] = mapped_column(Text)

    llm_model: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    summary_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    stage: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    progress: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    work_dir: Mapped[str] = mapped_column(String(1024))


class ReportJobModel(Base):
    __tablename__ = "report_jobs"

    job_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    status: Mapped[str] = mapped_column(String(32), index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), index=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=False), nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=False), nullable=True)

    title: Mapped[str] = mapped_column(String(256))
    template: Mapped[str] = mapped_column(String(64))
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    input_manifest_json: Mapped[str] = mapped_column(Text)

    llm_model: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    summary_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    stage: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    progress: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    work_dir: Mapped[str] = mapped_column(String(1024))
