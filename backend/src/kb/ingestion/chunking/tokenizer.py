from __future__ import annotations

import re
from functools import lru_cache
from typing import Protocol

PIECE_RE = re.compile(r"\w+|[^\w\s]", re.UNICODE)


class TokenCounter(Protocol):
    name: str

    def count(self, text: str) -> int: ...


class SimpleTokenCounter:
    name = "simple"

    def count(self, text: str) -> int:
        total = 0
        for piece in PIECE_RE.findall(text):
            total += max(1, (len(piece) + 5) // 6) if piece[0].isalnum() else 1
        return total


class HfTokenCounter:
    def __init__(self, model: str) -> None:
        from huggingface_hub import hf_hub_download
        from tokenizers import Tokenizer

        self.name = model
        try:
            path = hf_hub_download(model, "tokenizer.json", local_files_only=True)
        except Exception:
            path = hf_hub_download(model, "tokenizer.json")
        self.tokenizer = Tokenizer.from_file(path)
        self.tokenizer.no_truncation()

    def count(self, text: str) -> int:
        return len(self.tokenizer.encode(text, add_special_tokens=False).ids)


@lru_cache(maxsize=4)
def get_token_counter(kind: str, model: str) -> TokenCounter:
    if kind == "hf":
        try:
            return HfTokenCounter(model)
        except Exception:
            return SimpleTokenCounter()
    return SimpleTokenCounter()
