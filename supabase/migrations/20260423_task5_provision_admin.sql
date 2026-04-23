-- ================================================================
-- MIGRATION: Provision Root Admin (gkadi97)
-- ================================================================

-- 1. Insert the primary admin into the workers table
-- This allows the system to recognize the email as Super Admin upon auth.
INSERT INTO public.workers (name, email, role, status, joined, avatar)
VALUES ('Root Admin', 'gkadi97@gmail.com', 'Super Admin', 'Active', CURRENT_DATE, 'GA')
ON CONFLICT (email) DO UPDATE 
SET role = 'Super Admin', 
    status = 'Active';

-- 2. Audit the change
INSERT INTO public.audit_log (user_name, action, detail)
VALUES ('System', 'Root Admin Provisioned', 'gkadi97@gmail.com granted Super Admin privileges.');
