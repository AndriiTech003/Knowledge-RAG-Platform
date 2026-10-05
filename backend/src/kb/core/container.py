from __future__ import annotations

from dataclasses import dataclass, field

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from kb.access.service import AccessService
from kb.config import Settings
from kb.core.db import create_engine, create_sessionmaker
from kb.core.events import EventPublisher
from kb.core.redis import create_redis
from kb.core.security import TokenVerifier, build_verifier
from kb.core.storage import ObjectStorage
from kb.ingestion.chunking.tokenizer import TokenCounter, get_token_counter
from kb.providers.embedders import Embedder, build_embedder
from kb.providers.llms import LlmClient, build_condense_llm, build_llm
from kb.providers.rerankers import Reranker, build_reranker
from kb.retrieval.retriever import Retriever


@dataclass
class Container:
    settings: Settings
    engine: AsyncEngine
    sessions: async_sessionmaker[AsyncSession]
    redis: Redis
    storage: ObjectStorage
    verifier: TokenVerifier
    access: AccessService
    events: EventPublisher
    reranker: Reranker | None
    llm: LlmClient
    condense_llm: LlmClient
    embedders: dict[str, Embedder] = field(default_factory=dict)

    def embedder_for(self, model: str) -> Embedder:
        if model not in self.embedders:
            self.embedders[model] = build_embedder(self.settings, model)
        return self.embedders[model]

    def token_counter(self) -> TokenCounter:
        return get_token_counter(self.settings.tokenizer, self.settings.tokenizer_model)

    def retriever(self) -> Retriever:
        return Retriever(self.sessions, self.embedder_for, self.reranker)

    async def aclose(self) -> None:
        for embedder in self.embedders.values():
            closer = getattr(embedder, "aclose", None)
            if closer is not None:
                await closer()
        closer = getattr(self.reranker, "aclose", None)
        if closer is not None:
            await closer()
        await self.redis.aclose()
        await self.engine.dispose()


def build_container(settings: Settings, verifier: TokenVerifier | None = None) -> Container:
    engine = create_engine(settings)
    sessions = create_sessionmaker(engine)
    redis = create_redis(settings)
    return Container(
        settings=settings,
        engine=engine,
        sessions=sessions,
        redis=redis,
        storage=ObjectStorage(settings),
        verifier=verifier or build_verifier(settings),
        access=AccessService(sessions, redis, settings),
        events=EventPublisher(redis, settings),
        reranker=build_reranker(settings),
        llm=build_llm(settings),
        condense_llm=build_condense_llm(settings),
    )
