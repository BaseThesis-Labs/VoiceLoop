"""Seed the database with Cartesia, SmallestAI, and Deepgram voices, evaluation scenarios, and prompts."""
import asyncio
from sqlalchemy import select
from app.database import engine, async_session
from app.models import Base, VoiceModel, Scenario, Prompt, AudioClip, AgentConfiguration


# Cartesia Sonic-3 voices — diverse set for voice agent arena battles
MODELS = [
    {
        "name": "Samantha - Support Leader",
        "provider": "cartesia",
        "version": "sonic-3",
        "model_type": "tts",
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
        "model_type": "tts",
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
        "model_type": "tts",
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
        "model_type": "tts",
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
        "model_type": "tts",
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
        "model_type": "tts",
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
        "model_type": "tts",
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
        "model_type": "tts",
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
        "model_type": "tts",
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
        "model_type": "tts",
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
        "model_type": "tts",
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
        "model_type": "tts",
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
        "model_type": "tts",
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
        "model_type": "tts",
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
        "model_type": "tts",
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
        "model_type": "tts",
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
        "model_type": "tts",
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
        "model_type": "tts",
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
        "model_type": "tts",
        "config_json": {
            "voice_id": "karen",
            "model_id": "lightning",
            "description": "Young female for advertisements and social media",
            "gender": "female",
            "accent": "british",
        },
    },
    # ElevenLabs Turbo v2.5 voices
    {
        "name": "Rachel - Warm Narrator",
        "provider": "elevenlabs",
        "version": "turbo-v2.5",
        "model_type": "tts",
        "config_json": {
            "voice_id": "21m00Tcm4TlvDq8ikWAM",
            "model_id": "eleven_turbo_v2_5",
            "description": "Warm female voice for narration and conversational use",
            "gender": "female",
        },
    },
    {
        "name": "Josh - Deep Speaker",
        "provider": "elevenlabs",
        "version": "turbo-v2.5",
        "model_type": "tts",
        "config_json": {
            "voice_id": "TxGEqnHWrfWFTfGW9XjX",
            "model_id": "eleven_turbo_v2_5",
            "description": "Deep male voice for narration and support",
            "gender": "male",
        },
    },
    {
        "name": "Bella - Soft Speaker",
        "provider": "elevenlabs",
        "version": "turbo-v2.5",
        "model_type": "tts",
        "config_json": {
            "voice_id": "EXAVITQu4vr4xnSDxMaL",
            "model_id": "eleven_turbo_v2_5",
            "description": "Soft female voice for gentle conversations",
            "gender": "female",
        },
    },
    {
        "name": "Antoni - Crisp Talker",
        "provider": "elevenlabs",
        "version": "turbo-v2.5",
        "model_type": "tts",
        "config_json": {
            "voice_id": "ErXwobaYiN019PkySvjV",
            "model_id": "eleven_turbo_v2_5",
            "description": "Crisp male voice for clear communication",
            "gender": "male",
        },
    },
    {
        "name": "Elli - Young Voice",
        "provider": "elevenlabs",
        "version": "turbo-v2.5",
        "model_type": "tts",
        "config_json": {
            "voice_id": "MF3mGyEYCl7XYWbV9V6O",
            "model_id": "eleven_turbo_v2_5",
            "description": "Young female voice for casual and friendly interactions",
            "gender": "female",
        },
    },
    # Deepgram Aura-2 voices
    {
        "name": "Thalia - Warm Speaker",
        "provider": "deepgram",
        "version": "aura-2",
        "model_type": "tts",
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
        "model_type": "tts",
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
        "model_type": "tts",
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
        "model_type": "tts",
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
        "model_type": "tts",
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
        "model_type": "tts",
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
        "model_type": "tts",
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
        "model_type": "tts",
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
        "model_type": "tts",
        "config_json": {
            "voice_id": "asteria",
            "model_id": "aura-2",
            "description": "Versatile female voice for general purpose TTS",
            "gender": "female",
            "accent": "american",
        },
    },
    # --- S2S Models ---
    {
        "name": "GPT-4o Realtime (Alloy)",
        "provider": "openai",
        "version": "gpt-4o-realtime",
        "model_type": "s2s",
        "config_json": {
            "model_id": "gpt-4o-realtime-preview",
            "voice_id": "alloy",
            "description": "OpenAI GPT-4o Realtime with Alloy voice",
        },
    },
    {
        "name": "GPT-4o Realtime (Shimmer)",
        "provider": "openai",
        "version": "gpt-4o-realtime",
        "model_type": "s2s",
        "config_json": {
            "model_id": "gpt-4o-realtime-preview",
            "voice_id": "shimmer",
            "description": "OpenAI GPT-4o Realtime with Shimmer voice",
        },
    },
    {
        "name": "Hume EVI 2",
        "provider": "hume",
        "version": "evi-2",
        "model_type": "s2s",
        "config_json": {
            "model_id": "evi-2",
            "config_id": None,
            "description": "Hume EVI 2 empathic voice interface",
        },
    },
    # --- STT Models ---
    {
        "name": "Whisper Large V3",
        "provider": "openai",
        "version": "whisper-1",
        "model_type": "stt",
        "config_json": {
            "model_id": "whisper-1",
            "description": "OpenAI Whisper large-v3 speech recognition",
        },
    },
    {
        "name": "Deepgram Nova-2",
        "provider": "deepgram",
        "version": "nova-2",
        "model_type": "stt",
        "config_json": {
            "model_id": "nova-2",
            "description": "Deepgram Nova-2 high-accuracy speech recognition",
        },
    },
    {
        "name": "AssemblyAI Universal",
        "provider": "assemblyai",
        "version": "universal",
        "model_type": "stt",
        "config_json": {
            "model_id": "best",
            "description": "AssemblyAI Universal speech-to-text model",
        },
    },
    {
        "name": "Google Cloud STT",
        "provider": "google",
        "version": "latest_long",
        "model_type": "stt",
        "config_json": {
            "model_id": "latest_long",
            "description": "Google Cloud Speech-to-Text v1",
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


# Curated audio prompts for S2S battles
S2S_PROMPTS = [
    {
        "text": "Hi, I'd like to book a table for four people this Saturday evening around seven thirty. Do you have anything available?",
        "category": "booking",
        "prompt_type": "audio",
        "audio_path": "./uploads/prompts/book_restaurant.wav",
        "duration_seconds": 5.2,
    },
    {
        "text": "Can you check the status of my flight? It's United Airlines flight fourteen twenty-three from San Francisco to Chicago, departing today.",
        "category": "general",
        "prompt_type": "audio",
        "audio_path": "./uploads/prompts/flight_status.wav",
        "duration_seconds": 5.8,
    },
    {
        "text": "I'm having trouble connecting my printer to my WiFi network. It's an HP LaserJet Pro and I keep getting an error message saying network not found.",
        "category": "customer_support",
        "prompt_type": "audio",
        "audio_path": "./uploads/prompts/tech_support.wav",
        "duration_seconds": 5.5,
    },
    {
        "text": "I need to schedule an oil change for my car. It's a twenty twenty-three Toyota Camry. Do you have any openings tomorrow afternoon?",
        "category": "booking",
        "prompt_type": "audio",
        "audio_path": "./uploads/prompts/schedule_appointment.wav",
        "duration_seconds": 5.0,
    },
    {
        "text": "Hi, I placed an order last week and haven't received any shipping updates. My order number is seven eight nine four five six. Can you tell me where it is?",
        "category": "customer_support",
        "prompt_type": "audio",
        "audio_path": "./uploads/prompts/order_status.wav",
        "duration_seconds": 5.8,
    },
    {
        "text": "I need to file a claim for a fender bender that happened yesterday in the parking lot. No one was injured but there's damage to my rear bumper.",
        "category": "customer_support",
        "prompt_type": "audio",
        "audio_path": "./uploads/prompts/insurance_claim.wav",
        "duration_seconds": 5.8,
    },
    {
        "text": "I'd like to refill my prescription for lisinopril ten milligrams. My date of birth is March fifteenth, nineteen eighty-five. The prescription number is RX four four seven.",
        "category": "medical",
        "prompt_type": "audio",
        "audio_path": "./uploads/prompts/pharmacy_refill.wav",
        "duration_seconds": 5.3,
    },
    {
        "text": "I'm calling about my stay at your downtown location. The air conditioning in room three twelve hasn't been working since I checked in yesterday.",
        "category": "customer_support",
        "prompt_type": "audio",
        "audio_path": "./uploads/prompts/hotel_complaint.wav",
        "duration_seconds": 5.5,
    },
    {
        "text": "I'd like to transfer five hundred dollars from my savings account to my checking account. Can you also tell me my current checking balance?",
        "category": "general",
        "prompt_type": "audio",
        "audio_path": "./uploads/prompts/banking_transfer.wav",
        "duration_seconds": 5.2,
    },
    {
        "text": "I've had a sore throat for about three days now and it's getting worse. I also have a slight fever. Should I come in for an appointment?",
        "category": "medical",
        "prompt_type": "audio",
        "audio_path": "./uploads/prompts/sore_throat.wav",
        "duration_seconds": 4.8,
    },
    {
        "text": "Could you explain the difference between your basic and premium plans? I want to know what I get for the extra cost.",
        "category": "general",
        "prompt_type": "audio",
        "audio_path": "./uploads/prompts/plan_comparison.wav",
        "duration_seconds": 5.5,
    },
    {
        "text": "I'd like to return a pair of shoes I bought online last week. They don't fit properly. Do I need to bring them to the store or can I ship them back?",
        "category": "customer_support",
        "prompt_type": "audio",
        "audio_path": "./uploads/prompts/return_item.wav",
        "duration_seconds": 5.8,
    },
]

# Curated audio clips for STT battles (ground truth = source text for TTS generation)
STT_CLIPS = [
    {
        "ground_truth": "Thank you for calling customer support. My name is Sarah and I'll be happy to help you today. Could you please provide me with your account number?",
        "category": "clean_speech",
        "difficulty": "easy",
        "audio_path": "./uploads/clips/clean_support_greeting.wav",
        "duration_seconds": 8.5,
        "tags": {"gender": "female", "accent": "american"},
    },
    {
        "ground_truth": "I'm sorry to hear that your package arrived damaged. Let me file a replacement order for you right away. The new item should arrive within three to five business days.",
        "category": "clean_speech",
        "difficulty": "easy",
        "audio_path": "./uploads/clips/clean_replacement_order.wav",
        "duration_seconds": 9.0,
        "tags": {"gender": "male", "accent": "american"},
    },
    {
        "ground_truth": "Your total comes to forty seven dollars and ninety three cents. That includes tax. Would you like to pay with the Visa ending in four two one eight or use a different method?",
        "category": "numbers_entities",
        "difficulty": "medium",
        "audio_path": "./uploads/clips/numbers_payment.wav",
        "duration_seconds": 9.5,
        "tags": {"type": "financial"},
    },
    {
        "ground_truth": "The prescription for amoxicillin five hundred milligrams should be taken three times daily for ten days. Please contact Doctor Patel at extension seven four two if symptoms persist.",
        "category": "domain_jargon",
        "difficulty": "hard",
        "audio_path": "./uploads/clips/medical_prescription.wav",
        "duration_seconds": 10.0,
        "tags": {"domain": "medical"},
    },
    {
        "ground_truth": "Please navigate to one twenty three Main Street, Suite four hundred B, Springfield, Illinois, six two seven zero four. The building is on the corner of Main and Fifth Avenue.",
        "category": "numbers_entities",
        "difficulty": "hard",
        "audio_path": "./uploads/clips/numbers_address.wav",
        "duration_seconds": 10.5,
        "tags": {"type": "address"},
    },
    {
        "ground_truth": "So basically what happened was like I went to the store right and they told me that my warranty had expired which is totally ridiculous because I just bought it like three months ago.",
        "category": "fast_speech",
        "difficulty": "medium",
        "audio_path": "./uploads/clips/fast_warranty_complaint.wav",
        "duration_seconds": 8.0,
        "tags": {"style": "conversational"},
    },
    {
        "ground_truth": "The API endpoint at slash v two slash users requires an OAuth two bearer token in the authorization header. Make sure to include the content type application slash JSON.",
        "category": "domain_jargon",
        "difficulty": "hard",
        "audio_path": "./uploads/clips/technical_api.wav",
        "duration_seconds": 9.5,
        "tags": {"domain": "technology"},
    },
    {
        "ground_truth": "Good morning! I'd like to check in for my flight to New York. My confirmation code is bravo romeo seven four kilo papa. The flight departs at two fifteen PM.",
        "category": "clean_speech",
        "difficulty": "medium",
        "audio_path": "./uploads/clips/clean_flight_checkin.wav",
        "duration_seconds": 9.0,
        "tags": {"type": "travel"},
    },
    {
        "ground_truth": "We need to schedule a follow-up appointment. I have availability next Tuesday at ten thirty AM or Wednesday at two PM. Which works better for you?",
        "category": "clean_speech",
        "difficulty": "easy",
        "audio_path": "./uploads/clips/clean_appointment.wav",
        "duration_seconds": 7.5,
        "tags": {"type": "scheduling"},
    },
    {
        "ground_truth": "The quarterly revenue report shows a twelve point five percent increase year over year. Net income was fourteen point three million dollars compared to eleven point eight million in the prior quarter.",
        "category": "numbers_entities",
        "difficulty": "hard",
        "audio_path": "./uploads/clips/numbers_financial.wav",
        "duration_seconds": 11.0,
        "tags": {"domain": "finance"},
    },
    {
        "ground_truth": "Hi yes I was wondering if you could help me I purchased a laptop last week the model number is XPS fifteen ninety five twenty and the screen has some dead pixels.",
        "category": "fast_speech",
        "difficulty": "medium",
        "audio_path": "./uploads/clips/fast_laptop_issue.wav",
        "duration_seconds": 8.5,
        "tags": {"style": "conversational"},
    },
    {
        "ground_truth": "For this recipe you'll need two cups of all-purpose flour, one and a half teaspoons of baking powder, half a teaspoon of salt, and three quarters cup of unsalted butter.",
        "category": "numbers_entities",
        "difficulty": "medium",
        "audio_path": "./uploads/clips/numbers_recipe.wav",
        "duration_seconds": 9.0,
        "tags": {"type": "cooking"},
    },
]

AGENT_CONFIGS = [
    {
        "id": "agent-vapi-default",
        "name": "Vapi + GPT-4o-mini + ElevenLabs",
        "architecture_type": "cascade",
        "provider": "vapi",
        "components_json": {"stt": "deepgram_nova3", "llm": "gpt-4o-mini", "tts": "elevenlabs"},
        "config_json": {
            "llm_provider": "openai",
            "llm_model": "gpt-4o-mini",
            "tts_provider": "11labs",
            "tts_voice_id": "",
            "stt_provider": "deepgram",
            "stt_model": "nova-2",
            "first_message": "Hello! How can I help you today?",
        },
    },
    {
        "id": "agent-vapi-quality",
        "name": "Vapi + GPT-4o + ElevenLabs",
        "architecture_type": "cascade",
        "provider": "vapi",
        "components_json": {"stt": "deepgram_nova3", "llm": "gpt-4o", "tts": "elevenlabs"},
        "config_json": {
            "llm_provider": "openai",
            "llm_model": "gpt-4o",
            "tts_provider": "11labs",
            "tts_voice_id": "",
            "stt_provider": "deepgram",
            "stt_model": "nova-2",
            "first_message": "Hello! How can I help you today?",
        },
    },
    {
        "id": "agent-vapi-claude",
        "name": "Vapi + Claude Sonnet 4.5 + ElevenLabs",
        "architecture_type": "cascade",
        "provider": "vapi",
        "components_json": {"stt": "deepgram_nova3", "llm": "claude-sonnet-4-5", "tts": "elevenlabs"},
        "config_json": {
            "llm_provider": "anthropic",
            "llm_model": "claude-sonnet-4-5-20250929",
            "tts_provider": "11labs",
            "tts_voice_id": "",
            "stt_provider": "deepgram",
            "stt_model": "nova-2",
            "first_message": "Hello! How can I help you today?",
        },
    },
    {
        "id": "agent-retell-default",
        "name": "Retell + GPT-4o-mini + ElevenLabs",
        "architecture_type": "cascade",
        "provider": "retell",
        "components_json": {"stt": "deepgram_nova3", "llm": "gpt-4o-mini", "tts": "elevenlabs"},
        "config_json": {"agent_id": ""},
    },
    {
        "id": "agent-retell-quality",
        "name": "Retell + GPT-4o + ElevenLabs",
        "architecture_type": "cascade",
        "provider": "retell",
        "components_json": {"stt": "deepgram_nova3", "llm": "gpt-4o", "tts": "elevenlabs"},
        "config_json": {"agent_id": ""},
    },
    {
        "id": "agent-retell-claude",
        "name": "Retell + Claude Sonnet 4.5 + ElevenLabs",
        "architecture_type": "cascade",
        "provider": "retell",
        "components_json": {"stt": "deepgram_nova3", "llm": "claude-sonnet-4-5", "tts": "elevenlabs"},
        "config_json": {"agent_id": ""},
    },
]

AGENT_SCENARIOS = [
    {
        "name": "Haircut appointment booking",
        "category": "booking",
        "difficulty": "easy",
        "description": "Book a haircut appointment for tomorrow at 2pm at your usual salon.",
        "system_prompt": "You are a receptionist at StyleCut Salon. Help customers book haircut appointments. Available times tomorrow: 10am, 11am, 2pm, 3:30pm, 5pm. Ask for their name, preferred stylist (optional), and confirm the time. Stylists available: Maria, James, Priya.",
        "required_slots": {"service": "haircut", "date": "tomorrow", "time": "2pm"},
        "success_criteria": "Agent confirms a haircut appointment for tomorrow at 2pm with customer name.",
        "tools_available": [{"name": "check_availability", "description": "Check available time slots"}, {"name": "book_appointment", "description": "Book an appointment"}],
        "max_turns": 8,
        "max_duration_seconds": 60,
    },
    {
        "name": "Restaurant with dietary needs",
        "category": "booking",
        "difficulty": "medium",
        "description": "Book a table for 4 at an Italian restaurant downtown this Friday at 7pm. You have a severe nut allergy.",
        "system_prompt": "You are a restaurant booking assistant for BookTable. Help customers find and book restaurants. Downtown Italian restaurants: Bella Vita (nut-free kitchen available), Trattoria Roma (cannot guarantee nut-free), Il Giardino (fully nut-free menu). Ask for party size, date, time, and any dietary needs. Confirm all details before booking.",
        "required_slots": {"party_size": "4", "cuisine": "Italian", "location": "downtown", "date": "Friday", "time": "7pm", "dietary": "nut allergy"},
        "success_criteria": "Agent books at a restaurant that accommodates nut allergies, for 4 people, on Friday around 7pm, and confirms the booking.",
        "tools_available": [{"name": "search_restaurants", "description": "Search for restaurants"}, {"name": "check_availability", "description": "Check table availability"}, {"name": "make_reservation", "description": "Make a reservation"}],
        "max_turns": 10,
        "max_duration_seconds": 90,
    },
    {
        "name": "Hotel reservation with preferences",
        "category": "booking",
        "difficulty": "medium",
        "description": "Book a hotel room downtown for 2 nights starting this Saturday. You want a king bed and late checkout.",
        "system_prompt": "You are a hotel booking assistant for StayEasy. Downtown hotels: Grand Plaza ($189/night, king available, late checkout $30 extra), City Inn ($129/night, king available, no late checkout), Luxury Suites ($299/night, king standard, complimentary late checkout). Help the customer find the right hotel and book.",
        "required_slots": {"check_in": "Saturday", "nights": "2", "bed_type": "king", "late_checkout": "yes"},
        "success_criteria": "Agent books a hotel with king bed for 2 nights starting Saturday, addresses late checkout preference.",
        "tools_available": [{"name": "search_hotels", "description": "Search for hotels"}, {"name": "book_room", "description": "Book a hotel room"}],
        "max_turns": 10,
        "max_duration_seconds": 90,
    },
    {
        "name": "Flight rebooking",
        "category": "booking",
        "difficulty": "hard",
        "description": "Your flight tomorrow at 8am was cancelled. You need to rebook for the same destination (Chicago). You prefer a direct flight and window seat, departing before noon.",
        "system_prompt": "You are an airline rebooking agent for SkyWay Airlines. The customer's flight SW201 (8am to Chicago) was cancelled due to weather. Available flights tomorrow to Chicago: SW305 (10:30am, direct, window available, $0 change fee), SW412 (11:45am, 1 stop in Denver, window available, $0 change fee), SW518 (2pm, direct, aisle only, $0 change fee). Help rebook and confirm all details including seat preference.",
        "required_slots": {"destination": "Chicago", "departure": "before noon", "seat": "window", "flight_type": "direct"},
        "success_criteria": "Agent rebooks on a suitable flight before noon with window seat, ideally direct.",
        "tools_available": [{"name": "search_flights", "description": "Search available flights"}, {"name": "rebook_flight", "description": "Rebook the customer's flight"}],
        "max_turns": 12,
        "max_duration_seconds": 120,
    },
    {
        "name": "Order status check",
        "category": "support",
        "difficulty": "easy",
        "description": "Check the status of your recent order #78432. You ordered it 3 days ago.",
        "system_prompt": "You are a customer support agent for ShopFast. Order #78432: placed 3 days ago, 2 items (wireless headphones, phone case), shipped yesterday via FedEx, tracking #FX9876543, estimated delivery in 2 days. Provide order status clearly and offer the tracking number.",
        "required_slots": {"order_number": "78432"},
        "success_criteria": "Agent provides order status, shipping info, and tracking number.",
        "tools_available": [{"name": "lookup_order", "description": "Look up order by number"}],
        "max_turns": 6,
        "max_duration_seconds": 45,
    },
    {
        "name": "Return with missing receipt",
        "category": "support",
        "difficulty": "medium",
        "description": "You want to return a jacket you bought 2 weeks ago but lost the receipt. You paid with a credit card.",
        "system_prompt": "You are a returns specialist for FashionMart. Policy: returns within 30 days with receipt for full refund. Without receipt: can look up by credit card (last 4 digits + approximate date), then issue store credit. Ask for item description, approximate purchase date, and last 4 digits of card. If found, process the return for store credit.",
        "required_slots": {"item": "jacket", "purchase_date": "2 weeks ago", "card_last4": "any"},
        "success_criteria": "Agent looks up the purchase by card, finds it, and processes return for store credit.",
        "tools_available": [{"name": "lookup_purchase", "description": "Look up purchase by card"}, {"name": "process_return", "description": "Process a return"}],
        "max_turns": 10,
        "max_duration_seconds": 90,
    },
    {
        "name": "Billing dispute - double charge",
        "category": "support",
        "difficulty": "hard",
        "description": "You were charged twice for your monthly subscription ($49.99 each). You're frustrated and want a refund for the duplicate charge.",
        "system_prompt": "You are a billing support agent for CloudServe. The customer's account shows two charges of $49.99 on the same day — this was a known billing system glitch affecting some customers. Policy: acknowledge the error, apologize sincerely, process immediate refund for the duplicate charge, and offer a $10 credit for the inconvenience. Be empathetic but professional. Do not be defensive.",
        "required_slots": {"issue": "double charge", "amount": "49.99"},
        "success_criteria": "Agent acknowledges the duplicate charge, apologizes, processes refund, and offers the $10 courtesy credit.",
        "tools_available": [{"name": "check_billing", "description": "Check billing history"}, {"name": "process_refund", "description": "Process a refund"}, {"name": "apply_credit", "description": "Apply account credit"}],
        "max_turns": 10,
        "max_duration_seconds": 90,
    },
    {
        "name": "Store hours and directions",
        "category": "info_retrieval",
        "difficulty": "easy",
        "description": "Ask about the store's Sunday hours and how to get there from downtown.",
        "system_prompt": "You are a store information assistant for MegaMart on Oak Street. Hours: Mon-Sat 8am-9pm, Sunday 10am-6pm. Location: 456 Oak Street, 2 miles north of downtown. From downtown: take Main Street north, turn right on Oak, store is on the left. Parking: free lot with 200 spaces. Nearest bus stop: Route 7, Oak & Elm stop.",
        "required_slots": {"info_type": "hours"},
        "success_criteria": "Agent provides Sunday hours and directions from downtown.",
        "tools_available": [],
        "max_turns": 6,
        "max_duration_seconds": 45,
    },
    {
        "name": "Product comparison",
        "category": "info_retrieval",
        "difficulty": "medium",
        "description": "Compare the Basic and Premium subscription plans. You want to know the main differences, especially regarding storage and support.",
        "system_prompt": "You are a sales assistant for DataVault. Plans: Basic ($9.99/mo, 100GB storage, email support, 5 user seats, standard encryption) vs Premium ($24.99/mo, 1TB storage, priority phone+email support, unlimited seats, advanced encryption, API access, custom integrations). Annual billing saves 20%. Help the customer understand which plan fits their needs.",
        "required_slots": {},
        "success_criteria": "Agent clearly explains storage and support differences between Basic and Premium plans.",
        "tools_available": [],
        "max_turns": 8,
        "max_duration_seconds": 60,
    },
    {
        "name": "Router troubleshooting guide",
        "category": "info_retrieval",
        "difficulty": "hard",
        "description": "Your internet is not working. You need help troubleshooting your router step by step.",
        "system_prompt": "You are a technical support agent for NetConnect ISP. Troubleshooting steps: 1) Check if router lights are on (power, internet, WiFi). 2) If power light is off, check power cable connection. 3) If internet light is off/red, unplug router for 30 seconds then plug back in. 4) Wait 2 minutes for lights to stabilize. 5) If still no internet light, check coaxial/ethernet cable from wall. 6) Try connecting directly via ethernet cable to rule out WiFi issues. 7) If still not working, there may be an outage — check status page or schedule technician visit. Walk through each step, wait for the customer to report results before moving to the next step.",
        "required_slots": {},
        "success_criteria": "Agent walks through troubleshooting steps sequentially, waiting for customer feedback at each step.",
        "tools_available": [{"name": "check_outage", "description": "Check for service outages in the area"}],
        "max_turns": 15,
        "max_duration_seconds": 120,
    },
]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        models_added = 0
        for m in MODELS:
            existing = await db.execute(select(VoiceModel).where(VoiceModel.name == m["name"]).limit(1))
            existing_model = existing.scalars().first()
            if existing_model is None:
                db.add(VoiceModel(**m))
                models_added += 1
            else:
                # Update model_type and config_json if they changed
                changed = False
                if existing_model.model_type != m.get("model_type", "tts"):
                    existing_model.model_type = m["model_type"]
                    changed = True
                if m.get("config_json") and existing_model.config_json != m["config_json"]:
                    existing_model.config_json = m["config_json"]
                    changed = True
                if changed:
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

        s2s_prompts_added = 0
        for p in S2S_PROMPTS:
            existing = await db.execute(select(Prompt).where(Prompt.text == p["text"]).limit(1))
            if existing.scalars().first() is None:
                db.add(Prompt(**p))
                s2s_prompts_added += 1

        clips_added = 0
        for c in STT_CLIPS:
            existing = await db.execute(
                select(AudioClip).where(AudioClip.ground_truth == c["ground_truth"]).limit(1)
            )
            if existing.scalars().first() is None:
                db.add(AudioClip(**c))
                clips_added += 1

        # --- Agent Configurations ---
        configs_added = 0
        for ac in AGENT_CONFIGS:
            existing = await db.get(AgentConfiguration, ac["id"])
            if not existing:
                db.add(AgentConfiguration(**ac))
                configs_added += 1

        # --- Agent Scenarios (update existing + add new) ---
        agent_scenarios_added = 0
        for sc in AGENT_SCENARIOS:
            result = await db.execute(
                select(Scenario).where(Scenario.name == sc["name"])
            )
            existing = result.scalar_one_or_none()
            if existing:
                existing.system_prompt = sc.get("system_prompt")
                existing.required_slots = sc.get("required_slots")
                existing.success_criteria = sc.get("success_criteria")
                existing.tools_available = sc.get("tools_available")
                existing.max_turns = sc.get("max_turns", 10)
                existing.max_duration_seconds = sc.get("max_duration_seconds", 120)
            else:
                db.add(Scenario(**{k: v for k, v in sc.items()}))
                agent_scenarios_added += 1

        await db.commit()
        providers = {}
        for m in MODELS:
            providers[m["provider"]] = providers.get(m["provider"], 0) + 1
        provider_str = ", ".join(f"{count} {name}" for name, count in providers.items())
        print(
            f"Seeded {models_added}/{len(MODELS)} voices ({provider_str}), "
            f"{scenarios_added}/{len(SCENARIOS)} scenarios, "
            f"{prompts_added}/{len(PROMPTS)} TTS prompts, "
            f"{s2s_prompts_added}/{len(S2S_PROMPTS)} S2S curated prompts, "
            f"{clips_added}/{len(STT_CLIPS)} STT audio clips, "
            f"{configs_added}/{len(AGENT_CONFIGS)} agent configs, "
            f"and {agent_scenarios_added}/{len(AGENT_SCENARIOS)} agent scenarios."
        )


if __name__ == "__main__":
    asyncio.run(seed())
