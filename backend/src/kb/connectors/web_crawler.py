from __future__ import annotations

import asyncio
import re
import time
import uuid
from collections import deque
from typing import Any
from urllib.parse import urldefrag, urljoin, urlparse
from urllib.robotparser import RobotFileParser

import defusedxml.ElementTree as DET
import httpx

from kb.connectors.base import FetchedDocument, PageState, SyncPlan

HREF_RE = re.compile(r"""<a\s[^>]*href=["']([^"'#]+)["']""", re.IGNORECASE)
CANONICAL_RE = re.compile(r"""<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']""", re.IGNORECASE)
TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
SITEMAP_NS = "{http://www.sitemaps.org/schemas/sitemap/0.9}"


def normalize_url(url: str) -> str:
    clean, _fragment = urldefrag(url.strip())
    parsed = urlparse(clean)
    path = parsed.path or "/"
    if path != "/" and path.endswith("/"):
        path = path[:-1]
    query = f"?{parsed.query}" if parsed.query else ""
    return f"{parsed.scheme.lower()}://{parsed.netloc.lower()}{path}{query}"


class DomainRateLimiter:
    def __init__(self, per_second: float) -> None:
        self.interval = 1.0 / per_second if per_second > 0 else 0.0
        self.last: dict[str, float] = {}
        self.lock = asyncio.Lock()

    async def wait(self, url: str) -> None:
        if not self.interval:
            return
        domain = urlparse(url).netloc
        async with self.lock:
            now = time.monotonic()
            ready = self.last.get(domain, 0.0) + self.interval
            if ready > now:
                await asyncio.sleep(ready - now)
            self.last[domain] = time.monotonic()


class WebCrawler:
    kind = "web"

    def __init__(
        self,
        client: httpx.AsyncClient | None = None,
        requests_per_second: float = 1.0,
        user_agent: str = "NorthwindKB-Crawler/1.0",
    ) -> None:
        self.client = client
        self.limiter = DomainRateLimiter(requests_per_second)
        self.user_agent = user_agent
        self.robots: dict[str, RobotFileParser | None] = {}

    async def _get(
        self, client: httpx.AsyncClient, url: str, headers: dict[str, str] | None = None
    ) -> httpx.Response:
        await self.limiter.wait(url)
        return await client.get(
            url, headers={"User-Agent": self.user_agent, **(headers or {})}, follow_redirects=True
        )

    async def _allowed(self, client: httpx.AsyncClient, url: str, respect: bool) -> bool:
        if not respect:
            return True
        parsed = urlparse(url)
        origin = f"{parsed.scheme}://{parsed.netloc}"
        if origin not in self.robots:
            parser: RobotFileParser | None = RobotFileParser()
            try:
                response = await self._get(client, f"{origin}/robots.txt")
                if response.status_code == 200:
                    assert parser is not None
                    parser.parse(response.text.splitlines())
                else:
                    parser = None
            except httpx.HTTPError:
                parser = None
            self.robots[origin] = parser
        robots = self.robots[origin]
        return robots is None or robots.can_fetch(self.user_agent, url)

    async def _sitemap_urls(self, client: httpx.AsyncClient, url: str, depth: int = 0) -> list[str]:
        response = await self._get(client, url)
        if response.status_code != 200:
            return []
        root = DET.fromstring(response.content)
        urls: list[str] = []
        if root.tag.endswith("sitemapindex") and depth < 2:
            for loc in root.iter(f"{SITEMAP_NS}loc"):
                if loc.text:
                    urls.extend(await self._sitemap_urls(client, loc.text.strip(), depth + 1))
        else:
            urls.extend(loc.text.strip() for loc in root.iter(f"{SITEMAP_NS}loc") if loc.text)
        return urls

    @staticmethod
    def _matches(url: str, include: list[re.Pattern[str]], exclude: list[re.Pattern[str]]) -> bool:
        if include and not any(p.search(url) for p in include):
            return False
        return not any(p.search(url) for p in exclude)

    async def fetch(
        self, source_id: uuid.UUID, config: dict[str, Any], state: dict[str, PageState]
    ) -> SyncPlan:
        start = str(config.get("startUrl") or config.get("start_url") or "")
        if not start:
            return SyncPlan(errors=["startUrl is required"])
        max_depth = int(config.get("maxDepth", config.get("max_depth", 2)))
        max_pages = int(config.get("maxPages", 200))
        respect = bool(config.get("respectRobots", True))
        include = [re.compile(p) for p in config.get("includePatterns", []) or []]
        exclude = [re.compile(p) for p in config.get("excludePatterns", []) or []]
        own = self.client is None
        client = self.client or httpx.AsyncClient(timeout=20.0)
        plan = SyncPlan()
        try:
            start_host = urlparse(start).netloc
            queue: deque[tuple[str, int]] = deque()
            if urlparse(start).path.endswith(".xml"):
                for url in await self._sitemap_urls(client, start):
                    queue.append((url, max_depth))
            else:
                queue.append((start, 0))
            for known in state:
                queue.append((known, max_depth))
            seen: set[str] = set()
            while queue and len(seen) < max_pages:
                raw, depth = queue.popleft()
                url = normalize_url(raw)
                if url in seen:
                    continue
                seen.add(url)
                if not self._matches(url, include, exclude) and url != normalize_url(start):
                    continue
                if not await self._allowed(client, url, respect):
                    continue
                previous = state.get(url)
                headers: dict[str, str] = {}
                if previous and previous.etag:
                    headers["If-None-Match"] = previous.etag
                if previous and previous.last_modified:
                    headers["If-Modified-Since"] = previous.last_modified
                try:
                    response = await self._get(client, url, headers)
                except httpx.HTTPError as exc:
                    plan.errors.append(f"{url}: {exc}")
                    continue
                if response.status_code == 304:
                    plan.unchanged.append(url)
                    plan.states.append(
                        PageState(
                            url,
                            previous.etag if previous else None,
                            previous.last_modified if previous else None,
                            304,
                        )
                    )
                    continue
                if response.status_code in {404, 410}:
                    plan.deletions.append(url)
                    plan.states.append(PageState(url, None, None, response.status_code))
                    continue
                if response.status_code != 200:
                    plan.errors.append(f"{url}: HTTP {response.status_code}")
                    continue
                content_type = response.headers.get("content-type", "text/html").split(";")[0].strip()
                if content_type not in {"text/html", "application/xhtml+xml"}:
                    continue
                html = response.text
                canonical_match = CANONICAL_RE.search(html)
                external = normalize_url(urljoin(url, canonical_match.group(1))) if canonical_match else url
                title_match = TITLE_RE.search(html)
                title = re.sub(r"\s+", " ", title_match.group(1)).strip() if title_match else external
                etag = response.headers.get("etag")
                last_modified = response.headers.get("last-modified")
                plan.upserts.append(
                    FetchedDocument(
                        external_id=external,
                        title=title,
                        content=response.content,
                        mime_type="text/html",
                        filename=f"{urlparse(external).path.strip('/').replace('/', '-') or 'index'}.html",
                        etag=etag,
                        last_modified=last_modified,
                        metadata={"url": external, "fetched_url": url},
                    )
                )
                plan.states.append(PageState(url, etag, last_modified, 200))
                if depth < max_depth:
                    for href in HREF_RE.findall(html):
                        target = normalize_url(urljoin(url, href))
                        if urlparse(target).netloc == start_host and target not in seen:
                            queue.append((target, depth + 1))
        finally:
            if own:
                await client.aclose()
        return plan
