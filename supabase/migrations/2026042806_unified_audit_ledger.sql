-- Migration: Unified Financial Ledger View
-- Creates a single view for all cash-in (payments) and cash-out (disbursements) transactions.

CREATE OR REPLACE VIEW public.unified_audit_ledger AS
SELECT 
    'payment' as tx_type,
    p.id,
    p.created_at,
    p.customer_name,
    p.amount,
    p.mpesa as reference,
    p.status,
    p.is_reg_fee,
    p.loan_id
FROM public.payments p
UNION ALL
SELECT 
    'disbursement' as tx_type,
    d.id::text,
    d.created_at,
    c.name as customer_name,
    d.amount,
    d.transaction_id as reference,
    d.status,
    false as is_reg_fee,
    d.loan_id
FROM public.b2c_disbursements d
LEFT JOIN public.customers c ON d.customer_id = c.id;
