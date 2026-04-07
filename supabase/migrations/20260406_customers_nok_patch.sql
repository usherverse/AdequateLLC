-- ADEQUATE CAPITAL LMS
-- Patch: Enforce Next of Kin and missing Customer tracking fields

ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS alt_phone TEXT,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS dob DATE,
ADD COLUMN IF NOT EXISTS n1_name TEXT,
ADD COLUMN IF NOT EXISTS n1_phone TEXT,
ADD COLUMN IF NOT EXISTS n1_relation TEXT,
ADD COLUMN IF NOT EXISTS n2_name TEXT,
ADD COLUMN IF NOT EXISTS n2_phone TEXT,
ADD COLUMN IF NOT EXISTS n2_relation TEXT,
ADD COLUMN IF NOT EXISTS n3_name TEXT,
ADD COLUMN IF NOT EXISTS n3_phone TEXT,
ADD COLUMN IF NOT EXISTS n3_relation TEXT,
ADD COLUMN IF NOT EXISTS from_lead TEXT;

-- Confirm success by running a select or verifying table definition
