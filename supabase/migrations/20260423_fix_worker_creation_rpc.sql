-- ADEQUATE CAPITAL LMS - Production Worker Management RPC
-- Fixes VULN-05 and the "Only admins can create workers" error.

-- 1. Ensure is_admin() is robust and checks both Role and Email
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workers 
    WHERE email = auth.jwt() ->> 'email' 
    AND (role::text ILIKE 'Admin' OR role::text ILIKE 'Super Admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the create_worker RPC with SECURITY DEFINER
-- We drop any existing function first to avoid signature/return type conflicts.
DROP FUNCTION IF EXISTS public.create_worker(TEXT, TEXT, TEXT, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.create_worker(
  p_name TEXT,
  p_email TEXT,
  p_role TEXT,
  p_phone TEXT,
  p_avatar TEXT,
  p_auth_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  role TEXT,
  status TEXT
) AS $$
BEGIN
  -- Security Gate
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can create workers';
  END IF;

  -- Insert the worker
  INSERT INTO public.workers (
    name,
    email,
    role,
    phone,
    avatar,
    status,
    joined,
    auth_user_id
  ) VALUES (
    p_name,
    p_email,
    p_role,
    p_phone,
    p_avatar,
    'Active',
    CURRENT_DATE,
    p_auth_user_id
  );

  RETURN QUERY
  SELECT w.id, w.name, w.email, w.role, w.status
  FROM public.workers w
  WHERE w.email = p_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Grant permissions
GRANT EXECUTE ON FUNCTION public.create_worker TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_worker TO service_role;

-- 4. EMERGENCY FIX: Ensure the user 'usherverse@gmail.com' is recognized as Super Admin
-- This handles the case where the user is logged in but doesn't have a worker record yet.
INSERT INTO public.workers (name, email, role, status, joined, avatar)
VALUES ('usher', 'usherverse@gmail.com', 'Super Admin', 'Active', CURRENT_DATE, 'US')
ON CONFLICT (email) DO UPDATE 
SET role = 'Super Admin', status = 'Active';
