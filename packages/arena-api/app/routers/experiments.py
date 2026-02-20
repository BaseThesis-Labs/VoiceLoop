"""Experiment endpoints -- programmatic voice AI A/B testing."""
import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.api_auth import get_current_developer
from app.models.developer import Developer
from app.models.experiment import Experiment, Trial
from app.schemas.experiment import (
    ExperimentCreate,
    ExperimentResponse,
    ExperimentListResponse,
    ExperimentResultsResponse,
    TrialResponse,
)

logger = logging.getLogger("arena.experiments")

router = APIRouter(prefix="/api/v1/experiments", tags=["experiments"])

VALID_SCENARIOS = {
    "general", "customer_support", "medical", "financial",
    "technical_support", "adversarial", "multilingual",
}

VALID_PROVIDERS = {"cartesia", "elevenlabs", "smallestai", "deepgram"}

VALID_EVAL_MODES = {"automated"}


@router.post("", response_model=ExperimentResponse, status_code=201)
async def create_experiment(
    body: ExperimentCreate,
    developer: Developer = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    """Create a new experiment."""
    if body.scenario not in VALID_SCENARIOS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid scenario '{body.scenario}'. Must be one of: {sorted(VALID_SCENARIOS)}",
        )

    if body.eval_mode not in VALID_EVAL_MODES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid eval_mode '{body.eval_mode}'. Must be one of: {sorted(VALID_EVAL_MODES)}",
        )

    for ms in body.models:
        if ms.provider not in VALID_PROVIDERS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid provider '{ms.provider}'. Must be one of: {sorted(VALID_PROVIDERS)}",
            )

    for i, p in enumerate(body.prompts):
        if not p.strip():
            raise HTTPException(status_code=400, detail=f"Prompt at index {i} is empty")

    experiment = Experiment(
        developer_id=developer.id,
        name=body.name,
        scenario=body.scenario,
        eval_mode=body.eval_mode,
        models_json=[ms.model_dump() for ms in body.models],
        prompts_json=body.prompts,
        webhook_url=body.webhook_url,
    )
    db.add(experiment)
    await db.commit()
    await db.refresh(experiment)

    logger.info("Experiment created: %s by developer %s", experiment.id, developer.id)
    return experiment


@router.post("/{experiment_id}/run", response_model=ExperimentResponse)
async def run_experiment(
    experiment_id: str,
    developer: Developer = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    """Start running an experiment."""
    result = await db.execute(
        select(Experiment).where(
            Experiment.id == experiment_id,
            Experiment.developer_id == developer.id,
        )
    )
    exp = result.scalar_one_or_none()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if exp.status != "created":
        raise HTTPException(
            status_code=409,
            detail=f"Experiment is already '{exp.status}'. Only 'created' experiments can be run.",
        )

    from app.services.experiment_runner import run_experiment as execute_experiment
    asyncio.create_task(execute_experiment(experiment_id))

    exp.status = "running"
    await db.commit()
    await db.refresh(exp)

    logger.info("Experiment %s started", experiment_id)
    return exp


@router.get("", response_model=list[ExperimentListResponse])
async def list_experiments(
    status: str | None = None,
    scenario: str | None = None,
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
    developer: Developer = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    """List experiments for the authenticated developer."""
    stmt = (
        select(Experiment)
        .where(Experiment.developer_id == developer.id)
        .order_by(Experiment.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if status:
        stmt = stmt.where(Experiment.status == status)
    if scenario:
        stmt = stmt.where(Experiment.scenario == scenario)

    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{experiment_id}", response_model=ExperimentResponse)
async def get_experiment(
    experiment_id: str,
    developer: Developer = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    """Get experiment details and status."""
    result = await db.execute(
        select(Experiment).where(
            Experiment.id == experiment_id,
            Experiment.developer_id == developer.id,
        )
    )
    exp = result.scalar_one_or_none()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return exp


@router.get("/{experiment_id}/results", response_model=ExperimentResultsResponse)
async def get_experiment_results(
    experiment_id: str,
    developer: Developer = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregated results for a completed experiment."""
    result = await db.execute(
        select(Experiment).where(
            Experiment.id == experiment_id,
            Experiment.developer_id == developer.id,
        )
    )
    exp = result.scalar_one_or_none()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if exp.status != "completed":
        raise HTTPException(
            status_code=409,
            detail=f"Experiment is '{exp.status}'. Results are only available when status is 'completed'.",
        )

    results = exp.results_json
    return ExperimentResultsResponse(
        experiment_id=exp.id,
        status=exp.status,
        rankings=results.get("rankings", []),
        head_to_head=results.get("head_to_head", []),
        winner=results.get("winner"),
        confidence=results.get("confidence", "inconclusive"),
    )


@router.get("/{experiment_id}/trials", response_model=list[TrialResponse])
async def get_experiment_trials(
    experiment_id: str,
    developer: Developer = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    """Get individual trial details for an experiment."""
    exp_result = await db.execute(
        select(Experiment).where(
            Experiment.id == experiment_id,
            Experiment.developer_id == developer.id,
        )
    )
    if not exp_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Experiment not found")

    result = await db.execute(
        select(Trial)
        .where(Trial.experiment_id == experiment_id)
        .order_by(Trial.prompt_index, Trial.provider)
    )
    trials = result.scalars().all()

    return [
        TrialResponse(
            id=t.id,
            experiment_id=t.experiment_id,
            prompt_index=t.prompt_index,
            prompt_text=t.prompt_text,
            provider=t.provider,
            voice_id=t.voice_id,
            model_id=t.model_id,
            status=t.status,
            audio_url=f"/api/v1/audio/{t.audio_filename}" if t.audio_filename else None,
            duration_seconds=t.duration_seconds,
            ttfb_ms=t.ttfb_ms,
            generation_time_ms=t.generation_time_ms,
            silence_ratio=t.silence_ratio,
            error_message=t.error_message,
            created_at=t.created_at,
        )
        for t in trials
    ]
