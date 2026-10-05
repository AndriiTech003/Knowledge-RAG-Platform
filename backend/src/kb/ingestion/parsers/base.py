from __future__ import annotations

from typing import ClassVar, Literal, Protocol

from pydantic import BaseModel

BlockKind = Literal["heading", "paragraph", "list", "table", "code"]


class Block(BaseModel):
    kind: BlockKind
    text: str
    level: int = 0
    page: int | None = None


class ParsedDocument(BaseModel):
    title: str
    blocks: list[Block]
    page_count: int | None = None
    metadata: dict[str, str] = {}


class ParseError(Exception):
    def __init__(self, code: str, message: str | None = None) -> None:
        super().__init__(message or code)
        self.code = code


class Parser(Protocol):
    mime_types: ClassVar[set[str]]

    def parse(self, data: bytes, filename: str) -> ParsedDocument: ...


def title_from_filename(filename: str) -> str:
    stem = filename.rsplit("/", 1)[-1].rsplit(".", 1)[0]
    return stem.replace("-", " ").replace("_", " ").strip().title() or "Untitled"
