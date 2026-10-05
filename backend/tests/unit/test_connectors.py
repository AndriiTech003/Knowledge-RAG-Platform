from __future__ import annotations

import time
import uuid
from datetime import UTC, datetime, timedelta

import httpx
import respx

from kb.connectors.base import PageState
from kb.connectors.notion import NotionConnector
from kb.connectors.sync import is_due
from kb.connectors.web_crawler import WebCrawler, normalize_url

SITE = "https://docs.example.test"


def page(title: str, body: str, links: list[str] | None = None) -> str:
    anchors = "".join(f'<a href="{href}">{href}</a>' for href in links or [])
    return (
        f"<html><head><title>{title}</title></head><body><nav>{anchors}</nav>"
        f"<main><h1>{title}</h1><p>{body}</p></main></body></html>"
    )


def crawler() -> WebCrawler:
    return WebCrawler(client=httpx.AsyncClient(), requests_per_second=1000)


@respx.mock
async def test_crawl_respects_robots_depth_and_patterns() -> None:
    respx.get(f"{SITE}/robots.txt").mock(
        return_value=httpx.Response(200, text="User-agent: *\nDisallow: /private\n")
    )
    respx.get(f"{SITE}/").mock(
        return_value=httpx.Response(200, html=page("Home", "Welcome", ["/a", "/private/x", "/blog/1"]))
    )
    respx.get(f"{SITE}/a").mock(
        return_value=httpx.Response(200, html=page("A", "Alpha", ["/b"]), headers={"ETag": '"a1"'})
    )
    respx.get(f"{SITE}/b").mock(return_value=httpx.Response(200, html=page("B", "Beta")))
    private = respx.get(f"{SITE}/private/x").mock(return_value=httpx.Response(200, html=page("P", "secret")))
    blog = respx.get(f"{SITE}/blog/1").mock(return_value=httpx.Response(200, html=page("Blog", "post")))
    plan = await crawler().fetch(
        uuid.uuid4(), {"startUrl": f"{SITE}/", "maxDepth": 1, "excludePatterns": ["/blog/"]}, {}
    )
    urls = sorted(d.external_id for d in plan.upserts)
    assert urls == [f"{SITE}/", f"{SITE}/a"]
    assert not private.called
    assert not blog.called
    etags = {s.url: s.etag for s in plan.states}
    assert etags[f"{SITE}/a"] == '"a1"'


@respx.mock
async def test_sitemap_conditional_requests_and_deletions() -> None:
    respx.get(f"{SITE}/robots.txt").mock(return_value=httpx.Response(404))
    sitemap = (
        '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        f"<url><loc>{SITE}/one</loc></url><url><loc>{SITE}/two</loc></url></urlset>"
    )
    respx.get(f"{SITE}/sitemap.xml").mock(return_value=httpx.Response(200, text=sitemap))
    one = respx.get(f"{SITE}/one").mock(return_value=httpx.Response(304))
    respx.get(f"{SITE}/two").mock(return_value=httpx.Response(200, html=page("Two", "new text")))
    respx.get(f"{SITE}/gone").mock(return_value=httpx.Response(404))
    state = {
        f"{SITE}/one": PageState(f"{SITE}/one", '"e1"', "Wed, 01 Oct 2026 10:00:00 GMT", 200),
        f"{SITE}/gone": PageState(f"{SITE}/gone", None, None, 200),
    }
    plan = await crawler().fetch(uuid.uuid4(), {"startUrl": f"{SITE}/sitemap.xml"}, state)
    assert plan.unchanged == [f"{SITE}/one"]
    assert [d.external_id for d in plan.upserts] == [f"{SITE}/two"]
    assert plan.deletions == [f"{SITE}/gone"]
    request = one.calls.last.request
    assert request.headers["If-None-Match"] == '"e1"'
    assert request.headers["If-Modified-Since"].startswith("Wed")


@respx.mock
async def test_canonical_url_becomes_external_id() -> None:
    respx.get(f"{SITE}/robots.txt").mock(return_value=httpx.Response(404))
    html = page("X", "text").replace("<head>", f'<head><link rel="canonical" href="{SITE}/canonical/x/">')
    respx.get(f"{SITE}/x?utm=1").mock(return_value=httpx.Response(200, html=html))
    plan = await crawler().fetch(uuid.uuid4(), {"startUrl": f"{SITE}/x?utm=1", "maxDepth": 0}, {})
    assert plan.upserts[0].external_id == f"{SITE}/canonical/x"


