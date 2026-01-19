from __future__ import annotations

import json
import re
from typing import Any, Optional

from ..core.dataclass_compat import frozen_dataclass
from .deepseek_client import DeepSeekChatMessage, DeepSeekClient
from .excel_metadata import WorkbookMetadata


@frozen_dataclass
class CodegenResult:
    python_code: str
    notes: Optional[str]
    llm_model: str
    raw: dict[str, Any]


_JSON_FENCE_RE = re.compile(r"```(?:json)?\\s*(\\{.*?\\})\\s*```", re.DOTALL)
_PY_FENCE_RE = re.compile(r"```(?:python)?\\s*(.*?)\\s*```", re.DOTALL)


def _sanitize_python_code(code: str) -> str:
    text = code.strip()
    if text.startswith("```"):
        m = _PY_FENCE_RE.search(text)
        if m:
            text = m.group(1).strip()
        else:
            lines = text.splitlines()
            if lines and lines[0].lstrip().startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            text = "\n".join(lines).strip()
    if text.lower().startswith("python\n"):
        text = text.split("\n", 1)[1].lstrip()
    return text.strip()


def _extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("{") and text.endswith("}"):
        return json.loads(text)
    match = _JSON_FENCE_RE.search(text)
    if match:
        return json.loads(match.group(1))

    # Try decoding a JSON object embedded in other text (preamble/trailing markdown).
    decoder = json.JSONDecoder()
    first_brace = text.find("{")
    if first_brace != -1:
        try:
            obj, _ = decoder.raw_decode(text[first_brace:])
            if isinstance(obj, dict):
                return obj
        except Exception:
            pass

    # Fallback: if the model returned python code in a fence, adapt it.
    py = _PY_FENCE_RE.search(text)
    if py:
        return {
            "python_code": _sanitize_python_code(py.group(1)),
            "notes": "extracted from code fence (non-JSON model output)",
        }

    # Last resort: treat the whole content as python code if it looks like code.
    if "def transform" in text and "import" in text:
        return {"python_code": _sanitize_python_code(text), "notes": "used raw content as python_code (non-JSON model output)"}

    raise ValueError("LLM did not return valid JSON.")


def build_excel_codegen_prompt(metadata: WorkbookMetadata, user_prompt: str) -> str:
    meta_obj = {
        "filename": metadata.filename,
        "sheets": [
            {
                "name": s.name,
                "columns": s.columns,
                "dtypes": s.dtypes,
                "sample_rows": s.sample_rows,
            }
            for s in metadata.sheets
        ],
    }
    return (
        "你是一个后端 Excel 数据处理代码生成器。\n"
        "目标：根据用户需求，输出一段可执行的 Python 代码来处理上传的 Excel 文件。\n\n"
        "强约束（必须遵守）：\n"
        "1) 只能使用：pandas、numpy、openpyxl、math、re、datetime、typing、collections。\n"
        "2) 禁止任何网络访问、子进程、系统命令、任意文件读写。\n"
        "3) 只允许读取 input_path 指向的文件；只允许写 output_path 指向的文件。\n"
        "4) 必须定义函数：transform(input_path: str, output_path: str) -> dict。\n"
        "5) transform 必须将处理后的工作簿写到 output_path（xlsx）。\n"
        "6) transform 返回 dict 作为摘要（例如：sheet 数、行列变化、输出 sheet 名等）。\n"
        "7) 如需透视/跨表，请用 pandas 合并、pivot_table 生成结果表。\n"
        "8) 对“公式”需求：优先计算出结果值写入新列；如必须写 Excel 公式字符串，请明确写入位置，并在摘要说明。\n\n"
        "输出格式：仅输出 JSON（不要输出其他文字），schema 如下：\n"
        '{ "python_code": "<code>", "notes": "<optional>" }\n\n'
        f"工作簿元数据（表头/类型/样本行）：\n{json.dumps(meta_obj, ensure_ascii=False)}\n\n"
        f"用户需求：\n{user_prompt}\n"
    )


async def generate_excel_code(
    *,
    client: DeepSeekClient,
    model: str,
    temperature: float,
    metadata: WorkbookMetadata,
    user_prompt: str,
) -> CodegenResult:
    prompt = build_excel_codegen_prompt(metadata, user_prompt)
    resp = await client.chat_completions(
        model=model,
        temperature=temperature,
        stream=False,
        messages=[
            DeepSeekChatMessage(role="system", content="You are a helpful assistant."),
            DeepSeekChatMessage(role="user", content=prompt),
        ],
    )
    content = (
        resp.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
    )
    data = _extract_json(str(content))
    python_code = _sanitize_python_code(str(data.get("python_code", "")))
    if not python_code:
        raise ValueError("LLM returned empty python_code.")
    notes = data.get("notes")
    return CodegenResult(python_code=python_code, notes=str(notes) if notes else None, llm_model=model, raw=resp)
