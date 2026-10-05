from __future__ import annotations

from typing import Any

import httpx
import pytest
import respx

from kb.auth.principal import principal_from_claims
from kb.core.errors import ProblemError
from kb.core.security import RemoteJwks, StaticJwks, TokenVerifier
from tests.support import AUDIENCE, ISSUER, KeyPair

KEYS = KeyPair("k1")


def verifier() -> TokenVerifier:
    return TokenVerifier(StaticJwks(KEYS.jwks()), ISSUER, AUDIENCE, leeway=0)


async def test_valid_token_yields_claims_and_principal() -> None:
    claims = await verifier().verify(KEYS.token("alice", ["/engineering", "kb-admins"]))
    principal = principal_from_claims(claims, "kb-admins")
    assert principal.groups == ["engineering", "kb-admins"]
    assert principal.is_admin
    assert principal.username == "alice"


@pytest.mark.parametrize(
    ("kwargs", "detail"),
    [
        ({"expires_in": -60}, "Token expired"),
        ({"audience": "other"}, "Invalid token"),
        ({"issuer": "https://evil.test"}, "Invalid token"),
    ],
)
async def test_rejects_expired_wrong_audience_and_issuer(kwargs: dict[str, Any], detail: str) -> None:
    with pytest.raises(ProblemError) as error:
        await verifier().verify(KEYS.token("alice", **kwargs))
    assert error.value.status == 401
    assert detail in str(error.value.detail)


async def test_rejects_unknown_key_and_garbage() -> None:
    other = KeyPair("k2")
    with pytest.raises(ProblemError):
        await verifier().verify(other.token("alice"))
    with pytest.raises(ProblemError):
        await verifier().verify("not-a-jwt")


async def test_rejects_hs256_algorithm_confusion() -> None:
    import jwt

    forged = jwt.encode(
        {"sub": "x", "iss": ISSUER, "aud": AUDIENCE, "exp": 9999999999, "iat": 1},
        "secret",
        algorithm="HS256",
        headers={"kid": "k1"},
    )
    with pytest.raises(ProblemError):
        await verifier().verify(forged)


@respx.mock
async def test_remote_jwks_is_cached_and_refreshed_on_rotation() -> None:
    url = "https://issuer.test/certs"
    rotated = KeyPair("k-new")
    route = respx.get(url).mock(
        side_effect=[httpx.Response(200, json=KEYS.jwks()), httpx.Response(200, json=rotated.jwks())]
    )
    jwks = RemoteJwks(url, ttl_seconds=3600)
    jwks.min_refresh_interval = 0
    tv = TokenVerifier(jwks, ISSUER, AUDIENCE)
    await tv.verify(KEYS.token("alice"))
    await tv.verify(KEYS.token("bob"))
    assert route.call_count == 1
    await tv.verify(rotated.token("carol"))
    assert route.call_count == 2
