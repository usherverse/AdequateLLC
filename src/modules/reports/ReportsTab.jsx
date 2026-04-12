import CustomerProfile from "@/modules/customers/CustomerProfile";
import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { 
  TrendingUp, Calendar, AlertTriangle, CreditCard, XCircle, ClipboardList, 
  Users, UserCog, Lock, BarChart, Download, FileSpreadsheet, FileText, 
  FileCode, Filter, ChevronRight, PieChart, Activity, ShieldCheck, Search as SearchIcon
} from 'lucide-react';
import { T, SC, RC, SFX, Card, CH, KPI, DT, Btn, Badge, Av, Bar, BackBtn, RefreshBtn,
  FI, PhoneInput, NumericInput, Search, Pills, Alert, Dialog, ConfirmDialog, ToastContainer,
  LoanModal, LoanForm, RepayTracker, ModuleHeader,
  fmt, fmtM, now, uid, ts, escHtml, toCSV, dlCSV, buildFullBackup,
  calculateLoanStatus,
  sbWrite, sbInsert,
  toSupabaseLoan, toSupabaseCustomer, toSupabasePayment, toSupabaseInteraction,
  generateLoanAgreementHTML, generateAssetListHTML, downloadLoanDoc,
  getSecConfig,
  useContactPopup, useToast, useReminders, useModalLock,
  dlReportCSV, dlReportPDF, dlReportWord, buildReportData } from '@/lms-common';
import WorkerPanel from '@/modules/workers/WorkerPanel';

