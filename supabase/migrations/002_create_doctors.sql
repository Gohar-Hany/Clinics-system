-- =============================================
-- 002: Create Doctors Table
-- =============================================

CREATE TABLE IF NOT EXISTS doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    specialty TEXT,
    license_number TEXT,
    schedule JSONB DEFAULT '{}',
    role TEXT NOT NULL DEFAULT 'doctor' CHECK (role IN ('doctor', 'reception')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for clinic lookup
CREATE INDEX idx_doctors_clinic_id ON doctors(clinic_id);
