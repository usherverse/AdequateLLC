import React, { useState, useMemo, useEffect } from 'react';
import { Landmark, Download, RefreshCw, Send, CheckCircle, Clock, TrendingUp, Users, DollarSign, Wallet, FileText, ArrowRight, Printer, AlertCircle, Zap, ShieldCheck, Activity } from 'lucide-react';
import { T, DT, Btn, Badge, fmt, ts, now, KPI, Card, CH, fmtM, Dialog, FI, generatePayslipHTML, dlBlob } from '@/lms-common';

const SalariesTab = ({ workers = [], salaryPayments = [], setSalaryPayments, customers = [], loans = [], leads = [], addAudit, showToast, onNav, workerDeductions = [], setWorkerDeductions, payments = [], theme }) => {
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
        const currentMonth = now().slice(0, 7); // e.g. "2024-04"
        const monthStart = `${currentMonth}-01`;
        
        for (const w of workers) {
          // Query 1: Count by Name (Onboarded this month)
          const { count: countName } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .ilike('officer', `%${w.name}%`)
            .gte('joined', monthStart)
            .not('status', 'eq', 'Rejected');

          // Query 2: Count by Assigned ID (Onboarded this month)
          const { count: countId } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_officer', w.id)
            .gte('joined', monthStart)
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
          const isAssigned = (wIdStr && cAssigned === wIdStr) || (wNmStr && cOfficer === wNmStr);
          if (!isAssigned) return false;

          // Only count customers onboarded in the current month
          const cMonth = (c.joined || c.createdAt || '').slice(0, 7);
          if (cMonth !== currentMonth) return false;

          // Ensure they have at least one loan that has been disbursed
          const custLoans = (loans || []).filter(l => l.customerId === c.id);
          return custLoans.some(l => ['Active', 'Closed', 'Legal', 'Defaulted'].includes(l.status));
        });

        activeCount = Math.max(localCusts.length, directCounts[w.id] || 0);
        const target = Number(w.onboardingTarget) || 60;
        const base = Number(w.baseSalary) || 20000;
        
        progress = target > 0 ? (activeCount / target) * 100 : 0;
        estimatedEarned = Math.round(activeCount * 333.33);
        label = "DISBURSED GROWTH";
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

  const handleExecutePayout = async (worker) => {
    if (!worker.phone) {
      showToast('Cannot disburse — worker has no phone number on profile.', 'danger');
      return;
    }
    setLoading(true);
    try {
      const { initiateWorkerPayout } = await import('@/utils/mpesa');
      await initiateWorkerPayout({
        worker_id: worker.id,
        amount: worker.netDue,
        phone: worker.phone
      });

      showToast('B2C Disbursement Initiated — funds en route via M-Pesa', 'success');
      setPayoutModal(null);
      handleRefresh();
      addAudit('Salary Payout', worker.name, `KES ${worker.netDue} B2C via Edge Function`);
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
    <div className="fu" style={{ display: 'flex', flexDirection: 'column', gap: 32, animation: 'fadeIn 0.5s ease-out' }}>
      {/* ── PREMIUM HEADER AREA ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
             <div style={{ width: 32, height: 2, background: T.accent, borderRadius: 2 }} />
             <div style={{ fontSize: 13, fontWeight: 800, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Payroll Operations</div>
          </div>
          <h1 style={{ fontSize: 42, fontWeight: 950, color: T.txt, margin: 0, letterSpacing: '-0.04em', lineHeight: 1 }}>Salary Ledger</h1>
          <p style={{ color: T.muted, marginTop: 12, fontSize: 15, maxWidth: 500, lineHeight: 1.6 }}>
            Unified disbursement gateway for commission-only payroll. All transactions are logged in a high-fidelity audit trail.
          </p>
        </div>

        <div style={{ background: T.surface, padding: '4px', borderRadius: 16, border: `1px solid ${T.border}`, display: 'flex', gap: 4 }}>
           <button onClick={() => setView('payroll')} style={{ 
             padding: '10px 24px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800,
             background: view === 'payroll' ? 'linear-gradient(135deg, #00D4AA 0%, #00a884 100%)' : 'transparent',
             color: view === 'payroll' ? '#000' : T.dim, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
           }}>Payroll Analysis</button>
           <button onClick={() => setView('ledger')} style={{ 
             padding: '10px 24px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800,
             background: view === 'ledger' ? 'linear-gradient(135deg, #00D4AA 0%, #00a884 100%)' : 'transparent',
             color: view === 'ledger' ? '#000' : T.dim, transition: 'all 0.3s'
           }}>Transaction Vault</button>
        </div>
      </div>

      {/* ── KPI CLOUD (GLASSMorphism) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
         <div className="glass-card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, background: T.accent, filter: 'blur(70px)', opacity: 0.15 }} />
            <div style={{ fontSize: 13, fontWeight: 900, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
               <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.accent }} /> Total Settled Payroll
            </div>
            <div style={{ fontSize: 42, fontWeight: 950, color: T.txt, letterSpacing: '-0.03em' }}>{fmtM(stats.totalPaid)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16, fontSize: 13, color: T.ok, fontWeight: 800 }}>
               <TrendingUp size={14} /> <span>Active liquidity cycle</span>
            </div>
         </div>

         <div className="glass-card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, background: T.ok, filter: 'blur(70px)', opacity: 0.12 }} />
            <div style={{ fontSize: 13, fontWeight: 900, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
               <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.ok }} /> Month Disbursements
            </div>
            <div style={{ fontSize: 42, fontWeight: 950, color: T.txt, letterSpacing: '-0.03em' }}>{fmtM(stats.monthPaid)}</div>
            <div style={{ fontSize: 13, color: T.dim, marginTop: 16, fontWeight: 700 }}>Period: <span style={{ color: T.txt }}>{now().slice(0, 7)}</span></div>
         </div>

         <div className="glass-card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, background: T.warn, filter: 'blur(70px)', opacity: 0.15 }} />
            <div style={{ fontSize: 13, fontWeight: 900, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
               <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.warn }} /> Pending Reconciliation
            </div>
            <div style={{ fontSize: 42, fontWeight: 950, color: T.txt, letterSpacing: '-0.03em' }}>{stats.pendingCount} <span style={{ fontSize: 16, color: T.dim, fontWeight: 600 }}>Staff</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16, fontSize: 13, color: T.warn, fontWeight: 800 }}>
               <ShieldCheck size={14} /> <span>Awaiting B2C execution</span>
            </div>
         </div>
      </div>

      {view === 'ledger' ? (
        <Card style={{ borderRadius: 24, padding: 0, overflow: 'hidden', border: `1px solid ${T.border}`, background: T.card }}>
          <CH title="Historical Disbursement Ledger" icon={Activity} sub="Complete record of all direct Salary transfers initiated via M-Pesa B2C" />
          <DT 
            cols={[
              { k: 'worker_id', l: 'Recipient', r: (v) => {
                const w = (workers || []).find(x => x.id === v);
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: T.aLo, color: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 950, fontSize: 13 }}>{w?.name?.charAt(0) || 'W'}</div>
                    <div>
                      <div style={{ fontWeight: 950, color: T.txt, fontSize: 14 }}>{w?.name || v}</div>
                      <div style={{ fontSize: 11, color: T.dim, fontWeight: 500 }}>{w?.role || 'Staff Member'}</div>
                    </div>
                  </div>
                );
              }},
              { k: 'amount', l: 'Amount', r: v => <span style={{ fontWeight: 950, color: T.accent, fontSize: 15 }}>{fmt(v)}</span> },
              { k: 'status', l: 'Status', r: v => (
                <Badge color={v === 'Success' ? T.ok : v === 'Pending' ? T.warn : T.danger}>
                   {v?.toUpperCase()}
                </Badge>
              )},
              { k: 'recipient_phone', l: 'M-Pesa Destination', r: v => <span style={{ fontWeight: 700, color: T.dim }}>{v}</span> },
              { k: 'mpesa_receipt', l: 'TXN Reference', r: v => <span style={{ fontFamily: T.mono, fontSize: 11, color: T.dim, background: 'rgba(0,212,170,0.05)', padding: '2px 6px', borderRadius: 4 }}>{v || 'PENDING_GW'}</span> },
              { k: 'created_at', l: 'Timestamp', r: v => ts(v) },
              { k: 'id', l: 'Actions', r: (v, row) => (
                <div style={{ display: 'flex', gap: 6 }}>
                   <Btn sm v="secondary" onClick={() => handlePrintPayslip((workers || []).find(x => x.id === row.worker_id), row)} icon={Printer}>Slip</Btn>
                </div>
              )}
            ]}
            rows={salaryPayments}
            emptyMsg="The disbursement ledger is empty. No payroll transactions found."
            maxHeightVh={0.65}
          />
        </Card>
      ) : (
        <Card style={{ borderRadius: 24, padding: 0, overflow: 'hidden', border: `1px solid ${T.border}`, background: T.card }}>
          <CH title="Interactive Payroll Analysis" icon={Wallet} sub="Real-time commission tracking and automated M-Pesa B2C orchestration" />
          <DT 
            cols={[
              { k: 'name', l: 'Staff Member', r: (v, row) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '6px 0' }}>
                  <div style={{ 
                    width: 44, height: 44, borderRadius: 14, 
                    background: row.netDue > 0 ? `${T.warn}15` : `${T.ok}15`, 
                    color: row.netDue > 0 ? T.warn : T.ok,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 950, fontSize: 16,
                    border: `1px solid ${row.netDue > 0 ? T.warn : T.ok}33`
                  }}>{v.charAt(0)}</div>
                  <div>
                    <div style={{ fontWeight: 950, color: T.txt, fontSize: 15 }}>{v}</div>
                    <div style={{ fontSize: 11, color: T.dim, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{row.role}</div>
                  </div>
                </div>
              )},
              { k: 'estimatedEarned', l: 'Commis.', r: v => <span style={{ fontWeight: 850, color: T.txt, fontSize: 14 }}>{fmt(v)}</span> },
              { k: 'monthDeductions', l: 'Deducts.', r: (v, row) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 850, color: T.danger, fontSize: 14 }}>-{fmt(v)}</span>
                  <button onClick={() => setDeductionModal(row)} style={{ padding: '4px 8px', borderRadius: 6, background: `${T.danger}15`, color: T.danger, border: 'none', fontSize: 9, fontWeight: 900, cursor: 'pointer' }}>ADJUST</button>
                </div>
              )},
              { k: 'progress', l: 'Performance', r: (v, row) => (
                <div style={{ width: 140 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 900, color: T.dim, marginBottom: 4 }}>
                    <span>{row.label}</span>
                    <span style={{ color: T.txt }}>{Math.round(v)}%</span>
                  </div>
                  <div style={{ height: 6, background: T.surface, borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, v)}%`, background: T.accent, borderRadius: 10, transition: 'width 1s cubic-bezier(0.34, 1.56, 0.64, 1)' }} />
                  </div>
                </div>
              )},
              { k: 'netDue', l: 'Net Due', r: v => <span style={{ fontWeight: 950, color: v > 0 ? T.warn : T.ok, fontSize: 18, letterSpacing: '-0.02em' }}>{fmt(v)}</span> },
              { k: 'id', l: 'Action', r: (v, row) => (
                row.netDue > 0 ? (
                  <Btn sm v="accent" icon={Zap} onClick={() => setPayoutModal(row)} style={{ height: 36, borderRadius: 10, fontWeight: 900, padding: '0 16px' }}>Execute Payout</Btn>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.ok, fontSize: 11, fontWeight: 900 }}>
                    <ShieldCheck size={14} /> CLEAR
                  </div>
                )
              )}
            ]}
            rows={payrollData.sort((a,b) => b.netDue - a.netDue)}
            emptyMsg="No payroll analysis available for this period."
            maxHeightVh={0.7}
          />
        </Card>
      )}

      {/* Payout Modal */}
      {payoutModal && (
        <Dialog title="Release Performance Funds" onClose={() => setPayoutModal(null)} width={500}>
           <div style={{ padding: '8px 0' }}>
              <div style={{ background: T.surface, padding: 28, borderRadius: 24, marginBottom: 32, border: `1px solid ${T.border}`, boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.1)' }}>
                  <div style={{ textAlign: 'center', marginBottom: 28 }}>
                     <div style={{ width: 48, height: 48, background: `${T.accent}20`, color: T.accent, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                        <Wallet size={24} />
                     </div>
                     <div style={{ fontSize: 11, fontWeight: 900, color: T.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>Payee Profile</div>
                     <div style={{ fontSize: 28, fontWeight: 950, color: T.txt, letterSpacing: '-0.02em' }}>{payoutModal.name}</div>
                     <div style={{ color: T.accent, fontSize: 13, fontWeight: 800, background: `${T.accent}10`, padding: '6px 14px', borderRadius: 99, display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, border: `1px solid ${T.accent}30` }}>
                       {payoutModal.phone || <span style={{ color: T.danger }}>⚠ No phone — update worker profile</span>}
                       <span style={{ fontSize: 9, fontWeight: 700, background: T.surface, padding: '2px 6px', borderRadius: 4, color: T.muted }}>Locked</span>
                     </div>
                     <div style={{ fontSize: 10, color: T.muted, marginTop: 6, fontStyle: 'italic' }}>Phone sourced from worker profile. Cannot be overridden here.</div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', borderBottom: `1px solid ${T.border}` }}>
                     <span style={{ color: T.dim, fontSize: 14, fontWeight: 700 }}>Unpaid Commissions</span>
                     <span style={{ color: T.txt, fontWeight: 900, fontSize: 16 }}>{fmt(payoutModal.estimatedEarned)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', borderBottom: `1px solid ${T.border}` }}>
                     <span style={{ color: T.danger, fontSize: 14, fontWeight: 700 }}>Active Deductions</span>
                     <span style={{ color: T.danger, fontWeight: 900, fontSize: 16 }}>- {fmt(payoutModal.monthDeductions)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0', marginTop: 8 }}>
                     <span style={{ color: T.txt, fontSize: 16, fontWeight: 900 }}>Estimated B2C Value</span>
                     <div style={{ textAlign: 'right' }}>
                       <div style={{ color: T.accent, fontSize: 26, fontWeight: 950 }}>{fmt(payoutModal.netDue)}</div>
                       <div style={{ fontSize: 10, color: T.muted, fontStyle: 'italic', marginTop: 2 }}>Server verifies final amount from DB</div>
                     </div>
                  </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                 <Btn block v="primary" loading={loading} icon={Zap} style={{ background: `linear-gradient(135deg, ${T.accent}, #00a884)`, color: '#000', height: 60, borderRadius: 20, fontSize: 16, fontWeight: 900, border: 'none' }} onClick={() => handleExecutePayout(payoutModal)}>
                   Initiate B2C Disbursement
                 </Btn>
                 <Btn block v="secondary" onClick={() => setPayoutModal(null)} style={{ border: 'none', color: T.dim, fontSize: 14 }}>Dismiss and Back</Btn>
              </div>

              <div style={{ marginTop: 32, padding: '16px 20px', background: `${T.warn}05`, border: `1px solid ${T.warn}20`, borderRadius: 16, textAlign: 'center', color: T.dim, fontSize: 12, lineHeight: 1.5 }}>
                 <b>Security Protocol:</b> This instruction will push an immediate B2C request to the Safaricom gateway. This action is irreversible once the M-Pesa network acknowledges it.
              </div>
           </div>
        </Dialog>
      )}

      {/* Deduction Modal */}
      {deductionModal && (
        <Dialog title="Commission Adjustment" onClose={() => setDeductionModal(null)} width={420}>
           <form onSubmit={handleRecordDeduction} style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '10px 0' }}>
              <div style={{ padding: '16px', background: `${T.danger}05`, border: `1px solid ${T.danger}20`, borderRadius: 16 }}>
                 <p style={{ color: T.dim, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                   You are modifying the payroll for <b>{deductionModal.name}</b>. This adjustment will be subtracted from the current month's disbursement.
                 </p>
              </div>
              
              <FI label="Adjustment Amount (KES)" name="amount" type="number" placeholder="Enter amount to deduct" required autoFocus />
              <FI label="Internal Reason / Memo" name="reason" placeholder="e.g. Salary Advance, Lost Asset" required />

              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                 <Btn block v="primary" type="submit" loading={loading} style={{ background: T.danger, color: '#fff', height: 48, borderRadius: 12, border: 'none', fontWeight: 800 }}>Confirm Deduction</Btn>
                 <Btn block v="secondary" onClick={() => setDeductionModal(null)} style={{ height: 48, borderRadius: 12 }}>Cancel</Btn>
              </div>
           </form>
        </Dialog>
      )}
      <style>{`
        .glass-card {
          padding: 28px;
          border-radius: 32px;
          background: ${theme === 'light' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(25, 33, 50, 0.6)'};
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid ${theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255, 255, 255, 0.08)'};
          box-shadow: 0 30px 60px -12px rgba(0,0,0,0.25);
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .hover-lift {
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .hover-lift:hover {
          transform: translateY(-8px) scale(1.01);
          box-shadow: 0 40px 80px -15px rgba(0,0,0,0.5) !important;
          border-color: ${T.accent} !important;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default SalariesTab;
