FROM python:3.10-slim

# Install system dependencies (ffmpeg needed for S2S audio conversion)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV PYTHONPATH=/app

COPY pyproject.toml ./
RUN pip install --no-cache-dir .

# Install TTS provider SDKs and audio generation tools
RUN pip install --no-cache-dir cartesia smallestai elevenlabs edge-tts

COPY . .
RUN mkdir -p /app/uploads/clips /app/uploads/prompts

CMD alembic upgrade head && python scripts/seed.py && python scripts/generate_clips.py && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
