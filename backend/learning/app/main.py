from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from . import api
from .db import Base, SessionLocal, engine
from .models import Scenario
from backend_observability import instrument_app

SEED = [
    dict(title="Premier échange avec un parent", level="debutant",
         description="Accueillir un parent et reformuler sa demande.",
         objectives=["Accueil chaleureux", "Reformulation", "Question ouverte"]),
    dict(title="Gérer un désaccord éducatif", level="intermediaire",
         description="Garder une posture neutre face à deux points de vue opposés.",
         objectives=["Écoute active", "Neutralité", "Proposer un compromis"]),
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with SessionLocal() as session:  # scénarios d'exemple au premier démarrage
            if (await session.execute(select(func.count()).select_from(Scenario))).scalar_one() == 0:
                session.add_all(Scenario(**s) for s in SEED)
                await session.commit()
        yield
    finally:
        await engine.dispose()
        observability.shutdown()


app = FastAPI(title="Learning", lifespan=lifespan)
observability = instrument_app(app, "learning", engine=engine)


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


app.include_router(api.router)
