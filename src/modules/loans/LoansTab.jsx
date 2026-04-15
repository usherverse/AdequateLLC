import CustomerProfile from "@/modules/customers/CustomerProfile";
import React, { useState, useMemo } from 'react';
import { 
  Banknote, Hourglass, TrendingUp, AlertTriangle, Plus, Check, X, 
  ChevronRight, CreditCard, FileText, PackageOpen, PieChart, Activity 
} from 'lucide-react';
import {
  T, SC, Card, DT, Btn, Search, Pills, Badge, FI, Alert, Dialog, ConfirmDialog, RefreshBtn,
  LoanModal, LoanForm, fmt, fmtM, now, uid, ts, generateLoanAgreementHTML, generateAssetListHTML, downloadLoanDoc,
  sbWrite, sbInsert, toSupabaseLoan, toSupabaseCustomer, toSupabasePayment, useContactPopup, useToast,
  ModuleHeader, calculateLoanStatus, hasRegFee,
  KPI, Av, Bar
} from '@/lms-common';
import { useModuleFilter } from '@/hooks/useModuleFilter';
import { initiateB2cDisbursement } from '@/utils/mpesa';

const LoansTab = ({ loans, setLoans, customers, setCustomers, payments, setPayments, interactions, setInteractions, workers, addAudit, showToast = () => { }, onNav, onOpenCustomerProfile, onRefresh }) => {
  const { open: openContact, Popup: ContactPopup } = useContactPopup();
  const [sel, setSel] = useState(null);
  const [selCust, setSelCust] = useState(null);
  const [showApp, setShowApp] = useState(false);
  const [payLoan, setPayLoan] = useState(null);
  const [payF, setPayF] = useState({ amount: '', mpesa: '', date: now(), isRegFee: false });
  const [loading, setLoading] = useState(false);
  
  const statuses = ['All', 'Active', 'Overdue', 'Settled', 'Written off'];

  const {
    q, setQ, tab: flt, setTab: setFlt,
    startDate, setStartDate, endDate, setEndDate, applyFilter,
    filtered: rows, handleExport
  } = useModuleFilter({
    data: loans,
    initialTab: 'All',
    dateKey: (l, t) => {
      if (t === 'Overdue' && l.disbursed) {
        const d = new Date(l.disbursed);
        d.setDate(d.getDate() + 30);
        return d.toISOString().split('T')[0];
      }
      return l.disbursed || l.createdAt;
    },
    searchFields: ['id', 'customer', 'customerId', 'officer', 'mpesa', 'phone', 'repaymentType', 'status'],
    reportId: 'loans',
    showToast,
    addAudit,
    initialStartDate: '2024-01-01',
    customFilter: (l, t) => {
      if (t === 'All') return true;
      const actualPaid = l.disbursed ? payments.filter(p => p.loanId === l.id && p.status === "Allocated").reduce((s, p) => s + p.amount, 0) : 0;
      const e = calculateLoanStatus(l, null, actualPaid);
      // If the selected tab is a financial state, use the engine's derived status
      if (['Active', 'Overdue', 'Settled', 'Written off'].includes(t)) {
        return e.badgeStatus === t;
      }
      // Otherwise, fallback to the workflow status stored in the DB (for 'Approved', etc.)
      return l.status === t;
    },
  });

  // Centralized hasRegFee imported from lms-common

  // Legacy disbursement functions removed

  const doRecordPay = () => {
    const paid = payments
      .filter((p) => p.loanId === payLoan.id && p.status === "Allocated")
      .reduce((s, p) => s + p.amount, 0);
    const e = calculateLoanStatus(payLoan, null, paid);
    const amt = parseFloat(payF.amount || 0);
    const currentBalance = e.totalAmountDue;
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid payment amount', 'warn');
      return;
    }

    if (amt > currentBalance) {
      showToast(
        `⚠ Payment of ${fmt(
          amt,
        )} exceeds outstanding balance of ${fmt(currentBalance)}. Please enter a correct amount.`,
        "warn",
      );
      return;
    }
    const newBal = Math.max(currentBalance - amt, 0);
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
    
    // Sync Customer Registration Fee Status if marked
    if (payF.isRegFee) {
      if (setCustomers) {
        setCustomers(cs => cs.map(c => c.id === custId ? { ...c, mpesaRegistered: true } : c));
      }
      sbWrite('customers', { id: custId, mpesa_registered: true });
    }

    addAudit('Payment Recorded', payLoan.id, `${fmt(amt)} via M-Pesa ${payF.mpesa || 'manual'}${payF.isRegFee ? ' [Reg Fee]' : ''}`);
    showToast(`✅ Payment of ${fmt(amt)} recorded and allocated` + (newBal <= 0 ? ' — Loan settled!' : '') + (payF.isRegFee ? ' · Registration fee marked' : ''), 'ok');
    setPayLoan(null); setSel(null); setPayF({ amount: '', mpesa: '', date: now(), isRegFee: false });
  };

  const [pendColl, setPendColl] = useState(true);
  const [confirmAction, setConfirmAction] = useState(null); // {title,message,onConfirm}

  const doWriteoff = l => { const upd = { ...l, status: 'Written off' }; setLoans(ls => ls.map(x => x.id === l.id ? upd : x)); sbWrite('loans', toSupabaseLoan(upd)); addAudit('Loan Written Off', l.id, `Balance: ${fmt(l.balance)}`); showToast(`⚠ Loan ${l.id} written off`, 'warn'); setSel(null); };

  const doApprove = l => { 
    const upd = { ...l, status: 'Approved' }; 
    setLoans(ls => ls.map(x => x.id === l.id ? upd : x)); 
    sbWrite('loans', toSupabaseLoan(upd)); 
    addAudit('Loan Approved', l.id, `Amount: ${fmt(l.amount)}`); 
    showToast(`✅ Loan ${l.id} approved! Proceed to Payments Hub to disburse.`, 'ok'); 
    setSel(null);
    if (onNav) setTimeout(() => onNav('paymentshub', { tab: 'disbursements' }), 1500); // Auto-nav after 1.5s
  };

  const doReject = l => { const upd = { ...l, status: 'Rejected', rejectedAt: now() }; setLoans(ls => ls.map(x => x.id === l.id ? upd : x)); sbWrite('loans', toSupabaseLoan(upd)); addAudit('Loan Rejected', l.id, `Amount: ${fmt(l.amount)}`); showToast(`Loan ${l.id} rejected`, 'warn'); setSel(null); };

  const pendingWorker = useMemo(
    () =>
      loans.filter(
        (l) =>
          l.status === "worker-pending" || l.status === "Application submitted",
      ),
    [loans],
  );
  const stats = useMemo(() => {
    const paidMap = payments.reduce((acc, p) => {
      if (p.loanId && p.status === "Allocated")
        acc[p.loanId] = (acc[p.loanId] || 0) + p.amount;
      return acc;
    }, {});
    
    let totalPrincipal = 0;
    let overdueCount = 0;
    let pendingCount = 0;
    let activeCount = 0;
    let settledThisMonth = 0;
    const nowMonth = new Date().toISOString().slice(0, 7);

    loans.forEach((l) => {
      const p = paidMap[l.id] || 0;
      const e = calculateLoanStatus(l, null, p);
      if (e.badgeStatus === 'Overdue' || e.badgeStatus === 'Frozen') overdueCount++;
      else if (['Application submitted', 'worker-pending'].includes(l.status)) pendingCount++;
      else if (e.badgeStatus === 'Active') activeCount++;
      else if (e.badgeStatus === 'Settled' && l.updatedAt?.startsWith(nowMonth)) settledThisMonth++;
      
      if (['Active', 'Overdue', 'Frozen'].includes(e.badgeStatus)) {
        totalPrincipal += l.amount;
      }
    });

    return { 
      totalPrincipal, overdueCount, pendingCount, activeCount, settledThisMonth,
      text: `${loans.length} total · ${activeCount} active · ${overdueCount} overdue`
    };
  }, [loans, payments]);

  const exportCols = [
    { k: 'id', l: 'ID' },
    { k: 'customer', l: 'Customer' },
    { k: 'amount', l: 'Principal' },
    { k: 'balance', l: 'Balance' },
    { k: 'status', l: 'Status' },
    { k: 'repaymentType', l: 'Type' },
    { k: 'disbursed', l: 'Disbursed' },
    { k: 'id', l: 'Due Date', r: (_, r) => { if (!r.disbursed) return '—'; const d = new Date(r.disbursed); d.setDate(d.getDate() + 30); return d.toISOString().split('T')[0]; } }
  ];

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
          <div 
            onClick={() => setPendColl(!pendColl)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: pendColl ? 'none' : `1px solid ${T.gold}20`, cursor: 'pointer', userSelect: 'none' }}
          >
            <div style={{ color: T.gold, fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{pendColl ? '▶' : '▼'}</span>
              <Hourglass size={16} style={{marginRight:2}}/> {pendingWorker.length} Loan Application{pendingWorker.length > 1 ? 's' : ''} Awaiting Approval
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
               <span style={{ color: T.gold, fontSize: 11, fontWeight: 600 }}>{pendColl ? 'Click to expand' : 'Click to collapse'}</span>
               <span style={{ background: T.gold, color: '#000', borderRadius: 99, padding: '1px 8px', fontSize: 11, fontWeight: 900 }}>{pendingWorker.length}</span>
            </div>
          </div>
          {/* Pending list — 40vh scroll container */}
          {!pendColl && (
            <>
              <div style={{ maxHeight: '40vh', overflowY: 'auto', overflowX: 'hidden' }}>
                {pendingWorker.map(l => (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: `1px solid ${T.gold}14` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: T.txt, fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.customer}</div>
                      <div style={{ color: T.muted, fontSize: 11, fontFamily: T.mono }}>{l.id} · {fmt(l.amount)} · {l.repaymentType} · {l.officer}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <Btn sm v='gold' onClick={(e) => { e.stopPropagation(); doApprove(l); }}><span style={{display:'flex', alignItems:'center', gap:4}}><Check size={14}/> Approve</span></Btn>
                      <Btn sm v='danger' onClick={(e) => { e.stopPropagation(); doReject(l); }}><span style={{display:'flex', alignItems:'center', gap:4}}><X size={14}/> Reject</span></Btn>
                    </div>
                  </div>
                ))}
              </div>
              {pendingWorker.length > 3 && (
                <div style={{ textAlign: 'center', padding: '5px', color: T.gold, fontSize: 11, borderTop: `1px solid ${T.gold}15` }}>
                  Scroll to see all {pendingWorker.length} applications
                </div>
              )}
            </>
          )}
        </div>
      )}
      <ModuleHeader
        title="Credit Management"
        sub="Monitor loan portfolio health, track repayments, and manage approvals."
        stats={stats.text}
        refreshProps={{ onRefresh: () => { onRefresh?.(); setQ(''); setFlt('All'); setSel(null); } }}
        search={{ value: q, onChange: setQ, placeholder: 'Search loan or customer…' }}
        dateRange={{ start: startDate, end: endDate, onStartChange: setStartDate, onEndChange: setEndDate, onSearch: applyFilter }}
        exportProps={{ onExport: (fmt) => handleExport(fmt, 'Loan Report', exportCols) }}
        pillsProps={{ opts: statuses, val: flt, onChange: setFlt }}
      />
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <KPI label="Active Portfolio" value={fmtM(stats.totalPrincipal)} icon={Banknote} color={T.accent} />
        <KPI label="Critical Arrears" value={stats.overdueCount} icon={AlertTriangle} color={T.danger} sub={stats.overdueCount > 0 ? "High Risk" : "Stable"} />
        <KPI label="Pending Review" value={stats.pendingCount} icon={Hourglass} color={T.gold} />
        <KPI label="Settled (MoM)" value={stats.settledThisMonth} icon={TrendingUp} color={T.ok} sub="+ Monthly Growth" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Btn onClick={() => setShowApp(true)} icon={Plus}>+ New Application</Btn>
      </div>

      <Card noPadding>
        <DT
          cols={[
            { 
              k: 'customer', l: 'Borrower', r: (v, r) => {
                const c = customers.find(x => x.name === v);
                const ini = v.split(' ').map(n=>n[0]).join('').slice(0,2);
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Av ini={ini} size={34} color={T.accent} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                       <span onClick={e => { e.stopPropagation(); if (c) { onOpenCustomerProfile?.(c.id); } }} style={{ color: T.txt, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>{v}</span>
                       <span style={{ fontSize: 10, color: T.dim, fontFamily: T.mono }}>{r.id}</span>
                    </div>
                  </div>
                );
              } 
            }, 
            { 
              k: 'amount', l: 'Financial Snapshot', r: (v, r) => {
                // If loan is not disbursed, it cannot have valid repayment progress
                const actualPaid = r.disbursed ? payments.filter(p => p.loanId === r.id && p.status === "Allocated").reduce((s, p) => s + p.amount, 0) : 0;
                const e = calculateLoanStatus(r, null, actualPaid);
                const progress = Math.min((actualPaid / (e.totalPayable || 1)) * 100, 100);
                return (
                  <div style={{ minWidth: 140 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, fontWeight: 600 }}>
                      <span style={{ color: T.dim }}>Bal: {fmt(e.totalAmountDue)}</span>
                      <span style={{ color: T.accent }}>{Math.round(progress)}%</span>
                    </div>
                    <Bar percent={progress} color={e.totalAmountDue > 0 ? T.accent : T.ok} height={6} />
                    <div style={{ marginTop: 4, fontSize: 10, color: T.muted }}>
                      Principal: {fmt(v)}
                    </div>
                  </div>
                );
              }
            },
            {
              k: "status",
              l: "Status",
              r: (v, r) => {
                const paid = payments.filter((p) => p.loanId === r.id && p.status === "Allocated").reduce((s, p) => s + p.amount, 0);
                const e = calculateLoanStatus(r, null, paid);
                return <Badge color={SC[e.badgeStatus] || T.muted} variant={e.badgeStatus === 'Overdue' ? 'solid' : 'subtle'}>{e.status}</Badge>;
              },
            },
            { 
                k: "disbursed", l: "Timeline", r: (v, r) => {
                  if (!v) return <span style={{ color: T.muted, fontSize: 12 }}>Application Stage</span>;
                  const paid = payments.filter((p) => p.loanId === r.id && p.status === "Allocated").reduce((s, p) => s + p.amount, 0);
                  const e = calculateLoanStatus(r, null, paid);
                  const isOverdue = e.overdueDays > 0;
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                       <span style={{ fontSize: 12, fontWeight: 700, color: isOverdue ? T.danger : T.txt }}>{isOverdue ? `${e.overdueDays}d Late` : `${e.totalDays}d Active`}</span>
                       <span style={{ fontSize: 10, color: T.dim }}>Repay: {r.repaymentType}</span>
                    </div>
                  );
                }
            },
            {
              k: "id", l: "", r: (v, row) => (
                <Btn icon={ChevronRight} onClick={() => setSel(row)} variant="ghost" size="sm" />
              )
            }
          ]}
          rows={rows} onRow={setSel}
        />
      </Card>
      {sel && (
        <LoanModal
          loan={sel} customers={customers} payments={payments} interactions={interactions || []}
          onClose={() => setSel(null)}
          onViewCustomer={cust => { setSel(null); onOpenCustomerProfile?.(cust.id); }}
          actions={(
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(sel.status === 'Application submitted' || sel.status === 'worker-pending') && <Btn v='gold' onClick={() => { doApprove(sel); setSel(null); }}><span style={{display:'flex',alignItems:'center',gap:4}}><Check size={14}/> Approve</span></Btn>}
              {(sel.status === 'Application submitted' || sel.status === 'worker-pending') && <Btn v='danger' onClick={() => setConfirmAction({ title: 'Reject Application', message: `Reject loan application ${sel.id} for ${sel.customer} (${fmt(sel.amount)})? The customer will need to re-apply.`, onConfirm: () => { doReject(sel); setConfirmAction(null); } })}><span style={{display:'flex',alignItems:'center',gap:4}}><X size={14}/> Reject</span></Btn>}
              {sel.status === 'Approved' && <Btn v='primary' onClick={() => { if (onNav) onNav('paymentshub', { tab: 'disbursements' }); setSel(null); }}><span style={{display:'flex',alignItems:'center',gap:6}}><Banknote size={16}/> Central Disbursement</span></Btn>}
              {['Active', 'Overdue'].includes(sel.status) && <Btn v='ok' onClick={() => { setPayLoan(sel); setSel(null); }}><span style={{display:'flex',alignItems:'center',gap:6}}><CreditCard size={16}/> Record Payment</span></Btn>}
              {!['Written off', 'Settled', 'Rejected'].includes(sel.status) && <Btn v='danger' onClick={() => setConfirmAction({ title: 'Write Off Loan', message: `Write off loan ${sel.id} for ${sel.customer}? Balance of ${fmt(sel.balance)} will be marked as a loss. This cannot be undone.`, onConfirm: () => { doWriteoff(sel); setConfirmAction(null); } })}><span style={{display:'flex',alignItems:'center',gap:4}}><X size={14}/> Write Off</span></Btn>}
              {['Active', 'Overdue', 'Approved'].includes(sel.status) && (() => {
                const sc = customers.find(c => c.id === sel.customerId); return (<>
                  <Btn v='blue' onClick={() => downloadLoanDoc(generateLoanAgreementHTML(sel, sc || { name: sel.customer }, sel.officer), 'loan-agreement-' + sel.id + '.html')}><span style={{display:'flex',alignItems:'center',gap:4}}><FileText size={14}/> Agreement</span></Btn>
                  <Btn v='secondary' onClick={() => downloadLoanDoc(generateAssetListHTML(sel, sc || { name: sel.customer }, sel.officer), 'asset-list-' + sel.id + '.html')}><span style={{display:'flex',alignItems:'center',gap:4}}><PackageOpen size={14}/> Assets</span></Btn>
                </>);
              })()}
              <Btn v='ghost' onClick={() => setSel(null)}>Close</Btn>
            </div>
          )}
        />
      )}

      {/* Global Customer Profile now handled via onOpenCustomerProfile */}


      {showApp && (
        <Dialog title='New Loan Application' onClose={() => setShowApp(false)} width={560}>
          <LoanForm customers={customers} payments={payments} loans={loans} onSave={async l => { 
            // MODIFIED: Added Eligibility Gate
            const cust = customers.find(c => c.id === l.customerId);
            if (cust && !hasRegFee(cust, payments)) {
              showToast('Eligibility Denied: Registration fee must be confirmed in the Payments Hub first.', 'danger', 6000);
              if (onNav) setTimeout(() => onNav('paymentshub', { tab: 'registration-fee' }), 1000); 
              return;
            }
            // Proceed with saving
            setLoans(ls => [l, ...ls]); 
            sbInsert('loans', toSupabaseLoan(l)); 
            const updCust = customers.find(c => c.id === l.customerId); 
            if (updCust) { 
              const nc = { ...updCust, loans: (updCust.loans || 0) + 1 }; 
              setCustomers(cs => cs.map(c => c.id === l.customerId ? nc : c)); 
              sbWrite('customers', toSupabaseCustomer(nc)); 
            } else { 
              setCustomers(cs => cs.map(c => c.id === l.customerId ? { ...c, loans: (c.loans || 0) + 1 } : c)); 
            } 
            addAudit('Loan Application', l.id, `${fmt(l.amount)} for ${l.customer}`); 
            setShowApp(false); 
          }} onClose={() => setShowApp(false)} />
        </Dialog>
      )}
      {/* Legacy disbursement dialog removed */}
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
            <div style={{ display: 'flex', gap: 9 }}><Btn onClick={doRecordPay} full><span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6}}><Check size={16}/> Save Payment</span></Btn><Btn v='secondary' onClick={() => { setPayLoan(null); setPayF({ amount: '', mpesa: '', date: now(), isRegFee: false }); }}>Cancel</Btn></div>
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