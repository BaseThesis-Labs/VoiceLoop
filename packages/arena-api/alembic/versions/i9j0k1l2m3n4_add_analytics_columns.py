"""Add prompt_id, latency metrics, and mode-specific leaderboard columns.

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
"""
from alembic import op
import sqlalchemy as sa

revision = "i9j0k1l2m3n4"
down_revision = "h8i9j0k1l2m3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # battles: add prompt reference columns
    op.add_column("battles", sa.Column("prompt_id", sa.String(), nullable=True))
    op.create_foreign_key("fk_battles_prompt_id", "battles", "prompts", ["prompt_id"], ["id"])
    op.add_column("battles", sa.Column("prompt_text", sa.Text(), nullable=True))

    # evaluations: add latency metric columns
    op.add_column("evaluations", sa.Column("ttfb_ms", sa.Float(), nullable=True))
    op.add_column("evaluations", sa.Column("e2e_latency_ms", sa.Float(), nullable=True))
    op.add_column("evaluations", sa.Column("generation_time_ms", sa.Float(), nullable=True))

    # leaderboard_snapshots: add mode-specific aggregate columns
    op.add_column("leaderboard_snapshots", sa.Column("avg_cer", sa.Float(), nullable=True))
    op.add_column("leaderboard_snapshots", sa.Column("avg_ttfb", sa.Float(), nullable=True))
    op.add_column("leaderboard_snapshots", sa.Column("avg_e2e_latency", sa.Float(), nullable=True))
    op.add_column("leaderboard_snapshots", sa.Column("avg_utmos", sa.Float(), nullable=True))
    op.add_column("leaderboard_snapshots", sa.Column("avg_task_success_rate", sa.Float(), nullable=True))
    op.add_column("leaderboard_snapshots", sa.Column("avg_coherence", sa.Float(), nullable=True))


def downgrade() -> None:
    # leaderboard_snapshots: drop mode-specific aggregate columns
    op.drop_column("leaderboard_snapshots", "avg_coherence")
    op.drop_column("leaderboard_snapshots", "avg_task_success_rate")
    op.drop_column("leaderboard_snapshots", "avg_utmos")
    op.drop_column("leaderboard_snapshots", "avg_e2e_latency")
    op.drop_column("leaderboard_snapshots", "avg_ttfb")
    op.drop_column("leaderboard_snapshots", "avg_cer")

    # evaluations: drop latency metric columns
    op.drop_column("evaluations", "generation_time_ms")
    op.drop_column("evaluations", "e2e_latency_ms")
    op.drop_column("evaluations", "ttfb_ms")

    # battles: drop prompt reference columns
    op.drop_column("battles", "prompt_text")
    op.drop_constraint("fk_battles_prompt_id", "battles", type_="foreignkey")
    op.drop_column("battles", "prompt_id")
