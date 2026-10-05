from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from typing import ClassVar

import defusedxml.ElementTree as DET
import trafilatura

from kb.core.text import normalize_text
from kb.ingestion.parsers.base import Block, ParsedDocument, ParseError, title_from_filename

TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)


def _text(element: ET.Element) -> str:
    return normalize_text(" ".join("".join(element.itertext()).split()))


def _table(element: ET.Element) -> str:
    rows = [[_text(cell).replace("|", "/") for cell in row.findall("cell")] for row in element.findall("row")]
    rows = [r for r in rows if any(r)]
    if not rows:
        return ""
    width = max(len(r) for r in rows)
    rows = [r + [""] * (width - len(r)) for r in rows]
    lines = ["| " + " | ".join(rows[0]) + " |", "|" + "|".join("---" for _ in range(width)) + "|"]
    lines.extend("| " + " | ".join(r) + " |" for r in rows[1:])
    return "\n".join(lines)


def blocks_from_xml(xml: str) -> list[Block]:
    root = DET.fromstring(xml)
    main = root.find("main")
    if main is None:
        return []
    blocks: list[Block] = []
    for element in main:
        tag = element.tag
        if tag == "head":
            rend = element.get("rend", "h2")
            level = int(rend[1]) if len(rend) == 2 and rend[1].isdigit() else 2
            text = _text(element)
            if text:
                blocks.append(Block(kind="heading", text=text, level=level))
        elif tag == "list":
            items = [_text(item) for item in element.iter("item")]
            items = [i for i in items if i]
            if items:
                blocks.append(Block(kind="list", text="\n".join(f"- {i}" for i in items)))
        elif tag == "table":
            markdown = _table(element)
            if markdown:
                blocks.append(Block(kind="table", text=markdown))
        elif tag == "code":
            text = "".join(element.itertext()).strip()
            if text:
                blocks.append(Block(kind="code", text=text))
        else:
            text = _text(element)
            if text:
                blocks.append(Block(kind="paragraph", text=text))
    return blocks


class HtmlParser:
    mime_types: ClassVar[set[str]] = {"text/html", "application/xhtml+xml"}

    def _extract(self, html: str, precision: bool) -> list[Block]:
        xml = trafilatura.extract(
            html,
            output_format="xml",
            include_tables=True,
            include_formatting=False,
            include_links=False,
            include_comments=False,
            favor_precision=precision,
            favor_recall=not precision,
        )
        return blocks_from_xml(xml) if xml else []

    def parse(self, data: bytes, filename: str) -> ParsedDocument:
        html = data.decode("utf-8", errors="replace")
        precise = self._extract(html, True)
        recall = self._extract(html, False)
        size_p = sum(len(b.text) for b in precise)
        size_r = sum(len(b.text) for b in recall)
        blocks = precise if precise and size_p >= 0.6 * size_r else recall
        if not blocks:
            raise ParseError("empty_html", "No main content found in HTML")
        metadata = trafilatura.extract_metadata(html)
        title = ""
        if metadata is not None and metadata.title:
            title = str(metadata.title)
        if not title:
            match = TITLE_RE.search(html)
            title = match.group(1).strip() if match else ""
        title = title.split(" | ")[0].strip()
        if not title:
            title = next((b.text for b in blocks if b.kind == "heading"), "") or title_from_filename(filename)
        return ParsedDocument(title=title, blocks=blocks)
