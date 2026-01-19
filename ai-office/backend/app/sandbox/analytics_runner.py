from __future__ import annotations

import json
import runpy
import sys
from datetime import date, datetime
from pathlib import Path


def _apply_resource_limits(timeout_seconds: float) -> None:
    try:
        import resource  # noqa: PLC0415

        cpu_seconds = max(int(timeout_seconds), 1)
        resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds))
    except Exception:
        return


def _json_default(value: object):
    item = getattr(value, "item", None)
    if callable(item):
        try:
            return item()
        except Exception:
            pass

    tolist = getattr(value, "tolist", None)
    if callable(tolist):
        try:
            return tolist()
        except Exception:
            pass

    if isinstance(value, (datetime, date)):
        return value.isoformat()

    if isinstance(value, Path):
        return str(value)

    to_dict = getattr(value, "to_dict", None)
    if callable(to_dict):
        try:
            return to_dict()
        except Exception:
            pass

    return str(value)


def main() -> int:
    if len(sys.argv) != 6:
        print(
            "usage: python -m app.sandbox.analytics_runner <code.py> <input> <output_dir> <summary.json> <timeout_seconds>",
            file=sys.stderr,
        )
        return 2

    code_path = Path(sys.argv[1]).resolve()
    input_path = Path(sys.argv[2]).resolve()
    output_dir = Path(sys.argv[3]).resolve()
    summary_path = Path(sys.argv[4]).resolve()
    timeout_seconds = float(sys.argv[5])

    output_dir.mkdir(parents=True, exist_ok=True)
    _apply_resource_limits(timeout_seconds)

    namespace = runpy.run_path(str(code_path))
    analyze = namespace.get("analyze")
    if not callable(analyze):
        print("analyze() not found or not callable", file=sys.stderr)
        return 3

    summary = analyze(str(input_path), str(output_dir))
    if not isinstance(summary, dict):
        summary = {"summary": summary}

    summary_path.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2, default=_json_default),
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

