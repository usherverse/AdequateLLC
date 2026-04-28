-- Migration: Add loan_id to stk_requests for precise allocation
ALTER TABLE public.stk_requests ADD COLUMN IF NOT EXISTS loan_id TEXT REFERENCES public.loans(id);
