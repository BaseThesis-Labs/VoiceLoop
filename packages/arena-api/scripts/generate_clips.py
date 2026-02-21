"""Generate curated audio clips for STT battles using OpenAI TTS API.

Usage:
    cd packages/arena-api
    python scripts/generate_clips.py
"""
import os
import struct
import wave

# Ground truth text and filenames for STT clips
STT_CLIPS = [
    ("clean_support_greeting.wav", "Thank you for calling customer support. My name is Sarah and I'll be happy to help you today. Could you please provide me with your account number?"),
    ("clean_replacement_order.wav", "I'm sorry to hear that your package arrived damaged. Let me file a replacement order for you right away. The new item should arrive within three to five business days."),
    ("numbers_payment.wav", "Your total comes to forty seven dollars and ninety three cents. That includes tax. Would you like to pay with the Visa ending in four two one eight or use a different method?"),
    ("medical_prescription.wav", "The prescription for amoxicillin five hundred milligrams should be taken three times daily for ten days. Please contact Doctor Patel at extension seven four two if symptoms persist."),
    ("numbers_address.wav", "Please navigate to one twenty three Main Street, Suite four hundred B, Springfield, Illinois, six two seven zero four. The building is on the corner of Main and Fifth Avenue."),
    ("fast_warranty_complaint.wav", "So basically what happened was like I went to the store right and they told me that my warranty had expired which is totally ridiculous because I just bought it like three months ago."),
    ("technical_api.wav", "The API endpoint at slash v two slash users requires an OAuth two bearer token in the authorization header. Make sure to include the content type application slash JSON."),
    ("clean_flight_checkin.wav", "Good morning! I'd like to check in for my flight to New York. My confirmation code is bravo romeo seven four kilo papa. The flight departs at two fifteen PM."),
    ("clean_appointment.wav", "We need to schedule a follow-up appointment. I have availability next Tuesday at ten thirty AM or Wednesday at two PM. Which works better for you?"),
    ("numbers_financial.wav", "The quarterly revenue report shows a twelve point five percent increase year over year. Net income was fourteen point three million dollars compared to eleven point eight million in the prior quarter."),
    ("fast_laptop_issue.wav", "Hi yes I was wondering if you could help me I purchased a laptop last week the model number is XPS fifteen ninety five twenty and the screen has some dead pixels."),
    ("numbers_recipe.wav", "For this recipe you'll need two cups of all-purpose flour, one and a half teaspoons of baking powder, half a teaspoon of salt, and three quarters cup of unsalted butter."),
]

# S2S curated prompts
S2S_PROMPTS = [
    ("book_restaurant.wav", "Hi, I'd like to book a table for four people this Saturday evening around seven thirty. Do you have anything available?"),
    ("flight_status.wav", "Can you check the status of my flight? It's United Airlines flight fourteen twenty-three from San Francisco to Chicago, departing today."),
    ("tech_support.wav", "I'm having trouble connecting my printer to my WiFi network. It's an HP LaserJet Pro and I keep getting an error message saying network not found."),
    ("schedule_appointment.wav", "I need to schedule an oil change for my car. It's a twenty twenty-three Toyota Camry. Do you have any openings tomorrow afternoon?"),
    ("order_status.wav", "Hi, I placed an order last week and haven't received any shipping updates. My order number is seven eight nine four five six. Can you tell me where it is?"),
    ("insurance_claim.wav", "I need to file a claim for a fender bender that happened yesterday in the parking lot. No one was injured but there's damage to my rear bumper."),
    ("pharmacy_refill.wav", "I'd like to refill my prescription for lisinopril ten milligrams. My date of birth is March fifteenth, nineteen eighty-five. The prescription number is RX four four seven."),
    ("hotel_complaint.wav", "I'm calling about my stay at your downtown location. The air conditioning in room three twelve hasn't been working since I checked in yesterday."),
    ("banking_transfer.wav", "I'd like to transfer five hundred dollars from my savings account to my checking account. Can you also tell me my current checking balance?"),
    ("sore_throat.wav", "I've had a sore throat for about three days now and it's getting worse. I also have a slight fever. Should I come in for an appointment?"),
    ("plan_comparison.wav", "Could you explain the difference between your basic and premium plans? I want to know what I get for the extra cost."),
    ("return_item.wav", "I'd like to return a pair of shoes I bought online last week. They don't fit properly. Do I need to bring them to the store or can I ship them back?"),
]


