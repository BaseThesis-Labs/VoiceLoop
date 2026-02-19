"""add 4-model battle columns (model_c, model_d, eval_c, eval_d)

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-19 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add model_c_id, model_d_id, eval_c_id, eval_d_id to battles table."""
    op.add_column('battles', sa.Column('model_c_id', sa.String(), nullable=True))
    op.add_column('battles', sa.Column('model_d_id', sa.String(), nullable=True))
    op.add_column('battles', sa.Column('eval_c_id', sa.String(), nullable=True))
    op.add_column('battles', sa.Column('eval_d_id', sa.String(), nullable=True))
    op.create_foreign_key('fk_battles_model_c', 'battles', 'models', ['model_c_id'], ['id'])
    op.create_foreign_key('fk_battles_model_d', 'battles', 'models', ['model_d_id'], ['id'])
    op.create_foreign_key('fk_battles_eval_c', 'battles', 'evaluations', ['eval_c_id'], ['id'])
    op.create_foreign_key('fk_battles_eval_d', 'battles', 'evaluations', ['eval_d_id'], ['id'])


def downgrade() -> None:
    """Remove 4-model battle columns."""
    op.drop_constraint('fk_battles_eval_d', 'battles', type_='foreignkey')
    op.drop_constraint('fk_battles_eval_c', 'battles', type_='foreignkey')
    op.drop_constraint('fk_battles_model_d', 'battles', type_='foreignkey')
    op.drop_constraint('fk_battles_model_c', 'battles', type_='foreignkey')
    op.drop_column('battles', 'eval_d_id')
    op.drop_column('battles', 'eval_c_id')
    op.drop_column('battles', 'model_d_id')
    op.drop_column('battles', 'model_c_id')
