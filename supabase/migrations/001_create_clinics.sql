-- =============================================
-- 001: Create Clinics Table
-- =============================================

CREATE TABLE IF NOT EXISTS clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    secret_path TEXT NOT NULL UNIQUE,          -- 🔐 URL path for clinic portal
    config_token_hash TEXT NOT NULL,           -- 🔐 Hashed access token
    settings JSONB DEFAULT '{}',
    working_hours JSONB DEFAULT '{
        "sunday": {"start": "09:00", "end": "17:00", "active": true},
        "monday": {"start": "09:00", "end": "17:00", "active": true},
        "tuesday": {"start": "09:00", "end": "17:00", "active": true},
        "wednesday": {"start": "09:00", "end": "17:00", "active": true},
        "thursday": {"start": "09:00", "end": "17:00", "active": true},
        "friday": {"start": "09:00", "end": "14:00", "active": true},
        "saturday": {"start": "09:00", "end": "14:00", "active": false}
    }',
    avg_consultation_minutes INTEGER DEFAULT 20,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for secret path lookup
CREATE INDEX idx_clinics_secret_path ON clinics(secret_path);
