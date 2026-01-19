from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd

from ..core.dataclass_compat import frozen_dataclass


@frozen_dataclass
class SheetMetadata:
    name: str
    columns: list[str]
    dtypes: dict[str, str]
    sample_rows: list[dict[str, Any]]


@frozen_dataclass
class WorkbookMetadata:
    filename: str
    sheets: list[SheetMetadata]


def extract_workbook_metadata(path: Path, *, sample_rows: int = 8) -> WorkbookMetadata:
    xls = pd.ExcelFile(path)
    sheets: list[SheetMetadata] = []
    for sheet_name in xls.sheet_names:
        df = pd.read_excel(xls, sheet_name=sheet_name, nrows=max(sample_rows, 1))
        df = df.where(pd.notnull(df), None)
        sheets.append(
            SheetMetadata(
                name=str(sheet_name),
                columns=[str(c) for c in df.columns.tolist()],
                dtypes={str(k): str(v) for k, v in df.dtypes.astype(str).to_dict().items()},
                sample_rows=df.head(sample_rows).to_dict(orient="records"),
            )
        )
    return WorkbookMetadata(filename=path.name, sheets=sheets)
