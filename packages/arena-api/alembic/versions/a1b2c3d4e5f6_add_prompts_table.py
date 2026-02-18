"""add prompts table

Revision ID: a1b2c3d4e5f6
Revises: dfa39886fa59
Create Date: 2026-02-17 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'dfa39886fa59'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('prompts',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('category', sa.String(), nullable=False),
        sa.Column('scenario_id', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['scenario_id'], ['scenarios.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('prompts')
