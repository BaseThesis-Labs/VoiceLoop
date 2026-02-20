"""Scoring and aggregation for experiment trials.

V1 uses latency-based metrics only. MOS prediction is a v2 addition.
"""
import logging
import struct
from statistics import mean, stdev

logger = logging.getLogger("arena.scoring")

# Weights for composite score (v1: latency-focused)
WEIGHTS = {
    "ttfb": 0.30,
    "gen_time": 0.25,
    "duration_accuracy": 0.20,
    "silence": 0.25,
}


def compute_silence_ratio(audio_path: str) -> float:
    """Compute fraction of audio that is silence (amplitude < threshold).

    Reads raw PCM samples from WAV file (skips 44-byte header).
    """
    try:
        with open(audio_path, "rb") as f:
            f.seek(44)
            raw = f.read()

        if len(raw) < 2:
            return 0.0

        num_samples = len(raw) // 2
        samples = struct.unpack(f"<{num_samples}h", raw[:num_samples * 2])

        threshold = 300
        silent_count = sum(1 for s in samples if abs(s) < threshold)
        return round(silent_count / num_samples, 4)
    except Exception as e:
        logger.warning("Failed to compute silence ratio: %s", e)
        return 0.0


def compute_trial_metrics(trial_dict: dict) -> dict:
    """Compute all v1 metrics for a single trial.

    Args:
        trial_dict: dict with keys audio_path, ttfb_ms, generation_time_ms, duration_seconds

    Returns:
        dict with silence_ratio added
    """
    silence = compute_silence_ratio(trial_dict["audio_path"])
    return {"silence_ratio": silence}


def aggregate_experiment_results(trials: list[dict]) -> dict:
    """Aggregate trial results into experiment-level rankings.

    Args:
        trials: list of dicts, each with keys:
            provider, voice_id, model_id, ttfb_ms, generation_time_ms,
            duration_seconds, silence_ratio, status

    Returns:
        dict with rankings, head_to_head, winner, confidence
    """
    by_model: dict[str, list[dict]] = {}
    for t in trials:
        if t["status"] != "completed":
            continue
        key = f"{t['provider']}:{t['voice_id']}"
        by_model.setdefault(key, []).append(t)

    if len(by_model) < 2:
        return {
            "rankings": [],
            "head_to_head": [],
            "winner": None,
            "confidence": "inconclusive",
        }

    rankings = []
    for key, model_trials in by_model.items():
        provider, voice_id = key.split(":", 1)
        model_id = model_trials[0]["model_id"]
        completed = [t for t in model_trials if t["status"] == "completed"]
        failed = len(model_trials) - len(completed)

        ttfbs = [t["ttfb_ms"] for t in completed if t["ttfb_ms"] is not None]
        gen_times = [t["generation_time_ms"] for t in completed if t["generation_time_ms"] is not None]
        durations = [t["duration_seconds"] for t in completed if t["duration_seconds"] is not None]
        silences = [t["silence_ratio"] for t in completed if t["silence_ratio"] is not None]

        norm_ttfb = 1.0 - min((mean(ttfbs) if ttfbs else 1000) / 2000, 1.0)
        norm_gen = 1.0 - min((mean(gen_times) if gen_times else 2000) / 5000, 1.0)
        norm_silence = 1.0 - (mean(silences) if silences else 0.5)
        norm_duration = 1.0 if durations else 0.0

        composite = (
            WEIGHTS["ttfb"] * norm_ttfb
            + WEIGHTS["gen_time"] * norm_gen
            + WEIGHTS["silence"] * norm_silence
            + WEIGHTS["duration_accuracy"] * norm_duration
        )

        rankings.append({
            "provider": provider,
            "voice_id": voice_id,
            "model_id": model_id,
            "trials_completed": len(completed),
            "trials_failed": failed,
            "avg_duration_seconds": round(mean(durations), 3) if durations else None,
            "avg_ttfb_ms": round(mean(ttfbs), 1) if ttfbs else None,
            "avg_generation_time_ms": round(mean(gen_times), 1) if gen_times else None,
            "avg_silence_ratio": round(mean(silences), 4) if silences else None,
            "composite_score": round(composite, 4),
        })

    rankings.sort(key=lambda r: r["composite_score"], reverse=True)

    # Head-to-head
    prompt_indices = set()
    for t in trials:
        if t["status"] == "completed":
            prompt_indices.add(t["prompt_index"])

    h2h_map: dict[tuple[str, str], dict] = {}
    keys = list(by_model.keys())
    for i in range(len(keys)):
        for j in range(i + 1, len(keys)):
            h2h_map[(keys[i], keys[j])] = {"a_wins": 0, "b_wins": 0, "ties": 0}

    for pi in prompt_indices:
        prompt_trials: dict[str, dict] = {}
        for t in trials:
            if t["status"] == "completed" and t["prompt_index"] == pi:
                key = f"{t['provider']}:{t['voice_id']}"
                prompt_trials[key] = t

        for i in range(len(keys)):
            for j in range(i + 1, len(keys)):
                a, b = keys[i], keys[j]
                if a not in prompt_trials or b not in prompt_trials:
                    continue
                ta, tb = prompt_trials[a], prompt_trials[b]
                score_a = (ta.get("ttfb_ms") or 9999) + (ta.get("generation_time_ms") or 9999)
                score_b = (tb.get("ttfb_ms") or 9999) + (tb.get("generation_time_ms") or 9999)
                pair = h2h_map[(a, b)]
                if abs(score_a - score_b) < 50:
                    pair["ties"] += 1
                elif score_a < score_b:
                    pair["a_wins"] += 1
                else:
                    pair["b_wins"] += 1

    head_to_head = [
        {"model_a": a, "model_b": b, "a_wins": v["a_wins"], "b_wins": v["b_wins"], "ties": v["ties"]}
        for (a, b), v in h2h_map.items()
    ]

    winner = None
    confidence = "inconclusive"
    if len(rankings) >= 2:
        top = rankings[0]
        second = rankings[1]
        gap = top["composite_score"] - second["composite_score"]
        if gap > 0.10:
            winner = f"{top['provider']}:{top['voice_id']}"
            confidence = "high"
        elif gap > 0.05:
            winner = f"{top['provider']}:{top['voice_id']}"
            confidence = "medium"
        elif gap > 0.02:
            winner = f"{top['provider']}:{top['voice_id']}"
            confidence = "low"

    return {
        "rankings": rankings,
        "head_to_head": head_to_head,
        "winner": winner,
        "confidence": confidence,
    }
