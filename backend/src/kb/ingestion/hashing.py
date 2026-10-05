from __future__ import annotations

import hashlib

from kb.ingestion.parsers.base import ParsedDocument


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def document_hash(doc: ParsedDocument) -> str:
    parts = [doc.title]
    for block in doc.blocks:
        parts.append(f"{block.kind}:{block.level}:{block.page}:{block.text}")
    return sha256_text("\n".join(parts))
