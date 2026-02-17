"""Dialogue coherence evaluation.

Uses LLM-as-judge (via the OpenAI API) to assess whether a voice agent
maintains coherent dialogue across multiple turns.
"""

from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger("voice_evals.agent.dialogue")


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

def evaluate_coherence(
    transcript: str,
    model: str = "gpt-4o-mini",
) -> dict[str, Any]:
    """Evaluate dialogue coherence using LLM-as-judge.

    Assesses the conversation on four dimensions:

    - **Context carryover** — does the agent remember earlier turns?
    - **Anaphora resolution** — are pronouns and references resolved
      correctly?
    - **Topic consistency** — does the agent stay on-topic or drift?
    - **Instruction retention** — does the agent follow previously
      stated instructions throughout the conversation?

    Parameters
    ----------
    transcript:
        The full multi-turn conversation transcript.
    model:
        OpenAI model identifier for the judge.

    Returns
    -------
    dict
        Keys:

        - ``coherence_score`` (float) — overall coherence in [0, 1]
        - ``dimensions`` (dict) — per-dimension scores, each in [0, 1]:
          ``context_carryover``, ``anaphora_resolution``,
          ``topic_consistency``, ``instruction_retention``
        - ``reasoning`` (str) — explanation of the judgment
    """
    if not transcript or not transcript.strip():
        logger.warning("Empty transcript — returning zero coherence")
        return {
            "coherence_score": 0.0,
            "dimensions": {
                "context_carryover": 0.0,
                "anaphora_resolution": 0.0,
                "topic_consistency": 0.0,
                "instruction_retention": 0.0,
            },
            "reasoning": "No transcript provided.",
        }

    prompt = (
        "Evaluate the coherence of the following voice agent conversation "
        "transcript.\n\n"
        "Score each of the following dimensions from 0.0 (incoherent) to "
        "1.0 (perfectly coherent):\n\n"
        "1. context_carryover — Does the agent remember and use "
        "information from earlier turns?\n"
        "2. anaphora_resolution — Are pronouns and references (e.g. "
        "'it', 'that', 'the one I mentioned') resolved correctly?\n"
        "3. topic_consistency — Does the agent stay on-topic without "
        "random drift or contradictions?\n"
        "4. instruction_retention — Does the agent follow user "
        "instructions and constraints throughout the conversation?\n\n"
        f"Conversation Transcript:\n{transcript}\n\n"
        "Respond with a JSON object containing:\n"
        '- "coherence_score": overall score (float, 0–1)\n'
        '- "dimensions": object with keys "context_carryover", '
        '"anaphora_resolution", "topic_consistency", '
        '"instruction_retention" (each float, 0–1)\n'
        '- "reasoning": brief explanation of your scores\n'
    )

    raw = _call_llm(prompt, model)
    parsed = _parse_json_response(raw)

    # Extract dimensions with defaults.
    raw_dims = parsed.get("dimensions", {})
    if not isinstance(raw_dims, dict):
        raw_dims = {}

    dimensions = {
        "context_carryover": _clamp_score(raw_dims.get("context_carryover")),
        "anaphora_resolution": _clamp_score(raw_dims.get("anaphora_resolution")),
        "topic_consistency": _clamp_score(raw_dims.get("topic_consistency")),
        "instruction_retention": _clamp_score(raw_dims.get("instruction_retention")),
    }

    # Overall score: use the LLM's value if present, otherwise average dims.
    raw_overall = parsed.get("coherence_score")
    if raw_overall is not None:
        coherence_score = _clamp_score(raw_overall)
    else:
        valid_scores = [v for v in dimensions.values() if v is not None]
        coherence_score = (
            sum(valid_scores) / len(valid_scores) if valid_scores else 0.0
        )

    # Replace None dimensions with 0.0 for the final output.
    dimensions = {k: v if v is not None else 0.0 for k, v in dimensions.items()}

    result = {
        "coherence_score": coherence_score if coherence_score is not None else 0.0,
        "dimensions": dimensions,
        "reasoning": str(parsed.get("reasoning", raw)),
    }

    logger.info("Coherence score: %.2f", result["coherence_score"])
    return result


def _clamp_score(value: Any) -> float | None:
    """Clamp a value to [0, 1], returning None if not parseable."""
    if value is None:
        return None
    try:
        score = float(value)
        return max(0.0, min(1.0, score))
    except (TypeError, ValueError):
        return None
