from __future__ import annotations

import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from kb.analytics.router import router as analytics_router
from kb.auth.router import router as me_router
from kb.chat.router import router as chat_router
from kb.collections.router import router as collections_router
from kb.config import Settings, get_settings
from kb.connectors.router import router as sources_router
from kb.core.container import Container, build_container
from kb.core.errors import install_error_handlers
from kb.core.security import TokenVerifier
from kb.core.telemetry import install_metrics, setup_tracing
from kb.documents.router import router as documents_router
from kb.evaluation.router import router as eval_router
from kb.feedback.router import router as feedback_router
from kb.health import router as health_router
from kb.retrieval.router import router as search_router


def create_app(
    settings: Settings | None = None,
    verifier: TokenVerifier | None = None,
    container: Container | None = None,
) -> FastAPI:
    cfg = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        own = container is None
        app.state.container = container or build_container(cfg, verifier)
        try:
            await app.state.container.storage.ensure_bucket()
        except Exception:
            app.state.storage_ready = False
        try:
            yield
        finally:
            if own:
                await app.state.container.aclose()

    app = FastAPI(
        title="Northwind Knowledge RAG API",
        version="0.1.0",
        description="Permission-aware RAG: collections, ingestion, hybrid search, cited chat answers, analytics and eval.",
        lifespan=lifespan,
        openapi_url="/api/v1/openapi.json",
        docs_url="/api/v1/docs",
    )
    install_error_handlers(app)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.cors_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["x-correlation-id", "retry-after"],
    )

    @app.middleware("http")
    async def correlation(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        correlation_id = request.headers.get("x-correlation-id") or str(uuid.uuid4())
        response = await call_next(request)
        response.headers["x-correlation-id"] = correlation_id
        return response

    api = APIRouter(prefix="/api/v1")
    for router in (
        me_router,
        collections_router,
        documents_router,
        sources_router,
        search_router,
        chat_router,
        feedback_router,
        analytics_router,
        eval_router,
    ):
        api.include_router(router)
    app.include_router(api)
    app.include_router(health_router)
    install_metrics(app, cfg)
    setup_tracing(app, cfg)
    return app


app = create_app()
