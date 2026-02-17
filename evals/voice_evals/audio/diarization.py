"""Speaker diarization via Pyannote.audio."""

from __future__ import annotations

import logging
import os
from pathlib import Path

from ..exceptions import AuthenticationError, MissingDependencyError
from ..types import AudioData, DiarizationResult, SpeakerInfo
from .loader import ensure_audio

logger = logging.getLogger("voice_evals.audio.diarization")


def _resolve_hf_token(hf_token: str | None) -> str:
    """Return a HuggingFace token from the explicit parameter or environment.

    Raises
    ------
    AuthenticationError
        If no token can be found.
    """
    if hf_token:
        return hf_token

    for var in ("HF_TOKEN", "HUGGINGFACE_TOKEN"):
        token = os.environ.get(var)
        if token:
            logger.debug("Using HuggingFace token from $%s", var)
            return token

    raise AuthenticationError(
        "A HuggingFace token is required for speaker diarization. "
        "Provide it via the hf_token parameter, or set the HF_TOKEN or "
        "HUGGINGFACE_TOKEN environment variable. "
        "You can create a token at https://huggingface.co/settings/tokens"
    )


def _ensure_path(audio: AudioData | str) -> str:
    """Return a filesystem path string from either type.

    Pyannote requires a file path (not raw samples), so if only an
    ``AudioData`` is given we use its stored ``path`` attribute.
    """
    if isinstance(audio, str):
        return audio
    if not audio.path:
        raise ValueError(
            "AudioData.path is empty — diarization requires an on-disk file."
        )
    return audio.path


def _build_timeline(
    annotation: object,  # pyannote.core.Annotation
    total_duration: float,
    width: int = 80,
) -> str:
    """Build an ASCII timeline visualisation of speaker turns.

    Each speaker gets a row showing when they are speaking using block
    characters.

    Parameters
    ----------
    annotation:
        A ``pyannote.core.Annotation`` object.
    total_duration:
        Total audio duration in seconds (used for scaling).
    width:
        Character width of the timeline.

    Returns
    -------
    str
        Multi-line string with one row per speaker plus a time axis.
    """
    if total_duration <= 0:
        return ""

    # Collect speakers and their turns.
    speakers: dict[str, list[tuple[float, float]]] = {}
    for segment, _, speaker in annotation.itertracks(yield_label=True):  # type: ignore[attr-defined]
        speakers.setdefault(speaker, []).append((segment.start, segment.end))

    if not speakers:
        return "(no speakers detected)"

    lines: list[str] = []
    label_width = max(len(s) for s in speakers) + 1

    for speaker in sorted(speakers):
        row = [" "] * width
        for start, end in speakers[speaker]:
            col_start = int(start / total_duration * width)
            col_end = int(end / total_duration * width)
            col_start = max(0, min(col_start, width - 1))
            col_end = max(col_start + 1, min(col_end, width))
            for c in range(col_start, col_end):
                row[c] = "\u2588"  # full block
        lines.append(f"{speaker:<{label_width}}|{''.join(row)}|")

    # Time axis.
    axis = f"{'':<{label_width}}|"
    mid = total_duration / 2
    mid_str = f"{mid:.1f}s"
    end_str = f"{total_duration:.1f}s"
    # Place markers at 0, midpoint, and end.
    axis_row = ["─"] * width
    axis_row[0] = "0"
    mid_pos = width // 2
    for i, ch in enumerate(mid_str):
        if mid_pos + i < width:
            axis_row[mid_pos + i] = ch
    end_pos = max(0, width - len(end_str))
    for i, ch in enumerate(end_str):
        if end_pos + i < width:
            axis_row[end_pos + i] = ch

    lines.append(f"{'':<{label_width}}|{''.join(axis_row)}|")

    return "\n".join(lines)


