CREATE TABLE IF NOT EXISTS paybill_balance (
    id SERIAL PRIMARY KEY,
    utility_balance NUMERIC DEFAULT 0,
    working_balance NUMERIC DEFAULT 0,
    charges_balance NUMERIC DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure a single row exists
INSERT INTO paybill_balance (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE paybill_balance ENABLE ROW LEVEL SECURITY;

-- Simple public policy for dashboard access
DROP POLICY IF EXISTS "Public Balance Access" ON paybill_balance;
CREATE POLICY "Public Balance Access" ON paybill_balance FOR ALL USING (true);

-- Grant access to roles
GRANT ALL ON paybill_balance TO service_role;
GRANT ALL ON paybill_balance TO anon;
GRANT ALL ON paybill_balance TO authenticated;
