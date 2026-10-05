from __future__ import annotations

import hashlib
from typing import Any

from pydantic import BaseModel


class Principal(BaseModel):
    sub: str
    email: str | None = None
    name: str | None = None
    username: str | None = None
    groups: list[str] = []
    is_admin: bool = False

    @property
    def groups_hash(self) -> str:
        return hashlib.sha256("|".join(sorted(self.groups)).encode()).hexdigest()[:16]


def principal_from_claims(claims: dict[str, Any], admin_group: str) -> Principal:
    raw_groups = claims.get("groups") or []
    groups: list[str] = []
    if isinstance(raw_groups, list):
        for group in raw_groups:
            if isinstance(group, str):
                groups.append(group.rsplit("/", 1)[-1] if group.startswith("/") else group)
    groups = sorted(set(groups))
    username = claims.get("preferred_username")
    name = claims.get("name") or username
    return Principal(
        sub=str(claims["sub"]),
        email=claims.get("email") if isinstance(claims.get("email"), str) else None,
        name=name if isinstance(name, str) else None,
        username=username if isinstance(username, str) else None,
        groups=groups,
        is_admin=admin_group in groups,
    )
