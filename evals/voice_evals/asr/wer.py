"""String-level ASR accuracy metrics (WER, CER, MER, WIP, WIL).

All metrics in this module operate on pre-transcribed text.  The heavy
lifting is delegated to the ``jiwer`` library, which is lazy-loaded so that
importing this module is cheap when only other subpackages are used.
"""

from __future__ import annotations

import logging
import re
from typing import Sequence

logger = logging.getLogger("voice_evals.asr.wer")

DEFAULT_FILLER_WORDS: list[str] = [
    "um", "uh", "ah", "er", "hmm", "like", "you know",
]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _require_jiwer():  # noqa: ANN202
    """Lazy-import *jiwer*, raising a friendly error if absent."""
    try:
        import jiwer
    except ImportError:
        from ..exceptions import MissingDependencyError
        raise MissingDependencyError("jiwer", "asr")
    return jiwer


def _normalize(text: str) -> str:
    """Lowercase, collapse whitespace, strip leading/trailing space."""
    return re.sub(r"\s+", " ", text.lower()).strip()


def _strip_fillers(text: str, filler_words: Sequence[str]) -> str:
    """Remove filler words/phrases from *text*.

    Multi-word fillers (e.g. ``"you know"``) are handled first so that
    partial matches do not interfere.
    """
    result = text
    # Process multi-word fillers first (longest first to avoid partial
    # matches), then single-word fillers.
    sorted_fillers = sorted(filler_words, key=lambda f: -len(f))
    for filler in sorted_fillers:
        # Use word-boundary aware replacement so "unlike" is not clobbered
        # by the filler "like".
        pattern = re.compile(r"\b" + re.escape(filler) + r"\b", re.IGNORECASE)
        result = pattern.sub("", result)
    # Collapse any leftover multiple spaces.
    return re.sub(r"\s+", " ", result).strip()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def calculate_wer(hypothesis: str, reference: str) -> float:
    """Word Error Rate = (Substitutions + Deletions + Insertions) / N.

    Parameters
    ----------
    hypothesis:
        The ASR system output.
    reference:
        The ground-truth transcript.

    Returns
    -------
    float
        WER in ``[0, inf)``.  Returns ``0.0`` when both strings are empty,
        and ``1.0`` when only the reference is empty (by convention).
    """
    ref = _normalize(reference)
    hyp = _normalize(hypothesis)

    if ref == "" and hyp == "":
        return 0.0
    if ref == "":
        # No reference words; any hypothesis counts as pure insertion error.
        return 1.0
    if hyp == "":
        # Everything is a deletion.
        return 1.0
    if ref == hyp:
        return 0.0

    jiwer = _require_jiwer()
    return float(jiwer.wer(ref, hyp))


def calculate_cer(hypothesis: str, reference: str) -> float:
    """Character Error Rate.

    Parameters
    ----------
    hypothesis:
        The ASR system output.
    reference:
        The ground-truth transcript.

    Returns
    -------
    float
        CER in ``[0, inf)``.
    """
    ref = _normalize(reference)
    hyp = _normalize(hypothesis)

    if ref == "" and hyp == "":
        return 0.0
    if ref == "":
        return 1.0
    if hyp == "":
        return 1.0
    if ref == hyp:
        return 0.0

    jiwer = _require_jiwer()
    return float(jiwer.cer(ref, hyp))


def calculate_string_metrics(
    hypothesis: str,
    reference: str,
    filler_words: list[str] | None = None,
) -> dict:
    """Compute all string-level accuracy metrics in a single pass.

    Parameters
    ----------
    hypothesis:
        The ASR system output.
    reference:
        The ground-truth transcript.
    filler_words:
        Words/phrases stripped before computing the normalised WER.  Defaults
        to :data:`DEFAULT_FILLER_WORDS`.

    Returns
    -------
    dict
        Keys: ``wer``, ``wer_normalized``, ``cer``, ``mer``, ``wip``,
        ``wil``, ``word_accuracy``.
    """
    if filler_words is None:
        filler_words = DEFAULT_FILLER_WORDS

    ref = _normalize(reference)
    hyp = _normalize(hypothesis)

    # --- fast-path for trivial cases ---
    if ref == "" and hyp == "":
        return {
            "wer": 0.0,
            "wer_normalized": 0.0,
            "cer": 0.0,
            "mer": 0.0,
            "wip": 1.0,
            "wil": 0.0,
            "word_accuracy": 1.0,
        }

    if ref == "" or hyp == "":
        return {
            "wer": 1.0,
            "wer_normalized": 1.0,
            "cer": 1.0,
            "mer": 1.0,
            "wip": 0.0,
            "wil": 1.0,
            "word_accuracy": 0.0,
        }

    jiwer = _require_jiwer()

    if ref == hyp:
        wer = mer = cer = wil = 0.0
        wip = 1.0
    else:
        wer = float(jiwer.wer(ref, hyp))
        cer = float(jiwer.cer(ref, hyp))
        mer = float(jiwer.mer(ref, hyp))
        wip = float(jiwer.wip(ref, hyp))
        wil = float(jiwer.wil(ref, hyp))

    # Normalized WER: strip filler words, then recompute WER.
    ref_clean = _strip_fillers(ref, filler_words)
    hyp_clean = _strip_fillers(hyp, filler_words)

    if ref_clean == "" and hyp_clean == "":
        wer_normalized = 0.0
    elif ref_clean == "" or hyp_clean == "":
        wer_normalized = 1.0
    elif ref_clean == hyp_clean:
        wer_normalized = 0.0
    else:
        wer_normalized = float(jiwer.wer(ref_clean, hyp_clean))

    word_accuracy = max(0.0, 1.0 - wer)

    logger.debug(
        "String metrics — WER=%.4f  WER_norm=%.4f  CER=%.4f  MER=%.4f",
        wer, wer_normalized, cer, mer,
    )

    return {
        "wer": wer,
        "wer_normalized": wer_normalized,
        "cer": cer,
        "mer": mer,
        "wip": wip,
        "wil": wil,
        "word_accuracy": word_accuracy,
    }
