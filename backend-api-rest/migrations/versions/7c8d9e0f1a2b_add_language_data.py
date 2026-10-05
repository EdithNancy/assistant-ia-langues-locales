"""Add language and vocabulary data.

Revision ID: 7c8d9e0f1a2b
Revises: 4ab1c2d3e4f5
Create Date: 2026-10-05 11:45:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "7c8d9e0f1a2b"
down_revision: Union[str, Sequence[str], None] = "4ab1c2d3e4f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "languages",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(length=16), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("native_name", sa.String(length=100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_languages_code"), "languages", ["code"], unique=True)

    op.create_table(
        "vocabulary_entries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("source_language_id", sa.Uuid(), nullable=False),
        sa.Column("target_language_id", sa.Uuid(), nullable=False),
        sa.Column("source_text", sa.String(length=500), nullable=False),
        sa.Column("target_text", sa.String(length=1000), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("pronunciation", sa.String(length=500), nullable=True),
        sa.Column("example_source", sa.Text(), nullable=True),
        sa.Column("example_target", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "kind IN ('word', 'expression', 'sentence')",
            name="ck_vocabulary_entries_kind",
        ),
        sa.CheckConstraint(
            "source_language_id <> target_language_id",
            name="ck_vocabulary_entries_different_languages",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"], ["users.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["source_language_id"], ["languages.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["target_language_id"], ["languages.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_vocabulary_entries_source_language_id"),
        "vocabulary_entries",
        ["source_language_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_vocabulary_entries_target_language_id"),
        "vocabulary_entries",
        ["target_language_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_vocabulary_entries_created_by"),
        "vocabulary_entries",
        ["created_by"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_vocabulary_entries_created_by"), table_name="vocabulary_entries")
    op.drop_index(
        op.f("ix_vocabulary_entries_target_language_id"), table_name="vocabulary_entries"
    )
    op.drop_index(
        op.f("ix_vocabulary_entries_source_language_id"), table_name="vocabulary_entries"
    )
    op.drop_table("vocabulary_entries")
    op.drop_index(op.f("ix_languages_code"), table_name="languages")
    op.drop_table("languages")
