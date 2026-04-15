import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Banknote, FileText, Inbox, Search as SearchIcon, Landmark, Plus, X, ArrowUpRight, ShieldCheck, Activity, TrendingUp, DollarSign } from 'lucide-react';
import { T, ModuleHeader, Card, Btn, fromSupabasePayment, KPI, Dialog, FI, Badge, Alert } from '@/lms-common';
import { supabase } from '@/config/supabaseClient';
import DisbursementsTab from './DisbursementsTab';
import RegistrationFeeTab from './RegistrationFeeTab';
import PaybillReceiptsTab from './PaybillReceiptsTab';
import AuditTab from './AuditTab';

const PaymentsHub = ({ customers, setCustomers, loans, payments, setLoans, setPayments, addAudit, showToast, unallocatedC2BCount, setUnallocatedC2BCount }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'disbursements';
  const [manualLogData, setManualLogData] = useState(null);

  const hubStats = useMemo(() => {
    const unallocated = (payments || []).filter(p => p.status === 'Unallocated').length;
    const pendingDisb = (loans || []).filter(l => l.status === 'Disbursing' || l.status === 'Approved').length;
    const dailyColl = (payments || [])
        .filter(p => p.date === new Date().toISOString().split('T')[0] && p.status === 'Allocated')
        .reduce((sum, p) => sum + p.amount, 0);
    
    return { unallocated, pendingDisb, dailyColl };
  }, [payments, loans]);

  const tabs = [
    { id: 'disbursements', label: 'Disbursements', icon: <Banknote size={16} /> },
    { id: 'registration-fee', label: 'Registration Fees', icon: <FileText size={16} /> },
    { id: 'paybill', label: 'Paybill Receipts', icon: <Inbox size={16} />, badge: hubStats.unallocated + (unallocatedC2BCount || 0) },
    { id: 'audit', label: 'Audit Ledger', icon: <SearchIcon size={16} /> },
  ];

  const handleTabChange = (id) => {
    setSearchParams({ tab: id });
  };

  const handleManualLog = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);

    // FI selects are controlled — read from state; plain inputs from FormData
    const cusId    = manualLogData?.customerId || manualLogData?.customer?.id || fd.get('customer_id');
    const amount   = parseFloat(fd.get('amount'));
    const method   = manualLogData?.method || fd.get('method') || 'Cash';
    const reference = fd.get('reference');
    const paymentType = manualLogData?.type || fd.get('payment_type') || 'loan_repayment';

    if (!cusId) return showToast('Please select a customer', 'warn');
    if (!amount || amount <= 0) return showToast('Invalid amount', 'warn');

    const customer = customers.find(c => c.id === cusId);
    if (!customer) return alert('Select customer');

    const isRegFee = paymentType === 'registration_fee';
    const note = isRegFee
      ? `Registration Fee — ${method}`
      : `Manual Entry (${method})`;

    const { data: newPayment, error } = await supabase
      .from('payments')
      .insert([{
        customer_id: cusId,
        customer_name: customer.name,
        amount,
        mpesa: reference || null,
        date: new Date().toISOString().split('T')[0],
        status: 'Allocated',
        allocated_by: 'Admin',
        allocated_at: new Date().toISOString(),
        note,
        is_reg_fee: isRegFee,
        loan_id: isRegFee ? `REG-FEE-${cusId}` : null
      }])
      .select()
      .single();

    if (error) {
      alert('Error: ' + error.message);
      return;
    }

    // If this was a registration fee, flip the master flag on the customer record
    if (isRegFee) {
      const { error: custErr } = await supabase
        .from('customers')
        .update({ mpesa_registered: true })
        .eq('id', cusId);
      if (custErr) console.error('[ManualLog] Failed to set mpesa_registered:', custErr.message);
      
      // Update local state to keep UI in sync
      if (setCustomers) {
        setCustomers(prev => prev.map(c => c.id === cusId ? { ...c, mpesaRegistered: true } : c));
      }
    }

    showToast(isRegFee ? 'Registration fee recorded ✓' : 'Payment logged manually');
    addAudit('insert', 'payments', newPayment.id, null, newPayment,
      isRegFee ? 'Registration Fee — Manual' : 'Manual Payment Log');
    setManualLogData(null);
    if (setPayments) setPayments(prev => [fromSupabasePayment(newPayment), ...prev]);
  };


  return (
    <div style={{ padding: '20px clamp(12px, 3vw, 32px)', maxWidth: 1600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <ModuleHeader 
        title={<><Landmark size={24} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 10, marginTop: -4 }} /> Payment Control Hub</>} 
        sub="Monitor M-Pesa throughput, manage disbursement queues, and audit the immutable financial ledger."
        right={
          <button
            onClick={() => setManualLogData({ type: 'loan_repayment' })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #00D4AA 0%, #00a884 100%)',
              color: '#000',
              fontSize: 13,
              fontWeight: 900,
              cursor: 'pointer',
              letterSpacing: '0.02em',
              boxShadow: '0 4px 16px rgba(0, 212, 170, 0.45)',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = '0 6px 24px rgba(0, 212, 170, 0.65)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 212, 170, 0.45)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <Plus size={15} strokeWidth={3} />
            Manual Entry
          </button>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
          <KPI label="Collections Today" value={new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(hubStats.dailyColl)} icon={TrendingUp} color={T.ok} />
          <KPI label="Awaiting Allocation" value={hubStats.unallocated + (unallocatedC2BCount || 0)} sub="Pending M-Pesa Receipts" icon={Inbox} color={(hubStats.unallocated + unallocatedC2BCount) > 0 ? T.warn : T.ok} />
          <KPI label="Disbursement Queue" value={hubStats.pendingDisb} sub="Approved Loan Payouts" icon={Banknote} color={T.accent} />
          <KPI label="Liquidity Status" value="Stable" sub="Verified by Audit" icon={ShieldCheck} color={T.ok} />
      </div>

      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: 4, 
        marginBottom: 20, 
        background: T.surface, 
        padding: '6px', 
        borderRadius: 14, 
        border: `1px solid ${T.border}`,
        width: 'fit-content',
        maxWidth: '100%',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch'
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className="hub-tab-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 24px',
              borderRadius: 10,
              border: 'none',
              background: currentTab === tab.id ? T.aLo : 'transparent',
              color: currentTab === tab.id ? T.accent : T.dim,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 800,
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              position: 'relative'
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.badge > 0 && (
                <span style={{ 
                    position: 'absolute', top: -4, right: -4, 
                    background: T.danger, color: '#fff', 
                    fontSize: 9, fontWeight: 900, 
                    padding: '2px 6px', borderRadius: 99,
                    border: `2px solid ${T.bg}`
                }}>{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <Card style={{ padding: 0, overflow: 'hidden', border: `1px solid ${T.border}`, width: '100%' }}>
        <div style={{ padding: 'clamp(12px, 2.5vw, 24px)' }}>
          {currentTab === 'disbursements' && <DisbursementsTab loans={loans} customers={customers} payments={payments} setLoans={setLoans} addAudit={addAudit} showToast={showToast} onManualLog={(c) => setManualLogData({ customer: c, type: 'loan_repayment' })} />}
          {currentTab === 'registration-fee' && <RegistrationFeeTab customers={customers} loans={loans} payments={payments} setPayments={setPayments} addAudit={addAudit} showToast={showToast} onManualLog={(c) => setManualLogData({ customer: c, type: 'registration_fee' })} />}
          {currentTab === 'paybill' && <PaybillReceiptsTab loans={loans} payments={payments} customers={customers} addAudit={addAudit} showToast={showToast} setPayments={setPayments} setUnallocatedC2BCount={setUnallocatedC2BCount} />}
          {currentTab === 'audit' && <AuditTab />}
        </div>
      </Card>

      {manualLogData && (
        <Dialog 
            title="Log Financial Transaction" 
            onClose={() => setManualLogData(null)}
            width={520}
        >
            <Alert type="info">You are manually recording a payment into the immutable ledger. This will bypass M-Pesa automation.</Alert>
            
            <form onSubmit={handleManualLog} style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 10 }}>
              <FI label="Customer Entity" type="select"
                options={Array.from(new Map((customers || []).map(c => [c.id, c])).values()).map(c => ({ l: `${c.name} (${c.phone})`, v: c.id }))}
                value={manualLogData?.customer?.id || manualLogData?.customerId || ''}
                onChange={(v) => setManualLogData(prev => ({ ...prev, customerId: v }))}
                name="customer_id"
                required
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <FI label="Entry Type" type="select"
                    options={[
                        { l: '🔑 Registration Fee', v: 'registration_fee' },
                        { l: '💳 Loan Repayment', v: 'loan_repayment' },
                        { l: '📝 Other Income', v: 'other' }
                    ]}
                    value={manualLogData?.type || 'loan_repayment'}
                    onChange={(v) => setManualLogData(prev => ({ ...prev, type: v }))}
                    name="payment_type"
                    required
                  />
                  <FI label="Amount (KES)" type="number" 
                    name="amount" 
                    required 
                    defaultValue={manualLogData?.type === 'registration_fee' ? '500' : ''}
                  />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <FI label="Method" type="select"
                    options={['Cash', 'Bank Transfer', 'Cheque', 'Other'].map(v => ({ l: v, v }))}
                    value={manualLogData?.method || 'Cash'}
                    onChange={(v) => setManualLogData(prev => ({ ...prev, method: v }))}
                    name="method"
                    required
                  />
                  <FI label="Reference / TXN ID" name="reference" placeholder="e.g. BANK-Ref-99" />
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '14px 24px',
                    borderRadius: 14,
                    border: 'none',
                    background: 'linear-gradient(135deg, var(--accent) 0%, #00a884 100%)',
                    color: '#000',
                    fontSize: 14,
                    fontWeight: 900,
                    cursor: 'pointer',
                    letterSpacing: '0.02em',
                    boxShadow: '0 4px 20px rgba(0, 212, 170, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 6px 28px rgba(0, 212, 170, 0.6)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 212, 170, 0.4)'}
                >
                  <ArrowUpRight size={16} />
                  Commit Transaction
                </button>
                <button
                  type="button"
                  onClick={() => setManualLogData(null)}
                  style={{
                    padding: '14px 20px',
                    borderRadius: 14,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--muted)',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
        </Dialog>
      )}

      <style>{`
        .hub-tab-btn:hover { background: ${T.surface} !important; color: ${T.txt} !important; }
        .hub-tab-btn { position: relative; }
      `}</style>
    </div>
  );
};

export default PaymentsHub;
