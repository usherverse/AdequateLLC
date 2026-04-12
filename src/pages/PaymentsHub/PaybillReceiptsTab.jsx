import React, { useState, useEffect } from 'react';
import { supabase } from '@/config/supabaseClient';
import { T, Badge, Btn, fmt } from '@/lms-common';
import { Check, Link, AlertTriangle } from 'lucide-react';

const PaybillReceiptsTab = ({ customers = [], addAudit, showToast, setPayments, setUnallocatedC2BCount }) => {
  const [unallocated, setUnallocated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allocatingId, setAllocatingId] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  
  const fetchUnallocated = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('unallocated_payments')
      .select('*')
      .eq('status', 'Unallocated')
      .order('created_at', { ascending: false });
    
    if (data) {
      setUnallocated(data);
      if (setUnallocatedC2BCount) setUnallocatedC2BCount(data.length);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUnallocated();
  }, []);

  const handleManualAllocation = async (uId, transaction_id, amount, senderName) => {
    if (!selectedCustomerId) return alert('Please select a customer to allocate this payment to.');
    
    const customer = customers.find(c => c.id === selectedCustomerId);
    if (!customer) return alert('Invalid customer');

    setLoading(true);
    
    // 1. Insert into Payments
    const { data: newPayment, error: payErr } = await supabase
      .from('payments')
      .insert([{
        customer_id: customer.id,
        customer_name: customer.name,
        amount,
        mpesa: transaction_id,
        date: new Date().toISOString().split('T')[0],
        status: 'Allocated',
        allocated_by: 'Admin (Manual)',
        allocated_at: new Date().toISOString(),
        note: `Manually linked from unallocated receipt ${transaction_id}`
      }])
      .select()
      .single();

    if (payErr) {
      alert('Allocation Error: ' + payErr.message);
      setLoading(false);
      return;
    }

    // 2. Update Unallocated status
    await supabase.from('unallocated_payments').update({
      status: 'Allocated',
      allocated_to: customer.id,
      allocated_at: new Date().toISOString()
    }).eq('id', uId);

    // Update UI
    setUnallocated(prev => prev.filter(p => p.id !== uId));
    if (setUnallocatedC2BCount) setUnallocatedC2BCount(prev => Math.max(0, prev - 1));
    if (setPayments) setPayments(prev => [newPayment, ...prev]);
    addAudit('update', 'unallocated_payments', uId, null, { status: 'Allocated', allocated_to: customer.id }, `Manual Allocation of ${transaction_id}`);
    showToast(`Successfully allocated ${transaction_id} to ${customer.name}`);
    setAllocatingId(null);
    setSelectedCustomerId('');
    setLoading(false);
  };

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
          <h2 style={{ fontSize: 18, fontWeight: 800, color: T.blue, margin: 0 }}>Unallocated C2B Payments</h2>
          <p style={{ fontSize: 12, color: T.blue, opacity: 0.8, marginTop: 4 }}>Payments that could not be fuzzy-matched automatically.</p>
        </div>
        <Btn onClick={fetchUnallocated} v="blue" sm>🔄 Refresh</Btn>
      </div>

      <div style={{ overflowX: 'auto', border: `1px solid ${T.border}`, borderRadius: 16, background: T.card, width: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 900 }}>
          <thead>
            <tr style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
              <th style={{ padding: '14px clamp(12px, 2vw, 20px)', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Date</th>
              <th style={{ padding: '14px clamp(12px, 2vw, 20px)', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Receipt No</th>
              <th style={{ padding: '14px clamp(12px, 2vw, 20px)', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Amount</th>
              <th style={{ padding: '14px clamp(12px, 2vw, 20px)', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Sender Details</th>
              <th style={{ padding: '14px clamp(12px, 2vw, 20px)', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Status</th>
              <th style={{ padding: '14px clamp(12px, 2vw, 20px)', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '60px 0', color: T.muted }}>Loading...</td></tr>
            ) : unallocated.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '60px 0', color: T.muted }}>No unallocated payments found. The engine is doing a great job!</td></tr>
            ) : (
              unallocated.map((u) => {
                const isAllocating = allocatingId === u.id;
                const senderName = `${u.first_name || ''} ${u.last_name || ''}`.trim();
                const matched = customers.find(c => c.phone.includes(u.msisdn.slice(-9)));
                const display = matched ? matched.name : (senderName || 'Unknown');

                return (
                  <tr key={u.id} style={{ borderBottom: `1px solid ${T.border}`, transition: 'background 0.2s', background: isAllocating ? T.primary + '10' : 'transparent' }}>
                    <td style={{ padding: '16px clamp(12px, 2vw, 20px)', fontSize: 12, color: T.muted, fontFamily: T.mono }}>
                      {new Date(u.created_at).toLocaleString('en-KE')}
                    </td>
                    <td style={{ padding: '16px clamp(12px, 2vw, 20px)', fontWeight: 800, color: T.blue }}>{u.transaction_id}</td>
                    <td style={{ padding: '16px clamp(12px, 2vw, 20px)', fontWeight: 900, color: T.txt }}>{fmt(u.amount)}</td>
                    <td style={{ padding: '16px clamp(12px, 2vw, 20px)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.txt }}>{display}</div>
                        {matched && <Badge color={T.blue} sm>MATCH FOUND</Badge>}
                      </div>
                      <div style={{ fontSize: 12, color: T.muted, fontFamily: T.mono, marginTop: 4 }}>{u.msisdn}</div>
                    </td>
                    <td style={{ padding: '16px clamp(12px, 2vw, 20px)' }}>
                      <Badge v="warning"><AlertTriangle size={12} style={{marginRight: 4}}/>Unallocated</Badge>
                    </td>
                    <td style={{ padding: '16px clamp(12px, 2vw, 20px)', textAlign: 'right' }}>
                      {isAllocating ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                          <select 
                            value={selectedCustomerId} 
                            onChange={e => setSelectedCustomerId(e.target.value)}
                            style={{ minWidth: 200, padding: 8, borderRadius: 8, border: `1px solid ${T.border}`, background: T.card, color: T.txt }}
                          >
                            <option value="">Select customer...</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                          </select>
                          <Btn 
                            v="accent" 
                            sm 
                            icon={Check}
                            onClick={() => handleManualAllocation(u.id, u.transaction_id, u.amount, senderName)}
                          >Confirm</Btn>
                          <Btn v="ghost" sm onClick={() => setAllocatingId(null)}>Cancel</Btn>
                        </div>
                      ) : (
                        <Btn v="outline" sm icon={Link} onClick={() => setAllocatingId(u.id)}>Assign</Btn>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PaybillReceiptsTab;
