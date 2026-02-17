"""Tests for voice_evals.asr.wer string metrics."""

import pytest
from voice_evals.asr.wer import (
    calculate_wer,
    calculate_cer,
    calculate_string_metrics,
    _normalize,
    _strip_fillers,
)

try:
    import jiwer  # noqa: F401
    _has_jiwer = True
except ImportError:
    _has_jiwer = False

requires_jiwer = pytest.mark.skipif(not _has_jiwer, reason="jiwer not installed")


class TestNormalize:
    def test_lowercase_and_strip(self):
        assert _normalize("  Hello  World  ") == "hello world"

    def test_collapse_whitespace(self):
        assert _normalize("a   b\tc") == "a b c"

    def test_empty_string(self):
        assert _normalize("") == ""


class TestStripFillers:
    def test_removes_fillers(self):
        result = _strip_fillers("um hello uh world", ["um", "uh"])
        assert result == "hello world"

    def test_word_boundary(self):
        result = _strip_fillers("unlike most people", ["like"])
        assert "unlike" in result

    def test_multi_word_filler(self):
        result = _strip_fillers("I you know went there", ["you know"])
        assert result == "I went there"


class TestCalculateWER:
    def test_perfect_match(self):
        assert calculate_wer("hello world", "hello world") == 0.0

    def test_case_insensitive(self):
        assert calculate_wer("Hello World", "hello world") == 0.0

    def test_both_empty(self):
        assert calculate_wer("", "") == 0.0

    def test_empty_hypothesis(self):
        assert calculate_wer("", "some reference") == 1.0

    def test_empty_reference(self):
        assert calculate_wer("some hypothesis", "") == 1.0

    @requires_jiwer
    def test_substitution(self):
        wer = calculate_wer("hello earth", "hello world")
        assert 0 < wer <= 1.0

    @requires_jiwer
    def test_complete_mismatch(self):
        wer = calculate_wer("foo bar", "hello world")
        assert wer == 1.0


class TestCalculateCER:
    def test_perfect_match(self):
        assert calculate_cer("hello", "hello") == 0.0

    def test_both_empty(self):
        assert calculate_cer("", "") == 0.0

    @requires_jiwer
    def test_some_errors(self):
        cer = calculate_cer("helo", "hello")
        assert 0 < cer < 1.0


class TestCalculateStringMetrics:
    @requires_jiwer
    def test_perfect_match(self):
        m = calculate_string_metrics("hello world", "hello world")
        assert m["wer"] == 0.0
        assert m["cer"] == 0.0
        assert m["word_accuracy"] == 1.0
        assert m["wip"] == 1.0
        assert m["wil"] == 0.0

    def test_both_empty(self):
        m = calculate_string_metrics("", "")
        assert m["wer"] == 0.0
        assert m["word_accuracy"] == 1.0

    def test_empty_ref(self):
        m = calculate_string_metrics("hello", "")
        assert m["wer"] == 1.0
        assert m["word_accuracy"] == 0.0

    @requires_jiwer
    def test_normalized_wer_removes_fillers(self):
        m = calculate_string_metrics("um hello uh world", "hello world")
        assert m["wer"] > 0  # raw WER sees fillers as extra words
        assert m["wer_normalized"] < m["wer"]  # normalized WER should be better

    @requires_jiwer
    def test_all_keys_present(self):
        m = calculate_string_metrics("hello world", "hello world")
        expected_keys = {"wer", "wer_normalized", "cer", "mer", "wip", "wil", "word_accuracy"}
        assert set(m.keys()) == expected_keys

    @requires_jiwer
    def test_partial_error(self):
        m = calculate_string_metrics("hello earth planet", "hello world")
        assert 0 < m["wer"] <= 2.0  # WER can exceed 1.0
        assert 0 <= m["word_accuracy"] <= 1.0
