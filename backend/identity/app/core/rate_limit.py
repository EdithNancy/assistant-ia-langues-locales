import ipaddress

from slowapi import Limiter
from slowapi.util import get_remote_address

from fastapi import Request

from app.config import settings


def get_client_address(request: Request) -> str:
    """Use the client address forwarded by the trusted, sanitizing API Gateway."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        address = forwarded.split(",", maxsplit=1)[0].strip()
        try:
            return str(ipaddress.ip_address(address))
        except ValueError:
            pass
    return get_remote_address(request)


limiter = Limiter(
    key_func=get_client_address,
    default_limits=[],
    storage_uri=settings.REDIS_URL,
    headers_enabled=True,
)
