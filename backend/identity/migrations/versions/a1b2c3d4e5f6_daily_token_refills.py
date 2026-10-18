"""Schedule free token refills at the next UTC midnight.

Revision ID: a1b2c3d4e5f6
Revises: 3c4d5e6f7a8b
"""
from typing import Sequence, Union

from alembic import op


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "3c4d5e6f7a8b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE token_wallets
        SET next_free_refill_at =
            (date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '1 day')
            AT TIME ZONE 'UTC'
        """
    )


def downgrade() -> None:
    pass
