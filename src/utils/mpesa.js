import { supabase, DEMO_MODE } from '@/config/supabaseClient';

/**
 * mpesa.js — Frontend Gateway for Daraja Supabase Edge Functions
 * All calls go directly to Supabase Edge Functions.
 * The old Express server (localhost:3001) has been retired.
 */

const getEdgeUrl = (path) => {
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!base) throw new Error('VITE_SUPABASE_URL is not set in environment variables.');
  return `${base}/functions/v1/${path}`;
};

const getAuthToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || '';
};

/**
 * initiateStkPush
 * Triggers an M-Pesa STK Push via the mpesa-stk-push Edge Function.
 */
export async function initiateStkPush({ amount, phone_number, customer_id }) {
  if (DEMO_MODE) {
    console.warn('[M-Pesa] STK Push simulated in Demo Mode');
    return { success: true, message: 'Demo Mode: Push simulated' };
  }

  try {
    const token = await getAuthToken();
    const response = await fetch(getEdgeUrl('mpesa-stk-push'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ phone_number, amount, customer_id })
    });

    const res = await response.json();
    if (!response.ok) throw new Error(res.error || 'STK Push failed');
    return { success: true, ...res };
  } catch (err) {
    console.error('[M-Pesa] STK Push failed:', err.message);
    throw err;
  }
}

/**
 * initiateB2cDisbursement
 * Triggers an M-Pesa B2C disbursement via the mpesa-b2c-disburse Edge Function.
 */
export async function initiateB2cDisbursement(loan_id) {
  if (DEMO_MODE) {
    console.warn('[M-Pesa] B2C Disbursement simulated in Demo Mode');
    return { success: true, message: 'Demo Mode: Disbursement simulated' };
  }

  try {
    const token = await getAuthToken();
    const response = await fetch(getEdgeUrl('mpesa-b2c-disburse'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ loan_id })
    });

    const res = await response.json();
    if (!response.ok) throw new Error(res.error || 'Disbursement failed');
    return { success: true, ...res };
  } catch (err) {
    console.error('[M-Pesa] B2C Disbursement failed:', err.message);
    throw err;
  }
}

/**
 * initiateWorkerPayout
 * Triggers a salary B2C payout for a worker via the mpesa-b2c-disburse Edge Function.
 */
export async function initiateWorkerPayout({ worker_id, amount, phone }) {
  if (DEMO_MODE) {
    console.warn('[M-Pesa] Worker payout simulated in Demo Mode');
    return { success: true, message: 'Demo Mode: Payout simulated' };
  }

  try {
    const token = await getAuthToken();
    const response = await fetch(getEdgeUrl('mpesa-b2c-disburse'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ worker_id, amount, phone, type: 'salary' })
    });

    const res = await response.json();
    if (!response.ok) throw new Error(res.error || 'Worker payout failed');
    return { success: true, ...res };
  } catch (err) {
    console.error('[M-Pesa] Worker payout failed:', err.message);
    throw err;
  }
}
