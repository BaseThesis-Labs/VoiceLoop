from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from app.database import get_db
from app.models.voice_model import VoiceModel
from app.models.evaluation import Evaluation
from app.models.battle import Battle
from app.models.scenario import Scenario
from app.models.leaderboard import LeaderboardSnapshot
import csv
import io

MAX_EXPORT_ROWS = 10_000

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


@router.get("/summary")
async def get_summary(db: AsyncSession = Depends(get_db)):
    total_models = (await db.execute(select(func.count(VoiceModel.id)))).scalar() or 0
    total_evals = (await db.execute(select(func.count(Evaluation.id)))).scalar() or 0
    total_battles = (await db.execute(select(func.count(Battle.id)))).scalar() or 0
    total_scenarios = (await db.execute(select(func.count(Scenario.id)))).scalar() or 0
    completed_evals = (
        await db.execute(
            select(func.count(Evaluation.id)).where(Evaluation.status == "completed")
        )
    ).scalar() or 0

    return {
        "total_models": total_models,
        "total_evaluations": total_evals,
        "completed_evaluations": completed_evals,
        "total_battles": total_battles,
        "total_scenarios": total_scenarios,
    }


@router.get("/correlations")
async def get_correlations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Evaluation.metrics_json).where(
            Evaluation.status == "completed",
            Evaluation.metrics_json.isnot(None),
        ).limit(500)
    )
    metrics_list = [row[0] for row in result.all()]

    return {
        "count": len(metrics_list),
        "metrics": metrics_list,
    }


@router.get("/vote-distribution")
async def get_vote_distribution(
    battle_type: str = "tts",
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Battle.winner, func.count())
        .where(Battle.battle_type == battle_type, Battle.winner.isnot(None))
        .group_by(Battle.winner)
    )
    distribution: dict[str, int] = {}
    total = 0
    for winner, count in result.all():
        distribution[winner] = count
        total += count
    distribution["total"] = total
    return distribution


@router.get("/battles")
async def get_battle_history(
    battle_type: str | None = None,
    model_id: str | None = None,
    provider: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Battle).order_by(Battle.created_at.desc())
    if battle_type:
        stmt = stmt.where(Battle.battle_type == battle_type)
    if model_id:
        stmt = stmt.where(or_(
            Battle.model_a_id == model_id,
            Battle.model_b_id == model_id,
            Battle.model_c_id == model_id,
            Battle.model_d_id == model_id,
        ))
    if provider:
        stmt = stmt.where(or_(
            Battle.model_a_id.in_(select(VoiceModel.id).where(VoiceModel.provider == provider)),
            Battle.model_b_id.in_(select(VoiceModel.id).where(VoiceModel.provider == provider)),
            Battle.model_c_id.in_(select(VoiceModel.id).where(VoiceModel.provider == provider)),
            Battle.model_d_id.in_(select(VoiceModel.id).where(VoiceModel.provider == provider)),
        ))
    try:
        if date_from:
            stmt = stmt.where(Battle.created_at >= datetime.fromisoformat(date_from))
        if date_to:
            stmt = stmt.where(Battle.created_at <= datetime.fromisoformat(date_to))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use ISO format (YYYY-MM-DD).")
    stmt = stmt.limit(limit).offset(offset)

    battles = (await db.execute(stmt)).scalars().all()

    # Batch-load model names to avoid N+1
    model_ids_set: set[str] = set()
    for b in battles:
        for mid in [b.model_a_id, b.model_b_id, b.model_c_id, b.model_d_id]:
            if mid:
                model_ids_set.add(mid)

    models_map: dict[str, VoiceModel] = {}
    if model_ids_set:
        models_result = await db.execute(
            select(VoiceModel).where(VoiceModel.id.in_(list(model_ids_set)))
        )
        models_map = {m.id: m for m in models_result.scalars().all()}

    records = []
    for b in battles:
        record = {
            "battle_id": b.id,
            "battle_type": b.battle_type,
            "created_at": b.created_at.isoformat() if b.created_at else None,
            "winner": b.winner,
            "vote_source": b.vote_source,
            "elo_delta": b.elo_delta,
            "prompt_id": b.prompt_id,
            "prompt_text": b.prompt_text,
            "sub_votes": b.sub_votes,
        }
        for label in ["a", "b", "c", "d"]:
            mid = getattr(b, f"model_{label}_id")
            if mid and mid in models_map:
                record[f"model_{label}_name"] = models_map[mid].name
                record[f"model_{label}_provider"] = models_map[mid].provider
            else:
                record[f"model_{label}_name"] = None
                record[f"model_{label}_provider"] = None
        records.append(record)
    return records


