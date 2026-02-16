from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.battle import Battle
from app.models.voice_model import VoiceModel
from app.schemas.battle import BattleCreate, BattleVote, BattleResponse
from app.services.elo import update_elo

router = APIRouter(prefix="/api/v1/battles", tags=["battles"])


@router.post("", response_model=BattleResponse, status_code=201)
async def create_battle(body: BattleCreate, db: AsyncSession = Depends(get_db)):
    battle = Battle(
        scenario_id=body.scenario_id,
        model_a_id=body.model_a_id,
        model_b_id=body.model_b_id,
    )
    db.add(battle)
    await db.commit()
    await db.refresh(battle)
    return battle


@router.get("", response_model=list[BattleResponse])
async def list_battles(
    scenario_id: str | None = None,
    model_id: str | None = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Battle).order_by(Battle.created_at.desc()).limit(limit)
    if scenario_id:
        stmt = stmt.where(Battle.scenario_id == scenario_id)
    if model_id:
        stmt = stmt.where(
            (Battle.model_a_id == model_id) | (Battle.model_b_id == model_id)
        )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{battle_id}", response_model=BattleResponse)
async def get_battle(battle_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Battle).where(Battle.id == battle_id))
    battle = result.scalar_one_or_none()
    if not battle:
        raise HTTPException(status_code=404, detail="Battle not found")
    return battle


@router.post("/{battle_id}/vote", response_model=BattleResponse)
async def vote_battle(
    battle_id: str, body: BattleVote, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Battle).where(Battle.id == battle_id))
    battle = result.scalar_one_or_none()
    if not battle:
        raise HTTPException(status_code=404, detail="Battle not found")
    if battle.winner is not None:
        raise HTTPException(status_code=400, detail="Battle already resolved")
    if body.winner not in ("a", "b", "tie"):
        raise HTTPException(status_code=400, detail="winner must be 'a', 'b', or 'tie'")

    model_a = (await db.execute(select(VoiceModel).where(VoiceModel.id == battle.model_a_id))).scalar_one()
    model_b = (await db.execute(select(VoiceModel).where(VoiceModel.id == battle.model_b_id))).scalar_one()

    new_a, new_b, delta = update_elo(model_a.elo_rating, model_b.elo_rating, body.winner)
    model_a.elo_rating = new_a
    model_a.total_battles += 1
    model_b.elo_rating = new_b
    model_b.total_battles += 1

    if body.winner == "a":
        total_wins_a = round(model_a.win_rate * (model_a.total_battles - 1)) + 1
        model_a.win_rate = total_wins_a / model_a.total_battles
        model_b.win_rate = round(model_b.win_rate * (model_b.total_battles - 1)) / model_b.total_battles
    elif body.winner == "b":
        model_a.win_rate = round(model_a.win_rate * (model_a.total_battles - 1)) / model_a.total_battles
        total_wins_b = round(model_b.win_rate * (model_b.total_battles - 1)) + 1
        model_b.win_rate = total_wins_b / model_b.total_battles

    battle.winner = body.winner
    battle.vote_source = "human"
    battle.elo_delta = delta

    await db.commit()
    await db.refresh(battle)
    return battle
