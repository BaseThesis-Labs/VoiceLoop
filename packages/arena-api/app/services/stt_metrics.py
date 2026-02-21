"""STT metrics: WER, CER, and word-level diff computation."""


def compute_wer(reference: str, hypothesis: str) -> float:
    """Compute Word Error Rate using Levenshtein distance at word level.

    WER = (Substitutions + Deletions + Insertions) / Reference_Length
    Returns 0.0 for perfect match, >1.0 is possible if hypothesis is much longer.
    """
    ref_words = reference.lower().split()
    hyp_words = hypothesis.lower().split()

    if not ref_words:
        return 0.0 if not hyp_words else 1.0

    n = len(ref_words)
    m = len(hyp_words)
    dp = [[0] * (m + 1) for _ in range(n + 1)]

    for i in range(n + 1):
        dp[i][0] = i
    for j in range(m + 1):
        dp[0][j] = j

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if ref_words[i - 1] == hyp_words[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(
                    dp[i - 1][j],
                    dp[i][j - 1],
                    dp[i - 1][j - 1],
                )

    return dp[n][m] / n


def compute_cer(reference: str, hypothesis: str) -> float:
    """Compute Character Error Rate using Levenshtein distance at character level."""
    ref_chars = list(reference.lower())
    hyp_chars = list(hypothesis.lower())

    if not ref_chars:
        return 0.0 if not hyp_chars else 1.0

    n = len(ref_chars)
    m = len(hyp_chars)

    prev = list(range(m + 1))
    curr = [0] * (m + 1)

    for i in range(1, n + 1):
        curr[0] = i
        for j in range(1, m + 1):
            if ref_chars[i - 1] == hyp_chars[j - 1]:
                curr[j] = prev[j - 1]
            else:
                curr[j] = 1 + min(prev[j], curr[j - 1], prev[j - 1])
        prev, curr = curr, [0] * (m + 1)

    return prev[m] / n


def compute_word_diff(reference: str, hypothesis: str) -> list[dict]:
    """Compute word-level alignment diff between reference and hypothesis.

    Returns list of diff operations:
      - {"word": "hello", "type": "correct"}
      - {"word": "world", "ref_word": "word", "type": "substitution"}
      - {"word": "extra", "type": "insertion"}
      - {"ref_word": "missing", "type": "deletion"}
    """
    ref_words = reference.lower().split()
    hyp_words = hypothesis.lower().split()

    n = len(ref_words)
    m = len(hyp_words)

    dp = [[0] * (m + 1) for _ in range(n + 1)]
    ops = [[""] * (m + 1) for _ in range(n + 1)]

    for i in range(n + 1):
        dp[i][0] = i
        if i > 0:
            ops[i][0] = "delete"
    for j in range(m + 1):
        dp[0][j] = j
        if j > 0:
            ops[0][j] = "insert"

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if ref_words[i - 1] == hyp_words[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
                ops[i][j] = "match"
            else:
                costs = [
                    (dp[i - 1][j - 1] + 1, "substitute"),
                    (dp[i - 1][j] + 1, "delete"),
                    (dp[i][j - 1] + 1, "insert"),
                ]
                dp[i][j], ops[i][j] = min(costs, key=lambda x: x[0])

    diff = []
    i, j = n, m
    while i > 0 or j > 0:
        op = ops[i][j]
        if op == "match":
            diff.append({"word": hyp_words[j - 1], "type": "correct"})
            i -= 1
            j -= 1
        elif op == "substitute":
            diff.append({"word": hyp_words[j - 1], "ref_word": ref_words[i - 1], "type": "substitution"})
            i -= 1
            j -= 1
        elif op == "delete":
            diff.append({"ref_word": ref_words[i - 1], "type": "deletion"})
            i -= 1
        elif op == "insert":
            diff.append({"word": hyp_words[j - 1], "type": "insertion"})
            j -= 1
        else:
            break

    diff.reverse()
    return diff
