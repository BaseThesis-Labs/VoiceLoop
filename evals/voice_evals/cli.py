"""Command-line interface for voice-evals."""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="voice-evals",
        description="Comprehensive voice AI evaluation toolkit.",
    )
    parser.add_argument(
        "--version", action="store_true", help="Show version and exit.",
    )
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="Enable debug logging.",
    )
    parser.add_argument(
        "-q", "--quiet", action="store_true", help="Suppress info logging.",
    )

    subparsers = parser.add_subparsers(dest="command")

    # --- evaluate ---
    eval_p = subparsers.add_parser(
        "evaluate", help="Evaluate a single audio file.",
    )
    eval_p.add_argument("audio", help="Path to the audio file.")
    eval_p.add_argument(
        "--ground-truth", "-g", default=None,
        help="Ground truth transcript (text or file path).",
    )
    eval_p.add_argument(
        "--groups", nargs="+", default=None,
        choices=["asr", "tts", "agent", "latency"],
        help="Metric groups to evaluate (default: all).",
    )
    eval_p.add_argument(
        "--diarize", action="store_true",
        help="Enable speaker diarization.",
    )
    eval_p.add_argument(
        "--hf-token", default=None,
        help="HuggingFace token for diarization.",
    )
    eval_p.add_argument(
        "--speakers", type=int, default=None,
        help="Fixed speaker count (auto-detect if omitted).",
    )
    eval_p.add_argument(
        "--whisper-model", default="base",
        choices=["tiny", "base", "small", "medium", "large-v3"],
        help="Whisper model size (default: base).",
    )
    eval_p.add_argument(
        "--device", default="auto",
        help="Compute device: auto, cpu, cuda, mps (default: auto).",
    )
    eval_p.add_argument(
        "--output", "-o", default=None,
        help="Save results to a JSON file.",
    )
    eval_p.add_argument(
        "--format", "-f", default="table",
        choices=["table", "json", "full"],
        help="Output format (default: table).",
    )

    # --- batch ---
    batch_p = subparsers.add_parser(
        "batch", help="Evaluate a directory of audio files.",
    )
    batch_p.add_argument("directory", help="Directory containing audio files.")
    batch_p.add_argument(
        "--ground-truth", "-g", default=None,
        help="Directory with matching transcript files.",
    )
    batch_p.add_argument("--groups", nargs="+", default=None)
    batch_p.add_argument("--output", "-o", default=None)
    batch_p.add_argument("--device", default="auto")
    batch_p.add_argument("--whisper-model", default="base")

    # --- info ---
    subparsers.add_parser(
        "info", help="Show installed extras and available metrics.",
    )

    return parser


def _configure_logging(verbose: bool, quiet: bool) -> None:
    level = logging.WARNING if quiet else (logging.DEBUG if verbose else logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(levelname)s %(name)s: %(message)s",
        stream=sys.stderr,
    )


def _check_dep(module: str) -> bool:
    try:
        __import__(module)
        return True
    except ImportError:
        return False


def _cmd_info() -> None:
    from . import __version__

    print(f"voice-evals v{__version__}\n")
    print("Installed extras:")

    extras = {
        "asr": [("openai-whisper", "whisper"), ("jiwer", "jiwer"), ("transformers", "transformers")],
        "tts": [("torch", "torch"), ("torchaudio", "torchaudio")],
        "agent": [("openai", "openai")],
        "diarization": [("pyannote.audio", "pyannote.audio")],
    }

    for extra, deps in extras.items():
        all_ok = all(_check_dep(mod) for _, mod in deps)
        status = "\u2713" if all_ok else "\u2717"
        dep_names = ", ".join(name for name, _ in deps)
        install_hint = "" if all_ok else f"  (pip install voice-evals[{extra}])"
        print(f"  {status} {extra:<14} ({dep_names}){install_hint}")

    print("\nAvailable metrics:")
    groups = {
        "ASR": ["wer", "cer", "mer", "wip", "wil", "semascore", "saer", "asd"],
        "TTS": ["utmos", "nisqa", "dnsmos", "prosody", "secs", "emotion"],
        "Agent": ["task_success", "containment", "intent", "coherence", "error_recovery"],
        "Latency": ["rtfx", "percentiles", "ttft", "e2e"],
    }
    for group, metrics in groups.items():
        print(f"  {group:<10} {', '.join(metrics)}")


