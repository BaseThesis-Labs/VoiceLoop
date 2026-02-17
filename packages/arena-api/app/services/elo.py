from app.config import settings


def compute_composite_score(metrics: dict) -> float:
    semascore = metrics.get("semascore") or 0
    if semascore < 0:
        semascore = 0
    wer = metrics.get("wer_score") or 1
    prosody = metrics.get("prosody_score") or 0
    # UTMOS is 1-5 scale; normalize to 0-1
    utmos = metrics.get("utmos")
    quality = (utmos - 1) / 4 if utmos is not None else 0
    latency = metrics.get("e2e_latency_ms") or 1000
    norm_latency = min(latency / 1000, 1.0)

    return (
        0.30 * semascore
        + 0.25 * (1 - wer)
        + 0.20 * prosody
        + 0.15 * quality
        + 0.10 * (1 - norm_latency)
    )


def determine_auto_winner(
    metrics_a: dict, metrics_b: dict, tie_threshold: float = 0.02
) -> str:
    score_a = compute_composite_score(metrics_a)
    score_b = compute_composite_score(metrics_b)
    diff = score_a - score_b
    if abs(diff) < tie_threshold:
        return "tie"
    return "a" if diff > 0 else "b"


def update_elo(
    rating_a: float, rating_b: float, outcome: str
) -> tuple[float, float, float]:
    k = settings.elo_k_factor
    score_a = 1.0 if outcome == "a" else (0.0 if outcome == "b" else 0.5)
    expected_a = 1 / (1 + 10 ** ((rating_b - rating_a) / 400))
    delta = k * (score_a - expected_a)
    return rating_a + delta, rating_b - delta, delta
