from __future__ import annotations

from kb.config import Settings
from kb.providers.llms.anthropic_client import AnthropicLlm
from kb.providers.llms.base import LlmChunk, LlmClient, LlmMessage, LlmResult, LlmUnavailableError, LlmUsage
from kb.providers.llms.fake import FakeLlm
from kb.providers.llms.openai_client import OpenAiCompatibleLlm

DEFAULT_MODELS = {
    "anthropic": ("claude-opus-5-5", "claude-haiku-4-5", "claude-fable-5-1"),
    "openai": ("gpt-4o", "gpt-4o-mini", "gpt-4o"),
}


def _resolve(provider: str, model: str, slot: int) -> str:
    if model.startswith("fake") and provider in DEFAULT_MODELS:
        return DEFAULT_MODELS[provider][slot]
    return model


def build_llm(
    settings: Settings, model: str | None = None, provider: str | None = None, slot: int = 0
) -> LlmClient:
    kind = provider or settings.llm_provider
    name = _resolve(kind, model or settings.llm_model, slot)
    if kind == "anthropic":
        return AnthropicLlm(
            name,
            settings.anthropic_api_key,
            settings.llm_base_url,
            settings.llm_timeout_seconds,
            settings.llm_effort,
        )
    if kind == "openai":
        return OpenAiCompatibleLlm(
            name, settings.openai_api_key, settings.llm_base_url, settings.llm_timeout_seconds
        )
    return FakeLlm(name, settings.fake_llm_delay_ms)


def build_condense_llm(settings: Settings) -> LlmClient:
    return build_llm(settings, settings.llm_condense_model, slot=1)


__all__ = [
    "AnthropicLlm",
    "FakeLlm",
    "LlmChunk",
    "LlmClient",
    "LlmMessage",
    "LlmResult",
    "LlmUnavailableError",
    "LlmUsage",
    "OpenAiCompatibleLlm",
    "build_condense_llm",
    "build_llm",
]
