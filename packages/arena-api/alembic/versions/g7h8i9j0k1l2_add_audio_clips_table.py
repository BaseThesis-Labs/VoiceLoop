"""Add audio_clips table for STT curated library.

Revision ID: g7h8i9j0k1l2
Revises: f6a7b8c9d0e1
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "g7h8i9j0k1l2"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "audio_clips",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("category", sa.Text(), nullable=False),
        sa.Column("difficulty", sa.String(), nullable=False, server_default="medium"),
        sa.Column("ground_truth", sa.Text(), nullable=False),
        sa.Column("audio_path", sa.Text(), nullable=False),
        sa.Column("duration_seconds", sa.Float(), nullable=True),
        sa.Column("tags", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("audio_clips")
