from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class ReportAnalysisResult:
    analysis: dict[str, Any]
    charts: list[dict[str, Any]]


def _coerce_jsonable(obj: Any) -> Any:
    if obj is None:
        return None
    if isinstance(obj, (str, int, float, bool)):
        return obj
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, (list, tuple)):
        return [_coerce_jsonable(x) for x in obj]
    if isinstance(obj, dict):
        return {str(k): _coerce_jsonable(v) for k, v in obj.items()}
    return str(obj)


def _guess_datetime_column(df: pd.DataFrame) -> Optional[str]:
    for col in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            return str(col)
    for col in df.columns[:10]:
        s = df[col]
        if pd.api.types.is_string_dtype(s) or pd.api.types.is_object_dtype(s):
            parsed = pd.to_datetime(s, errors="coerce", utc=False)
            if parsed.notna().mean() > 0.8:
                df[col] = parsed
                return str(col)
    return None


def _basic_frame_analysis(df: pd.DataFrame, *, max_cols: int = 60) -> dict[str, Any]:
    cols = [str(c) for c in df.columns.tolist()]
    truncated_cols = len(cols) > max_cols
    df2 = df.iloc[:, :max_cols] if truncated_cols else df

    dtypes = {str(k): str(v) for k, v in df2.dtypes.astype(str).to_dict().items()}
    null_rate = {str(k): float(df2[k].isna().mean()) for k in df2.columns}
    dup_rows = int(df2.duplicated().sum()) if len(df2) else 0

    numeric_cols = [c for c in df2.columns if pd.api.types.is_numeric_dtype(df2[c])]
    numeric_summary: dict[str, Any] = {}
    if numeric_cols:
        desc = df2[numeric_cols].describe().to_dict()
        numeric_summary = {str(k): {str(sk): float(sv) for sk, sv in v.items()} for k, v in desc.items()}

    # categorical top values (sampled)
    cat_cols = [c for c in df2.columns if pd.api.types.is_object_dtype(df2[c]) or pd.api.types.is_string_dtype(df2[c])]
    cat_top: dict[str, Any] = {}
    for c in cat_cols[:12]:
        vc = df2[c].astype(str).value_counts(dropna=True).head(5)
        cat_top[str(c)] = [{"value": str(idx), "count": int(cnt)} for idx, cnt in vc.items()]

    dt_col = _guess_datetime_column(df2)
    dt_range = None
    if dt_col:
        s = pd.to_datetime(df2[dt_col], errors="coerce")
        if s.notna().any():
            dt_range = {"column": dt_col, "start": str(s.min()), "end": str(s.max())}

    anomalies: list[dict[str, Any]] = []
    for c in numeric_cols[:20]:
        s = df2[c].dropna()
        if len(s) < 10:
            continue
        q1 = s.quantile(0.25)
        q3 = s.quantile(0.75)
        iqr = q3 - q1
        if iqr == 0:
            continue
        low = q1 - 1.5 * iqr
        high = q3 + 1.5 * iqr
        outliers = s[(s < low) | (s > high)]
        if len(outliers) > 0:
            anomalies.append(
                {
                    "type": "outlier",
                    "column": str(c),
                    "count": int(len(outliers)),
                    "bounds": {"low": float(low), "high": float(high)},
                }
            )

    preview_rows = df2.head(12).replace({np.nan: None}).to_dict(orient="records")
    return {
        "shape": [int(df.shape[0]), int(df.shape[1])],
        "columns_all": cols,
        "preview_columns": [str(c) for c in df2.columns.tolist()],
        "truncated_columns": truncated_cols,
        "dtypes": dtypes,
        "null_rate": null_rate,
        "duplicate_rows": dup_rows,
        "numeric": numeric_summary,
        "categorical_top": cat_top,
        "datetime_range": dt_range,
        "anomalies": anomalies,
        "preview_rows": preview_rows,
    }


