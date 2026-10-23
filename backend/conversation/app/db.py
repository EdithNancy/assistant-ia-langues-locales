from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from . import config

from sqlalchemy.ext.asyncio import create_async_engine

# L'URL reste propre, sans ?options=...
engine = create_async_engine(
    config.DATABASE_URL,
    connect_args={
        "server_settings": {
            "search_path": "conversation"  # <-- Remplace par "identity" ou "conversation"
        }
    }
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_session():
    async with SessionLocal() as session:
        yield session
