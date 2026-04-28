import React, { useState, useEffect } from 'react';
import { supabase } from '@/config/supabaseClient';
import { RotateCcw, ArrowDownLeft, ArrowUpRight, Activity, AlertCircle } from 'lucide-react';
import { T, Badge, Btn, fmt, Dialog, FI, Alert } from '@/lms-common';

const AuditTab = () => {
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revTarget, setRevTarget] = useState(null);
  const [revReason, setRevReason] = useState('Wrong Number');

  const fetchTxs = async () => {
    setLoading(true);
    const { data, error } = await supabase
        .from('unified_audit_ledger')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
    
    if (data) setTxs(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchTxs();
  }, []);

  const handleReverse = async () => {
    if (!revTarget || !revReason) return;
    const tx = revTarget;

    setLoading(true);
    setRevTarget(null);
    try {
      const { data, error } = await supabase.functions.invoke('mpesa-reversal', {
        body: {
          tx_type: tx.tx_type,
          id: tx.id,
          reason: revReason
        }
      });

      if (error) {
        // Parse the error message from the Edge Function
        let msg = error.message;
        try {
          const body = await error.context?.json();
          if (body?.error) msg = body.error;
        } catch(e) {}
        throw new Error(msg);
      }
      
      alert(data.message || 'Reversal initiated successfully.');
      fetchTxs();
    } catch (err) {
      alert('Reversal Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const statusColors = {
    Allocated: T.ok,
    Unallocated: T.warn,
    completed: T.ok,
    Success: T.ok,
    failed: T.danger,
    Reversed: T.danger
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
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ background: `${T.accent}15`, padding: 8, borderRadius: 8 }}>
            <Activity size={18} color={T.accent} />
          </div>
          <div>
            <div style={{ color: T.txt, fontWeight: 800, fontSize: 14 }}>Unified Financial Audit</div>
            <div style={{ color: T.muted, fontSize: 11 }}>Complete history of capital flow (In/Out)</div>
          </div>
        </div>
        <Btn v="secondary" sm onClick={() => fetchTxs()}>
          🔄 Refresh Ledger
        </Btn>
      </div>

      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 350px)', border: `1px solid ${T.border}`, borderRadius: 12, background: T.card, width: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 900 }}>
          <thead>
            <tr style={{ background: T.surface }}>
              <th style={{ position: 'sticky', top: 0, zIndex: 10, background: T.surface, borderBottom: `1px solid ${T.border}`, padding: '14px 20px', color: T.muted, fontSize: 10, fontWeight: 850, textTransform: 'uppercase', letterSpacing: 1 }}>Timestamp</th>
              <th style={{ position: 'sticky', top: 0, zIndex: 10, background: T.surface, borderBottom: `1px solid ${T.border}`, padding: '14px 20px', color: T.muted, fontSize: 10, fontWeight: 850, textTransform: 'uppercase', letterSpacing: 1 }}>Type</th>
              <th style={{ position: 'sticky', top: 0, zIndex: 10, background: T.surface, borderBottom: `1px solid ${T.border}`, padding: '14px 20px', color: T.muted, fontSize: 10, fontWeight: 850, textTransform: 'uppercase', letterSpacing: 1 }}>Recipient / Payer</th>
              <th style={{ position: 'sticky', top: 0, zIndex: 10, background: T.surface, borderBottom: `1px solid ${T.border}`, padding: '14px 20px', color: T.muted, fontSize: 10, fontWeight: 850, textTransform: 'uppercase', letterSpacing: 1 }}>Amount</th>
              <th style={{ position: 'sticky', top: 0, zIndex: 10, background: T.surface, borderBottom: `1px solid ${T.border}`, padding: '14px 20px', color: T.muted, fontSize: 10, fontWeight: 850, textTransform: 'uppercase', letterSpacing: 1 }}>Reference</th>
              <th style={{ position: 'sticky', top: 0, zIndex: 10, background: T.surface, borderBottom: `1px solid ${T.border}`, padding: '14px 20px', color: T.muted, fontSize: 10, fontWeight: 850, textTransform: 'uppercase', letterSpacing: 1 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '60px 0', color: T.muted }}>Synchronizing Ledger...</td></tr>
            ) : txs.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '60px 0', color: T.muted }}>No transactions recorded.</td></tr>
            ) : (
              txs.map((tx) => (
                <tr key={`${tx.tx_type}-${tx.id}`} style={{ borderBottom: `1px solid ${T.border}`, transition: 'background 0.2s' }}>
                  <td style={{ padding: '16px 20px', fontSize: 11, color: T.muted, fontFamily: T.mono }}>
                    {new Date(tx.created_at).toLocaleString('en-KE')}
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {tx.tx_type === 'payment' ? <ArrowDownLeft size={14} color={T.ok} /> : <ArrowUpRight size={14} color={T.accent} />}
                      <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', color: tx.tx_type === 'payment' ? T.ok : T.accent }}>
                        {tx.is_reg_fee ? 'REG FEE' : tx.tx_type}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px', fontSize: 14, fontWeight: 700, color: T.txt }}>
                    {tx.customer_name || <span style={{ color: T.muted, opacity: 0.5 }}>System Transaction</span>}
                  </td>
                  <td style={{ padding: '16px 20px', fontWeight: 900, color: tx.tx_type === 'payment' ? T.ok : T.warn, fontSize: 15 }}>
                    {tx.tx_type === 'payment' ? '+' : '-'}{fmt(tx.amount)}
                  </td>
                  <td style={{ padding: '16px 20px', fontSize: 11, fontFamily: T.mono, color: T.dim }}>
                    {tx.reference || '-'}
                  </td>
                  <td style={{ padding: '16px 20px' }}>
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
