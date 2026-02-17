"""SeMaScore -- Semantic Match Score (Sasindran et al., Interspeech 2024).

SeMaScore is a reference-based ASR evaluation metric that combines
lexical accuracy (via Match Error Rate) with semantic similarity (via
BERT embeddings).  It uses a four-phase pipeline:

1. **Segment mapping** -- character-level Levenshtein alignment maps each
   hypothesis word to the closest reference word(s).
2. **Per-segment scoring** -- for each aligned segment pair, compute the
   BERT cosine similarity and penalise it by the segment-level MER.
3. **Importance weighting** -- weight each segment by its contribution to
   the full-sentence embedding magnitude.
4. **Aggregation** -- weighted mean of the penalised segment scores.

The ``transformers`` library (HuggingFace) and ``torch`` are lazy-loaded.
The BERT model/tokenizer are cached at module level.
"""

from __future__ import annotations

import logging
import re
from typing import Any

import numpy as np

logger = logging.getLogger("voice_evals.asr.semascore")

# Module-level model cache: device -> (tokenizer, model)
_bert_cache: dict[str, tuple[Any, Any]] = {}

_DEFAULT_BERT_MODEL = "bert-base-uncased"


# ---------------------------------------------------------------------------
# Dependency helpers
# ---------------------------------------------------------------------------

def _require_transformers():  # noqa: ANN202
    try:
        import transformers
    except ImportError:
        from ..exceptions import MissingDependencyError
        raise MissingDependencyError("transformers", "asr")
    return transformers


def _require_torch():  # noqa: ANN202
    try:
        import torch
    except ImportError:
        from ..exceptions import MissingDependencyError
        raise MissingDependencyError("torch", "asr")
    return torch


def _get_bert(device: str) -> tuple[Any, Any]:
    """Return ``(tokenizer, model)`` for BERT, loading on first call."""
    if device not in _bert_cache:
        transformers = _require_transformers()
        torch = _require_torch()
        logger.info(
            "Loading BERT model '%s' on device '%s'", _DEFAULT_BERT_MODEL, device,
        )
        try:
            tokenizer = transformers.AutoTokenizer.from_pretrained(_DEFAULT_BERT_MODEL)
            model = transformers.AutoModel.from_pretrained(_DEFAULT_BERT_MODEL)
            model.eval()
            model.to(torch.device(device))
        except Exception as exc:
            from ..exceptions import ModelLoadError
            raise ModelLoadError(
                f"Failed to load BERT model '{_DEFAULT_BERT_MODEL}': {exc}"
            ) from exc
        _bert_cache[device] = (tokenizer, model)
    return _bert_cache[device]


# ---------------------------------------------------------------------------
# Embedding utilities
# ---------------------------------------------------------------------------

