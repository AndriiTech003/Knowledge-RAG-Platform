from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from kb.auth.principal import Principal

QuestionType = Literal[
    "factoid",
    "multi_hop",
    "table",
    "exact_term",
    "follow_up",
    "permission",
    "unanswerable",
    "conflicting",
    "injection",
]


class RelevantItem(BaseModel):
    doc: str
    pages: list[int] | None = None


class HistoryTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class GoldenQuestion(BaseModel):
    id: str
    user: str
    question: str
    type: QuestionType
    expected: Literal["answer", "no_answer"] = "answer"
    reference_answer: str | None = None
    key_facts: list[str] = []
    relevant: list[RelevantItem] = []
    history: list[HistoryTurn] = []
    forbidden: list[str] = []


class EvalUser(BaseModel):
    sub: str
    email: str | None = None
    groups: list[str]


class CollectionSpec(BaseModel):
    slug: str
    name: str
    description: str | None = None
    chunking_profile: str = "default"
    grants: list[dict[str, str]]


class Dataset(BaseModel):
    version: str
    questions: list[GoldenQuestion]
    users: dict[str, EvalUser]
    collections: list[CollectionSpec]

    def principal(self, user: str, admin_group: str = "kb-admins") -> Principal:
        spec = self.users[user]
        return Principal(
            sub=spec.sub,
            email=spec.email,
            name=user,
            username=user,
            groups=sorted(spec.groups),
            is_admin=admin_group in spec.groups,
        )

    def readable_slugs(self, user: str, admin_group: str = "kb-admins") -> set[str]:
        spec = self.users[user]
        if admin_group in spec.groups:
            return {c.slug for c in self.collections}
        readable = set()
        for collection in self.collections:
            for grant in collection.grants:
                if grant["principal_type"] == "group" and grant["principal_id"] in spec.groups:
                    readable.add(collection.slug)
                if grant["principal_type"] == "user" and grant["principal_id"] == spec.sub:
                    readable.add(collection.slug)
        return readable


def default_data_dir() -> Path:
    return Path(__file__).resolve().parents[4] / "eval-data"


def load_dataset(data_dir: Path | None = None, limit: int | None = None) -> Dataset:
    base = data_dir or default_data_dir()
    raw = (base / "golden.jsonl").read_text(encoding="utf-8")
    questions = [GoldenQuestion.model_validate_json(line) for line in raw.splitlines() if line.strip()]
    if limit:
        questions = questions[:limit]
    users = {k: EvalUser.model_validate(v) for k, v in json.loads((base / "users.json").read_text()).items()}
    collections = [
        CollectionSpec.model_validate(c) for c in json.loads((base / "collections.json").read_text())
    ]
    version = f"golden-{len(questions)}q-{hashlib.sha256(raw.encode()).hexdigest()[:10]}"
    return Dataset(version=version, questions=questions, users=users, collections=collections)
