import React, { useState, useEffect } from 'react';
import { supabase } from '@/config/supabaseClient';
import { T, Badge, Btn, fmt } from '@/lms-common';

const PaybillReceiptsTab = () => {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReceipts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('transactions')
      .select('*, customers(name)')
      .eq('type', 'paybill_receipt')
      .order('created_at', { ascending: false });
    
    if (data) setReceipts(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchReceipts();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        background: T.bLo, 
        padding: '20px 24px', 
        borderRadius: 16, 
        border: `1px dashed ${T.blue}40` 
      }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: T.blue, margin: 0 }}>M-Pesa Paybill Receipts (C2B)</h2>
          <p style={{ fontSize: 12, color: T.blue, opacity: 0.8, marginTop: 4 }}>Incoming payments from Paybill 174379 / 600000</p>
        </div>
        <Btn onClick={fetchReceipts} v="blue" sm>🔄 Refresh</Btn>
      </div>

      <div style={{ overflowX: 'auto', border: `1px solid ${T.border}`, borderRadius: 16, background: T.card }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
              <th style={{ padding: '14px 20px', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Date</th>
              <th style={{ padding: '14px 20px', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Receipt No</th>
              <th style={{ padding: '14px 20px', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Amount</th>
              <th style={{ padding: '14px 20px', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Sender Phone</th>
              <th style={{ padding: '14px 20px', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Matched Customer</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: '60px 0', color: T.muted }}>Fetching transactions...</td></tr>
            ) : receipts.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: '60px 0', color: T.muted }}>No Paybill receipts found using the automated webhook.</td></tr>
            ) : (
              receipts.map((r) => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${T.border}`, transition: 'background 0.2s' }}>
                  <td style={{ padding: '16px 20px', fontSize: 12, color: T.muted, fontFamily: T.mono }}>
                    {new Date(r.created_at).toLocaleString('en-KE')}
                  </td>
                  <td style={{ padding: '16px 20px', fontWeight: 800, color: T.blue }}>{r.mpesa_receipt_no}</td>
                  <td style={{ padding: '16px 20px', fontWeight: 900, color: T.txt }}>{fmt(r.amount)}</td>
                  <td style={{ padding: '16px 20px', fontSize: 13, color: T.dim, fontFamily: T.mono }}>
                    {r.phone?.substring(0, 10)}...
                  </td>
                  <td style={{ padding: '16px 20px', fontSize: 14, fontWeight: 700, color: T.txt }}>
                    {r.customers?.name || <span style={{ color: T.danger, fontStyle: 'italic', opacity: 0.7 }}>Unlinked Ledger Entry</span>}
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

export default PaybillReceiptsTab;
