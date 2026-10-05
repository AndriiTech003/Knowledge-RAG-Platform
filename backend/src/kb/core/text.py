from __future__ import annotations

import re
import unicodedata

WORD_RE = re.compile(r"[a-z0-9]+(?:[.\-/][a-z0-9]+)*")
SENTENCE_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(\[])")
URL_RE = re.compile(r"https?://[^\s<>\"')\]]+", re.IGNORECASE)

STOPWORDS = frozenset(
    [
        "a",
        "an",
        "the",
        "and",
        "or",
        "but",
        "if",
        "then",
        "else",
        "of",
        "to",
        "in",
        "on",
        "at",
        "by",
        "for",
        "with",
        "from",
        "into",
        "onto",
        "about",
        "as",
        "is",
        "are",
        "was",
        "were",
        "be",
        "been",
        "being",
        "do",
        "does",
        "did",
        "doing",
        "have",
        "has",
        "had",
        "having",
        "i",
        "me",
        "my",
        "we",
        "our",
        "you",
        "your",
        "he",
        "she",
        "it",
        "its",
        "they",
        "them",
        "their",
        "this",
        "that",
        "these",
        "those",
        "what",
        "which",
        "who",
        "whom",
        "whose",
        "when",
        "where",
        "why",
        "how",
        "all",
        "any",
        "both",
        "each",
        "few",
        "more",
        "most",
        "other",
        "some",
        "such",
        "no",
        "nor",
        "not",
        "only",
        "own",
        "same",
        "so",
        "than",
        "too",
        "very",
        "can",
        "will",
        "just",
        "should",
        "would",
        "could",
        "may",
        "might",
        "must",
        "shall",
        "s",
        "t",
        "don",
        "now",
        "also",
        "per",
        "there",
        "here",
        "up",
        "down",
        "out",
        "over",
        "under",
        "again",
        "further",
        "once",
        "us",
        "via",
        "vs",
        "get",
        "got",
        "please",
        "tell",
        "know",
    ]
)


def normalize_text(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("­", "")
    text = re.sub(r"[\u0000-\u0008\u000b\u000c\u000e-\u001f]", " ", text)
    text = re.sub(r"[ \t ]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def tokens(text: str) -> list[str]:
    return WORD_RE.findall(text.lower())


def stem(token: str) -> str:
    for suffix in ("ies", "es", "s"):
        if len(token) > 4 and token.endswith(suffix) and not token.endswith("ss"):
            return token[: -len(suffix)] + ("y" if suffix == "ies" else "")
    return token


def content_terms(text: str) -> list[str]:
    return [stem(t) for t in tokens(text) if t not in STOPWORDS]


def split_sentences(text: str) -> list[str]:
    parts: list[str] = []
    for raw in text.split("\n"):
        paragraph = raw.strip()
        if not paragraph:
            continue
        parts.extend(s.strip() for s in SENTENCE_RE.split(paragraph) if s.strip())
    return parts
