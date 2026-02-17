"""Smoke tests for voice_evals.cli."""

import sys
from unittest.mock import patch

import pytest

from voice_evals.cli import _build_parser, _configure_logging, _cmd_info, _format_table


class TestBuildParser:
    def test_parser_created(self):
        parser = _build_parser()
        assert parser.prog == "voice-evals"

    def test_version_flag(self):
        parser = _build_parser()
        args = parser.parse_args(["--version"])
        assert args.version is True

    def test_verbose_flag(self):
        parser = _build_parser()
        args = parser.parse_args(["-v"])
        assert args.verbose is True

    def test_quiet_flag(self):
        parser = _build_parser()
        args = parser.parse_args(["-q"])
        assert args.quiet is True

    def test_evaluate_command(self):
        parser = _build_parser()
        args = parser.parse_args(["evaluate", "test.wav"])
        assert args.command == "evaluate"
        assert args.audio == "test.wav"

    def test_evaluate_with_options(self):
        parser = _build_parser()
        args = parser.parse_args([
            "evaluate", "test.wav",
            "--ground-truth", "ref.txt",
            "--groups", "asr", "tts",
            "--format", "json",
            "--output", "result.json",
        ])
        assert args.command == "evaluate"
        assert args.ground_truth == "ref.txt"
        assert args.groups == ["asr", "tts"]
        assert args.format == "json"
        assert args.output == "result.json"

    def test_batch_command(self):
        parser = _build_parser()
        args = parser.parse_args(["batch", "/audio/dir"])
        assert args.command == "batch"
        assert args.directory == "/audio/dir"

    def test_info_command(self):
        parser = _build_parser()
        args = parser.parse_args(["info"])
        assert args.command == "info"

    def test_no_command(self):
        parser = _build_parser()
        args = parser.parse_args([])
        assert args.command is None


class TestConfigureLogging:
    def test_default_level(self):
        _configure_logging(verbose=False, quiet=False)

    def test_verbose_level(self):
        _configure_logging(verbose=True, quiet=False)

    def test_quiet_level(self):
        _configure_logging(verbose=False, quiet=True)


class TestCmdInfo:
    def test_info_runs(self, capsys):
        _cmd_info()
        captured = capsys.readouterr()
        assert "voice-evals" in captured.out
        assert "Installed extras:" in captured.out
        assert "Available metrics:" in captured.out
        assert "ASR" in captured.out


class TestFormatTable:
    def test_basic_table(self):
        result_dict = {
            "overall_metrics": {
                "total_duration_seconds": 5.0,
                "snr_db": 25.0,
                "channels": 1,
                "wer_score": 0.15,
                "cer_score": 0.08,
            },
            "num_speakers": 0,
            "warnings": [],
        }
        output = _format_table(result_dict)
        assert "Duration" in output
        assert "WER" in output
        assert "CER" in output

    def test_empty_metrics(self):
        result_dict = {
            "overall_metrics": {},
            "num_speakers": 0,
            "warnings": [],
        }
        output = _format_table(result_dict)
        assert isinstance(output, str)

    def test_with_warnings(self):
        result_dict = {
            "overall_metrics": {
                "total_duration_seconds": 1.0,
                "snr_db": 10.0,
                "channels": 1,
            },
            "num_speakers": 0,
            "warnings": ["test warning 1", "test warning 2"],
        }
        output = _format_table(result_dict)
        assert "Warnings" in output
        assert "test warning 1" in output
