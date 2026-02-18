"""Seed the database with Cartesia, SmallestAI, and Deepgram voices, evaluation scenarios, and prompts."""
import asyncio
from sqlalchemy import select
from app.database import engine, async_session
from app.models import Base, VoiceModel, Scenario, Prompt


# Cartesia Sonic-3 voices — diverse set for voice agent arena battles
MODELS = [
    {
        "name": "Samantha - Support Leader",
        "provider": "cartesia",
        "version": "sonic-3",
        "config_json": {
            "voice_id": "f4e8781b-a420-4080-81cf-576331238efa",
            "model_id": "sonic-3",
            "description": "Firm, confident adult female for conversational support",
            "gender": "feminine",
        },
    },
    {
        "name": "Carson - Friendly Support",
        "provider": "cartesia",
        "version": "sonic-3",
        "config_json": {
            "voice_id": "96c64eb5-a945-448f-9710-980abe7a514c",
            "model_id": "sonic-3",
            "description": "Friendly, young adult male for customer support conversations",
            "gender": "masculine",
        },
    },
    {
        "name": "Darla - Resolution Agent",
        "provider": "cartesia",
        "version": "sonic-3",
        "config_json": {
            "voice_id": "996a8b96-4804-46f0-8e05-3fd4ef1a87cd",
            "model_id": "sonic-3",
            "description": "Firm and confident female voice with a calm, supportive tone",
            "gender": "feminine",
        },
    },
    {
        "name": "Troy - Fix It Man",
        "provider": "cartesia",
        "version": "sonic-3",
        "config_json": {
            "voice_id": "726d5ae5-055f-4c3d-8355-d9677de68937",
            "model_id": "sonic-3",
            "description": "Strong, dependable male voice for trust-building in customer-facing interactions",
            "gender": "masculine",
        },
    },
    {
        "name": "Mia - Agent",
        "provider": "cartesia",
        "version": "sonic-3",
        "config_json": {
            "voice_id": "1d3ba41a-96e6-44ad-aabb-9817c56caa68",
            "model_id": "sonic-3",
            "description": "Firm, young female for customer support and casual conversation",
            "gender": "feminine",
        },
    },
    {
        "name": "Nathan - Easy Talker",
        "provider": "cartesia",
        "version": "sonic-3",
        "config_json": {
            "voice_id": "97f4b8fb-f2fe-444b-bb9a-c109783a857a",
            "model_id": "sonic-3",
            "description": "Confident, firm young adult male with a slight edge for conversational use cases",
            "gender": "masculine",
        },
    },
    {
        "name": "Priya - Trusted Operator",
        "provider": "cartesia",
        "version": "sonic-3",
        "config_json": {
            "voice_id": "f6141af3-5f94-418c-80ed-a45d450e7e2e",
            "model_id": "sonic-3",
            "description": "Authoritative, adult female for customer support",
            "gender": "feminine",
        },
    },
    {
        "name": "Ben - Helpful Man",
        "provider": "cartesia",
        "version": "sonic-3",
        "config_json": {
            "voice_id": "bbee10a8-4f08-4c5c-8282-e69299115055",
            "model_id": "sonic-3",
            "description": "Slightly raspy voiced middle aged man for friendly and natural conversational support",
            "gender": "masculine",
        },
    },
    {
        "name": "Brenda - Host",
        "provider": "cartesia",
        "version": "sonic-3",
        "config_json": {
            "voice_id": "607167f6-9bf2-473c-accc-ac7b3b66b30b",
            "model_id": "sonic-3",
            "description": "Cheerful, friendly female voice for positive, helpful customer interactions",
            "gender": "feminine",
        },
    },
    {
        "name": "Valerie - Support Authority",
        "provider": "cartesia",
        "version": "sonic-3",
        "config_json": {
            "voice_id": "af346552-54bf-4c2b-a4d4-9d2820f51b6c",
            "model_id": "sonic-3",
            "description": "Authoritative mature female for frontline customer support use cases",
            "gender": "feminine",
        },
    },
    # SmallestAI Lightning voices
    {
        "name": "Emily - Conversational",
        "provider": "smallestai",
        "version": "lightning",
        "config_json": {
            "voice_id": "emily",
            "model_id": "lightning",
            "description": "Conversational female for customer support",
            "gender": "female",
            "accent": "american",
        },
    },
    {
        "name": "James - Confident",
        "provider": "smallestai",
        "version": "lightning",
        "config_json": {
            "voice_id": "james",
            "model_id": "lightning",
            "description": "Confident male for conversational and social media",
            "gender": "male",
            "accent": "american",
        },
    },
    {
        "name": "Jasmine - Strong",
        "provider": "smallestai",
        "version": "lightning",
        "config_json": {
            "voice_id": "jasmine",
            "model_id": "lightning",
            "description": "Strong female for conversational use cases",
            "gender": "female",
            "accent": "american",
        },
    },
    {
        "name": "George - Friendly",
        "provider": "smallestai",
        "version": "lightning",
        "config_json": {
            "voice_id": "george",
            "model_id": "lightning",
            "description": "Friendly male for narrative and advertisements",
            "gender": "male",
            "accent": "american",
        },
    },
    {
        "name": "Arman - Versatile",
        "provider": "smallestai",
        "version": "lightning",
        "config_json": {
            "voice_id": "arman",
            "model_id": "lightning",
            "description": "Versatile male for conversational and ads",
            "gender": "male",
            "accent": "american",
        },
    },
    {
        "name": "Enola - Warm",
        "provider": "smallestai",
        "version": "lightning",
        "config_json": {
            "voice_id": "enola",
            "model_id": "lightning",
            "description": "Warm female for conversational and entertainment",
            "gender": "female",
            "accent": "american",
        },
    },
    {
        "name": "Judi - Calming",
        "provider": "smallestai",
        "version": "lightning",
        "config_json": {
            "voice_id": "judi",
            "model_id": "lightning",
            "description": "Calming female for educational and meditative content",
            "gender": "female",
            "accent": "american",
        },
    },
    {
        "name": "Rebecca - Articulate",
        "provider": "smallestai",
        "version": "lightning",
        "config_json": {
            "voice_id": "rebecca",
            "model_id": "lightning",
            "description": "Articulate female for narrative and educational",
            "gender": "female",
            "accent": "american",
        },
    },
    {
        "name": "Karen - Young",
        "provider": "smallestai",
        "version": "lightning",
        "config_json": {
            "voice_id": "karen",
            "model_id": "lightning",
            "description": "Young female for advertisements and social media",
            "gender": "female",
            "accent": "british",
        },
    },
    # Deepgram Aura-2 voices
    {
        "name": "Thalia - Warm Speaker",
        "provider": "deepgram",
        "version": "aura-2",
        "config_json": {
            "voice_id": "thalia",
            "model_id": "aura-2",
            "description": "Warm female voice for conversational applications",
            "gender": "female",
            "accent": "american",
        },
    },
    {
        "name": "Apollo - Clear Narrator",
        "provider": "deepgram",
        "version": "aura-2",
        "config_json": {
            "voice_id": "apollo",
            "model_id": "aura-2",
            "description": "Clear male voice for narration and support",
            "gender": "male",
            "accent": "american",
        },
    },
    {
        "name": "Athena - Confident",
        "provider": "deepgram",
        "version": "aura-2",
        "config_json": {
            "voice_id": "athena",
            "model_id": "aura-2",
            "description": "Confident female voice for professional use",
            "gender": "female",
            "accent": "american",
        },
    },
    {
        "name": "Draco - British Gent",
        "provider": "deepgram",
        "version": "aura-2",
        "config_json": {
            "voice_id": "draco",
            "model_id": "aura-2",
            "description": "British male voice for formal and narration content",
            "gender": "male",
            "accent": "british",
        },
    },
    {
        "name": "Luna - Gentle",
        "provider": "deepgram",
        "version": "aura-2",
        "config_json": {
            "voice_id": "luna",
            "model_id": "aura-2",
            "description": "Gentle female voice for calm and soothing interactions",
            "gender": "female",
            "accent": "american",
        },
    },
    {
        "name": "Orion - Authoritative",
        "provider": "deepgram",
        "version": "aura-2",
        "config_json": {
            "voice_id": "orion",
            "model_id": "aura-2",
            "description": "Authoritative male voice for announcements and support",
            "gender": "male",
            "accent": "american",
        },
    },
    {
        "name": "Pandora - British Lady",
        "provider": "deepgram",
        "version": "aura-2",
        "config_json": {
            "voice_id": "pandora",
            "model_id": "aura-2",
            "description": "British female voice for elegant narration",
            "gender": "female",
            "accent": "british",
        },
    },
    {
        "name": "Hyperion - Aussie",
        "provider": "deepgram",
        "version": "aura-2",
        "config_json": {
            "voice_id": "hyperion",
            "model_id": "aura-2",
            "description": "Australian male voice for friendly casual conversations",
            "gender": "male",
            "accent": "australian",
        },
    },
    {
        "name": "Asteria - Versatile",
        "provider": "deepgram",
        "version": "aura-2",
        "config_json": {
            "voice_id": "asteria",
            "model_id": "aura-2",
            "description": "Versatile female voice for general purpose TTS",
            "gender": "female",
            "accent": "american",
        },
    },
]

