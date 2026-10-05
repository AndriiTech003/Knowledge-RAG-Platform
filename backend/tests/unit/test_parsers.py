from __future__ import annotations

from pathlib import Path

import pytest

from kb.ingestion.parsers import DOCX_MIME, ParseError, check_allowed, detect_mime, parse_document

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"


def load(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


def test_pdf_removes_running_header_and_footer() -> None:
    _mime, doc = parse_document(load("hard.pdf"), "hard.pdf")
    texts = [b.text for b in doc.blocks]
    assert doc.page_count == 3
    assert not any("Northwind Labs · Field Operations Manual" in t for t in texts)
    assert not any("Confidential - Page" in t for t in texts)


def test_pdf_detects_headings_by_font_size_with_levels() -> None:
    _mime, doc = parse_document(load("hard.pdf"), "hard.pdf")
    headings = [(b.text, b.level, b.page) for b in doc.blocks if b.kind == "heading"]
    assert headings[0] == ("Field Operations Manual", 1, 1)
    assert ("Equipment allowance", 2, 2) in headings
    assert ("Reporting", 2, 3) in headings


def test_pdf_extracts_tables_as_markdown_on_the_right_page() -> None:
    _mime, doc = parse_document(load("hard.pdf"), "hard.pdf")
    tables = [b for b in doc.blocks if b.kind == "table"]
    assert len(tables) == 1
    assert tables[0].page == 2
    assert "|Repair|Kit B|12 kg|" in tables[0].text.replace(" ", "").replace("|Kit B|", "|Kit B|") or (
        "Repair" in tables[0].text and "12 kg" in tables[0].text
    )
    assert tables[0].text.startswith("|")


def test_pdf_keeps_page_numbers_for_paragraphs() -> None:
    _mime, doc = parse_document(load("hard.pdf"), "hard.pdf")
    fr = next(b for b in doc.blocks if "FR-209" in b.text)
    assert fr.page == 3
    assert doc.title == "Field Operations Manual"


def test_scanned_pdf_is_rejected_with_no_text_layer() -> None:
    with pytest.raises(ParseError) as error:
        parse_document(load("scanned.pdf"), "scanned.pdf")
    assert error.value.code == "no_text_layer"


def test_corrupt_pdf_is_reported() -> None:
    with pytest.raises(ParseError):
        parse_document(b"%PDF-1.7 broken", "broken.pdf", "application/pdf")


def test_docx_headings_lists_and_tables() -> None:
    mime, doc = parse_document(load("sample.docx"), "sample.docx")
    assert mime == DOCX_MIME
    assert doc.title == "Office Moves Guide"
    kinds = [(b.kind, b.level) for b in doc.blocks]
    assert ("heading", 1) in kinds
    assert ("heading", 2) in kinds
    table = next(b for b in doc.blocks if b.kind == "table")
    assert table.text.splitlines()[0] == "| Item | Cost |"
    assert "| Movers | $1,200 |" in table.text
    assert any(b.kind == "list" and "three crates" in b.text for b in doc.blocks)


def test_markdown_structure_from_ast() -> None:
    mime, doc = parse_document(load("sample.md"), "sample.md")
    assert mime == "text/markdown"
    assert doc.title == "Coffee Machine Guide"
    assert [b.text for b in doc.blocks if b.kind == "heading"] == [
        "Coffee Machine Guide",
        "Cleaning",
        "Supplies",
    ]
    assert any(b.kind == "table" and "Roastery Nine" in b.text for b in doc.blocks)


def test_html_main_content_without_navigation() -> None:
    mime, doc = parse_document(load("sample.html"), "sample.html")
    assert mime == "text/html"
    assert doc.title == "Parking Rules"
    text = " ".join(b.text for b in doc.blocks)
    assert "Charging bays are limited" in text
    assert "Copyright footer" not in text
    assert "Intranet header banner" not in text
    assert [b.level for b in doc.blocks if b.kind == "heading"] == [1, 2]


def test_txt_paragraphs() -> None:
    mime, doc = parse_document(load("sample.txt"), "visitor-wifi.txt")
    assert mime == "text/plain"
    assert [b.text for b in doc.blocks][1] == "The visitor network is NW-Visit."


def test_executables_are_forbidden() -> None:
    macho = bytes.fromhex("cffaedfe0c000001") + b"\0" * 64
    elf = b"\x7fELF" + b"\x02\x01\x01" + b"\0" * 64
    for blob, name in ((macho, "tool.pdf"), (elf, "run.md")):
        mime = detect_mime(blob, name)
        with pytest.raises(ParseError) as error:
            check_allowed(mime)
        assert error.value.code in {"forbidden_type", "unsupported_type"}


def test_mime_is_detected_from_content_not_extension() -> None:
    assert detect_mime(load("hard.pdf"), "renamed.txt") == "application/pdf"
    assert detect_mime(load("sample.docx"), "file.bin") == DOCX_MIME
