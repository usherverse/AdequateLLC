import React, { useState, useMemo, useEffect } from 'react';
import { Landmark, Download, RefreshCw, Send, CheckCircle, Clock, TrendingUp, Users, DollarSign, Wallet, FileText, ArrowRight, Printer, AlertCircle, Zap, ShieldCheck, Activity } from 'lucide-react';
import { T, DT, Btn, Badge, fmt, ts, now, KPI, Card, CH, fmtM, Dialog, FI, generatePayslipHTML, dlBlob } from '@/lms-common';

const SalariesTab = ({ workers = [], salaryPayments = [], setSalaryPayments, customers = [], loans = [], leads = [], addAudit, showToast, onNav, workerDeductions = [], setWorkerDeductions, payments = [] }) => {
  const [view, setView] = useState('payroll'); // Default to Analysis for better UX
  const [loading, setLoading] = useState(false);
  const [payoutModal, setPayoutModal] = useState(null); 
  const [deductionModal, setDeductionModal] = useState(null);

  const stats = useMemo(() => {
    const totalPaid = salaryPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const monthPaid = salaryPayments
      .filter(p => p.month === now().slice(0, 7))
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const pendingCount = salaryPayments.filter(p => p.status === 'Pending').length;
    
    return { totalPaid, monthPaid, pendingCount };
  }, [salaryPayments]);

  const [directCounts, setDirectCounts] = useState({});

  // DIRECT RECONCILIATION: If local state is failing, fetch directly from source
  React.useEffect(() => {
    const runDirectSync = async () => {
      try {
        const { supabase } = await import('@/config/supabaseClient');
        const counts = {};
        
        for (const w of workers) {
          // Query 1: Count by Name
          const { count: countName } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .ilike('officer', `%${w.name}%`)
            .not('status', 'eq', 'Rejected');

          // Query 2: Count by Assigned ID
          const { count: countId } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_officer', w.id)
            .not('status', 'eq', 'Rejected');

          counts[w.id] = Math.max(countName || 0, countId || 0);
        }
        setDirectCounts(counts);

        const { data: dData } = await supabase.from('worker_deductions').select('*').order('created_at', { ascending: false });
        if (setWorkerDeductions) setWorkerDeductions(dData || []);
      } catch (e) {
        console.error("[DirectSync] Failed:", e);
      }
    };
    runDirectSync();
  }, [workers]);

  const payrollData = useMemo(() => {
    return workers.map(w => {
      const wIdStr = String(w.id || '').trim().toLowerCase();
      const wNmStr = String(w.name || '').trim().toLowerCase();
      const currentMonth = now().slice(0, 7);

      let estimatedEarned = 0;
      let progress = 0;
      let activeCount = 0;
      let label = "";

      if (w.role === 'Collections Officer') {
        // ── Collections Officer Logic ──
        // Based on % of collections in the current month
        const myLoans = loans.filter(l => (l.collections_officer || '').toLowerCase() === wNmStr);
        
        // Total collected by this officer this month
        const collected = payments.filter(p => 
          p.status === 'Allocated' && 
          p.date?.startsWith(currentMonth) &&
          myLoans.some(l => l.id === p.loanId)
        ).reduce((s, p) => s + p.amount, 0);

        // Total "Target" (What should have been collected)
        // We define target as (Collected + Remaining Overdue today)
        const remainingOverdue = myLoans.reduce((total, l) => {
          const lPays = payments.filter(p => p.loanId === l.id && p.status === 'Allocated');
          const paid = lPays.reduce((s, p) => s + p.amount, 0);
          const e = calculateLoanStatus(l, null, paid);
          return total + (e.totalAmountDue > 0 ? e.totalAmountDue : 0);
        }, 0);

        const totalTarget = collected + remainingOverdue;
        const collRate = totalTarget > 0 ? (collected / totalTarget) * 100 : 0;
        progress = collRate;
        label = "COLLECTION RATE";

        // Tiers: 90% -> 10k, 94% -> 15k, 100% -> 20k
        if (collRate >= 100) estimatedEarned = 20000;
        else if (collRate >= 94) estimatedEarned = 15000;
        else if (collRate >= 90) estimatedEarned = 10000;
        else {
          // Linear scaling below 90% to avoid 0 pay? 
          // User said "supposed to be paid 10k for 90%", implying it starts there.
          // We'll give fractional if requested, but for now strict tiers.
          estimatedEarned = (collRate / 90) * 10000; 
        }
        activeCount = myLoans.length;
      } else {
        // ── Loan Officer / Default Logic ──
        let localCusts = (customers || []).filter(c => {
          const cAssigned = String(c.assigned_officer || '').trim().toLowerCase();
          const cOfficer  = String(c.officer || '').trim().toLowerCase();
          return (wIdStr && cAssigned === wIdStr) || (wNmStr && cOfficer === wNmStr);
        });

        activeCount = Math.max(localCusts.length, directCounts[w.id] || 0);
        const target = Number(w.onboardingTarget) || 60;
        const base = Number(w.baseSalary) || 20000;
        
        progress = target > 0 ? (activeCount / target) * 100 : 0;
        estimatedEarned = Math.round((activeCount / (target || 60)) * base);
        label = "ONBOARDING TARGET";
      }
      
      const paidThisMonth = salaryPayments
        .filter(p => String(p.worker_id) === String(w.id) && p.month === currentMonth && p.status === 'Success')
        .reduce((s, p) => s + (Number(p.amount) || 0), 0);

      const monthDeductions = (workerDeductions || [])
        .filter(d => String(d.worker_id) === String(w.id) && d.month === currentMonth)
        .reduce((s, d) => s + (Number(d.amount) || 0), 0);

      const netDue = Math.max(0, Math.round(estimatedEarned) - (paidThisMonth + monthDeductions));

      return { ...w, activeCount, estimatedEarned, paidThisMonth, monthDeductions, netDue, progress, label };
    });
  }, [workers, customers, loans, payments, salaryPayments, directCounts, workerDeductions]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const { supabase } = await import('@/config/supabaseClient');
      const { data, error } = await supabase
        .from('salary_payments')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (setSalaryPayments) setSalaryPayments(data || []);
      showToast('Global Ledger synchronized');
    } catch (err) {
      showToast('Sync failed: ' + err.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleExecutePayout = async (worker, amount) => {
    if (!amount || amount < 10) return showToast('Amount too low for B2C', 'warn');
    setLoading(true);
    try {
      const { supabase } = await import('@/config/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/payments/payouts/worker/${worker.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ amount, phone: worker.phone })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'M-Pesa Gateway rejected request');

      showToast('B2C Disbursement Initiated successfully', 'success');
      setPayoutModal(null);
      handleRefresh(); // Update ledger
      addAudit('Salary Payout', worker.name, `Amount: ${fmt(amount)}`);
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleRecordDeduction = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const amount = Number(fd.get('amount'));
    const reason = fd.get('reason');
    if (!amount || !reason) return;
    setLoading(true);
    try {
      const { supabase } = await import('@/config/supabaseClient');
      const { data, error } = await supabase.from('worker_deductions').insert([{
        worker_id: deductionModal.id, amount, reason, month: now().slice(0, 7)
      }]).select().single();
      if (error) throw error;
      setWorkerDeductions(prev => [data, ...prev]);
      showToast('Deduction applied to payroll');
      setDeductionModal(null);
    } catch (err) { showToast(err.message, 'danger'); } finally { setLoading(false); }
  };

  const handlePrintPayslip = (worker, payment) => {
    const wDeds = (workerDeductions || []).filter(d => String(d.worker_id) === String(worker.id) && d.month === payment.month);
    const html = generateItemizedPayslip(worker, payment, payment.month, wDeds);
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  const generateItemizedPayslip = (worker, payment, month, deductions = []) => {
    const today = now();
    const fmtKey = (v) => "KES " + Number(v || 0).toLocaleString("en-KE");
    const totalDeds = deductions.reduce((s,d)=>s+Number(d.amount),0);
    return `
      <!DOCTYPE html><html><head><meta charset=UTF-8><style>
        body { font-family: 'Inter', 'Segoe UI', sans-serif; padding: 25mm; color: #1e293b; background: #fff; line-height: 1.5; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #00D4AA; padding-bottom: 25px; margin-bottom: 35px; }
        .logo { font-size: 26px; font-weight: 900; color: #00D4AA; }
        .table { width: 100%; border-collapse: collapse; margin: 30px 0; }
        .table th { text-align: left; background: #f8fafc; padding: 14px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; }
        .table td { padding: 14px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
        .total-row { background: #f8fafc; font-weight: 900; }
      </style></head><body>
        <div class="header"><div><div class="logo">Adequate Capital Ltd</div><div style="font-size: 11px; font-weight: 700; color: #64748b;">PAYROLL EARNINGS STATEMENT</div></div><div style="text-align: right;"><b>OFFICIAL PAYSLIP</b><br>${month}</div></div>
        <div style="margin-bottom: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;"><div><div style="font-size: 10px; color: #94a3b8; font-weight: 800;">EMPLOYEE</div><div style="font-size: 15px; font-weight: 800;">${worker.name}</div><div style="font-size: 12px; color: #64748b;">Phone: ${worker.phone}</div></div><div><div style="font-size: 10px; color: #94a3b8; font-weight: 800;">STATEMENT REFERENCE</div><div style="font-size: 14px; font-weight: 700; color: #64748b;">${payment.mpesa_receipt || payment.id}</div></div></div>
        <table class="table">
          <thead><tr><th>Description</th><th style="text-align: right;">Amount</th></tr></thead>
          <tbody>
            <tr><td style="font-weight: 700;">Gross Commission Earnings</td><td style="text-align: right; font-weight: 700;">${fmtKey(payment.amount + totalDeds)}</td></tr>
            ${deductions.map(d => `<tr><td style="color: #ef4444;">Deduction: ${d.reason}</td><td style="text-align: right; color: #ef4444;">- ${fmtKey(d.amount)}</td></tr>`).join('')}
          </tbody>
          <tfoot><tr class="total-row"><td>NET PAYABLE DISBURSEMENT</td><td style="text-align: right; font-size: 18px; color: #00D4AA;">${fmtKey(payment.amount)}</td></tr></tfoot>
        </table>
        <div style="margin-top: 50px; padding: 20px; background: #f1f5f9; border-radius: 12px; font-size: 12px; text-align: center;">Funds disbursed via M-Pesa. Internal Ref: ${payment.id}</div>
      </body></html>
    `;
  };

  return (
    <div className="fu" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <Badge color={T.accent} style={{ marginBottom: 8 }}>FINANCIAL OPERATIONS</Badge>
          <h2 style={{ fontSize: 32, fontWeight: 900, color: T.txt, margin: 0, letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Wallet size={36} color={T.accent} strokeWidth={2.5} /> Salary Ledger
          </h2>
          <p style={{ color: T.muted, fontSize: 14, fontWeight: 500, marginTop: 4 }}>Immutable audit trail for all B2C disbursements and performance-based compensation.</p>
        </div>
        
        <div style={{ background: T.surface, padding: '4px', borderRadius: 16, border: `1px solid ${T.border}`, display: 'flex', gap: 4 }}>
           <button onClick={() => setView('payroll')} style={{ 
             padding: '8px 20px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800,
             background: view === 'payroll' ? 'linear-gradient(135deg, #00D4AA 0%, #00a884 100%)' : 'transparent',
             color: view === 'payroll' ? '#000' : T.dim, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
           }}>Payroll Analysis</button>
           <button onClick={() => setView('ledger')} style={{ 
             padding: '8px 20px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800,
             background: view === 'ledger' ? 'linear-gradient(135deg, #00D4AA 0%, #00a884 100%)' : 'transparent',
             color: view === 'ledger' ? '#000' : T.dim, transition: 'all 0.3s'
           }}>History & Audit</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          <KPI label="Total Life-to-Date Payouts" value={fmt(stats.totalPaid)} icon={DollarSign} color={T.ok} />
          <KPI label="Current Month Liquidated" value={fmt(stats.monthPaid)} sub={now().slice(0, 7)} icon={TrendingUp} color={T.accent} />
          <KPI label="Recipient Headcount" value={workers.length} sub="Verified Staff" icon={Users} color={T.blue} />
          <KPI label="Awaiting Reconciliation" value={stats.pendingCount} sub="External Bank Tx" icon={Clock} color={stats.pendingCount > 0 ? T.warn : T.ok} />
      </div>

      {view === 'ledger' ? (
        <Card style={{ padding: 0, overflow: 'hidden', border: `1px solid ${T.border}`, boxShadow: '0 20px 50px rgba(0,0,0,0.15)' }}>
          <DT 
            cols={[
              { k: 'worker_id', l: 'Recipient', r: (v) => {
                const w = workers.find(x => x.id === v);
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: T.aLo, color: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13 }}>{w?.name?.charAt(0) || 'W'}</div>
                    <div>
                      <div style={{ fontWeight: 800, color: T.txt, fontSize: 14 }}>{w?.name || v}</div>
                      <div style={{ fontSize: 11, color: T.dim, fontWeight: 500 }}>{w?.role || 'Staff Member'}</div>
                    </div>
                  </div>
                );
              }},
              { k: 'amount', l: 'Amount', r: v => <span style={{ fontWeight: 900, color: T.accent, fontSize: 15 }}>{fmt(v)}</span> },
              { k: 'status', l: 'Status', r: v => (
                <Badge color={v === 'Success' ? T.ok : v === 'Pending' ? T.warn : T.danger}>
                  {v === 'Success' ? <><CheckCircle size={10} /> Cleared</> : v === 'Pending' ? <><Clock size={10} /> Routing</> : v}
                </Badge>
              )},
              { k: 'recipient_phone', l: 'M-Pesa Destination', r: v => <span style={{ fontWeight: 600, color: T.dim }}>{v}</span> },
              { k: 'mpesa_receipt', l: 'TXN Reference', r: v => <span style={{ fontFamily: T.mono, fontSize: 11, color: T.dim }}>{v || 'PENDING_GW'}</span> },
              { k: 'created_at', l: 'Timestamp', r: v => <span style={{ fontSize: 12, color: T.dim }}>{ts(v)}</span> },
              { k: 'id', l: 'Actions', r: (v, row) => (
                <div style={{ display: 'flex', gap: 6 }}>
                   <Btn sm onClick={() => handlePrintPayslip(workers.find(x => x.id === row.worker_id), row)} icon={Printer} style={{ padding: '6px 12px' }}>Slip</Btn>
                </div>
              )}
            ]}
            rows={salaryPayments}
            emptyMsg="The disbursement ledger is empty. No payroll transactions found."
            maxHeightVh={0.6}
          />
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20 }}>
           {payrollData.sort((a,b) => b.netDue - a.netDue).map(w => (
             <Card key={w.id} style={{ 
               padding: 24, transition: 'all 0.3s ease', position: 'relative', overflow: 'hidden', 
               border: `1px solid ${T.border}`, background: `linear-gradient(145deg, ${T.card} 0%, ${T.surface} 100%)`
             }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                   <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <div style={{ width: 56, height: 56, borderRadius: 16, background: w.netDue > 0 ? 'rgba(0, 212, 170, 0.1)' : T.border, color: w.netDue > 0 ? T.accent : T.dim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 24, border: `1.5px solid ${w.netDue > 0 ? T.accent : T.border}50` }}>{w.name.charAt(0)}</div>
                      <div>
                         <div style={{ color: T.txt, fontWeight: 900, fontSize: 18, letterSpacing: '-0.01em' }}>{w.name}</div>
                         <div style={{ color: T.muted, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{w.role}</div>
                      </div>
                   </div>
                   <div style={{ textAlign: 'right' }}>
                      <Badge color={w.netDue > 0 ? T.warn : T.ok}>{w.netDue > 0 ? 'PAYMENT DUE' : 'FULLY PAID'}</Badge>
                      <div style={{ fontSize: 20, fontWeight: 900, color: T.txt, marginTop: 4 }}>{fmt(w.netDue)}</div>
                   </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 12, marginBottom: 24 }}>
                   <div style={{ padding: 14, background: T.surface, borderRadius: 14, border: `1px solid ${T.border}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.dim, fontWeight: 800, fontSize: 10, marginBottom: 4 }}><Activity size={12}/> EST. COMMISSIONS</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: T.txt }}>{fmt(w.estimatedEarned)}</div>
                   </div>
                   <div style={{ padding: '4px 14px', background: T.surface, borderRadius: 14, border: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                         <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.dim, fontWeight: 800, fontSize: 10, marginBottom: 4 }}><AlertCircle size={12}/> DEDUCTIONS</div>
                         <div style={{ fontSize: 18, fontWeight: 900, color: T.danger }}>- {fmt(w.monthDeductions)}</div>
                      </div>
                      <Btn sm v="secondary" icon={AlertCircle} onClick={() => setDeductionModal(w)} style={{ padding: '6px 12px' }}>Adjust</Btn>
                   </div>
                </div>

                <div style={{ marginBottom: 28 }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: T.muted, display: 'flex', alignItems: 'center', gap: 8 }}>{w.label} <span style={{ color: T.accent }}>{w.role === 'Collections Officer' ? `${Math.round(w.progress)}%` : `${w.activeCount} / ${w.onboardingTarget || 60}`}</span></div>
                      <div style={{ fontSize: 12, fontWeight: 900, color: T.txt }}>{Math.round(w.progress)}%</div>
                   </div>
                   <div style={{ height: 10, background: T.border, borderRadius: 20, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, (w.progress || 0))}%`, background: `linear-gradient(90deg, ${T.accent} 0%, #00a884 100%)`, borderRadius: 20, transition: 'width 1s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }} />
                   </div>
                </div>

                {w.netDue > 0 ? (
                  <Btn block v="primary" icon={Zap} style={{ background: T.accent, color: '#000', height: 48, borderRadius: 14, fontSize: 14 }} onClick={() => setPayoutModal(w)}>
                    Execute Managed Payout
                  </Btn>
                ) : (
                  <div style={{ padding: '14px', borderRadius: 14, background: `${T.ok}08`, border: `1px dashed ${T.ok}40`, color: T.ok, fontWeight: 800, fontSize: 13, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <ShieldCheck size={18} /> Reconciliation Complete
                  </div>
                )}
             </Card>
           ))}
        </div>
      )}

      {/* Payout Modal */}
      {payoutModal && (
        <Dialog title="Finalize Disbursement" onClose={() => setPayoutModal(null)} width={480}>
           <div style={{ padding: '4px 0' }}>
              <div style={{ background: T.surface, padding: 20, borderRadius: 16, marginBottom: 24, border: `1px solid ${T.border}` }}>
                 <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Recipient Distribution</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: T.txt, marginTop: 4 }}>{payoutModal.name}</div>
                    <div style={{ color: T.accent, fontSize: 14, fontWeight: 700, background: T.aLo, padding: '4px 12px', borderRadius: 99, display: 'inline-block', marginTop: 8 }}>{payoutModal.phone}</div>
                 </div>
                 
                 <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ color: T.muted, fontSize: 13, fontWeight: 600 }}>Unpaid Earnings</span>
                    <span style={{ color: T.txt, fontWeight: 900 }}>{fmt(payoutModal.estimatedEarned)}</span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ color: T.danger, fontSize: 13, fontWeight: 600 }}>Deductions Applied</span>
                    <span style={{ color: T.danger, fontWeight: 900 }}>- {fmt(payoutModal.monthDeductions)}</span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: `2.5px solid ${T.accent}30` }}>
                    <span style={{ color: T.accent, fontSize: 14, fontWeight: 800 }}>Total B2C Payout</span>
                    <span style={{ color: T.accent, fontSize: 20, fontWeight: 900 }}>{fmt(payoutModal.netDue)}</span>
                 </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                 <Btn block v="primary" loading={loading} icon={Zap} style={{ background: T.accent, color: '#000', height: 52, borderRadius: 16, fontSize: 15 }} onClick={() => handleExecutePayout(payoutModal, payoutModal.netDue)}>
                   Release Funds via M-Pesa B2C
                 </Btn>
                 <Btn block v="secondary" onClick={() => setPayoutModal(null)} style={{ border: 'none', color: T.dim }}>Discard and Exit</Btn>
              </div>

              <div style={{ marginTop: 24, textAlign: 'center', color: T.muted, fontSize: 11, fontStyle: 'italic' }}>
                 <AlertCircle size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                 This transaction is immutable and will be recorded in the audit ledger immediately upon network acknowledgment.
              </div>
           </div>
        </Dialog>
      )}

      {/* Deduction Modal */}
      {deductionModal && (
        <Dialog title="Log Manual Deduction" onClose={() => setDeductionModal(null)} width={420}>
           <form onSubmit={handleRecordDeduction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ color: T.muted, fontSize: 13 }}>Recording a deduction for <b>{deductionModal.name}</b> for the period of <b>{now().slice(0, 7)}</b>.</p>
              
              <FI label="Deduction Amount (KES)" name="amount" type="number" required autoFocus />
              <FI label="Reason for Adjustment" name="reason" placeholder="e.g. Salary Advance, Lost Asset, Performance Penalty" required />

              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                 <Btn block v="primary" type="submit" loading={loading} icon={CheckCircle} style={{ background: T.danger, color: '#fff' }}>Apply Deduction</Btn>
                 <Btn block v="secondary" onClick={() => setDeductionModal(null)}>Cancel</Btn>
              </div>
           </form>
        </Dialog>
      )}
    </div>
  );
};

export default SalariesTab;
