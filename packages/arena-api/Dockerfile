FROM python:3.10-slim

WORKDIR /app
ENV PYTHONPATH=/app

COPY pyproject.toml ./
RUN pip install --no-cache-dir .

# Install TTS provider SDKs (lazy-loaded, needed for battles)
RUN pip install --no-cache-dir cartesia smallestai elevenlabs

COPY . .
RUN mkdir -p /app/uploads

CMD alembic upgrade head && python scripts/seed.py && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
