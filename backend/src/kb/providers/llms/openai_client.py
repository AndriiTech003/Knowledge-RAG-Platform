from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

import openai

from kb.providers.llms.base import LlmChunk, LlmMessage, LlmResult, LlmUnavailableError, LlmUsage, collect


class OpenAiCompatibleLlm:
    def __init__(
        self, model: str, api_key: str | None, base_url: str | None = None, timeout: float = 60.0
    ) -> None:
        self.model = model
        self.client = openai.AsyncOpenAI(api_key=api_key or "not-set", base_url=base_url, timeout=timeout)

    async def stream(
        self, system: str, messages: list[LlmMessage], max_tokens: int
    ) -> AsyncIterator[LlmChunk]:
        payload: list[Any] = [{"role": "system", "content": system}]
        payload.extend({"role": m.role, "content": m.content} for m in messages)
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=payload,
                max_tokens=max_tokens,
                stream=True,
                stream_options={"include_usage": True},
            )
            try:
                async for event in response:
                    for choice in event.choices:
                        if choice.delta and choice.delta.content:
                            yield LlmChunk(text=choice.delta.content)
                    if event.usage is not None:
                        yield LlmChunk(
                            usage=LlmUsage(
                                input_tokens=event.usage.prompt_tokens,
                                output_tokens=event.usage.completion_tokens,
                            )
                        )
            finally:
                await response.close()
        except openai.APIConnectionError as exc:
            raise LlmUnavailableError(str(exc)) from exc
        except openai.APIStatusError as exc:
            raise LlmUnavailableError(f"status {exc.status_code}") from exc

    async def complete(self, system: str, messages: list[LlmMessage], max_tokens: int) -> LlmResult:
        return await collect(self.stream(system, messages, max_tokens))
