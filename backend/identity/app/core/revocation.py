from collections.abc import Iterable

from redis.asyncio import Redis

from app.config import settings


async def revoke_access_sessions(redis: Redis, session_ids: Iterable[object]) -> None:
    ttl = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
    async with redis.pipeline(transaction=True) as pipeline:
        for session_id in session_ids:
            pipeline.set(f"revoked:session:{session_id}", "1", ex=ttl)
        await pipeline.execute()
