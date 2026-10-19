/**
 * عيادتي — Frontend API client for the FastAPI backend.
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://3eyadaty-api.up.railway.app";
export const CLINIC_TOKEN =
  process.env.NEXT_PUBLIC_CLINIC_TOKEN || "clinic-secret-2026";
export const DEFAULT_CLINIC_ID = "default-clinic";
export const DEFAULT_DOCTOR_ID = "default-doctor";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}, staff = false): Promise<T> {
  const headers = new Headers(init.headers);
  if (staff) headers.set("X-Clinic-Token", CLINIC_TOKEN);
  if (init.body && typeof init.body === "string") headers.set("Content-Type", "application/json");

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/v1${path}`, { ...init, headers, cache: "no-store" });
  } catch {
    throw new ApiError(0, "مش قادرين نوصل للسيرفر. اتأكد من الاتصال بالإنترنت وجرب تاني.");
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : detail;
    } catch {}
    throw new ApiError(res.status, detail);
  }
  return res.json();
}

// ───────────────────────── Types ─────────────────────────

export type AppointmentStatus =
  | "scheduled"
  | "checked_in"
  | "in_progress"
  | "completed"
  | "no_show"
  | "cancelled";

export interface Appointment {
  id: string;
  reference_code: string;
  patient_name?: string;
  patient_phone: string;
  date: string;
  time: string;
  status: AppointmentStatus;
  queue_number: number;
  notes?: string;
  source?: "ai_chat" | "reception";
  created_at: string;
  checked_in_at?: string;
  started_at?: string;
  completed_at?: string;
  duration_minutes?: number;
}

export interface SlotOption {
  time: string;
  label: string;
}

export interface BookingSummary {
  reference_code: string;
  queue_number: number;
  date: string;
  time: string;
  day_label: string;
  time_label: string;
  patient_name?: string;
  patient_phone?: string;
  rescheduled?: boolean;
}

export interface BookingProposal {
  patient_name: string;
  patient_phone: string;
  date: string;
  time: string;
  day_label: string;
  time_label: string;
  queue_number: number;
}

export interface ChatResponse {
  response: string;
  thread_id: string;
  intent: string | null;
  data?: {
    patient_phone?: string;
    slots?: { date: string; day_label: string; options: SlotOption[] };
    booking?: BookingSummary;
    proposal?: BookingProposal;
    cancelled?: { date: string; time: string };
    error?: string;
  } | null;
}

export interface QueuePosition {
  queue_number: number;
  current_serving: number;
  patients_ahead: number;
  total_in_queue: number;
  avg_consultation_minutes: number;
  estimated_wait_minutes: number;
  status: AppointmentStatus;
  appointment_id: string;
  reference_code: string;
  patient_name: string | null;
  scheduled_date: string;
  scheduled_time: string;
  day_label: string;
  time_label: string;
  is_today: boolean;
}

export interface QueueDisplay {
  date: string;
  now_serving: number | null;
  waiting: { queue_number: number; time: string; arrived: boolean }[];
  completed_count: number;
  avg_consultation_minutes: number;
}

export interface ClinicInfo {
  clinic_name: string;
  doctor_name: string;
  doctor_specialty: string;
  address: string;
  phone: string;
  consultation_fee: string;
  hours: { open: string; close: string; last_slot: string; slot_minutes: number; off_days: string[] };
}

export interface DashboardOverview {
  date: string;
  generated_at: string;
  is_off_day: boolean;
  counts: Record<AppointmentStatus, number> & { total: number };
  capacity: { slots_per_day: number; booked: number; utilization_pct: number };
  now_serving: Appointment | null;
  waiting: Appointment[];
  avg_consultation_minutes: number;
  avg_consultation_today: number | null;
  new_bookings_today: number;
  upcoming_7_days: number;
  hourly: { hour: string; count: number }[];
  upcoming_days: { date: string; weekday: string; is_off_day: boolean; count: number; capacity: number }[];
  upcoming_list: Appointment[];
  recent_bookings: Appointment[];
  sources: { ai_chat: number; reception: number };
}

export type StatusAction = "check_in" | "start" | "complete" | "no_show" | "cancel";

// Doctor co-pilot (Phase 2)

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
  transcription?: { transcript: string; duration_seconds: number; provider: string };
  soap_notes: SOAPNotes;
  primary_diagnosis: string;
  differential_diagnoses: Array<{ diagnosis: string; probability: string; rationale: string }>;
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
  findings: Array<{ structure: string; observation: string; is_abnormal: boolean }>;
  abnormal_flags: string[];
  impression: string;
  confidence_level: string;
  recommendations: string[];
  critical_alert: string | null;
}

export interface GuidelineResult {
  condition: string;
  [key: string]: unknown;
}

// ───────────────────────── Calls ─────────────────────────

export const clinicApi = {
  // Patient
  getClinicInfo: () => request<ClinicInfo>("/clinic/info"),

  sendMessage: (params: { message: string; threadId?: string | null; patientPhone?: string | null }) =>
    request<ChatResponse>("/chat", {
      method: "POST",
      body: JSON.stringify({
        message: params.message,
        clinic_id: DEFAULT_CLINIC_ID,
        thread_id: params.threadId || undefined,
        patient_phone: params.patientPhone || undefined,
      }),
    }),

  getQueuePosition: (identifier: string) =>
    request<QueuePosition>(
      `/queue/position/${DEFAULT_CLINIC_ID}/${DEFAULT_DOCTOR_ID}/${encodeURIComponent(identifier.trim())}`
    ),

  getQueueDisplay: () => request<QueueDisplay>(`/queue/display/${DEFAULT_CLINIC_ID}/${DEFAULT_DOCTOR_ID}`),

  // Staff
  getDashboard: (date?: string) =>
    request<DashboardOverview>(`/dashboard/overview${date ? `?date=${date}` : ""}`, {}, true),

  listAppointments: (date?: string) =>
    request<{ date: string; appointments: Appointment[]; total: number }>(
      `/appointments${date ? `?date=${date}` : ""}`,
      {},
      true
    ),

  getSlots: (date: string) =>
    request<{ success: boolean; available_slots?: { time: string; formatted: string }[]; message: string }>(
      `/appointments/slots?date=${date}`
    ),

  createWalkIn: (body: { patient_name: string; patient_phone: string; date: string; time: string; notes?: string }) =>
    request<{ reference_code: string; queue_number: number }>("/appointments", { method: "POST", body: JSON.stringify(body) }, true),

  updateStatus: (appointmentId: string, action: StatusAction) =>
    request<{ success: boolean; appointment: Appointment }>(
      `/appointments/${appointmentId}/status`,
      { method: "POST", body: JSON.stringify({ action }) },
      true
    ),

  seedDemo: () => request<{ message: string }>("/appointments/admin/seed-demo", { method: "POST" }, true),

  // Doctor co-pilot
  analyzeAudioConsultation: (audioBlob: Blob, filename = "consultation.webm", patientPhone?: string) => {
    const form = new FormData();
    form.append("file", audioBlob, filename);
    form.append("clinic_id", DEFAULT_CLINIC_ID);
    if (patientPhone) form.append("patient_phone", patientPhone);
    return request<ConsultationResponse>("/doctor/consultation/audio", { method: "POST", body: form }, true);
  },

  analyzeTextConsultation: (transcript: string, patientPhone?: string) =>
    request<ConsultationResponse>(
      "/doctor/consultation/analyze-text",
      { method: "POST", body: JSON.stringify({ transcript, clinic_id: DEFAULT_CLINIC_ID, patient_phone: patientPhone }) },
      true
    ),

  analyzeMedicalImaging: (params: { imageFile?: File; imageType?: string; clinicalContext?: string }) => {
    const form = new FormData();
    if (params.imageFile) form.append("image_file", params.imageFile);
    form.append("image_type", params.imageType || "xray");
    if (params.clinicalContext) form.append("clinical_context", params.clinicalContext);
    return request<ImagingAnalysisResponse>("/doctor/consultation/imaging", { method: "POST", body: form }, true);
  },

  getClinicalGuidelines: (condition: string) =>
    request<GuidelineResult>(`/doctor/guidelines?condition=${encodeURIComponent(condition)}`, {}, true),
};
