"""Developer registration and API key management."""
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.developer import Developer, generate_api_key, hash_api_key
from app.schemas.developer import DeveloperCreate, DeveloperResponse

logger = logging.getLogger("arena.developers")

router = APIRouter(prefix="/api/v1/developers", tags=["developers"])


@router.post("", response_model=DeveloperResponse, status_code=201)
async def create_developer(body: DeveloperCreate, db: AsyncSession = Depends(get_db)):
    """Register a new developer and return an API key (shown once)."""
    # Check for existing email
    result = await db.execute(
        select(Developer).where(Developer.email == body.email)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    plaintext_key = generate_api_key()

    developer = Developer(
        name=body.name,
        email=body.email,
        api_key_hash=hash_api_key(plaintext_key),
    )
    db.add(developer)
    await db.commit()
    await db.refresh(developer)

    logger.info("New developer registered: %s (%s)", body.name, body.email)

    return DeveloperResponse(
        id=developer.id,
        name=developer.name,
        email=developer.email,
        api_key=plaintext_key,
    )
