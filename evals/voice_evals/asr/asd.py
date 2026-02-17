"""Aligned Semantic Distance (ASD).

ASD measures ASR quality by computing the optimal token-level alignment
between hypothesis and reference using contextual BERT embeddings and
dynamic programming.

Pipeline:
1. Tokenize both strings and extract per-token contextual embeddings
   from BERT.
2. Build a cost matrix of cosine distances between every reference token
   and every hypothesis token.
3. Run dynamic programming (modified DTW) to find the minimum-cost
   alignment.
4. ASD = mean aligned distance.
5. ASD similarity = 1 - ASD.

The BERT model/tokenizer are shared with :mod:`.semascore` when both are
used in the same process (they use the same ``_bert_cache``).
"""

from __future__ import annotations

import logging
import re
from typing import Any

import numpy as np

logger = logging.getLogger("voice_evals.asr.asd")

# Re-use the BERT cache from semascore to avoid loading the model twice.
# If semascore has not been imported yet, the cache will be populated here
# and semascore will find it later (and vice versa).
try:
    from .semascore import _bert_cache, _DEFAULT_BERT_MODEL
except ImportError:  # pragma: no cover -- defensive
    _bert_cache: dict[str, tuple[Any, Any]] = {}  # type: ignore[no-redef]
    _DEFAULT_BERT_MODEL = "bert-base-uncased"  # type: ignore[no-redef]


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
    """Return ``(tokenizer, model)`` for BERT, loading on first call.

    Shares the cache with :mod:`.semascore`.
    """
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
# Token embedding extraction
# ---------------------------------------------------------------------------

def _get_token_embeddings(
    text: str,
    tokenizer: Any,
    model: Any,
    device: str,
) -> np.ndarray:
    """Return per-token contextual BERT embeddings.

    Special tokens ([CLS], [SEP], [PAD]) are excluded.

    Returns
    -------
    np.ndarray
        Shape ``(num_tokens, hidden_dim)``.  Returns an empty
        ``(0, hidden_dim)`` array when *text* has no real tokens.
    """
    torch = _require_torch()

    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=512,
        padding=False,
    )
    inputs = {k: v.to(torch.device(device)) for k, v in inputs.items()}

    with torch.no_grad():
        outputs = model(**inputs)

    # last_hidden_state: (1, seq_len, hidden_dim)
    all_embeddings = outputs.last_hidden_state.squeeze(0).cpu().numpy()

    # Identify special token positions to exclude.
    special_ids = set(tokenizer.all_special_ids)
    input_ids = inputs["input_ids"].squeeze(0).cpu().tolist()

    mask = [tid not in special_ids for tid in input_ids]

    if not any(mask):
        hidden_dim = all_embeddings.shape[1]
        return np.empty((0, hidden_dim), dtype=np.float32)

    return all_embeddings[mask]


# ---------------------------------------------------------------------------
# Cost matrix & DP alignment
# ---------------------------------------------------------------------------

def _cosine_distance_matrix(
    ref_emb: np.ndarray,
    hyp_emb: np.ndarray,
) -> np.ndarray:
    """Compute pairwise cosine distance matrix.

    Parameters
    ----------
    ref_emb:
        Shape ``(R, D)`` -- reference token embeddings.
    hyp_emb:
        Shape ``(H, D)`` -- hypothesis token embeddings.

    Returns
    -------
    np.ndarray
        Shape ``(R, H)`` with values in ``[0, 2]``.
    """
    # Normalise to unit vectors.
    ref_norm = np.linalg.norm(ref_emb, axis=1, keepdims=True)
    hyp_norm = np.linalg.norm(hyp_emb, axis=1, keepdims=True)

    # Avoid division by zero.
    ref_norm = np.where(ref_norm < 1e-12, 1.0, ref_norm)
    hyp_norm = np.where(hyp_norm < 1e-12, 1.0, hyp_norm)

    ref_unit = ref_emb / ref_norm
    hyp_unit = hyp_emb / hyp_norm

    # Cosine similarity matrix (R, H), then convert to distance.
    sim_matrix = ref_unit @ hyp_unit.T
    # Clip for numerical safety.
    np.clip(sim_matrix, -1.0, 1.0, out=sim_matrix)
    return 1.0 - sim_matrix


