from __future__ import annotations

import asyncio
import json
import os
import socket
import subprocess
import sys
import uuid
from collections.abc import AsyncIterator, Iterator
from typing import Any

import httpx
import httpx2
import pytest
import uvicorn
from mcp import Client
from mcp.client.stdio import StdioServerParameters
from mcp.client.streamable_http import streamable_http_client
from mcp.types import CallToolResult, TextContent

from kb.core.container import Container
from kb.main import create_app
from tests.integration.helpers import standard_setup
from tests.support import KeyPair

BUDGET_QUESTION = "approved Q3 marketing budget"


@pytest.fixture
async def ids(container: Container, clean: None) -> dict[str, uuid.UUID]:
    return await standard_setup(container)


@pytest.fixture
async def live_api(container: Container, dispatched: list[tuple[str, uuid.UUID]]) -> AsyncIterator[str]:
    app = create_app(container.settings, container=container)
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=0, log_level="warning", lifespan="on"))
    task = asyncio.create_task(server.serve())
    while not server.started:
        await asyncio.sleep(0.05)
    port = server.servers[0].sockets[0].getsockname()[1]
    try:
        yield f"http://127.0.0.1:{port}"
    finally:
        server.should_exit = True
        await task


async def finance_document(
    container: Container, ids: dict[str, uuid.UUID], live_api: str, keys: KeyPair
) -> str:
    async with httpx.AsyncClient(base_url=live_api, timeout=30) as client:
        response = await client.get(
            f"/api/v1/collections/{ids['finance']}/documents",
            headers={"Authorization": f"Bearer {keys.token('carol')}"},
        )
        response.raise_for_status()
        return str(response.json()["items"][0]["id"])


def structured(result: CallToolResult) -> Any:
    assert not result.is_error, result.content
    if result.structured_content is not None:
        return result.structured_content.get("result", result.structured_content)
    texts = [block.text for block in result.content if isinstance(block, TextContent)]
    return json.loads(texts[0]) if texts else None


def error_text(result: CallToolResult) -> str:
    assert result.is_error
    return " ".join(block.text for block in result.content if isinstance(block, TextContent))


def stdio_params(api_url: str, token: str) -> StdioServerParameters:
    return StdioServerParameters(
        command=sys.executable,
        args=["-m", "kb.mcp.server", "--transport", "stdio", "--api-url", api_url],
        env={"KB_MCP_TOKEN": token, "PYTHONPATH": os.pathsep.join(sys.path)},
    )


async def check_user_view(client: Client, document_id: str, sees_finance: bool) -> None:
    tools = await client.list_tools()
    names = {tool.name for tool in tools.tools}
    assert names == {"search_knowledge", "get_document"}
    schemas = {tool.name: tool.input_schema for tool in tools.tools}
    assert "query" in schemas["search_knowledge"]["properties"]
    assert "id" in schemas["get_document"]["properties"]

    hits = structured(await client.call_tool("search_knowledge", {"query": BUDGET_QUESTION, "k": 5}))
    titles = {hit["title"] for hit in hits}
    texts = " ".join(hit["snippet"] for hit in hits)
    document = await client.call_tool("get_document", {"id": document_id})
    if sees_finance:
        assert "Q3 Budget" in titles
        assert "$420,000" in texts
        view = structured(document)
        assert view["id"] == document_id
        assert "$420,000" in view["text"]
    else:
        assert "Q3 Budget" not in titles
        assert "$420,000" not in texts
        assert all(hit["document_id"] != document_id for hit in hits)
        assert "not accessible" in error_text(document)


@pytest.mark.parametrize(("user", "sees_finance"), [("carol", True), ("bob", False)])
async def test_stdio_client_enforces_acl_per_user(
    container: Container,
    ids: dict[str, uuid.UUID],
    live_api: str,
    keys: KeyPair,
    user: str,
    sees_finance: bool,
) -> None:
    document_id = await finance_document(container, ids, live_api, keys)
    async with Client(stdio_params(live_api, keys.token(user)), read_timeout_seconds=60) as client:
        await check_user_view(client, document_id, sees_finance)


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


@pytest.fixture
def mcp_http(live_api: str) -> Iterator[str]:
    port = free_port()
    env = {**os.environ, "PYTHONPATH": os.pathsep.join(sys.path)}
    env.pop("KB_MCP_TOKEN", None)
    process = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "kb.mcp.server",
            "--transport",
            "streamable-http",
            "--port",
            str(port),
            "--api-url",
            live_api,
        ],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    try:
        yield f"http://127.0.0.1:{port}/mcp"
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()


async def wait_for_port(url: str) -> None:
    host_port = url.split("//", 1)[1].split("/", 1)[0]
    host, port = host_port.split(":")
    for _ in range(200):
        try:
            _, writer = await asyncio.open_connection(host, int(port))
            writer.close()
            await writer.wait_closed()
            return
        except OSError:
            await asyncio.sleep(0.05)
    raise AssertionError(f"MCP server did not start on {url}")


async def test_streamable_http_client_uses_each_callers_token(
    container: Container, ids: dict[str, uuid.UUID], live_api: str, keys: KeyPair, mcp_http: str
) -> None:
    await wait_for_port(mcp_http)
    document_id = await finance_document(container, ids, live_api, keys)
    async with httpx.AsyncClient(timeout=10) as raw:
        anonymous = await raw.post(mcp_http, json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
        assert anonymous.status_code == 401
        assert anonymous.headers["www-authenticate"] == "Bearer"
    for user, sees_finance in (("carol", True), ("bob", False)):
        headers = {"Authorization": f"Bearer {keys.token(user)}"}
        async with (
            httpx2.AsyncClient(headers=headers, timeout=60) as http,
            Client(streamable_http_client(mcp_http, http_client=http), read_timeout_seconds=60) as client,
        ):
            await check_user_view(client, document_id, sees_finance)
    forged = KeyPair("other-key").token("carol")
    async with (
        httpx2.AsyncClient(headers={"Authorization": f"Bearer {forged}"}, timeout=60) as http,
        Client(streamable_http_client(mcp_http, http_client=http), read_timeout_seconds=60) as client,
    ):
        result = await client.call_tool("search_knowledge", {"query": BUDGET_QUESTION})
        assert "rejected" in error_text(result)
