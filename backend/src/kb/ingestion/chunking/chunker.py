from __future__ import annotations

from dataclasses import dataclass, field

from kb.core.text import split_sentences
from kb.ingestion.chunking.profiles import ChunkingProfile
from kb.ingestion.chunking.tokenizer import TokenCounter
from kb.ingestion.hashing import sha256_text
from kb.ingestion.parsers.base import Block, ParsedDocument


@dataclass
class ChunkDraft:
    ordinal: int
    text: str
    heading_path: list[str]
    page_start: int | None
    page_end: int | None
    char_start: int
    char_end: int
    token_count: int
    content_hash: str
    embed_text: str


@dataclass
class Piece:
    text: str
    page: int | None
    start: int
    end: int
    tokens: int
    block: int = -1


def join_pieces(pieces: list[Piece]) -> str:
    out = ""
    previous: Piece | None = None
    for piece in pieces:
        if previous is None:
            out = piece.text
        elif previous.block == piece.block and piece.block >= 0:
            out += " " + piece.text
        else:
            out += "\n\n" + piece.text
        previous = piece
    return out.strip()


@dataclass
class Builder:
    pieces: list[Piece] = field(default_factory=list)
    heading_path: list[str] = field(default_factory=list)
    tokens: int = 0


def embed_text_for(title: str, heading_path: list[str], text: str, prefix: bool) -> str:
    if not prefix:
        return text
    path = (
        heading_path[1:]
        if heading_path and heading_path[0].strip().lower() == title.strip().lower()
        else heading_path
    )
    context = " > ".join([title, *path])
    return f"{context}\n\n{text}"


def _split_long(text: str, max_tokens: int, counter: TokenCounter) -> list[str]:
    sentences = split_sentences(text) or [text]
    out: list[str] = []
    for sentence in sentences:
        if counter.count(sentence) <= max_tokens:
            out.append(sentence)
            continue
        words = sentence.split()
        current: list[str] = []
        for word in words:
            candidate = " ".join([*current, word])
            if current and counter.count(candidate) > max_tokens:
                out.append(" ".join(current))
                current = [word]
            else:
                current.append(word)
        if current:
            out.append(" ".join(current))
    return out


def _split_table(text: str, max_tokens: int, counter: TokenCounter) -> list[str]:
    lines = text.split("\n")
    header = (
        lines[:2] if len(lines) > 2 and set(lines[1].replace("|", "").strip()) <= set("-: ") else lines[:1]
    )
    rows = lines[len(header) :]
    parts: list[str] = []
    current: list[str] = []
    for row in rows:
        candidate = "\n".join([*header, *current, row])
        if current and counter.count(candidate) > max_tokens:
            parts.append("\n".join([*header, *current]))
            current = [row]
        else:
            current.append(row)
    if current:
        parts.append("\n".join([*header, *current]))
    final: list[str] = []
    for part in parts:
        if counter.count(part) > max_tokens:
            final.extend(_split_long(part.replace("\n", " "), max_tokens, counter))
        else:
            final.append(part)
    return final


