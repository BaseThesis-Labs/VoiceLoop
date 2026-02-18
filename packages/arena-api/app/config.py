from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/voiceloop_arena"
    hf_token: str = ""
    cartesia_api_key: str = ""
    smallest_api_key: str = ""
    deepgram_api_key: str = ""
    enable_diarization: bool = True
    default_num_speakers: int = 2
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:5174"]
    max_eval_workers: int = 2
    max_upload_size_mb: int = 50
    elo_k_factor: int = 32
    human_vote_weight: float = 1.5
    audio_storage_path: str = "./uploads"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
