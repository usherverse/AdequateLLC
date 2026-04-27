import React, { useState, useMemo, useEffect } from 'react';
import { 
  IdCard, FileImage, FileText, CheckCircle, AlertTriangle, User, Target, 
  Activity, Lock, Paperclip, ClipboardList, Check, Square, Hourglass,
  Gavel, Landmark, LayoutDashboard, ChevronLeft, Menu, X, Users, MessageSquare,
  ShieldAlert, ShieldOff, TrendingUp, Settings, LogOut, Search, PieChart, Plus, Clock, 
  ChevronRight, ArrowUpRight, ArrowDownRight, CreditCard, Clock as ClockIcon, Calculator, Download
} from 'lucide-react';
import MultiCalculator from '@/modules/tools/MultiCalculator';
import { 
  T, SC, RC, SFX, Card, CH, KPI, DT, Btn, Badge, Av, 
  Dialog, Alert, LoanForm, DocViewer, 
  fmt, fmtM, now, uid, ts, sbWrite, toSupabaseWorker, compressImage, calculateLoanStatus
} from '@/lms-common';
import ALeads from '@/modules/leads/LeadsTab';
import AssetRecoveryDashboard from './AssetRecoveryDashboard';
import CollectionsDashboard from './CollectionsDashboard';
import FinanceDashboard from './FinanceDashboard';

