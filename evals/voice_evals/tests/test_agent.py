"""Tests for voice_evals.agent subpackage."""

import pytest
from voice_evals.agent.intent import evaluate_intent_accuracy, evaluate_slot_accuracy
from voice_evals.agent.task_success import evaluate_containment, _parse_json_response


class TestEvaluateIntentAccuracy:
    def test_exact_match(self):
        result = evaluate_intent_accuracy("book_flight", "book_flight")
        assert result["correct"] is True

    def test_case_insensitive(self):
        result = evaluate_intent_accuracy("Book_Flight", "book_flight")
        assert result["correct"] is True

    def test_whitespace_stripped(self):
        result = evaluate_intent_accuracy("  book_flight  ", "book_flight")
        assert result["correct"] is True

    def test_mismatch(self):
        result = evaluate_intent_accuracy("cancel_flight", "book_flight")
        assert result["correct"] is False
        assert result["predicted"] == "cancel_flight"
        assert result["expected"] == "book_flight"


class TestEvaluateSlotAccuracy:
    def test_perfect_match(self):
        pred = {"city": "New York", "date": "2024-01-15"}
        exp = {"city": "New York", "date": "2024-01-15"}
        result = evaluate_slot_accuracy(pred, exp)
        assert result["joint_goal_accuracy"] == 1.0
        assert result["num_correct"] == 2

    def test_missing_slot(self):
        pred = {"city": "New York"}
        exp = {"city": "New York", "date": "2024-01-15"}
        result = evaluate_slot_accuracy(pred, exp)
        assert result["joint_goal_accuracy"] == 0.0
        assert result["num_correct"] == 1

    def test_wrong_value(self):
        pred = {"city": "Boston", "date": "2024-01-15"}
        exp = {"city": "New York", "date": "2024-01-15"}
        result = evaluate_slot_accuracy(pred, exp)
        assert result["joint_goal_accuracy"] == 0.0
        assert result["slot_details"]["city"]["error"] == "value_mismatch"

    def test_extra_slots_ignored_for_jga(self):
        pred = {"city": "New York", "airline": "Delta"}
        exp = {"city": "New York"}
        result = evaluate_slot_accuracy(pred, exp)
        assert result["joint_goal_accuracy"] == 1.0
        assert result["slot_details"]["airline"]["error"] == "unexpected_slot"

    def test_empty_expected(self):
        result = evaluate_slot_accuracy({"city": "NY"}, {})
        assert result["joint_goal_accuracy"] == 1.0

    def test_empty_both(self):
        result = evaluate_slot_accuracy({}, {})
        assert result["joint_goal_accuracy"] == 1.0

    def test_slot_f1(self):
        pred = {"city": "New York", "date": "2024-01-15"}
        exp = {"city": "New York", "date": "2024-01-15", "time": "10:00"}
        result = evaluate_slot_accuracy(pred, exp)
        assert 0 < result["slot_f1"] < 1.0


class TestEvaluateContainment:
    def test_contained(self):
        transcript = "Agent: How can I help you?\nUser: I need to check my balance."
        result = evaluate_containment(transcript)
        assert result["contained"] is True
        assert result["escalation_detected"] is False

    def test_escalated(self):
        transcript = "Agent: Let me transfer you to a human representative."
        result = evaluate_containment(transcript)
        assert result["contained"] is False
        assert result["escalation_detected"] is True
        assert result["escalation_reason"] is not None

    def test_empty_transcript(self):
        result = evaluate_containment("")
        assert result["contained"] is True

    def test_custom_phrases(self):
        transcript = "Please wait while I get my supervisor."
        result = evaluate_containment(transcript, escalation_phrases=["get my supervisor"])
        assert result["contained"] is False


class TestParseJsonResponse:
    def test_plain_json(self):
        result = _parse_json_response('{"task_success": true, "confidence": 0.9}')
        assert result["task_success"] is True

    def test_markdown_fenced_json(self):
        raw = '```json\n{"task_success": true}\n```'
        result = _parse_json_response(raw)
        assert result["task_success"] is True

    def test_invalid_json(self):
        result = _parse_json_response("not json at all")
        assert result == {}
