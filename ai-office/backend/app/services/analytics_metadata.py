from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd

from ..core.dataclass_compat import frozen_dataclass


@frozen_dataclass
class DatasetMetadata:
    filename: str
    kind: str  # csv|xlsx
    sheets: list[dict[str, Any]]


def _describe_frame(df: pd.DataFrame, *, max_numeric_columns: int = 30) -> dict[str, Any]:
    dtypes = {str(k): str(v) for k, v in df.dtypes.astype(str).to_dict().items()}
    null_rate = {str(k): float(df[k].isna().mean()) for k in df.columns}
    numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
    if len(numeric_cols) > max_numeric_columns:
        numeric_cols = numeric_cols[:max_numeric_columns]
    numeric_summary: dict[str, Any] = {}
    if numeric_cols:
        desc = df[numeric_cols].describe().to_dict()
        numeric_summary = {str(k): {str(sk): float(sv) for sk, sv in v.items()} for k, v in desc.items()}
    return {"columns": [str(c) for c in df.columns.tolist()], "dtypes": dtypes, "null_rate": null_rate, "numeric": numeric_summary}


def _truncate_sample_rows(rows: list[dict[str, Any]], *, max_cell_chars: int) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for row in rows:
        new_row: dict[str, Any] = {}
        for k, v in row.items():
            if isinstance(v, str) and len(v) > max_cell_chars:
                new_row[str(k)] = v[:max_cell_chars] + "...(truncated)"
            else:
                new_row[str(k)] = v
        out.append(new_row)
    return out


def extract_dataset_metadata(
    path: Path,
    *,
    sample_rows: int = 20,
    max_columns: int = 60,
    max_cell_chars: int = 120,
    csv_encoding: str = "utf-8",
) -> DatasetMetadata:
    suffix = path.suffix.lower()
    if suffix == ".csv" or suffix == ".txt":
        df = pd.read_csv(path, nrows=sample_rows, encoding=csv_encoding)
        df = df.where(pd.notnull(df), None)
        columns_all = [str(c) for c in df.columns.tolist()]
        truncated_columns = len(columns_all) > max_columns
        df_preview = df.iloc[:, :max_columns] if truncated_columns else df
        return DatasetMetadata(
            filename=path.name,
            kind="csv",
            sheets=[
                {
                    "name": "data",
                    "shape": [int(df.shape[0]), int(df.shape[1])],
                    "columns_all": columns_all,
                    "preview_columns": [str(c) for c in df_preview.columns.tolist()],
                    "truncated_columns": truncated_columns,
                    **_describe_frame(df_preview),
                    "sample_rows": _truncate_sample_rows(
                        df_preview.head(min(sample_rows, len(df_preview))).to_dict(orient="records"),
                        max_cell_chars=max_cell_chars,
                    ),
                }
            ],
        )

    if suffix in {".xlsx", ".xlsm", ".xls"}:
        xls = pd.ExcelFile(path)
        sheets: list[dict[str, Any]] = []
        for name in xls.sheet_names[:10]:
            df = pd.read_excel(xls, sheet_name=name, nrows=sample_rows)
            df = df.where(pd.notnull(df), None)
            columns_all = [str(c) for c in df.columns.tolist()]
            truncated_columns = len(columns_all) > max_columns
            df_preview = df.iloc[:, :max_columns] if truncated_columns else df
            sheets.append(
                {
                    "name": str(name),
                    "shape": [int(df.shape[0]), int(df.shape[1])],
                    "columns_all": columns_all,
                    "preview_columns": [str(c) for c in df_preview.columns.tolist()],
                    "truncated_columns": truncated_columns,
                    **_describe_frame(df_preview),
                    "sample_rows": _truncate_sample_rows(
                        df_preview.head(min(sample_rows, len(df_preview))).to_dict(orient="records"),
                        max_cell_chars=max_cell_chars,
                    ),
                }
            )
        return DatasetMetadata(filename=path.name, kind="xlsx", sheets=sheets)

    raise ValueError("Unsupported file type. Only .csv/.txt/.xlsx supported.")
