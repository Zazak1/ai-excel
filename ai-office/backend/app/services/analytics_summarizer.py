from __future__ import annotations

import json
from typing import Any, Optional

from ..core.dataclass_compat import frozen_dataclass
from .deepseek_client import DeepSeekChatMessage, DeepSeekClient


@frozen_dataclass
class AnalyticsLlmSummary:
    text: str
    highlights: list[str]
    anomalies: list[dict[str, Any]]
    suggestions: list[str]
    raw: dict[str, Any]


def _safe_json_dumps(obj: Any, *, max_chars: int = 12000) -> str:
    text = json.dumps(obj, ensure_ascii=False, default=str)
    if len(text) > max_chars:
        return text[:max_chars] + "...(truncated)"
    return text


def build_analytics_summary_prompt(*, analysis: dict[str, Any], user_prompt: str) -> str:
    return (
        "你是一个数据分析师。下面给你一份 Python 从“表格全量数据”计算得到的结构化分析结果。\n"
        "请你根据这些结果，输出一份中文摘要，用于前端展示。\n\n"
        "要求：\n"
        "1) 这份摘要必须是“对表格内容的摘要”：数据规模、字段/指标概览、时间范围/分组范围、缺失/重复情况、主要分布或波动、异常点。\n"
        "2) 以业务可读的语言总结：核心结论、趋势、异常点、可能原因、建议。\n"
        "3) 不要编造不存在的字段/数值；只引用结果中出现的数值或明确说明不确定。\n"
        "4) 输出必须是 JSON（不要 markdown），格式如下：\n"
        '{\n'
        '  "text": "一段 3-8 句话的摘要",\n'
        '  "highlights": ["要点1", "要点2"],\n'
        '  "anomalies": [{"type": "...", "column": "...", "details": "..."}],\n'
        '  "suggestions": ["建议1", "建议2"]\n'
        "}\n\n"
        f"用户需求：{user_prompt}\n\n"
        f"结构化分析结果：{_safe_json_dumps(analysis)}\n"
    )


def _extract_json_object(text: str) -> dict[str, Any]:
    t = (text or "").strip()
    if t.startswith("{") and t.endswith("}"):
        return json.loads(t)
    # tolerate fenced json
    if t.startswith("```"):
        lines = t.splitlines()
        if lines and lines[0].lstrip().startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        t = "\n".join(lines).strip()
        if t.startswith("{") and t.endswith("}"):
            return json.loads(t)
    # try decoding embedded JSON object
    decoder = json.JSONDecoder()
    first = t.find("{")
    if first != -1:
        obj, _ = decoder.raw_decode(t[first:])
        if isinstance(obj, dict):
            return obj
    raise ValueError("LLM did not return JSON object.")


async def summarize_analytics_result(
    *,
    client: DeepSeekClient,
    model: str,
    temperature: float,
    analysis: dict[str, Any],
    user_prompt: str,
) -> AnalyticsLlmSummary:
    prompt = build_analytics_summary_prompt(analysis=analysis, user_prompt=user_prompt)
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
    obj = _extract_json_object(str(content))
    text = str(obj.get("text") or "").strip()
    highlights = obj.get("highlights") if isinstance(obj.get("highlights"), list) else []
    anomalies = obj.get("anomalies") if isinstance(obj.get("anomalies"), list) else []
    suggestions = obj.get("suggestions") if isinstance(obj.get("suggestions"), list) else []
    return AnalyticsLlmSummary(
        text=text,
        highlights=[str(x) for x in highlights][:12],
        anomalies=[x for x in anomalies][:20],
        suggestions=[str(x) for x in suggestions][:12],
        raw=resp,
    )
