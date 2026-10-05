from __future__ import annotations

import json
import os
import random
import time
from pathlib import Path
from typing import Any

import requests
from locust import HttpUser, between, events, task

KEYCLOAK = os.environ.get("KC_URL", "http://127.0.0.1:4480")
USERS = ["alice", "bob", "carol", "admin"]
GOLDEN = Path(__file__).resolve().parents[2] / "eval-data" / "golden.jsonl"
QUESTIONS: dict[str, list[str]] = {u: [] for u in USERS}
for line in GOLDEN.read_text().splitlines():
    if line.strip():
        item = json.loads(line)
        if not item.get("history"):
            QUESTIONS[item["user"]].append(item["question"])
TOKENS: dict[str, tuple[str, float]] = {}


def token(user: str) -> str:
    cached = TOKENS.get(user)
    if cached and cached[1] > time.time() + 60:
        return cached[0]
    response = requests.post(
        f"{KEYCLOAK}/realms/northwind/protocol/openid-connect/token",
        data={
            "grant_type": "password",
            "client_id": "kb-web",
            "username": user,
            "password": "demo",
            "scope": "openid",
        },
        timeout=10,
    )
    response.raise_for_status()
    data = response.json()
    TOKENS[user] = (data["access_token"], time.time() + int(data["expires_in"]))
    return str(data["access_token"])


class ChatUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self) -> None:
        self.user = random.choice(USERS)
        self.conversation = self.client.post(
            "/api/v1/chat/conversations", json={}, headers=self.headers(), name="create conversation"
        ).json()["id"]

    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {token(self.user)}"}

    @task(5)
    def ask(self) -> None:
        question = random.choice(QUESTIONS[self.user])
        started = time.perf_counter()
        first_token: float | None = None
        outcome = "error"
        with self.client.post(
            f"/api/v1/chat/conversations/{self.conversation}/messages",
            json={"content": question},
            headers={**self.headers(), "Accept": "text/event-stream"},
            stream=True,
            catch_response=True,
            name="chat (full stream)",
        ) as response:
            event = ""
            for raw in response.iter_lines(decode_unicode=True):
                if raw.startswith("event: "):
                    event = raw[7:]
                    if event in {"token", "no_answer"} and first_token is None:
                        first_token = time.perf_counter() - started
                elif raw.startswith("data: ") and event == "done":
                    outcome = json.loads(raw[6:]).get("status", "complete")
            if outcome == "error":
                response.failure("stream ended without done")
            else:
                response.success()
        if first_token is not None:
            events.request.fire(
                request_type="SSE",
                name="chat first token",
                response_time=first_token * 1000,
                response_length=0,
                exception=None,
                context={},
            )

    @task(2)
    def search(self) -> None:
        question = random.choice(QUESTIONS[self.user])
        body: dict[str, Any] = {"query": question, "mode": "hybrid", "rerank": True, "k": 8}
        self.client.post("/api/v1/search", json=body, headers=self.headers(), name="search hybrid+rerank")

    @task(1)
    def list_collections(self) -> None:
        self.client.get("/api/v1/collections", headers=self.headers(), name="list collections")
