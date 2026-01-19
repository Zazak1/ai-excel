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
        # Best-effort: resource isn't available on some platforms.
        return


def _json_default(value: object):
    # numpy/pandas scalars (e.g. int64) -> python scalar
    item = getattr(value, "item", None)
    if callable(item):
        try:
            return item()
        except Exception:
            pass

    # numpy arrays
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

    # pandas objects often implement to_dict
    to_dict = getattr(value, "to_dict", None)
    if callable(to_dict):
        try:
            return to_dict()
        except Exception:
            pass

    return str(value)


def main() -> int:
    if len(sys.argv) != 6:
        print("usage: python -m app.sandbox.subprocess_runner <code.py> <input.xlsx> <output.xlsx> <summary.json> <timeout_seconds>", file=sys.stderr)
        return 2

    code_path = Path(sys.argv[1]).resolve()
    input_path = Path(sys.argv[2]).resolve()
    output_path = Path(sys.argv[3]).resolve()
    summary_path = Path(sys.argv[4]).resolve()
    timeout_seconds = float(sys.argv[5])

    _apply_resource_limits(timeout_seconds)

    namespace = runpy.run_path(str(code_path))
    transform = namespace.get("transform")
    if not callable(transform):
        print("transform() not found or not callable", file=sys.stderr)
        return 3

    summary = transform(str(input_path), str(output_path))
    if not isinstance(summary, dict):
        summary = {"summary": summary}

    summary_path.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2, default=_json_default),
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
