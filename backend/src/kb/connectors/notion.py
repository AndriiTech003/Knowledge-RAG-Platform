from __future__ import annotations

import uuid
from typing import Any

import httpx

from kb.connectors.base import FetchedDocument, PageState, SyncPlan

NOTION_VERSION = "2022-06-28"
HEADING_PREFIX = {"heading_1": "# ", "heading_2": "## ", "heading_3": "### "}


def rich_text(items: list[dict[str, Any]]) -> str:
    return "".join(str(item.get("plain_text", "")) for item in items)


def page_title(page: dict[str, Any]) -> str:
    for prop in (page.get("properties") or {}).values():
        if isinstance(prop, dict) and prop.get("type") == "title":
            return rich_text(prop.get("title", [])) or "Untitled"
    return "Untitled"


class NotionConnector:
    kind = "notion"

    def __init__(
        self,
        token: str | None,
        base_url: str = "https://api.notion.com/v1",
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.token = token
        self.base_url = base_url.rstrip("/")
        self.client = client

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.token}",
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
        }

    async def _paged(
        self, client: httpx.AsyncClient, method: str, path: str, body: dict[str, Any] | None = None
    ) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        cursor: str | None = None
        while True:
            if method == "POST":
                payload = dict(body or {})
                if cursor:
                    payload["start_cursor"] = cursor
                response = await client.post(f"{self.base_url}{path}", json=payload, headers=self._headers())
            else:
                params = {"page_size": "100", **({"start_cursor": cursor} if cursor else {})}
                response = await client.get(f"{self.base_url}{path}", params=params, headers=self._headers())
            response.raise_for_status()
            data = response.json()
            results.extend(data.get("results", []))
            if not data.get("has_more"):
                return results
            cursor = data.get("next_cursor")

    async def _blocks_markdown(self, client: httpx.AsyncClient, block_id: str, depth: int = 0) -> list[str]:
        lines: list[str] = []
        table_rows: list[list[str]] = []
        for block in await self._paged(client, "GET", f"/blocks/{block_id}/children"):
            kind = str(block.get("type", ""))
            body = block.get(kind, {}) if isinstance(block.get(kind), dict) else {}
            text = rich_text(body.get("rich_text", []))
            if kind != "table_row" and table_rows:
                lines.append(self._table(table_rows))
                table_rows = []
            if kind in HEADING_PREFIX:
                lines.append(HEADING_PREFIX[kind] + text)
            elif kind == "paragraph":
                if text:
                    lines.append(text)
            elif kind in {"bulleted_list_item", "to_do"}:
                lines.append("  " * depth + "- " + text)
            elif kind == "numbered_list_item":
                lines.append("  " * depth + "1. " + text)
            elif kind == "code":
                lines.append("```\n" + text + "\n```")
            elif kind in {"quote", "callout"}:
                lines.append("> " + text)
            elif kind == "table_row":
                table_rows.append([rich_text(cell) for cell in body.get("cells", [])])
            if block.get("has_children") and kind not in {"child_page", "child_database"} and depth < 3:
                lines.extend(await self._blocks_markdown(client, str(block["id"]), depth + 1))
        if table_rows:
            lines.append(self._table(table_rows))
        return lines

    @staticmethod
    def _table(rows: list[list[str]]) -> str:
        width = max(len(r) for r in rows)
        out = ["| " + " | ".join(rows[0]) + " |", "|" + "|".join("---" for _ in range(width)) + "|"]
        out.extend("| " + " | ".join(r) + " |" for r in rows[1:])
        return "\n".join(out)

    async def fetch(
        self, source_id: uuid.UUID, config: dict[str, Any], state: dict[str, PageState]
    ) -> SyncPlan:
        token = self.token or config.get("token")
        if not token:
            return SyncPlan(errors=["Notion token is not configured"])
        self.token = str(token)
        own = self.client is None
        client = self.client or httpx.AsyncClient(timeout=30.0)
        plan = SyncPlan()
        try:
            database_id = config.get("databaseId")
            if database_id:
                pages = await self._paged(client, "POST", f"/databases/{database_id}/query", {})
            else:
                body: dict[str, Any] = {"filter": {"property": "object", "value": "page"}}
                if config.get("query"):
                    body["query"] = config["query"]
                pages = await self._paged(client, "POST", "/search", body)
            seen: set[str] = set()
            for page in pages:
                page_id = str(page.get("id"))
                url = str(page.get("url") or f"notion://{page_id}")
                seen.add(url)
                if page.get("archived") or page.get("in_trash"):
                    plan.deletions.append(url)
                    continue
                edited = str(page.get("last_edited_time") or "")
                previous = state.get(url)
                if previous is not None and previous.etag == edited and previous.last_status == 200:
                    plan.unchanged.append(url)
                    plan.states.append(PageState(url, edited, None, 200))
                    continue
                title = page_title(page)
                lines = [f"# {title}", *await self._blocks_markdown(client, page_id)]
                markdown = "\n\n".join(lines) + "\n"
                plan.upserts.append(
                    FetchedDocument(
                        external_id=url,
                        title=title,
                        content=markdown.encode("utf-8"),
                        mime_type="text/markdown",
                        filename=f"notion-{page_id}.md",
                        etag=edited,
                        metadata={"notion_page_id": page_id, "url": url, "last_edited_time": edited},
                    )
                )
                plan.states.append(PageState(url, edited, None, 200))
            for url, page_state in state.items():
                if url not in seen and page_state.last_status == 200:
                    plan.deletions.append(url)
        except httpx.HTTPError as exc:
            plan.errors.append(f"notion: {exc}")
        finally:
            if own:
                await client.aclose()
        return plan
