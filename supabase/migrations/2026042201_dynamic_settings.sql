-- ================================================================
-- MIGRATION: System Settings & Product Management
-- ================================================================

-- 1. System Settings Table (Key-Value)
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- 2. Default Settings Seed
INSERT INTO system_settings (key, value, description) VALUES
('app_info', '{"name": "Adequate Capital", "currency": "KES", "support_email": "support@adequate-llc.com"}', 'General application branding'),
('loan_constants', '{"daily_rate": 0.012, "interest_days": 30, "penalty_days": 30, "freeze_after": 60}', 'Core financial engine parameters'),
('mpesa_config', '{"b2c_shortcode": "600000", "c2b_shortcode": "700000", "timeout_url": "", "result_url": ""}', 'M-Pesa integration settings')
ON CONFLICT (key) DO NOTHING;

-- 3. Loan Products Table (Future-proofing)
CREATE TABLE IF NOT EXISTS loan_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    daily_rate NUMERIC(10,5) DEFAULT 0.012,
    base_interest_rate NUMERIC(10,5) DEFAULT 0.30,
    min_amount NUMERIC(15,2) DEFAULT 500,
    max_amount NUMERIC(15,2) DEFAULT 50000,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default product
INSERT INTO loan_products (name, daily_rate, base_interest_rate)
VALUES ('Standard Silver', 0.012, 0.30)
ON CONFLICT (name) DO NOTHING;

-- 4. Security (RLS)
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read system_settings" ON system_settings;
CREATE POLICY "Public read system_settings" ON system_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage system_settings" ON system_settings;
CREATE POLICY "Admins manage system_settings" ON system_settings FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Public read loan_products" ON loan_products;
CREATE POLICY "Public read loan_products" ON loan_products FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage loan_products" ON loan_products;
CREATE POLICY "Admins manage loan_products" ON loan_products FOR ALL TO authenticated USING (public.is_admin());
