from __future__ import annotations

import asyncio
import time
from typing import Any, Protocol

import httpx
import jwt
from jwt import PyJWK

from kb.config import Settings
from kb.core.errors import unauthorized


class KeySource(Protocol):
    async def get_key(self, kid: str) -> PyJWK: ...


class StaticJwks:
    def __init__(self, jwks: dict[str, Any]) -> None:
        self._keys = {str(k["kid"]): PyJWK.from_dict(k) for k in jwks.get("keys", [])}

    async def get_key(self, kid: str) -> PyJWK:
        if kid not in self._keys:
            raise unauthorized("Unknown signing key")
        return self._keys[kid]


class RemoteJwks:
    def __init__(self, url: str, ttl_seconds: int, client: httpx.AsyncClient | None = None) -> None:
        self.url = url
        self.ttl = ttl_seconds
        self.client = client or httpx.AsyncClient(timeout=10.0)
        self._keys: dict[str, PyJWK] = {}
        self._fetched_at = 0.0
        self._lock = asyncio.Lock()
        self.min_refresh_interval = 10.0

    async def _refresh(self) -> None:
        response = await self.client.get(self.url)
        response.raise_for_status()
        data = response.json()
        keys: dict[str, PyJWK] = {}
        for raw in data.get("keys", []):
            if raw.get("use", "sig") != "sig" or "kid" not in raw:
                continue
            try:
                keys[str(raw["kid"])] = PyJWK.from_dict(raw)
            except jwt.PyJWTError:
                continue
        self._keys = keys
        self._fetched_at = time.monotonic()

    async def get_key(self, kid: str) -> PyJWK:
        now = time.monotonic()
        expired = now - self._fetched_at > self.ttl
        if kid in self._keys and not expired:
            return self._keys[kid]
        async with self._lock:
            now = time.monotonic()
            stale = now - self._fetched_at > self.ttl
            unknown = kid not in self._keys and now - self._fetched_at > self.min_refresh_interval
            if stale or unknown:
                try:
                    await self._refresh()
                except httpx.HTTPError as exc:
                    if kid not in self._keys:
                        raise unauthorized("Signing keys are unavailable") from exc
        if kid not in self._keys:
            raise unauthorized("Unknown signing key")
        return self._keys[kid]


class TokenVerifier:
    def __init__(self, keys: KeySource, issuer: str, audience: str, leeway: int = 30) -> None:
        self.keys = keys
        self.issuer = issuer
        self.audience = audience
        self.leeway = leeway

    async def verify(self, token: str) -> dict[str, Any]:
        try:
            header = jwt.get_unverified_header(token)
        except jwt.PyJWTError as exc:
            raise unauthorized("Malformed token") from exc
        kid = header.get("kid")
        alg = header.get("alg")
        if not isinstance(kid, str) or alg not in {"RS256", "RS384", "RS512", "ES256", "PS256"}:
            raise unauthorized("Unsupported token header")
        key = await self.keys.get_key(kid)
        try:
            claims: dict[str, Any] = jwt.decode(
                token,
                key=key.key,
                algorithms=[alg],
                audience=self.audience,
                issuer=self.issuer,
                leeway=self.leeway,
                options={"require": ["exp", "iat", "sub", "iss"]},
            )
        except jwt.ExpiredSignatureError as exc:
            raise unauthorized("Token expired") from exc
        except jwt.PyJWTError as exc:
            raise unauthorized(f"Invalid token: {exc}") from exc
        return claims


def build_verifier(settings: Settings) -> TokenVerifier:
    jwks_url = settings.oidc_jwks_url or f"{settings.oidc_issuer}/protocol/openid-connect/certs"
    return TokenVerifier(
        RemoteJwks(jwks_url, settings.oidc_jwks_cache_seconds),
        settings.oidc_issuer,
        settings.oidc_audience,
        settings.oidc_leeway_seconds,
    )
