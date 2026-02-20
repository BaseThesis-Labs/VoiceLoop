from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.services.eval_service import init_executor, shutdown_executor


@asynccontextmanager
async def lifespan(app: FastAPI):
    import os
    os.makedirs(settings.audio_storage_path, exist_ok=True)
    init_executor()
    yield
    shutdown_executor()


app = FastAPI(title="VoiceLoop Arena API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


from app.routers import models, scenarios, evaluations, battles, leaderboard, analytics, prompts, tts, subscribers

app.include_router(models.router)
app.include_router(scenarios.router)
app.include_router(evaluations.router)
app.include_router(battles.router)
app.include_router(leaderboard.router)
app.include_router(analytics.router)
app.include_router(prompts.router)
app.include_router(tts.router)
app.include_router(subscribers.router)


@app.get("/api/v1/health")
async def health():
    return {"status": "ok"}


# Mount static file serving for generated audio AFTER routers
from starlette.staticfiles import StaticFiles
app.mount("/api/v1/audio", StaticFiles(directory=settings.audio_storage_path), name="audio")
