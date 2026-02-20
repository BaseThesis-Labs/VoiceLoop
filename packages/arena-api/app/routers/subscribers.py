"""Subscriber endpoints for email collection (newsletter/waitlist)."""
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.subscriber import Subscriber

logger = logging.getLogger("arena.subscribers")

router = APIRouter(prefix="/api/v1/subscribers", tags=["subscribers"])


class SubscribeRequest(BaseModel):
    email: EmailStr
    source: str = "footer"


class SubscribeResponse(BaseModel):
    id: str
    email: str
    source: str


@router.post("", response_model=SubscribeResponse, status_code=201)
async def subscribe(body: SubscribeRequest, db: AsyncSession = Depends(get_db)):
    """Add an email subscriber."""
    # Check if already subscribed
    result = await db.execute(
        select(Subscriber).where(Subscriber.email == body.email)
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Already subscribed")

    subscriber = Subscriber(email=body.email, source=body.source)
    db.add(subscriber)
    await db.commit()
    await db.refresh(subscriber)

    logger.info("New subscriber: %s (source=%s)", body.email, body.source)
    return subscriber
