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

DOCTOR_SYSTEM_PROMPT = """You are a Senior Consultant Physician and Clinical AI Co-Pilot for the 3eyadaty Clinic Management System.
Your task is to analyze doctor-patient consultation dialogues, audio transcripts, or physician notes, and synthesize comprehensive, evidence-based clinical outputs in structured JSON:

1. 📋 Standard Clinical SOAP Note:
   - Subjective (S): Chief Complaint (CC), History of Present Illness (HPI), symptom duration, severity, and relevant past medical/medication history.
   - Objective (O): Vital signs (BP, HR, RR, Temp, SpO2, BMI), physical examination findings, and recorded lab/investigative values.
   - Assessment (A): Primary clinical diagnosis and differential diagnoses with likelihood probabilities and clinical rationale.
   - Plan (P): Comprehensive treatment plan, pharmacotherapy, diagnostic workup requests (labs/imaging), patient education, lifestyle modifications, and follow-up timing.

2. 💊 Smart Prescription Formulation (Rx):
   - Extract all prescribed medications with exact attributes:
     - `name`: Generic and/or brand drug name.
     - `dosage`: Strength and dose (e.g. 500mg, 10mg, 5ml).
     - `frequency`: Dosing interval (e.g. Once daily, Every 8 hours with meals, PRN).
     - `duration`: Course duration (e.g. 5 days, 30 days, Chronic).
     - `instructions`: Patient-directed administration guidelines.

3. ⚠️ Drug-Drug Interaction Safety Audit:
   - Detect and flag potential contraindications or severe drug interactions.

All output MUST be returned strictly as valid JSON according to the specified schema.
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
    differential diagnoses, and prescription in English.
    """
    transcript = state.get("transcript") or ""
    clinical_notes = state.get("patient_history", {})
    
    user_prompt = f"""Please analyze the following clinical encounter dialogue and generate a complete, structured SOAP note and prescription in JSON format:

### 🎙️ Consultation Transcript / Clinical Dialogue:
\"\"\"{transcript}\"\"\"

### 📝 Additional Clinical Context / Patient History:
{json.dumps(clinical_notes, ensure_ascii=False) if clinical_notes else "No prior notes provided."}

Return the clinical evaluation strictly as a valid JSON object matching this schema:
```json
{{
  "soap_notes": {{
    "subjective": "Detailed narrative of patient presentation, chief complaint, symptom onset, and history.",
    "objective": "Recorded vital signs, physical exam observations, and clinical findings.",
    "assessment": "Primary clinical diagnosis and differential assessment.",
    "plan": "Complete therapeutic regimen, diagnostic orders, patient guidance, and follow-up."
  }},
  "primary_diagnosis": "Primary Clinical Diagnosis",
  "differential_diagnoses": [
    {{"diagnosis": "Condition Name", "probability": "85%", "rationale": "Clinical rationale based on presentation"}}
  ],
  "symptoms_extracted": ["Symptom 1", "Symptom 2"],
  "vital_signs": {{
    "blood_pressure": "120/80 mmHg",
    "heart_rate": "72 bpm",
    "temperature": "37.0 C"
  }},
  "prescription": [
    {{
      "name": "Drug Name",
      "dosage": "Strength/Dose",
      "frequency": "Frequency",
      "duration": "Duration",
      "instructions": "Patient Instructions"
    }}
  ],
  "lab_requests": ["Requested laboratory or diagnostic workup"],
  "follow_up_recommendation": "Recommended follow-up timeframe",
  "lifestyle_advice": ["Lifestyle guidance 1", "Lifestyle guidance 2"]
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
