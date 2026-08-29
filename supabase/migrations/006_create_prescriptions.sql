-- =============================================
-- 006: Create Prescriptions Table
-- =============================================

CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id),
    doctor_id UUID NOT NULL REFERENCES doctors(id),
    medications JSONB NOT NULL DEFAULT '[]',  -- Normalized medication data
    instructions TEXT,
    pharmacy_notes TEXT,
    drugs_normalized BOOLEAN DEFAULT false,   -- ✅ Drug DB verified
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'dispensed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_prescriptions_consultation ON prescriptions(consultation_id);
CREATE INDEX idx_prescriptions_patient ON prescriptions(patient_id);