const WorkerPanel = ({
  worker,
  workers,
  setWorkers,
  loans,
  setLoans,
  payments,
  customers,
  leads,
  allWorkers,
  setCustomers,
  onSubmitLoan,
  setLeads,
  interactions,
  setInteractions,
  addAudit,
  showToast = () => {},
  onOpenCustomerProfile: adminOpenProfile,
  repossessedAssets = [],
  setRepossessedAssets,
  targets = [],
  onLogout
}) => {
  const [tab, setTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showLoanApp, setShowLoanApp] = useState(false);
  const [showCalc, setShowCalc]   = useState(false);
  const [viewDoc, setViewDoc] = useState(null);
  const [deductions, setDeductions] = useState([]);
  const [payslips, setPayslips] = useState([]);
  
  // Restriction: Workers can see phone numbers but cannot access full profiles
  const onOpenCustomerProfile = (id) => {
    showToast("Access Denied: Full customer profiles are restricted to Admin level only. You may use the provided phone numbers for direct communication.", "warn");
  };

  useEffect(() => {
    import('@/config/supabaseClient').then(({ supabase }) => {
      if(supabase) {
        supabase.from('worker_deductions').select('*').eq('worker_id', worker.id)
          .then(({ data }) => setDeductions(data || []));
        
        supabase.from('salary_payments').select('*').eq('worker_id', worker.id).order('created_at', { ascending: false })
          .then(({ data }) => setPayslips(data || []));
      }
    });
  }, [worker.id]);


  // ── ROLE CONFIGURATION & THEMING ───────────────────────────────────────────
  const ROLE_CONFIG = useMemo(() => ({
    'Loan Officer': {
      color: T.accent,
      icon: Target,
      tabs: [
        { k: 'overview', l: 'Dashboard', icon: LayoutDashboard },
        { k: 'leads', l: 'Lead Pipeline', icon: Target },
        { k: 'customers', l: 'My Portfolio', icon: Users },
        { k: 'loans', l: 'Active Loans', icon: Activity },
        { k: 'compensation', l: 'Salary & Earnings', icon: CreditCard },
        { k: 'documents', l: 'My Compliance', icon: IdCard },
      ]
    },
    'Collections Officer': {
      color: '#F59E0B',
      icon: ShieldAlert,
      tabs: [
        { k: 'overview', l: 'Performance', icon: LayoutDashboard },
        { k: 'collections', l: 'Collection Hub', icon: ShieldAlert },
        { k: 'customers', l: 'Arrears CRM', icon: AlertTriangle },
        { k: 'compensation', l: 'Salary & Earnings', icon: CreditCard },
        { k: 'documents', l: 'Compliance', icon: IdCard },
      ]
    },
    'Finance': {
      color: '#10B981',
      icon: Landmark,
      tabs: [
        { k: 'overview', l: 'Finance Pulse', icon: LayoutDashboard },
        { k: 'treasury', l: 'Treasury Ops', icon: Landmark },
        { k: 'loans', l: 'Disbursements', icon: Landmark },
        { k: 'documents', l: 'Compliance', icon: IdCard },
      ]
    },
    'Asset Recovery': {
      color: '#EA580C',
      icon: Gavel,
      tabs: [
        { k: 'overview', l: 'Ops Overview', icon: LayoutDashboard },
        { k: 'recovery', l: 'Recovery Rack', icon: Gavel },
        { k: 'customers', l: 'Legal List', icon: Landmark },
        { k: 'documents', l: 'Compliance', icon: IdCard },
      ]
    },
    'default': {
      color: T.accent,
      icon: User,
      tabs: [
        { k: 'overview', l: 'Overview', icon: LayoutDashboard },
        { k: 'documents', l: 'Documents', icon: IdCard },
      ]
    }
  }), []);

  const theme = ROLE_CONFIG[worker.role] || ROLE_CONFIG.default;
  const TABS = theme.tabs;

  // Local copy of this worker's docs
  const [myDocs, setMyDocs] = useState(() => (workers || []).find(w => w.id === worker.id)?.docs || worker.docs || []);
  
  useEffect(() => {
    const fresh = (workers || []).find(w => w.id === worker.id)?.docs || worker.docs || [];
    setMyDocs(fresh);
  }, [worker.id, workers]);
  
  const myL = loans.filter(l => {
    if (worker.role === 'Collections Officer') return l.collectionsOfficer === worker.name;
    return l.officer?.trim().toLowerCase() === worker.name?.trim().toLowerCase() &&
           l.status?.toUpperCase() !== 'APPROVED' && 
           l.status?.toUpperCase() !== 'WRITTEN OFF';
  });
  const myC = customers.filter(c => {
    const matches = worker.role === 'Collections Officer' 
      ? loans.some(l => l.customerId === c.id && l.collectionsOfficer === worker.name)
      : c.officer?.trim().toLowerCase() === worker.name?.trim().toLowerCase();
    return matches && c.status !== 'Rejected';
  });
  const myLeads = (leads || []).filter(l => {
    if (worker.role === 'Collections Officer') return false; // Leads are for Loan Officers
    return l.officer?.trim().toLowerCase() === worker.name?.trim().toLowerCase();
  });
  const ov = myL.filter(l => l.status === 'Overdue');
  const act = myL.filter(l => l.status === 'Active');
  const book = myL.filter(l => l.status !== 'Settled').reduce((s, l) => s + l.balance, 0);
  const pendingMine = myL.filter(l => l.status === 'worker-pending');

  const curMonth = new Date().toISOString().slice(0, 7);
  const curMonthOnboarded = myC.filter(c => (c.createdAt||c.joined)?.startsWith(curMonth)).length;
  const activeTarget = (targets || []).find(t => t.month === curMonth);
  const activeOfficersTotal = (allWorkers || workers || []).filter(w => w.role === 'Loan Officer' && w.status === 'Active').length || 1;
  const myTarget = activeTarget ? (activeTarget.total_target_amount / activeOfficersTotal) : 0;
  const myDisbursed = myL.filter(l => l.disbursed?.startsWith(curMonth)).reduce((s,l) => s + Number(l.amount), 0);
  const myTgtPct = myTarget > 0 ? Math.min(Math.round((myDisbursed / myTarget) * 100), 100) : 0;

  const currentMonth = now().slice(0, 7);
  const myMonthlyPayments = payments.filter(p => {
    if (!p.date?.startsWith(currentMonth)) return false;
    // Loan Officers see payments from loans they onboarded
    if (worker.role === 'Loan Officer') return p.officer === worker.name || myL.some(l => l.id === p.loanId);
    // Collections Officers ONLY see payments from loans allocated to them by Admin
    if (worker.role === 'Collections Officer') {
      const loan = loans.find(l => l.id === p.loanId);
      return loan?.collectionsOfficer === worker.name;
    }
    return false;
  });
  const myMonthlyCollected = myMonthlyPayments.reduce((s, p) => s + Number(p.amount), 0);
  
  const myDeductions = deductions.filter(d => d.month === currentMonth);
  const totalDeductions = myDeductions.reduce((s, d) => s + d.amount, 0);

  // Commission Logic
  let commission = 0;
  let performanceRate = 0;
  let performanceLabel = "";

  if (worker.role === 'Loan Officer') {
    performanceRate = (curMonthOnboarded / (worker.onboardingTarget || 60));
    performanceLabel = "Growth Performance";
    // KES 333.33 per verified customer
    commission = Math.round(curMonthOnboarded * 333.33); 
  } else if (worker.role === 'Collections Officer') {
    // Dynamic Target: What is actually collectible this month (Collected + Current Overdue in portfolio)
    const myLoans = loans.filter(l => (l.collectionsOfficer || '').toLowerCase() === worker.name.toLowerCase());
    const remaining = myLoans.reduce((total, l) => {
      const paid = payments.filter(p => p.loanId === l.id && p.status === 'Allocated').reduce((s, p) => s + p.amount, 0);
      const e = calculateLoanStatus(l, null, paid);
      return total + (e.totalAmountDue > 0 ? e.totalAmountDue : 0);
    }, 0);
    
    const totalCollectible = myMonthlyCollected + remaining;
    performanceRate = totalCollectible > 0 ? (myMonthlyCollected / totalCollectible) : 0;
    performanceLabel = "Collection Efficiency";
    
    // Tiered Logic: 90% -> 10k, 94% -> 15k, 100% -> 20k
    const pct = performanceRate * 100;
    if (pct >= 100)      commission = 20000;
    else if (pct >= 94) commission = 15000;
    else if (pct >= 90) commission = 10000;
    else {
      // Linear scaling below 90%? User said 10k for 90%, we'll provide fractional.
      commission = Math.round((pct / 90) * 10000);
    }
  }

  const cumulativeEarnings = commission - totalDeductions;

  const printPayslip = () => {
    const today = now();
    const fmtKey = (v) => "KES " + Number(v || 0).toLocaleString("en-KE");
    
    const performanceDetail = worker.role === 'Collections Officer' 
      ? `Collection Efficiency (${(performanceRate * 100).toFixed(0)}%)`
      : `Onboarding Commission (${curMonthOnboarded} onboardings)`;

    const html = `
      <!DOCTYPE html><html><head><meta charset=UTF-8><style>
        body { font-family: 'Inter', 'Segoe UI', sans-serif; padding: 25mm; color: #1e293b; background: #fff; line-height: 1.5; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid ${theme.color}; padding-bottom: 25px; margin-bottom: 35px; }
        .logo { font-size: 26px; font-weight: 900; color: ${theme.color}; }
        .table { width: 100%; border-collapse: collapse; margin: 30px 0; }
        .table th { text-align: left; background: #f8fafc; padding: 14px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; }
        .table td { padding: 14px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
        .total-row { background: #f8fafc; font-weight: 900; }
      </style></head><body>
        <div class="header"><div><div class="logo">Adequate Capital Ltd</div><div style="font-size: 11px; font-weight: 700; color: #64748b;">PAYROLL EARNINGS STATEMENT</div></div><div style="text-align: right;"><b>OFFICIAL PAYSLIP</b><br>${currentMonth}</div></div>
        <div style="margin-bottom: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;"><div><div style="font-size: 10px; color: #94a3b8; font-weight: 800;">EMPLOYEE</div><div style="font-size: 15px; font-weight: 800;">${worker.name}</div><div style="font-size: 12px; color: #64748b;">Role: ${worker.role}</div></div><div><div style="font-size: 10px; color: #94a3b8; font-weight: 800;">STATEMENT REFERENCE</div><div style="font-size: 14px; font-weight: 700; color: #64748b;">ESTIMATED_DRAFT_${today.split('T')[0]}</div></div></div>
        <table class="table">
          <thead><tr><th>Description</th><th style="text-align: right;">Amount</th></tr></thead>
          <tbody>
            <tr><td style="font-weight: 700;">${performanceDetail}</td><td style="text-align: right; font-weight: 700;">+ ${fmtKey(commission)}</td></tr>
            ${myDeductions.map(d => `<tr><td style="color: #ef4444;">Deduction: ${d.reason}</td><td style="text-align: right; color: #ef4444;">- ${fmtKey(d.amount)}</td></tr>`).join('')}
          </tbody>
          <tfoot><tr class="total-row"><td>NET ESTIMATED PAYABLE</td><td style="text-align: right; font-size: 18px; color: ${theme.color};">${fmtKey(cumulativeEarnings)}</td></tr></tfoot>
        </table>
        <div style="margin-top: 50px; padding: 20px; background: #f1f5f9; border-radius: 12px; font-size: 12px; text-align: center;">This is an estimated payslip based on current month performance. Final B2C disbursements are executed on month-end.</div>
      </body></html>
    `;
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  const WORKER_SELF_DOC_SLOTS = [
    { key: 'id_front', label: 'National ID — Front', icon: <IdCard size={16} />, required: true, accept: 'image/*', capture: 'environment' },
    { key: 'id_back', label: 'National ID — Back', icon: <IdCard size={16} />, required: true, accept: 'image/*', capture: 'environment' },
    { key: 'passport', label: 'Passport Photo', icon: <FileImage size={16} />, required: true, accept: 'image/*', capture: 'user' },
    { key: 'extra_1', label: 'Additional Document', icon: <FileText size={16} />, required: false, accept: 'image/*,application/pdf', capture: undefined },
    { key: 'extra_2', label: 'Additional Document 2', icon: <FileText size={16} />, required: false, accept: 'image/*,application/pdf', capture: undefined },
  ];

  const handleDocAdd = (doc) => {
    const next = [...myDocs.filter(d => d.key !== doc.key), doc];
    setMyDocs(next);
    if (setWorkers) setWorkers(ws => ws.map(w => w.id === worker.id ? { ...w, docs: next } : w));
    
    // PERSISTENCE FIX: Save to Supabase
    const upd = { ...worker, docs: next };
    sbWrite('workers', toSupabaseWorker(upd)).catch(console.error);

    addAudit('Worker Doc Uploaded', worker.id, doc.name);
    showToast(`✅ ${doc.name} uploaded`, 'ok');
  };

  const handleDocRemove = (docId) => {
    const next = myDocs.filter(d => d.id !== docId);
    setMyDocs(next);
    if (setWorkers) setWorkers(ws => ws.map(w => w.id === worker.id ? { ...w, docs: next } : w));
    
    // PERSISTENCE FIX: Save to Supabase
    const upd = { ...worker, docs: next };
    sbWrite('workers', toSupabaseWorker(upd)).catch(console.error);

    showToast('Document removed', 'info');
  };

  const requiredCount = WORKER_SELF_DOC_SLOTS.filter(s => s.required).length;
  const requiredDone = WORKER_SELF_DOC_SLOTS.filter(s => s.required && myDocs.some(d => d.key === s.key)).length;
  const docsComplete = requiredDone >= requiredCount;

  const switchTab = (k) => { 
    setTab(k); 
    addAudit('Worker View', k, `${worker.name} viewed ${k}`); 
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const isMobile = window.innerWidth < 1024;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: T.bg, color: T.txt, overflow: 'hidden' }}>
      
      {/* ── SIDEBAR ────────────────────────────────────────────────────────── */}
      <aside style={{
        width: sidebarOpen ? 280 : 0,
        height: '100vh',
        background: T.card,
        borderRight: `1px solid ${T.border}`,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: isMobile ? 'fixed' : 'relative',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: sidebarOpen && isMobile ? '20px 0 50px rgba(0,0,0,0.5)' : 'none'
      }}>
        {/* Sidebar Branding */}
        <div style={{ padding: '32px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: theme.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
            {React.createElement(theme.icon, { size: 24 })}
          </div>
          <div style={{ opacity: sidebarOpen ? 1 : 0, transition: '0.2s' }}>
            <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: -0.5 }}>ADEQUATE</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: theme.color, textTransform: 'uppercase', letterSpacing: 1.5 }}>{worker.role}</div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {TABS.map(t => (
            <button
              key={t.k}
              onClick={() => switchTab(t.k)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12,
                border: 'none', cursor: 'pointer', textAlign: 'left',
                background: tab === t.k ? `${theme.color}15` : 'transparent',
                color: tab === t.k ? theme.color : T.muted,
                transition: '0.2s',
                fontWeight: tab === t.k ? 800 : 600,
                fontSize: 14,
              }}
            >
              {React.createElement(t.icon, { size: 18, color: tab === t.k ? theme.color : 'currentColor' })}
              <span style={{ opacity: sidebarOpen ? 1 : 0 }}>{t.l}</span>
              {t.k === 'documents' && !docsComplete && <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.danger }} />}
            </button>
          ))}
        </nav>

        {/* Sidebar Footer / User Profile */}
        <div style={{ padding: 20, borderTop: `1px solid ${T.border}`, background: `${T.card}80` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Av ini={worker.avatar || worker.name[0]} size={40} color={theme.color} />
            <div style={{ minWidth: 0, opacity: sidebarOpen ? 1 : 0 }}>
              <div style={{ fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{worker.name}</div>
              <div style={{ fontSize: 11, color: T.muted }}>System Active</div>
            </div>
          </div>
          <button 
            onClick={onLogout}
            style={{ 
              marginTop: 20, width: '100%', padding: '10px', borderRadius: 10, 
              background: 'transparent', border: `1px solid ${T.border}`, color: T.muted,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontSize: 12, fontWeight: 700, cursor: 'pointer'
            }}
          >
            <LogOut size={14} /> Log Out
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main style={{ flex: 1, height: '100vh', overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        
        {/* Top Floating Bar */}
        <header style={{ 
          height: 70, display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
          padding: '0 24px', position: 'sticky', top: 0, zIndex: 900, 
          background: `${T.bg}D0`, backdropFilter: 'blur(10px)', borderBottom: `1px solid ${T.border}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
             <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: T.card, border: `1px solid ${T.border}`, color: T.txt, padding: 8, borderRadius: 10, cursor: 'pointer' }}>
                {sidebarOpen ? <ChevronLeft size={20}/> : <Menu size={20}/>}
             </button>
             <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>{TABS.find(t => t.k === tab)?.l}</h2>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button 
              onClick={() => setShowCalc(true)} 
              aria-label="Calculator" 
              style={{
                background: T.card, border: `1px solid ${T.border}`, color: T.txt, 
                padding: 10, borderRadius: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <Calculator size={18}/>
            </button>
            {worker.role === 'Loan Officer' && (
              <Btn onClick={() => {
                if (!docsComplete) { showToast('⚠ Upload ID documents first', 'warn'); setTab('documents'); return; }
                setShowLoanApp(true);
              }} v="primary" style={{ height: 40, padding: '0 16px', borderRadius: 12, background: theme.color, color: '#000' }}>
                <Plus size={18} /> New Application
              </Btn>
            )}
          </div>
        </header>

        {/* Scrollable Area */}
        <div style={{ padding: '24px clamp(12px, 4vw, 40px)', flex: 1 }}>
          
          {/* Critical Warnings */}
          {!docsComplete && (
            <div className="pop-in" style={{ 
              background: `linear-gradient(to right, ${T.danger}15, transparent)`, 
              borderLeft: `4px solid ${T.danger}`, borderRadius: '4px 16px 16px 4px', 
              padding: '16px 20px', marginBottom: 24, display: 'flex', 
              alignItems: 'center', gap: 16
            }}>
              <AlertTriangle color={T.danger} size={24} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 15 }}>Identity Check Required</div>
                <div style={{ color: T.muted, fontSize: 13 }}>Standard operational limits applied. Upload IDs to resolve.</div>
              </div>
              <Btn sm v="danger" onClick={() => setTab('documents')}>Fix Now</Btn>
            </div>
          )}

          {/* Tab Content Rendering */}
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            
            {tab === 'overview' && (
              <div className="fu flex-col gap-8">
                {/* ── WORKER HERO SECTION ── */}
                <div style={{
                  background: `linear-gradient(135deg, ${theme.color}20 0%, ${T.card} 100%)`, 
                  borderRadius: 24, padding: 32, border: `1px solid ${T.border}`,
                  position: 'relative', overflow: 'hidden', marginBottom: 24,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  flexWrap: 'wrap', gap: 24
                }}>
                   {/* Background Decorative Element */}
                   <div style={{ position: 'absolute', top:-40, right:-40, width:200, height:200, borderRadius:'50%', background: `${theme.color}10`, filter:'blur(40px)' }}/>
                   
                   <div style={{ display:'flex', alignItems:'center', gap: 24, zIndex:1 }}>
                      <Av name={worker.name} size={72} bg={theme.color} color="#000" />
                      <div>
                         <div style={{ color: T.muted, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Field Intelligence Profile</div>
                         <div style={{ fontSize: 32, fontWeight: 900, color: T.txt, marginTop: 4 }}>{worker.name}</div>
                         <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <Badge color={theme.color} style={{fontWeight: 800, color:'#000'}}>{worker.role.toUpperCase()}</Badge>
                            <Badge color={T.accent} style={{fontWeight: 800}}>ACTIVE MISSION</Badge>
                         </div>
                      </div>
                   </div>

                   <div style={{ textAlign: isMobile ? 'left' : 'right', zIndex: 1 }}>
                      <div style={{ color: T.muted, fontSize: 12, fontWeight: 800 }}>MEMBER SINCE</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: T.txt, marginTop:4 }}>{ts(worker.joined || worker.createdAt).slice(0, 11)}</div>
                      <div style={{ marginTop: 16 }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: performanceRate >= 1 ? '#10B981' : T.accent, fontWeight: 900 }}>
                            <Target size={18} />
                            <span>{performanceRate >= 1 ? 'PREMIUM TIER' : 'GROWTH TIER'}</span>
                         </div>
                      </div>
                   </div>
                </div>

                {/* ── EARNINGS & PRIMARY KPIS ── */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr 1fr', gap: 24, marginBottom: 24 }}>
                   <div style={{
                     background: '#111827', borderRadius: 24, padding: 32, 
                     border: '1px solid #374151', color: '#fff',
                     display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                   }}>
                      <div>
                         <div style={{ color: '#9CA3AF', fontSize: 13, fontWeight: 800, textTransform: 'uppercase' }}>Available Commissions</div>
                         <div style={{ fontSize: 42, fontWeight: 900, color: '#10B981', marginTop: 10 }}>{fmt(cumulativeEarnings)}</div>
                         <div style={{ fontSize: 14, color: '#6B7280', marginTop: 8 }}>Estimated payout for {currentMonth}</div>
                      </div>
                      <div style={{ background: '#05966920', padding: 16, borderRadius: '50%', color: '#10B981' }}>
                         <CreditCard size={32} />
                      </div>
                   </div>

                   <KPI label="Portfolio Book" value={fmtM(book)} icon={TrendingUp} color={theme.color} />
                   <KPI label="Risk Exposure" value={ov.length} icon={AlertTriangle} color={T.danger} sub={`${ov.length} Active Arrears`} />
                </div>

                {/* ── PERFORMANCE BREAKDOWN ── */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 24 }}>
                   <Card style={{ padding: 24, background: T.card }}>
                      <CH title={`${performanceLabel} Breakdown`} icon={Target} sub="Progress towards contractual incentive bonus" />
                      <div style={{ marginTop: 24 }}>
                         <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'flex-end' }}>
                            <div>
                               <div style={{ fontSize: 32, fontWeight: 900 }}>{worker.role === 'Collections Officer' ? fmt(myMonthlyCollected) : curMonthOnboarded}</div>
                               <div style={{ fontSize: 13, color: T.muted }}>{worker.role === 'Collections Officer' ? 'Collected this Month' : 'Verified Onboardings'}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                               <div style={{ fontSize: 16, fontWeight: 800, color: theme.color }}>{Math.round(performanceRate * 100)}%</div>
                               <div style={{ fontSize: 13, color: T.muted }}>Target: {worker.role === 'Collections Officer' ? fmt(worker.collectionTarget || 500000) : (worker.onboardingTarget || 60)}</div>
                            </div>
                         </div>
                         <div style={{ height: 12, background: T.border, borderRadius: 6, overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: `linear-gradient(to right, ${theme.color}, #10B981)`, width: `${Math.min(performanceRate * 100, 100)}%`, transition: 'width 1s ease-out' }} />
                         </div>
                         <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
                            <Badge color={performanceRate >= 1 ? '#10B98120' : '#F59E0B20'} style={{ color: performanceRate >= 1 ? '#10B981' : '#F59E0B' }}>
                               {performanceRate >= 1 ? 'Mission Target Achieved' : `${performanceLabel} Focus Required`}
                            </Badge>
                         </div>
                      </div>
                   </Card>

                   <Card style={{ padding: 24 }}>
                      <CH title="Assignment Insights" icon={Activity} sub="Summary of active portfolio vitals" />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
                         <div style={{ borderLeft: `3px solid ${theme.color}`, paddingLeft: 16 }}>
                            <div style={{ color: T.muted, fontSize: 12, fontWeight: 800 }}>ACTIVE LOANS</div>
                            <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{act.length}</div>
                         </div>
                         <div style={{ borderLeft: `3px solid #10B981`, paddingLeft: 16 }}>
                            <div style={{ color: T.muted, fontSize: 12, fontWeight: 800 }}>TOTAL CAPACITY</div>
                            <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{myC.length}</div>
                         </div>
                         <div style={{ borderLeft: `3px solid ${T.accent}`, paddingLeft: 16 }}>
                            <div style={{ color: T.muted, fontSize: 12, fontWeight: 800 }}>PENDING TASKS</div>
                            <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{pendingMine.length}</div>
                         </div>
                         <div style={{ borderLeft: `3px solid ${T.danger}`, paddingLeft: 16 }}>
                            <div style={{ color: T.muted, fontSize: 12, fontWeight: 800 }}>RISK RATIO</div>
                            <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{Math.round((ov.length / (myL.length || 1)) * 100)}%</div>
                         </div>
                      </div>
                   </Card>
                </div>
              </div>
            )}

            {tab === 'recovery' && <AssetRecoveryDashboard worker={worker} loans={loans} customers={customers} payments={payments} interactions={interactions} setInteractions={setInteractions} setLoans={setLoans} setCustomers={setCustomers} repossessedAssets={repossessedAssets} setRepossessedAssets={setRepossessedAssets} addAudit={addAudit} showToast={showToast} onOpenCustomerProfile={onOpenCustomerProfile} />}

            {tab === 'collections' && <CollectionsDashboard worker={worker} loans={loans} customers={customers} payments={payments} interactions={interactions} setInteractions={setInteractions} addAudit={addAudit} showToast={showToast} onOpenCustomerProfile={onOpenCustomerProfile} />}

            {tab === 'treasury' && <FinanceDashboard worker={worker} loans={loans} customers={customers} payments={payments} addAudit={addAudit} showToast={showToast} onOpenCustomerProfile={onOpenCustomerProfile} />}

            {tab === 'compensation' && (
              <div className="fu">
                <Card style={{marginBottom: 20, borderLeft: `5px solid #10B981`}}>
                   <CH title="Current Earning Analysis" icon={CreditCard} right={<Btn sm v="secondary" onClick={printPayslip} icon={FileText}>Print Payslip</Btn>}/>
                   <div style={{padding: 24}}>
                      <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.5fr', gap: 30}}>
                         <div>
                            <div style={{color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', marginBottom: 12}}>{performanceLabel} Progress</div>
                            <div style={{display:'flex', gap:10, alignItems:'baseline', marginBottom:20}}>
                               <div style={{fontSize:42, fontWeight:900, color:T.txt}}>{(performanceRate * 100).toFixed(0)}%</div>
                               <div style={{color:T.dim, fontSize:14}}>/ {worker.role === 'Collections Officer' ? 'Portfolio Target' : `${worker.onboardingTarget || 60} Clients`}</div>
                            </div>
                            <div style={{height:10, background:T.border, borderRadius:5, marginBottom:10, overflow:'hidden'}}>
                               <div style={{height:'100%', background: performanceRate >= 1 ? '#10B981' : T.accent, width: `${Math.min(performanceRate * 100, 100)}%`}} />
                            </div>
                            <div style={{display:'flex', justifyContent:'space-between', color:T.dim, fontSize:12, fontWeight:700}}>
                               <span>{worker.role === 'Collections Officer' ? fmt(myMonthlyCollected) : `${curMonthOnboarded} Onboarded`}</span>
                               <span>{worker.role === 'Collections Officer' ? 'Portfolio Ratio' : `Target: ${worker.onboardingTarget || 60}`}</span>
                            </div>
                         </div>

                         <div>
                            <div style={{color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', marginBottom: 12}}>Monthly Calculator</div>
                            <div style={{display:'flex', flexDirection:'column', gap: 12}}>

                               <div style={{display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:`1px solid ${T.border}`}}>
                                  <span style={{color: T.dim}}>{performanceLabel} ({worker.role === 'Collections Officer' ? fmt(myMonthlyCollected) : `${curMonthOnboarded} clients`}):</span>
                                  <span style={{fontWeight: 700, color: '#10B981'}}>+{fmt(commission)}</span>
                               </div>
                               <div style={{display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:`1px solid ${T.border}`}}>
                                  <span style={{color: T.dim}}>Total Deductions:</span>
                                  <span style={{fontWeight: 700, color: T.danger}}>-{fmt(totalDeductions)}</span>
                               </div>
                               <div style={{display:'flex', justifyContent:'space-between', padding:'14px 0', marginTop:6, borderTop:`2px solid ${T.border}`, fontSize:18, fontWeight:900}}>
                                  <span>NET PAYABLE:</span>
                                  <span style={{color: '#10B981'}}>{fmt(cumulativeEarnings)}</span>
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>
                </Card>

                <Card>
                   <CH title="Deduction Particulars" icon={ShieldOff} sub="List of all adjustments applied by administrative team"/>
                   <div style={{padding: '0 4px 10px'}}>
                      <DT 
                        cols={[
                          {k:'month', l:'Month'},
                          {k:'reason', l:'Particulars'},
                          {k:'amount', l:'Deduction', r:v => <span style={{color:T.danger}}>-{fmt(v)}</span>},
                          {k:'created_at', l:'Admin Entry', r:v => ts(v)}
                        ]}
                        rows={myDeductions}
                        emptyMsg="No adjustments recorded for this period."
                      />
                   </div>
                </Card>

                <Card style={{marginTop: 20}}>
                   <CH title="M-Pesa B2C Payment History" icon={Landmark}/>
                   <div style={{padding: '0 4px 10px'}}>
                      <DT 
                        cols={[
                          {k:'month', l:'Period'},
                          {k:'amount', l:'Amount Paid', r: v => <strong>{fmt(v)}</strong>},
                          {k:'mpesa_receipt', l:'Receipt ID', r: v => <code style={{color:T.accent}}>{v}</code>},
                          {k:'status', l:'Status', r: v => <Badge color={T.ok}>{v}</Badge>},
                          {k:'id', l:'Receipt', r: (v, row) => <Btn sm v="secondary" icon={Download} onClick={() => {
                            const wDeds = deductions.filter(d => d.month === row.month);
                            const totalDeds = wDeds.reduce((s, d) => s + Number(d.amount), 0);
                            const fmtKey = (v) => "KES " + Number(v || 0).toLocaleString("en-KE");
                            const html = `
                              <!DOCTYPE html><html><head><meta charset=UTF-8><style>
                                body { font-family: 'Inter', sans-serif; padding: 25mm; color: #1e293b; background: #fff; line-height: 1.5; }
                                .header { display: flex; justify-content: space-between; border-bottom: 2px solid #00D4AA; padding-bottom: 25px; margin-bottom: 30px; }
                                .logo { font-size: 26px; font-weight: 900; color: #00D4AA; }
                                .table { width: 100%; border-collapse: collapse; margin: 30px 0; }
                                .table th { text-align: left; background: #f8fafc; padding: 14px; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; }
                                .table td { padding: 14px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
                                .total-row { background: #f8fafc; font-weight: 900; }
                              </style></head><body>
                                <div class="header"><div><div class="logo">Adequate Capital Ltd</div><div style="font-size: 11px; font-weight: 700; color: #64748b;">PAYMENT RECEIPT</div></div><div style="text-align: right;"><b>Receipt #: ${row.mpesa_receipt || row.id}</b><br>${row.month}</div></div>
                                <table class="table">
                                  <thead><tr><th>Description</th><th style="text-align: right;">Amount</th></tr></thead>
                                  <tbody>
                                    <tr><td style="font-weight: 700;">Base Salary + Commissions</td><td style="text-align: right; font-weight: 700;">${fmtKey(row.amount + totalDeds)}</td></tr>
                                    ${wDeds.map(d => `<tr><td style="color: #ef4444;">Reduction: ${d.reason}</td><td style="text-align: right; color: #ef4444;">- ${fmtKey(d.amount)}</td></tr>`).join('')}
                                  </tbody>
                                  <tfoot><tr class="total-row"><td>TOTAL DISBURSED (M-PESA)</td><td style="text-align: right; font-size: 18px; color: #00D4AA;">${fmtKey(row.amount)}</td></tr></tfoot>
                                </table>
                                <div style="margin-top: 40px; font-size: 11px; color: #94a3b8; text-align: center;">This is an official record of funds disbursed via M-Pesa with receipt ID ${row.mpesa_receipt}.</div>
                              </body></html>
                            `;
                            const blob = new Blob([html], { type: 'text/html' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `Receipt_${row.month}_${row.mpesa_receipt || row.id}.html`;
                            a.click();
                          }}>Download</Btn>}
                        ]}
                        rows={payslips}
                        emptyMsg="No historical payments found."
                      />
                   </div>
                </Card>
              </div>
            )}

            {tab === 'loans' && (
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                <CH title='Active Portfolio' sub="Detailed view of all loans under your assignment" />
                <DT 
                  cols={[
                    { k: 'id', l: 'ID', r: v => <span style={{ color: theme.color, fontFamily: T.mono, fontSize: 12, fontWeight: 700 }}>{v}</span> }, 
                    { k: 'customer', l: 'Customer' }, 
                    { k: 'amount', l: 'Principal', r: v => fmt(v) }, 
                    { k: 'balance', l: 'Balance', r: v => <span style={{ fontWeight: 800 }}>{fmt(v)}</span> }, 
                    { k: 'status', l: 'Status', r: v => <Badge color={SC[v] || T.muted}>{v}</Badge> }
                  ]} 
                  rows={myL} 
                />
              </Card>
            )}

            {tab === 'customers' && (
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                <CH title='Customer Registry' icon={Users} />
                <DT 
                  cols={[
                    { k: 'id', l: 'ID', r: v => <span style={{ color: theme.color, fontFamily: T.mono, fontSize: 12, fontWeight: 700 }}>{v}</span> }, 
                    { k: 'name', l: 'Name', r: v => <span style={{ fontWeight: 700 }}>{v}</span> }, 
                    { k: 'phone', l: 'Phone' }, 
                    { k: 'business', l: 'Business' }, 
                    { k: 'risk', l: 'Risk', r: v => <Badge color={RC[v]}>{v}</Badge> }
                  ]} 
                  rows={worker.role === 'Collections Officer' ? myC.filter(c => c.risk === 'High' || c.risk === 'Medium') : myC} 
                />
              </Card>
            )}

            {tab === 'leads' && (
              <ALeads 
                leads={myLeads} 
                setLeads={setLeads} 
                workers={allWorkers} 
                customers={customers} 
                setCustomers={setCustomers} 
                loans={loans} 
                addAudit={addAudit} 
                isWorker={true} 
                currentWorker={worker} 
                showToast={showToast}/>
            )}

            {tab === 'documents' && (
              <div className='fu'>
                {viewDoc && <DocViewer doc={viewDoc} onClose={() => setViewDoc(null)} />}
                <Card style={{ padding: 0, overflow: 'hidden' }}>
                  <CH title="Compliance & Verification" sub="Identity artifacts and operational permits" icon={CheckCircle} />
                  
                  <div style={{ padding: '32px' }}>
                    {/* Identity Progress Bar */}
                    <div style={{ marginBottom: 32 }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
                          <div>
                             <div style={{ fontSize: 12, color: T.muted, fontWeight: 800, textTransform: 'uppercase' }}>Verification Status</div>
                             <div style={{ fontSize: 24, fontWeight: 900, color: docsComplete ? T.ok : T.warn, marginTop: 4 }}>{docsComplete ? 'FULLY VERIFIED' : 'PENDING ACTION'}</div>
                          </div>
                          <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 900 }}>{requiredDone}/{requiredCount} <span style={{ color: T.muted, fontSize: 12 }}>RECORDS</span></div>
                       </div>
                       <div style={{ height: 10, background: T.border, borderRadius: 5, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(requiredDone / requiredCount) * 100}%`, background: docsComplete ? T.ok : theme.color, transition: '1s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                       </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                      {WORKER_SELF_DOC_SLOTS.map((slot) => {
                        const doc = myDocs.find(d => d.key === slot.key);
                        return (
                          <div key={slot.key} style={{ 
                            background: T.card, border: `1px solid ${doc ? T.ok + '20' : T.border}`, 
                            borderRadius: 18, padding: '20px', display: 'flex', 
                            flexDirection: 'column', gap: 16, position: 'relative',
                            transition: 'all 0.3s'
                          }}>
                            {doc && <div style={{ position: 'absolute', top: 12, right: 12, color: T.ok }}><CheckCircle size={20}/></div>}
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                               <div style={{ width: 44, height: 44, borderRadius: 12, background: doc ? `${T.ok}15` : T.surface, color: doc ? T.ok : T.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {React.cloneElement(slot.icon, { size: 22 })}
                               </div>
                               <div>
                                  <div style={{ fontWeight: 800, fontSize: 14 }}>{slot.label}</div>
                                  <div style={{ fontSize: 11, color: T.muted }}>{doc ? `Uploaded ${doc.uploaded}` : slot.required ? 'Required' : 'Optional'}</div>
                               </div>
                            </div>

                            {doc ? (
                               <div style={{ display: 'flex', gap: 8 }}>
                                  <Btn full sm v="secondary" onClick={() => setViewDoc(doc)}>View Document</Btn>
                                  <button onClick={() => handleDocRemove(doc.id)} style={{ background: 'transparent', border: 'none', color: T.danger, padding: '0 8px', cursor: 'pointer' }}><X size={16}/></button>
                               </div>
                            ) : (
                               <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 40, border: `1px solid ${theme.color}`, borderRadius: 10, color: theme.color, fontSize: 12, fontWeight: 800, cursor: 'pointer', transition: '0.2s' }}>
                                  <Paperclip size={14} /> Attach File
                                  <input type='file' accept='image/*' style={{display:'none'}} id={`upload-${slot.key}`} onChange={async e => {
                                    const file = e.target.files?.[0]; if (!file) return;
                                    const compressed = await compressImage(file);
                                    const reader = new FileReader();
                                    reader.onload = ev => handleDocAdd({ id: uid('DOC'), key: slot.key, name: slot.label, type: compressed.type, size: compressed.size, dataUrl: ev.target.result, uploaded: now() });
                                    reader.readAsDataURL(compressed);
                                  }} />
                               </label>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── MODALS & OVERLAYS ── */}
      {showLoanApp && (
        <Dialog title="New Loan Application" onClose={() => setShowLoanApp(false)} width={580}>
          <LoanForm
            customers={customers.filter(c => c.officer === worker.name)}
            payments={payments} loans={loans} workerMode={true} workerName={worker.name}
            onSave={l => { onSubmitLoan(l); setShowLoanApp(false); }}
            onClose={() => setShowLoanApp(false)}
          />
        </Dialog>
      )}

      {showCalc && <MultiCalculator onClose={() => setShowCalc(false)} />}

      {/* Mobile Drawer Backdrop */}
      {isMobile && sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 999 }} 
        />
      )}
    </div>
  );
};

export default WorkerPanel;
