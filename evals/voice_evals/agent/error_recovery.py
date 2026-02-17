"""Error recovery evaluation.

Uses LLM-as-judge (via the OpenAI API) to assess whether a voice agent
detects misunderstandings and recovers gracefully from errors during
a conversation.
"""

from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger("voice_evals.agent.error_recovery")


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


def _clamp_score(value: Any) -> float | None:
    """Clamp a value to [0, 1], returning None if not parseable."""
    if value is None:
        return None
    try:
        score = float(value)
        return max(0.0, min(1.0, score))
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def evaluate_error_recovery(
    transcript: str,
    model: str = "gpt-4o-mini",
) -> dict[str, Any]:
    """Evaluate a voice agent's error detection and recovery behaviour.

    Uses an LLM-as-judge to analyse the conversation for:

    - Whether errors or misunderstandings occurred.
    - Whether the agent detected those errors.
    - Whether the agent recovered appropriately (e.g. asked for
      clarification, corrected itself, apologised and re-prompted).

    Parameters
    ----------
    transcript:
        The full conversation transcript between user and agent.
    model:
        OpenAI model identifier for the judge.

    Returns
    -------
    dict
        Keys:

        - ``error_detected`` (bool) — whether the agent noticed any
          error or misunderstanding in the conversation
        - ``error_recovered`` (bool) — whether the agent successfully
          recovered from the error
        - ``detection_quality`` (float) — quality of error detection
          in [0, 1]
        - ``recovery_quality`` (float) — quality of error recovery
          in [0, 1]
        - ``reasoning`` (str) — explanation of the judgment
    """
    if not transcript or not transcript.strip():
        logger.warning("Empty transcript — returning default (no errors)")
        return {
            "error_detected": False,
            "error_recovered": False,
            "detection_quality": 0.0,
            "recovery_quality": 0.0,
            "reasoning": "No transcript provided.",
        }

    prompt = (
        "Analyze the following voice agent conversation for error "
        "handling behavior.\n\n"
        "Consider the following:\n"
        "1. Did any misunderstanding, mishearing, or error occur during "
        "the conversation? (e.g. the agent misunderstood the user, "
        "repeated the wrong information, or provided an incorrect "
        "response)\n"
        "2. If errors occurred, did the agent detect them? (e.g. the "
        "agent acknowledged the mistake, asked for clarification, or "
        "noticed confusion)\n"
        "3. If the agent detected errors, did it recover gracefully? "
        "(e.g. corrected itself, re-asked the question, apologized and "
        "continued appropriately)\n\n"
        f"Conversation Transcript:\n{transcript}\n\n"
        "Respond with a JSON object containing:\n"
        '- "errors_present": true if any errors or misunderstandings '
        "occurred in the conversation, false otherwise\n"
        '- "error_detected": true if the agent detected/acknowledged '
        "the error, false otherwise (false if no errors present)\n"
        '- "error_recovered": true if the agent recovered successfully, '
        "false otherwise (false if no errors present)\n"
        '- "detection_quality": float 0–1 rating how well the agent '
        "detected errors (0 = oblivious, 1 = immediately caught it)\n"
        '- "recovery_quality": float 0–1 rating how well the agent '
        "recovered (0 = failed to recover, 1 = seamless recovery)\n"
        '- "reasoning": brief explanation of your analysis\n'
    )

    raw = _call_llm(prompt, model)
    parsed = _parse_json_response(raw)

    errors_present = bool(parsed.get("errors_present", False))

    # If no errors were present, detection and recovery are N/A.
    if not errors_present:
        result = {
            "error_detected": False,
            "error_recovered": False,
            "detection_quality": 1.0,  # no errors to miss
            "recovery_quality": 1.0,  # no errors to recover from
            "reasoning": str(
                parsed.get("reasoning", "No errors found in the conversation.")
            ),
        }
        logger.info("No errors detected in transcript")
        return result

    detection_quality = _clamp_score(parsed.get("detection_quality"))
    recovery_quality = _clamp_score(parsed.get("recovery_quality"))

    result = {
        "error_detected": bool(parsed.get("error_detected", False)),
        "error_recovered": bool(parsed.get("error_recovered", False)),
        "detection_quality": detection_quality if detection_quality is not None else 0.0,
        "recovery_quality": recovery_quality if recovery_quality is not None else 0.0,
        "reasoning": str(parsed.get("reasoning", raw)),
    }

    logger.info(
        "Error recovery — detected=%s, recovered=%s, "
        "detection_quality=%.2f, recovery_quality=%.2f",
        result["error_detected"],
        result["error_recovered"],
        result["detection_quality"],
        result["recovery_quality"],
    )
    return result
