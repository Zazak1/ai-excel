from __future__ import annotations

from sqlalchemy import Engine, text


def _table_columns(engine: Engine, table: str) -> set[str]:
    with engine.begin() as conn:
        rows = conn.execute(text(f"PRAGMA table_info('{table}')")).fetchall()
    # row tuple: (cid, name, type, notnull, dflt_value, pk)
    return {str(r[1]) for r in rows}


def _add_column(engine: Engine, table: str, column_def_sql: str) -> None:
    with engine.begin() as conn:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column_def_sql}"))


def ensure_job_progress_columns(engine: Engine) -> None:
    """
    The project uses `create_all()` without a migration framework.
    For dev iterations, add new optional columns via `ALTER TABLE` if missing.
    """
    for table in ("excel_jobs", "analytics_jobs", "report_jobs"):
        cols = _table_columns(engine, table)
        if not cols:
            # Table may not exist yet (should be created by create_all()).
            continue

        if "stage" not in cols:
            _add_column(engine, table, "stage TEXT")
        if "progress" not in cols:
            _add_column(engine, table, "progress REAL")
        if "detail" not in cols:
            _add_column(engine, table, "detail TEXT")
