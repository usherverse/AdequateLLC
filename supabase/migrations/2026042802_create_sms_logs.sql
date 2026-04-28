-- Migration: Create sms_logs table for debugging
CREATE TABLE IF NOT EXISTS public.sms_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    phone TEXT,
    message TEXT,
    status_code INTEGER,
    response_body JSONB,
    sender_id TEXT,
    source TEXT
);

-- Enable RLS
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can do everything" ON public.sms_logs TO service_role USING (true) WITH CHECK (true);
