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
      // 1) Primary: Check if already registered
      const { data: cust } = await supabase
        .from('customers')
        .select('mpesa_registered')
        .eq('id', customerId)
        .maybeSingle();

      if (cust?.mpesa_registered === true) {
        setStatus('paid');
        setWaitingForCallback(false);
        setRequestId(null); // Clear request once confirmed
        return;
      }

      // 2) Secondary: Check payments ledger for specific registration fee record
      const { data: regPayment } = await supabase
        .from('payments')
        .select('id')
        .eq('customer_id', customerId)
        .eq('is_reg_fee', true)
        .maybeSingle();

      if (regPayment) {
        setStatus('paid');
        setWaitingForCallback(false);
        setRequestId(null);
        return;
      }

      // 3) Polling: Only check STK requests if actively waiting for a push
      if (!waitingForCallback || !requestId) return;

      const { data: stkReq, error: stkErr } = await supabase
        .from('stk_requests')
        .select('status, result_desc')
        .eq('checkout_request_id', requestId)
        .maybeSingle();

      if (stkErr) {
        // Silently ignore table/row errors during background polling
        if (stkErr.code !== 'PGRST116' && stkErr.code !== '42P01') {
           console.warn('[useRegistrationFee] Query error:', stkErr.message);
        }
        return;
      }

      if (stkReq) {
        const s = stkReq.status?.toLowerCase();
        if (s === 'completed' || s === 'success') {
          setStatus('paid');
          setWaitingForCallback(false);
          setIsSuccess(true);
          setFailureReason(null);
          setRequestId(null);
        } else if (s === 'failed' || s === 'cancelled' || s === 'rejected') {
          setStatus('failed');
          setWaitingForCallback(false);
          setFailureReason(stkReq.result_desc || 'Transaction was cancelled or failed.');
          setRequestId(null);
        }
        // If 'Pending', we just let the next interval run
      }
    } catch (err) {
      console.warn('[useRegistrationFee] poll error:', err.message);
    }
  }, [customerId, waitingForCallback, requestId]);

  // Handle Initial Check and Polling
  useEffect(() => {
    if (!customerId) return;
    
    // Always do one immediate check on mount/customer change
    fetchStatus();

    // Set up polling ONLY when waiting for a callback
    if (waitingForCallback && requestId) {
      const interval = setInterval(fetchStatus, 4000);
      return () => clearInterval(interval);
    }
  }, [customerId, waitingForCallback, requestId, fetchStatus]);

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
    setWaitingForCallback(false);
    setRequestId(null);
    setStatus('pending');
    setIsSuccess(false);
    setFailureReason(null);
    setError(null);
  }, []);

  return { status, loading, waitingForCallback, isSuccess, failureReason, error, initiateStk, reset, refresh: fetchStatus };
}
