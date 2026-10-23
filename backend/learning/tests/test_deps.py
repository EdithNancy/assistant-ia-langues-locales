import asyncio

import pytest
from fastapi import HTTPException

from app.deps import current_user, pro_or_admin


def test_current_user_parses_gateway_role_list() -> None:
    user = asyncio.run(
        current_user(
            x_user_id="user-123",
            x_user_role="admin",
            x_user_roles="user,pro",
        )
    )

    assert user.roles == frozenset({"user", "pro"})
    assert asyncio.run(pro_or_admin(user=user)) == user


def test_current_user_keeps_compatibility_with_single_role_header() -> None:
    user = asyncio.run(
        current_user(
            x_user_id="user-123",
            x_user_role="PRO",
            x_user_roles=None,
        )
    )

    assert user.roles == frozenset({"pro"})
    assert asyncio.run(pro_or_admin(user=user)) == user


def test_protected_learning_route_rejects_regular_users() -> None:
    user = asyncio.run(
        current_user(
            x_user_id="user-123",
            x_user_role="user",
            x_user_roles=None,
        )
    )

    with pytest.raises(HTTPException) as error:
        asyncio.run(pro_or_admin(user=user))

    assert error.value.status_code == 403
