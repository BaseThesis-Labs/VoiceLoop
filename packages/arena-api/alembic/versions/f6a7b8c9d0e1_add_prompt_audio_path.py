"""add audio_path, prompt_type, duration_seconds to prompts table

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-02-21 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, Sequence[str], None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add audio_path, prompt_type, and duration_seconds columns to prompts."""
    op.add_column('prompts', sa.Column('audio_path', sa.Text(), nullable=True))
    op.add_column(
        'prompts',
        sa.Column('prompt_type', sa.Text(), nullable=False, server_default='text'),
    )
    op.add_column('prompts', sa.Column('duration_seconds', sa.Float(), nullable=True))


def downgrade() -> None:
    """Remove audio_path, prompt_type, and duration_seconds from prompts."""
    op.drop_column('prompts', 'duration_seconds')
    op.drop_column('prompts', 'prompt_type')
    op.drop_column('prompts', 'audio_path')
