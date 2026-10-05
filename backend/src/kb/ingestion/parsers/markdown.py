from __future__ import annotations

from typing import ClassVar

from markdown_it import MarkdownIt
from markdown_it.token import Token

from kb.core.text import normalize_text
from kb.ingestion.parsers.base import Block, ParsedDocument, title_from_filename


def _strip_front_matter(text: str) -> str:
    if text.startswith("---\n"):
        end = text.find("\n---", 4)
        if end != -1:
            return text[end + 4 :]
    return text


def _table_markdown(tokens: list[Token], start: int) -> tuple[str, int]:
    rows: list[list[str]] = []
    current: list[str] = []
    i = start + 1
    while i < len(tokens) and tokens[i].type != "table_close":
        tok = tokens[i]
        if tok.type == "tr_open":
            current = []
        elif tok.type == "inline":
            current.append(tok.content.strip())
        elif tok.type == "tr_close":
            rows.append(current)
        i += 1
    if not rows:
        return "", i
    lines = ["| " + " | ".join(rows[0]) + " |", "|" + "|".join("---" for _ in rows[0]) + "|"]
    lines.extend("| " + " | ".join(r) + " |" for r in rows[1:])
    return "\n".join(lines), i


def blocks_from_markdown(text: str) -> list[Block]:
    md = MarkdownIt("commonmark").enable("table")
    tokens = md.parse(_strip_front_matter(text))
    blocks: list[Block] = []
    list_depth = 0
    list_items: list[str] = []
    i = 0
    while i < len(tokens):
        tok = tokens[i]
        if tok.type == "heading_open":
            content = normalize_text(tokens[i + 1].content)
            if content:
                blocks.append(Block(kind="heading", text=content, level=int(tok.tag[1])))
            i += 3
            continue
        if tok.type in {"bullet_list_open", "ordered_list_open"}:
            list_depth += 1
        elif tok.type in {"bullet_list_close", "ordered_list_close"}:
            list_depth -= 1
            if list_depth == 0 and list_items:
                blocks.append(Block(kind="list", text="\n".join(list_items)))
                list_items = []
        elif tok.type == "inline" and list_depth > 0:
            content = normalize_text(tok.content)
            if content:
                list_items.append("  " * (list_depth - 1) + "- " + content)
        elif tok.type == "inline":
            content = normalize_text(tok.content)
            if content:
                blocks.append(Block(kind="paragraph", text=content))
        elif tok.type in {"fence", "code_block"}:
            content = tok.content.rstrip()
            if content:
                blocks.append(Block(kind="code", text=content))
        elif tok.type == "table_open":
            table, i = _table_markdown(tokens, i)
            if table:
                blocks.append(Block(kind="table", text=table))
        i += 1
    return blocks


class MarkdownParser:
    mime_types: ClassVar[set[str]] = {"text/markdown", "text/x-markdown"}

    def parse(self, data: bytes, filename: str) -> ParsedDocument:
        text = data.decode("utf-8", errors="replace")
        blocks = blocks_from_markdown(text)
        title = next((b.text for b in blocks if b.kind == "heading" and b.level == 1), None)
        return ParsedDocument(title=title or title_from_filename(filename), blocks=blocks)
