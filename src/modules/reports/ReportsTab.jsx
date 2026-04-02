import CustomerProfile from "@/modules/customers/CustomerProfile";
import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
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
  const [startDate, setStartDate] = useState(now().slice(0, 7) + '-01'); // Start of current month
  const [endDate, setEndDate] = useState(now());
  const data={loans,customers,payments,workers,auditLog};
  
  const reports = useMemo(() => [
    {id:'active-loans', label:'Active Loans', icon:'📈', desc:`${loans.filter(l=>l.status!=='Settled').length} active disbursements`},
    {id:'due-today', label:'Scheduled Repayments', icon:'📅', desc:'Installments due within the selected period'},
    {id:'overdue', label:'Overdue Report', icon:'⚠️', desc:`${loans.filter(l=>l.status==='Overdue').length} past-maturity loans`},
    {id:'payments-today', label:'Repayment Records', icon:'💳', desc:`All payment entries within the selected period`},
    {id:'missed-partial', label:'Missed & Partial', icon:'❌', desc:'Outstanding schedule gaps'},
    {id:'loan-portfolio', label:'Global Portfolio', icon:'📋', desc:`${loans.length} lifetime records`},
    {id:'customers', label:'Customer Registry', icon:'👥', desc:`${customers.length} total profiles`},
    {id:'staff', label:'Registry Performance', icon:'👷', desc:`${workers.length} officers`},
    {id:'audit', label:'System Audit Log', icon:'🔐', desc:`${(auditLog||[]).length} activity events`},
  ], [loans, payments, customers, workers, auditLog]);

  useEffect(() => {
    setActiveMenu(preSelected);
  }, [preSelected]);

  const handleExport = (r, format, dlFn) => {
    const rData = buildReportData(r.id, data, { startDate, endDate });
    dlFn(rData);
    addAudit('Report Downloaded', r.id, `Format: ${format}, Range: ${startDate} to ${endDate}`);
    showToast(`✅ ${r.label} ${format} downloaded`, 'ok');
  };

  return (
    <div className='fu'>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:20,flexWrap:'wrap',gap:16}}>
        <div>
          <div style={{fontFamily:T.head,color:T.txt,fontSize:20,fontWeight:800}}>📊 Reports & Exports</div>
          <div style={{color:T.muted,fontSize:13,marginTop:2}}>Download high-fidelity reports as PDF, Excel, or Word</div>
        </div>
        
        {/* Date Range Picker */}
        <div style={{display:'flex', gap:10, alignItems:'center', background:T.card, padding:'10px 14px', borderRadius:12, border:`1px solid ${T.border}`}}>
          <div style={{display:'flex', flexDirection:'column', gap:4}}>
            <label style={{fontSize:10, fontWeight:800, color:T.muted, textTransform:'uppercase'}}>From</label>
            <input type='date' value={startDate} onChange={e=>setStartDate(e.target.value)} 
              style={{background:T.surface, border:`1px solid ${T.hi}`, borderRadius:6, padding:'4px 8px', color:T.txt, fontSize:12, outline:'none'}} />
          </div>
          <div style={{color:T.border, fontSize:20, marginTop:12}}>→</div>
          <div style={{display:'flex', flexDirection:'column', gap:4}}>
            <label style={{fontSize:10, fontWeight:800, color:T.muted, textTransform:'uppercase'}}>To</label>
            <input type='date' value={endDate} onChange={e=>setEndDate(e.target.value)} 
              style={{background:T.surface, border:`1px solid ${T.hi}`, borderRadius:6, padding:'4px 8px', color:T.txt, fontSize:12, outline:'none'}} />
          </div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
        {reports.map(r=>{
          const isOpen=activeMenu===r.id;
          const rData=buildReportData(r.id,data, { startDate, endDate });
          return (
          <Card key={r.id} onClick={()=>setActiveMenu(r.id)} style={{padding:'20px 22px',position:'relative',border:isOpen?`1px solid ${T.accent}`:undefined, transition:'all .2s', cursor:'pointer'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12}}>
              <div style={{fontSize:32}}>{r.icon}</div>
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

