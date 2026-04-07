import React, { useState, useEffect } from 'react';
import { supabase } from '@/config/supabaseClient';
import { T, Badge, Btn, fmt } from '@/lms-common';
import { useDisbursements } from './hooks/useDisbursements';

const DisbursementsTab = () => {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const { disburse, loading: disburseLoading } = useDisbursements();

  const fetchApprovedLoans = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('loans')
      .select('*, customers(name, phone)')
      .eq('status', 'Approved');
    
    if (data) setLoans(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchApprovedLoans();
  }, []);

  const handleDisburse = async (loanId) => {
    if (!window.confirm('Are you sure you want to disburse this loan?')) return;
    try {
      await disburse(loanId);
      fetchApprovedLoans(); // Refresh
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: T.txt, margin: 0 }}>Approved Loans Pending Disbursement</h2>
        <Btn onClick={fetchApprovedLoans} sm v="secondary">🔄 Refresh List</Btn>
      </div>

      <div style={{ overflowX: 'auto', border: `1px solid ${T.border}`, borderRadius: 12, background: T.card }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
              <th style={{ padding: '14px 20px', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Customer</th>
              <th style={{ padding: '14px 20px', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Phone</th>
              <th style={{ padding: '14px 20px', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Amount</th>
              <th style={{ padding: '14px 20px', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Loan ID</th>
              <th style={{ padding: '14px 20px', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Status</th>
              <th style={{ padding: '14px 20px', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '60px 0', color: T.muted }}>Loading loans...</td></tr>
            ) : loans.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '60px 0', color: T.muted }}>No approved loans pending.</td></tr>
            ) : (
              loans.map((loan) => (
                <tr key={loan.id} style={{ borderBottom: `1px solid ${T.border}`, transition: 'background 0.2s' }}>
                  <td style={{ padding: '16px 20px', fontWeight: 700, color: T.txt }}>{loan.customers?.name || loan.customer_name}</td>
                  <td style={{ padding: '16px 20px', color: T.dim, fontFamily: T.mono, fontSize: 13 }}>{loan.phone || loan.customers?.phone}</td>
                  <td style={{ padding: '16px 20px', fontWeight: 900, color: T.accent }}>{fmt(loan.amount)}</td>
                  <td style={{ padding: '16px 20px', color: T.muted, fontSize: 11, fontFamily: T.mono }}>{loan.id}</td>
                  <td style={{ padding: '16px 20px' }}>
                    <Badge color={T.gold}>{loan.status}</Badge>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <Btn
                      onClick={() => handleDisburse(loan.id)}
                      disabled={disburseLoading}
                      v="ok"
                      sm
                      full
                    >
                      {disburseLoading ? 'Processing...' : '📤 Disburse Now'}
                    </Btn>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DisbursementsTab;
