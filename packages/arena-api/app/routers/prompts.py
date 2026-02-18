from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.prompt import Prompt
from app.schemas.prompt import PromptResponse

router = APIRouter(prefix="/api/v1/prompts", tags=["prompts"])


@router.get("", response_model=list[PromptResponse])
async def list_prompts(
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Prompt).order_by(Prompt.created_at)
    if category:
        stmt = stmt.where(Prompt.category == category)
    result = await db.execute(stmt)
    return result.scalars().all()
