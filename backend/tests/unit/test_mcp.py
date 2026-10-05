from __future__ import annotations

import httpx
import pytest
import respx
from mcp.server.mcpserver.exceptions import ToolError

from kb.mcp.server import KnowledgeClient, bearer_token, build_server, tool_error

API = "http://kb.test"


@respx.mock
async def test_tools_forward_user_token_and_shape_results() -> None:
    search = respx.post(f"{API}/api/v1/search").mock(
        return_value=httpx.Response(
            200,
            json={
                "results": [
                    {
                        "rank": 1,
                        "title": "Travel Policy",
                        "page": 4,
                        "heading_path": ["Travel Policy", "Per diem"],
                        "text": "Europe is €65 per day.",
                        "document_id": "d1",
                        "chunk_id": "c1",
                        "scores": {"rerank": 0.97, "rrf": 0.03},
                    }
                ]
            },
        )
    )
    respx.get(f"{API}/api/v1/documents/d1").mock(
        return_value=httpx.Response(
            200,
            json={
                "id": "d1",
                "title": "Travel Policy",
                "mime_type": "application/pdf",
                "status": "ready",
                "page_count": 5,
            },
        )
    )
    respx.get(f"{API}/api/v1/documents/d1/chunks").mock(
        side_effect=[
            httpx.Response(200, json={"items": [{"text": "Part one."}], "next_cursor": "x"}),
            httpx.Response(200, json={"items": [{"text": "Part two."}], "next_cursor": None}),
        ]
    )
    client = KnowledgeClient(API, "user-token", httpx.AsyncClient())
    server = build_server(client)
    tools = {tool.name for tool in await server.list_tools()}
    assert tools == {"search_knowledge", "get_document"}
    hits = await client.search("per diem europe", 3)
    assert hits[0].section == "Travel Policy > Per diem"
    assert hits[0].score == 0.97
    assert search.calls.last.request.headers["Authorization"] == "Bearer user-token"
    document = await client.document("d1")
    assert document.text == "Part one.\n\nPart two."
    assert not document.truncated


@respx.mock
async def test_acl_errors_propagate() -> None:
    respx.get(f"{API}/api/v1/documents/secret").mock(
        return_value=httpx.Response(404, json={"code": "NOT_FOUND"})
    )
    client = KnowledgeClient(API, "user-token", httpx.AsyncClient())
    with pytest.raises(httpx.HTTPStatusError) as error:
        await client.document("secret")
    assert error.value.response.status_code == 404


def test_bearer_token_parsing() -> None:
    assert bearer_token({"authorization": "Bearer abc.def"}) == "abc.def"
    assert bearer_token({"Authorization": "bearer  xyz "}) == "xyz"
    assert bearer_token({"authorization": "Basic Zm9v"}) is None
    assert bearer_token({"authorization": "Bearer "}) is None
    assert bearer_token(None) is None


async def test_missing_token_is_a_tool_error() -> None:
    client = KnowledgeClient(API, None, httpx.AsyncClient())
    with pytest.raises(ToolError):
        await client.search("anything")


@respx.mock
async def test_per_request_token_overrides_default() -> None:
    route = respx.post(f"{API}/api/v1/search").mock(return_value=httpx.Response(200, json={"results": []}))
    client = KnowledgeClient(API, "default-token", httpx.AsyncClient())
    await client.search("q", 3, "caller-token")
    assert route.calls.last.request.headers["Authorization"] == "Bearer caller-token"
    error = httpx.HTTPStatusError("x", request=httpx.Request("GET", API), response=httpx.Response(404))
    assert "not accessible" in str(tool_error(error))
