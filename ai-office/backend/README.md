# AI Office Backend (FastAPI)

This backend powers the `ai-office` (Vite) frontend.

## Run (local)

```bash
# (optional) from repo root:
cp ai-office/.env.example ai-office/.env

cd ai-office/backend
python3 -m pip install -r requirements.txt
python3 -m uvicorn app.main:app --reload --port 8000
```

## API

- Health: `GET /api/health`
- Excel code-interpreter jobs:
  - Create: `POST /api/excel/jobs` (multipart: `file`, `prompt`)
  - Get: `GET /api/excel/jobs/{job_id}`
  - List: `GET /api/excel/jobs`
  - Summary: `GET /api/excel/jobs/{job_id}/summary`
  - Generated code: `GET /api/excel/jobs/{job_id}/code`
  - Artifacts: `GET /api/excel/jobs/{job_id}/artifacts`
  - Download output: `GET /api/excel/jobs/{job_id}/download`
  - Delete job: `DELETE /api/excel/jobs/{job_id}`

- Analytics jobs:
  - Create: `POST /api/analytics/jobs` (multipart: `file`, `prompt`)
  - Get: `GET /api/analytics/jobs/{job_id}`
  - List: `GET /api/analytics/jobs`
  - Artifacts list: `GET /api/analytics/jobs/{job_id}/artifacts`
  - Artifact download: `GET /api/analytics/jobs/{job_id}/artifacts/{name}` (`summary.json` / `generated.py` / `*.png`)
  - Delete job: `DELETE /api/analytics/jobs/{job_id}`

- Report jobs (deep report):
  - Create: `POST /api/report/jobs` (multipart: `title`, `template`, `notes`, `prompt`, `files[]`)
  - Get: `GET /api/report/jobs/{job_id}`
  - List: `GET /api/report/jobs`
  - Artifacts list: `GET /api/report/jobs/{job_id}/artifacts`
  - Artifact download: `GET /api/report/jobs/{job_id}/artifacts/{name}` (`report.md` / `analysis.json` / `inputs/*` / `*.png`)
  - Delete job: `DELETE /api/report/jobs/{job_id}`

## Configuration

See `ai-office/.env.example` for all environment variables.

Defaults:
- Uses SQLite under `DATA_DIR` if `DATABASE_URL` is empty
- Uses Redis queue if `REDIS_URL` is set (recommended); otherwise falls back to in-process background tasks

## Notes on isolation

The current runner validates generated code (AST) and executes it in a separate Python process.
For production-grade isolation, run the runner inside a dedicated container with:

- `--network none`
- read-only mount for inputs
- write-only output mount
- CPU/memory limits + seccomp/apparmor
