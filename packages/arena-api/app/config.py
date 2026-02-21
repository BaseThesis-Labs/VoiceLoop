from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/voiceloop_arena"
    hf_token: str = ""
    cartesia_api_key: str = ""
    smallest_api_key: str = ""
    deepgram_api_key: str = ""
    elevenlabs_api_key: str = ""
    openai_api_key: str = ""
    hume_api_key: str = ""
    s2s_timeout_seconds: int = 8
    assemblyai_api_key: str = ""
    google_cloud_api_key: str = ""
    stt_timeout_seconds: int = 30
    enable_diarization: bool = True
    default_num_speakers: int = 2
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:5174", "https://koecode.io", "https://www.koecode.io"]
    max_eval_workers: int = 2
    max_upload_size_mb: int = 50
    elo_k_factor: int = 32
    human_vote_weight: float = 1.5
    audio_storage_path: str = "./uploads"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @model_validator(mode="after")
    def fix_async_db_url(self):
        # Railway provides DATABASE_URL as postgresql:// but asyncpg needs postgresql+asyncpg://
        if self.database_url.startswith("postgresql://"):
            self.database_url = self.database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return self


settings = Settings()