SCENARIOS = [
    {"name": "Angry customer refund request", "category": "customer_service", "difficulty": "hard",
     "description": "Customer is upset about a defective product and demands a full refund."},
    {"name": "Technical support troubleshooting", "category": "support", "difficulty": "medium",
     "description": "User needs help troubleshooting internet connectivity issues."},
    {"name": "Appointment scheduling", "category": "scheduling", "difficulty": "easy",
     "description": "Customer wants to book or reschedule an appointment."},
    {"name": "Sales qualification call", "category": "sales", "difficulty": "medium",
     "description": "Sales rep qualifying a potential customer for enterprise software."},
    {"name": "Complaint escalation", "category": "customer_service", "difficulty": "hard",
     "description": "Customer demands to speak with a manager about repeated billing errors."},
    {"name": "FAQ and general inquiry", "category": "support", "difficulty": "easy",
     "description": "Customer has basic questions about service hours and policies."},
]

# Text prompts for TTS generation in battles
PROMPTS = [
    {
        "text": "Thank you for calling. I understand you're frustrated with your recent order, and I want to help make this right. Let me pull up your account and see what options we have available for you.",
        "category": "customer_service",
    },
    {
        "text": "I'd be happy to help you troubleshoot that issue. First, could you try restarting your router by unplugging it for thirty seconds? While we wait, I'll check if there are any outages reported in your area.",
        "category": "support",
    },
    {
        "text": "Great news! I have an opening this Thursday at two thirty in the afternoon, or Friday morning at ten. Which works better for your schedule? We can also set up a reminder to be sent to your email.",
        "category": "scheduling",
    },
    {
        "text": "Based on what you've described, our enterprise plan would be the best fit for your team. It includes unlimited seats, priority support, and advanced analytics. Would you like me to walk you through the pricing?",
        "category": "sales",
    },
    {
        "text": "I completely understand your concern, and I apologize for the inconvenience. I'm going to escalate this to our specialist team right away. You should receive a callback within the next two hours.",
        "category": "customer_service",
    },
    {
        "text": "Our store hours are Monday through Friday, nine AM to six PM, and Saturdays from ten to four. We're closed on Sundays. Is there anything else I can help you with today?",
        "category": "support",
    },
    {
        "text": "Welcome back! I see from your account that your subscription is up for renewal next month. We actually have a special loyalty discount available. Would you like to hear about our current promotions?",
        "category": "sales",
    },
    {
        "text": "I've processed your refund, and you should see the credit on your statement within three to five business days. I've also added a ten percent discount code for your next purchase as a gesture of goodwill.",
        "category": "customer_service",
    },
    {
        "text": "Let me confirm the details of your appointment. You're booked for a consultation on March fifteenth at eleven AM with Doctor Patel. Please arrive fifteen minutes early to complete the intake forms.",
        "category": "scheduling",
    },
    {
        "text": "I want to make sure I understand your needs correctly. You're looking for a solution that can handle at least five thousand concurrent users, integrates with Salesforce, and has SOC two compliance. Is that accurate?",
        "category": "sales",
    },
]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        models_added = 0
        for m in MODELS:
            existing = await db.execute(select(VoiceModel).where(VoiceModel.name == m["name"]).limit(1))
            if existing.scalars().first() is None:
                db.add(VoiceModel(**m))
                models_added += 1

        scenarios_added = 0
        for s in SCENARIOS:
            existing = await db.execute(select(Scenario).where(Scenario.name == s["name"]).limit(1))
            if existing.scalars().first() is None:
                db.add(Scenario(**s))
                scenarios_added += 1

        prompts_added = 0
        for p in PROMPTS:
            existing = await db.execute(select(Prompt).where(Prompt.text == p["text"]).limit(1))
            if existing.scalars().first() is None:
                db.add(Prompt(**p))
                prompts_added += 1

        await db.commit()
        providers = {}
        for m in MODELS:
            providers[m["provider"]] = providers.get(m["provider"], 0) + 1
        provider_str = ", ".join(f"{count} {name}" for name, count in providers.items())
        print(
            f"Seeded {models_added}/{len(MODELS)} voices ({provider_str}), "
            f"{scenarios_added}/{len(SCENARIOS)} scenarios, "
            f"and {prompts_added}/{len(PROMPTS)} prompts."
        )


if __name__ == "__main__":
    asyncio.run(seed())
