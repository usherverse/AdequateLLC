/**
 * deploy_apply_c2b_payment_rpc.js
 * Deploys the apply_c2b_payment stored procedure directly to Supabase
 * using the service role key (bypasses RLS).
 * 
 * Run: node --env-file=.env server/deploy_apply_c2b_payment_rpc.js
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const sql = `
CREATE OR REPLACE FUNCTION apply_c2b_payment(
  p_customer_id    TEXT,
  p_customer_name  TEXT,
  p_loan_id        TEXT,
  p_amount         NUMERIC,
  p_mpesa_txid     TEXT,
  p_date           DATE,
  p_note           TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment_id      TEXT;
  v_new_balance     NUMERIC;
  v_new_status      TEXT;
  v_current_balance NUMERIC;
  v_current_status  TEXT;
  v_payment_status  TEXT;
  v_allocated_by    TEXT;
  v_allocated_at    TIMESTAMPTZ;
  v_is_reg_fee      BOOLEAN := false;
BEGIN
  -- 1. Idempotency guard
  IF EXISTS (SELECT 1 FROM payments WHERE mpesa = p_mpesa_txid LIMIT 1) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'duplicate_txid');
  END IF;

  -- 2. Lock loan row and compute new balance
  IF p_loan_id IS NOT NULL THEN
    SELECT balance, status
      INTO v_current_balance, v_current_status
      FROM loans
     WHERE id = p_loan_id
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Loan % not found', p_loan_id;
    END IF;

    v_new_balance    := GREATEST(0, v_current_balance - p_amount);
    v_new_status     := CASE WHEN v_new_balance <= 0 THEN 'Settled' ELSE v_current_status END;
    v_payment_status := 'Allocated';
    v_allocated_by   := 'System Engine';
    v_allocated_at   := NOW();
  ELSE
    IF p_amount = 500 OR p_note ILIKE '%Reg%' THEN
      p_loan_id        := 'REG-FEE-' || p_customer_id;
      v_payment_status := 'Allocated';
      v_allocated_by   := 'System Engine (Reg Fee)';
      v_allocated_at   := NOW();
      v_is_reg_fee     := true;
    ELSE
      v_payment_status := 'Unallocated';
      v_allocated_by   := NULL;
      v_allocated_at   := NULL;
    END IF;
  END IF;

  -- 3. Insert payment record
  INSERT INTO payments (
    customer_id, customer_name, loan_id, amount, mpesa,
    date, status, allocated_by, allocated_at, is_reg_fee, note
  )
  VALUES (
    p_customer_id, p_customer_name, p_loan_id, p_amount, p_mpesa_txid,
    p_date, v_payment_status, v_allocated_by, v_allocated_at, v_is_reg_fee, p_note
  )
  RETURNING id INTO v_payment_id;

  -- 4. Update loan balance (only if a loan was targeted)
  IF p_loan_id IS NOT NULL THEN
    UPDATE loans
       SET balance = v_new_balance,
           status  = v_new_status
     WHERE id = p_loan_id;
  END IF;

  -- 5. Return result
  RETURN jsonb_build_object(
    'success',     true,
    'payment_id',  v_payment_id,
    'loan_id',     p_loan_id,
    'new_balance', v_new_balance,
    'new_status',  v_new_status,
    'allocated',   (p_loan_id IS NOT NULL)
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[apply_c2b_payment] Error for TxID %: % %', p_mpesa_txid, SQLSTATE, SQLERRM;
    RETURN jsonb_build_object('success', false, 'reason', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION apply_c2b_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, DATE, TEXT)
  TO service_role;
`;

async function deploy() {
  console.log('[Deploy] Deploying apply_c2b_payment RPC to Supabase...');

  let execError;
  try {
    const res = await supabase.rpc('exec_sql', { query: sql });
    execError = res.error;
  } catch (e) {
    execError = { message: 'exec_sql not available' };
  }

  // Supabase anon client can't run raw SQL — use the REST API directly
  const res = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/rpc/apply_c2b_payment`, {
    method: 'HEAD',
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    }
  });

  // Try deploying via pg_net / direct SQL endpoint if available
  const sqlRes = await fetch(`${process.env.VITE_SUPABASE_URL}/pg/query`, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });

  if (sqlRes.ok) {
    console.log('✅ RPC deployed successfully via SQL endpoint.');
  } else {
    console.log('\n⚠️  Direct SQL endpoint not available (expected for Supabase hosted).');
    console.log('👉 Please run this SQL manually in the Supabase SQL Editor:');
    console.log('\n--- Copy everything below this line ---\n');
    console.log(sql);
    console.log('\n--- End of SQL ---');
  }
}

deploy();
