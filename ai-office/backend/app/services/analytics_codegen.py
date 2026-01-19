from __future__ import annotations

import time
import json
import re
from typing import Any, Awaitable, Callable, Optional

from ..core.dataclass_compat import frozen_dataclass
from .analytics_metadata import DatasetMetadata
from .deepseek_client import DeepSeekChatMessage, DeepSeekClient


@frozen_dataclass
class CodegenResult:
    python_code: str
    notes: Optional[str]
    llm_model: str
    raw: dict[str, Any]


_PY_FENCE_RE = re.compile(r"```python\\s*(.*?)\\s*```", re.DOTALL | re.IGNORECASE)
_ANY_FENCE_RE = re.compile(r"```[a-zA-Z0-9_-]*\\s*(.*?)\\s*```", re.DOTALL)


def _sanitize_python_code(code: str) -> str:
    text = code.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].lstrip().startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text.strip()


def _extract_python_code(text: str) -> tuple[str, str | None]:
    content = text.strip()

    py = _PY_FENCE_RE.search(content)
    if py:
        return _sanitize_python_code(py.group(1)), None

    # If any fenced content includes python, use it.
    any_fence = _ANY_FENCE_RE.search(content)
    if any_fence and "def analyze" in any_fence.group(1):
        return _sanitize_python_code(any_fence.group(1)), "extracted from non-python fence"

    if "def analyze" in content:
        return _sanitize_python_code(content), "used raw content (non-fenced)"

    raise ValueError("LLM did not return python code with analyze().")


def build_analytics_prompt(metadata: DatasetMetadata, user_prompt: str) -> str:
    meta_obj = {"filename": metadata.filename, "kind": metadata.kind, "sheets": metadata.sheets}
    return (
        "你是一个数据分析助手。请基于用户上传的数据文件生成 Python 分析代码。\n\n"
        "目标：\n"
        "- 生成“对表格内容本身”的摘要总结（字段概览、数据规模、时间范围/分组范围、缺失/重复、核心指标、趋势、异常点、建议）\n"
        "- 检测数据异常（缺失、重复、离群、突变、非预期范围等）\n"
        "- 用 matplotlib 绘制折线图/柱状图等，并保存为 PNG 文件到 output_dir\n\n"
        "强约束（必须遵守）：\n"
        "1) 只能使用：pandas、numpy、matplotlib、openpyxl、math、re、datetime、typing、collections。\n"
        "2) 禁止任何网络访问、子进程、系统命令。\n"
        "3) 禁止导入：os、sys、subprocess、socket、pathlib、json。\n"
        "4) 只允许读取 input_path 指向的文件；只允许在 output_dir 目录下写文件（output_dir 已存在，无需创建）。\n"
        "4.1) 必须从 input_path 读取“全量数据”进行分析；元信息/样本行仅用于理解结构，不能只基于样本得出结论。\n"
        "5) 必须定义函数：analyze(input_path: str, output_dir: str) -> dict。\n"
        "6) 必须保存至少 1 张图表 PNG（例如 chart_01.png），并在返回 dict 中列出 charts 数组。\n"
        "7) 返回 dict 必须可 JSON 序列化（numpy 类型请转为 python 基础类型）。\n"
        "8) 保存图表示例：plt.savefig(f\"{output_dir}/chart_01.png\", dpi=120, bbox_inches=\"tight\")。\n\n"
        "推荐输出 schema（示例）：\n"
        "{\n"
        '  "overview": { "rows": 1000, "columns": 12, "notes": ["..."] },\n'
        '  "anomalies": [{ "type": "outlier", "column": "revenue", "count": 12, "details": "..." }],\n'
        '  "insights": ["..."],\n'
        '  "charts": [{ "file": "chart_01.png", "title": "收入趋势", "kind": "line" }]\n'
        "}\n\n"
        "输出格式：只输出一段可运行的 Python 代码，并用 ```python 代码块包裹；不要输出 JSON、不要输出解释文字。\n\n"
        f"数据元信息（表头/类型/缺失率/数值概览/样本行）：\n{json.dumps(meta_obj, ensure_ascii=False)}\n\n"
        f"用户需求：\n{user_prompt}\n"
    )


async def generate_analytics_code(
    *,
    client: DeepSeekClient,
    model: str,
    temperature: float,
    metadata: DatasetMetadata,
    user_prompt: str,
) -> CodegenResult:
    prompt = build_analytics_prompt(metadata, user_prompt)
    resp = await client.chat_completions(
        model=model,
        temperature=temperature,
        stream=False,
        messages=[
            DeepSeekChatMessage(role="system", content="You are a helpful assistant."),
            DeepSeekChatMessage(role="user", content=prompt),
        ],
    )
    content = resp.get("choices", [{}])[0].get("message", {}).get("content", "")
    python_code, notes = _extract_python_code(str(content))
    if not python_code:
        raise ValueError("LLM returned empty python_code.")
    return CodegenResult(python_code=python_code, notes=notes, llm_model=model, raw=resp)


def _extract_stream_delta(event: dict[str, Any]) -> str:
    choices = event.get("choices") or []
    if not choices:
        return ""
    choice0 = choices[0] or {}
    delta = choice0.get("delta") or {}
    if isinstance(delta, dict) and isinstance(delta.get("content"), str):
        return str(delta.get("content") or "")
    # Some providers might return message in stream chunks
    msg = choice0.get("message") or {}
    if isinstance(msg, dict) and isinstance(msg.get("content"), str):
        return str(msg.get("content") or "")
    return ""


async def generate_analytics_code_stream(
    *,
    client: DeepSeekClient,
    model: str,
    temperature: float,
    metadata: DatasetMetadata,
    user_prompt: str,
    on_update: Optional[Callable[[str], Awaitable[None]]] = None,
    update_interval_seconds: float = 0.4,
) -> CodegenResult:
    prompt = build_analytics_prompt(metadata, user_prompt)
    parts: list[str] = []
    last_emit = 0.0

    async for event in client.chat_completions_stream(
        model=model,
        temperature=temperature,
        messages=[
            DeepSeekChatMessage(role="system", content="You are a helpful assistant."),
            DeepSeekChatMessage(role="user", content=prompt),
        ],
    ):
        delta = _extract_stream_delta(event)
        if not delta:
            continue
        parts.append(delta)

        if on_update:
            now = time.monotonic()
            if now - last_emit >= update_interval_seconds:
                last_emit = now
                await on_update("".join(parts))

    content = "".join(parts)
    if on_update:
        await on_update(content)

    python_code, notes = _extract_python_code(str(content))
    if not python_code:
        raise ValueError("LLM returned empty python_code.")
    return CodegenResult(
        python_code=python_code,
        notes=notes,
        llm_model=model,
        raw={"stream": True},
    )
