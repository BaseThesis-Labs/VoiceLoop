"""Seed the database with initial models and scenarios."""
import asyncio
from app.database import engine, async_session
from app.models import Base, VoiceModel, Scenario


MODELS = [
    {"name": "GPT-4o Realtime", "provider": "openai", "version": "v1"},
    {"name": "Gemini 2.0 Flash Live", "provider": "google", "version": "v1"},
    {"name": "Claude Sonnet Voice", "provider": "anthropic", "version": "v1"},
    {"name": "ElevenLabs Conversational", "provider": "elevenlabs", "version": "v2"},
    {"name": "Hume EVI 2", "provider": "hume", "version": "v2"},
    {"name": "Bland AI", "provider": "bland", "version": "v1"},
    {"name": "Vapi Agent", "provider": "vapi", "version": "v1"},
    {"name": "Retell AI", "provider": "retell", "version": "v2"},
]

SCENARIOS = [
    {"name": "Angry customer refund request", "category": "customer_service", "difficulty": "hard"},
    {"name": "Technical support troubleshooting", "category": "support", "difficulty": "medium"},
    {"name": "Appointment scheduling", "category": "scheduling", "difficulty": "easy"},
    {"name": "Sales qualification call", "category": "sales", "difficulty": "medium"},
    {"name": "Complaint escalation", "category": "customer_service", "difficulty": "hard"},
    {"name": "FAQ and general inquiry", "category": "support", "difficulty": "easy"},
]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        for m in MODELS:
            db.add(VoiceModel(**m))
        for s in SCENARIOS:
            db.add(Scenario(**s))
        await db.commit()
        print(f"Seeded {len(MODELS)} models and {len(SCENARIOS)} scenarios.")


if __name__ == "__main__":
    asyncio.run(seed())
