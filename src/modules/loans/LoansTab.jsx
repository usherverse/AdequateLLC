import CustomerProfile from "@/modules/customers/CustomerProfile";
import React, { useState, useMemo } from 'react';
import {
  T, SC, Card, DT, Btn, Search, Pills, Badge, FI, Alert, Dialog, ConfirmDialog, RefreshBtn,
  LoanModal, LoanForm, fmt, now, uid, ts, generateLoanAgreementHTML, generateAssetListHTML, downloadLoanDoc,
  sbWrite, sbInsert, toSupabaseLoan, toSupabaseCustomer, toSupabasePayment, useContactPopup, useToast
} from '@/lms-common';
import { initiateB2cDisbursement } from '@/utils/mpesa';

const LoansTab = ({ loans, setLoans, customers, setCustomers, payments, setPayments, interactions, setInteractions, workers, addAudit, showToast = () => { } }) => {
  const { open: openContact, Popup: ContactPopup } = useContactPopup();
  const [flt, setFlt] = useState('All');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [selCust, setSelCust] = useState(null);
  const [showApp, setShowApp] = useState(false);
  const [disbLoan, setDisbLoan] = useState(null);
  const [payLoan, setPayLoan] = useState(null);
  const [disbF, setDisbF] = useState({ mpesa: '', phone: '', date: now() });
  const [payF, setPayF] = useState({ amount: '', mpesa: '', date: now(), isRegFee: false });
  const [loading, setLoading] = useState(false);
  const statuses = ['All', 'Active', 'Overdue', 'Approved', 'Application submitted', 'worker-pending', 'Settled', 'Written off'];
  const rows = useMemo(() => {
    const lq = q.trim().toLowerCase();
    return loans.filter(l => {
      if (flt !== 'All' && l.status !== flt) return false;
      if (!lq) return true;
      return (
        l.id.toLowerCase().includes(lq) ||
        (l.customer || '').toLowerCase().includes(lq) ||
        (l.customerId || '').toLowerCase().includes(lq) ||
        (l.officer || '').toLowerCase().includes(lq) ||
        (l.mpesa || '').toLowerCase().includes(lq) ||
        (l.phone || '').toLowerCase().includes(lq) ||
        (l.repaymentType || '').toLowerCase().includes(lq) ||
        (l.status || '').toLowerCase().includes(lq) ||
        (l.disbursed || '').includes(lq) ||
        String(l.amount || '').includes(lq) ||
        String(l.balance || '').includes(lq)
      );
    });
  }, [loans, flt, q]);

  // Check if customer has paid registration fee
  const hasRegFee = (cust) => {
    if (!cust) return false;
    if (cust.loans > 0) return true; // repeat customer, no fee needed
    // Check if a registration fee payment exists
    return payments && payments.some(p => p.customerId === cust.id && p.isRegFee);
  };

  const doDisburse = () => {
    if (!disbF.mpesa || !disbF.phone) return;
    const currentLoan = loans.find(l => l.id === disbLoan.id);
    if (!currentLoan || currentLoan.status === 'Active') { showToast('⚠ This loan is already active or no longer exists', 'warn'); setDisbLoan(null); return; }
    const cust = customers.find(c => c.id === disbLoan.customerId);
    if (cust && cust.loans === 0 && !hasRegFee(cust)) { showToast('⚠ Registration fee not paid. Cannot disburse loan until KES 500 registration fee is confirmed.', 'warn'); return; }
    const disbUpd = { ...disbLoan, status: 'Active', disbursed: disbF.date, mpesa: disbF.mpesa, phone: disbF.phone };
    setLoans(ls => ls.map(l => l.id === disbLoan.id ? disbUpd : l));
    sbWrite('loans', toSupabaseLoan(disbUpd));
    addAudit('Loan Disbursed', disbLoan.id, `${fmt(disbLoan.amount)} via ${disbF.mpesa}`);
    showToast(`✅ Loan ${disbLoan.id} disbursed — ${fmt(disbLoan.amount)}`, 'ok');
    setDisbLoan(null); setSel(null); setDisbF({ mpesa: '', phone: '', date: now() });
  };

  const doMpesaDisburse = async () => {
    if (!disbLoan) return;
    setLoading(true);
    try {
      const res = await initiateB2cDisbursement(disbLoan.id);
      if (res.success) {
        showToast('🚀 Disbursement initiated via M-Pesa. Status will update once Safaricom confirms.', 'info');
        // We don't mark as Active yet — we wait for the callback asynchronously.
        addAudit('M-Pesa Disbursement Initiated', disbLoan.id, `${fmt(disbLoan.amount)} requested via Daraja`);
      } else {
        throw new Error(res.error || 'Failed to initiate');
      }
    } catch (err) {
      showToast('❌ M-Pesa Error: ' + err.message, 'danger');
    } finally {
      setLoading(false);
      setDisbLoan(null);
    }
  };

  const doRecordPay = () => {
    const amt = Math.floor(Number(payF.amount));
    if (!amt || amt < 1) { showToast('⚠ Enter a valid payment amount (minimum KES 1)', 'warn'); return; }
    if (amt > (payLoan.balance || 0)) { showToast(`⚠ Payment of ${fmt(amt)} exceeds outstanding balance of ${fmt(payLoan.balance)}. Please enter a correct amount.`, 'warn'); return; }
    const newBal = Math.max((payLoan.balance || 0) - amt, 0);
    const newStatus = newBal <= 0 ? 'Settled' : payLoan.status;
    const payId = uid('PAY');
    const payEntry = { id: payId, date: payF.date || now(), amount: amt, mpesa: payF.mpesa || 'manual', note: '', isRegFee: !!payF.isRegFee };
    // Update loan's embedded payment list
    const payLoanUpd = { ...payLoan, balance: newBal, status: newStatus, payments: [...(payLoan.payments || []), payEntry] };
    setLoans(ls => ls.map(l => l.id === payLoan.id ? payLoanUpd : l));
    sbWrite('loans', toSupabaseLoan(payLoanUpd));
    const custId = payLoan.customerId || customers.find(c => c.name === payLoan.customer)?.id || '';
    const newPayment = { ...payEntry, customerId: custId, customer: payLoan.customer, loanId: payLoan.id, status: 'Allocated', allocatedBy: 'admin' };
    setPayments(ps => [...ps, newPayment]);
    sbInsert('payments', toSupabasePayment(newPayment));
    addAudit('Payment Recorded', payLoan.id, `${fmt(amt)} via M-Pesa ${payF.mpesa || 'manual'}${payF.isRegFee ? ' [Reg Fee]' : ''}`);
    showToast(`✅ Payment of ${fmt(amt)} recorded` + (newBal <= 0 ? ' — Loan settled!' : '') + (payF.isRegFee ? ' · Registration fee marked' : ''), 'ok');
    setPayLoan(null); setSel(null); setPayF({ amount: '', mpesa: '', date: now(), isRegFee: false });
  };

  const [confirmAction, setConfirmAction] = useState(null); // {title,message,onConfirm}
  const doWriteoff = l => { const upd = { ...l, status: 'Written off' }; setLoans(ls => ls.map(x => x.id === l.id ? upd : x)); sbWrite('loans', toSupabaseLoan(upd)); addAudit('Loan Written Off', l.id, `Balance: ${fmt(l.balance)}`); showToast(`⚠ Loan ${l.id} written off`, 'warn'); setSel(null); };
  const doApprove = l => { const upd = { ...l, status: 'Approved' }; setLoans(ls => ls.map(x => x.id === l.id ? upd : x)); sbWrite('loans', toSupabaseLoan(upd)); addAudit('Loan Approved', l.id, `Amount: ${fmt(l.amount)}`); showToast(`✅ Loan ${l.id} approved — ${fmt(l.amount)}`, 'ok'); setSel(null); };
  const doReject = l => { const upd = { ...l, status: 'Rejected', rejectedAt: now() }; setLoans(ls => ls.map(x => x.id === l.id ? upd : x)); sbWrite('loans', toSupabaseLoan(upd)); addAudit('Loan Rejected', l.id, `Amount: ${fmt(l.amount)}`); showToast(`Loan ${l.id} rejected`, 'warn'); setSel(null); };

  const pendingWorker = useMemo(() => loans.filter(l => l.status === 'worker-pending' || l.status === 'Application submitted'), [loans]);
  const loanStats = useMemo(() => ({
    total: loans.length,
    overdue: loans.filter(l => l.status === 'Overdue').length,
    approved: loans.filter(l => l.status === 'Approved').length,
  }), [loans]);

  // Repayment schedule calculator
  const calcSchedule = (loan) => {
    if (!loan || !loan.balance) return [];
    const total = loan.balance;
    const rt = loan.repaymentType;
    if (rt === 'Daily') { const d = 30; return [{ period: 'Per Day', amount: Math.ceil(total / d) }, { period: 'Per Week', amount: Math.ceil(total / d) * 7 }, { period: 'Per Month (30d)', amount: total }]; }
    if (rt === 'Weekly') { const w = 4; return [{ period: 'Per Week', amount: Math.ceil(total / w) }, { period: 'Per 2 Weeks', amount: Math.ceil(total / w) * 2 }, { period: 'Per Month (4w)', amount: total }]; }
    if (rt === 'Biweekly') { return [{ period: 'Per 2 Weeks', amount: Math.ceil(total / 2) }, { period: 'Per Month', amount: total }]; }
    if (rt === 'Monthly') { return [{ period: 'Per Month', amount: total }]; }
    if (rt === 'Lump Sum') { return [{ period: 'One-time (Lump Sum)', amount: total }]; }
    return [];
  };

  return (
    <div className='fu'>
      {ContactPopup}
      {confirmAction && <ConfirmDialog title={confirmAction.title} message={confirmAction.message} confirmLabel='Yes, proceed' confirmVariant='danger' onConfirm={confirmAction.onConfirm} onCancel={() => setConfirmAction(null)} />}
      {pendingWorker.length > 0 && (
        <div style={{ background: T.gLo, border: `1px solid ${T.gold}38`, borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
          {/* Header — always visible */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: `1px solid ${T.gold}20` }}>
            <div style={{ color: T.gold, fontWeight: 800, fontSize: 13 }}>
              ⏳ {pendingWorker.length} Loan Application{pendingWorker.length > 1 ? 's' : ''} Awaiting Approval
            </div>
            <span style={{ background: T.gold, color: '#000', borderRadius: 99, padding: '1px 8px', fontSize: 11, fontWeight: 900 }}>{pendingWorker.length}</span>
          </div>
          {/* Pending list — 40vh scroll container */}
          <div style={{ maxHeight: '40vh', overflowY: 'auto', overflowX: 'hidden' }}>
            {pendingWorker.map(l => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: `1px solid ${T.gold}14` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: T.txt, fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.customer}</div>
                  <div style={{ color: T.muted, fontSize: 11, fontFamily: T.mono }}>{l.id} · {fmt(l.amount)} · {l.repaymentType} · {l.officer}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <Btn sm v='gold' onClick={() => doApprove(l)}>✓ Approve</Btn>
                  <Btn sm v='danger' onClick={() => doReject(l)}>✕ Reject</Btn>
                </div>
              </div>
            ))}
          </div>
          {pendingWorker.length > 3 && (
            <div style={{ textAlign: 'center', padding: '5px', color: T.gold, fontSize: 11, borderTop: `1px solid ${T.gold}15` }}>
              Scroll to see all {pendingWorker.length} applications
            </div>
          )}
        </div>
      )}
      <div className='mob-stack' style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ fontFamily: T.head, color: T.txt, fontSize: 20, fontWeight: 800 }}>💰 Loan Management</div>
          </div>
          <div style={{ color: T.muted, fontSize: 13 }}>{loanStats.total} total · {loanStats.overdue} overdue · {loanStats.approved} pending</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <RefreshBtn onRefresh={() => { setQ(''); setFlt('All'); setSel(null); }} />
          <Btn onClick={() => setShowApp(true)}>+ New Application</Btn>
        </div>
      </div>
      <div className='mob-stack' style={{ display: 'flex', gap: 10, marginBottom: 13, flexWrap: 'wrap', alignItems: 'center' }}>
        <Search value={q} onChange={setQ} placeholder='Search loan or customer…' />
        <Pills opts={statuses} val={flt} onChange={setFlt} />
      </div>
      <Card>
        <DT
          cols={[{ k: 'id', l: 'ID', r: v => <span style={{ color: T.accent, fontFamily: T.mono, fontWeight: 700, fontSize: 12 }}>{v}</span> }, { k: 'customer', l: 'Customer', r: (v, r) => { const c = customers.find(x => x.name === v); return <span onClick={e => { e.stopPropagation(); if (c) { setSelCust(c); } else { openContact(v, r.phone, e); } }} style={{ color: T.accent, cursor: 'pointer', fontWeight: 600, borderBottom: `1px dashed ${T.accent}50` }}>{v}</span>; } }, { k: 'amount', l: 'Principal', r: v => <span style={{ fontFamily: T.mono }}>{fmt(v)}</span> }, { k: 'balance', l: 'Balance', r: (v, r) => <span style={{ color: r.status === 'Overdue' ? T.danger : T.txt, fontFamily: T.mono }}>{fmt(v)}</span> }, { k: 'status', l: 'Status', r: v => <Badge color={SC[v] || T.muted}>{v}</Badge> }, { k: 'repaymentType', l: 'Type' }, { k: 'daysOverdue', l: 'Overdue', r: v => v > 0 ? <span style={{ color: T.danger, fontWeight: 700, fontFamily: T.mono }}>{v}d</span> : <span style={{ color: T.muted }}>—</span> }, { k: 'officer', l: 'Officer' }]}
          rows={rows} onRow={setSel}
        />
      </Card>
      {sel && (
        <LoanModal
          loan={sel} customers={customers} payments={payments} interactions={interactions || []}
          onClose={() => setSel(null)}
          onViewCustomer={cust => { setSel(null); setSelCust(cust); }}
          actions={(
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(sel.status === 'Application submitted' || sel.status === 'worker-pending') && <Btn v='gold' onClick={() => { doApprove(sel); setSel(null); }}>✓ Approve</Btn>}
              {(sel.status === 'Application submitted' || sel.status === 'worker-pending') && <Btn v='danger' onClick={() => setConfirmAction({ title: 'Reject Application', message: `Reject loan application ${sel.id} for ${sel.customer} (${fmt(sel.amount)})? The customer will need to re-apply.`, onConfirm: () => { doReject(sel); setConfirmAction(null); } })}>✕ Reject</Btn>}
              {sel.status === 'Approved' && <Btn onClick={() => { setDisbLoan(sel); setSel(null); }}>💸 Disburse</Btn>}
              {['Active', 'Overdue'].includes(sel.status) && <Btn v='ok' onClick={() => { setPayLoan(sel); setSel(null); }}>💳 Record Payment</Btn>}
              {!['Written off', 'Settled', 'Rejected'].includes(sel.status) && <Btn v='danger' onClick={() => setConfirmAction({ title: 'Write Off Loan', message: `Write off loan ${sel.id} for ${sel.customer}? Balance of ${fmt(sel.balance)} will be marked as a loss. This cannot be undone.`, onConfirm: () => { doWriteoff(sel); setConfirmAction(null); } })}>✕ Write Off</Btn>}
              {['Active', 'Overdue', 'Approved'].includes(sel.status) && (() => {
                const sc = customers.find(c => c.id === sel.customerId); return (<>
                  <Btn v='blue' onClick={() => downloadLoanDoc(generateLoanAgreementHTML(sel, sc || { name: sel.customer }, sel.officer), 'loan-agreement-' + sel.id + '.html')}>📋 Agreement</Btn>
                  <Btn v='secondary' onClick={() => downloadLoanDoc(generateAssetListHTML(sel, sc || { name: sel.customer }, sel.officer), 'asset-list-' + sel.id + '.html')}>📦 Assets</Btn>
                </>);
              })()}
              <Btn v='ghost' onClick={() => setSel(null)}>Close</Btn>
            </div>
          )}
        />
      )}

      {/* FIX: CustomerProfile is now wrapped in a proper full-screen modal overlay,
          matching the same pattern used in CustomersTab.jsx.
          Previously it rendered bare into the DOM, pushing all content down
          and producing a blank/broken page appearance.
          Also fixed: role casing changed from "Admin" → "admin" so all
          role-gated tabs (Financials, Admin Actions, etc.) render correctly. */}
      {selCust && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 1000,
            overflowY: 'auto',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '24px 16px',
          }}
          onClick={e => { if (e.target === e.currentTarget) setSelCust(null); }}
        >
          <div style={{ width: '100%', maxWidth: 960, borderRadius: 16, overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.3)' }}>
            <CustomerProfile
              customerId={selCust.id}
              workerContext={{ role: 'admin', name: 'Admin' }}
              onClose={() => setSelCust(null)}
              loans={loans} setLoans={setLoans}
              payments={payments} setPayments={setPayments}
              interactions={interactions} setInteractions={setInteractions}
              customers={customers} setCustomers={setCustomers}
              addAudit={addAudit}
              onSelectLoan={setSel}
            />
          </div>
        </div>
      )}

      {showApp && (
        <Dialog title='New Loan Application' onClose={() => setShowApp(false)} width={560}>
          <LoanForm customers={customers} payments={payments} loans={loans} onSave={l => { setLoans(ls => [l, ...ls]); sbInsert('loans', toSupabaseLoan(l)); const updCust = customers.find(c => c.id === l.customerId); if (updCust) { const nc = { ...updCust, loans: (updCust.loans || 0) + 1 }; setCustomers(cs => cs.map(c => c.id === l.customerId ? nc : c)); sbWrite('customers', toSupabaseCustomer(nc)); } else { setCustomers(cs => cs.map(c => c.id === l.customerId ? { ...c, loans: (c.loans || 0) + 1 } : c)); } addAudit('Loan Application', l.id, `${fmt(l.amount)} for ${l.customer}`); setShowApp(false); }} onClose={() => setShowApp(false)} />
        </Dialog>
      )}
      {disbLoan && (() => {
        const cust = customers.find(c => c.id === disbLoan.customerId);
        const regFeeOk = !cust || cust.loans > 0 || hasRegFee(cust);
        return (
          <Dialog title={`Disburse · ${disbLoan.id}`} onClose={() => setDisbLoan(null)} width={580}>
            <Alert type='info'>Disbursing <b>{fmt(disbLoan.amount)}</b> to <b>{disbLoan.customer}</b></Alert>
            {!regFeeOk && <Alert type='danger'>⛔ Registration fee (KES 500) has NOT been paid. You cannot disburse until this is confirmed.</Alert>}
            {regFeeOk && <Alert type='ok'>✓ Registration fee verified. Proceed with disbursement.</Alert>}
            <FI label='M-Pesa Transaction Code' value={disbF.mpesa} onChange={v => setDisbF(f => ({ ...f, mpesa: v }))} required placeholder='e.g. QAB123456' />
            <FI label='Disbursement Phone' value={disbF.phone} onChange={v => setDisbF(f => ({ ...f, phone: v }))} required />
            <FI label='Date' type='date' value={disbF.date} onChange={v => setDisbF(f => ({ ...f, date: v }))} />
            <div style={{ display: 'flex', gap: 9, marginBottom: 12 }}><Btn onClick={doDisburse} full disabled={!regFeeOk || loading}>✓ Confirm Manual Disbursement</Btn></div>
            <div style={{ display: 'flex', gap: 9, paddingTop: 12, borderTop: `1px dashed ${T.border}` }}><Btn v='gold' onClick={doMpesaDisburse} full disabled={!regFeeOk || loading}>🚀 Disburse via M-Pesa (B2C)</Btn><Btn v='secondary' onClick={() => setDisbLoan(null)} full>Cancel</Btn></div>
            {/* PDF Documents — available before and after disbursement */}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
              <div style={{ color: T.txt, fontWeight: 700, fontSize: 13, marginBottom: 3 }}>📄 Loan Documents</div>
              <div style={{ color: T.muted, fontSize: 12, marginBottom: 10 }}>Download for signing before or after disbursement. Opens as printable HTML.</div>
              <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                <Btn v='blue' onClick={() => {
                  const loanForDoc = { ...disbLoan, mpesa: disbF.mpesa || disbLoan.mpesa, disbursed: disbF.date || disbLoan.disbursed };
                  downloadLoanDoc(generateLoanAgreementHTML(loanForDoc, cust || { name: disbLoan.customer }, disbLoan.officer), 'loan-agreement-' + disbLoan.id + '.html');
                }}>📋 Loan Agreement</Btn>
                <Btn v='secondary' onClick={() => {
                  downloadLoanDoc(generateAssetListHTML(disbLoan, cust || { name: disbLoan.customer }, disbLoan.officer), 'asset-list-' + disbLoan.id + '.html');
                }}>📦 Asset Declaration</Btn>
              </div>
            </div>
          </Dialog>
        );
      })()}
      {payLoan && (() => {
        const payLoanCust = customers.find(c => c.id === payLoan.customerId || c.name === payLoan.customer);
        const isNewForFee = payLoanCust && payLoanCust.loans <= 1 && !hasRegFee(payLoanCust);
        return (
          <Dialog title={`Record Payment · ${payLoan.id}`} onClose={() => { setPayLoan(null); setPayF({ amount: '', mpesa: '', date: now(), isRegFee: false }); }}>
            <Alert type='info'><b>{payLoan.customer}</b> · Outstanding: <b>{fmt(payLoan.balance)}</b></Alert>
            {isNewForFee && (
              <div style={{ background: T.gLo, border: `1px solid ${T.gold}38`, borderRadius: 10, padding: '10px 14px', marginBottom: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type='checkbox' checked={!!payF.isRegFee} onChange={e => setPayF(f => ({ ...f, isRegFee: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: T.gold, cursor: 'pointer' }} />
                  <div>
                    <div style={{ color: T.gold, fontWeight: 700, fontSize: 13 }}>Mark as Registration Fee (KES 500)</div>
                    <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>This is a new client. Tick this if the payment includes the one-time KES 500 registration fee.</div>
                  </div>
                </label>
              </div>
            )}
            <FI label='Payment Amount (KES)' type='number' value={payF.amount} onChange={v => setPayF(f => ({ ...f, amount: v }))} required placeholder='Amount received' />
            <FI label='M-Pesa Code (optional)' value={payF.mpesa} onChange={v => setPayF(f => ({ ...f, mpesa: v }))} placeholder='e.g. QAB123456' />
            <FI label='Payment Date' type='date' value={payF.date || now()} onChange={v => setPayF(f => ({ ...f, date: v }))} />
            <div style={{ display: 'flex', gap: 9 }}><Btn onClick={doRecordPay} full>✓ Save Payment</Btn><Btn v='secondary' onClick={() => { setPayLoan(null); setPayF({ amount: '', mpesa: '', date: now(), isRegFee: false }); }}>Cancel</Btn></div>
          </Dialog>
        );
      })()}
    </div>
  );
};

// ═══════════════════════════════════════════
//  CUSTOMERS PAGE
// ═══════════════════════════════════════════

export default LoansTab;