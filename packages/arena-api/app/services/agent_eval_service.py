import json
import logging
import httpx
from app.config import settings

logger = logging.getLogger("arena.agent.eval")


async def evaluate_agent_conversation(
    transcript: list[dict],
    scenario_description: str,
    success_criteria: str | None,
    required_slots: dict | None,
) -> dict:
    """Run LLM-as-judge on an agent conversation transcript.

    Returns: {
        task_success: bool,
        coherence_score: float (0-1),
        instruction_following: float (0-1),
        hallucination_count: int,
        joint_goal_accuracy: float (0-1) or None,
        explanation: str,
    }
    """
    if not settings.openai_api_key:
        logger.warning("No OpenAI API key set, skipping agent evaluation")
        return {}

    # Build transcript text
    transcript_text = "\n".join(
        f"{t.get('role', 'unknown').upper()}: {t.get('text', '')}"
        for t in transcript
        if t.get("text")
    )

    # Build evaluation prompt
    eval_prompt = f"""You are evaluating a voice agent conversation. The agent was given a task scenario and had a conversation with a user.

SCENARIO: {scenario_description}

{"SUCCESS CRITERIA: " + success_criteria if success_criteria else ""}

{"REQUIRED SLOTS: " + json.dumps(required_slots) if required_slots else ""}

CONVERSATION TRANSCRIPT:
{transcript_text}

Evaluate the agent's performance and respond with a JSON object:
{{
    "task_success": true/false,
    "coherence_score": 0.0-1.0,
    "instruction_following": 0.0-1.0,
    "hallucination_count": 0,
    "joint_goal_accuracy": 0.0-1.0 or null,
    "explanation": "Brief explanation of the evaluation"
}}

Only respond with the JSON object, no other text."""

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "user", "content": eval_prompt}],
                    "temperature": 0.1,
                    "response_format": {"type": "json_object"},
                },
                timeout=30.0,
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            return json.loads(content)
    except Exception as e:
        logger.error("Agent evaluation failed: %s", e)
        return {}