class StructuralChunker:
    def __init__(self, profile: ChunkingProfile, counter: TokenCounter) -> None:
        self.profile = profile
        self.counter = counter
        self.max_tokens = profile.max_tokens

    def chunk(self, doc: ParsedDocument) -> list[ChunkDraft]:
        drafts: list[ChunkDraft] = []
        stack: list[tuple[int, str]] = []
        builder = Builder()
        offset = 0
        joiner = "\n\n"

        def path() -> list[str]:
            return [text for _level, text in stack]

        def flush(carry: bool) -> None:
            nonlocal builder
            if not builder.pieces:
                builder = Builder(heading_path=path())
                return
            text = join_pieces(builder.pieces)
            if text:
                pages = [p.page for p in builder.pieces if p.page is not None]
                embed = embed_text_for(doc.title, builder.heading_path, text, self.profile.contextual_prefix)
                drafts.append(
                    ChunkDraft(
                        ordinal=len(drafts),
                        text=text,
                        heading_path=list(builder.heading_path),
                        page_start=min(pages) if pages else None,
                        page_end=max(pages) if pages else None,
                        char_start=builder.pieces[0].start,
                        char_end=builder.pieces[-1].end,
                        token_count=self.counter.count(text),
                        content_hash=sha256_text(embed),
                        embed_text=embed,
                    )
                )
            last = builder.pieces[-1]
            flushed = builder.pieces
            builder = Builder(heading_path=path())
            if carry and self.profile.overlap:
                sentences = split_sentences(last.text)
                multiple = len(sentences) > 1 or len(flushed) > 1
                if sentences and multiple:
                    tail = sentences[-1]
                    tail_tokens = self.counter.count(tail)
                    if tail_tokens <= max(8, int(self.max_tokens * 0.15)):
                        start = last.start + max(0, last.text.rfind(tail))
                        builder.pieces.append(
                            Piece(tail, last.page, start, start + len(tail), tail_tokens, last.block)
                        )
                        builder.tokens = tail_tokens

        def add(piece: Piece) -> None:
            separator = 2 if builder.pieces else 0
            if builder.pieces and builder.tokens + separator + piece.tokens > self.max_tokens:
                flush(carry=True)
                if builder.tokens + 2 + piece.tokens > self.max_tokens:
                    builder.pieces.clear()
                    builder.tokens = 0
            if not builder.pieces:
                builder.heading_path = path()
            builder.pieces.append(piece)
            builder.tokens = self.counter.count(join_pieces(builder.pieces))
            if builder.tokens > self.max_tokens and len(builder.pieces) > 1:
                builder.pieces.pop()
                flush(carry=False)
                builder.heading_path = path()
                builder.pieces.append(piece)
                builder.tokens = piece.tokens

        def piece_from(text: str, block: Block, start: int) -> Piece:
            return Piece(text, block.page, start, start + len(text), self.counter.count(text), current_block)

        current_block = -1
        for block in doc.blocks:
            current_block += 1
            text = block.text.strip()
            if not text:
                continue
            block_start = offset
            offset += len(text) + len(joiner)
            if block.kind == "heading":
                level = max(1, block.level or 1)
                if level <= 2 or builder.tokens > self.max_tokens // 3:
                    flush(carry=False)
                while stack and stack[-1][0] >= level:
                    stack.pop()
                stack.append((level, text))
                if not builder.pieces:
                    builder.heading_path = path()
                elif level > 2:
                    add(piece_from(text, block, block_start))
                continue
            if block.kind == "table":
                flush(carry=False)
                parts = (
                    [text]
                    if self.counter.count(text) <= self.max_tokens
                    else _split_table(text, self.max_tokens, self.counter)
                )
                for part in parts:
                    builder.heading_path = path()
                    builder.pieces.append(piece_from(part, block, block_start))
                    builder.tokens = self.counter.count(part)
                    flush(carry=False)
                continue
            tokens = self.counter.count(text)
            if tokens <= self.max_tokens:
                add(Piece(text, block.page, block_start, block_start + len(text), tokens, current_block))
                continue
            cursor = 0
            for sentence in _split_long(text, self.max_tokens, self.counter):
                position = text.find(sentence, cursor)
                position = cursor if position < 0 else position
                cursor = position + len(sentence)
                add(piece_from(sentence, block, block_start + position))
        flush(carry=False)
        return [d for d in drafts if d.text]


def normalized_document_text(doc: ParsedDocument) -> str:
    return "\n\n".join(b.text.strip() for b in doc.blocks if b.text.strip())


def chunk_document(doc: ParsedDocument, profile: ChunkingProfile, counter: TokenCounter) -> list[ChunkDraft]:
    return StructuralChunker(profile, counter).chunk(doc)