@router.get("/model-breakdown/{model_id}")
async def get_model_breakdown(
    model_id: str,
    battle_type: str = "tts",
    db: AsyncSession = Depends(get_db),
):
    # 1. Get the model
    model_result = await db.execute(
        select(VoiceModel).where(VoiceModel.id == model_id)
    )
    model = model_result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    # 2. Get all battles where this model participated
    battles_stmt = select(Battle).where(
        Battle.battle_type == battle_type,
        Battle.winner.isnot(None),
        or_(
            Battle.model_a_id == model_id,
            Battle.model_b_id == model_id,
            Battle.model_c_id == model_id,
            Battle.model_d_id == model_id,
        ),
    )
    battles = (await db.execute(battles_stmt)).scalars().all()

    # 3. Compute opponent record
    opponent_stats: dict[str, dict] = {}
    wins = losses = ties = 0
    for b in battles:
        # Find which label this model was
        label = None
        for l in ["a", "b", "c", "d"]:
            if getattr(b, f"model_{l}_id") == model_id:
                label = l
                break
        if not label:
            continue

        if b.winner == label:
            wins += 1
            for ol in ["a", "b", "c", "d"]:
                opp_id = getattr(b, f"model_{ol}_id")
                if opp_id and ol != label:
                    opponent_stats.setdefault(
                        opp_id, {"wins": 0, "losses": 0, "ties": 0}
                    )
                    opponent_stats[opp_id]["wins"] += 1
        elif b.winner == "tie":
            ties += 1
            for ol in ["a", "b", "c", "d"]:
                opp_id = getattr(b, f"model_{ol}_id")
                if opp_id and ol != label:
                    opponent_stats.setdefault(
                        opp_id, {"wins": 0, "losses": 0, "ties": 0}
                    )
                    opponent_stats[opp_id]["ties"] += 1
        elif b.winner != "all_bad":
            losses += 1
            for ol in ["a", "b", "c", "d"]:
                opp_id = getattr(b, f"model_{ol}_id")
                if opp_id and ol != label:
                    opponent_stats.setdefault(
                        opp_id, {"wins": 0, "losses": 0, "ties": 0}
                    )
                    opponent_stats[opp_id]["losses"] += 1

    # Load opponent names
    opp_ids = list(opponent_stats.keys())
    if opp_ids:
        opp_result = await db.execute(
            select(VoiceModel).where(VoiceModel.id.in_(opp_ids))
        )
        opp_map = {m.id: m for m in opp_result.scalars().all()}
    else:
        opp_map = {}

    opponents = []
    for opp_id, stats in opponent_stats.items():
        opp = opp_map.get(opp_id)
        opponents.append(
            {
                "model_id": opp_id,
                "model_name": opp.name if opp else "Unknown",
                "provider": opp.provider if opp else "Unknown",
                **stats,
            }
        )

    # 4. Average metrics from evaluations
    avg_result = await db.execute(
        select(
            func.avg(Evaluation.ttfb_ms).label("avg_ttfb"),
            func.avg(Evaluation.e2e_latency_ms).label("avg_e2e_latency"),
            func.avg(Evaluation.generation_time_ms).label("avg_generation_time"),
            func.avg(Evaluation.duration_seconds).label("avg_duration"),
        ).where(Evaluation.model_id == model_id, Evaluation.status == "completed")
    )
    avgs = avg_result.one()

    # 5. ELO history
    elo_result = await db.execute(
        select(LeaderboardSnapshot)
        .where(
            LeaderboardSnapshot.model_id == model_id,
            LeaderboardSnapshot.battle_type == battle_type,
        )
        .order_by(LeaderboardSnapshot.snapshot_date.asc())
    )
    elo_history = [
        {"date": s.snapshot_date.isoformat(), "elo_rating": s.elo_rating}
        for s in elo_result.scalars().all()
    ]

    return {
        "model_id": model_id,
        "model_name": model.name,
        "provider": model.provider,
        "battle_type": battle_type,
        "total_battles": len(battles),
        "wins": wins,
        "losses": losses,
        "ties": ties,
        "opponents": opponents,
        "avg_metrics": {
            "avg_ttfb": avgs.avg_ttfb,
            "avg_e2e_latency": avgs.avg_e2e_latency,
            "avg_generation_time": avgs.avg_generation_time,
            "avg_duration": avgs.avg_duration,
        },
        "elo_history": elo_history,
    }


def _sanitize_csv_value(value: str) -> str:
    """Prevent CSV injection by escaping formula-triggering characters."""
    if value and value[0] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + value
    return value


