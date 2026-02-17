"""Semantic-Aware Error Rate (SAER) -- SwitchLingua 2025.

SAER blends a **form-based** error term (standard WER for alphabetic text)
with a **semantic** error term (1 minus LaBSE cosine similarity) via a
tuneable mixing coefficient ``lambda_``:

    SAER = lambda_ * F_form + (1 - lambda_) * epsilon_sem

When ``lambda_ = 0.5`` (the default), form and semantics contribute
equally.  Setting ``lambda_ = 1`` reduces SAER to pure WER; setting
``lambda_ = 0`` yields a purely semantic metric.

The LaBSE sentence embedding model is lazy-loaded via ``sentence_transformers``
and cached at module level.
"""

from __future__ import annotations

import logging
import re
from typing import Any

import numpy as np

logger = logging.getLogger("voice_evals.asr.saer")

# Module-level model cache: device -> SentenceTransformer
_labse_cache: dict[str, Any] = {}

_DEFAULT_LABSE_MODEL = "sentence-transformers/LaBSE"


# ---------------------------------------------------------------------------
# Dependency helpers
# ---------------------------------------------------------------------------

def _require_sentence_transformers():  # noqa: ANN202
    try:
        import sentence_transformers
    except ImportError:
        from ..exceptions import MissingDependencyError
        raise MissingDependencyError("sentence-transformers", "asr")
    return sentence_transformers


def _require_jiwer():  # noqa: ANN202
    try:
        import jiwer
    except ImportError:
        from ..exceptions import MissingDependencyError
        raise MissingDependencyError("jiwer", "asr")
    return jiwer


def _get_labse(device: str) -> Any:
    """Return a cached LaBSE SentenceTransformer model."""
    if device not in _labse_cache:
        st = _require_sentence_transformers()
        logger.info(
            "Loading LaBSE model '%s' on device '%s'",
            _DEFAULT_LABSE_MODEL,
            device,
        )
        try:
            model = st.SentenceTransformer(_DEFAULT_LABSE_MODEL, device=device)
        except Exception as exc:
            from ..exceptions import ModelLoadError
            raise ModelLoadError(
                f"Failed to load LaBSE model '{_DEFAULT_LABSE_MODEL}': {exc}"
            ) from exc
        _labse_cache[device] = model
    return _labse_cache[device]


# ---------------------------------------------------------------------------
# Internal components
# ---------------------------------------------------------------------------

def _normalize(text: str) -> str:
    """Lowercase, collapse whitespace, strip."""
    return re.sub(r"\s+", " ", text.lower()).strip()


def _compute_f_form(hypothesis: str, reference: str) -> float:
    """Form-based error: standard WER on alphabetic text.

    Returns a value in ``[0, inf)`` (typically ``[0, 1]`` for reasonable
    ASR output).
    """
    ref = _normalize(reference)
    hyp = _normalize(hypothesis)

    if ref == "" and hyp == "":
        return 0.0
    if ref == "" or hyp == "":
        return 1.0
    if ref == hyp:
        return 0.0

    jiwer = _require_jiwer()
    return float(jiwer.wer(ref, hyp))


def _compute_epsilon_sem(
    hypothesis: str,
    reference: str,
    device: str,
) -> float:
    """Semantic error: 1 - cosine_similarity(LaBSE(hyp), LaBSE(ref)).

    Returns a value in ``[0, 1]``.  Lower means the hypothesis is
    semantically closer to the reference.
    """
    ref = _normalize(reference)
    hyp = _normalize(hypothesis)

    if ref == "" and hyp == "":
        return 0.0
    if ref == "" or hyp == "":
        return 1.0
    if ref == hyp:
        return 0.0

    model = _get_labse(device)

    embeddings = model.encode([ref, hyp], convert_to_numpy=True)
    ref_emb: np.ndarray = embeddings[0]
    hyp_emb: np.ndarray = embeddings[1]

    norm_ref = np.linalg.norm(ref_emb)
    norm_hyp = np.linalg.norm(hyp_emb)

    if norm_ref < 1e-12 or norm_hyp < 1e-12:
        return 1.0

    cosine_sim = float(np.dot(ref_emb, hyp_emb) / (norm_ref * norm_hyp))
    cosine_sim = max(0.0, min(1.0, cosine_sim))

    return 1.0 - cosine_sim


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def calculate_saer(
    hypothesis: str,
    reference: str,
    lambda_: float = 0.5,
    device: str = "cpu",
) -> dict:
    """Compute the Semantic-Aware Error Rate.

    Parameters
    ----------
    hypothesis:
        The ASR system output.
    reference:
        The ground-truth transcript.
    lambda_:
        Mixing coefficient in ``[0, 1]``.  ``1.0`` = pure WER (form only),
        ``0.0`` = pure semantic error, ``0.5`` = equal blend.
    device:
        PyTorch device string (``"cpu"``, ``"cuda"``, ``"mps"``).

    Returns
    -------
    dict
        Keys: ``saer``, ``f_form``, ``epsilon_sem``, ``lambda_``.

    Raises
    ------
    ValueError
        If ``lambda_`` is outside ``[0, 1]``.
    MissingDependencyError
        If ``jiwer`` or ``sentence-transformers`` is not installed.
    """
    if not 0.0 <= lambda_ <= 1.0:
        raise ValueError(f"lambda_ must be in [0, 1], got {lambda_}")

    ref = _normalize(reference)
    hyp = _normalize(hypothesis)

    # Edge cases
    if ref == "" and hyp == "":
        return {
            "saer": 0.0,
            "f_form": 0.0,
            "epsilon_sem": 0.0,
            "lambda_": lambda_,
        }

    if ref == "" or hyp == "":
        return {
            "saer": 1.0,
            "f_form": 1.0,
            "epsilon_sem": 1.0,
            "lambda_": lambda_,
        }

    if ref == hyp:
        return {
            "saer": 0.0,
            "f_form": 0.0,
            "epsilon_sem": 0.0,
            "lambda_": lambda_,
        }

    f_form = _compute_f_form(hypothesis, reference)
    epsilon_sem = _compute_epsilon_sem(hypothesis, reference, device)

    saer = lambda_ * f_form + (1.0 - lambda_) * epsilon_sem

    logger.debug(
        "SAER = %.4f  (F_form=%.4f, eps_sem=%.4f, lambda=%.2f)",
        saer, f_form, epsilon_sem, lambda_,
    )

    return {
        "saer": saer,
        "f_form": f_form,
        "epsilon_sem": epsilon_sem,
        "lambda_": lambda_,
    }
