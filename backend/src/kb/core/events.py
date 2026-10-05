from __future__ import annotations

import json
from typing import Any

from redis.asyncio import Redis
from redis.exceptions import RedisError

from kb.config import Settings
from kb.core.redis import key


def document_channel(settings: Settings) -> str:
    return key(settings, "events", "documents")


class EventPublisher:
    def __init__(self, redis: Redis, settings: Settings) -> None:
        self.redis = redis
        self.settings = settings

    async def document(self, payload: dict[str, Any]) -> None:
        try:
            await self.redis.publish(document_channel(self.settings), json.dumps(payload, default=str))
        except RedisError:
            return
