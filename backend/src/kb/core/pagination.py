from __future__ import annotations

import base64
import json
from datetime import datetime
from typing import Any

from pydantic import BaseModel

from kb.core.errors import bad_request


class Page[T](BaseModel):
    items: list[T]
    next_cursor: str | None = None


def encode_cursor(values: dict[str, Any]) -> str:
    raw = json.dumps(values, default=_default, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def decode_cursor(cursor: str | None) -> dict[str, Any] | None:
    if not cursor:
        return None
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        value = json.loads(base64.urlsafe_b64decode(padded.encode()))
    except (ValueError, json.JSONDecodeError) as exc:
        raise bad_request("INVALID_CURSOR", "Cursor is malformed") from exc
    if not isinstance(value, dict):
        raise bad_request("INVALID_CURSOR", "Cursor is malformed")
    return value


def _default(value: object) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)
