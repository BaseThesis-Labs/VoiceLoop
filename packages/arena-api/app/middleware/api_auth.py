"""API key authentication dependency for experiment endpoints."""
from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.developer import Developer, hash_api_key

security = HTTPBearer()


async def get_current_developer(
    credentials: HTTPAuthorizationCredentials = Security(security),
    db: AsyncSession = Depends(get_db),
) -> Developer:
    """Validate Bearer token and return the associated Developer."""
    key_hash = hash_api_key(credentials.credentials)
    result = await db.execute(
        select(Developer).where(
            Developer.api_key_hash == key_hash,
            Developer.is_active == True,
        )
    )
    developer = result.scalar_one_or_none()
    if not developer:
        raise HTTPException(status_code=401, detail="Invalid or inactive API key")
    return developer