const ReportsTab = ({loans,customers,payments,workers,auditLog,showToast=()=>{}, addAudit=()=>{}, preSelected=null}) => {
  const [activeMenu,setActiveMenu]=useState(preSelected);
  const [pickedStart, setPickedStart] = useState(now().slice(0, 7) + '-01'); 
  const [pickedEnd, setPickedEnd] = useState(now());
  const [appliedStart, setAppliedStart] = useState(now().slice(0, 7) + '-01');
  const [appliedEnd, setAppliedEnd] = useState(now());

  const data = {loans, customers, payments, workers, auditLog};
  const { show: toast } = useToast();
  
  const reportGroups = useMemo(() => [
    {
      group: 'Financial Intelligence',
      rows: [
        {id:'loan-portfolio', label:'Global Portfolio', icon:ClipboardList, desc:`Comprehensive snapshot of all lifetime loan disbursements and balances.`, color: T.accent},
        {id:'active-loans', label:'Active Exposure', icon:TrendingUp, desc:`Detailed breakdown of currently active and healthy financial instruments.`, color: T.ok},
        {id:'overdue', label:'Arrears & Default', icon:AlertTriangle, desc:`Risk assessment report of loans past their maturity date or in default.`, color: T.danger},
        {id:'due-today', label:'Repayment Schedule', icon:Calendar, desc:'Forecast of installments and repayments expected in the current period.', color: T.blue},
        {id:'payments-today', label:'Transaction Ledger', icon:CreditCard, desc:`Full audit trail of all manual and M-Pesa repayment entries.`, color: T.ok},
      ]
    },
    {
      group: 'Registry & Workforce',
      rows: [
        {id:'customers', label:'Customer Profiles', icon:Users, desc:`Master list of all registered borrowers with KYC and risk statuses.`, color: T.accent},
        {id:'staff', label:'Worker Performance', icon:UserCog, desc:`Efficiency and collection speed metrics for all administrative officers.`, color: T.blue},
      ]
    },
    {
      group: 'System & Governance',
      rows: [
        {id:'audit', label:'Surveillance Log', icon:Lock, desc:`Security audit trail of all system modifications and access events.`, color: T.muted},
      ]
    }
  ], []);

  const financialStats = useMemo(() => {
    const totalOut = loans.filter(l => l.status !== 'Settled').reduce((s, l) => s + l.balance, 0);
    const healthy = loans.filter(l => l.status === 'Active').length;
    const par = loans.filter(l => l.status === 'Overdue').length;
    return { 
        exposure: totalOut, 
        rate: Math.round((healthy / (healthy + par || 1)) * 100),
        count: healthy + par
    };
  }, [loans]);

  useEffect(() => { setActiveMenu(preSelected); }, [preSelected]);

  const handleExport = (r, format, dlFn) => {
    const rData = buildReportData(r.id, data, { startDate: appliedStart, endDate: appliedEnd });
    dlFn(rData);
    addAudit('Report Exported', r.id, `Format: ${format} | Date Range: ${appliedStart} to ${appliedEnd}`);
    toast(`Successfully exported ${r.label} as ${format}`, 'ok');
  };

  const setRange = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setPickedStart(start.toISOString().split('T')[0]);
    setPickedEnd(end.toISOString().split('T')[0]);
    toast(`Preset: Last ${days} Days`, 'info');
  };

  return (
    <div className='fu'>
        <ModuleHeader 
            title={<><BarChart size={22} style={{marginRight:10, verticalAlign: 'middle', marginTop: -4}}/> Advanced Reports</>}
            sub="Generate high-fidelity financial insights, performance metrics, and regulatory compliance exports."
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            <KPI label="Total Active Assets" value={fmtM(financialStats.exposure)} icon={PieChart} color={T.accent} />
            <KPI label="Portfolio Health" value={financialStats.rate + '%'} sub="Standard Collection Rate" icon={Activity} color={financialStats.rate > 85 ? T.ok : T.warn} />
            <KPI label="Reporting Capacity" value={financialStats.count} sub="Records in Scope" icon={ShieldCheck} />
            <KPI label="System Status" value="Online" sub="Real-time Data Fetch" icon={Activity} color={T.ok} />
        </div>

        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: '20px 24px', marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: T.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.accent }}>
                    <Filter size={20} />
                </div>
                <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.txt }}>Temporal Filter</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <button onClick={() => setRange(7)} style={{ background: 'none', border: 'none', color: T.dim, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>7D</button>
                        <button onClick={() => setRange(30)} style={{ background: 'none', border: 'none', color: T.dim, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>30D</button>
                        <button onClick={() => setRange(90)} style={{ background: 'none', border: 'none', color: T.dim, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>90D</button>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 10, fontWeight: 800, color: T.muted, textTransform: 'uppercase' }}>Period Start</label>
                        <input type='date' value={pickedStart} onChange={e=>setPickedStart(e.target.value)} 
                            style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', color: T.txt, fontSize: 12, fontWeight: 600, outline: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 10, fontWeight: 800, color: T.muted, textTransform: 'uppercase' }}>Period End</label>
                        <input type='date' value={pickedEnd} onChange={e=>setPickedEnd(e.target.value)} 
                            style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', color: T.txt, fontSize: 12, fontWeight: 600, outline: 'none' }} />
                    </div>
                </div>
                <Btn onClick={() => { setAppliedStart(pickedStart); setAppliedEnd(pickedEnd); toast('Range Updated', 'ok'); }} icon={SearchIcon}>Apply Filter</Btn>
            </div>
        </div>

        {reportGroups.map((group, idx) => (
            <div key={idx} style={{ marginBottom: 40 }}>
                <div style={{ fontSize: 11, fontWeight: 850, color: T.dim, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                    {group.group} <div style={{ height: 1, flex: 1, background: T.border }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                    {group.rows.map(r => {
                        const rData = buildReportData(r.id, data, { startDate: appliedStart, endDate: appliedEnd });
                        const Icon = r.icon;
                        return (
                            <Card key={r.id} style={{ padding: 0, overflow: 'hidden', border: activeMenu === r.id ? `1px solid ${T.accent}` : undefined }}>
                                <div style={{ padding: '20px 24px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                        <div style={{ width: 44, height: 44, borderRadius: 14, background: T.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', color: r.color, border: `1px solid ${T.border}` }}>
                                            <Icon size={22} />
                                        </div>
                                        <Badge color={T.surface} style={{ border: `1px solid ${T.border}`, color: T.dim }}>{rData.rows.length} records</Badge>
                                    </div>
                                    <div style={{ color: T.txt, fontWeight: 800, fontSize: 16, marginBottom: 6 }}>{r.label}</div>
                                    <div style={{ color: T.muted, fontSize: 12, lineHeight: 1.5, marginBottom: 20 }}>{r.desc}</div>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                                        <button onClick={() => handleExport(r, 'EXCEL', dlReportCSV)} style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.txt, borderRadius: 10, padding: '10px 4px', fontSize: 10, fontWeight: 800, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                            <FileSpreadsheet size={16} color={T.ok} /> EXCEL
                                        </button>
                                        <button onClick={() => handleExport(r, 'PDF', dlReportPDF)} style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.txt, borderRadius: 10, padding: '10px 4px', fontSize: 10, fontWeight: 800, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                            <FileText size={16} color={T.danger} /> PDF
                                        </button>
                                        <button onClick={() => handleExport(r, 'WORD', dlReportWord)} style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.txt, borderRadius: 10, padding: '10px 4px', fontSize: 10, fontWeight: 800, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                            <FileCode size={16} color={T.blue} /> WORD
                                        </button>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </div>
        ))}
    </div>
  );
};
export default ReportsTab;