@router.get("/export")
async def export_data(
    battle_type: str | None = None,
    export_format: str = Query(default="json", alias="format"),
    date_from: str | None = None,
    date_to: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Battle)
        .where(Battle.winner.isnot(None))
        .order_by(Battle.created_at.desc())
        .limit(MAX_EXPORT_ROWS)
    )
    if battle_type:
        stmt = stmt.where(Battle.battle_type == battle_type)
    try:
        if date_from:
            stmt = stmt.where(Battle.created_at >= datetime.fromisoformat(date_from))
        if date_to:
            stmt = stmt.where(Battle.created_at <= datetime.fromisoformat(date_to))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use ISO format (YYYY-MM-DD).")

    battles = (await db.execute(stmt)).scalars().all()

    # Batch load models
    model_ids_set: set[str] = set()
    for b in battles:
        for mid in [b.model_a_id, b.model_b_id, b.model_c_id, b.model_d_id]:
            if mid:
                model_ids_set.add(mid)

    models_map: dict[str, VoiceModel] = {}
    if model_ids_set:
        models_result = await db.execute(
            select(VoiceModel).where(VoiceModel.id.in_(list(model_ids_set)))
        )
        models_map = {m.id: m for m in models_result.scalars().all()}

    # Batch load evaluations
    eval_ids_set: set[str] = set()
    for b in battles:
        for eid in [b.eval_a_id, b.eval_b_id, b.eval_c_id, b.eval_d_id]:
            if eid:
                eval_ids_set.add(eid)

    evals_map: dict[str, Evaluation] = {}
    if eval_ids_set:
        evals_result = await db.execute(
            select(Evaluation).where(Evaluation.id.in_(list(eval_ids_set)))
        )
        evals_map = {e.id: e for e in evals_result.scalars().all()}

    # Metric extraction helpers
    _DIRECT_COLS = [
        ("ttfb_ms", "ttfb"),
        ("e2e_latency_ms", "e2e_latency"),
        ("generation_time_ms", "generation_time"),
        ("duration_seconds", "duration"),
    ]
    _JSON_KEYS = [
        ("prosody_score", "prosody"),
        ("utmos", "utmos"),
        ("nisqa_overall", "nisqa"),
        ("dnsmos_overall", "dnsmos"),
        ("semascore", "semascore"),
        ("wer_score", "wer"),
        ("snr_db", "snr_db"),
        ("pace_score", "pace_score"),
        ("monotone_score", "monotone"),
        ("intonation_score", "intonation"),
    ]

    def _extract_eval_columns(ev: Evaluation | None, label: str) -> dict:
        """Return flattened metric columns for a single evaluation slot."""
        cols: dict = {}
        for attr, prefix in _DIRECT_COLS:
            cols[f"{prefix}_{label}"] = getattr(ev, attr, None) if ev else ""
            if cols[f"{prefix}_{label}"] is None:
                cols[f"{prefix}_{label}"] = ""
        mj = (ev.metrics_json or {}) if ev else {}
        for json_key, prefix in _JSON_KEYS:
            val = mj.get(json_key)
            cols[f"{prefix}_{label}"] = val if val is not None else ""
        return cols

    # Build rows
    rows = []
    for b in battles:
        row = {
            "battle_id": b.id,
            "type": b.battle_type,
            "created_at": b.created_at.isoformat() if b.created_at else "",
            "prompt_text": b.prompt_text or "",
            "winner": b.winner or "",
            "vote_source": b.vote_source or "",
            "elo_delta": b.elo_delta,
        }
        for label in ["a", "b", "c", "d"]:
            mid = getattr(b, f"model_{label}_id")
            m = models_map.get(mid) if mid else None
            row[f"model_{label}_name"] = m.name if m else ""
            row[f"model_{label}_provider"] = m.provider if m else ""

        # Per-model evaluation metrics
        for label in ["a", "b", "c", "d"]:
            eid = getattr(b, f"eval_{label}_id")
            ev = evals_map.get(eid) if eid else None
            row.update(_extract_eval_columns(ev, label))

        rows.append(row)

    if export_format == "csv":
        output = io.StringIO()
        if rows:
            writer = csv.DictWriter(output, fieldnames=rows[0].keys())
            writer.writeheader()
            for row in rows:
                sanitized = {
                    k: _sanitize_csv_value(str(v)) if isinstance(v, str) else v
                    for k, v in row.items()
                }
                writer.writerow(sanitized)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=battles_export.csv"
            },
        )
    else:
        return rows