def diarize(
    audio: AudioData | str,
    hf_token: str | None = None,
    num_speakers: int | None = None,
    min_speakers: int = 1,
    max_speakers: int = 10,
) -> DiarizationResult:
    """Run speaker diarization on an audio file.

    Requires ``pyannote.audio`` to be installed::

        pip install voice-evals[diarization]

    Parameters
    ----------
    audio:
        File path (``str``) or a pre-loaded ``AudioData`` instance.
        Pyannote requires an on-disk file so the path is always used.
    hf_token:
        HuggingFace API token with access to the pyannote models.
        Falls back to ``$HF_TOKEN`` / ``$HUGGINGFACE_TOKEN`` env vars.
    num_speakers:
        Exact number of speakers if known.  ``None`` means auto-detect
        within ``(min_speakers, max_speakers)``.
    min_speakers:
        Minimum expected number of speakers (default 1).
    max_speakers:
        Maximum expected number of speakers (default 10).

    Returns
    -------
    DiarizationResult
        Contains per-speaker statistics and an ASCII timeline.

    Raises
    ------
    MissingDependencyError
        If ``pyannote.audio`` is not installed.
    AuthenticationError
        If no valid HuggingFace token is available.
    """
    # Lazy import — pyannote is a heavy optional dependency.
    try:
        from pyannote.audio import Pipeline as PyannotePipeline  # type: ignore[import-untyped]
    except ImportError:
        raise MissingDependencyError("pyannote.audio", "diarization")

    token = _resolve_hf_token(hf_token)
    audio_path = _ensure_path(audio)

    if not Path(audio_path).exists():
        from ..exceptions import AudioLoadError
        raise AudioLoadError(f"Audio file not found: {audio_path}")

    logger.info("Loading pyannote diarization pipeline...")
    pipeline = PyannotePipeline.from_pretrained(
        "pyannote/speaker-diarization-3.1",
        use_auth_token=token,
    )

    # Build kwargs for the pipeline.
    pipeline_kwargs: dict[str, object] = {}
    if num_speakers is not None:
        pipeline_kwargs["num_speakers"] = num_speakers
    else:
        pipeline_kwargs["min_speakers"] = min_speakers
        pipeline_kwargs["max_speakers"] = max_speakers

    logger.info(
        "Running diarization on '%s' (num_speakers=%s, min=%d, max=%d)...",
        audio_path,
        num_speakers,
        min_speakers,
        max_speakers,
    )
    annotation = pipeline(audio_path, **pipeline_kwargs)

    # Compute per-speaker statistics from the annotation.
    # Get total audio duration.
    audio_data = ensure_audio(audio)
    total_duration = audio_data.duration

    speaker_turns: dict[str, list[tuple[float, float]]] = {}
    for segment, _, speaker in annotation.itertracks(yield_label=True):
        speaker_turns.setdefault(speaker, []).append(
            (float(segment.start), float(segment.end))
        )

    speakers: list[SpeakerInfo] = []
    for speaker_id in sorted(speaker_turns):
        turns = speaker_turns[speaker_id]
        speaking_time = sum(end - start for start, end in turns)
        n_turns = len(turns)
        avg_turn = speaking_time / n_turns if n_turns > 0 else 0.0
        pct = (speaking_time / total_duration * 100.0) if total_duration > 0 else 0.0

        speakers.append(
            SpeakerInfo(
                speaker_id=speaker_id,
                speaking_time=round(speaking_time, 3),
                speaking_percentage=round(pct, 2),
                num_turns=n_turns,
                avg_turn_duration=round(avg_turn, 3),
                words_per_minute=None,  # requires ASR output
            )
        )

    timeline = _build_timeline(annotation, total_duration)

    result = DiarizationResult(
        num_speakers=len(speakers),
        speakers=speakers,
        timeline=timeline,
    )

    logger.info(
        "Diarization complete: %d speaker(s) detected in %.1fs of audio",
        result.num_speakers,
        total_duration,
    )

    return result