def analyze_tabular_file(path: Path) -> dict[str, Any]:
    suffix = path.suffix.lower()
    if suffix in {".csv", ".txt"}:
        df = pd.read_csv(path)
        return {"filename": path.name, "kind": "csv", "tables": [{"name": "data", **_basic_frame_analysis(df)}]}

    if suffix in {".xlsx", ".xlsm", ".xls"}:
        xls = pd.ExcelFile(path)
        tables: list[dict[str, Any]] = []
        for name in xls.sheet_names[:10]:
            df = pd.read_excel(xls, sheet_name=name)
            tables.append({"name": str(name), **_basic_frame_analysis(df)})
        return {"filename": path.name, "kind": "xlsx", "tables": tables}

    text = path.read_text(encoding="utf-8", errors="ignore")
    text = text.strip()
    if len(text) > 12000:
        text = text[:12000] + "...(truncated)"
    return {"filename": path.name, "kind": "text", "text": text}


def generate_charts_for_table(
    df: pd.DataFrame,
    *,
    output_dir: Path,
    prefix: str,
    max_points: int = 2000,
) -> list[dict[str, Any]]:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    charts: list[dict[str, Any]] = []

    df2 = df.copy()
    dt_col = _guess_datetime_column(df2)
    numeric_cols = [c for c in df2.columns if pd.api.types.is_numeric_dtype(df2[c])]

    if dt_col and numeric_cols:
        sdt = pd.to_datetime(df2[dt_col], errors="coerce")
        tmp = df2.assign(__dt=sdt).dropna(subset=["__dt"])
        if len(tmp) > max_points:
            tmp = tmp.sort_values("__dt").iloc[-max_points:]
        use_cols = numeric_cols[:2]
        fig, ax = plt.subplots(figsize=(8, 3))
        for c in use_cols:
            ax.plot(tmp["__dt"], tmp[c], label=str(c))
        ax.set_title("Trend")
        ax.grid(True, alpha=0.2)
        ax.legend()
        fig.autofmt_xdate()
        name = f"{prefix}_trend.png"
        fig.savefig(output_dir / name, dpi=140, bbox_inches="tight")
        plt.close(fig)
        charts.append({"file": name, "title": "趋势图", "kind": "line", "columns": [str(c) for c in use_cols]})

    # histogram for first numeric column
    if numeric_cols:
        c0 = numeric_cols[0]
        s = df2[c0].dropna()
        if len(s) > 0:
            fig, ax = plt.subplots(figsize=(6, 3))
            ax.hist(s.values, bins=30, color="#3b82f6", alpha=0.85)
            ax.set_title(f"Distribution: {c0}")
            ax.grid(True, alpha=0.2)
            name = f"{prefix}_hist.png"
            fig.savefig(output_dir / name, dpi=140, bbox_inches="tight")
            plt.close(fig)
            charts.append({"file": name, "title": f"{c0} 分布", "kind": "hist", "column": str(c0)})

    return charts


def analyze_inputs_and_charts(inputs: list[Path], *, output_dir: Path) -> ReportAnalysisResult:
    analysis_files: list[dict[str, Any]] = []
    charts: list[dict[str, Any]] = []

    for idx, p in enumerate(inputs):
        file_analysis = analyze_tabular_file(p)
        analysis_files.append(file_analysis)

        # Generate charts only for tabular data
        kind = file_analysis.get("kind")
        if kind == "csv":
            df = pd.read_csv(p)
            charts.extend(generate_charts_for_table(df, output_dir=output_dir, prefix=f"file{idx+1}"))
        elif kind == "xlsx":
            xls = pd.ExcelFile(p)
            if xls.sheet_names:
                df = pd.read_excel(xls, sheet_name=xls.sheet_names[0])
                charts.extend(generate_charts_for_table(df, output_dir=output_dir, prefix=f"file{idx+1}"))

    analysis = {"files": _coerce_jsonable(analysis_files), "charts": _coerce_jsonable(charts)}
    return ReportAnalysisResult(analysis=analysis, charts=charts)

