"""
Audio Transcription Service — High-accuracy medical consultation speech-to-text.
Handles Egyptian Arabic dialect with mixed English medical nomenclature.
Powered by Multimodal Audio AI (Gemini 2.5 Flash via OpenRouter) and OpenAI Whisper.
"""

import httpx
import logging
from typing import Optional
import base64
import io

from app.config import get_settings

logger = logging.getLogger(__name__)

# Medical & Clinical Prompt Priming
MEDICAL_TRANSCRIPTION_PROMPT = (
    "You are an expert clinical medical transcriptionist for the 3eyadaty healthcare system. "
    "Transcribe this doctor-patient consultation audio recording verbatim in Egyptian Arabic and English. "
    "Ensure 100% precision for vital signs (Blood Pressure e.g. 160/100, Heart Rate/Pulse e.g. 88 bpm), "
    "symptom durations, anatomical locations (forehead, occipital, chest), medications, and diagnostic requests. "
    "Do not hallucinate, omit, or alter any numbers or medical terms."
)


class TranscriptionService:
    """Handles audio file processing and medical transcription."""

    async def transcribe_audio(
        self,
        audio_bytes: bytes,
        filename: str = "consultation.mp3",
        language: str = "ar",
        prompt: Optional[str] = None,
    ) -> dict:
        """
        Transcribe audio recording of doctor-patient consultation with multimodal AI.
        """
        settings = get_settings()
        b64_audio = base64.b64encode(audio_bytes).decode("utf-8")
        ext = filename.split(".")[-1].lower() if "." in filename else "mp3"
        audio_format = "mp3" if ext in ("mp3", "mpeg") else ("wav" if ext == "wav" else "mp3")

        # 1. Primary: High-Accuracy Multimodal Audio Transcription via OpenRouter (Gemini 2.5 Flash)
        if settings.OPENROUTER_API_KEY:
            try:
                payload = {
                    "model": "google/gemini-2.5-flash",
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": prompt or MEDICAL_TRANSCRIPTION_PROMPT
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
                async with httpx.AsyncClient(timeout=90.0) as client:
                    resp = await client.post(
                        f"{settings.OPENROUTER_BASE_URL}/chat/completions",
                        headers={
                            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                            "Content-Type": "application/json",
                        },
                        json=payload,
                    )
                    if resp.status_code == 200:
                        res_json = resp.json()
                        text = res_json["choices"][0]["message"]["content"].strip()
                        logger.info(f"Multimodal Audio transcription succeeded ({len(text)} chars)")
                        return {
                            "success": True,
                            "transcript": text,
                            "duration_seconds": round(len(audio_bytes) / 16000, 1),
                            "language": language,
                            "provider": "google/gemini-2.5-flash",
                        }
                    else:
                        logger.warning(f"OpenRouter audio API returned {resp.status_code}: {resp.text}")
            except Exception as e:
                logger.warning(f"Multimodal audio transcription failed: {e}")

        # 2. Secondary: OpenAI Whisper if OPENAI_API_KEY is configured
        if settings.OPENAI_API_KEY:
            try:
                url = "https://api.openai.com/v1/audio/transcriptions"
                headers = {"Authorization": f"Bearer {settings.OPENAI_API_KEY}"}
                files = {"file": (filename, audio_bytes, f"audio/{audio_format}")}
                data = {
                    "model": "whisper-1",
                    "language": language,
                    "prompt": prompt or MEDICAL_TRANSCRIPTION_PROMPT,
                    "response_format": "verbose_json",
                }
                async with httpx.AsyncClient(timeout=90.0) as client:
                    response = await client.post(url, headers=headers, files=files, data=data)
                    if response.status_code == 200:
                        res_json = response.json()
                        return {
                            "success": True,
                            "transcript": res_json.get("text", "").strip(),
                            "duration_seconds": res_json.get("duration", 0.0),
                            "language": res_json.get("language", language),
                            "provider": "openai-whisper",
                        }
            except Exception as e:
                logger.warning(f"Whisper fallback failed: {e}")

        # 3. Graceful Fallback if offline
        return {
            "success": False,
            "error": "transcription_unavailable",
            "transcript": "لم يتمكن النظام من معالجة الصوت لعدم توفر اتصال بالخدمة السحابية.",
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
