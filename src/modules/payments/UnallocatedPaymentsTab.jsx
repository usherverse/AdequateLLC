import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, Search, CheckCircle, UserPlus, 
  ChevronRight, ArrowRightLeft, Clock, Search as SearchIcon 
} from 'lucide-react';
import { 
  T, SC, Card, CH, DT, Btn, Badge, FI, 
  fmt, now, useToast, Dialog, fmtM
} from '@/lms-common';
import { supabase } from '@/config/supabaseClient';

const UnallocatedPaymentsTab = ({ transactions = [], customers = [], setTransactions, onRefresh, addAudit }) => {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [custQ, setCustQ] = useState('');
  const [allocLoading, setAllocLoading] = useState(false);

  const filtered = transactions.filter(t => 
    t.allocation_status === 'unallocated' && 
    (t.trans_id.toLowerCase().includes(q.toLowerCase()) || 
     t.msisdn.includes(q) || 
     (t.bill_ref_number && t.bill_ref_number.includes(q)) ||
     (`${t.first_name || ''} ${t.last_name || ''}`).toLowerCase().includes(q.toLowerCase()))
  );

  const customerResults = useMemo(() => {
    if (custQ.length < 3) return [];
    return customers.filter(c => 
      c.name.toLowerCase().includes(custQ.toLowerCase()) || 
      c.phone.includes(custQ) || 
      (c.id_no && c.id_no.includes(custQ))
    ).slice(0, 10);
  }, [custQ, customers]);

  const handleAllocate = async (tx, customer) => {
    if (!tx || !customer) return;
    setAllocLoading(true);
    try {
      const { data, error } = await supabase.rpc('finalize_c2b_allocation', {
        p_trans_id: tx.trans_id,
        p_trans_time: tx.trans_time,
        p_amount: tx.trans_amount,
        p_bill_ref: tx.bill_ref_number,
        p_msisdn: tx.msisdn,
        p_first_name: tx.first_name,
        p_last_name: tx.last_name,
        p_shortcode: tx.business_short_code,
        p_raw_payload: tx.raw_payload,
        p_customer_id: customer.id,
        p_method: 'manual', // Overriding method to manual
        p_reason: null
      });

      if (error) throw error;

      // Update local state is harder since transactions are fetched from DB. 
      // Better to refresh.
      if (onRefresh) onRefresh();
      
      addAudit('Manual C2B Allocation', customer.id, `Allocated TxID ${tx.trans_id} to ${customer.name}`);
      setSel(null);
      setCustQ('');
    } catch (err) {
      console.error('[Manual Allocation] Failed:', err.message);
      alert('Allocation failed: ' + err.message);
    } finally {
      setAllocLoading(false);
    }
  };

  return (
    <div className="fu">
      <CH title="Unallocated Payments" sub="Manually match Paybill transactions that failed auto-allocation." />
      
      <div style={{ marginBottom: 20, display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <FI icon={Search} placeholder="Search by TxID, Phone, or Name..." value={q} onChange={setQ} />
        </div>
      </div>

      <Card noPadding>
        <DT
          cols={[
            { k: 'trans_id', l: 'TxID', r: v => <span style={{ fontFamily: T.mono, fontWeight: 700, color: T.accent }}>{v}</span> },
            { k: 'trans_amount', l: 'Amount', r: v => <span style={{ fontWeight: 800 }}>{fmt(v)}</span> },
            { k: 'bill_ref_number', l: 'Reference', r: v => <Badge color={T.muted}>{v}</Badge> },
            { 
              k: 'msisdn', l: 'Sender', r: (v, r) => (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600 }}>{r.first_name} {r.last_name}</span>
                  <span style={{ fontSize: 11, color: T.dim }}>{v}</span>
                </div>
              )
            },
            { k: 'trans_time', l: 'Date', r: v => <span style={{ fontSize: 11 }}>{new Date(v).toLocaleString()}</span> },
            { 
              k: 'id', l: 'Action', r: (v, r) => (
                <Btn icon={ArrowRightLeft} size="sm" variant="subtle" onClick={() => setSel(r)}>Allocate</Btn>
              )
            }
          ]}
          rows={filtered}
        />
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: T.dim }}>
            <CheckCircle size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
            <p>No unallocated payments found.</p>
          </div>
        )}
      </Card>

      {sel && (
        <Dialog title="Manual Allocation" onClose={() => setSel(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Alert type="info">
              Allocating <strong>{fmt(sel.trans_amount)}</strong> ({sel.trans_id}) from <strong>{sel.first_name} {sel.last_name}</strong>.
            </Alert>
            
            <FI 
              icon={SearchIcon} 
              placeholder="Search customer by name, ID or phone..." 
              value={custQ} 
              onChange={setCustQ} 
            />

            <div style={{ maxHeight: 300, overflowY: 'auto', border: `1px solid ${T.border}`, borderRadius: 8 }}>
              {customerResults.map(c => (
                <div 
                  key={c.id} 
                  onClick={() => handleAllocate(sel, c)}
                  style={{ 
                    padding: '12px 16px', 
                    cursor: allocLoading ? 'not-allowed' : 'pointer',
                    borderBottom: `1px solid ${T.border}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = T.hover}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: T.dim }}>{c.phone} | ID: {c.idNo || 'N/A'}</div>
                  </div>
                  <Btn size="xs" variant="ghost" icon={UserPlus} disabled={allocLoading}>Match</Btn>
                </div>
              ))}
              {custQ.length >= 3 && customerResults.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: T.dim }}>No customers found matching "{custQ}"</div>
              )}
              {custQ.length < 3 && (
                <div style={{ padding: 20, textAlign: 'center', color: T.dim }}>Type at least 3 characters to search...</div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
              <Btn variant="ghost" onClick={() => setSel(null)}>Cancel</Btn>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};

export default UnallocatedPaymentsTab;
