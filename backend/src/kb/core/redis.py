from __future__ import annotations

from redis.asyncio import Redis

from kb.config import Settings


def create_redis(settings: Settings) -> Redis:
    client: Redis = Redis.from_url(settings.redis_url, decode_responses=True)
    return client


def key(settings: Settings, *parts: str) -> str:
    return ":".join([settings.redis_prefix, *parts])
