from __future__ import annotations

import re
from dataclasses import dataclass, field

from kb.core.text import URL_RE, content_terms, split_sentences

CITATION_RE = re.compile(r"\[(\d+(?:\s*,\s*\d+)*)\]")
INJECTION_PATTERNS = [
    re.compile(
        r"\bignore (?:all |any |the )?(?:previous|prior|above|earlier) (?:instructions|prompts|rules)", re.I
    ),
    re.compile(r"\bdisregard (?:all |any |the )?(?:previous|prior|above|system) ", re.I),
    re.compile(
        r"\b(?:system|admin(?:istrator)?) (?:notice|override|message) to (?:ai|assistants?|the assistant)",
        re.I,
    ),
    re.compile(r"\byou are now\b", re.I),
    re.compile(r"\breply only with\b", re.I),
    re.compile(r"\bre-?enter (?:your |their )?(?:bank|banking|password|credentials|card)", re.I),
]
SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")
PAYLOAD_RE = re.compile(r"\b[A-Z]{2,}(?:\s+[A-Z]{2,})+\b")


def is_suspicious(text: str) -> bool:
    return any(p.search(text) for p in INJECTION_PATTERNS)


@dataclass
class InjectionProfile:
    sentences: list[set[str]]
    payloads: set[str]
    safe_text: str


def injection_profile(sources: list[str]) -> InjectionProfile:
    suspicious: list[str] = []
    safe: list[str] = []
    for source in sources:
        for sentence in split_sentences(source):
            (suspicious if is_suspicious(sentence) else safe).append(sentence)
    payloads = {p for sentence in suspicious for p in PAYLOAD_RE.findall(sentence)}
    safe_text = " ".join(safe)
    return InjectionProfile(
        sentences=[set(content_terms(x)) for x in suspicious],
        payloads={p for p in payloads if p not in safe_text},
        safe_text=safe_text,
    )


def echoes_injection(sentence: str, profile: InjectionProfile) -> bool:
    if is_suspicious(sentence):
        return True
    if any(p in sentence for p in profile.payloads):
        return True
    terms = set(content_terms(CITATION_RE.sub("", sentence)))
    if len(terms) < 3:
        return False
    safe_terms = set(content_terms(profile.safe_text))
    for suspicious in profile.sentences:
        overlap = terms & suspicious
        if len(overlap) / len(terms) >= 0.6 and len(overlap - safe_terms) >= 2:
            return True
    return False


@dataclass
class GuardrailResult:
    text: str
    cited: list[int]
    warnings: list[str] = field(default_factory=list)
    uncited_claims: list[str] = field(default_factory=list)
    retry: bool = False


def _clean_spaces(text: str) -> str:
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" +([.,;:])", r"\1", text)
    return text.strip()


def apply_guardrails(answer: str, sources: list[str]) -> GuardrailResult:
    warnings: list[str] = []
    valid = set(range(1, len(sources) + 1))
    source_text = "\n".join(sources)
    suspicious_urls = {u.rstrip(".,") for s in sources if is_suspicious(s) for u in URL_RE.findall(s)}

    def fix_citation(match: re.Match[str]) -> str:
        numbers = [int(x) for x in re.split(r"\s*,\s*", match.group(1))]
        kept = [n for n in numbers if n in valid]
        if len(kept) != len(numbers) and "invalid_citation" not in warnings:
            warnings.append("invalid_citation")
        return "".join(f"[{n}]" for n in kept)

    text = CITATION_RE.sub(fix_citation, answer)

    profile = injection_profile(sources)
    kept_sentences: list[str] = []
    removed_suspicious = False
    for paragraph in text.split("\n"):
        parts = SENTENCE_SPLIT_RE.split(paragraph)
        safe = [p for p in parts if not echoes_injection(p, profile)]
        if len(safe) != len(parts):
            removed_suspicious = True
        kept_sentences.append(" ".join(safe))
    text = "\n".join(kept_sentences)
    if removed_suspicious:
        warnings.append("suspicious_content_removed")

    def fix_url(match: re.Match[str]) -> str:
        url = match.group(0).rstrip(".,")
        tail = match.group(0)[len(url) :]
        if url in suspicious_urls or url not in source_text:
            if "removed_url" not in warnings:
                warnings.append("removed_url")
            return tail
        return match.group(0)

    text = URL_RE.sub(fix_url, text)
    text = _clean_spaces(text)

    uncited: list[str] = []
    for sentence in SENTENCE_SPLIT_RE.split(text.replace("\n", " ")):
        stripped = sentence.strip()
        if stripped and re.search(r"\d", CITATION_RE.sub("", stripped)) and not CITATION_RE.search(stripped):
            uncited.append(stripped)
    if uncited:
        warnings.append("uncited_claim")
    cited = sorted({int(n) for group in CITATION_RE.findall(text) for n in re.split(r"\s*,\s*", group)})
    retry = len(re.findall(r"\w+", text)) < 3
    return GuardrailResult(text=text, cited=cited, warnings=warnings, uncited_claims=uncited, retry=retry)
