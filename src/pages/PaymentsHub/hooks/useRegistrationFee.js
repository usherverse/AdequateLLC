import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/config/supabaseClient';

export function useRegistrationFee(customerId) {
  const [status, setStatus] = useState('pending'); // 'pending' | 'paid' | 'failed'
  const [loading, setLoading] = useState(false);
  const [waitingForCallback, setWaitingForCallback] = useState(false);
  const [requestId, setRequestId] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [failureReason, setFailureReason] = useState(null);
  const [error, setError] = useState(null);

  const fetchStatus = useCallback(async () => {
    // Guard: do nothing if no customer is selected
    if (!customerId) return;
    try {
      const { data: cust } = await supabase
        .from('customers')
        .select('mpesa_registered')
        .eq('id', customerId)
        .maybeSingle();

      if (cust?.mpesa_registered === true) {
        setStatus('paid');
        setWaitingForCallback(false);
        return;
      }

      // 2) Check payments ledger
      const { data: regPayment } = await supabase
        .from('payments')
        .select('id')
        .eq('customer_id', customerId)
        .eq('is_reg_fee', true)
        .maybeSingle();

      if (regPayment) {
        setStatus('paid');
        setWaitingForCallback(false);
        return;
      }

      // 3) Check STK requests (only poll if actively waiting for a push)
      if (!waitingForCallback && !requestId) return;

      let query = supabase.from('stk_requests').select('status, result_desc').eq('reference', customerId);
      
      if (waitingForCallback && requestId) {
         query = query.eq('checkout_request_id', requestId);
      } else {
         query = query.eq('status', 'Completed');
      }

      const { data: stkReq, error: stkErr } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();

      // Silently ignore errors from missing stk_requests table (42P01) or no rows (PGRST116)
      if (stkErr && stkErr.code !== 'PGRST116' && stkErr.code !== '42P01') {
        setError(stkErr.message);
        return;
      }

      if (stkReq) {
        const s = stkReq.status?.toLowerCase();
        if (s === 'completed') {
           setStatus('paid');
           setWaitingForCallback(false);
           setIsSuccess(true);
           setFailureReason(null);
        } else if (waitingForCallback && (s === 'failed' || s === 'cancelled')) {
           setStatus('failed');
           setWaitingForCallback(false);
           setFailureReason(stkReq.result_desc || 'Transaction failed or cancelled by user.');
        }
      }
    } catch (err) {
      // Don't surface network errors during background polling
      console.warn('[useRegistrationFee] poll error:', err.message);
    }
  }, [customerId, waitingForCallback, requestId]);

  useEffect(() => {
    fetchStatus();
    // Only set up polling interval when we are actively waiting for a callback
    if (!waitingForCallback && status !== 'pending') return;
    const interval = setInterval(() => {
      if (waitingForCallback || status === 'pending') fetchStatus();
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchStatus, status, waitingForCallback]);

  const initiateStk = async (phone) => {
    setLoading(true);
    setError(null);
    setFailureReason(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/mpesa-stk-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          phone_number: phone, 
          amount: 500, 
          customer_id: customerId,
          description: 'Registration Fee'
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to initiate STK Push');
      
      setRequestId(data.checkout_id);
      setWaitingForCallback(true);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const reset = useCallback(() => {
    setStatus('pending');
    setWaitingForCallback(false);
    setRequestId(null);
    setIsSuccess(false);
    setFailureReason(null);
    setError(null);
  }, []);

  return { status, loading, waitingForCallback, isSuccess, failureReason, error, initiateStk, reset, refresh: fetchStatus };
}
