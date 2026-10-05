from __future__ import annotations

import uuid
from collections.abc import Callable

import pytest
from httpx import AsyncClient

from kb.core.container import Container
from tests.integration.helpers import standard_setup

USERS = ["alice", "bob", "carol", "dave", "admin", "outsider"]
COLLECTIONS = ["handbook", "engineering", "finance", "hr"]
ROLES: dict[tuple[str, str], str | None] = {
    ("alice", "handbook"): "viewer",
    ("alice", "engineering"): "editor",
    ("alice", "finance"): None,
    ("alice", "hr"): None,
    ("bob", "handbook"): "viewer",
    ("bob", "engineering"): "viewer",
    ("bob", "finance"): None,
    ("bob", "hr"): None,
    ("carol", "handbook"): "viewer",
    ("carol", "engineering"): None,
    ("carol", "finance"): "owner",
    ("carol", "hr"): None,
    ("dave", "handbook"): "viewer",
    ("dave", "engineering"): None,
    ("dave", "finance"): None,
    ("dave", "hr"): "editor",
    ("admin", "handbook"): "owner",
    ("admin", "engineering"): "owner",
    ("admin", "finance"): "owner",
    ("admin", "hr"): "owner",
    ("outsider", "handbook"): None,
    ("outsider", "engineering"): None,
    ("outsider", "finance"): None,
    ("outsider", "hr"): None,
}
RANK = {None: 0, "viewer": 1, "editor": 2, "owner": 3}


def expected(role: str | None, action: str) -> int:
    need = {"read": 1, "write": 2, "manage": 3}[action]
    if RANK[role] == 0:
        return 404
    return 200 if RANK[role] >= need else 403


@pytest.fixture
async def ids(clean: None, container: Container) -> dict[str, uuid.UUID]:
    return await standard_setup(container)


async def test_acl_matrix_user_collection_action(
    client: AsyncClient, ids: dict[str, uuid.UUID], auth: Callable[..., dict[str, str]]
) -> None:
    failures: list[str] = []
    checked = 0
    for user in USERS:
        headers = auth(user)
        listed = (await client.get("/api/v1/collections", headers=headers)).json()["items"]
        listed_ids = {c["id"] for c in listed}
        for name in COLLECTIONS:
            role = ROLES[(user, name)]
            cid = ids[name]
            visible = str(cid) in listed_ids
            if visible != (role is not None):
                failures.append(f"{user}/{name}: list visibility {visible}")
            read = await client.get(f"/api/v1/collections/{cid}", headers=headers)
            docs = await client.get(f"/api/v1/collections/{cid}/documents", headers=headers)
            write = await client.post(
                f"/api/v1/collections/{cid}/documents/upload-url",
                headers=headers,
                json={"filename": "x.md", "size": 10},
            )
            manage = await client.get(f"/api/v1/collections/{cid}/grants", headers=headers)
            patch = await client.patch(
                f"/api/v1/collections/{cid}", headers=headers, json={"description": "updated"}
            )
            for action, response in (
                ("read", read),
                ("read", docs),
                ("write", write),
                ("manage", manage),
                ("manage", patch),
            ):
                checked += 1
                if response.status_code != expected(role, action):
                    failures.append(
                        f"{user}/{name}/{action}: {response.status_code} != {expected(role, action)}"
                    )
                if response.status_code in {403, 404}:
                    assert response.headers["content-type"].startswith("application/problem+json")
            if role is not None:
                assert read.json()["role"] == role
    assert not failures, failures
    assert checked == len(USERS) * len(COLLECTIONS) * 5


async def test_only_admins_create_collections(
    client: AsyncClient, clean: None, auth: Callable[..., dict[str, str]]
) -> None:
    body = {"name": "New", "grants": [{"principal_type": "group", "principal_id": "sales", "role": "viewer"}]}
    denied = await client.post("/api/v1/collections", headers=auth("alice"), json=body)
    assert denied.status_code == 403
    created = await client.post("/api/v1/collections", headers=auth("admin"), json=body)
    assert created.status_code == 201
    assert created.json()["embedding_model"] == "hash-384"
    bob = await client.get("/api/v1/collections", headers=auth("bob"))
    assert [c["name"] for c in bob.json()["items"]] == ["New"]


async def test_grant_change_invalidates_acl_cache(
    client: AsyncClient, ids: dict[str, uuid.UUID], auth: Callable[..., dict[str, str]]
) -> None:
    finance = ids["finance"]
    assert (await client.get(f"/api/v1/collections/{finance}", headers=auth("bob"))).status_code == 404
    grants = (await client.get(f"/api/v1/collections/{finance}/grants", headers=auth("carol"))).json()
    grants.append({"principal_type": "group", "principal_id": "sales", "role": "viewer"})
    put = await client.put(
        f"/api/v1/collections/{finance}/grants", headers=auth("carol"), json={"grants": grants}
    )
    assert put.status_code == 200
    assert (await client.get(f"/api/v1/collections/{finance}", headers=auth("bob"))).status_code == 200
    search = await client.post("/api/v1/search", headers=auth("bob"), json={"query": "marketing budget Q3"})
    assert any(r["collection_id"] == str(finance) for r in search.json()["results"])
    revoked = [g for g in grants if g["principal_id"] != "sales"]
    await client.put(f"/api/v1/collections/{finance}/grants", headers=auth("carol"), json={"grants": revoked})
    assert (await client.get(f"/api/v1/collections/{finance}", headers=auth("bob"))).status_code == 404


async def test_owner_must_remain(
    client: AsyncClient, ids: dict[str, uuid.UUID], auth: Callable[..., dict[str, str]]
) -> None:
    response = await client.put(
        f"/api/v1/collections/{ids['finance']}/grants",
        headers=auth("carol"),
        json={"grants": [{"principal_type": "group", "principal_id": "finance", "role": "viewer"}]},
    )
    assert response.status_code == 400
    assert response.json()["code"] == "OWNER_REQUIRED"


async def test_unauthenticated_and_invalid_tokens(client: AsyncClient, clean: None) -> None:
    assert (await client.get("/api/v1/me")).status_code == 401
    bad = await client.get("/api/v1/me", headers={"Authorization": "Bearer abc.def.ghi"})
    assert bad.status_code == 401
    assert bad.json()["code"] == "UNAUTHORIZED"


async def test_me_lists_collections_with_roles(
    client: AsyncClient, ids: dict[str, uuid.UUID], auth: Callable[..., dict[str, str]]
) -> None:
    me = (await client.get("/api/v1/me", headers=auth("alice"))).json()
    assert me["groups"] == ["engineering"]
    assert not me["is_admin"]
    assert {c["name"]: c["role"] for c in me["collections"]} == {
        "Engineering": "editor",
        "Handbook": "viewer",
    }
