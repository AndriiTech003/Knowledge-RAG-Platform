from __future__ import annotations

import asyncio
import re
from collections.abc import AsyncIterator
from dataclasses import dataclass

from kb.core.text import content_terms, split_sentences
from kb.providers.llms.base import LlmChunk, LlmMessage, LlmResult, LlmUsage, collect

SOURCE_RE = re.compile(r'<source n="(\d+)"([^>]*)>(.*?)</source>', re.DOTALL)
QUESTION_RE = re.compile(r"^Question:\s*(.+)$", re.MULTILINE)
HISTORY_RE = re.compile(r"<history>(.*?)</history>", re.DOTALL)
FOLLOW_UP_RE = re.compile(r"^Follow-up question:\s*(.+)$", re.MULTILINE)
FOLLOW_UP_PREFIX_RE = re.compile(r"^(and|what about|how about|and what about|also|ok,?|so)\s+", re.IGNORECASE)
PRONOUNS = frozenset({"it", "that", "this", "those", "they", "them", "there", "its", "these", "he", "she"})


def approx_tokens(text: str) -> int:
    return max(1, round(len(text) / 4))


@dataclass
class FakeSource:
    n: int
    text: str


def parse_sources(prompt: str) -> list[FakeSource]:
    return [FakeSource(int(m.group(1)), m.group(3).strip()) for m in SOURCE_RE.finditer(prompt)]


def readable(sentence: str) -> str:
    stripped = sentence.strip()
    if stripped.startswith("|") and stripped.endswith("|"):
        cells = [c.strip() for c in stripped.strip("|").split("|")]
        cells = [c for c in cells if c and not set(c) <= set("-: ")]
        return ", ".join(cells)
    return stripped.lstrip("-*# ").strip()


def best_sentences(question: str, sources: list[FakeSource], limit: int = 3) -> list[tuple[float, int, str]]:
    q_terms = set(content_terms(question))
    picks: list[tuple[float, int, str]] = []
    for source in sources:
        best: tuple[float, str] | None = None
        for sentence in split_sentences(source.text):
            terms = content_terms(sentence)
            if not terms or not q_terms:
                continue
            overlap = len(q_terms & set(terms)) / len(q_terms)
            has_number = 0.05 if re.search(r"\d", sentence) else 0.0
            score = overlap + has_number
            if best is None or score > best[0]:
                best = (score, sentence)
        if best is not None and best[0] >= 0.2:
            picks.append((best[0], source.n, readable(best[1])))
    picks.sort(key=lambda p: (-p[0], p[1]))
    return picks[:limit]


def fake_answer(prompt: str) -> str:
    sources = parse_sources(prompt)
    match = QUESTION_RE.search(prompt)
    question = match.group(1).strip() if match else prompt[-500:]
    picks = best_sentences(question, sources)
    if not picks:
        return "I could not find this information in the provided sources."
    parts = []
    for _score, n, sentence in picks:
        text = sentence.rstrip(".")
        parts.append(f"{text} [{n}].")
    return "According to the sources: " + " ".join(parts)


def fake_condense(prompt: str) -> str:
    follow = FOLLOW_UP_RE.search(prompt)
    history = HISTORY_RE.search(prompt)
    question = follow.group(1).strip() if follow else prompt.strip()
    if not history:
        return question
    previous = ""
    for line in history.group(1).strip().splitlines():
        if line.lower().startswith("user:"):
            previous = line.split(":", 1)[1].strip()
    words = re.findall(r"[A-Za-z']+", question.lower())
    standalone = len(content_terms(question)) >= 5 and not (set(words) & PRONOUNS)
    if standalone or not previous:
        return question
    core = FOLLOW_UP_PREFIX_RE.sub("", question).rstrip("?").strip()
    new_entities = set(re.findall(r"\b[A-Z][\w-]*\b", core))
    kept: list[str] = []
    for index, word in enumerate(previous.rstrip("?").split()):
        bare = word.strip(",.;:")
        if index > 0 and bare[:1].isupper() and new_entities and bare not in new_entities:
            continue
        kept.append(word)
    base = " ".join(kept)
    base = re.sub(r"\b(in|for|at|of) the$", "", base).strip()
    base = re.sub(r"\b(in|for|at|of)$", "", base).strip()
    return f"{base} - {core}?"


class FakeLlm:
    def __init__(self, model: str = "fake-llm", delay_ms: int = 0, script: str | None = None) -> None:
        self.model = model
        self.delay = delay_ms / 1000.0
        self.script = script

    def respond(self, system: str, messages: list[LlmMessage]) -> str:
        if self.script is not None:
            return self.script
        prompt = messages[-1].content if messages else ""
        if "<history>" in prompt or "Follow-up question:" in prompt:
            return fake_condense(prompt)
        if "<sources>" in prompt:
            return fake_answer(prompt)
        return "OK"

    async def stream(
        self, system: str, messages: list[LlmMessage], max_tokens: int
    ) -> AsyncIterator[LlmChunk]:
        text = self.respond(system, messages)
        pieces = re.findall(r"\S+\s*", text)
        emitted = 0
        for piece in pieces:
            if emitted >= max_tokens:
                break
            if self.delay:
                await asyncio.sleep(self.delay)
            emitted += approx_tokens(piece)
            yield LlmChunk(text=piece)
        prompt_text = system + "".join(m.content for m in messages)
        yield LlmChunk(
            usage=LlmUsage(input_tokens=approx_tokens(prompt_text), output_tokens=approx_tokens(text))
        )

    async def complete(self, system: str, messages: list[LlmMessage], max_tokens: int) -> LlmResult:
        return await collect(self.stream(system, messages, max_tokens))
