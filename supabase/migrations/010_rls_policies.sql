-- =============================================
-- 010: Row Level Security Policies
-- Multi-tenant isolation by clinic_id
-- =============================================

-- Enable RLS on all tables
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

-- For MVP: service_role key bypasses RLS.
-- Policies below are for future Supabase Auth integration.

-- Clinics: Only see own clinic
CREATE POLICY "clinics_tenant_isolation" ON clinics
    FOR ALL USING (true);  -- MVP: open (will restrict with auth later)

-- Doctors: Only see doctors in same clinic
CREATE POLICY "doctors_tenant_isolation" ON doctors
    FOR ALL USING (true);

-- Patients: Only see patients in same clinic
CREATE POLICY "patients_tenant_isolation" ON patients
    FOR ALL USING (true);

-- Appointments: Only see appointments in same clinic
CREATE POLICY "appointments_tenant_isolation" ON appointments
    FOR ALL USING (true);

-- Consultations: Only see consultations for own clinic's patients
CREATE POLICY "consultations_tenant_isolation" ON consultations
    FOR ALL USING (true);

-- Prescriptions: Same
CREATE POLICY "prescriptions_tenant_isolation" ON prescriptions
    FOR ALL USING (true);

-- Medical Images: Same
CREATE POLICY "medical_images_tenant_isolation" ON medical_images
    FOR ALL USING (true);

-- Queue State: Same
CREATE POLICY "queue_state_tenant_isolation" ON queue_state
    FOR ALL USING (true);

-- Chat Conversations: Same
CREATE POLICY "chat_conversations_tenant_isolation" ON chat_conversations
    FOR ALL USING (true);

-- =============================================
-- NOTE: In production, replace USING (true)
-- with proper tenant filtering:
--
-- USING (
--   clinic_id = (
--     SELECT clinic_id FROM doctors
--     WHERE user_id = auth.uid()
--   )
-- )
-- =============================================
