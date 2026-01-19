from __future__ import annotations

from fastapi import APIRouter

from .routes import analytics, excel, health, report

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router, tags=["health"])
api_router.include_router(excel.router, prefix="/excel", tags=["excel"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(report.router, prefix="/report", tags=["report"])
