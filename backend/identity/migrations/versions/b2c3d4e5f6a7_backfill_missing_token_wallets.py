"""Create token wallets for users that do not have one.

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
"""
from typing import Sequence, Union

from alembic import op

from app.config import settings


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        f"""
        WITH users_without_wallets AS (
            SELECT users.id
            FROM users
            LEFT JOIN token_wallets ON token_wallets.user_id = users.id
            WHERE token_wallets.user_id IS NULL
        ),
        inserted_wallets AS (
            INSERT INTO token_wallets
                (user_id, free_tokens_remaining, purchased_tokens_remaining, next_free_refill_at)
            SELECT id, {settings.FREE_TOKEN_GRANT}, 0,
                (date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '1 day')
                AT TIME ZONE 'UTC'
            FROM users_without_wallets
            RETURNING user_id
        )
        INSERT INTO token_transactions (id, user_id, bucket, amount, reason)
        SELECT gen_random_uuid(), user_id, 'free', {settings.FREE_TOKEN_GRANT}, 'signup_grant'
        FROM inserted_wallets
        """
    )


def downgrade() -> None:
    pass
