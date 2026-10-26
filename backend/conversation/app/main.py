from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import inspect, text
from sqlalchemy.exc import SQLAlchemyError

from . import api, ws
from . import config
from .db import Base, engine
from backend_observability import instrument_app


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.identity_http = httpx.AsyncClient(
        timeout=config.IDENTITY_TIMEOUT,
        follow_redirects=False,
        trust_env=False,
    )
    try:
        async with engine.begin() as conn:
            # 1. Créer le schéma "conversation"
            await conn.execute(text("CREATE SCHEMA IF NOT EXISTS conversation"))
            # 2. Créer les tables
            await conn.run_sync(Base.metadata.create_all)
            await conn.run_sync(_upgrade_message_columns)
        yield
    finally:
        await app.state.identity_http.aclose()
        await engine.dispose()
        observability.shutdown()


app = FastAPI(title="Conversation", lifespan=lifespan)
observability = instrument_app(app, "conversation", engine=engine)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/ready")
async def readiness():
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return JSONResponse({"status": "not_ready"}, status_code=503)
    return {"status": "ready"}


app.include_router(ws.router)
app.include_router(api.router)


def _upgrade_message_columns(connection):
    columns = {column["name"] for column in inspect(connection).get_columns("messages")}
    additions = {
        "original_content": "TEXT",
        "transcript": "TEXT",
        "reformulated_content": "TEXT",
        "understood_as": "TEXT",
        "modality": "VARCHAR(16) NOT NULL DEFAULT 'text'",
        "status": "VARCHAR(16) NOT NULL DEFAULT 'completed'",
        "input_tokens": "INTEGER",
        "output_tokens": "INTEGER",
        "estimated_usage": "BOOLEAN",
    }
    for name, definition in additions.items():
        if name not in columns:
            connection.execute(
                text(f"ALTER TABLE messages ADD COLUMN {name} {definition}")
            )
