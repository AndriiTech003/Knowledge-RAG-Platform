FROM python:3.13-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends libmagic1 curl && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /usr/local/bin/uv
WORKDIR /app/backend
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONUNBUFFERED=1 PATH=/app/backend/.venv/bin:$PATH

FROM base AS runtime
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-group models --no-install-project
COPY backend/ ./
COPY eval-data/ /app/eval-data/
RUN uv sync --frozen --no-dev --no-group models
RUN useradd --create-home --uid 10001 kb && chown -R kb /app
USER kb

FROM runtime AS api
EXPOSE 4400
HEALTHCHECK --interval=10s --timeout=3s CMD curl -fsS http://127.0.0.1:4400/health/live || exit 1
CMD ["uvicorn", "kb.main:app", "--host", "0.0.0.0", "--port", "4400", "--proxy-headers", "--workers", "2"]

FROM runtime AS worker
CMD ["celery", "-A", "kb.workers.celery_app", "worker", "-Q", "ingest,embed,sync,eval,maintenance", "--loglevel=INFO"]

FROM runtime AS beat
CMD ["celery", "-A", "kb.workers.celery_app", "beat", "--loglevel=INFO", "--schedule", "/tmp/celerybeat-schedule"]

FROM base AS models
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --group models --no-install-project
COPY backend/ ./
RUN uv sync --frozen --no-dev --group models \
 && python -c "from sentence_transformers import SentenceTransformer, CrossEncoder; SentenceTransformer('BAAI/bge-small-en-v1.5'); CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')"
ENV HF_HUB_OFFLINE=1 KB_MODELS_HOST=0.0.0.0 KB_MODELS_PORT=4410
EXPOSE 4410
CMD ["kb-models"]
