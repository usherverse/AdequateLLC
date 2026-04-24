import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/config/supabaseClient';

export function useDisbursements() {
  const [loading, setLoading] = useState(false);
  const [waitingForCallback, setWaitingForCallback] = useState(false);
  const [status, setStatus] = useState(null); // 'Pending' | 'Completed' | 'Failed'
  const [failureReason, setFailureReason] = useState(null);
  const [error, setError] = useState(null);
  const [activeLoanId, setActiveLoanId] = useState(null);
  const [requestId, setRequestId] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const { session } = useAuth();

  const fetchStatus = useCallback(async () => {
    if (!activeLoanId) return;
    try {
      let query = supabase.from('b2c_disbursements').select('*').eq('loan_id', activeLoanId);
      
      // Filter by current request if we are waiting, otherwise just look for success
      if (waitingForCallback && requestId) {
        query = query.eq('conversation_id', requestId);
      } else {
        query = query.eq('status', 'Completed');
      }

      const { data, error: sbErr } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();

      if (sbErr) throw sbErr;
      if (data) {
        setStatus(data.status);
        if (data.status === 'Completed') {
          setWaitingForCallback(false);
          setIsSuccess(true);
          setFailureReason(null);
        } else if (waitingForCallback && data.status === 'Failed') {
          setWaitingForCallback(false);
          setFailureReason(data.error_message || 'B2C Disbursement failed.');
        }
      }
    } catch (err) {
      console.error('[Disbursement Poll Error]', err.message);
    }
  }, [activeLoanId, waitingForCallback, requestId]);

  useEffect(() => {
    if (!waitingForCallback || !activeLoanId) return;
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, [waitingForCallback, activeLoanId, fetchStatus]);

  const disburse = useCallback(async (loanId) => {
    if (!session?.access_token) {
      setError('You are not logged in or your session has expired.');
      return;
    }
    
    setLoading(true);
    setError(null);
    setFailureReason(null);
    setStatus('Pending');
    setActiveLoanId(loanId);
    setRequestId(null);

    try {
      // SECURITY (VULN-01): No phone is sent in the request body.
      // The server resolves the recipient phone from the verified
      // customer record. Sending a phone here was an attack vector.
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const response = await fetch(`${supabaseUrl}/functions/v1/mpesa-b2c-disburse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'X-Idempotency-Key': `disburse-${loanId}-${Date.now()}`
        },
        body: JSON.stringify({ loan_id: loanId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Disbursement failed');
      
      setRequestId(data.ConversationID);
      setWaitingForCallback(true);
      return data;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [session]);

  const reset = useCallback(() => {
    setStatus(null);
    setWaitingForCallback(false);
    setFailureReason(null);
    setError(null);
    setIsSuccess(false);
    setActiveLoanId(null);
    setRequestId(null);
  }, []);

  return { disburse, loading, waitingForCallback, status, isSuccess, failureReason, error, reset };
}
