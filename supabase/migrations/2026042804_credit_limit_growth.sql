-- Migration: Credit Limit & Growth Logic
-- Adds credit limit tracking and automated growth determination.

-- 1. Add credit_limit column to customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS credit_limit DECIMAL DEFAULT 5000;

-- 2. Update Risk Profile View with growth logic
DROP VIEW IF EXISTS public.customer_risk_profiles;
CREATE OR REPLACE VIEW public.customer_risk_profiles AS
WITH loan_metrics AS (
    SELECT 
        customer_id,
        COUNT(*) as total_loans,
        COUNT(*) FILTER (WHERE status = 'Settled') as settled_loans,
        COALESCE(MAX(days_overdue), 0) as max_overdue_days,
        SUM(balance) as total_outstanding,
        SUM(amount) as total_borrowed
    FROM public.loans
    GROUP BY customer_id
),
payment_metrics AS (
    SELECT 
        customer_id,
        COUNT(*) as payment_count,
        MAX(date) as last_payment_date,
        SUM(amount) as total_repaid
    FROM public.payments
    WHERE status = 'Allocated'
    GROUP BY customer_id
)
SELECT 
    c.id as customer_id,
    c.name as customer_name,
    c.credit_limit as current_limit,
    COALESCE(lm.total_loans, 0) as total_loans,
    COALESCE(lm.settled_loans, 0) as settled_loans,
    COALESCE(lm.max_overdue_days, 0) as max_overdue_days,
    COALESCE(lm.total_outstanding, 0) as total_outstanding,
    COALESCE(pm.payment_count, 0) as payment_count,
    CASE 
        WHEN lm.max_overdue_days > 30 THEN 'Critical'
        WHEN lm.max_overdue_days > 14 THEN 'High'
        WHEN lm.max_overdue_days > 0 THEN 'Medium'
        WHEN lm.total_loans > 3 AND lm.max_overdue_days = 0 THEN 'A+'
        WHEN lm.total_loans > 0 AND lm.max_overdue_days = 0 THEN 'Low'
        ELSE 'New'
    END as calculated_risk,
    CASE
        WHEN pm.payment_count > (lm.total_loans * 4) THEN 'Frequent Partial'
        WHEN pm.payment_count > 0 THEN 'Standard'
        ELSE 'No History'
    END as repayment_style,
    -- Growth Logic:
    -- After 3 loans, if max_overdue is 0, they get a +2000 bump
    CASE 
        WHEN lm.total_loans < 3 THEN 'Maintain (Entry Phase)'
        WHEN lm.max_overdue_days > 0 THEN 'Frozen (Arrears Detected)'
        WHEN lm.total_loans >= 3 AND lm.max_overdue_days = 0 THEN 'Eligible for +2000'
        ELSE 'Review Required'
    END as limit_status,
    CASE 
        WHEN lm.total_loans >= 3 AND lm.max_overdue_days = 0 THEN c.credit_limit + 2000
        ELSE c.credit_limit
    END as suggested_limit
FROM public.customers c
LEFT JOIN loan_metrics lm ON c.id = lm.customer_id
LEFT JOIN payment_metrics pm ON c.id = pm.customer_id;
