"""Add agent battle tables (agent_configurations, agent_conversations, agent_battles) and extend scenarios.

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "h8i9j0k1l2m3"
down_revision = "g7h8i9j0k1l2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create agent_configurations table
    op.create_table(
        "agent_configurations",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("architecture_type", sa.String(), nullable=False, server_default="cascade"),
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column("components_json", JSONB, nullable=False),
        sa.Column("config_json", JSONB, nullable=True),
        sa.Column("elo_rating", sa.Float(), server_default="1500.0"),
        sa.Column("total_battles", sa.Integer(), server_default="0"),
        sa.Column("win_rate", sa.Float(), server_default="0.0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # 2. Create agent_conversations table
    op.create_table(
        "agent_conversations",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("battle_id", sa.String(), sa.ForeignKey("battles.id"), nullable=False),
        sa.Column("agent_config_id", sa.String(), sa.ForeignKey("agent_configurations.id"), nullable=False),
        sa.Column("scenario_id", sa.String(), sa.ForeignKey("scenarios.id"), nullable=False),
        sa.Column("agent_label", sa.String(), nullable=False),
        sa.Column("turns_json", JSONB, nullable=True),
        sa.Column("total_turns", sa.Integer(), nullable=True),
        sa.Column("duration_seconds", sa.Float(), nullable=True),
        sa.Column("user_audio_path", sa.String(), nullable=True),
        sa.Column("agent_audio_path", sa.String(), nullable=True),
        sa.Column("transcript_full", sa.Text(), nullable=True),
        sa.Column("avg_response_latency_ms", sa.Float(), nullable=True),
        sa.Column("p50_latency_ms", sa.Float(), nullable=True),
        sa.Column("p95_latency_ms", sa.Float(), nullable=True),
        sa.Column("ttfb_avg_ms", sa.Float(), nullable=True),
        sa.Column("task_success", sa.Boolean(), nullable=True),
        sa.Column("joint_goal_accuracy", sa.Float(), nullable=True),
        sa.Column("containment", sa.Boolean(), nullable=True),
        sa.Column("turns_to_completion", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # 3. Create agent_battles table
    op.create_table(
        "agent_battles",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("battle_id", sa.String(), sa.ForeignKey("battles.id"), nullable=False),
        sa.Column("formulation", sa.String(), nullable=False, server_default="outcome"),
        sa.Column("scenario_id", sa.String(), sa.ForeignKey("scenarios.id"), nullable=False),
        sa.Column("config_a_id", sa.String(), sa.ForeignKey("agent_configurations.id"), nullable=False),
        sa.Column("config_b_id", sa.String(), sa.ForeignKey("agent_configurations.id"), nullable=False),
        sa.Column("conversation_a_id", sa.String(), sa.ForeignKey("agent_conversations.id"), nullable=True),
        sa.Column("conversation_b_id", sa.String(), sa.ForeignKey("agent_conversations.id"), nullable=True),
        sa.Column("sub_votes_json", JSONB, nullable=True),
        sa.Column("automated_eval_json", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # 4. Add new columns to scenarios table
    op.add_column("scenarios", sa.Column("system_prompt", sa.Text(), nullable=True))
    op.add_column("scenarios", sa.Column("required_slots", JSONB, nullable=True))
    op.add_column("scenarios", sa.Column("success_criteria", sa.Text(), nullable=True))
    op.add_column("scenarios", sa.Column("tools_available", JSONB, nullable=True))
    op.add_column("scenarios", sa.Column("max_turns", sa.Integer(), nullable=True, server_default="10"))
    op.add_column("scenarios", sa.Column("max_duration_seconds", sa.Integer(), nullable=True, server_default="120"))

    # 5. Make battles.model_a_id nullable (agent battles don't use voice models)
    op.alter_column("battles", "model_a_id", nullable=True)

    # 6. Make battles.model_b_id nullable
    op.alter_column("battles", "model_b_id", nullable=True)

    # 7. Replace trigger function to skip agent battles and handle null model IDs
    op.execute("DROP TRIGGER IF EXISTS trg_check_battle_model_type ON battles;")
    op.execute("DROP FUNCTION IF EXISTS check_battle_model_type_match();")
    op.execute("""
        CREATE OR REPLACE FUNCTION check_battle_model_type_match()
        RETURNS TRIGGER AS $$
        DECLARE
            model_ids TEXT[];
            mid TEXT;
            mtype TEXT;
        BEGIN
            IF NEW.battle_type = 'agent' THEN
                RETURN NEW;
            END IF;

            model_ids := ARRAY[NEW.model_a_id, NEW.model_b_id];
            IF NEW.model_c_id IS NOT NULL THEN
                model_ids := array_append(model_ids, NEW.model_c_id);
            END IF;
            IF NEW.model_d_id IS NOT NULL THEN
                model_ids := array_append(model_ids, NEW.model_d_id);
            END IF;

            FOREACH mid IN ARRAY model_ids LOOP
                IF mid IS NULL THEN
                    CONTINUE;
                END IF;
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
            BEFORE INSERT ON battles
            FOR EACH ROW
            EXECUTE FUNCTION check_battle_model_type_match();
    """)


def downgrade() -> None:
    # Restore original trigger function (without agent skip / null handling)
    op.execute("DROP TRIGGER IF EXISTS trg_check_battle_model_type ON battles;")
    op.execute("DROP FUNCTION IF EXISTS check_battle_model_type_match();")
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
            BEFORE INSERT ON battles
            FOR EACH ROW
            EXECUTE FUNCTION check_battle_model_type_match();
    """)

    # Restore battles.model_a_id and model_b_id as NOT NULL
    op.alter_column("battles", "model_b_id", nullable=False)
    op.alter_column("battles", "model_a_id", nullable=False)

    # Remove scenario columns
    op.drop_column("scenarios", "max_duration_seconds")
    op.drop_column("scenarios", "max_turns")
    op.drop_column("scenarios", "tools_available")
    op.drop_column("scenarios", "success_criteria")
    op.drop_column("scenarios", "required_slots")
    op.drop_column("scenarios", "system_prompt")

    # Drop tables in reverse order
    op.drop_table("agent_battles")
    op.drop_table("agent_conversations")
    op.drop_table("agent_configurations")
