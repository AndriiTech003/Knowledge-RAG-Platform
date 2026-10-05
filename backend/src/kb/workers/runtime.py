from __future__ import annotations

import asyncio
from collections.abc import Coroutine
from typing import Any

from kb.config import get_settings
from kb.core.container import Container, build_container
from kb.ingestion.pipeline import IngestionPipeline

_state: dict[str, Any] = {}


def loop() -> asyncio.AbstractEventLoop:
    current = _state.get("loop")
    if current is None or current.is_closed():
        current = asyncio.new_event_loop()
        asyncio.set_event_loop(current)
        _state["loop"] = current
    assert isinstance(current, asyncio.AbstractEventLoop)
    return current


def container() -> Container:
    existing = _state.get("container")
    if existing is None:
        existing = build_container(get_settings())
        _state["container"] = existing
    assert isinstance(existing, Container)
    return existing


def pipeline() -> IngestionPipeline:
    c = container()
    p = IngestionPipeline(c.sessions, c.storage, c.embedder_for, c.token_counter(), c.events, c.settings)
    p.debug_delay_ms = int(_state.get("debug_delay_ms", 0))
    return p


def run[T](coro: Coroutine[Any, Any, T]) -> T:
    return loop().run_until_complete(coro)


def reset() -> None:
    existing = _state.pop("container", None)
    current = _state.get("loop")
    if existing is not None and current is not None and not current.is_closed():
        current.run_until_complete(existing.aclose())


def set_debug_delay(ms: int) -> None:
    _state["debug_delay_ms"] = ms
