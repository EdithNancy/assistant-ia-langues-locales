from datetime import datetime, time, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from .models import DailyUsage

FREE_DAILY_TEXT_LIMIT = 500
FREE_DAILY_VOICE_LIMIT = 50
_PAID_ROLES = frozenset({"pro", "admin", "super_admin"})


def is_free_user(role: str | None, roles_header: str | None = None) -> bool:
    roles = {
        value.strip().lower()
        for value in (roles_header or "").split(",")
        if value.strip()
    }
    if not roles and role:
        roles.add(role.strip().lower())
    return not roles.intersection(_PAID_ROLES)


async def reserve_daily_request(
    session: AsyncSession, user_id: str, kind: str, limit: int
) -> None:
    now = datetime.now(timezone.utc)
    dialect = session.get_bind().dialect.name
    if dialect == "sqlite":
        from sqlalchemy.dialects.sqlite import insert
    elif dialect == "postgresql":
        from sqlalchemy.dialects.postgresql import insert
    else:
        raise RuntimeError(f"Compteur journalier non pris en charge pour {dialect}.")

    statement = (
        insert(DailyUsage)
        .values(user_id=user_id, usage_date=now.date(), kind=kind, count=1)
        .on_conflict_do_update(
            index_elements=[
                DailyUsage.user_id,
                DailyUsage.usage_date,
                DailyUsage.kind,
            ],
            set_={"count": DailyUsage.count + 1},
            where=DailyUsage.count < limit,
        )
        .returning(DailyUsage.count)
    )
    count = (await session.execute(statement)).scalar_one_or_none()
    await session.commit()
    if count is None:
        reset_at = datetime.combine(
            now.date() + timedelta(days=1), time.min, tzinfo=timezone.utc
        )
        retry_after = max(int((reset_at - now).total_seconds()), 1)
        singular_unit, plural_unit = (
            ("requête texte", "requêtes texte")
            if kind == "text"
            else ("tour vocal", "tours vocaux")
        )
        unit = singular_unit if limit == 1 else plural_unit
        raise HTTPException(
            status_code=429,
            detail=f"Limite quotidienne de {limit} {unit} atteinte.",
            headers={"Retry-After": str(retry_after)},
        )
