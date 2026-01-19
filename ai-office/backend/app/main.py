from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.router import api_router
from .core.config import get_settings
from .db.base import Base
from .db.migrate import ensure_job_progress_columns
from .db.session import engine
from .db import models  # noqa: F401

app = FastAPI(
    title="Stitch AI Office Suite API",
    description="Backend API for Stitch AI Office Suite",
    version="1.0.0"
)

settings = get_settings()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Welcome to Stitch AI Office Suite API"}

@app.on_event("startup")
def _startup() -> None:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    ensure_job_progress_columns(engine)

app.include_router(api_router)
