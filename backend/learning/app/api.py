from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session
from .deps import CurrentUser, admin_only, pro_or_admin
from .models import Attempt, Scenario
from .schemas import (AttemptComplete, AttemptOut, AttemptStart, LevelProgress, Progress,
                      ScenarioCreate, ScenarioOut)

router = APIRouter()


# ---------- Catalogue de scénarios ----------
@router.get("/scenarios", response_model=list[ScenarioOut])
async def list_scenarios(level: str | None = None, _: CurrentUser = Depends(pro_or_admin),
                         session: AsyncSession = Depends(get_session)):
    q = select(Scenario).where(Scenario.published.is_(True)).order_by(Scenario.created_at)
    if level:
        q = q.where(Scenario.level == level)
    return (await session.execute(q)).scalars().all()


@router.get("/scenarios/{sid}", response_model=ScenarioOut)
async def get_scenario(sid: str, _: CurrentUser = Depends(pro_or_admin),
                       session: AsyncSession = Depends(get_session)):
    sc = await session.get(Scenario, sid)
    if not sc or not sc.published:
        raise HTTPException(404, "Scénario introuvable")
    return sc


@router.post("/scenarios", response_model=ScenarioOut, status_code=201)
async def create_scenario(body: ScenarioCreate, _: CurrentUser = Depends(admin_only),
                          session: AsyncSession = Depends(get_session)):
    sc = Scenario(**body.model_dump())
    session.add(sc)
    await session.commit()
    return sc


# ---------- Tentatives ----------
@router.post("/attempts", response_model=AttemptOut, status_code=201)
async def start_attempt(body: AttemptStart, user: CurrentUser = Depends(pro_or_admin),
                        session: AsyncSession = Depends(get_session)):
    sc = await session.get(Scenario, body.scenario_id)
    if not sc or not sc.published:
        raise HTTPException(404, "Scénario introuvable")
    attempt = Attempt(scenario_id=sc.id, user_id=user.id)
    session.add(attempt)
    await session.commit()
    return attempt


@router.get("/attempts", response_model=list[AttemptOut])
async def my_attempts(user: CurrentUser = Depends(pro_or_admin), session: AsyncSession = Depends(get_session)):
    q = select(Attempt).where(Attempt.user_id == user.id).order_by(Attempt.started_at.desc())
    return (await session.execute(q)).scalars().all()


@router.post("/attempts/{aid}/complete", response_model=AttemptOut)
async def complete_attempt(aid: str, body: AttemptComplete, user: CurrentUser = Depends(pro_or_admin),
                           session: AsyncSession = Depends(get_session)):
    attempt = await session.get(Attempt, aid)
    if not attempt or attempt.user_id != user.id:
        raise HTTPException(404, "Tentative introuvable")
    if attempt.status == "completed":
        raise HTTPException(409, "Tentative déjà terminée")
    attempt.status, attempt.score = "completed", body.score
    attempt.completed_at = datetime.now(timezone.utc)
    await session.commit()
    return attempt


# ---------- Progression ----------
def _avg(scores: list[int]) -> float | None:
    return round(sum(scores) / len(scores), 1) if scores else None


@router.get("/progress", response_model=Progress)
async def progress(user: CurrentUser = Depends(pro_or_admin), session: AsyncSession = Depends(get_session)):
    rows = (await session.execute(
        select(Attempt, Scenario.level).join(Scenario, Scenario.id == Attempt.scenario_id)
        .where(Attempt.user_id == user.id))).all()
    done = [(a, lvl) for a, lvl in rows if a.status == "completed"]
    by_level: dict[str, LevelProgress] = {}
    for lvl in {lvl for _, lvl in done}:
        scores = [a.score for a, l in done if l == lvl]
        by_level[lvl] = LevelProgress(completed=len(scores), average_score=_avg(scores))
    return Progress(attempts=len(rows), completed=len(done),
                    average_score=_avg([a.score for a, _ in done]), by_level=by_level)
