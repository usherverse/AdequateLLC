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
  useContactPopup, useToast, useReminders, useModalLock } from '@/lms-common';
import WorkerPanel from '@/modules/workers/WorkerPanel';

const ReportsTab = ({loans,customers,payments,workers,auditLog,showToast=()=>{}}) => {
  const [activeMenu,setActiveMenu]=useState(null);
  const data={loans,customers,payments,workers,auditLog};
  const reports=[
    {id:'loan-portfolio',label:'Loan Portfolio',icon:'📋',desc:`${loans.length} total loans`},
    {id:'financial',label:'Financial Summary',icon:'💰',desc:'Disbursed, collected, overdue'},
    {id:'overdue',label:'Overdue Report',icon:'⚠️',desc:`${loans.filter(l=>l.status==='Overdue').length} overdue loans`},
    {id:'payments',label:'Payments',icon:'💳',desc:`${payments.length} payment records`},
    {id:'customers',label:'Customers',icon:'👥',desc:`${customers.length} registered`},
    {id:'staff',label:'Staff Performance',icon:'👷',desc:`${workers.length} team members`},
    {id:'audit',label:'Audit Log',icon:'🔐',desc:`${(auditLog||[]).length} events`},
  ];

  return (
    <div className='fu'>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4,flexWrap:'wrap',gap:8}}>
        <div>
          <div style={{fontFamily:T.head,color:T.txt,fontSize:20,fontWeight:800}}>📊 Reports & Exports</div>
          <div style={{color:T.muted,fontSize:13,marginTop:2}}>Download reports as PDF, Word (.doc), or CSV</div>
        </div>
      </div>
      <div style={{marginBottom:14}}/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12}}>
        {reports.map(r=>{
          const isOpen=activeMenu===r.id;
          const rData=buildReportData(r.id,data);
          return (
          <Card key={r.id} style={{padding:'16px 18px',position:'relative',border:isOpen?`1px solid ${T.accent}`:undefined}}>
            <div style={{fontSize:26,marginBottom:8}}>{r.icon}</div>
            <div style={{color:T.txt,fontWeight:700,fontSize:14,marginBottom:3}}>{r.label}</div>
            <div style={{color:T.muted,fontSize:11,marginBottom:14}}>{r.desc}</div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              <button onClick={()=>{dlReportCSV(rData);showToast(`✅ ${r.label} CSV downloaded`,'ok');}}
                style={{flex:1,background:T.aLo,border:`1px solid ${T.accent}38`,color:T.accent,borderRadius:7,padding:'6px 8px',fontSize:11,fontWeight:700,cursor:'pointer'}}>
                ⬇ CSV
              </button>
              <button onClick={()=>{dlReportPDF(rData);showToast(`✅ ${r.label} HTML/Print file downloaded`,'ok');}}
                style={{flex:1,background:T.dLo,border:`1px solid ${T.danger}38`,color:T.danger,borderRadius:7,padding:'6px 8px',fontSize:11,fontWeight:700,cursor:'pointer'}}>
                ⬇ PDF/Print
              </button>
              <button onClick={()=>{dlReportWord(rData);showToast(`✅ ${r.label} Word doc downloaded`,'ok');}}
                style={{flex:1,background:T.bLo,border:`1px solid ${T.blue}38`,color:T.blue,borderRadius:7,padding:'6px 8px',fontSize:11,fontWeight:700,cursor:'pointer'}}>
                ⬇ Word
              </button>
            </div>
          </Card>
        );})}
      </div>
    </div>
  );
};

export default ReportsTab;
