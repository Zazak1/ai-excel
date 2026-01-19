from __future__ import annotations

import json
from urllib.parse import urlparse
from typing import Any, AsyncIterator, Optional

import httpx

from ..core.dataclass_compat import frozen_dataclass


@frozen_dataclass
class DeepSeekChatMessage:
    role: str
    content: str


class DeepSeekClient:
    def __init__(self, *, api_key: str, base_url: str, timeout_seconds: float) -> None:
        self._api_key = api_key
        self._base_url = self._normalize_base_url(base_url)
        self._timeout = timeout_seconds

    def _default_timeout(self) -> httpx.Timeout:
        # Favor a longer read timeout for large prompts / slow first-token.
        return httpx.Timeout(connect=10.0, read=self._timeout, write=30.0, pool=10.0)

    @staticmethod
    def _normalize_base_url(base_url: str) -> str:
        """
        DeepSeek OpenAI-compatible APIs are commonly served under `/v1`.
        Accept both `https://api.deepseek.com` and `https://api.deepseek.com/v1`.
        """
        candidate = (base_url or "").strip().rstrip("/")
        if not candidate:
            return "https://api.deepseek.com/v1"

        parsed = urlparse(candidate)
        if parsed.scheme in {"http", "https"} and parsed.netloc == "api.deepseek.com":
            if parsed.path in {"", "/"}:
                return f"{parsed.scheme}://{parsed.netloc}/v1"
        return candidate

    async def chat_completions(
        self,
        *,
        model: str,
        messages: list[DeepSeekChatMessage],
        temperature: float = 0,
        stream: bool = False,
        extra: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        url = f"{self._base_url}/chat/completions"
        payload: dict[str, Any] = {
            "model": model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "temperature": temperature,
            "stream": stream,
        }
        if extra:
            payload.update(extra)

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._api_key}",
        }

        async with httpx.AsyncClient(timeout=self._default_timeout()) as client:
            try:
                resp = await client.post(url, headers=headers, json=payload)
                resp.raise_for_status()
                return resp.json()
            except httpx.HTTPStatusError as exc:
                response = exc.response
                hint = ""
                if "api.deepseek.com" in str(response.url) and "/v1/" not in str(response.url):
                    hint = " (hint: set DEEPSEEK_BASE_URL=https://api.deepseek.com/v1)"
                detail = ""
                content_type = (response.headers.get("content-type") or "").lower()
                if "application/json" in content_type:
                    try:
                        data = response.json()
                        detail = str(data)
                    except Exception:
                        detail = (response.text or "").strip()
                else:
                    detail = (response.text or "").strip()

                detail = detail.strip()
                if len(detail) > 2000:
                    detail = detail[:2000] + "...(truncated)"
                raise RuntimeError(
                    f"DeepSeek API error: HTTP {response.status_code} for url {response.url}{hint}\n{detail}"
                ) from None
            except httpx.RequestError as exc:
                message = str(exc) or repr(exc)
                raise RuntimeError(f"DeepSeek request failed: {message}") from None

    async def chat_completions_stream(
        self,
        *,
        model: str,
        messages: list[DeepSeekChatMessage],
        temperature: float = 0,
        extra: Optional[dict[str, Any]] = None,
    ) -> AsyncIterator[dict[str, Any]]:
        url = f"{self._base_url}/chat/completions"
        payload: dict[str, Any] = {
            "model": model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "temperature": temperature,
            "stream": True,
        }
        if extra:
            payload.update(extra)

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._api_key}",
        }

        async with httpx.AsyncClient(timeout=self._default_timeout()) as client:
            try:
                async with client.stream("POST", url, headers=headers, json=payload) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        item = (line or "").strip()
                        if not item:
                            continue
                        if not item.startswith("data:"):
                            continue
                        data = item[len("data:") :].strip()
                        if not data or data == "[DONE]":
                            if data == "[DONE]":
                                break
                            continue
                        try:
                            yield json.loads(data)
                        except Exception:
                            continue
            except httpx.HTTPStatusError as exc:
                response = exc.response
                hint = ""
                if "api.deepseek.com" in str(response.url) and "/v1/" not in str(response.url):
                    hint = " (hint: set DEEPSEEK_BASE_URL=https://api.deepseek.com/v1)"
                detail = (response.text or "").strip()
                if len(detail) > 2000:
                    detail = detail[:2000] + "...(truncated)"
                raise RuntimeError(
                    f"DeepSeek API error: HTTP {response.status_code} for url {response.url}{hint}\n{detail}"
                ) from None
            except httpx.RequestError as exc:
                message = str(exc) or repr(exc)
                raise RuntimeError(f"DeepSeek request failed: {message}") from None
