-- =============================================
-- 009: Create Chat Conversations Table
-- =============================================

CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_phone TEXT NOT NULL,            -- 🔑 Phone-based linking
    patient_id UUID REFERENCES patients(id),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    thread_id TEXT NOT NULL UNIQUE,         -- LangGraph thread_id
    messages JSONB DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'closed')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chat_patient_phone ON chat_conversations(patient_phone);
CREATE INDEX idx_chat_thread_id ON chat_conversations(thread_id);
CREATE INDEX idx_chat_clinic ON chat_conversations(clinic_id);