def generate_with_openai_tts(text: str, output_path: str, voice: str = "alloy") -> bool:
    """Generate audio using OpenAI TTS API. Returns True on success."""
    try:
        import httpx
        from dotenv import load_dotenv
        load_dotenv()

        api_key = os.environ.get("OPENAI_API_KEY", "")
        if not api_key:
            return False

        resp = httpx.post(
            "https://api.openai.com/v1/audio/speech",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": "tts-1",
                "input": text,
                "voice": voice,
                "response_format": "wav",
            },
            timeout=30,
        )
        if resp.status_code == 200:
            with open(output_path, "wb") as f:
                f.write(resp.content)
            return True
        else:
            print(f"  OpenAI TTS error {resp.status_code}: {resp.text[:200]}")
            return False
    except Exception as e:
        print(f"  OpenAI TTS failed: {e}")
        return False


def generate_with_edge_tts(text: str, output_path: str, voice: str = "en-US-JennyNeural") -> bool:
    """Generate audio using Microsoft Edge TTS (free, no API key). Returns True on success."""
    try:
        import asyncio
        import edge_tts
        import subprocess
        import tempfile

        mp3_path = output_path.replace(".wav", ".mp3")

        async def _generate():
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(mp3_path)

        asyncio.run(_generate())

        # Convert MP3 to WAV using ffmpeg if available, otherwise keep as mp3
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-i", mp3_path, "-ar", "16000", "-ac", "1", output_path],
                capture_output=True, timeout=10,
            )
            os.remove(mp3_path)
        except (FileNotFoundError, subprocess.TimeoutExpired):
            # ffmpeg not available — rename mp3 to wav (most STT providers handle it)
            os.rename(mp3_path, output_path)

        return True
    except Exception as e:
        print(f"  Edge TTS failed: {e}")
        return False


def generate_silence_wav(output_path: str, duration_seconds: float = 5.0):
    """Generate a silent WAV file as fallback."""
    sample_rate = 16000
    num_samples = int(sample_rate * duration_seconds)

    with wave.open(output_path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        # Write silence (zeros)
        wf.writeframes(struct.pack(f"<{num_samples}h", *([0] * num_samples)))


def main():
    clips_dir = os.path.join(os.path.dirname(__file__), "..", "uploads", "clips")
    prompts_dir = os.path.join(os.path.dirname(__file__), "..", "uploads", "prompts")
    os.makedirs(clips_dir, exist_ok=True)
    os.makedirs(prompts_dir, exist_ok=True)

    # Edge TTS voices — varied male/female voices
    edge_voices = [
        "en-US-JennyNeural",    # Female
        "en-US-GuyNeural",      # Male
        "en-US-AriaNeural",     # Female
        "en-US-DavisNeural",    # Male
        "en-US-SaraNeural",     # Female
        "en-US-TonyNeural",     # Male
    ]

    print("=== Generating STT clips ===")
    for i, (filename, text) in enumerate(STT_CLIPS):
        path = os.path.join(clips_dir, filename)
        if os.path.exists(path) and os.path.getsize(path) > 1000:
            print(f"  [skip] {filename} already exists")
            continue
        voice = edge_voices[i % len(edge_voices)]
        print(f"  [{i+1}/{len(STT_CLIPS)}] {filename} (voice={voice})...")
        if generate_with_edge_tts(text, path, voice=voice):
            print(f"    -> ok (edge-tts)")
        elif not generate_with_openai_tts(text, path):
            print(f"    -> falling back to silence WAV")
            generate_silence_wav(path, duration_seconds=8.0)
        else:
            print(f"    -> ok (openai)")

    print("\n=== Generating S2S prompts ===")
    for i, (filename, text) in enumerate(S2S_PROMPTS):
        path = os.path.join(prompts_dir, filename)
        if os.path.exists(path) and os.path.getsize(path) > 1000:
            print(f"  [skip] {filename} already exists")
            continue
        voice = edge_voices[i % len(edge_voices)]
        print(f"  [{i+1}/{len(S2S_PROMPTS)}] {filename} (voice={voice})...")
        if generate_with_edge_tts(text, path, voice=voice):
            print(f"    -> ok (edge-tts)")
        elif not generate_with_openai_tts(text, path):
            print(f"    -> falling back to silence WAV")
            generate_silence_wav(path, duration_seconds=6.0)
        else:
            print(f"    -> ok (openai)")

    print("\nDone! Generated audio files in:")
    print(f"  STT clips:   {os.path.abspath(clips_dir)}")
    print(f"  S2S prompts: {os.path.abspath(prompts_dir)}")


if __name__ == "__main__":
    main()
