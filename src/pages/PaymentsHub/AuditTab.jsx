import React, { useState, useEffect } from 'react';
import { supabase } from '@/config/supabaseClient';
import { T, Badge, Btn, fmt } from '@/lms-common';

const AuditTab = () => {
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ type: '', status: '' });

  const fetchTxs = async () => {
    setLoading(true);
    let query = supabase.from('transactions').select('*, customers(name)');
    if (filter.type) query = query.eq('type', filter.type);
    if (filter.status) query = query.eq('status', filter.status);
    
    const { data } = await query.order('created_at', { ascending: false }).limit(100);
    if (data) setTxs(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchTxs();
  }, [filter]);

  const statusColors = {
    completed: T.ok,
    failed: T.danger,
    pending: T.gold,
    processing: T.blue
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: 16, 
        background: T.surface, 
        border: `1px solid ${T.border}`, 
        borderRadius: 12 
      }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <select 
            value={filter.type} 
            onChange={(e) => setFilter({ ...filter, type: e.target.value })}
            style={{ 
              background: T.card, 
              border: `1px solid ${T.border}`, 
              color: T.txt, 
              padding: '8px 12px', 
              borderRadius: 8, 
              fontSize: 13,
              outline: 'none'
            }}
          >
            <option value="">All Types</option>
            <option value="disbursement">Disbursement</option>
            <option value="registration_fee">Registration Fee</option>
            <option value="paybill_receipt">Paybill Receipt</option>
          </select>
          <select 
            value={filter.status} 
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            style={{ 
              background: T.card, 
              border: `1px solid ${T.border}`, 
              color: T.txt, 
              padding: '8px 12px', 
              borderRadius: 8, 
              fontSize: 13,
              outline: 'none'
            }}
          >
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
        </div>
        <Btn v="secondary" sm onClick={() => alert('Feature coming soon: CSV Export')}>
          📊 Export CSV
        </Btn>
      </div>

      <div style={{ overflowX: 'auto', border: `1px solid ${T.border}`, borderRadius: 12, background: T.card, width: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 800 }}>
          <thead>
            <tr style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
              <th style={{ padding: '14px clamp(12px, 2vw, 20px)', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Timestamp</th>
              <th style={{ padding: '14px clamp(12px, 2vw, 20px)', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Type</th>
              <th style={{ padding: '14px clamp(12px, 2vw, 20px)', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Customer</th>
              <th style={{ padding: '14px clamp(12px, 2vw, 20px)', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Amount</th>
              <th style={{ padding: '14px clamp(12px, 2vw, 20px)', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Receipt/ID</th>
              <th style={{ padding: '14px clamp(12px, 2vw, 20px)', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '60px 0', color: T.muted }}>Loading ledger...</td></tr>
            ) : txs.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '60px 0', color: T.muted }}>No matching transactions found.</td></tr>
            ) : (
              txs.map((tx) => (
                <tr key={tx.id} style={{ borderBottom: `1px solid ${T.border}`, transition: 'background 0.2s' }}>
                  <td style={{ padding: '16px clamp(12px, 2vw, 20px)', fontSize: 12, color: T.muted, fontFamily: T.mono }}>
                    {new Date(tx.created_at).toLocaleString('en-KE')}
                  </td>
                  <td style={{ padding: '16px clamp(12px, 2vw, 20px)' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: T.dim, background: T.surface, padding: '2px 8px', borderRadius: 6, border: `1px solid ${T.border}`, whiteSpace: 'nowrap' }}>
                      {tx.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '16px clamp(12px, 2vw, 20px)', fontSize: 14, fontWeight: 700, color: T.txt }}>
                    {tx.customers?.name || <span style={{ color: T.muted, fontWeight: 400, opacity: 0.6 }}>Manual Entry</span>}
                  </td>
                  <td style={{ padding: '16px clamp(12px, 2vw, 20px)', fontWeight: 900, color: T.accent }}>{fmt(tx.amount)}</td>
                  <td style={{ padding: '16px clamp(12px, 2vw, 20px)', fontSize: 11, fontFamily: T.mono, color: T.dim }}>
                    {tx.mpesa_receipt_no || tx.mpesa_transaction_id || '-'}
                  </td>
                  <td style={{ padding: '16px clamp(12px, 2vw, 20px)' }}>
                    <Badge color={statusColors[tx.status] || T.muted}>{tx.status?.toUpperCase()}</Badge>
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

export default AuditTab;
