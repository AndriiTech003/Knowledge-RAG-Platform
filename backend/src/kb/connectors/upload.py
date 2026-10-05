from __future__ import annotations

import uuid
from typing import Any

from kb.connectors.base import PageState, SyncPlan


class UploadConnector:
    kind = "upload"

    async def fetch(
        self, source_id: uuid.UUID, config: dict[str, Any], state: dict[str, PageState]
    ) -> SyncPlan:
        return SyncPlan()
