-- =============================================
-- 005: Create Consultations Table
-- =============================================

CREATE TABLE IF NOT EXISTS consultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    audio_url TEXT,                        -- 📁 Supabase Storage URL (no binary)
    transcript TEXT,
    ai_summary TEXT,
    ai_suggestions JSONB DEFAULT '[]',
    diagnosis JSONB DEFAULT '{}',
    doctor_notes TEXT,
    status TEXT NOT NULL DEFAULT 'processing'
        CHECK (status IN (
            'processing', 'transcribing', 'analyzing', 'searching',
            'suggesting', 'awaiting_review', 'normalizing_drugs',
            'prescribing', 'completed'
        )),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_consultations_appointment ON consultations(appointment_id);
CREATE INDEX idx_consultations_patient ON consultations(patient_id);
CREATE INDEX idx_consultations_status ON consultations(status);
