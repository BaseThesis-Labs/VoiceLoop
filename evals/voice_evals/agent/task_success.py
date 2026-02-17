"""Task success rate and containment evaluation.

Uses LLM-as-judge (via the OpenAI API) to assess whether a voice agent
successfully completed a described task, and whether the conversation
was contained without requiring human escalation.
"""

from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger("voice_evals.agent.task_success")

# Default phrases that indicate the agent escalated to a human.
_DEFAULT_ESCALATION_PHRASES: list[str] = [
    "transfer to agent",
    "transfer to a human",
    "transfer you to",
    "speak to a human",
    "speak to a representative",
    "speak with a representative",
    "speak with an agent",
    "let me connect you",
    "connecting you to",
    "i'll transfer you",
    "i will transfer you",
    "escalating your case",
    "escalating this",
    "please hold while i transfer",
    "a human agent will",
    "a live agent will",
]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _require_openai():  # noqa: ANN202
    """Lazy-import *openai*, raising a friendly error if absent."""
    try:
        import openai
    except ImportError:
        from ..exceptions import MissingDependencyError

        raise MissingDependencyError("openai", "agent")
    return openai


def _call_llm(prompt: str, model: str) -> str:
    """Send a prompt to the OpenAI chat completions API and return the text.

    Parameters
    ----------
    prompt:
        The full user prompt to send.
    model:
        OpenAI model identifier (e.g. ``"gpt-4o-mini"``).

    Returns
    -------
    str
        The assistant's response text.

    Raises
    ------
    RuntimeError
        If the API call fails.
    """
    openai = _require_openai()
    client = openai.OpenAI()

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert evaluator of voice AI agent "
                        "conversations. Respond ONLY with valid JSON."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.0,
            max_tokens=1024,
        )
        return response.choices[0].message.content or ""
    except Exception as exc:
        logger.error("OpenAI API call failed: %s", exc)
        raise RuntimeError(f"LLM evaluation call failed: {exc}") from exc


def _parse_json_response(text: str) -> dict[str, Any]:
    """Best-effort parse of an LLM JSON response.

    Handles responses wrapped in markdown code fences.
    """
    cleaned = text.strip()
    if cleaned.startswith("```"):
        # Strip markdown code fences.
        lines = cleaned.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        cleaned = "\n".join(lines).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        logger.warning("Failed to parse LLM response as JSON: %s", exc)
        return {}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def evaluate_task_success(
    agent_transcript: str,
    expected_outcome: str,
    task_description: str | None = None,
    model: str = "gpt-4o-mini",
) -> dict[str, Any]:
    """Evaluate whether the agent completed the task successfully.

    Uses an LLM-as-judge to assess task completion based on the
    conversation transcript and the expected outcome.

    Parameters
    ----------
    agent_transcript:
        The full conversation transcript between the user and the agent.
    expected_outcome:
        A description of what a successful outcome looks like.
    task_description:
        Optional description of the task the agent was expected to
        perform.  Provides additional context for the judge.
    model:
        OpenAI model identifier for the judge.

    Returns
    -------
    dict
        Keys:

        - ``task_success`` (bool) — whether the task was completed
        - ``confidence`` (float) — judge confidence in [0, 1]
        - ``reasoning`` (str) — explanation of the judgment
    """
    if not agent_transcript or not agent_transcript.strip():
        logger.warning("Empty transcript — marking task as failed")
        return {
            "task_success": False,
            "confidence": 1.0,
            "reasoning": "No transcript provided.",
        }

    task_ctx = ""
    if task_description:
        task_ctx = f"\n\nTask Description:\n{task_description}"

    prompt = (
        f"Evaluate whether the following voice agent conversation "
        f"successfully achieved the expected outcome.\n"
        f"{task_ctx}\n\n"
        f"Expected Outcome:\n{expected_outcome}\n\n"
        f"Conversation Transcript:\n{agent_transcript}\n\n"
        f"Respond with a JSON object containing:\n"
        f'- "task_success": true/false\n'
        f'- "confidence": float between 0 and 1\n'
        f'- "reasoning": brief explanation of your judgment\n'
    )

    raw = _call_llm(prompt, model)
    parsed = _parse_json_response(raw)

    result = {
        "task_success": bool(parsed.get("task_success", False)),
        "confidence": float(parsed.get("confidence", 0.0)),
        "reasoning": str(parsed.get("reasoning", raw)),
    }

    logger.info(
        "Task success: %s (confidence=%.2f)",
        result["task_success"],
        result["confidence"],
    )
    return result


def evaluate_containment(
    agent_transcript: str,
    escalation_phrases: list[str] | None = None,
) -> dict[str, Any]:
    """Evaluate whether the conversation was contained without escalation.

    Uses keyword matching to detect escalation indicators in the
    transcript.  The conversation is considered *contained* if no
    escalation phrases are found.

    Parameters
    ----------
    agent_transcript:
        The full conversation transcript.
    escalation_phrases:
        List of phrases that indicate escalation to a human agent.
        Defaults to a built-in list of common escalation indicators.

    Returns
    -------
    dict
        Keys:

        - ``contained`` (bool) — True if no escalation was detected
        - ``escalation_detected`` (bool) — True if escalation phrases
          were found
        - ``escalation_reason`` (str | None) — the first matched phrase,
          or None
    """
    if escalation_phrases is None:
        escalation_phrases = _DEFAULT_ESCALATION_PHRASES

    if not agent_transcript or not agent_transcript.strip():
        logger.warning("Empty transcript — treating as contained")
        return {
            "contained": True,
            "escalation_detected": False,
            "escalation_reason": None,
        }

    transcript_lower = agent_transcript.lower()

    for phrase in escalation_phrases:
        if phrase.lower() in transcript_lower:
            logger.info("Escalation detected: '%s'", phrase)
            return {
                "contained": False,
                "escalation_detected": True,
                "escalation_reason": phrase,
            }

    logger.debug("No escalation detected — conversation contained")
    return {
        "contained": True,
        "escalation_detected": False,
        "escalation_reason": None,
    }