def _dp_alignment(cost: np.ndarray) -> list[tuple[int, int]]:
    """Find the minimum-cost alignment via dynamic programming.

    Uses a modified DTW (Dynamic Time Warping) approach that allows:
    - match (diagonal move)
    - deletion (move down -- reference token unmatched)
    - insertion (move right -- hypothesis token unmatched)

    Parameters
    ----------
    cost:
        Shape ``(R, H)`` cost matrix.

    Returns
    -------
    list[tuple[int, int]]
        List of ``(ref_idx, hyp_idx)`` aligned pairs.
    """
    r, h = cost.shape

    # DP table: accumulated cost.
    dp = np.full((r + 1, h + 1), np.inf, dtype=np.float64)
    dp[0, 0] = 0.0

    # Initialise borders: deletion / insertion costs.
    # Using a constant penalty of 1.0 for unmatched tokens.
    for i in range(1, r + 1):
        dp[i, 0] = dp[i - 1, 0] + 1.0
    for j in range(1, h + 1):
        dp[0, j] = dp[0, j - 1] + 1.0

    for i in range(1, r + 1):
        for j in range(1, h + 1):
            match_cost = dp[i - 1, j - 1] + cost[i - 1, j - 1]
            delete_cost = dp[i - 1, j] + 1.0
            insert_cost = dp[i, j - 1] + 1.0
            dp[i, j] = min(match_cost, delete_cost, insert_cost)

    # Backtrack to recover the alignment path.
    i, j = r, h
    path: list[tuple[int, int]] = []

    while i > 0 or j > 0:
        if i > 0 and j > 0:
            diag = dp[i - 1, j - 1] + cost[i - 1, j - 1]
            up = dp[i - 1, j] + 1.0
            left = dp[i, j - 1] + 1.0
            min_val = min(diag, up, left)

            if min_val == diag:
                path.append((i - 1, j - 1))
                i -= 1
                j -= 1
            elif min_val == up:
                i -= 1
            else:
                j -= 1
        elif i > 0:
            i -= 1
        else:
            j -= 1

    path.reverse()
    return path


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def calculate_asd(
    hypothesis: str,
    reference: str,
    device: str = "cpu",
) -> dict:
    """Compute the Aligned Semantic Distance.

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
    dict
        Keys:

        - ``asd`` -- mean aligned cosine distance (lower is better).
        - ``asd_similarity`` -- ``1 - asd`` (higher is better).
        - ``num_matched`` -- number of aligned token pairs.

    Raises
    ------
    MissingDependencyError
        If ``transformers`` or ``torch`` is not installed.
    """
    ref = re.sub(r"\s+", " ", reference.lower()).strip()
    hyp = re.sub(r"\s+", " ", hypothesis.lower()).strip()

    # --- Edge cases ---
    if ref == "" and hyp == "":
        return {"asd": 0.0, "asd_similarity": 1.0, "num_matched": 0}

    if ref == "" or hyp == "":
        return {"asd": 1.0, "asd_similarity": 0.0, "num_matched": 0}

    if ref == hyp:
        return {"asd": 0.0, "asd_similarity": 1.0, "num_matched": 0}

    tokenizer, model = _get_bert(device)

    # Step 1: get per-token embeddings.
    ref_emb = _get_token_embeddings(ref, tokenizer, model, device)
    hyp_emb = _get_token_embeddings(hyp, tokenizer, model, device)

    if ref_emb.shape[0] == 0 or hyp_emb.shape[0] == 0:
        return {"asd": 1.0, "asd_similarity": 0.0, "num_matched": 0}

    # Step 2: cost matrix.
    cost_matrix = _cosine_distance_matrix(ref_emb, hyp_emb)

    # Step 3: DP alignment.
    alignment = _dp_alignment(cost_matrix)

    if not alignment:
        return {"asd": 1.0, "asd_similarity": 0.0, "num_matched": 0}

    # Step 4: compute ASD.
    aligned_distances = [cost_matrix[ri, hi] for ri, hi in alignment]
    num_ref_tokens = ref_emb.shape[0]

    total_distance = float(np.sum(aligned_distances))
    asd = total_distance / num_ref_tokens
    asd = max(0.0, min(1.0, asd))

    # Step 5: similarity.
    asd_similarity = 1.0 - asd

    logger.debug(
        "ASD = %.4f  (similarity=%.4f, %d matched, %d ref tokens)",
        asd, asd_similarity, len(alignment), num_ref_tokens,
    )

    return {
        "asd": asd,
        "asd_similarity": asd_similarity,
        "num_matched": len(alignment),
    }
