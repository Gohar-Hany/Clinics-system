/**
 * 3eyadaty (عيادتي) — Unified Frontend API Client
 * Connects to Railway Cloud Backend or Local Dev Server
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://3eyadaty-api.up.railway.app";
export const CLINIC_TOKEN =
  process.env.NEXT_PUBLIC_CLINIC_TOKEN || "clinic-secret-2026";
export const DEFAULT_CLINIC_ID = "default-clinic";
export const DEFAULT_DOCTOR_ID = "default-doctor";

export interface ChatResponse {
  response: string;
  thread_id: string;
  intent: string;
  data?: {
    patient_phone?: string;
    appointment_id?: string;
    queue_number?: number;
    reference_code?: string;
    date?: string;
    time?: string;
  };
}

export interface QueuePositionResponse {
  status: "waiting" | "in_progress" | "completed" | "cancelled" | "not_found";
  queue_number: number;
  current_serving: number;
  patients_ahead: number;
  total_in_queue: number;
  avg_consultation_minutes: number;
  estimated_wait_minutes: number;
  estimated_turn_time: string | null;
  appointment_id?: string;
  reference_code?: string;
  scheduled_date?: string;
  message?: string;
}

export interface QueueEntry {
  appointment_id: string;
  queue_number: number;
  patient_name?: string;
  status?: string;
}

export interface QueueStateResponse {
  entries: QueueEntry[];
  current_serving: number;
  total: number;
  avg_consultation_minutes: number;
}

export interface SOAPNotes {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface PrescriptionItem {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface DrugInteraction {
  drugs: string[];
  severity: "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
  clinical_effect: string;
  recommendation: string;
}

export interface ConsultationResponse {
  success: boolean;
  consultation_id: string;
  transcription?: {
    transcript: string;
    duration_seconds: number;
    provider: string;
  };
  soap_notes: SOAPNotes;
  primary_diagnosis: string;
  differential_diagnoses: Array<{
    diagnosis: string;
    probability: string;
    rationale: string;
  }>;
  vital_signs: Record<string, string>;
  symptoms_extracted: string[];
  prescription: PrescriptionItem[];
  drug_interactions: {
    safe_to_prescribe: boolean;
    total_interactions_found: number;
    interactions: DrugInteraction[];
    status?: string;
  };
  lab_requests: string[];
  follow_up_recommendation: string;
  lifestyle_advice: string[];
}

export interface ImagingAnalysisResponse {
  success: boolean;
  consultation_id: string;
  modality: string;
  anatomical_region: string;
  quality_assessment: string;
  findings: Array<{
    structure: string;
    observation: string;
    is_abnormal: boolean;
  }>;
  abnormal_flags: string[];
  impression: string;
  confidence_level: string;
  recommendations: string[];
  critical_alert: string | null;
}

export const clinicApi = {
  // === 1. AI Chat ===
  sendMessage: async (params: {
    message: string;
    clinicId?: string;
    threadId?: string | null;
    patientPhone?: string | null;
  }): Promise<ChatResponse> => {
    const res = await fetch(`${API_BASE_URL}/api/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: params.message,
        clinic_id: params.clinicId || DEFAULT_CLINIC_ID,
        thread_id: params.threadId || undefined,
        patient_phone: params.patientPhone || undefined,
      }),
    });
    if (!res.ok) throw new Error(`Chat API error: ${res.statusText}`);
    return res.json();
  },

  // === 2. Live Queue Tracking ===
  getQueuePosition: async (
    identifier: string,
    clinicId: string = DEFAULT_CLINIC_ID,
    doctorId: string = DEFAULT_DOCTOR_ID
  ): Promise<QueuePositionResponse> => {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/queue/position/${clinicId}/${doctorId}/${encodeURIComponent(
        identifier
      )}`
    );
    if (!res.ok) throw new Error(`Queue Position error: ${res.statusText}`);
    return res.json();
  },

  getQueueState: async (
    clinicId: string = DEFAULT_CLINIC_ID,
    doctorId: string = DEFAULT_DOCTOR_ID,
    date?: string
  ): Promise<QueueStateResponse> => {
    const url = date
      ? `${API_BASE_URL}/api/v1/queue/state/${clinicId}/${doctorId}?queue_date=${date}`
      : `${API_BASE_URL}/api/v1/queue/state/${clinicId}/${doctorId}`;
    const res = await fetch(url, {
      headers: { "X-Clinic-Token": CLINIC_TOKEN },
    });
    if (!res.ok) throw new Error(`Queue State error: ${res.statusText}`);
    return res.json();
  },

  // === 3. Queue Reception Actions ===
  checkIn: async (appointmentId: string) => {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/queue/check-in/${appointmentId}?clinic_id=${DEFAULT_CLINIC_ID}&doctor_id=${DEFAULT_DOCTOR_ID}`,
      {
        method: "POST",
        headers: { "X-Clinic-Token": CLINIC_TOKEN },
      }
    );
    return res.json();
  },

  startConsultation: async (appointmentId: string, queueNumber: number = 1) => {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/queue/start/${appointmentId}?clinic_id=${DEFAULT_CLINIC_ID}&doctor_id=${DEFAULT_DOCTOR_ID}&queue_number=${queueNumber}`,
      {
        method: "POST",
        headers: { "X-Clinic-Token": CLINIC_TOKEN },
      }
    );
    return res.json();
  },

  completeConsultation: async (
    appointmentId: string,
    durationMinutes: number = 20
  ) => {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/queue/complete/${appointmentId}?clinic_id=${DEFAULT_CLINIC_ID}&doctor_id=${DEFAULT_DOCTOR_ID}&duration_minutes=${durationMinutes}`,
      {
        method: "POST",
        headers: { "X-Clinic-Token": CLINIC_TOKEN },
      }
    );
    return res.json();
  },

  // === 4. Doctor AI Co-Pilot & Audio (Phase 2) ===
  analyzeAudioConsultation: async (
    audioBlob: Blob,
    filename: string = "consultation.mp3",
    patientPhone?: string
  ): Promise<ConsultationResponse> => {
    const formData = new FormData();
    formData.append("file", audioBlob, filename);
    formData.append("clinic_id", DEFAULT_CLINIC_ID);
    if (patientPhone) formData.append("patient_phone", patientPhone);

    const res = await fetch(`${API_BASE_URL}/api/v1/doctor/consultation/audio`, {
      method: "POST",
      headers: { "X-Clinic-Token": CLINIC_TOKEN },
      body: formData,
    });
    if (!res.ok) throw new Error(`Audio Consultation error: ${res.statusText}`);
    return res.json();
  },

  analyzeTextConsultation: async (
    transcript: string,
    patientPhone?: string
  ): Promise<ConsultationResponse> => {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/doctor/consultation/analyze-text`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Clinic-Token": CLINIC_TOKEN,
        },
        body: JSON.stringify({
          transcript,
          clinic_id: DEFAULT_CLINIC_ID,
          patient_phone: patientPhone,
        }),
      }
    );
    if (!res.ok) throw new Error(`Text Consultation error: ${res.statusText}`);
    return res.json();
  },

  analyzeMedicalImaging: async (params: {
    imageFile?: File;
    imageUrl?: string;
    imageType?: string;
    clinicalContext?: string;
  }): Promise<ImagingAnalysisResponse> => {
    const formData = new FormData();
    if (params.imageFile) formData.append("image_file", params.imageFile);
    if (params.imageUrl) formData.append("image_url", params.imageUrl);
    formData.append("image_type", params.imageType || "xray");
    if (params.clinicalContext)
      formData.append("clinical_context", params.clinicalContext);

    const res = await fetch(
      `${API_BASE_URL}/api/v1/doctor/consultation/imaging`,
      {
        method: "POST",
        headers: { "X-Clinic-Token": CLINIC_TOKEN },
        body: formData,
      }
    );
    if (!res.ok) throw new Error(`Imaging analysis error: ${res.statusText}`);
    return res.json();
  },

  validatePrescription: async (medications: string[]) => {
    const res = await fetch(`${API_BASE_URL}/api/v1/doctor/prescription/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Clinic-Token": CLINIC_TOKEN,
      },
      body: JSON.stringify({ medications }),
    });
    if (!res.ok) throw new Error(`Prescription validation error`);
    return res.json();
  },

  getClinicalGuidelines: async (condition: string) => {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/doctor/guidelines?condition=${encodeURIComponent(
        condition
      )}`,
      {
        headers: { "X-Clinic-Token": CLINIC_TOKEN },
      }
    );
    if (!res.ok) throw new Error(`Guidelines error`);
    return res.json();
  },
};