@respx.mock
async def test_rate_limit_spaces_requests_per_domain() -> None:
    respx.get(f"{SITE}/robots.txt").mock(return_value=httpx.Response(404))
    respx.get(f"{SITE}/").mock(return_value=httpx.Response(200, html=page("Home", "h", ["/a"])))
    respx.get(f"{SITE}/a").mock(return_value=httpx.Response(200, html=page("A", "a")))
    slow = WebCrawler(client=httpx.AsyncClient(), requests_per_second=10)
    started = time.monotonic()
    await slow.fetch(uuid.uuid4(), {"startUrl": f"{SITE}/", "maxDepth": 1}, {})
    assert time.monotonic() - started >= 0.2


def test_normalize_url() -> None:
    assert normalize_url("HTTPS://Docs.Example.test/a/#frag") == "https://docs.example.test/a"
    assert normalize_url("https://x.test") == "https://x.test/"


NOTION = "https://api.notion.test/v1"


@respx.mock
async def test_notion_pages_become_markdown_and_incremental() -> None:
    pages = {
        "results": [
            {
                "id": "p1",
                "url": "https://notion.so/p1",
                "last_edited_time": "2026-09-01T10:00:00Z",
                "properties": {"Name": {"type": "title", "title": [{"plain_text": "Onboarding"}]}},
            },
            {
                "id": "p2",
                "url": "https://notion.so/p2",
                "last_edited_time": "2026-09-02T10:00:00Z",
                "archived": True,
                "properties": {},
            },
            {
                "id": "p3",
                "url": "https://notion.so/p3",
                "last_edited_time": "2026-08-01T10:00:00Z",
                "properties": {"Name": {"type": "title", "title": [{"plain_text": "Old"}]}},
            },
        ],
        "has_more": False,
    }
    search = respx.post(f"{NOTION}/search").mock(return_value=httpx.Response(200, json=pages))
    blocks = {
        "results": [
            {"id": "b1", "type": "heading_2", "heading_2": {"rich_text": [{"plain_text": "Laptop"}]}},
            {
                "id": "b2",
                "type": "paragraph",
                "paragraph": {"rich_text": [{"plain_text": "Pick it up on day one."}]},
            },
            {
                "id": "b3",
                "type": "bulleted_list_item",
                "bulleted_list_item": {"rich_text": [{"plain_text": "Charger"}]},
            },
            {
                "id": "b4",
                "type": "table_row",
                "table_row": {"cells": [[{"plain_text": "Item"}], [{"plain_text": "Qty"}]]},
            },
            {
                "id": "b5",
                "type": "table_row",
                "table_row": {"cells": [[{"plain_text": "Mouse"}], [{"plain_text": "1"}]]},
            },
        ],
        "has_more": False,
    }
    respx.get(f"{NOTION}/blocks/p1/children").mock(return_value=httpx.Response(200, json=blocks))
    state = {
        "https://notion.so/p3": PageState("https://notion.so/p3", "2026-08-01T10:00:00Z", None, 200),
        "https://notion.so/p9": PageState("https://notion.so/p9", "x", None, 200),
    }
    connector = NotionConnector("secret", NOTION, client=httpx.AsyncClient())
    plan = await connector.fetch(uuid.uuid4(), {}, state)
    assert search.calls.last.request.headers["Authorization"] == "Bearer secret"
    assert search.calls.last.request.headers["Notion-Version"] == "2022-06-28"
    assert [d.external_id for d in plan.upserts] == ["https://notion.so/p1"]
    markdown = plan.upserts[0].content.decode()
    assert markdown.startswith("# Onboarding")
    assert "## Laptop" in markdown
    assert "- Charger" in markdown
    assert "| Mouse | 1 |" in markdown
    assert plan.unchanged == ["https://notion.so/p3"]
    assert sorted(plan.deletions) == ["https://notion.so/p2", "https://notion.so/p9"]


async def test_notion_without_token_reports_error() -> None:
    plan = await NotionConnector(None, NOTION).fetch(uuid.uuid4(), {}, {})
    assert plan.errors


def test_cron_due_logic() -> None:
    now = datetime(2026, 10, 2, 12, 0, tzinfo=UTC)
    assert is_due("*/15 * * * *", None, now)
    assert is_due("*/15 * * * *", now - timedelta(minutes=20), now)
    assert not is_due("*/15 * * * *", now + timedelta(minutes=2), now + timedelta(minutes=7))
    assert not is_due(None, None, now)
    assert not is_due("not a cron", None, now)
