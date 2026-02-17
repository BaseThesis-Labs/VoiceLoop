"""Voice evaluation pipeline orchestrator."""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any

from .config import EvalConfig
from .exceptions import MissingDependencyError
from .types import (
    ASRMetrics,
    AgentMetrics,
    AudioInfo,
    DiarizationResult,
    EvalResult,
    LatencyMetrics,
    TTSMetrics,
)

logger = logging.getLogger("voice_evals.pipeline")

ALL_GROUPS = ("asr", "tts", "agent", "latency")


class VoiceEvalPipeline:
    """Orchestrates evaluation across metric groups.

    Usage::

        pipeline = VoiceEvalPipeline()
        result = pipeline.evaluate("audio.wav", ground_truth="ref.txt")
        result.to_dict()   # for arena-api
    """

    def __init__(self, config: EvalConfig | None = None) -> None:
        self.config = config or EvalConfig()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def evaluate(
        self,
        audio_path: str,
        ground_truth: str | None = None,
        groups: list[str] | None = None,
        enable_diarization: bool = False,
        hf_token: str | None = None,
        num_speakers: int | None = None,
        # Agent evaluation context
        expected_intent: str | None = None,
        expected_slots: dict[str, str] | None = None,
        task_description: str | None = None,
        expected_outcome: str | None = None,
        # Latency timestamps (if available externally)
        timestamps: dict[str, float] | None = None,
    ) -> EvalResult:
        """Run the evaluation pipeline.

        Parameters
        ----------
        audio_path:
            Path to the audio file.
        ground_truth:
            Ground truth transcript (text string or path to .txt file).
        groups:
            Which metric groups to run: ``["asr", "tts", "agent", "latency"]``.
            Defaults to all groups.
        enable_diarization:
            Whether to run speaker diarization.
        hf_token:
            HuggingFace token for diarization models.
        num_speakers:
            Fixed speaker count (``None`` for auto-detect).
        expected_intent:
            Expected intent label (for agent intent accuracy).
        expected_slots:
            Expected slot values (for agent slot filling accuracy).
        task_description:
            Description of what the agent should accomplish.
        expected_outcome:
            Expected outcome for task success evaluation.
        timestamps:
            External pipeline timestamps for latency metrics.

        Returns
        -------
        EvalResult
            Complete evaluation results.
        """
        requested_groups = set(ALL_GROUPS if groups is None else groups)
        warnings: list[str] = []
        device = self.config.resolve_device()

        # --- Load audio ---
        from .audio.loader import load_audio
        from .audio.snr import calculate_snr

        audio_data = load_audio(audio_path)
        snr = calculate_snr(audio_data)

        audio_info = AudioInfo(
            duration_seconds=audio_data.duration,
            sample_rate=audio_data.sample_rate,
            channels=audio_data.channels,
            snr_db=snr,
            is_stereo=audio_data.channels >= 2,
        )

        # --- Resolve ground truth ---
        gt_text = self._resolve_ground_truth(ground_truth)

        # --- Diarization ---
        diarization: DiarizationResult | None = None
        if enable_diarization:
            diarization = self._run_diarization(
                audio_path, hf_token, num_speakers, warnings,
            )

        # --- ASR ---
        asr: ASRMetrics | None = None
        if "asr" in requested_groups:
            asr = self._run_asr(audio_path, gt_text, device, warnings)

        # --- TTS ---
        tts: TTSMetrics | None = None
        if "tts" in requested_groups:
            tts = self._run_tts(audio_path, audio_data, device, warnings)

        # --- Agent ---
        agent: AgentMetrics | None = None
        if "agent" in requested_groups:
            transcript = asr.transcript if asr else None
            agent = self._run_agent(
                transcript, expected_intent, expected_slots,
                task_description, expected_outcome, warnings,
            )

        # --- Latency ---
        latency: LatencyMetrics | None = None
        if "latency" in requested_groups:
            latency = self._run_latency(
                audio_data.duration, timestamps, warnings,
            )

        return EvalResult(
            audio=audio_info,
            asr=asr,
            tts=tts,
            agent=agent,
            latency=latency,
            diarization=diarization,
            warnings=warnings,
        )

    def evaluate_batch(
        self,
        audio_paths: list[str],
        **kwargs: Any,
    ) -> list[EvalResult]:
        """Evaluate multiple audio files.

        Useful for computing aggregate metrics like latency percentiles
        and task success rate.
        """
        results: list[EvalResult] = []
        for i, path in enumerate(audio_paths):
            logger.info("Evaluating %d/%d: %s", i + 1, len(audio_paths), path)
            result = self.evaluate(path, **kwargs)
            results.append(result)
        return results

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _resolve_ground_truth(self, ground_truth: str | None) -> str | None:
        """Resolve ground truth to a text string."""
        if ground_truth is None:
            return None
        # If it looks like a file path, read it
        if Path(ground_truth).is_file():
            return Path(ground_truth).read_text(encoding="utf-8").strip()
        return ground_truth

    def _run_diarization(
        self,
        audio_path: str,
        hf_token: str | None,
        num_speakers: int | None,
        warnings: list[str],
    ) -> DiarizationResult | None:
        try:
            from .audio.diarization import diarize
            return diarize(
                audio_path,
                hf_token=hf_token,
                num_speakers=num_speakers,
            )
        except MissingDependencyError as e:
            warnings.append(f"Diarization skipped: {e}")
            logger.warning("Diarization skipped: %s", e)
            return None
        except Exception as e:
            warnings.append(f"Diarization failed: {e}")
            logger.exception("Diarization failed")
            return None

    def _run_asr(
        self,
        audio_path: str,
        gt_text: str | None,
        device: str,
        warnings: list[str],
    ) -> ASRMetrics | None:
        try:
            # Transcription
            transcript = ""
            try:
                from .asr.transcription import transcribe
                transcript = transcribe(
                    audio_path,
                    model_name=self.config.whisper_model,
                    device=device,
                )
            except MissingDependencyError as e:
                warnings.append(f"Transcription skipped: {e}")
                logger.warning("Transcription skipped: %s", e)
                if gt_text is None:
                    warnings.append("ASR skipped: no transcript and no ground truth")
                    return None

            # String metrics
            wer = wer_norm = cer = mer = wip = wil = word_acc = 0.0
            if gt_text:
                try:
                    from .asr.wer import calculate_string_metrics
                    ref = gt_text
                    hyp = transcript or ""
                    metrics = calculate_string_metrics(
                        hyp, ref, filler_words=self.config.wer_filler_words,
                    )
                    wer = metrics["wer"]
                    wer_norm = metrics["wer_normalized"]
                    cer = metrics["cer"]
                    mer = metrics["mer"]
                    wip = metrics["wip"]
                    wil = metrics["wil"]
                    word_acc = metrics["word_accuracy"]
                except MissingDependencyError as e:
                    warnings.append(f"String metrics skipped: {e}")
                    logger.warning("String metrics skipped: %s", e)

            # Semantic metrics
            semascore = saer = saer_f = saer_e = asd = asd_sim = None
            if gt_text and transcript:
                # SeMaScore
                try:
                    from .asr.semascore import calculate_semascore
                    semascore = calculate_semascore(transcript, gt_text, device=device)
                except (MissingDependencyError, Exception) as e:
                    warnings.append(f"SeMaScore skipped: {e}")
                    logger.warning("SeMaScore skipped: %s", e)

                # SAER
                try:
                    from .asr.saer import calculate_saer
                    saer_result = calculate_saer(
                        transcript, gt_text,
                        lambda_=self.config.saer_lambda,
                        device=device,
                    )
                    saer = saer_result["saer"]
                    saer_f = saer_result["f_form"]
                    saer_e = saer_result["epsilon_sem"]
                except (MissingDependencyError, Exception) as e:
                    warnings.append(f"SAER skipped: {e}")
                    logger.warning("SAER skipped: %s", e)

                # ASD
                try:
                    from .asr.asd import calculate_asd
                    asd_result = calculate_asd(transcript, gt_text, device=device)
                    asd = asd_result["asd"]
                    asd_sim = asd_result["asd_similarity"]
                except (MissingDependencyError, Exception) as e:
                    warnings.append(f"ASD skipped: {e}")
                    logger.warning("ASD skipped: %s", e)

            return ASRMetrics(
                transcript=transcript,
                wer=wer,
                wer_normalized=wer_norm,
                cer=cer,
                mer=mer,
                wip=wip,
                wil=wil,
                word_accuracy=word_acc,
                semascore=semascore,
                saer=saer,
                saer_f_form=saer_f,
                saer_epsilon_sem=saer_e,
                asd=asd,
                asd_similarity=asd_sim,
            )
        except Exception as e:
            warnings.append(f"ASR evaluation failed: {e}")
            logger.exception("ASR evaluation failed")
            return None

    def _run_tts(
        self,
        audio_path: str,
        audio_data: Any,
        device: str,
        warnings: list[str],
    ) -> TTSMetrics | None:
        try:
            utmos = nisqa_o = nisqa_n = nisqa_c = nisqa_d = nisqa_l = None
            dnsmos_o = dnsmos_s = dnsmos_b = None
            f0_rmse = secs = None
            emotion = None
            emotion_scores = None
            prosody_score = pitch_std = monotone = pace_std = pace_score = intonation = None

            # UTMOS
            try:
                from .tts.utmos import calculate_utmos
                utmos = calculate_utmos(audio_path, device=device)
            except (MissingDependencyError, Exception) as e:
                warnings.append(f"UTMOS skipped: {e}")
                logger.warning("UTMOS skipped: %s", e)

            # NISQA
            try:
                from .tts.nisqa import calculate_nisqa
                nisqa = calculate_nisqa(audio_path, device=device)
                nisqa_o = nisqa.get("nisqa_overall")
                nisqa_n = nisqa.get("nisqa_noisiness")
                nisqa_c = nisqa.get("nisqa_coloration")
                nisqa_d = nisqa.get("nisqa_discontinuity")
                nisqa_l = nisqa.get("nisqa_loudness")
            except (MissingDependencyError, Exception) as e:
                warnings.append(f"NISQA skipped: {e}")
                logger.warning("NISQA skipped: %s", e)

            # DNSMOS
            try:
                from .tts.dnsmos import calculate_dnsmos
                dnsmos = calculate_dnsmos(audio_path, device=device)
                dnsmos_o = dnsmos.get("dnsmos_overall")
                dnsmos_s = dnsmos.get("dnsmos_signal")
                dnsmos_b = dnsmos.get("dnsmos_background")
            except (MissingDependencyError, Exception) as e:
                warnings.append(f"DNSMOS skipped: {e}")
                logger.warning("DNSMOS skipped: %s", e)

            # Prosody
            try:
                from .tts.prosody import analyze_prosody
                prosody = analyze_prosody(audio_data)
                f0_rmse = prosody.get("f0_rmse")
                pitch_std = prosody.get("pitch_std_hz")
                monotone = prosody.get("monotone_score")
                pace_std = prosody.get("pace_std")
                pace_score = prosody.get("pace_score")
                intonation = prosody.get("intonation_score")
                prosody_score = prosody.get("prosody_score")
            except (MissingDependencyError, Exception) as e:
                warnings.append(f"Prosody skipped: {e}")
                logger.warning("Prosody skipped: %s", e)

            # Emotion
            try:
                from .tts.emotion import detect_emotion
                emo = detect_emotion(audio_path, device=device)
                emotion = emo.get("emotion")
                emotion_scores = emo.get("emotion_scores")
            except (MissingDependencyError, Exception) as e:
                warnings.append(f"Emotion skipped: {e}")
                logger.warning("Emotion skipped: %s", e)

            return TTSMetrics(
                utmos=utmos,
                nisqa_overall=nisqa_o,
                nisqa_noisiness=nisqa_n,
                nisqa_coloration=nisqa_c,
                nisqa_discontinuity=nisqa_d,
                nisqa_loudness=nisqa_l,
                dnsmos_overall=dnsmos_o,
                dnsmos_signal=dnsmos_s,
                dnsmos_background=dnsmos_b,
                f0_rmse=f0_rmse,
                secs=secs,
                emotion=emotion,
                emotion_scores=emotion_scores,
                prosody_score=prosody_score,
                pitch_std_hz=pitch_std,
                monotone_score=monotone,
                pace_std=pace_std,
                pace_score=pace_score,
                intonation_score=intonation,
            )
        except Exception as e:
            warnings.append(f"TTS evaluation failed: {e}")
            logger.exception("TTS evaluation failed")
            return None

    def _run_agent(
        self,
        transcript: str | None,
        expected_intent: str | None,
        expected_slots: dict[str, str] | None,
        task_description: str | None,
        expected_outcome: str | None,
        warnings: list[str],
    ) -> AgentMetrics | None:
        if not transcript:
            warnings.append("Agent evaluation skipped: no transcript available")
            return None

        try:
            task_success = containment = None
            intent_acc = slot_acc = coherence = None
            error_detected = error_recovered = recovery_rate = None

            # Task success
            if expected_outcome:
                try:
                    from .agent.task_success import evaluate_task_success
                    ts = evaluate_task_success(transcript, expected_outcome, task_description)
                    task_success = ts.get("task_success")
                except (MissingDependencyError, Exception) as e:
                    warnings.append(f"Task success skipped: {e}")

            # Containment
            try:
                from .agent.task_success import evaluate_containment
                cont = evaluate_containment(transcript)
                containment = cont.get("contained")
            except Exception as e:
                warnings.append(f"Containment skipped: {e}")

            # Intent accuracy
            if expected_intent:
                try:
                    from .agent.intent import evaluate_intent_accuracy
                    # Would need predicted intent from NLU — skip if not available
                    pass
                except Exception:
                    pass

            # Slot accuracy
            if expected_slots:
                try:
                    from .agent.intent import evaluate_slot_accuracy
                    # Would need predicted slots from NLU — skip if not available
                    pass
                except Exception:
                    pass

            # Coherence
            try:
                from .agent.dialogue import evaluate_coherence
                coh = evaluate_coherence(transcript)
                coherence = coh.get("coherence_score")
            except (MissingDependencyError, Exception) as e:
                warnings.append(f"Coherence skipped: {e}")

            # Error recovery
            try:
                from .agent.error_recovery import evaluate_error_recovery
                err = evaluate_error_recovery(transcript)
                error_detected = err.get("error_detected")
                error_recovered = err.get("error_recovered")
            except (MissingDependencyError, Exception) as e:
                warnings.append(f"Error recovery skipped: {e}")

            return AgentMetrics(
                task_success=task_success,
                containment=containment,
                intent_accuracy=intent_acc,
                slot_accuracy=slot_acc,
                coherence_score=coherence,
                error_detected=error_detected,
                error_recovered=error_recovered,
            )
        except Exception as e:
            warnings.append(f"Agent evaluation failed: {e}")
            logger.exception("Agent evaluation failed")
            return None

    def _run_latency(
        self,
        audio_duration: float,
        timestamps: dict[str, float] | None,
        warnings: list[str],
    ) -> LatencyMetrics | None:
        try:
            from .latency.rtf import calculate_rtfx
            from .latency.ttft import calculate_ttft
            from .latency.e2e import calculate_e2e_breakdown

            rtfx = None
            ttft = e2e = None
            p50 = p90 = p95 = p99 = None

            if timestamps:
                ttft = calculate_ttft(timestamps)
                breakdown = calculate_e2e_breakdown(timestamps)
                e2e = breakdown.get("total_e2e")

            return LatencyMetrics(
                rtfx=rtfx,
                e2e_latency_ms=e2e,
                ttft_ms=ttft,
                latency_p50=p50,
                latency_p90=p90,
                latency_p95=p95,
                latency_p99=p99,
            )
        except Exception as e:
            warnings.append(f"Latency evaluation failed: {e}")
            logger.exception("Latency evaluation failed")
            return None
