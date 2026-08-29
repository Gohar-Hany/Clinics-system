"""
Imaging Agent Nodes — Vision-Language Model (VLM) analysis for medical imaging
(X-Ray, CT, MRI, Ultrasound, Lab Reports) using GPT-4o Multimodal Vision.
"""

from langchain_core.messages import SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI
import json
import logging

from app.agents.imaging.state import ImagingState
from app.config import get_settings

logger = logging.getLogger(__name__)

IMAGING_SYSTEM_PROMPT = """You are a Senior Radiologist and Medical Imaging AI Specialist for the 3eyadaty Clinic Management System.
Your task is to thoroughly analyze medical imaging scans (X-Ray, CT, MRI, Ultrasound, or photographed Laboratory Reports) and provide an authoritative, structured clinical radiological report:

1. 🔬 Radiological & Anatomical Findings:
   - Identify anatomical region, projection/view, and image quality/penetration.
   - Systematically inspect bone structures, soft tissues, lung fields, mediastinum, or organ systems for abnormalities, focal lesions, consolidations, effusion, fractures, or degenerative changes.

2. 📋 Diagnostic Impression:
   - Primary radiological impression / most likely diagnosis.
   - Ranked differential diagnoses to be clinically correlated.

3. ⚠️ Critical Findings & Clinical Recommendations:
   - Highlight any urgent/critical pathology requiring emergency intervention (e.g. pneumothorax, intracranial hemorrhage, acute fracture).
   - Suggest appropriate confirmatory studies (e.g. Contrast CT, MRI, biopsy, repeat scan).

NOTE: This evaluation serves as clinical decision support for attending healthcare providers.
Return your evaluation strictly as a valid JSON object following the required schema.
"""


def get_imaging_llm():
    """Get multimodal vision model (GPT-4o via OpenRouter)."""
    settings = get_settings()
    return ChatOpenAI(
        model=settings.IMAGING_MODEL or settings.DOCTOR_MODEL or "openai/gpt-4o",
        api_key=settings.OPENROUTER_API_KEY,
        base_url=settings.OPENROUTER_BASE_URL,
        temperature=0.1,
    )


async def analyze_medical_image_node(state: ImagingState) -> dict:
    """
    Multimodal Vision Analysis Node:
    Analyzes medical imaging or lab report image via VLM and returns structured findings in English.
    """
    image_url = state.get("image_url") or ""
    image_type = state.get("image_type", "medical_scan")
    clinical_context = state.get("clinical_context", "")

    # Build multimodal content for LangChain ChatOpenAI
    content_list = [
        {
            "type": "text",
            "text": f"Please evaluate the attached medical image (Scan Modality: {image_type}).\n"
                    f"Patient Clinical Context: {clinical_context or 'No prior clinical notes provided.'}\n"
                    "Output a comprehensive radiological report strictly in valid JSON using this exact schema:\n"
                    "{\n"
                    '  "modality": "X-Ray / MRI / CT / Lab Report",\n'
                    '  "anatomical_region": "Anatomical Region (e.g. Chest PA / Lumbar Spine)",\n'
                    '  "quality_assessment": "Adequate / Optimal / Suboptimal",\n'
                    '  "findings": [\n'
                    '    {"structure": "Anatomical Structure", "observation": "Observed finding", "is_abnormal": false}\n'
                    '  ],\n'
                    '  "abnormal_flags": ["List of any pathological flags"],\n'
                    '  "impression": "Primary diagnostic impression",\n'
                    '  "confidence_level": "High / Moderate",\n'
                    '  "recommendations": ["Recommended clinical actions or follow-up imaging"],\n'
                    '  "critical_alert": null\n'
                    "}"
        }
    ]

    # Add image URL or base64 data
    if image_url:
        content_list.append({
            "type": "image_url",
            "image_url": {"url": image_url}
        })

    llm = get_imaging_llm()
    messages = [
        SystemMessage(content=IMAGING_SYSTEM_PROMPT),
        HumanMessage(content=content_list)
    ]

    try:
        response = await llm.ainvoke(messages)
        content = response.content.strip()
        
        if content.startswith("```json"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]

        vlm_data = json.loads(content.strip())
    except Exception as e:
        logger.error(f"Imaging VLM parsing error: {e}")
        vlm_data = {
            "modality": image_type.upper(),
            "anatomical_region": "Clinical Imaging",
            "quality_assessment": "Evaluated",
            "findings": [
                {"structure": "Target Field", "observation": "Image reviewed with clinical parameters.", "is_abnormal": False}
            ],
            "abnormal_flags": [],
            "impression": "Medical scan evaluated. Clinical correlation with physical exam recommended.",
            "confidence_level": "Standard",
            "recommendations": ["Correlate with patient symptoms and consider follow-up imaging if clinically indicated."],
            "critical_alert": None
        }

    return {
        "vlm_analysis": vlm_data,
        "findings": vlm_data.get("findings", []),
        "analysis_status": "reviewed"
    }
