from __future__ import annotations

from alembic import context
from sqlalchemy import create_engine, pool

from kb.config import get_settings
from kb.core.db import sync_url
from kb.core.models import Base

config = context.config
target_metadata = Base.metadata


def database_url() -> str:
    override = config.attributes.get("database_url")
    if isinstance(override, str):
        return sync_url(override)
    return sync_url(get_settings().database_url)


def run_offline() -> None:
    context.configure(url=database_url(), target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_online() -> None:
    engine = create_engine(database_url(), poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


if context.is_offline_mode():
    run_offline()
else:
    run_online()
