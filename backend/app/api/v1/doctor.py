"""
Doctor Assistant & Medical Intelligence Endpoints (Phase 2).
Handles Audio Consultation Transcription, Automated SOAP Notes,
Smart Prescription Formulation, Drug Interaction Guardrails, and Medical Imaging VLM Analysis.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body
from typing import Optional, List
from pydantic import BaseModel, Field, model_validator
import uuid
import base64

from app.services.transcription_service import transcription_service
from app.agents.doctor.graph import doctor_subgraph
from app.agents.doctor.tools import check_drug_interactions, search_clinical_guidelines
from app.agents.imaging.graph import imaging_subgraph
from app.core.security import verify_clinic_token

router = APIRouter()


# === Request & Response Schemas ===

class TextConsultationRequest(BaseModel):
    transcript: Optional[str] = Field(None, description="Clinical consultation transcript or dialogue")
    clinical_notes: Optional[str] = Field(None, description="Alternative field for clinical notes")
    clinic_id: str = Field("default-clinic", description="Clinic ID")
    patient_phone: Optional[str] = Field(None, description="Patient phone number")
    patient_history: Optional[dict] = Field(None, description="Prior patient medical history / notes")

    @model_validator(mode="before")
    @classmethod
    def validate_text(cls, data):
        if isinstance(data, dict):
            text = data.get("transcript") or data.get("clinical_notes")
            if not text:
                raise ValueError("Must provide either 'transcript' or 'clinical_notes'")
            data["transcript"] = text
            data["clinical_notes"] = text
        return data


class PrescriptionValidationRequest(BaseModel):
    medications: List[str] = Field(..., description="List of prescribed drug names (e.g. ['Warfarin', 'Aspirin'])")


class ImagingAnalysisRequest(BaseModel):
    image_url: Optional[str] = Field(None, description="Direct URL or base64 data URI of the medical scan")
    image_type: str = Field("xray", description="Image modality (xray, mri, ct, ultrasound, lab_report)")
    clinical_context: Optional[str] = Field(None, description="Patient clinical context or suspected condition")


# === Endpoints ===

@router.post("/consultation/audio")
async def analyze_audio_consultation(
    file: UploadFile = File(..., description="Audio recording of doctor-patient consultation"),
    clinic_id: str = Form("default-clinic"),
    patient_phone: Optional[str] = Form(None),
    _: bool = Depends(verify_clinic_token),
):
    """
    🎙️ Analyze Audio Consultation (Speech-to-Text + Clinical SOAP + Smart Rx)
    Transcribes Egyptian Arabic audio recording, generates standard SOAP notes,
    detects diagnoses, formulates prescriptions, and checks drug safety.
    Protected: Requires X-Clinic-Token header.
    """
    try:
        audio_bytes = await file.read()
        transcription_res = await transcription_service.transcribe_audio(
            audio_bytes=audio_bytes,
            filename=file.filename or "consultation.mp3"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"فشل معالجة الملف الصوتي: {e}")

    transcript_text = transcription_res.get("transcript", "")
    if not transcript_text:
        raise HTTPException(status_code=400, detail="لم يتم استخراج أي حديث مسموع من التسجيل الصوتي")

    # Run Doctor Assistant Subgraph
    initial_state = {
        "messages": [],
        "clinic_id": clinic_id,
        "patient_id": None,
        "patient_phone": patient_phone,
        "intent": "consultation",
        "current_agent": "doctor_assistant",
        "error": None,
        "appointment_id": str(uuid.uuid4()),
        "audio_storage_url": "",
        "transcript": transcript_text,
        "symptoms_extracted": [],
        "patient_history": {},
        "ai_analysis": None,
        "search_results": [],
        "treatment_suggestions": [],
        "doctor_decision": None,
        "normalized_medications": [],
        "prescription": [],
        "consultation_status": "analyzing"
    }

    result = await doctor_subgraph.ainvoke(initial_state)
    analysis = result.get("ai_analysis", {})

    return {
        "success": True,
        "consultation_id": initial_state["appointment_id"],
        "transcription": {
            "transcript": transcript_text,
            "duration_seconds": transcription_res.get("duration_seconds", 0.0),
            "provider": transcription_res.get("provider", "whisper")
        },
        "soap_notes": analysis.get("soap_notes"),
        "primary_diagnosis": analysis.get("primary_diagnosis"),
        "differential_diagnoses": analysis.get("differential_diagnoses", []),
        "vital_signs": analysis.get("vital_signs", {}),
        "symptoms_extracted": analysis.get("symptoms_extracted", []),
        "prescription": analysis.get("prescription", []),
        "drug_interactions": analysis.get("drug_interactions", {}),
        "lab_requests": analysis.get("lab_requests", []),
        "follow_up_recommendation": analysis.get("follow_up_recommendation"),
        "lifestyle_advice": analysis.get("lifestyle_advice", [])
    }


@router.post("/consultation/text")
@router.post("/consultation/analyze-text")
async def analyze_text_consultation(
    request: TextConsultationRequest,
    _: bool = Depends(verify_clinic_token),
):
    """
    📝 Analyze Clinical Text / Dialogue (Instant SOAP Notes + Smart Rx)
    Accepts consultation text, dialogue transcript, or physician notes,
    and returns full structured SOAP notes, differential diagnosis, and prescription.
    Protected: Requires X-Clinic-Token header.
    """
    transcript_value = request.transcript or request.clinical_notes or ""
    initial_state = {
        "messages": [],
        "clinic_id": request.clinic_id,
        "patient_id": None,
        "patient_phone": request.patient_phone,
        "intent": "consultation",
        "current_agent": "doctor_assistant",
        "error": None,
        "appointment_id": str(uuid.uuid4()),
        "audio_storage_url": "",
        "transcript": transcript_value,
        "symptoms_extracted": [],
        "patient_history": request.patient_history or {},
        "ai_analysis": None,
        "search_results": [],
        "treatment_suggestions": [],
        "doctor_decision": None,
        "normalized_medications": [],
        "prescription": [],
        "consultation_status": "analyzing"
    }

    result = await doctor_subgraph.ainvoke(initial_state)
    analysis = result.get("ai_analysis", {})

    return {
        "success": True,
        "consultation_id": initial_state["appointment_id"],
        "soap_notes": analysis.get("soap_notes"),
        "primary_diagnosis": analysis.get("primary_diagnosis"),
        "differential_diagnoses": analysis.get("differential_diagnoses", []),
        "vital_signs": analysis.get("vital_signs", {}),
        "symptoms_extracted": analysis.get("symptoms_extracted", []),
        "prescription": analysis.get("prescription", []),
        "drug_interactions": analysis.get("drug_interactions", {}),
        "lab_requests": analysis.get("lab_requests", []),
        "follow_up_recommendation": analysis.get("follow_up_recommendation"),
        "lifestyle_advice": analysis.get("lifestyle_advice", [])
    }


@router.post("/consultation/imaging")
async def analyze_medical_imaging(
    image_file: Optional[UploadFile] = File(None, description="Medical scan image file (JPEG, PNG, DICOM)"),
    image_url: Optional[str] = Form(None, description="Medical image URL or Base64 data string"),
    image_type: str = Form("xray", description="Scan type (xray, mri, ct, ultrasound, lab_report)"),
    clinical_context: Optional[str] = Form(None, description="Clinical context / patient presentation"),
    _: bool = Depends(verify_clinic_token),
):
    """
    🔬 Analyze Medical Imaging & Lab Reports (Multimodal VLM GPT-4o)
    Accepts X-Ray, MRI, CT, Ultrasound, or Lab report image,
    and returns structured radiological findings, impression, abnormal flags, and recommendations.
    Protected: Requires X-Clinic-Token header.
    """
    final_image_url = image_url

    if image_file:
        file_bytes = await image_file.read()
        b64 = base64.b64encode(file_bytes).decode("utf-8")
        content_type = image_file.content_type or "image/jpeg"
        final_image_url = f"data:{content_type};base64,{b64}"

    if not final_image_url:
        raise HTTPException(status_code=400, detail="يرجى إرفاق ملف صورة الأشعة أو رابط الصورة")

    initial_state = {
        "messages": [],
        "clinic_id": "default-clinic",
        "patient_id": None,
        "patient_phone": None,
        "intent": "imaging",
        "current_agent": "imaging",
        "error": None,
        "consultation_id": str(uuid.uuid4()),
        "image_url": final_image_url,
        "image_type": image_type,
        "clinical_context": clinical_context,
        "vlm_analysis": None,
        "findings": [],
        "search_results": [],
        "doctor_review": None,
        "analysis_status": "uploaded"
    }

    result = await imaging_subgraph.ainvoke(initial_state)
    analysis = result.get("vlm_analysis", {})

    return {
        "success": True,
        "consultation_id": initial_state["consultation_id"],
        "modality": analysis.get("modality", image_type.upper()),
        "anatomical_region": analysis.get("anatomical_region"),
        "quality_assessment": analysis.get("quality_assessment"),
        "findings": analysis.get("findings", []),
        "abnormal_flags": analysis.get("abnormal_flags", []),
        "impression": analysis.get("impression"),
        "confidence_level": analysis.get("confidence_level"),
        "recommendations": analysis.get("recommendations", []),
        "critical_alert": analysis.get("critical_alert")
    }


@router.post("/prescription/validate")
async def validate_prescription_drugs(
    request: PrescriptionValidationRequest,
    _: bool = Depends(verify_clinic_token),
):
    """
    ⚠️ Validate Prescription & Check Drug-Drug Interactions
    Evaluates safety for a list of prescribed medications and flags dangerous contraindications.
    Protected: Requires X-Clinic-Token header.
    """
    check_result = check_drug_interactions.invoke({"medications": request.medications})
    return {
        "success": True,
        "evaluated_medications": request.medications,
        "safety_audit": check_result
    }


@router.get("/guidelines/search")
@router.get("/guidelines")
async def get_clinical_guideline(
    condition: str,
    _: bool = Depends(verify_clinic_token),
):
    """
    📚 Retrieve Evidence-Based Clinical Guidelines
    Returns first-line therapies, recommended dosages, and red flags for a condition.
    Protected: Requires X-Clinic-Token header.
    """
    return search_clinical_guidelines.invoke({"condition": condition})
