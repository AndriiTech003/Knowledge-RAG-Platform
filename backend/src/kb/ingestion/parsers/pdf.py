from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass
from typing import Any, ClassVar

import pymupdf

from kb.core.text import normalize_text
from kb.ingestion.parsers.base import Block, ParsedDocument, ParseError, title_from_filename

EDGE_RATIO = 0.12

pymupdf.no_recommend_layout()


@dataclass
class Line:
    page: int
    text: str
    size: float
    bold: bool
    y0: float
    y1: float
    block: int


def _signature(text: str) -> str:
    return re.sub(r"\d+", "#", text.strip().lower())


def _dehyphenate(lines: list[str]) -> str:
    out = ""
    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        if out.endswith("-") and line[:1].islower():
            out = out[:-1] + line
        elif out:
            out += " " + line
        else:
            out = line
    return out


def _inside(bbox: tuple[float, float, float, float], rects: list[Any]) -> bool:
    x0, y0, x1, y1 = bbox
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    return any(r.x0 - 1 <= cx <= r.x1 + 1 and r.y0 - 1 <= cy <= r.y1 + 1 for r in rects)


class PdfParser:
    mime_types: ClassVar[set[str]] = {"application/pdf"}

    def parse(self, data: bytes, filename: str) -> ParsedDocument:
        try:
            doc = pymupdf.open(stream=data, filetype="pdf")
        except Exception as exc:
            raise ParseError("corrupt_pdf", str(exc)) from exc
        try:
            return self._parse(doc, filename)
        finally:
            doc.close()

    def _parse(self, doc: Any, filename: str) -> ParsedDocument:
        page_count = int(doc.page_count)
        lines: list[Line] = []
        tables: dict[int, list[tuple[float, str]]] = {}
        table_rects: dict[int, list[Any]] = {}
        heights: dict[int, float] = {}
        total_chars = 0
        for page_index in range(page_count):
            page = doc[page_index]
            number = page_index + 1
            heights[number] = float(page.rect.height)
            found: list[Any] = []
            try:
                finder = page.find_tables()
                found = list(finder.tables)
            except Exception:
                found = []
            rects = []
            for table in found:
                markdown = str(table.to_markdown()).strip()
                if markdown.count("|") >= 4:
                    rects.append(pymupdf.Rect(table.bbox))
                    tables.setdefault(number, []).append((float(table.bbox[1]), markdown))
            table_rects[number] = rects
            raw = page.get_text("dict")
            for b_index, block in enumerate(raw.get("blocks", [])):
                if block.get("type") != 0:
                    continue
                for line in block.get("lines", []):
                    spans = [s for s in line.get("spans", []) if str(s.get("text", "")).strip()]
                    if not spans:
                        continue
                    text = "".join(str(s["text"]) for s in line["spans"])
                    bbox = tuple(float(v) for v in line["bbox"])
                    if _inside((bbox[0], bbox[1], bbox[2], bbox[3]), rects):
                        continue
                    size = max(float(s.get("size", 0)) for s in spans)
                    bold = all(
                        (int(s.get("flags", 0)) & 16) or "Bold" in str(s.get("font", "")) for s in spans
                    )
                    total_chars += len(text.strip())
                    lines.append(Line(number, text, round(size, 1), bool(bold), bbox[1], bbox[3], b_index))
        if total_chars < 20 * max(1, page_count) and not tables:
            raise ParseError("no_text_layer", "PDF has no extractable text layer (OCR is not supported)")
        lines = self._remove_running_lines(lines, page_count, heights)
        blocks = self._to_blocks(lines, tables)
        metadata = doc.metadata or {}
        title = str(metadata.get("title") or "").strip()
        if not title:
            heading = next((b.text for b in blocks if b.kind == "heading"), None)
            title = heading or title_from_filename(filename)
        meta = {k: str(v) for k, v in metadata.items() if v and k in {"author", "creationDate", "modDate"}}
        return ParsedDocument(title=title, blocks=blocks, page_count=page_count, metadata=meta)

    def _remove_running_lines(
        self, lines: list[Line], page_count: int, heights: dict[int, float]
    ) -> list[Line]:
        if page_count < 2:
            return lines
        pages_by_sig: dict[str, set[int]] = {}
        for line in lines:
            height = heights.get(line.page, 842.0)
            at_edge = line.y1 < height * EDGE_RATIO or line.y0 > height * (1 - EDGE_RATIO)
            if at_edge:
                pages_by_sig.setdefault(_signature(line.text), set()).add(line.page)
        running = {sig for sig, pages in pages_by_sig.items() if len(pages) > page_count / 2}
        result = []
        for line in lines:
            height = heights.get(line.page, 842.0)
            at_edge = line.y1 < height * EDGE_RATIO or line.y0 > height * (1 - EDGE_RATIO)
            if at_edge and _signature(line.text) in running:
                continue
            result.append(line)
        return result

    def _to_blocks(self, lines: list[Line], tables: dict[int, list[tuple[float, str]]]) -> list[Block]:
        if not lines and not tables:
            return []
        weights: Counter[float] = Counter()
        for line in lines:
            weights[line.size] += len(line.text)
        body = weights.most_common(1)[0][0] if weights else 10.0
        heading_sizes = sorted({line.size for line in lines if line.size >= body * 1.15}, reverse=True)
        level_of = {size: min(index + 1, 3) for index, size in enumerate(heading_sizes)}
        blocks: list[Block] = []
        pending: list[Line] = []
        pending_tables = {page: sorted(items) for page, items in tables.items()}

        def flush() -> None:
            if not pending:
                return
            text = normalize_text(_dehyphenate([p.text for p in pending]))
            if text:
                kind = "list" if re.match(r"^([•\-*]|\d+[.)])\s", text) else "paragraph"
                blocks.append(Block(kind=kind, text=text, page=pending[0].page))
            pending.clear()

        def emit_tables(page: int, before_y: float | None) -> None:
            items = pending_tables.get(page, [])
            while items and (before_y is None or items[0][0] <= before_y):
                _y, markdown = items.pop(0)
                flush()
                blocks.append(Block(kind="table", text=markdown, page=page))

        current_page = lines[0].page if lines else 1
        for line in lines:
            if line.page != current_page:
                flush()
                emit_tables(current_page, None)
                current_page = line.page
            emit_tables(line.page, line.y0)
            if line.size in level_of and len(line.text.strip()) < 120:
                flush()
                text = normalize_text(line.text)
                if (
                    blocks
                    and blocks[-1].kind == "heading"
                    and blocks[-1].page == line.page
                    and (blocks[-1].level == level_of[line.size])
                ):
                    blocks[-1].text = f"{blocks[-1].text} {text}"
                else:
                    blocks.append(Block(kind="heading", text=text, level=level_of[line.size], page=line.page))
                continue
            if pending and (line.block != pending[-1].block or line.page != pending[-1].page):
                flush()
            if pending and re.match(r"^([•\-*]|\d+[.)])\s", line.text.strip()):
                flush()
            pending.append(line)
        flush()
        for page in sorted(pending_tables):
            emit_tables(page, None)
        return blocks
