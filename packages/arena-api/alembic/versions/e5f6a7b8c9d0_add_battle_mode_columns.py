"""add battle_type, model_type columns with CHECK constraints and type alignment trigger

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-02-21 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add model_type, battle_type columns, CHECK constraints, and type-match trigger."""

    # 1. Add model_type to models table
    op.add_column(
        'models',
        sa.Column('model_type', sa.Text(), nullable=False, server_default='tts'),
    )
    op.create_check_constraint(
        'ck_models_model_type',
        'models',
        "model_type IN ('tts', 'stt', 's2s', 'agent')",
    )

    # 2. Add battle_type to battles table
    op.add_column(
        'battles',
        sa.Column('battle_type', sa.Text(), nullable=False, server_default='tts'),
    )
    op.create_check_constraint(
        'ck_battles_battle_type',
        'battles',
        "battle_type IN ('tts', 'stt', 's2s', 'agent')",
    )

    # 3. Add input_audio_path (nullable) to battles table
    op.add_column(
        'battles',
        sa.Column('input_audio_path', sa.Text(), nullable=True),
    )

    # 4. Add sub_votes JSONB (nullable) to battles table
    op.add_column(
        'battles',
        sa.Column('sub_votes', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )

    # 5. Add transcript_output (nullable) to evaluations table
    op.add_column(
        'evaluations',
        sa.Column('transcript_output', sa.Text(), nullable=True),
    )

    # 6. Add battle_type to leaderboard_snapshots table
    op.add_column(
        'leaderboard_snapshots',
        sa.Column('battle_type', sa.Text(), nullable=False, server_default='tts'),
    )
    op.create_check_constraint(
        'ck_leaderboard_snapshots_battle_type',
        'leaderboard_snapshots',
        "battle_type IN ('tts', 'stt', 's2s', 'agent')",
    )

    # 7. Create trigger function and trigger to enforce model_type / battle_type alignment
    op.execute("""
        CREATE OR REPLACE FUNCTION check_battle_model_type_match()
        RETURNS TRIGGER AS $$
        DECLARE
            model_ids TEXT[];
            mid TEXT;
            mtype TEXT;
        BEGIN
            model_ids := ARRAY[NEW.model_a_id, NEW.model_b_id];
            IF NEW.model_c_id IS NOT NULL THEN
                model_ids := array_append(model_ids, NEW.model_c_id);
            END IF;
            IF NEW.model_d_id IS NOT NULL THEN
                model_ids := array_append(model_ids, NEW.model_d_id);
            END IF;

            FOREACH mid IN ARRAY model_ids LOOP
                SELECT model_type INTO mtype FROM models WHERE id = mid;
                IF mtype IS NULL THEN
                    RAISE EXCEPTION 'Model % not found', mid;
                END IF;
                IF mtype != NEW.battle_type THEN
                    RAISE EXCEPTION 'Model % has type % but battle type is %', mid, mtype, NEW.battle_type;
                END IF;
            END LOOP;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER trg_check_battle_model_type
            BEFORE INSERT OR UPDATE ON battles
            FOR EACH ROW
            EXECUTE FUNCTION check_battle_model_type_match();
    """)


def downgrade() -> None:
    """Remove trigger, columns, and constraints in reverse order."""

    # Drop trigger and trigger function
    op.execute("DROP TRIGGER IF EXISTS trg_check_battle_model_type ON battles;")
    op.execute("DROP FUNCTION IF EXISTS check_battle_model_type_match();")

    # Drop battle_type from leaderboard_snapshots
    op.drop_constraint('ck_leaderboard_snapshots_battle_type', 'leaderboard_snapshots', type_='check')
    op.drop_column('leaderboard_snapshots', 'battle_type')

    # Drop transcript_output from evaluations
    op.drop_column('evaluations', 'transcript_output')

    # Drop sub_votes from battles
    op.drop_column('battles', 'sub_votes')

    # Drop input_audio_path from battles
    op.drop_column('battles', 'input_audio_path')

    # Drop battle_type (and its CHECK constraint) from battles
    op.drop_constraint('ck_battles_battle_type', 'battles', type_='check')
    op.drop_column('battles', 'battle_type')

    # Drop model_type (and its CHECK constraint) from models
    op.drop_constraint('ck_models_model_type', 'models', type_='check')
    op.drop_column('models', 'model_type')
