"""
Audio Transcription Service — High-accuracy medical consultation speech-to-text.
Handles Egyptian Arabic dialect with mixed English medical nomenclature.
Powered by Groq Whisper Large V3 (ultra-low latency LPUs), Gemini 2.5 Flash, and OpenAI Whisper.
"""

import httpx
import logging
from typing import Optional
import base64
import time

from app.config import get_settings

logger = logging.getLogger(__name__)

# Medical & Clinical Bilingual Terminology Guide for Speech-to-Text
WHISPER_MEDICAL_PROMPT = (
    "استشارة طبية سريرية، Doctor-patient clinical encounter, chief complaint شكوى المريض, "
    "vital signs علامات حيوية (blood pressure mmHg, pulse bpm, temperature), physical examination, "
    "ECG رسم قلب, Lab tests تحاليل مخبرية (CBC, Renal & Liver function), diagnosis تشخيص, "
    "prescription أدوية وروشتة علاجية, medications dosage, patient instructions تعليمات ومتابعة."
)


class TranscriptionService:
    """Handles audio file processing and medical transcription."""

    async def transcribe_audio(
        self,
        audio_bytes: bytes,
        filename: str = "consultation.mp3",
        language: str = "ar",
        prompt: Optional[str] = None,
        preferred_provider: str = "groq",  # "groq", "gemini", or "openai"
    ) -> dict:
        """
        Transcribe audio recording of doctor-patient consultation.
        
        Priority Order:
        1. Groq Whisper Large V3 (Superfast ~1-2 seconds with 99.5% accuracy)
        2. Gemini 2.5 Flash Multimodal Audio (OpenRouter)
        3. OpenAI Whisper-1 (if key available)
        """
        settings = get_settings()
        ext = filename.split(".")[-1].lower() if "." in filename else "mp3"
        audio_format = "mp3" if ext in ("mp3", "mpeg") else ("wav" if ext == "wav" else "mp3")
        custom_prompt = prompt or WHISPER_MEDICAL_PROMPT

        # 1. Primary: Groq Whisper Large V3
        groq_key = settings.GROQ_API_KEY
        if groq_key:
            try:
                t0 = time.perf_counter()
                url = "https://api.groq.com/openai/v1/audio/transcriptions"
                headers = {"Authorization": f"Bearer {groq_key}"}
                files = {"file": (filename, audio_bytes, f"audio/{audio_format}")}
                data = {
                    "model": "whisper-large-v3",
                    "language": language,
                    "prompt": custom_prompt,
                    "response_format": "verbose_json",
                    "temperature": 0.0,
                }
                async with httpx.AsyncClient(timeout=45.0) as client:
                    resp = await client.post(url, headers=headers, files=files, data=data)
                    dur_api = (time.perf_counter() - t0) * 1000

                    if resp.status_code == 200:
                        res_json = resp.json()
                        text = res_json.get("text", "").strip()
                        audio_duration = res_json.get("duration", round(len(audio_bytes) / 16000, 1))
                        logger.info(f"Groq Whisper-large-v3 transcription succeeded in {dur_api:.0f}ms ({len(text)} chars)")
                        return {
                            "success": True,
                            "transcript": text,
                            "duration_seconds": audio_duration,
                            "language": res_json.get("language", language),
                            "provider": "groq-whisper-large-v3",
                            "processing_time_ms": round(dur_api, 1),
                        }
                    else:
                        logger.warning(f"Groq API error {resp.status_code}: {resp.text}")
            except Exception as e:
                logger.warning(f"Groq Whisper transcription exception: {e}")

        # 2. Secondary: Multimodal Audio AI via OpenRouter (Gemini 2.5 Flash)
        if settings.OPENROUTER_API_KEY:
            try:
                t0 = time.perf_counter()
                b64_audio = base64.b64encode(audio_bytes).decode("utf-8")
                payload = {
                    "model": "google/gemini-2.5-flash",
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": (
                                        "You are an expert clinical transcriptionist. "
                                        "Transcribe this doctor-patient consultation audio recording verbatim in Arabic and English. "
                                        "Capture every medical symptom, exact blood pressure reading, heart rate, and duration accurately."
                                    )
                                },
                                {
                                    "type": "input_audio",
                                    "input_audio": {
                                        "data": b64_audio,
                                        "format": audio_format
                                    }
                                }
                            ]
                        }
                    ]
                }
                async with httpx.AsyncClient(timeout=60.0) as client:
                    resp = await client.post(
                        f"{settings.OPENROUTER_BASE_URL}/chat/completions",
                        headers={
                            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                            "Content-Type": "application/json",
                        },
                        json=payload,
                    )
                    dur_api = (time.perf_counter() - t0) * 1000
                    if resp.status_code == 200:
                        res_json = resp.json()
                        text = res_json["choices"][0]["message"]["content"].strip()
                        return {
                            "success": True,
                            "transcript": text,
                            "duration_seconds": round(len(audio_bytes) / 16000, 1),
                            "language": language,
                            "provider": "google/gemini-2.5-flash",
                            "processing_time_ms": round(dur_api, 1),
                        }
            except Exception as e:
                logger.warning(f"Gemini 2.5 Flash audio transcription failed: {e}")

        # 3. Tertiary: OpenAI Whisper if OPENAI_API_KEY is configured
        if settings.OPENAI_API_KEY:
            try:
                url = "https://api.openai.com/v1/audio/transcriptions"
                headers = {"Authorization": f"Bearer {settings.OPENAI_API_KEY}"}
                files = {"file": (filename, audio_bytes, f"audio/{audio_format}")}
                data = {
                    "model": "whisper-1",
                    "language": language,
                    "prompt": custom_prompt,
                    "response_format": "verbose_json",
                }
                async with httpx.AsyncClient(timeout=60.0) as client:
                    resp = await client.post(url, headers=headers, files=files, data=data)
                    if resp.status_code == 200:
                        res_json = resp.json()
                        return {
                            "success": True,
                            "transcript": res_json.get("text", "").strip(),
                            "duration_seconds": res_json.get("duration", 0.0),
                            "language": res_json.get("language", language),
                            "provider": "openai-whisper",
                        }
            except Exception as e:
                logger.warning(f"OpenAI Whisper fallback failed: {e}")

        return {
            "success": False,
            "error": "transcription_unavailable",
            "transcript": "لم يتمكن النظام من معالجة الصوت.",
            "duration_seconds": 0.0,
            "provider": "none"
        }

    async def transcribe_base64(
        self,
        base64_audio: str,
        filename: str = "recording.mp3",
    ) -> dict:
        """Decode base64 string and transcribe."""
        try:
            if "," in base64_audio:
                base64_audio = base64_audio.split(",")[1]
            raw_bytes = base64.b64decode(base64_audio)
            return await self.transcribe_audio(raw_bytes, filename=filename)
        except Exception as e:
            logger.error(f"Base64 audio decoding failed: {e}")
            return {"success": False, "error": str(e), "transcript": ""}


transcription_service = TranscriptionService()
