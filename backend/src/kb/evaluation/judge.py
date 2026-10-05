from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Protocol

from kb.core.text import content_terms, normalize_text, split_sentences
from kb.generation.answerer import NO_ANSWER_TEXT
from kb.generation.prompts import load_prompt
from kb.providers.llms.base import LlmClient, LlmMessage

CITATION_RE = re.compile(r"\[\d+\]")
BOILERPLATE_RE = re.compile(r"^(according to the sources:?|based on the sources,?)\s*", re.I)


@dataclass
class Verdict:
    correctness: int
    faithfulness: float
    rationale: str


class Judge(Protocol):
    name: str

    async def judge(
        self, question: str, reference: str | None, key_facts: list[str], answer: str, sources: list[str]
    ) -> Verdict: ...


def _norm(text: str) -> str:
    return normalize_text(text).lower().replace("‑", "-")


def is_refusal(answer: str) -> bool:
    lowered = answer.lower()
    return answer.strip() == NO_ANSWER_TEXT or "could not find" in lowered or "couldn't find" in lowered


def claims_of(answer: str) -> list[str]:
    claims = []
    for sentence in split_sentences(answer):
        stripped = BOILERPLATE_RE.sub("", CITATION_RE.sub("", sentence)).strip(" .")
        if len(content_terms(stripped)) >= 2:
            claims.append(stripped)
    return claims


class FakeJudge:
    name = "fake-judge"

    async def judge(
        self, question: str, reference: str | None, key_facts: list[str], answer: str, sources: list[str]
    ) -> Verdict:
        normalized = _norm(answer)
        if is_refusal(answer):
            correctness = 1
            facts_found = 0
        else:
            facts_found = sum(1 for fact in key_facts if _norm(fact) in normalized)
            if key_facts:
                ratio = facts_found / len(key_facts)
                correctness = 5 if ratio == 1 else 4 if ratio >= 0.66 else 3 if ratio >= 0.33 else 2
            else:
                ref_terms = set(content_terms(reference or ""))
                overlap = len(ref_terms & set(content_terms(answer))) / len(ref_terms) if ref_terms else 0.0
                correctness = 5 if overlap >= 0.8 else 4 if overlap >= 0.6 else 3 if overlap >= 0.4 else 2
        claims = claims_of(answer) if not is_refusal(answer) else []
        source_terms = set(content_terms(" ".join(sources)))
        supported = 0
        for claim in claims:
            terms = content_terms(claim)
            if terms and sum(1 for t in terms if t in source_terms) / len(terms) >= 0.7:
                supported += 1
        faithfulness = supported / len(claims) if claims else 1.0
        rationale = f"{facts_found}/{len(key_facts)} key facts present; {supported}/{len(claims)} claims supported by cited sources"
        return Verdict(correctness=correctness, faithfulness=round(faithfulness, 4), rationale=rationale)


class LlmJudge:
    def __init__(self, llm: LlmClient, version: str = "v1") -> None:
        self.llm = llm
        self.name = f"llm-judge:{llm.model}"
        self.system = load_prompt("judge", version)

    async def judge(
        self, question: str, reference: str | None, key_facts: list[str], answer: str, sources: list[str]
    ) -> Verdict:
        numbered = "\n".join(f"[{i}] {s}" for i, s in enumerate(sources, start=1))
        user = (
            f"Question: {question}\nReference answer: {reference or '(none)'}\nKey facts: {', '.join(key_facts)}\n\n"
            f"Assistant answer:\n{answer}\n\nCited sources:\n{numbered or '(none)'}"
        )
        result = await self.llm.complete(self.system, [LlmMessage(role="user", content=user)], 600)
        match = re.search(r"\{.*\}", result.text, re.DOTALL)
        if not match:
            return Verdict(
                correctness=1, faithfulness=0.0, rationale=f"unparseable judge output: {result.text[:200]}"
            )
        data = json.loads(match.group(0))
        correctness = max(1, min(5, int(data.get("correctness", 1))))
        faithfulness = max(0.0, min(1.0, float(data.get("faithfulness", 0.0))))
        return Verdict(
            correctness=correctness, faithfulness=faithfulness, rationale=str(data.get("rationale", ""))
        )
