"""add developers, experiments, and trials tables

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-02-20 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create developers, experiments, and trials tables."""
    # developers
    op.create_table(
        'developers',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('api_key_hash', sa.String(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_developers_email', 'developers', ['email'], unique=True)
    op.create_index('ix_developers_api_key_hash', 'developers', ['api_key_hash'], unique=True)

    # experiments
    op.create_table(
        'experiments',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('developer_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('scenario', sa.String(), nullable=False),
        sa.Column('eval_mode', sa.String(), nullable=False, server_default='automated'),
        sa.Column('status', sa.String(), nullable=False, server_default='created'),
        sa.Column('models_json', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('prompts_json', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('webhook_url', sa.String(), nullable=True),
        sa.Column('total_trials', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('completed_trials', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('results_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['developer_id'], ['developers.id']),
    )
    op.create_index('ix_experiments_developer_id', 'experiments', ['developer_id'])

    # trials
    op.create_table(
        'trials',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('experiment_id', sa.String(), nullable=False),
        sa.Column('prompt_index', sa.Integer(), nullable=False),
        sa.Column('prompt_text', sa.Text(), nullable=False),
        sa.Column('provider', sa.String(), nullable=False),
        sa.Column('voice_id', sa.String(), nullable=False),
        sa.Column('model_id', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('audio_path', sa.String(), nullable=True),
        sa.Column('audio_filename', sa.String(), nullable=True),
        sa.Column('duration_seconds', sa.Float(), nullable=True),
        sa.Column('ttfb_ms', sa.Float(), nullable=True),
        sa.Column('generation_time_ms', sa.Float(), nullable=True),
        sa.Column('silence_ratio', sa.Float(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['experiment_id'], ['experiments.id']),
    )
    op.create_index('ix_trials_experiment_id', 'trials', ['experiment_id'])


def downgrade() -> None:
    """Drop trials, experiments, and developers tables."""
    op.drop_index('ix_trials_experiment_id', table_name='trials')
    op.drop_table('trials')
    op.drop_index('ix_experiments_developer_id', table_name='experiments')
    op.drop_table('experiments')
    op.drop_index('ix_developers_api_key_hash', table_name='developers')
    op.drop_index('ix_developers_email', table_name='developers')
    op.drop_table('developers')