def _embed_sentence(text: str, tokenizer: Any, model: Any, device: str) -> np.ndarray:
    """Return the mean-pooled BERT embedding for *text* as a 1-D numpy array."""
    torch = _require_torch()
    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=512,
        padding=True,
    )
    inputs = {k: v.to(torch.device(device)) for k, v in inputs.items()}
    with torch.no_grad():
        outputs = model(**inputs)
    # Mean-pool over token dimension (exclude special tokens' effect by using
    # the attention mask).
    mask = inputs["attention_mask"].unsqueeze(-1).float()
    embeddings = (outputs.last_hidden_state * mask).sum(dim=1) / mask.sum(dim=1)
    return embeddings.squeeze(0).cpu().numpy()


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two 1-D vectors, clipped to [0, 1]."""
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a < 1e-12 or norm_b < 1e-12:
        return 0.0
    sim = float(np.dot(a, b) / (norm_a * norm_b))
    return max(0.0, min(1.0, sim))


# ---------------------------------------------------------------------------
# Phase 1 -- Segment mapping via character Levenshtein
# ---------------------------------------------------------------------------

def _char_edit_distance(s1: str, s2: str) -> int:
    """Character-level Levenshtein distance (O(n*m) DP)."""
    n, m = len(s1), len(s2)
    if n == 0:
        return m
    if m == 0:
        return n
    prev = list(range(m + 1))
    curr = [0] * (m + 1)
    for i in range(1, n + 1):
        curr[0] = i
        for j in range(1, m + 1):
            cost = 0 if s1[i - 1] == s2[j - 1] else 1
            curr[j] = min(
                prev[j] + 1,       # deletion
                curr[j - 1] + 1,    # insertion
                prev[j - 1] + cost, # substitution
            )
        prev, curr = curr, prev
    return prev[m]


def _align_words(ref_words: list[str], hyp_words: list[str]) -> list[tuple[str, str]]:
    """Align hypothesis words to reference words via character edit distance.

    Each hypothesis word is mapped to the reference word with the smallest
    character-level edit distance.  Reference words may be reused or left
    unmatched.  Returns a list of ``(ref_segment, hyp_segment)`` pairs.
    """
    if not hyp_words:
        return [(w, "") for w in ref_words]
    if not ref_words:
        return [("", w) for w in hyp_words]

    pairs: list[tuple[str, str]] = []
    for hyp_w in hyp_words:
        best_ref = min(ref_words, key=lambda rw: _char_edit_distance(rw, hyp_w))
        pairs.append((best_ref, hyp_w))
    return pairs


# ---------------------------------------------------------------------------
# Phase 2 -- Per-segment MER computation
# ---------------------------------------------------------------------------

def _segment_mer(ref_segment: str, hyp_segment: str) -> float:
    """Match Error Rate for a single aligned segment pair."""
    if ref_segment == "" and hyp_segment == "":
        return 0.0
    if ref_segment == "" or hyp_segment == "":
        return 1.0
    if ref_segment == hyp_segment:
        return 0.0
    try:
        import jiwer
        return float(jiwer.mer(ref_segment, hyp_segment))
    except ImportError:
        # Fallback: normalised edit distance at character level.
        dist = _char_edit_distance(ref_segment, hyp_segment)
        max_len = max(len(ref_segment), len(hyp_segment))
        return dist / max_len if max_len > 0 else 0.0


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def calculate_semascore(
    hypothesis: str,
    reference: str,
    device: str = "cpu",
) -> float:
    """Compute SeMaScore for *hypothesis* against *reference*.

    Parameters
    ----------
    hypothesis:
        The ASR system output.
    reference:
        The ground-truth transcript.
    device:
        PyTorch device string (``"cpu"``, ``"cuda"``, ``"mps"``).

    Returns
    -------
    float
        SeMaScore in ``[0, 1]``.  Higher is better.  Returns ``1.0`` for
        identical strings and ``0.0`` when either string is empty.
    """
    ref = re.sub(r"\s+", " ", reference.lower()).strip()
    hyp = re.sub(r"\s+", " ", hypothesis.lower()).strip()

    # Edge cases
    if ref == "" and hyp == "":
        return 1.0
    if ref == "" or hyp == "":
        return 0.0
    if ref == hyp:
        return 1.0

    tokenizer, model = _get_bert(device)

    ref_words = ref.split()
    hyp_words = hyp.split()

    # Phase 1: segment mapping
    aligned_pairs = _align_words(ref_words, hyp_words)

    if not aligned_pairs:
        return 0.0

    # Full-sentence embeddings (needed for importance weighting)
    ref_emb = _embed_sentence(ref, tokenizer, model, device)
    ref_emb_norm = float(np.linalg.norm(ref_emb))

    if ref_emb_norm < 1e-12:
        return 0.0

    scores: list[float] = []
    weights: list[float] = []

    for ref_seg, hyp_seg in aligned_pairs:
        # Skip empty pairs
        if not ref_seg and not hyp_seg:
            continue

        # Phase 2: per-segment scoring
        if ref_seg and hyp_seg:
            ref_seg_emb = _embed_sentence(ref_seg, tokenizer, model, device)
            hyp_seg_emb = _embed_sentence(hyp_seg, tokenizer, model, device)
            bert_cos = _cosine_similarity(ref_seg_emb, hyp_seg_emb)
        elif ref_seg:
            # Hypothesis is missing this segment -- deletion penalty
            ref_seg_emb = _embed_sentence(ref_seg, tokenizer, model, device)
            bert_cos = 0.0
        else:
            # Pure insertion -- no reference segment to compare against
            continue

        mer = _segment_mer(ref_seg, hyp_seg)
        segment_score = bert_cos * (1.0 - mer)

        # Phase 3: importance weighting
        seg_emb = _embed_sentence(ref_seg, tokenizer, model, device) if ref_seg else np.zeros_like(ref_emb)
        seg_norm = float(np.linalg.norm(seg_emb))
        importance = seg_norm / ref_emb_norm

        scores.append(segment_score)
        weights.append(importance)

    if not scores:
        return 0.0

    # Phase 4: aggregation (weighted mean)
    weights_arr = np.array(weights, dtype=np.float64)
    scores_arr = np.array(scores, dtype=np.float64)

    total_weight = weights_arr.sum()
    if total_weight < 1e-12:
        semascore = float(scores_arr.mean())
    else:
        semascore = float((scores_arr * weights_arr).sum() / total_weight)

    semascore = max(0.0, min(1.0, semascore))

    logger.debug("SeMaScore = %.4f (%d segments)", semascore, len(scores))
    return semascore
