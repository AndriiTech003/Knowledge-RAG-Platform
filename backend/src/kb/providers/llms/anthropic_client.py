from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

import anthropic

from kb.providers.llms.base import LlmChunk, LlmMessage, LlmResult, LlmUnavailableError, LlmUsage, collect


class AnthropicLlm:
    def __init__(
        self,
        model: str,
        api_key: str | None,
        base_url: str | None = None,
        timeout: float = 60.0,
        effort: str | None = "low",
    ) -> None:
        self.model = model
        self.effort = effort
        self.client = anthropic.AsyncAnthropic(
            api_key=api_key, base_url=base_url, timeout=timeout, max_retries=2
        )

    async def stream(
        self, system: str, messages: list[LlmMessage], max_tokens: int
    ) -> AsyncIterator[LlmChunk]:
        payload: list[Any] = [{"role": m.role, "content": m.content} for m in messages]
        extra: dict[str, Any] = {}
        if self.effort and self.model.startswith(("claude-opus-5", "claude-sonnet-5", "claude-fable")):
            extra["output_config"] = {"effort": self.effort}
        try:
            async with self.client.messages.stream(
                model=self.model, system=system, messages=payload, max_tokens=max_tokens, **extra
            ) as stream:
                async for text in stream.text_stream:
                    yield LlmChunk(text=text)
                final = await stream.get_final_message()
                if final.stop_reason == "refusal":
                    raise LlmUnavailableError("refusal")
                yield LlmChunk(
                    usage=LlmUsage(
                        input_tokens=final.usage.input_tokens, output_tokens=final.usage.output_tokens
                    )
                )
        except anthropic.APIConnectionError as exc:
            raise LlmUnavailableError(str(exc)) from exc
        except anthropic.RateLimitError as exc:
            raise LlmUnavailableError("rate_limited") from exc
        except anthropic.APIStatusError as exc:
            raise LlmUnavailableError(f"status {exc.status_code}") from exc

    async def complete(self, system: str, messages: list[LlmMessage], max_tokens: int) -> LlmResult:
        return await collect(self.stream(system, messages, max_tokens))
