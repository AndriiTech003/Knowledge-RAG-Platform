from __future__ import annotations

import io
import zipfile

import magic

from kb.ingestion.parsers.base import Block, ParsedDocument, ParseError, Parser
from kb.ingestion.parsers.docx import DocxParser
from kb.ingestion.parsers.html import HtmlParser
from kb.ingestion.parsers.markdown import MarkdownParser
from kb.ingestion.parsers.pdf import PdfParser
from kb.ingestion.parsers.txt import TextParser

DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
SUPPORTED_MIME = {"application/pdf", DOCX_MIME, "text/html", "text/markdown", "text/plain"}
FORBIDDEN_MIME_PREFIXES = (
    "application/x-executable",
    "application/x-mach-binary",
    "application/x-dosexec",
    "application/x-sharedlib",
    "application/x-elf",
    "application/vnd.microsoft.portable-executable",
    "application/x-msdownload",
)

PARSERS: list[Parser] = [PdfParser(), DocxParser(), MarkdownParser(), HtmlParser(), TextParser()]


def detect_mime(data: bytes, filename: str) -> str:
    detected = magic.from_buffer(data[:8192], mime=True) or "application/octet-stream"
    lower = filename.lower()
    if detected in {"application/zip", "application/octet-stream"} or detected == DOCX_MIME:
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                if "word/document.xml" in archive.namelist():
                    return DOCX_MIME
        except zipfile.BadZipFile:
            pass
    if detected.startswith("text/"):
        if lower.endswith((".md", ".markdown")):
            return "text/markdown"
        if detected == "text/html" or lower.endswith((".html", ".htm")):
            head = data[:2048].decode("utf-8", errors="ignore").lower()
            if (
                "<html" in head
                or "<!doctype html" in head
                or "<body" in head
                or lower.endswith((".html", ".htm"))
            ):
                return "text/html"
        if detected in {"text/x-script.python", "text/x-shellscript"}:
            return detected
        return "text/plain" if detected != "text/html" else "text/html"
    return detected


def check_allowed(mime: str) -> None:
    if mime.startswith(FORBIDDEN_MIME_PREFIXES):
        raise ParseError("forbidden_type", f"Executable files are not allowed ({mime})")
    if mime not in SUPPORTED_MIME:
        raise ParseError("unsupported_type", f"Unsupported file type {mime}")


def parser_for(mime: str) -> Parser:
    for parser in PARSERS:
        if mime in parser.mime_types:
            return parser
    raise ParseError("unsupported_type", f"Unsupported file type {mime}")


def parse_document(data: bytes, filename: str, mime: str | None = None) -> tuple[str, ParsedDocument]:
    kind = mime or detect_mime(data, filename)
    check_allowed(kind)
    return kind, parser_for(kind).parse(data, filename)


__all__ = [
    "SUPPORTED_MIME",
    "Block",
    "ParseError",
    "ParsedDocument",
    "Parser",
    "check_allowed",
    "detect_mime",
    "parse_document",
    "parser_for",
]
