from __future__ import annotations

import json
import re
import time
from typing import Any, AsyncIterator, Awaitable, Callable, Optional

from ..core.dataclass_compat import frozen_dataclass
from .deepseek_client import DeepSeekChatMessage, DeepSeekClient


@frozen_dataclass
class ReportCodegenResult:
    markdown: str
    llm_model: str
    raw: dict[str, Any]


_MD_FENCE_RE = re.compile(r"```(?:markdown|md)?\\s*(.*?)\\s*```", re.DOTALL | re.IGNORECASE)


def _extract_markdown(text: str) -> str:
    content = (text or "").strip()
    m = _MD_FENCE_RE.search(content)
    if m:
        return m.group(1).strip()
    if content.startswith("```"):
        lines = content.splitlines()
        if lines and lines[0].lstrip().startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        return "\n".join(lines).strip()
    return content


def build_report_prompt(
    *,
    title: str,
    template: str,
    notes: str,
    user_prompt: str,
    analysis: dict[str, Any],
) -> str:
    template_outlines: dict[str, list[str]] = {
        "weekly": ["本周概览", "数据要点（含表格）", "异常与风险（含表格）", "结论与下周计划"],
        "monthly": ["月度概览", "关键指标（含表格）", "异常与归因（含表格）", "建议与下月目标"],
        "project": ["背景", "数据结论（含表格）", "问题与异常（含表格）", "经验与改进"],
    }
    outline = template_outlines.get(template, template_outlines["weekly"])
    outline_md = "\n".join([f"## {s}" for s in outline])

    return (
        "你是一个严谨的中文数据分析师与报告撰写专家。\n"
        "用户上传了一个或多个文件，其中包含表格数据。我们已经用 Python 从“全量表格内容”提取了结构化分析结果，并生成了图表文件。\n\n"
        "请你输出一份「深度报告」Markdown，用于前端展示与导出。\n\n"
        "强要求（必须遵守）：\n"
        "1) 报告必须是“对表格内容本身”的摘要与分析，不要写空泛模板话术。\n"
        "2) 必须包含至少 2 个 Markdown 表格（使用 | 分隔的表格语法）：\n"
        "   - 表1：数据概览/关键指标（行数、列数、时间范围、缺失率、重复行、关键数值统计等）\n"
        "   - 表2：异常/离群点清单（类型、字段、数量/范围、说明）\n"
        "3) 如果 analysis.charts 中有图片文件，必须在正文中插入图片引用：![](文件名.png)。\n"
        "4) 所有数字/结论必须来自结构化分析结果；若信息不足请说明“不确定/需补充字段”。\n"
        "5) 输出格式：只输出 Markdown 内容（可用 ```markdown 代码块包裹），不要输出 JSON。\n\n"
        f"# {title}\n\n"
        f"{outline_md}\n\n"
        f"补充说明（可为空）：{notes.strip() if notes.strip() else '（无）'}\n\n"
        f"用户额外需求：{user_prompt.strip() if user_prompt.strip() else '（无）'}\n\n"
        f"结构化分析结果（JSON，供你引用）：\n{json.dumps(analysis, ensure_ascii=False)[:24000]}\n"
    )


def _extract_stream_delta(event: dict[str, Any]) -> str:
    choices = event.get("choices") or []
    if not choices:
        return ""
    choice0 = choices[0] or {}
    delta = choice0.get("delta") or {}
    if isinstance(delta, dict) and isinstance(delta.get("content"), str):
        return str(delta.get("content") or "")
    msg = choice0.get("message") or {}
    if isinstance(msg, dict) and isinstance(msg.get("content"), str):
        return str(msg.get("content") or "")
    return ""


async def generate_report_markdown_stream(
    *,
    client: DeepSeekClient,
    model: str,
    temperature: float,
    title: str,
    template: str,
    notes: str,
    user_prompt: str,
    analysis: dict[str, Any],
    on_update: Optional[Callable[[str], Awaitable[None]]] = None,
    update_interval_seconds: float = 0.4,
) -> ReportCodegenResult:
    prompt = build_report_prompt(
        title=title, template=template, notes=notes, user_prompt=user_prompt, analysis=analysis
    )
    parts: list[str] = []
    last_emit = 0.0

    stream: AsyncIterator[dict[str, Any]] = client.chat_completions_stream(
        model=model,
        temperature=temperature,
        messages=[
            DeepSeekChatMessage(role="system", content="You are a helpful assistant."),
            DeepSeekChatMessage(role="user", content=prompt),
        ],
    )

    async for event in stream:
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
    md = _extract_markdown(content)
    if not md:
        raise ValueError("LLM returned empty markdown.")
    return ReportCodegenResult(markdown=md, llm_model=model, raw={"stream": True})

