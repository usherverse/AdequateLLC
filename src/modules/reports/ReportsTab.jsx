import CustomerProfile from "@/modules/customers/CustomerProfile";
import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { TrendingUp, Calendar, AlertTriangle, CreditCard, XCircle, ClipboardList, Users, UserCog, Lock, BarChart } from 'lucide-react';
import { T, SC, RC, SFX, Card, CH, KPI, DT, Btn, Badge, Av, Bar, BackBtn, RefreshBtn,
  FI, PhoneInput, NumericInput, Search, Pills, Alert, Dialog, ConfirmDialog, ToastContainer,
  LoanModal, LoanForm, RepayTracker,
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
  const [pickedStart, setPickedStart] = useState(now().slice(0, 7) + '-01'); // Start of current month
  const [pickedEnd, setPickedEnd] = useState(now());
  const [appliedStart, setAppliedStart] = useState(now().slice(0, 7) + '-01');
  const [appliedEnd, setAppliedEnd] = useState(now());

  const data={loans,customers,payments,workers,auditLog};
  
  const reports = useMemo(() => [
    {id:'active-loans', label:'Active Loans', icon:<TrendingUp size={24} />, desc:`${loans.filter(l=>l.status!=='Settled').length} active disbursements`},
    {id:'due-today', label:'Scheduled Repayments', icon:<Calendar size={24} />, desc:'Installments due within the selected period'},
    {id:'overdue', label:'Overdue Report', icon:<AlertTriangle size={24} />, desc:`${loans.filter(l=>l.status==='Overdue').length} past-maturity loans`},
    {id:'payments-today', label:'Repayment Records', icon:<CreditCard size={24} />, desc:`All payment entries within the selected period`},
    {id:'missed-partial', label:'Missed & Partial', icon:<XCircle size={24} />, desc:'Outstanding schedule gaps'},
    {id:'loan-portfolio', label:'Global Portfolio', icon:<ClipboardList size={24} />, desc:`${loans.length} lifetime records`},
    {id:'customers', label:'Customer Registry', icon:<Users size={24} />, desc:`${customers.length} total profiles`},
    {id:'staff', label:'Registry Performance', icon:<UserCog size={24} />, desc:`${workers.length} officers`},
    {id:'audit', label:'System Audit Log', icon:<Lock size={24} />, desc:`${(auditLog||[]).length} activity events`},
  ], [loans, payments, customers, workers, auditLog]);

  useEffect(() => {
    setActiveMenu(preSelected);
  }, [preSelected]);

  const handleExport = (r, format, dlFn) => {
    const rData = buildReportData(r.id, data, { startDate: appliedStart, endDate: appliedEnd });
    dlFn(rData);
    addAudit('Report Downloaded', r.id, `Format: ${format}, Range: ${appliedStart} to ${appliedEnd}`);
    showToast(`✅ ${r.label} ${format} downloaded`, 'ok');
  };

  const applyFilter = () => {
    setAppliedStart(pickedStart);
    setAppliedEnd(pickedEnd);
    
    // Calculate total results for feedback
    let total = 0;
    reports.forEach(r => {
      const rData = buildReportData(r.id, data, { startDate: pickedStart, endDate: pickedEnd });
      total += rData.rows.length;
    });

    showToast(`🔍 Filter Applied: ${total} results found`, 'info', 3000);
    try { SFX.save(); } catch(e) {}
  };

  return (
    <div className='fu'>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:20,flexWrap:'wrap',gap:16}}>
        <div>
          <div style={{fontFamily:T.head,color:T.txt,fontSize:20,fontWeight:800,display:'flex',alignItems:'center',gap:8}}><BarChart size={20}/> Reports & Exports</div>
          <div style={{color:T.muted,fontSize:13,marginTop:2}}>Download high-fidelity reports as PDF, Excel, or Word</div>
        </div>
        
        {/* Date Range Picker */}
        <div style={{display:'flex', gap:10, alignItems:'center', flexWrap:'wrap'}}>
          <div style={{display:'flex', gap:10, alignItems:'center', background:T.card, padding:'10px 14px', borderRadius:12, border:`1px solid ${T.border}`}}>
            <div style={{display:'flex', flexDirection:'column', gap:4}}>
              <label style={{fontSize:10, fontWeight:800, color:T.muted, textTransform:'uppercase'}}>From</label>
              <input type='date' value={pickedStart} onChange={e=>setPickedStart(e.target.value)} 
                style={{background:T.surface, border:`1px solid ${T.hi}`, borderRadius:6, padding:'4px 8px', color:T.txt, fontSize:12, outline:'none'}} />
            </div>
            <div style={{color:T.border, fontSize:20, marginTop:12}}>→</div>
            <div style={{display:'flex', flexDirection:'column', gap:4}}>
              <label style={{fontSize:10, fontWeight:800, color:T.muted, textTransform:'uppercase'}}>To</label>
              <input type='date' value={pickedEnd} onChange={e=>setPickedEnd(e.target.value)} 
                style={{background:T.surface, border:`1px solid ${T.hi}`, borderRadius:6, padding:'4px 8px', color:T.txt, fontSize:12, outline:'none'}} />
            </div>
          </div>
          <Btn onClick={applyFilter} style={{height:46, padding:'0 24px'}}>Search</Btn>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
        {reports.map(r=>{
          const isOpen=activeMenu===r.id;
          const rData=buildReportData(r.id, data, { startDate: appliedStart, endDate: appliedEnd });
          return (
          <Card key={r.id} onClick={()=>setActiveMenu(r.id)} style={{padding:'20px 22px',position:'relative',border:isOpen?`1px solid ${T.accent}`:undefined, transition:'all .2s', cursor:'pointer'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12}}>
              <div style={{fontSize:32,display:'flex'}}>{r.icon}</div>
              <div style={{background:T.surface, border:`1px solid ${T.border}`, borderRadius:6, padding:'2px 8px', fontSize:10, fontFamily:T.mono, color:T.muted}}>{rData.rows.length}</div>
            </div>
            <div style={{color:T.txt,fontWeight:800,fontSize:15,marginBottom:4}}>{r.label}</div>
            <div style={{color:T.muted,fontSize:12,marginBottom:20,lineHeight:1.4,minHeight:34}}>{r.desc}</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
              <button onClick={(e)=>{e.stopPropagation(); handleExport(r, 'EXCEL', dlReportCSV);}}
                className='report-btn'
                style={{background:T.aLo,border:`1px solid ${T.accent}38`,color:T.accent,borderRadius:8,padding:'8px 4px',fontSize:11,fontWeight:800,cursor:'pointer'}}>
                EXCEL
              </button>
              <button onClick={(e)=>{e.stopPropagation(); handleExport(r, 'PDF', dlReportPDF);}}
                className='report-btn'
                style={{background:T.dLo,border:`1px solid ${T.danger}38`,color:T.danger,borderRadius:8,padding:'8px 4px',fontSize:11,fontWeight:800,cursor:'pointer'}}>
                PDF
              </button>
              <button onClick={(e)=>{e.stopPropagation(); handleExport(r, 'WORD', dlReportWord);}}
                className='report-btn'
                style={{background:T.bLo,border:`1px solid ${T.blue}38`,color:T.blue,borderRadius:8,padding:'8px 4px',fontSize:11,fontWeight:800,cursor:'pointer'}}>
                WORD
              </button>
            </div>
          </Card>
        );})}
      </div>
    </div>
  );
};

export default ReportsTab;

