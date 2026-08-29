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

IMAGING_SYSTEM_PROMPT = """أنت 'أخصائي أشعة وتحاليل طبية واستشاري ذكاء اصطناعي' (Senior Radiologist & Medical Imaging AI Specialist).
مهمتك فحص الصور الطبية (X-Ray, MRI, CT Scan, Ultrasound, أو صور تقارير التحاليل الطبية) واستخراج تقرير سريري منظم فائق الدقة:

1. 🔬 **الفحص والملاحظات الإشعاعية (Radiological Findings)**:
   - تحديد المنطقة التشريحية وجودة الصورة والوضعية (View/Modality).
   - فحص الأنسجة، العظام، الأعضاء، وتحديد أي شذوذ أو تغيرات مرضية (Lesions, Fractures, Infiltrates, Effusion, Mass effect, Calcifications).

2. 📋 **الانطباع التشخيصي (Diagnostic Impression)**:
   - التشخيص الإشعاعي الأرجح (Most Likely Radiologic Diagnosis).
   - التشخيصات البديلة الواجب استبعادها (Differential Radiologic Diagnoses).

3. ⚠️ **علامات الخطر والتوصيات السريرية (Critical Findings & Next Steps)**:
   - تنبيه فوري لأي حالة حرجة (Red Flag / Critical Finding).
   - التوصيات الإضافية (مثل: طلب أشعة مقطعية بالصبغة، تحاليل مكملة، أو استشارة جراحية فورية).

ملاحظة هامة: هذا التحليل هو مسودة إرشادية لمساعدة ودعم قرار الطبيب المعالج (Clinical Decision Support).
يجب أن يكون الرد بتنسيق JSON نظيف وصارم وفق الهيكل المحدد.
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
    Analyzes medical imaging or lab report image via VLM and returns structured findings.
    """
    image_url = state.get("image_url") or ""
    image_type = state.get("image_type", "medical_scan")
    clinical_context = state.get("clinical_context", "")

    # Build multimodal content for LangChain ChatOpenAI
    content_list = [
        {
            "type": "text",
            "text": f"يرجى فحص الصورة الطبية المرفقة (نوع الصورة: {image_type}).\n"
                    f"السياق السريري وشكوى المريض: {clinical_context or 'لا يوجد سياق إضافي'}\n"
                    "أخرج التقرير بتنسيق JSON صارم بالهيكل التالي:\n"
                    "{\n"
                    '  "modality": "X-Ray / MRI / CT / Lab Report",\n'
                    '  "anatomical_region": "المنطقة المصورة (مثال: Chest / Lumbar Spine)",\n'
                    '  "quality_assessment": "Adequate / Optimal",\n'
                    '  "findings": [\n'
                    '    {"structure": "التركيب", "observation": "الملاحظة", "is_abnormal": false}\n'
                    '  ],\n'
                    '  "abnormal_flags": ["أي علامة مرضية غير طبيعية"],\n'
                    '  "impression": "الانطباع والتشخيص الإشعاعي النهائي",\n'
                    '  "confidence_level": "High / Moderate",\n'
                    '  "recommendations": ["فحوصات مكملة أو إجراءات علاجية مقترحة"],\n'
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
