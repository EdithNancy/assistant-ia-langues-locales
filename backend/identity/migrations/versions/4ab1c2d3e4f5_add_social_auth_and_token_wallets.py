"""Add social authentication and token wallets.

Revision ID: 4ab1c2d3e4f5
Revises: 89c5daba84ab
Create Date: 2026-10-05 11:15:00.000000
"""
from datetime import datetime, timedelta, timezone
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.config import settings


revision: str = "4ab1c2d3e4f5"
down_revision: Union[str, Sequence[str], None] = "89c5daba84ab"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("phone_number", sa.String(length=32), nullable=True))
    op.alter_column("users", "password_hash", existing_type=sa.String(length=255), nullable=True)

    op.create_table(
        "federated_identities",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("provider", sa.String(length=16), nullable=False),
        sa.Column("provider_subject", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"),
                  nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", "provider_subject"),
    )
    op.create_index(
        op.f("ix_federated_identities_user_id"), "federated_identities", ["user_id"],
        unique=False,
    )
    op.create_table(
        "social_auth_nonces",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("provider", sa.String(length=16), nullable=False),
        sa.Column("nonce_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"),
                  nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nonce_hash"),
    )
    op.create_table(
        "token_wallets",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("free_tokens_remaining", sa.Integer(), nullable=False),
        sa.Column("purchased_tokens_remaining", sa.Integer(), nullable=False),
        sa.Column("next_free_refill_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"),
                  nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_table(
        "token_transactions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("bucket", sa.String(length=16), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(length=32), nullable=False),
        sa.Column("external_reference", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"),
                  nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("external_reference"),
    )
    op.create_index(
        op.f("ix_token_transactions_user_id"), "token_transactions", ["user_id"], unique=False,
    )

    op.execute(
        "INSERT INTO token_wallets "
        "(user_id, free_tokens_remaining, purchased_tokens_remaining, next_free_refill_at) "
        "SELECT id, "
        f"{settings.FREE_TOKEN_GRANT}, 0, "
        f"CURRENT_TIMESTAMP + INTERVAL '{settings.FREE_TOKEN_REFILL_DAYS} days' "
        "FROM users"
    )
    op.execute(
        "INSERT INTO token_transactions "
        "(id, user_id, bucket, amount, reason) "
        "SELECT gen_random_uuid(), id, 'free', "
        f"{settings.FREE_TOKEN_GRANT}, 'signup_grant' "
        "FROM users"
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_token_transactions_user_id"), table_name="token_transactions")
    op.drop_table("token_transactions")
    op.drop_table("token_wallets")
    op.drop_table("social_auth_nonces")
    op.drop_index(op.f("ix_federated_identities_user_id"), table_name="federated_identities")
    op.drop_table("federated_identities")
    op.drop_column("users", "phone_number")
