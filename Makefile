.PHONY: install infra keycloak keycloak-stop models dev api worker beat web seed lint typecheck test test-unit test-integration eval eval-full eval-gate eval-sweep experiments smoke e2e loadtest lighthouse storybook storybook-test i18n-extract mcp corpus openapi api-client up down

BACKEND := backend
FRONTEND := frontend
UV := cd $(BACKEND) && uv run

install:
	cd $(BACKEND) && uv sync
	cd $(FRONTEND) && npm ci

infra:
	../devinfra/start.sh

keycloak:
	scripts/keycloak.sh start

keycloak-stop:
	scripts/keycloak.sh stop

models:
	$(UV) kb-models

api:
	$(UV) kb-api

worker:
	$(UV) celery -A kb.workers.celery_app worker -Q ingest,embed,sync,eval,maintenance -c 2 --loglevel=INFO

beat:
	$(UV) celery -A kb.workers.celery_app beat --loglevel=INFO

web:
	cd $(FRONTEND) && npm start

dev:
	@echo "run in separate terminals: make keycloak, make models, make api, make worker, make beat, make web"

seed:
	$(UV) kb-seed --mode inline

corpus:
	$(UV) python -m kb.evaluation.corpus_builder

openapi:
	$(UV) python scripts/export_openapi.py

api-client: openapi
	cd $(FRONTEND) && npm run api:gen

lint:
	$(UV) python scripts/check_no_comments.py
	$(UV) ruff check src tests scripts alembic loadtest
	$(UV) ruff format --check src tests scripts alembic loadtest
	cd $(FRONTEND) && npm run lint
	cd $(FRONTEND) && npm run i18n:verify

typecheck:
	$(UV) mypy
	$(UV) mypy --strict loadtest/locustfile.py

test-unit:
	$(UV) pytest tests/unit -q

test-integration:
	$(UV) pytest tests/integration tests/eval -q

test: test-unit test-integration
	cd $(FRONTEND) && npm test

storybook:
	cd $(FRONTEND) && npm run storybook

storybook-test:
	cd $(FRONTEND) && npm run storybook:build && npm run storybook:test

i18n-extract:
	cd $(FRONTEND) && npm run i18n:extract

mcp:
	$(UV) kb-mcp --transport streamable-http --port 4430

eval:
	$(UV) kb-eval run --mode retrieval --out reports/eval-latest.json --markdown reports/eval-latest.md --store

eval-full:
	$(UV) kb-eval run --mode full --out reports/eval-full.json --markdown reports/eval-full.md --store

eval-gate:
	$(UV) kb-eval gate --report reports/eval-latest.json

eval-sweep:
	scripts/eval-sweep.sh

experiments:
	$(UV) kb-eval experiments --full --out reports/experiments.json

smoke:
	scripts/smoke.sh

e2e:
	scripts/e2e.sh

loadtest:
	scripts/loadtest.sh

lighthouse:
	scripts/lighthouse.sh

up:
	docker compose up --build

down:
	docker compose down -v
