from __future__ import annotations

import io
import re
from typing import Any, ClassVar

from docx import Document as load_docx
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph

from kb.core.text import normalize_text
from kb.ingestion.parsers.base import Block, ParsedDocument, ParseError, title_from_filename

HEADING_RE = re.compile(r"^Heading\s*(\d)$", re.IGNORECASE)


def _table_markdown(table: Table) -> str:
    rows: list[list[str]] = []
    for row in table.rows:
        cells: list[str] = []
        for cell in row.cells:
            cells.append(normalize_text(cell.text).replace("\n", " ").replace("|", "/"))
        rows.append(cells)
    if not rows:
        return ""
    width = max(len(r) for r in rows)
    rows = [r + [""] * (width - len(r)) for r in rows]
    lines = ["| " + " | ".join(rows[0]) + " |", "|" + "|".join("---" for _ in range(width)) + "|"]
    lines.extend("| " + " | ".join(r) + " |" for r in rows[1:])
    return "\n".join(lines)


class DocxParser:
    mime_types: ClassVar[set[str]] = {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    }

    def parse(self, data: bytes, filename: str) -> ParsedDocument:
        try:
            document: Any = load_docx(io.BytesIO(data))
        except Exception as exc:
            raise ParseError("corrupt_docx", str(exc)) from exc
        blocks: list[Block] = []
        list_buffer: list[str] = []

        def flush_list() -> None:
            if list_buffer:
                blocks.append(Block(kind="list", text="\n".join(list_buffer)))
                list_buffer.clear()

        for element in document.element.body.iterchildren():
            if element.tag == qn("w:p"):
                paragraph = Paragraph(element, document)
                text = normalize_text(paragraph.text)
                if not text:
                    continue
                style = paragraph.style.name if paragraph.style is not None else ""
                match = HEADING_RE.match(style or "")
                if style == "Title" or match:
                    flush_list()
                    level = 1 if style == "Title" else int(match.group(1)) if match else 1
                    blocks.append(Block(kind="heading", text=text, level=min(level, 6)))
                elif (style or "").startswith("List"):
                    list_buffer.append("- " + text)
                else:
                    flush_list()
                    blocks.append(Block(kind="paragraph", text=text))
            elif element.tag == qn("w:tbl"):
                flush_list()
                markdown = _table_markdown(Table(element, document))
                if markdown:
                    blocks.append(Block(kind="table", text=markdown))
        flush_list()
        props = document.core_properties
        title = (props.title or "").strip()
        if not title:
            title = next((b.text for b in blocks if b.kind == "heading"), "") or title_from_filename(filename)
        metadata = {"author": props.author} if props.author else {}
        return ParsedDocument(title=title, blocks=blocks, metadata=metadata)
