import { useState, useCallback } from 'react';

export function useDisbursements() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const disburse = useCallback(async (loanId) => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/payments/disbursements/${loanId}/disburse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('supabase.auth.token') || ''}`,
          'X-Idempotency-Key': `disburse-${loanId}-${Date.now()}`
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Disbursement failed');
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { disburse, loading, error };
}
