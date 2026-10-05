from __future__ import annotations

import argparse
import os
from collections.abc import Mapping
from typing import Any

import httpx
import uvicorn
from mcp.server.mcpserver import Context, MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from pydantic import BaseModel
from starlette.types import ASGIApp, Receive, Scope, Send


class SearchHit(BaseModel):
    rank: int
    title: str
    page: int | None
    section: str
    snippet: str
    document_id: str
    chunk_id: str
    score: float | None


class DocumentView(BaseModel):
    id: str
    title: str
    mime_type: str
    status: str
    page_count: int | None
    text: str
    truncated: bool


class KnowledgeClient:
    def __init__(
        self, api_url: str, token: str | None = None, client: httpx.AsyncClient | None = None
    ) -> None:
        self.api_url = api_url.rstrip("/") + "/api/v1"
        self.token = token
        self.client = client or httpx.AsyncClient(timeout=60)

    def headers(self, token: str | None = None) -> dict[str, str]:
        value = token or self.token
        if not value:
            raise ToolError("No user access token: send 'Authorization: Bearer <token>' or set KB_MCP_TOKEN")
        return {"Authorization": f"Bearer {value}"}

    async def search(self, query: str, k: int = 5, token: str | None = None) -> list[SearchHit]:
        response = await self.client.post(
            f"{self.api_url}/search",
            headers=self.headers(token),
            json={"query": query, "k": max(1, min(k, 20))},
        )
        response.raise_for_status()
        hits: list[SearchHit] = []
        for item in response.json()["results"]:
            path = item.get("heading_path") or []
            hits.append(
                SearchHit(
                    rank=item["rank"],
                    title=item["title"],
                    page=item.get("page"),
                    section=" > ".join(path),
                    snippet=str(item.get("text", ""))[:1200],
                    document_id=item["document_id"],
                    chunk_id=item["chunk_id"],
                    score=item["scores"].get("rerank") or item["scores"].get("rrf"),
                )
            )
        return hits

    async def document(
        self, document_id: str, max_chars: int = 20000, token: str | None = None
    ) -> DocumentView:
        headers = self.headers(token)
        detail = await self.client.get(f"{self.api_url}/documents/{document_id}", headers=headers)
        detail.raise_for_status()
        meta = detail.json()
        parts: list[str] = []
        cursor: str | None = None
        size = 0
        truncated = False
        while True:
            params: dict[str, Any] = {"limit": 200}
            if cursor:
                params["cursor"] = cursor
            page = await self.client.get(
                f"{self.api_url}/documents/{document_id}/chunks", headers=headers, params=params
            )
            page.raise_for_status()
            data = page.json()
            for chunk in data["items"]:
                parts.append(chunk["text"])
                size += len(chunk["text"])
            cursor = data.get("next_cursor")
            if size >= max_chars:
                truncated = True
                break
            if not cursor:
                break
        text = "\n\n".join(parts)
        return DocumentView(
            id=meta["id"],
            title=meta["title"],
            mime_type=meta["mime_type"],
            status=meta["status"],
            page_count=meta.get("page_count"),
            text=text[:max_chars],
            truncated=truncated or len(text) > max_chars,
        )


def bearer_token(headers: Mapping[str, str] | None) -> str | None:
    if not headers:
        return None
    value = headers.get("authorization") or headers.get("Authorization") or ""
    scheme, _, token = value.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    return token.strip()


def tool_error(error: httpx.HTTPStatusError) -> ToolError:
    status = error.response.status_code
    if status == 401:
        return ToolError("The access token was rejected by the knowledge base (401)")
    if status in (403, 404):
        return ToolError("Not found or not accessible with your permissions")
    return ToolError(f"Knowledge base request failed ({status})")


def build_server(client: KnowledgeClient) -> MCPServer[Any]:
    server: MCPServer[Any] = MCPServer(
        name="northwind-kb",
        instructions="Search the Northwind knowledge base with the caller's permissions and read documents.",
    )

    @server.tool(description="Hybrid search over documents the user can access. Returns ranked passages.")
    async def search_knowledge(query: str, ctx: Context, k: int = 5) -> list[SearchHit]:
        try:
            return await client.search(query, k, bearer_token(ctx.headers))
        except httpx.HTTPStatusError as error:
            raise tool_error(error) from error

    @server.tool(description="Read a document the user can access, as plain text assembled from its chunks.")
    async def get_document(id: str, ctx: Context) -> DocumentView:
        try:
            return await client.document(id, token=bearer_token(ctx.headers))
        except httpx.HTTPStatusError as error:
            raise tool_error(error) from error

    return server


class RequireBearer:
    def __init__(self, app: ASGIApp, path: str = "/mcp") -> None:
        self.app = app
        self.path = path

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and str(scope.get("path", "")).startswith(self.path):
            headers = {key.decode().lower(): value.decode() for key, value in scope.get("headers", [])}
            if bearer_token(headers) is None:
                await send(
                    {
                        "type": "http.response.start",
                        "status": 401,
                        "headers": [
                            (b"content-type", b"application/json"),
                            (b"www-authenticate", b"Bearer"),
                        ],
                    }
                )
                await send({"type": "http.response.body", "body": b'{"error":"missing bearer token"}'})
                return
        await self.app(scope, receive, send)


def http_app(client: KnowledgeClient) -> ASGIApp:
    server = build_server(client)
    app = server.streamable_http_app(host="127.0.0.1")
    return app if client.token else RequireBearer(app)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="kb-mcp")
    parser.add_argument("--api-url", default=os.environ.get("KB_MCP_API_URL", "http://127.0.0.1:4400"))
    parser.add_argument("--transport", choices=["stdio", "streamable-http"], default="stdio")
    parser.add_argument("--port", type=int, default=4430)
    args = parser.parse_args(argv)
    token = os.environ.get("KB_MCP_TOKEN") or None
    if args.transport == "stdio":
        if not token:
            raise SystemExit(
                "KB_MCP_TOKEN (a user access token) is required for stdio; ACL is enforced by the API"
            )
        build_server(KnowledgeClient(args.api_url, token)).run("stdio")
        return 0
    uvicorn.run(
        http_app(KnowledgeClient(args.api_url, token)), host="127.0.0.1", port=args.port, log_level="warning"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
