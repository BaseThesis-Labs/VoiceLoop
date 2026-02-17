from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.voice_model import VoiceModel
from app.schemas.model import ModelCreate, ModelUpdate, ModelResponse

router = APIRouter(prefix="/api/v1/models", tags=["models"])


@router.post("", response_model=ModelResponse, status_code=201)
async def create_model(body: ModelCreate, db: AsyncSession = Depends(get_db)):
    model = VoiceModel(**body.model_dump())
    db.add(model)
    await db.commit()
    await db.refresh(model)
    return model


@router.get("", response_model=list[ModelResponse])
async def list_models(
    provider: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(VoiceModel).order_by(VoiceModel.elo_rating.desc())
    if provider:
        stmt = stmt.where(VoiceModel.provider == provider)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{model_id}", response_model=ModelResponse)
async def get_model(model_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(VoiceModel).where(VoiceModel.id == model_id))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return model


@router.patch("/{model_id}", response_model=ModelResponse)
async def update_model(
    model_id: str, body: ModelUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(VoiceModel).where(VoiceModel.id == model_id))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(model, field, value)
    await db.commit()
    await db.refresh(model)
    return model
