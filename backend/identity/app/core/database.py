from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import settings
from sqlalchemy import event


class Base(DeclarativeBase):
    pass


# L'URL reste propre, sans ?options=...
engine = create_async_engine(
    settings.DATABASE_URL,
    connect_args={
        "server_settings": {
            "search_path": "identity"
        }
    }
)

# ✅ LA SOLUTION : Forcer le search_path à CHAQUE nouvelle connexion


@event.listens_for(engine.sync_engine, "connect")
def set_search_path(dbapi_connection, connection_record):
    # On exécute le SET manuellement sur la connexion DBAPI
    cursor = dbapi_connection.cursor()
    cursor.execute("SET search_path TO identity, public;")
    cursor.close()


# On utilise AsyncSession, pas Session
SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autoflush=False,
    expire_on_commit=False
)

# La fonction doit être asynchrone (async def) pour être utilisée avec await


async def get_db():
    async with SessionLocal() as session:
        yield session
