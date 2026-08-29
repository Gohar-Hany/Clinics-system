-- =============================================
-- 008: Create Queue State Table
-- (Synced periodically from Redis SSOT)
-- =============================================

CREATE TABLE IF NOT EXISTS queue_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id),
    queue_date DATE NOT NULL,
    current_number INTEGER DEFAULT 0,      -- Synced from Redis
    total_in_queue INTEGER DEFAULT 0,      -- Synced from Redis
    queue_entries JSONB DEFAULT '[]',      -- Snapshot from Redis
    last_synced_at TIMESTAMPTZ DEFAULT now(),
    last_updated TIMESTAMPTZ DEFAULT now(),

    -- One queue per doctor per day
    UNIQUE(clinic_id, doctor_id, queue_date)
);

CREATE INDEX idx_queue_state_date ON queue_state(clinic_id, queue_date);
