from __future__ import annotations

import json
import os
import time
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.algorithms import RSAAlgorithm

from kb.config import Settings

ISSUER = "https://issuer.test/realms/northwind"
AUDIENCE = "kb-api"
USERS: dict[str, list[str]] = {
    "alice": ["engineering"],
    "bob": ["sales"],
    "carol": ["finance"],
    "admin": ["kb-admins"],
    "dave": ["hr"],
    "outsider": [],
}


class KeyPair:
    def __init__(self, kid: str = "test-key") -> None:
        self.kid = kid
        self.private = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    def jwk(self) -> dict[str, Any]:
        data: dict[str, Any] = json.loads(RSAAlgorithm.to_jwk(self.private.public_key()))
        data.update({"kid": self.kid, "use": "sig", "alg": "RS256"})
        return data

    def jwks(self) -> dict[str, Any]:
        return {"keys": [self.jwk()]}

    def token(
        self,
        user: str,
        groups: list[str] | None = None,
        issuer: str = ISSUER,
        audience: str = AUDIENCE,
        expires_in: int = 300,
        extra: dict[str, Any] | None = None,
    ) -> str:
        now = int(time.time())
        claims: dict[str, Any] = {
            "sub": f"sub-{user}",
            "iss": issuer,
            "aud": audience,
            "iat": now,
            "exp": now + expires_in,
            "preferred_username": user,
            "email": f"{user}@northwind.example",
            "name": user.title(),
            "groups": groups if groups is not None else USERS.get(user, []),
        }
        claims.update(extra or {})
        return jwt.encode(claims, self.private, algorithm="RS256", headers={"kid": self.kid})


@dataclass
class Infra:
    database_url: str
    redis_url: str
    s3_endpoint: str
    s3_access_key: str
    s3_secret_key: str


@contextmanager
def infrastructure() -> Iterator[Infra]:
    if os.environ.get("TESTCONTAINERS") == "1":
        from testcontainers.minio import MinioContainer
        from testcontainers.postgres import PostgresContainer
        from testcontainers.redis import RedisContainer

        with (
            PostgresContainer("pgvector/pgvector:pg17", driver=None) as pg,
            RedisContainer("redis:7-alpine") as rd,
            MinioContainer() as mn,
        ):
            pg_url = pg.get_connection_url().replace("postgresql://", "postgresql+asyncpg://")
            redis_url = f"redis://{rd.get_container_host_ip()}:{rd.get_exposed_port(6379)}/4"
            config = mn.get_config()
            yield Infra(
                pg_url.rsplit("/", 1)[0],
                redis_url,
                config["endpoint"],
                config["access_key"],
                config["secret_key"],
            )
        return
    yield Infra(
        os.environ.get("TEST_DATABASE_ADMIN_URL", "postgresql+asyncpg://asnh@127.0.0.1:5432"),
        os.environ.get("TEST_REDIS_URL", "redis://127.0.0.1:6379/4"),
        os.environ.get("TEST_S3_ENDPOINT", "127.0.0.1:9002"),
        os.environ.get("TEST_S3_ACCESS_KEY", "minioadmin"),
        os.environ.get("TEST_S3_SECRET_KEY", "minioadmin"),
    )


def make_settings(infra: Infra, tag: str | None = None, **overrides: Any) -> Settings:
    run = tag or uuid.uuid4().hex[:10]
    values: dict[str, Any] = {
        "env": "test",
        "database_url": f"{infra.database_url}/kb_test_{run}",
        "db_pool_size": 5,
        "db_max_overflow": 5,
        "redis_url": infra.redis_url,
        "broker_url": infra.redis_url,
        "redis_prefix": f"kbtest{run}",
        "s3_endpoint": infra.s3_endpoint,
        "s3_public_endpoint": infra.s3_endpoint,
        "s3_access_key": infra.s3_access_key,
        "s3_secret_key": infra.s3_secret_key,
        "s3_bucket": f"kb-test-{run}",
        "oidc_issuer": ISSUER,
        "oidc_audience": AUDIENCE,
        "embedder": "hash",
        "embedding_model": "hash-384",
        "reranker": "fake",
        "tokenizer": "simple",
        "llm_provider": "fake",
        "llm_model": "fake-llm",
        "llm_condense_model": "fake-llm",
        "no_answer_threshold": 0.34,
        "chat_rate_limit_per_minute": 1000,
    }
    values.update(overrides)
    return Settings(**values)


def parse_sse(body: str) -> list[tuple[str, dict[str, Any]]]:
    events: list[tuple[str, dict[str, Any]]] = []
    for block in body.split("\n\n"):
        name = None
        data = None
        for line in block.splitlines():
            if line.startswith("event: "):
                name = line[7:]
            elif line.startswith("data: "):
                data = json.loads(line[6:])
        if name is not None and data is not None:
            events.append((name, data))
    return events
