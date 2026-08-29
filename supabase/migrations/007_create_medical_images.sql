-- =============================================
-- 007: Create Medical Images Table
-- =============================================

CREATE TABLE IF NOT EXISTS medical_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id),
    image_url TEXT NOT NULL,               -- 📁 Supabase Storage URL
    image_type TEXT NOT NULL DEFAULT 'xray'
        CHECK (image_type IN ('xray', 'mri', 'ct', 'ultrasound', 'other')),
    ai_analysis JSONB,
    ai_findings JSONB DEFAULT '[]',
    search_results JSONB DEFAULT '[]',     -- Tavily literature results
    doctor_review TEXT,
    status TEXT NOT NULL DEFAULT 'uploaded'
        CHECK (status IN (
            'uploaded', 'analyzing', 'searching_literature',
            'awaiting_review', 'reviewed', 'saved'
        )),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_medical_images_consultation ON medical_images(consultation_id);
CREATE INDEX idx_medical_images_patient ON medical_images(patient_id);
