import os
import uuid
import asyncio
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, WebSocket
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.config import settings
from app.models.evaluation import Evaluation
from app.schemas.evaluation import EvaluationResponse

router = APIRouter(prefix="/api/v1/evaluations", tags=["evaluations"])


@router.post("", status_code=201)
async def create_evaluation(
    audio: UploadFile = File(...),
    model_id: str = Form(...),
    scenario_id: str | None = Form(None),
    transcript_ref: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
):
    file_id = str(uuid.uuid4())
    ext = os.path.splitext(audio.filename or "audio.wav")[1] or ".wav"
    audio_path = os.path.join(settings.audio_storage_path, f"{file_id}{ext}")
    content = await audio.read()
    with open(audio_path, "wb") as f:
        f.write(content)

    evaluation = Evaluation(
        model_id=model_id,
        scenario_id=scenario_id,
        status="pending",
        audio_path=audio_path,
        transcript_ref=transcript_ref,
    )
    db.add(evaluation)
    await db.commit()
    await db.refresh(evaluation)

    from app.services.eval_service import submit_evaluation
    asyncio.create_task(submit_evaluation(evaluation.id))

    return {"id": evaluation.id, "status": "pending"}


@router.get("", response_model=list[EvaluationResponse])
async def list_evaluations(
    model_id: str | None = None,
    scenario_id: str | None = None,
    status: str | None = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Evaluation).order_by(Evaluation.created_at.desc()).limit(limit)
    if model_id:
        stmt = stmt.where(Evaluation.model_id == model_id)
    if scenario_id:
        stmt = stmt.where(Evaluation.scenario_id == scenario_id)
    if status:
        stmt = stmt.where(Evaluation.status == status)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{eval_id}", response_model=EvaluationResponse)
async def get_evaluation(eval_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Evaluation).where(Evaluation.id == eval_id))
    evaluation = result.scalar_one_or_none()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    return evaluation


@router.websocket("/{eval_id}/stream")
async def eval_stream(websocket: WebSocket, eval_id: str):
    await websocket.accept()
    try:
        from app.database import async_session
        while True:
            async with async_session() as db:
                result = await db.execute(
                    select(Evaluation).where(Evaluation.id == eval_id)
                )
                evaluation = result.scalar_one_or_none()
                if not evaluation:
                    await websocket.send_json({"error": "Evaluation not found"})
                    break
                await websocket.send_json({
                    "eval_id": eval_id,
                    "status": evaluation.status,
                })
                if evaluation.status in ("completed", "failed"):
                    break
            await asyncio.sleep(1)
    except Exception:
        pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
