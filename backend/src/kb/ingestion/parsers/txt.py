from __future__ import annotations

import re
from typing import ClassVar

from kb.core.text import normalize_text
from kb.ingestion.parsers.base import Block, ParsedDocument, title_from_filename


class TextParser:
    mime_types: ClassVar[set[str]] = {"text/plain"}

    def parse(self, data: bytes, filename: str) -> ParsedDocument:
        text = data.decode("utf-8", errors="replace")
        paragraphs = [normalize_text(p) for p in re.split(r"\n\s*\n", text)]
        blocks = [Block(kind="paragraph", text=p) for p in paragraphs if p]
        return ParsedDocument(title=title_from_filename(filename), blocks=blocks)
