import time

import redis.asyncio as aioredis


_HIT_SCRIPT = """
local count = redis.call('INCR', KEYS[1])
if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return {count, redis.call('TTL', KEYS[1])}
"""


class RateLimiter:
    """Fenêtre fixe atomique avec Redis, ou mémoire locale en développement."""

    def __init__(self, redis_url: str | None, limit: int, window: int):
        self.limit, self.window = limit, window
        self.redis = (
            aioredis.from_url(
                redis_url,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
            if redis_url
            else None
        )
        self._mem: dict[str, tuple[float, int]] = {}
        self._hits = 0

    async def check(self) -> None:
        if self.redis:
            await self.redis.ping()

    async def is_revoked(self, session_id: str) -> bool:
        if not self.redis:
            return False
        return await self.redis.exists(f"revoked:session:{session_id}") > 0

    async def hit(self, key: str) -> tuple[bool, int]:
        """Retourne (autorisé, secondes avant reset)."""
        if self.redis:
            k = f"rl:{key}"
            count, ttl = await self.redis.eval(_HIT_SCRIPT, 1, k, self.window)
            return count <= self.limit, max(ttl, 1)
        now = time.monotonic()
        self._hits += 1
        if self._hits % 1024 == 0:
            self._mem = {
                item_key: value
                for item_key, value in self._mem.items()
                if now - value[0] < self.window
            }
        start, count = self._mem.get(key, (now, 0))
        if now - start >= self.window:
            start, count = now, 0
        count += 1
        self._mem[key] = (start, count)
        return count <= self.limit, max(int(self.window - (now - start)), 1)

    async def close(self) -> None:
        if self.redis:
            await self.redis.aclose()
