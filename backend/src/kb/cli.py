from __future__ import annotations

import uvicorn

from kb.config import get_settings


def api() -> None:
    settings = get_settings()
    uvicorn.run(
        "kb.main:app", host=settings.api_host, port=settings.api_port, proxy_headers=True, log_level="info"
    )
