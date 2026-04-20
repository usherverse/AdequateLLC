-- Security Helper Functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workers 
    WHERE email = auth.jwt() ->> 'email' 
    AND (role::text = 'Admin' OR role::text = 'Super Admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- Create monthly_targets table
CREATE TABLE IF NOT EXISTS public.monthly_targets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    month text NOT NULL UNIQUE, -- format 'YYYY-MM'
    total_target_amount numeric(15,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.monthly_targets ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Admins can do everything with targets" ON public.monthly_targets;
CREATE POLICY "Admins can do everything with targets" ON public.monthly_targets
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated users can view targets" ON public.monthly_targets;
CREATE POLICY "Authenticated users can view targets" ON public.monthly_targets
    FOR SELECT
    TO authenticated
    USING (true);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_monthly_targets_updated_at ON public.monthly_targets;
CREATE TRIGGER trg_monthly_targets_updated_at 
    BEFORE UPDATE ON public.monthly_targets 
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
