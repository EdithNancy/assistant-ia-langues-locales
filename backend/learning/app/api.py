from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session
from .deps import CurrentUser, admin_only, pro_or_admin
from .models import Attempt, Scenario
from .pagination import (
    ListRequest,
    PaginatedResponse,
    apply_sort,
    get_list_request,
    paginated_response,
    validate_list_query,
)
from .schemas import (AttemptComplete, AttemptOut, AttemptStart, LevelProgress, Progress,
                      ScenarioCreate, ScenarioOut)

router = APIRouter()


# ---------- Catalogue de scénarios ----------
@router.get("/scenarios", response_model=PaginatedResponse[ScenarioOut])
async def list_scenarios(
    http_request: Request,
    level: str | None = Query(
        default=None, pattern="^(debutant|intermediaire|avance)$"
    ),
    list_query: ListRequest = Depends(get_list_request),
    _: CurrentUser = Depends(pro_or_admin),
    session: AsyncSession = Depends(get_session),
):
    validate_list_query(http_request, allowed_filters=frozenset({"level"}))
    q = select(Scenario).where(Scenario.published.is_(True))
    count_q = (
        select(func.count())
        .select_from(Scenario)
        .where(Scenario.published.is_(True))
    )
    if level:
        q = q.where(Scenario.level == level)
        count_q = count_q.where(Scenario.level == level)
    if list_query.search:
        pattern = f"%{list_query.search}%"
        condition = (
            Scenario.title.ilike(pattern)
            | Scenario.description.ilike(pattern)
        )
        q = q.where(condition)
        count_q = count_q.where(condition)
    total = await session.scalar(count_q)
    q = apply_sort(
        q,
        sort_by=list_query.sort_by,
        sort_order=list_query.sort_order,
        columns={
            "created_at": Scenario.created_at,
            "title": Scenario.title,
            "level": Scenario.level,
        },
        default="created_at",
        unique_column=Scenario.id,
        default_order="asc",
    )
    items = list((await session.execute(
        q.offset(list_query.offset).limit(list_query.limit)
    )).scalars().all())
    return paginated_response(
        items, total or 0, list_query.offset, list_query.limit
    )


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


@router.get("/attempts", response_model=PaginatedResponse[AttemptOut])
async def my_attempts(
    http_request: Request,
    scenario_id: str | None = Query(default=None, min_length=1, max_length=32),
    status: str | None = Query(
        default=None, pattern="^(in_progress|completed)$"
    ),
    list_query: ListRequest = Depends(get_list_request),
    user: CurrentUser = Depends(pro_or_admin),
    session: AsyncSession = Depends(get_session),
):
    validate_list_query(
        http_request, allowed_filters=frozenset({"scenario_id", "status"})
    )
    q = select(Attempt).where(Attempt.user_id == user.id)
    count_q = select(func.count()).select_from(Attempt).where(
        Attempt.user_id == user.id
    )
    if scenario_id:
        q = q.where(Attempt.scenario_id == scenario_id)
        count_q = count_q.where(Attempt.scenario_id == scenario_id)
    if status:
        q = q.where(Attempt.status == status)
        count_q = count_q.where(Attempt.status == status)
    if list_query.search:
        q = q.join(Scenario, Scenario.id == Attempt.scenario_id)
        count_q = count_q.join(Scenario, Scenario.id == Attempt.scenario_id)
        condition = Scenario.title.ilike(f"%{list_query.search}%")
        q = q.where(condition)
        count_q = count_q.where(condition)
    count = await session.scalar(count_q)
    q = apply_sort(
        q,
        sort_by=list_query.sort_by,
        sort_order=list_query.sort_order,
        columns={
            "started_at": Attempt.started_at,
            "completed_at": Attempt.completed_at,
            "status": Attempt.status,
            "score": Attempt.score,
        },
        default="started_at",
        unique_column=Attempt.id,
    ).offset(list_query.offset).limit(list_query.limit)
    items = list((await session.execute(q)).scalars().all())
    return paginated_response(
        items, count or 0, list_query.offset, list_query.limit
    )


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
