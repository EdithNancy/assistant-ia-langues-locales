from collections.abc import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker, create_async_engine, async_sessionmaker
from app.config import settings


class Base(DeclarativeBase):
    pass


# L'URL reste propre, sans ?options=...
engine = create_async_engine(
    settings.DATABASE_URL,
    connect_args={
        "server_settings": {
            "search_path": "identity"  # <-- Remplace par "identity" ou "conversation"
        }
    }
)
SessionLocal = async_sessionmaker(
    bind=engine, class_=Session, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
