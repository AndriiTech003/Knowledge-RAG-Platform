from __future__ import annotations

import re

from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from kb.ingestion.chunking.chunker import chunk_document, embed_text_for
from kb.ingestion.chunking.profiles import ChunkingProfile, get_profile
from kb.ingestion.chunking.tokenizer import SimpleTokenCounter
from kb.ingestion.parsers.base import Block, ParsedDocument

COUNTER = SimpleTokenCounter()
WORDS = st.text(alphabet="abcdefghijklmnopqrstuvwxyz", min_size=1, max_size=12)


@st.composite
def sentences(draw: st.DrawFn) -> str:
    words = draw(st.lists(WORDS, min_size=1, max_size=40))
    return " ".join(words).capitalize() + "."


@st.composite
def blocks(draw: st.DrawFn) -> Block:
    kind = draw(st.sampled_from(["heading", "paragraph", "paragraph", "paragraph", "list", "table"]))
    page = draw(st.integers(min_value=1, max_value=5))
    if kind == "heading":
        return Block(
            kind="heading",
            text=" ".join(draw(st.lists(WORDS, min_size=1, max_size=5))),
            level=draw(st.integers(min_value=1, max_value=4)),
            page=page,
        )
    if kind == "table":
        rows = draw(st.lists(st.lists(WORDS, min_size=2, max_size=2), min_size=1, max_size=60))
        lines = ["| a | b |", "|---|---|"] + [f"| {r[0]} | {r[1]} |" for r in rows]
        return Block(kind="table", text="\n".join(lines), page=page)
    if kind == "list":
        items = draw(st.lists(sentences(), min_size=1, max_size=6))
        return Block(kind="list", text="\n".join(f"- {i}" for i in items), page=page)
    return Block(
        kind="paragraph", text=" ".join(draw(st.lists(sentences(), min_size=1, max_size=25))), page=page
    )


@st.composite
def documents(draw: st.DrawFn) -> ParsedDocument:
    return ParsedDocument(
        title="Doc " + draw(WORDS), blocks=draw(st.lists(blocks(), min_size=1, max_size=25))
    )


PROFILES = st.sampled_from(
    [get_profile("small"), get_profile("default"), ChunkingProfile(name="tiny", max_tokens=60)]
)


def words_of(text: str) -> list[str]:
    return re.findall(r"[a-z]+", text.lower())


@settings(max_examples=150, deadline=None, suppress_health_check=[HealthCheck.too_slow])
@given(documents(), PROFILES)
def test_no_chunk_exceeds_max_tokens(doc: ParsedDocument, profile: ChunkingProfile) -> None:
    for chunk in chunk_document(doc, profile, COUNTER):
        assert chunk.token_count <= profile.max_tokens
        assert COUNTER.count(chunk.text) == chunk.token_count


@settings(max_examples=150, deadline=None, suppress_health_check=[HealthCheck.too_slow])
@given(documents(), PROFILES)
def test_no_text_is_lost(doc: ParsedDocument, profile: ChunkingProfile) -> None:
    chunks = chunk_document(doc, profile, COUNTER)
    covered: set[str] = set()
    for chunk in chunks:
        covered.update(words_of(chunk.text))
        for heading in chunk.heading_path:
            covered.update(words_of(heading))
    for block in doc.blocks:
        if block.kind == "heading":
            continue
        missing = set(words_of(block.text)) - covered
        assert not missing


@settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.too_slow])
@given(documents(), PROFILES)
def test_ordinals_hashes_and_pages_are_consistent(doc: ParsedDocument, profile: ChunkingProfile) -> None:
    chunks = chunk_document(doc, profile, COUNTER)
    assert [c.ordinal for c in chunks] == list(range(len(chunks)))
    again = chunk_document(doc, profile, COUNTER)
    assert [c.content_hash for c in chunks] == [c.content_hash for c in again]
    for chunk in chunks:
        assert chunk.text.strip()
        if chunk.page_start is not None and chunk.page_end is not None:
            assert chunk.page_start <= chunk.page_end
        assert chunk.char_start <= chunk.char_end


def test_top_level_heading_forces_new_chunk_and_sets_heading_path() -> None:
    doc = ParsedDocument(
        title="Travel Policy",
        blocks=[
            Block(kind="heading", text="Travel Policy", level=1, page=1),
            Block(kind="paragraph", text="Short intro.", page=1),
            Block(kind="heading", text="Per diem", level=2, page=2),
            Block(kind="paragraph", text="Europe is 65 EUR per day.", page=2),
            Block(kind="heading", text="Europe", level=3, page=2),
            Block(kind="paragraph", text="Hotels are capped.", page=2),
        ],
    )
    chunks = chunk_document(doc, get_profile("default"), COUNTER)
    assert chunks[0].text == "Short intro."
    assert chunks[1].heading_path == ["Travel Policy", "Per diem"]
    assert chunks[1].page_start == 2
    assert "Hotels are capped." in chunks[1].text


def test_long_paragraph_is_split_by_sentences_with_overlap() -> None:
    sentences_text = " ".join(f"Sentence number {i} talks about topic {i}." for i in range(80))
    doc = ParsedDocument(title="Long", blocks=[Block(kind="paragraph", text=sentences_text, page=1)])
    chunks = chunk_document(doc, ChunkingProfile(name="t", max_tokens=80), COUNTER)
    assert len(chunks) > 3
    for previous, current in zip(chunks, chunks[1:], strict=False):
        last_sentence = previous.text.split(". ")[-1].rstrip(".")
        assert current.text.startswith(last_sentence) or last_sentence in current.text


def test_overlap_does_not_cross_sections() -> None:
    doc = ParsedDocument(
        title="T",
        blocks=[
            Block(kind="heading", text="A", level=2),
            Block(kind="paragraph", text="Alpha one. Alpha two. Alpha three."),
            Block(kind="heading", text="B", level=2),
            Block(kind="paragraph", text="Beta one. Beta two."),
        ],
    )
    chunks = chunk_document(doc, get_profile("default"), COUNTER)
    assert "Alpha" not in chunks[1].text


def test_table_is_its_own_chunk() -> None:
    table = "| Region | Per diem |\n|---|---|\n| Europe | 65 |\n| US | 75 |"
    doc = ParsedDocument(
        title="T",
        blocks=[
            Block(kind="paragraph", text="Intro text."),
            Block(kind="table", text=table),
            Block(kind="paragraph", text="After."),
        ],
    )
    chunks = chunk_document(doc, get_profile("default"), COUNTER)
    assert [c.text for c in chunks] == ["Intro text.", table, "After."]


def test_contextual_prefix_goes_only_into_embedding_text() -> None:
    doc = ParsedDocument(
        title="Travel Policy",
        blocks=[
            Block(kind="heading", text="Per diem", level=2),
            Block(kind="paragraph", text="Europe is 65 EUR."),
        ],
    )
    with_prefix = chunk_document(doc, get_profile("default"), COUNTER)[0]
    without = chunk_document(
        doc, ChunkingProfile(name="np", max_tokens=450, contextual_prefix=False), COUNTER
    )[0]
    assert with_prefix.text == "Europe is 65 EUR."
    assert with_prefix.embed_text == "Travel Policy > Per diem\n\nEurope is 65 EUR."
    assert without.embed_text == without.text
    assert with_prefix.content_hash != without.content_hash
    assert embed_text_for("T", ["T", "S"], "x", True) == "T > S\n\nx"
