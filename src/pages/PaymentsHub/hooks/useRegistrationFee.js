import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/config/supabaseClient';

export function useRegistrationFee(customerId) {
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStatus = useCallback(async () => {
    if (!customerId) return;
    try {
      const { data, error } = await supabase
        .from('registration_fees')
        .select('*')
        .eq('customer_id', customerId)
        .single();
      
      if (data) setStatus(data.status);
      if (error && error.code !== 'PGRST116') setError(error.message);
    } catch (err) {
      setError(err.message);
    }
  }, [customerId]);

  useEffect(() => {
    fetchStatus();
    // Polling every 10 seconds if still pending
    const interval = setInterval(() => {
      if (status === 'pending') fetchStatus();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus, status]);

  const initiateStk = async (phone) => {
    setLoading(true);
    try {
      // Assuming the backend is at http://localhost:3001/api/v1/payments
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/payments/registration-fee/stk-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, phone })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to initiate STK Push');
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { status, loading, error, initiateStk, refresh: fetchStatus };
}
