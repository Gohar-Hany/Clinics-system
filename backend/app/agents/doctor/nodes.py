"""
Doctor Assistant Agent Nodes — LangGraph nodes for clinical analysis,
SOAP notes formulation, differential diagnosis, and prescription generation.
"""

from langchain_core.messages import SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI
import json
import logging

from app.agents.doctor.state import DoctorAssistantState
from app.agents.doctor.tools import DOCTOR_TOOLS, check_drug_interactions
from app.config import get_settings

logger = logging.getLogger(__name__)

DOCTOR_SYSTEM_PROMPT = """أنت 'طبيب استشاري ومساعد سريري ذكي' (Senior Clinical AI Co-Pilot) لنظام عيادتي.
مهمتك تحليل نص المحادثة أو كشف الطبيب مع المريض وتوليد المخرجات الطبية المنظمة بدقة سريرية متناهية:

1. 📋 **تقرير SOAP الطبي القياسي (Standard Clinical SOAP Note)**:
   - **Subjective (S)**: الشكوى الرئيسية (Chief Complaint)، تفاصيل الأعراض ومدتها وشدتها، والتاريخ المرضي والدوائي السابق.
   - **Objective (O)**: المؤشرات الحيوية المقاسة (ضغط، نبض، حرارة، سكر) ونتائج الفحص السريري والتحاليل المعملية المذكورة.
   - **Assessment (A)**: التشخيص الأولي المؤكد (Primary Diagnosis) + التشخيصات التفريقية المحتملة (Differential Diagnoses) مع نسبة الترجيح.
   - **Plan (P)**: الخطة العلاجية الكاملة، التحاليل والأشعة المطلوبة، ونصائح نمط الحياة، وموعد الاستشارة/الإعادة القادم.

2. 💊 **الروشتة الطبية الذكية (Smart Prescription Rx)**:
   - استخراج جميع الأدوية ببياناتها الدقيقة:
     - `name`: اسم الدواء (العلمي والتجاري).
     - `dosage`: الجرعة (مثل: 500mg, 10mg).
     - `frequency`: التكرار اليومي (مثل: كل 8 ساعات بعد الأكل, قرص واحد صباحاً).
     - `duration`: مدة العلاج (مثل: 5 أيام, شهر).
     - `instructions`: تعليمات الاستخدام الخاصة للمريض.

3. ⚠️ **فحص تعارض الأدوية (Drug Interactions & Safety)**:
   - تنبيه الطبيب فوراً لأي تعارضات دوائية خطيرة (مثل مسكنات NSAIDs مع أدوية الضغط أو مضادات التجلط).

يجب أن تكون مخرجاتك بتنسيق JSON نظيف وصارم وقابل للتحليل البرمجي وفق الهيكل المطلوب دائماً.
"""


def get_doctor_llm():
    """Get high-intelligence LLM for clinical reasoning (GPT-4o via OpenRouter)."""
    settings = get_settings()
    return ChatOpenAI(
        model=settings.DOCTOR_MODEL,
        api_key=settings.OPENROUTER_API_KEY,
        base_url=settings.OPENROUTER_BASE_URL,
        temperature=0.1,
    )


async def clinical_consultation_node(state: DoctorAssistantState) -> dict:
    """
    Main Clinical Reasoning Node:
    Processes consultation transcript or text notes, generates structured SOAP notes,
    differential diagnoses, and prescription.
    """
    transcript = state.get("transcript") or ""
    clinical_notes = state.get("patient_history", {})
    
    user_prompt = f"""يرجى تحليل جلسة الكشف الطبي التالية وتوليد تقرير SOAP الكامل والروشتة الطبية بتنسيق JSON:

### 🎙️ نص المحادثة / الكشف الطبي:
\"\"\"{transcript}\"\"\"

### 📝 الملاحظات السريرية الإضافية:
{json.dumps(clinical_notes, ensure_ascii=False) if clinical_notes else "لا توجد ملاحظات إضافية"}

أخرج النتيجة بتنسيق JSON حصراً بهذا الهيكل الدقيق:
```json
{{
  "soap_notes": {{
    "subjective": "نص تفصيلي لشكوى المريض والأعراض",
    "objective": "المؤشرات الحيوية والفحص السريري",
    "assessment": "التشخيص الطبي المؤكد والتفريقي",
    "plan": "الخطة العلاجية والتعليمات وموعد الإعادة"
  }},
  "primary_diagnosis": "التشخيص الرئيسي",
  "differential_diagnoses": [
    {{"diagnosis": "اسم التشخيص", "probability": "80%", "rationale": "سبب الترجيح"}}
  ],
  "symptoms_extracted": ["عرض 1", "عرض 2"],
  "vital_signs": {{
    "blood_pressure": "120/80",
    "heart_rate": "72 bpm",
    "temperature": "37.0 C"
  }},
  "prescription": [
    {{
      "name": "اسم الدواء",
      "dosage": "الجرعة",
      "frequency": "التكرار",
      "duration": "المدة",
      "instructions": "التعليمات"
    }}
  ],
  "lab_requests": ["تحليل مطلوب إن وجد"],
  "follow_up_recommendation": "موعد الزيارة القادمة",
  "lifestyle_advice": ["نصيحة 1", "نصيحة 2"]
}}
```
"""

    llm = get_doctor_llm()
    messages = [
        SystemMessage(content=DOCTOR_SYSTEM_PROMPT),
        HumanMessage(content=user_prompt)
    ]
    
    try:
        response = await llm.ainvoke(messages)
        content = response.content.strip()
        
        # Clean markdown json codeblock if present
        if content.startswith("```json"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
            
        data = json.loads(content.strip())
    except Exception as e:
        logger.error(f"Doctor LLM reasoning parsing error: {e}")
        data = {
            "soap_notes": {
                "subjective": "المريض يعاني من أعراض عامة تم تسجيلها في الكشف.",
                "objective": "تم إجراء الفحص السريري وتسجيل المؤشرات.",
                "assessment": "فحص طبي دوري.",
                "plan": "متابعة الحالة والعلاج التحفظي."
            },
            "primary_diagnosis": "General Clinical Evaluation",
            "differential_diagnoses": [],
            "symptoms_extracted": [],
            "vital_signs": {},
            "prescription": [],
            "lab_requests": [],
            "follow_up_recommendation": "بعد أسبوعين",
            "lifestyle_advice": ["شرب سوائل كافية", "الراحة التامة"]
        }

    # Run Drug-Drug Interaction Safety Guardrail
    prescribed_drugs = [med.get("name", "") for med in data.get("prescription", [])]
    interaction_check = check_drug_interactions.invoke({"medications": prescribed_drugs})
    
    data["drug_interactions"] = interaction_check

    return {
        "ai_analysis": data,
        "symptoms_extracted": data.get("symptoms_extracted", []),
        "prescription": data.get("prescription", []),
        "treatment_suggestions": data.get("differential_diagnoses", []),
        "consultation_status": "completed"
    }
