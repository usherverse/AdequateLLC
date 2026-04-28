import React, { useState } from 'react';
import { supabase } from '@/config/supabaseClient';
import { T, Btn, fmt, Dialog, FI, Alert, Card, Badge } from '@/lms-common';
import { Search, RotateCcw, AlertCircle, User, Hash, Receipt } from 'lucide-react';

const ReversalTab = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [revTarget, setRevTarget] = useState(null);
  const [revReason, setRevReason] = useState('Wrong Number');
  const [executing, setExecuting] = useState(false);

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query || query.length < 3) return;

    setLoading(true);
    // Search for outward payments (disbursements)
    const { data, error } = await supabase
      .from('b2c_disbursements')
      .select(`
        id, 
        amount, 
        status, 
        created_at, 
        transaction_id,
        customers (name, id_no, phone)
      `)
      .or(`transaction_id.ilike.%${query}%, phone_number.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) setResults(data);
    setLoading(false);
  };

  const handleExecuteReversal = async () => {
    if (!revTarget || !revReason) return;
    
    setExecuting(true);
    try {
      const { data, error } = await supabase.functions.invoke('mpesa-reversal', {
        body: {
          tx_type: 'disbursement',
          id: revTarget.id,
          reason: revReason
        }
      });

      if (error) {
        let msg = error.message;
        try {
          const body = await error.context?.json();
          if (body?.error) msg = body.error;
        } catch(e) {}
        throw new Error(msg);
      }
      
      alert(data.message || 'M-Pesa Reversal initiated successfully.');
      setRevTarget(null);
      handleSearch();
    } catch (err) {
      alert('Reversal Error: ' + err.message);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ background: T.surface, padding: 24, borderRadius: 16, border: `1px solid ${T.border}` }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: T.txt, fontWeight: 900, fontSize: 16, marginBottom: 4 }}>Outward Payment Reversal Tool</div>
          <div style={{ color: T.muted, fontSize: 13 }}>Search for disbursements by Phone Number or M-Pesa Transaction ID to initiate a reversal.</div>
        </div>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: T.muted }} />
            <input 
              placeholder="Search by M-Pesa Reference (e.g. OAB...) or Phone Number..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 14px 14px 44px',
                borderRadius: 12,
                border: `1px solid ${T.border}`,
                background: T.bg,
                color: T.txt,
                fontSize: 14,
                outline: 'none'
              }}
            />
          </div>
          <Btn v="accent" onClick={handleSearch} loading={loading}>Search Transactions</Btn>
        </form>
      </div>

      <div style={{ overflowX: 'auto', border: `1px solid ${T.border}`, borderRadius: 12, background: T.card }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: T.surface }}>
              <th style={{ padding: '14px 20px', color: T.muted, fontSize: 10, fontWeight: 850, textTransform: 'uppercase' }}>Timestamp</th>
              <th style={{ padding: '14px 20px', color: T.muted, fontSize: 10, fontWeight: 850, textTransform: 'uppercase' }}>Recipient</th>
              <th style={{ padding: '14px 20px', color: T.muted, fontSize: 10, fontWeight: 850, textTransform: 'uppercase' }}>Reference</th>
              <th style={{ padding: '14px 20px', color: T.muted, fontSize: 10, fontWeight: 850, textTransform: 'uppercase' }}>Amount</th>
              <th style={{ padding: '14px 20px', color: T.muted, fontSize: 10, fontWeight: 850, textTransform: 'uppercase' }}>Status</th>
              <th style={{ padding: '14px 20px', color: T.muted, fontSize: 10, fontWeight: 850, textTransform: 'uppercase' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '60px 0', color: T.muted }}>Searching records...</td></tr>
            ) : results.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '60px 0', color: T.muted }}>Enter a search term above to find disbursements.</td></tr>
            ) : (
              results.map((res) => (
                <tr key={res.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ padding: '16px 20px', fontSize: 11, color: T.muted, fontFamily: T.mono }}>
                    {new Date(res.created_at).toLocaleString('en-KE')}
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ fontWeight: 700, color: T.txt }}>{res.customers?.name}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>{res.customers?.phone}</div>
                  </td>
                  <td style={{ padding: '16px 20px', fontSize: 11, fontFamily: T.mono, color: T.dim }}>
                    {res.transaction_id || 'PENDING'}
                  </td>
                  <td style={{ padding: '16px 20px', fontWeight: 900, color: T.danger }}>
                    -{fmt(res.amount)}
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <Badge color={res.status === 'completed' ? T.ok : T.warn}>{res.status?.toUpperCase()}</Badge>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    {res.status !== 'Reversed' && res.transaction_id && (
                      <Btn sm v="danger" onClick={() => setRevTarget(res)} icon={RotateCcw}>Reverse</Btn>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {revTarget && (
        <Dialog 
          title="Initiate Outward Reversal" 
          onClose={() => setRevTarget(null)}
          width={480}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Alert type="danger" icon={<AlertCircle size={20} />}>
              <b>WARNING:</b> This will attempt to pull <b>{fmt(revTarget.amount)}</b> back from M-Pesa. This action cannot be undone once confirmed.
            </Alert>

            <div style={{ background: T.surface, padding: 16, borderRadius: 16, border: `1px solid ${T.border}`, display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <User size={14} color={T.muted} />
                    <span style={{ fontSize: 13, color: T.txt }}>{revTarget.customers?.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Receipt size={14} color={T.muted} />
                    <span style={{ fontSize: 12, color: T.dim, fontFamily: T.mono }}>{revTarget.transaction_id}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Hash size={14} color={T.muted} />
                    <span style={{ fontSize: 14, color: T.danger, fontWeight: 900 }}>-{fmt(revTarget.amount)}</span>
                </div>
            </div>

            <FI 
              label="Select Reason" 
              type="select"
              options={[
                { l: '❌ Wrong Phone Number', v: 'Wrong Number' },
                { l: '📉 Defaulted Client / Recovery', v: 'Defaulted Client' },
                { l: '🔄 Customer Cancellation', v: 'Customer Request' },
                { l: '❓ Duplicate Disbursement', v: 'Duplicate' }
              ]}
              value={revReason}
              onChange={v => setRevReason(v)}
            />

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <Btn full v="danger" onClick={handleExecuteReversal} loading={executing} icon={RotateCcw}>Confirm Reversal</Btn>
              <Btn outline v="secondary" onClick={() => setRevTarget(null)}>Cancel</Btn>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};

export default ReversalTab;
