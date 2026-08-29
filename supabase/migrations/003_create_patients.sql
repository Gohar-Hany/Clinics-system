-- =============================================
-- 003: Create Patients Table
-- =============================================

CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,                  -- 🔑 Primary identifier (MVP)
    email TEXT,
    date_of_birth DATE,
    gender TEXT CHECK (gender IN ('male', 'female')),
    medical_history JSONB DEFAULT '{}',
    allergies JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now(),

    -- Unique phone per clinic
    UNIQUE(clinic_id, phone)
);

-- Index for phone lookup (MVP auth)
CREATE INDEX idx_patients_phone ON patients(phone);
CREATE INDEX idx_patients_clinic_id ON patients(clinic_id);
