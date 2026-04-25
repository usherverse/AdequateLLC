
CREATE TABLE IF NOT EXISTS raw_mpesa_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    payload JSONB,
    source TEXT
);
GRANT ALL ON raw_mpesa_logs TO service_role;
GRANT ALL ON raw_mpesa_logs TO anon;
