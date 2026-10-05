from __future__ import annotations

from pathlib import Path

import psycopg
from alembic import command
from alembic.config import Config
from sqlalchemy.engine import make_url

BACKEND_DIR = Path(__file__).resolve().parents[3]


def _admin_conninfo(url: str) -> tuple[str, str]:
    parsed = make_url(url)
    name = parsed.database or "kb"
    admin = parsed.set(drivername="postgresql", database="postgres")
    return admin.render_as_string(hide_password=False), name


def create_database(url: str, exist_ok: bool = True) -> None:
    conninfo, name = _admin_conninfo(url)
    with psycopg.connect(conninfo, autocommit=True) as conn:
        exists = conn.execute("select 1 from pg_database where datname = %s", (name,)).fetchone()
        if exists and not exist_ok:
            raise RuntimeError(f"database {name} already exists")
        if not exists:
            conn.execute(f'create database "{name}"')


def drop_database(url: str) -> None:
    conninfo, name = _admin_conninfo(url)
    with psycopg.connect(conninfo, autocommit=True) as conn:
        conn.execute(f'drop database if exists "{name}" with (force)')


def migrate(url: str) -> None:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    config.attributes["database_url"] = url
    command.upgrade(config, "head")
