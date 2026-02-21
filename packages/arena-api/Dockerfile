FROM python:3.10-slim

# Install system dependencies (ffmpeg needed for S2S audio conversion)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV PYTHONPATH=/app

COPY pyproject.toml ./
RUN pip install --no-cache-dir .

# Install TTS provider SDKs (lazy-loaded, needed for battles)
RUN pip install --no-cache-dir cartesia smallestai elevenlabs

COPY . .
RUN mkdir -p /app/uploads

CMD alembic upgrade head && python scripts/seed.py && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
