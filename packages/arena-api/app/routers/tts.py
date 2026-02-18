import asyncio

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.voice_model import VoiceModel
from app.services.tts_service import generate_tts

router = APIRouter(prefix="/api/v1/tts", tags=["tts"])


class TTSGenerateRequest(BaseModel):
    model_id: str
    text: str
    engine: str | None = None  # overrides config_json.model_id (e.g. "lightning", "lightning-large")


class TTSGenerateResponse(BaseModel):
    audio_url: str
    duration_seconds: float
    ttfb_ms: float
    generation_time_ms: float
    model_id: str
    model_name: str


@router.post("/generate", response_model=TTSGenerateResponse)
async def generate_tts_audio(
    body: TTSGenerateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Generate TTS audio for a single model (playground use)."""
    result = await db.execute(select(VoiceModel).where(VoiceModel.id == body.model_id))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    voice_id = model.config_json.get("voice_id")
    if not voice_id:
        raise HTTPException(status_code=400, detail="Model has no voice_id configured")

    tts_model_id = body.engine or model.config_json.get("model_id", "sonic-2024-12-12")
    provider = model.provider

    loop = asyncio.get_event_loop()
    tts_result = await loop.run_in_executor(
        None, generate_tts, body.text, provider, voice_id, tts_model_id
    )

    return TTSGenerateResponse(
        audio_url=f"/api/v1/audio/{tts_result['filename']}",
        duration_seconds=tts_result["duration_seconds"],
        ttfb_ms=tts_result["ttfb_ms"],
        generation_time_ms=tts_result["generation_time_ms"],
        model_id=model.id,
        model_name=model.name,
    )
