"""Add durable application usage events.

Revision ID: 3c4d5e6f7a8b
Revises: df4d2c529c36
Create Date: 2026-10-05 14:30:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "3c4d5e6f7a8b"
down_revision: Union[str, Sequence[str], None] = "df4d2c529c36"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "usage_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("event_type", sa.String(length=80), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("method", sa.String(length=10), nullable=False),
        sa.Column("route", sa.String(length=255), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_usage_events_user_id"), "usage_events", ["user_id"], unique=False
    )
    op.create_index(
        "ix_usage_events_event_type", "usage_events", ["event_type"], unique=False
    )
    op.create_index(
        "ix_usage_events_created_at", "usage_events", ["created_at"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_usage_events_created_at", table_name="usage_events")
    op.drop_index("ix_usage_events_event_type", table_name="usage_events")
    op.drop_index(op.f("ix_usage_events_user_id"), table_name="usage_events")
    op.drop_table("usage_events")
