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

  // Handle Realtime Updates for Instantaneous Feedback
  useEffect(() => {
    if (!customerId) return;
    
    // 1. Initial check on mount
    fetchStatus();

    // 2. Set up Polling Fallback (Every 5 seconds)
    // This handles cases where Realtime is blocked or missed
    const pollInterval = setInterval(() => {
      if (waitingForCallback && requestId) {
        console.log('[useRegistrationFee] Polling for update...');
        fetchStatus();
      }
    }, 5000);

    // 3. Set up Targeted Reconciliation Fallback (After 20 seconds)
    // If we've waited 20s and still Pending, force a Safaricom query
    const reconTimeout = setTimeout(async () => {
      if (waitingForCallback && requestId) {
        console.log('[useRegistrationFee] Triggering targeted reconciliation for:', requestId);
        try {
          await supabase.functions.invoke('reconcile-mpesa', {
            body: { checkout_request_id: requestId }
          });
          // After calling reconcile, fetchStatus will see the DB update if Safaricom confirms success
          fetchStatus();
        } catch (err) {
          console.warn('[useRegistrationFee] Recon trigger failed:', err.message);
        }
      }
    }, 20000);

    // 4. Set up Realtime Subscription if waiting for a push
    let channel = null;
    if (waitingForCallback && requestId) {
      console.log('[useRegistrationFee] Subscribing to Realtime for:', requestId);
      
      channel = supabase
        .channel(`stk-${requestId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'stk_requests',
            filter: `checkout_request_id=eq.${requestId}`
          },
          (payload) => {
            const row = payload.new;
            console.log('[useRegistrationFee] Realtime Update Received:', row.status);
            
            const s = row.status?.toLowerCase();
            if (s === 'completed' || s === 'success') {
              setStatus('paid');
              setWaitingForCallback(false);
              setIsSuccess(true);
              setFailureReason(null);
              setRequestId(null);
            } else if (s === 'failed' || s === 'cancelled' || s === 'rejected') {
              setStatus('failed');
              setWaitingForCallback(false);
              setFailureReason(row.result_desc || 'Transaction was cancelled.');
              setRequestId(null);
            }
          }
        )
        .subscribe();

      // Safety Timeout (Total Fallback)
      const safetyTimeout = setTimeout(() => {
        if (waitingForCallback) {
          console.warn('[useRegistrationFee] Realtime fallback timeout');
          setWaitingForCallback(false);
          setStatus('failed');
          setFailureReason('The request timed out. Please check your phone.');
          setRequestId(null);
        }
      }, 90000);

      return () => {
        if (channel) supabase.removeChannel(channel);
        clearInterval(pollInterval);
        clearTimeout(reconTimeout);
        clearTimeout(safetyTimeout);
      };
    }

    return () => {
      clearInterval(pollInterval);
      clearTimeout(reconTimeout);
    };
  }, [customerId, waitingForCallback, requestId, fetchStatus]);

  const [abortController, setAbortController] = useState(null);

  const initiateStk = async (phone) => {
    // Create a new controller for this specific request
    const controller = new AbortController();
    setAbortController(controller);
    
    setLoading(true);
    setError(null);
    setFailureReason(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/mpesa-stk-push`, {
        method: 'POST',
        signal: controller.signal, // Connect the abort signal
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          phone_number: phone, 
          amount: 1, 
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
      if (err.name === 'AbortError') {
        console.log('[useRegistrationFee] Request aborted by user');
        return;
      }
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
      setAbortController(null);
    }
  };

  const reset = useCallback(() => {
    // 1. Instantly kill any active network request
    if (abortController) {
      abortController.abort();
    }
    
    // 2. Clear all states
    setWaitingForCallback(false);
    setRequestId(null);
    setStatus('pending');
    setIsSuccess(false);
    setFailureReason(null);
    setError(null);
    setLoading(false);
    setAbortController(null);
  }, [abortController]);

  return { status, loading, waitingForCallback, isSuccess, failureReason, error, initiateStk, reset, refresh: fetchStatus };
}
