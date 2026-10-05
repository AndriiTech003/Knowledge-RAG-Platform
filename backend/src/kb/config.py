from __future__ import annotations

from decimal import Decimal
from functools import lru_cache
from typing import Literal

from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class ModelPrice(BaseModel):
    input_per_mtok: Decimal
    output_per_mtok: Decimal


EMBEDDING_MODELS: dict[str, int] = {
    "BAAI/bge-small-en-v1.5": 384,
    "hash-384": 384,
    "BAAI/bge-m3": 1024,
    "text-embedding-3-small": 1536,
}

DEFAULT_PRICES: dict[str, ModelPrice] = {
    "claude-opus-5-5": ModelPrice(input_per_mtok=Decimal("4"), output_per_mtok=Decimal("20")),
    "claude-sonnet-5-5": ModelPrice(input_per_mtok=Decimal("2"), output_per_mtok=Decimal("10")),
    "claude-haiku-4-5": ModelPrice(input_per_mtok=Decimal("1"), output_per_mtok=Decimal("5")),
    "claude-fable-5-1": ModelPrice(input_per_mtok=Decimal("10"), output_per_mtok=Decimal("50")),
    "gpt-4o-mini": ModelPrice(input_per_mtok=Decimal("0.15"), output_per_mtok=Decimal("0.6")),
    "gpt-4o": ModelPrice(input_per_mtok=Decimal("2.5"), output_per_mtok=Decimal("10")),
    "fake-llm": ModelPrice(input_per_mtok=Decimal("0.5"), output_per_mtok=Decimal("1.5")),
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="KB_", extra="ignore")

    env: Literal["dev", "test", "prod"] = "dev"
    api_host: str = "127.0.0.1"
    api_port: int = 4400
    public_url: str = "http://127.0.0.1:4400"
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://127.0.0.1:4420", "http://localhost:4420", "http://127.0.0.1:4421"]
    )

    database_url: str = "postgresql+asyncpg://asnh@127.0.0.1:5432/kb"
    db_pool_size: int = 10
    db_max_overflow: int = 10
    redis_url: str = "redis://127.0.0.1:6379/4"
    redis_prefix: str = "kb"
    broker_url: str = "redis://127.0.0.1:6379/4"

    s3_endpoint: str = "127.0.0.1:9002"
    s3_public_endpoint: str = "127.0.0.1:9002"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_secure: bool = False
    s3_bucket: str = "kb"
    s3_region: str = "us-east-1"
    presign_ttl_seconds: int = 300
    max_upload_bytes: int = 50 * 1024 * 1024

    oidc_issuer: str = "http://127.0.0.1:4480/realms/northwind"
    oidc_audience: str = "kb-api"
    oidc_jwks_url: str | None = None
    oidc_jwks_cache_seconds: int = 600
    oidc_leeway_seconds: int = 30
    admin_group: str = "kb-admins"

    embedder: Literal["remote", "hash"] = "remote"
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    reranker: Literal["remote", "fake", "none"] = "remote"
    reranker_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    models_url: str = "http://127.0.0.1:4410"
    models_timeout_seconds: float = 60.0
    tokenizer: Literal["hf", "simple"] = "hf"
    tokenizer_model: str = "BAAI/bge-small-en-v1.5"

    llm_provider: Literal["fake", "anthropic", "openai"] = "fake"
    llm_model: str = "fake-llm"
    llm_condense_model: str = "fake-llm"
    llm_effort: Literal["low", "medium", "high"] = "low"
    llm_base_url: str | None = None
    llm_max_output_tokens: int = 800
    llm_timeout_seconds: float = 60.0
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None
    judge_provider: Literal["fake", "anthropic", "openai"] = "fake"
    judge_model: str = "fake-judge"
    fake_llm_delay_ms: int = 0

    prompt_version: str = "v1"
    vector_top_k: int = 40
    lexical_top_k: int = 40
    fused_top_k: int = 20
    final_top_k: int = 8
    rrf_k: int = 60
    max_chunks_per_document: int = 3
    mmr_lambda: float = 0.75
    hnsw_ef_search: int = 100
    embed_timeout_seconds: float = 10.0
    rerank_timeout_seconds: float = 8.0
    no_answer_threshold: float = 0.1
    no_answer_vector_threshold: float = 0.6

    acl_cache_seconds: int = 60
    chat_rate_limit_per_minute: int = 20
    daily_token_limit: int = 200_000
    log_question_text: bool = True

    ingest_embed_batch: int = 64
    embed_rate_limit: str = "120/m"
    web_requests_per_second: float = 1.0
    web_user_agent: str = "NorthwindKB-Crawler/1.0"
    notion_api_url: str = "https://api.notion.com/v1"
    notion_token: str | None = None

    otel_enabled: bool = False
    otel_endpoint: str | None = None
    service_name: str = "kb-api"

    eval_data_dir: str = "../eval-data"


@lru_cache
def get_settings() -> Settings:
    return Settings()


def embedding_dim(model: str) -> int:
    if model not in EMBEDDING_MODELS:
        raise ValueError(f"unknown embedding model {model}")
    return EMBEDDING_MODELS[model]


def price_for(model: str) -> ModelPrice:
    return DEFAULT_PRICES.get(model, ModelPrice(input_per_mtok=Decimal("0"), output_per_mtok=Decimal("0")))
