from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import text
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
            await conn.run_sync(Base.metadata.create_all)
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
async def ready():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return JSONResponse({"status": "not_ready"}, status_code=503)
    return {"status": "ready"}


app.include_router(ws.router)
app.include_router(api.router)
