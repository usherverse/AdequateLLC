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

      // 3) Check STK requests
      let query = supabase.from('stk_requests').select('status, result_desc').eq('reference', customerId);
      
      // CRITICAL FIX: Only look for failures if we are actively waiting for a specific request
      if (waitingForCallback && requestId) {
         query = query.eq('checkout_request_id', requestId);
      } else {
         query = query.eq('status', 'Completed'); // Only care about prior completions
      }

      const { data: stkReq, error: stkErr } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();

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
      if (stkErr && stkErr.code !== 'PGRST116') setError(stkErr.message);
    } catch (err) {
      setError(err.message);
    }
  }, [customerId, waitingForCallback, requestId]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => {
      // Only poll for status changes while we are waiting or if not yet paid
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
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/v1/payments/registration-fee/stk-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ customerId, phone })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to initiate STK Push');
      
      setRequestId(data.CheckoutRequestID);
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
