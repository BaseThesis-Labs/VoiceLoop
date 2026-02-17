"""Intent accuracy and slot filling evaluation.

Provides deterministic (non-LLM) metrics for intent classification and
slot filling — the core NLU components of a voice agent pipeline.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("voice_evals.agent.intent")


def evaluate_intent_accuracy(
    predicted_intent: str,
    expected_intent: str,
) -> dict[str, Any]:
    """Compare a predicted intent against the expected intent.

    Comparison is case-insensitive with leading/trailing whitespace
    stripped.

    Parameters
    ----------
    predicted_intent:
        The intent label produced by the NLU system.
    expected_intent:
        The ground-truth intent label.

    Returns
    -------
    dict
        Keys:

        - ``correct`` (bool) — whether the predicted intent matches
        - ``predicted`` (str) — the normalized predicted intent
        - ``expected`` (str) — the normalized expected intent
    """
    pred = predicted_intent.strip().lower()
    exp = expected_intent.strip().lower()

    correct = pred == exp

    if correct:
        logger.debug("Intent correct: '%s'", exp)
    else:
        logger.debug("Intent mismatch: predicted='%s', expected='%s'", pred, exp)

    return {
        "correct": correct,
        "predicted": pred,
        "expected": exp,
    }


def evaluate_slot_accuracy(
    predicted_slots: dict[str, str],
    expected_slots: dict[str, str],
) -> dict[str, Any]:
    """Compute Joint Goal Accuracy (JGA) for slot filling.

    JGA is 1.0 only if **every** expected slot is present in the
    predicted slots and its value matches exactly (case-insensitive,
    stripped).  Any extra predicted slots not in the expected set are
    ignored for JGA but reported in slot details.

    Parameters
    ----------
    predicted_slots:
        Slot name → value mapping produced by the NLU system.
    expected_slots:
        Ground-truth slot name → value mapping.

    Returns
    -------
    dict
        Keys:

        - ``joint_goal_accuracy`` (float) — 1.0 if all slots match, else
          0.0
        - ``slot_f1`` (float) — harmonic mean of slot precision and
          recall
        - ``num_expected`` (int) — number of expected slots
        - ``num_predicted`` (int) — number of predicted slots
        - ``num_correct`` (int) — number of correctly predicted slots
        - ``slot_details`` (dict) — per-slot comparison details
    """
    if not expected_slots:
        # No slots expected — vacuously correct.
        logger.debug("No expected slots — JGA=1.0")
        return {
            "joint_goal_accuracy": 1.0,
            "slot_f1": 1.0 if not predicted_slots else 0.0,
            "num_expected": 0,
            "num_predicted": len(predicted_slots),
            "num_correct": 0,
            "slot_details": {},
        }

    # Normalize keys and values for comparison.
    pred_norm = {
        k.strip().lower(): v.strip().lower() for k, v in predicted_slots.items()
    }
    exp_norm = {
        k.strip().lower(): v.strip().lower() for k, v in expected_slots.items()
    }

    slot_details: dict[str, dict[str, Any]] = {}
    num_correct = 0
    all_correct = True

    for slot_name, expected_value in exp_norm.items():
        predicted_value = pred_norm.get(slot_name)

        if predicted_value is None:
            slot_details[slot_name] = {
                "correct": False,
                "predicted": None,
                "expected": expected_value,
                "error": "missing",
            }
            all_correct = False
        elif predicted_value == expected_value:
            slot_details[slot_name] = {
                "correct": True,
                "predicted": predicted_value,
                "expected": expected_value,
            }
            num_correct += 1
        else:
            slot_details[slot_name] = {
                "correct": False,
                "predicted": predicted_value,
                "expected": expected_value,
                "error": "value_mismatch",
            }
            all_correct = False

    # Report extra predicted slots not in the expected set.
    for slot_name in pred_norm:
        if slot_name not in exp_norm:
            slot_details[slot_name] = {
                "correct": False,
                "predicted": pred_norm[slot_name],
                "expected": None,
                "error": "unexpected_slot",
            }

    # Compute slot-level precision, recall, F1.
    num_expected = len(exp_norm)
    num_predicted = len(pred_norm)

    precision = num_correct / num_predicted if num_predicted > 0 else 0.0
    recall = num_correct / num_expected if num_expected > 0 else 0.0

    if precision + recall > 0:
        slot_f1 = 2 * precision * recall / (precision + recall)
    else:
        slot_f1 = 0.0

    jga = 1.0 if all_correct else 0.0

    logger.debug(
        "Slot accuracy — JGA=%.1f  F1=%.4f  (%d/%d correct)",
        jga,
        slot_f1,
        num_correct,
        num_expected,
    )

    return {
        "joint_goal_accuracy": jga,
        "slot_f1": slot_f1,
        "num_expected": num_expected,
        "num_predicted": num_predicted,
        "num_correct": num_correct,
        "slot_details": slot_details,
    }
