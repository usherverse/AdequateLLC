import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/config/supabaseClient';
import { T, Badge, Btn, fmt } from '@/lms-common';
import { Check, Link, AlertTriangle } from 'lucide-react';

const PaybillReceiptsTab = ({ payments = [], loans = [], customers = [], addAudit, showToast, setPayments, setUnallocatedC2BCount }) => {
  const [unallocated, setUnallocated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allocatingId, setAllocatingId] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedLoanId, setSelectedLoanId] = useState('');
  
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

  const ledgerUnallocated = useMemo(() => 
    (payments || []).filter(p => p.status === 'Unallocated'), 
  [payments]);

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

  const handleLedgerAllocation = async (payment) => {
    if (!selectedLoanId) return alert('Please select a loan');
    setLoading(true);
    const updated = { ...payment, status: 'Allocated', loanId: selectedLoanId, allocatedBy: 'Admin (Hub)', allocatedAt: new Date().toISOString() };
    const { error } = await supabase.from('payments').update({ status: 'Allocated', loan_id: selectedLoanId, allocated_by: 'Admin (Hub)', allocated_at: updated.allocatedAt }).eq('id', payment.id);
    if (error) {
      alert('Error updating payment: ' + error.message);
    } else {
      if (setPayments) setPayments(prev => prev.map(p => p.id === payment.id ? updated : p));
      showToast(`Allocated ${fmt(payment.amount)} to loan ${selectedLoanId}`);
    }
    setAllocatingId(null); setSelectedLoanId(''); setLoading(false);
  };

  const combined = [
    ...(unallocated || []).map(u => ({
      ...u,
      _type: 'raw',
      _date: u.created_at,
      _amount: u.amount,
      _ref: u.transaction_id,
      _sender: `${u.first_name || ''} ${u.last_name || ''}`.trim(),
      _msisdn: u.msisdn,
      _suggestedId:   u.suggested_customer_id   || null,
      _suggestedName: u.suggested_customer_name || null,
    })),
    ...(ledgerUnallocated || []).map(p => ({ ...p, _type: 'ledger', _date: p.date, _amount: p.amount, _ref: p.mpesa || p.id, _sender: p.customerName || p.customer }))
  ].sort((a, b) => new Date(b._date || 0) - new Date(a._date || 0));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: T.bLo, padding: '20px 24px', borderRadius: 16, border: `1px dashed ${T.blue}40` }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: T.blue, margin: 0 }}>Unallocated Receipts ({combined.length})</h2>
          <p style={{ fontSize: 12, color: T.blue, opacity: 0.8, marginTop: 4 }}>Manage raw entries and unlinked ledger payments in one view.</p>
        </div>
        <Btn onClick={fetchUnallocated} v="blue" sm>🔄 Refresh</Btn>
      </div>

      <div style={{ overflowX: 'auto', border: `1px solid ${T.border}`, borderRadius: 16, background: T.card, width: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 900 }}>
          <thead>
            <tr style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
              <th style={{ padding: '14px 20px', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>Source</th>
              <th style={{ padding: '14px 20px', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>Date</th>
              <th style={{ padding: '14px 20px', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>Amount</th>
              <th style={{ padding: '14px 20px', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>Sender / Customer</th>
              <th style={{ padding: '14px 20px', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>Receipt No</th>
              <th style={{ padding: '14px 20px', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {(loading && unallocated.length === 0) ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '60px 0', color: T.muted }}>Loading...</td></tr>
            ) : combined.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '60px 0', color: T.muted }}>System is balanced. No unallocated funds.</td></tr>
            ) : (
              combined.map((item) => {
                const isLedger = item._type === 'ledger';
                const isRaw = item._type === 'raw';
                const isAllocating = allocatingId === item.id;
                let display = item._sender || 'Unknown';
                let matched = null;
                if (isRaw) matched = customers.find(c => c.phone?.replace(/\D/g,'').includes(item._msisdn?.slice(-9)));
                // If no phone match but engine left a name suggestion, use that for the badge
                const hasSuggestion = isRaw && !matched && item._suggestedId;

                // Compute loan options for the ledger allocation dropdown
                const customerLoans = item.customerId
                  ? (loans || []).filter(l => l.customerId === item.customerId && ['Active', 'Approved'].includes(l.status))
                  : [];
                const loanOptions = customerLoans.length > 0
                  ? customerLoans
                  : (loans || []).filter(l => ['Active', 'Approved'].includes(l.status));

                return (
                  <tr key={item.id} style={{ borderBottom: `1px solid ${T.border}`, background: isAllocating ? T.primary + '10' : hasSuggestion ? T.warn + '08' : 'transparent' }}>
                    <td style={{ padding: '16px 20px' }}><Badge v={isLedger ? 'info' : 'warning'}>{isLedger ? 'LEDGER' : 'C2B RAW'}</Badge></td>
                    <td style={{ padding: '16px 20px', fontSize: 12, color: T.muted, fontFamily: T.mono }}>{new Date(item._date).toLocaleString('en-KE')}</td>
                    <td style={{ padding: '16px 20px', fontWeight: 900, color: T.txt }}>{fmt(item._amount)}</td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.txt }}>{isLedger ? item._sender : (matched ? matched.name : display)}</div>
                        {matched && <Badge color={T.blue} sm>MATCH FOUND</Badge>}
                        {hasSuggestion && (
                          <Badge color={T.warn} sm title="Partial name match — please confirm">💡 SUGGESTED: {item._suggestedName}</Badge>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: T.muted, fontFamily: T.mono, marginTop: 4 }}>{isRaw ? item._msisdn : (item.customerId || 'No ID')}</div>
                    </td>
                    <td style={{ padding: '16px 20px', fontWeight: 800, color: T.blue }}>{item._ref}</td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      {isAllocating ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                          {isRaw ? (
                            <select
                              value={selectedCustomerId}
                              onChange={e => setSelectedCustomerId(e.target.value)}
                              style={{ minWidth: 200, padding: 8, borderRadius: 8, border: `1px solid ${T.border}`, background: T.card, color: T.txt }}
                            >
                              <option value="">Link to customer...</option>
                              {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                            </select>
                          ) : (
                            <select value={selectedLoanId} onChange={e => setSelectedLoanId(e.target.value)} style={{ minWidth: 240, padding: 8, borderRadius: 8, border: `1px solid ${T.border}`, background: T.card, color: T.txt }}>
                              <option value="">Apply to loan...</option>
                              {loanOptions.map(l => {
                                const cust = customers.find(c => c.id === l.customerId);
                                return (
                                  <option key={l.id} value={l.id}>
                                    {l.id} · {cust?.name || l.customer || 'Unknown'} · Bal: {fmt(l.balance)}
                                  </option>
                                );
                              })}
                            </select>
                          )}
                          <Btn v="accent" sm icon={Check} onClick={() => isRaw ? handleManualAllocation(item.id, item._ref, item._amount, item._sender) : handleLedgerAllocation(item)}>Confirm</Btn>
                          <Btn v="ghost" sm onClick={() => setAllocatingId(null)}>Cancel</Btn>
                        </div>
                      ) : (
                        <Btn v={isLedger ? 'accent' : 'outline'} sm icon={Link} onClick={() => setAllocatingId(item.id)}>{isLedger ? 'Allocate' : 'Assign'}</Btn>
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