def _format_table(result: dict) -> str:
    lines: list[str] = []
    overall = result.get("overall_metrics", {})

    def section(title: str, items: list[tuple[str, str]]) -> None:
        if not items:
            return
        max_key = max(len(k) for k, _ in items)
        lines.append(f"\n  {title}")
        lines.append(f"  {'─' * (max_key + 20)}")
        for key, val in items:
            lines.append(f"  {key:<{max_key + 2}} {val}")

    # Audio
    section("Audio", [
        ("Duration", f"{overall.get('total_duration_seconds', 0):.1f}s"),
        ("SNR", f"{overall.get('snr_db', 0):.1f} dB"),
        ("Channels", str(overall.get("channels", "?"))),
    ])

    # ASR
    asr_items = []
    if "wer_score" in overall:
        asr_items.append(("WER", f"{overall['wer_score']:.1%}"))
    if "cer_score" in overall:
        asr_items.append(("CER", f"{overall['cer_score']:.1%}"))
    if "mer_score" in overall:
        asr_items.append(("MER", f"{overall['mer_score']:.2f}"))
    if overall.get("semascore") is not None:
        asr_items.append(("SeMaScore", f"{overall['semascore']:.3f}"))
    if overall.get("saer") is not None:
        asr_items.append(("SAER", f"{overall['saer']:.3f}"))
    if overall.get("asd") is not None:
        asr_items.append(("ASD", f"{overall['asd']:.3f}"))
    section("ASR Metrics", asr_items)

    # TTS
    tts_items = []
    if overall.get("utmos") is not None:
        tts_items.append(("UTMOS", f"{overall['utmos']:.2f} / 5.0"))
    if overall.get("nisqa_overall") is not None:
        tts_items.append(("NISQA", f"{overall['nisqa_overall']:.2f} / 5.0"))
    if overall.get("dnsmos_overall") is not None:
        tts_items.append(("DNSMOS", f"{overall['dnsmos_overall']:.2f} / 5.0"))
    if overall.get("prosody_score") is not None:
        tts_items.append(("Prosody", f"{overall['prosody_score']:.2f}"))
    if overall.get("secs") is not None:
        tts_items.append(("SECS", f"{overall['secs']:.3f}"))
    if overall.get("emotion") is not None:
        tts_items.append(("Emotion", str(overall["emotion"])))
    section("TTS Quality", tts_items)

    # Agent
    agent_items = []
    if overall.get("task_success") is not None:
        agent_items.append(("Task Success", str(overall["task_success"])))
    if overall.get("containment") is not None:
        agent_items.append(("Containment", str(overall["containment"])))
    if overall.get("coherence_score") is not None:
        agent_items.append(("Coherence", f"{overall['coherence_score']:.2f}"))
    section("Agent Metrics", agent_items)

    # Latency
    lat_items = []
    if overall.get("rtfx") is not None:
        lat_items.append(("RTFx", f"{overall['rtfx']:.2f}x"))
    if overall.get("ttft_ms") is not None:
        lat_items.append(("TTFT", f"{overall['ttft_ms']:.0f} ms"))
    if overall.get("e2e_latency_ms") is not None:
        lat_items.append(("E2E Latency", f"{overall['e2e_latency_ms']:.0f} ms"))
    section("Latency", lat_items)

    # Diarization
    n_speakers = result.get("num_speakers", 0)
    if n_speakers > 0:
        lines.append(f"\n  Diarization: {n_speakers} speaker(s)")
        timeline = result.get("diarization_timeline", "")
        if timeline:
            lines.append(f"  {timeline}")

    # Warnings
    warns = result.get("warnings", [])
    if warns:
        lines.append(f"\n  Warnings ({len(warns)}):")
        for w in warns[:5]:
            lines.append(f"    - {w}")
        if len(warns) > 5:
            lines.append(f"    ... and {len(warns) - 5} more")

    return "\n".join(lines)


def _cmd_evaluate(args: argparse.Namespace) -> None:
    from .config import EvalConfig
    from .pipeline import VoiceEvalPipeline

    config = EvalConfig(
        device=args.device,
        whisper_model=args.whisper_model,
    )
    pipeline = VoiceEvalPipeline(config=config)

    result = pipeline.evaluate(
        audio_path=args.audio,
        ground_truth=args.ground_truth,
        groups=args.groups,
        enable_diarization=args.diarize,
        hf_token=args.hf_token,
        num_speakers=args.speakers,
    )

    result_dict = result.to_dict()

    # Output
    if args.format == "json":
        output = json.dumps(result_dict, indent=2, ensure_ascii=False)
    elif args.format == "full":
        output = json.dumps(result_dict, indent=2, ensure_ascii=False)
    else:
        output = _format_table(result_dict)

    if args.output:
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        Path(args.output).write_text(
            json.dumps(result_dict, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        print(f"Results saved to {args.output}", file=sys.stderr)

    print(output)


def _cmd_batch(args: argparse.Namespace) -> None:
    from .config import EvalConfig
    from .pipeline import VoiceEvalPipeline

    audio_dir = Path(args.directory)
    if not audio_dir.is_dir():
        print(f"Error: {args.directory} is not a directory", file=sys.stderr)
        sys.exit(1)

    extensions = {".wav", ".mp3", ".flac", ".ogg", ".m4a"}
    audio_files = sorted(
        f for f in audio_dir.iterdir()
        if f.suffix.lower() in extensions
    )

    if not audio_files:
        print(f"No audio files found in {args.directory}", file=sys.stderr)
        sys.exit(1)

    config = EvalConfig(
        device=args.device,
        whisper_model=args.whisper_model,
    )
    pipeline = VoiceEvalPipeline(config=config)

    results = pipeline.evaluate_batch(
        [str(f) for f in audio_files],
        groups=args.groups,
    )

    for path, result in zip(audio_files, results):
        result_dict = result.to_dict()
        if args.output:
            out_dir = Path(args.output)
            out_dir.mkdir(parents=True, exist_ok=True)
            out_path = out_dir / f"{path.stem}_eval.json"
            out_path.write_text(
                json.dumps(result_dict, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
        else:
            print(f"\n{'=' * 60}")
            print(f"  {path.name}")
            print(f"{'=' * 60}")
            print(_format_table(result_dict))

    print(f"\nEvaluated {len(results)} file(s).", file=sys.stderr)


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()

    if args.version:
        from . import __version__
        print(f"voice-evals {__version__}")
        return

    _configure_logging(
        getattr(args, "verbose", False),
        getattr(args, "quiet", False),
    )

    if args.command == "evaluate":
        _cmd_evaluate(args)
    elif args.command == "batch":
        _cmd_batch(args)
    elif args.command == "info":
        _cmd_info()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
