import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { Lock, Shield, ShieldCheck, KeyRound, Clock, ClipboardList, CheckCircle, Hourglass, CreditCard, Banknote, UserCheck, Target, Ban, UserPlus, RefreshCw, Upload, Trash2, FileText, ChevronDown, Check, ArrowDown } from 'lucide-react';
import { T, SC, RC, SFX, Card, CH, KPI, DT, Btn, Badge, Av, Bar, BackBtn, RefreshBtn,
  FI, PhoneInput, NumericInput, Search, Pills, Alert, Dialog, ConfirmDialog, ToastContainer,
  LoanModal, LoanForm, RepayTracker,
  fmt, fmtM, now, uid, ts, escHtml, toCSV, dlCSV, buildFullBackup,
  calculateLoanStatus, MODAL_TOP_OFFSET,
  sbWrite, sbInsert,
  toSupabaseLoan, toSupabaseCustomer, toSupabasePayment, toSupabaseInteraction,
  generateLoanAgreementHTML, generateAssetListHTML, downloadLoanDoc,
  useContactPopup, useToast, useReminders, useModalLock } from '@/lms-common';

const SECURITY_EVENTS = [
  {key:'TLS Encryption',     icon:<Lock size={18} />, color:T.ok,     desc:`All data transmitted between your browser and the server is encrypted using TLS 1.3. This prevents eavesdropping and man-in-the-middle attacks.`},
  {key:'Row Level Security', icon:<ShieldCheck size={18} />, color:T.ok,     desc:`Database rows are protected at the storage level. Each user can only access records they are authorised to see based on their role.`},
  {key:'3FA Admin Login',    icon:<KeyRound size={18} />, color:T.ok,     desc:`Admin accounts require three independent factors to log in: password, biometric (WebAuthn), and a time-based one-time password (TOTP). This makes account compromise extremely difficult.`},
  {key:'Field Encryption',   icon:<Lock size={18} />, color:T.ok,     desc:`Sensitive customer fields (ID numbers, phone numbers) are encrypted at rest using AES-256. Even if the database file is stolen, the data cannot be read without the encryption key.`},
  {key:'Rate Limiting',      icon:<Clock size={18} />, color:T.ok,     desc:`Login attempts, API calls, and form submissions are throttled to prevent brute-force attacks. After 3 failed admin logins, the account is locked for 15 minutes.`},
  {key:'Audit Logging',      icon:<ClipboardList size={18} />, color:T.accent, desc:`Every action taken by every user is recorded with a timestamp, user ID, action type, target record, and details. The log cannot be deleted or modified by regular users.`, dynamic:true},
  {key:'OWASP Compliance',   icon:<CheckCircle size={18} />, color:T.ok,     desc:`The system is built following OWASP Top 10 security guidelines. This includes protection against SQL injection, XSS, CSRF, broken authentication, and security misconfiguration.`},
  {key:'Session Security',   icon:<Hourglass size={18} />, color:T.warn,   desc:`Admin sessions expire after 15 minutes of inactivity. Worker sessions are tied to their account status — deactivating a worker immediately prevents new logins.`},
];

const AuditEventDetail = ({entry, onClose}) => {
  const actionMeta = {
    'Loan Approved':        {icon:<CheckCircle size={18} />, color:T.ok,     summary:`A loan application was reviewed and approved for disbursement.`},
    'Payment Recorded':     {icon:<CreditCard size={18} />, color:T.ok,     summary:`A payment was recorded against a customer loan account.`},
    'Payment Allocated':    {icon:<Banknote size={18} />, color:T.ok,     summary:`An unallocated M-Pesa payment was matched and applied to a loan.`},
    'Worker Login':         {icon:<UserCheck size={18} />, color:T.accent, summary:`A worker successfully authenticated into the Worker Portal.`},
    'Lead Converted':       {icon:<Target size={18} />, color:T.ok,     summary:`A lead was onboarded and converted into a registered customer.`},
    'Customer Blacklisted': {icon:<Ban size={18} />, color:T.danger, summary:`A customer was flagged as blacklisted, preventing new loan applications.`},
    'Loan Disbursed':       {icon:<Banknote size={18} />, color:T.gold,   summary:`Loan funds were released to the customer via M-Pesa.`},
    'Worker Added':         {icon:<UserPlus size={18} />, color:T.blue,   summary:`A new staff member was added to the system.`},
    'Role Changed':         {icon:<RefreshCw size={18} />, color:T.warn,   summary:`A staff member's role or access level was modified.`},
    'Data Export':          {icon:<Upload size={18} />, color:T.blue,   summary:`A data export or CSV download was performed.`},
    'DATABASE CLEARED':     {icon:<Trash2 size={18} />, color:T.danger, summary:`The entire database was wiped after 3-factor verification.`},
  };
  const meta = Object.entries(actionMeta).find(([k])=>entry.action.includes(k))?.[1] || {icon:<FileText size={18} />, color:T.muted, summary:`A system action was performed and recorded in the audit trail.`};
  return (
    <div className='dialog-backdrop' style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:99998,display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:MODAL_TOP_OFFSET+8,background:'rgba(4,8,16,0.65)',backdropFilter:'var(--glass-blur)',WebkitBackdropFilter:'var(--glass-blur)',overflow:'hidden'}} onClick={onClose}>
      <div className='pop-in' style={{background:T.card,border:`1px solid ${T.hi}`,borderRadius:20,padding:'22px 24px',width:'100%',maxWidth:440,boxShadow:'0 -20px 60px #00000080'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
          <div style={{width:44,height:44,borderRadius:14,background:meta.color+'18',border:`1px solid ${meta.color}30`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>{meta.icon}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{color:T.txt,fontWeight:800,fontSize:14,fontFamily:T.head}}>{entry.action}</div>
            <div style={{color:T.muted,fontSize:12,marginTop:2}}>{entry.ts} · <span style={{color:T.accent,fontFamily:T.mono}}>{entry.user}</span></div>
          </div>
          <button onClick={onClose} style={{background:T.card2,border:`1px solid ${T.border}`,color:T.muted,borderRadius:99,width:28,height:28,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><X size={14} /></button>
        </div>
        <div style={{background:T.surface,borderRadius:12,padding:'12px 14px',marginBottom:14,color:T.dim,fontSize:13,lineHeight:1.65}}>{meta.summary}</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          {[['Target', entry.target],['Details', entry.detail||'—'],['User', entry.user],['Time', entry.ts]].map(([k,v])=>(
            <div key={k} style={{background:T.card2,borderRadius:9,padding:'8px 11px'}}>
              <div style={{color:T.muted,fontSize:10,textTransform:'uppercase',letterSpacing:.6,marginBottom:3}}>{k}</div>
              <div style={{color:meta.color,fontSize:12,fontWeight:700,fontFamily:T.mono,wordBreak:'break-all'}}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};


const SecurityTab = ({auditLog}) => {
  const [hoveredEvent, setHoveredEvent] = useState(null);
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [selAudit, setSelAudit] = useState(null);
  const dlAudit=()=>{
    const csv=toCSV(['Timestamp','User','Action','Target','Details'],auditLog.map(e=>[e.ts,e.user,e.action,e.target,e.detail||'']));
    dlCSV(`audit-log-${now()}.csv`,csv);
  };

  const toggleEvent = (key) => {
    SFX.notify();
    setExpandedEvent(prev => prev===key ? null : key);
  };

  return (
    <div className='fu'>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18,flexWrap:'wrap',gap:10}}>
        <div>
          <div style={{fontFamily:T.head,color:T.txt,fontSize:20,fontWeight:800,display:'flex',alignItems:'center',gap:8}}><Shield size={20} /> Security & Audit</div>
          <div style={{color:T.muted,fontSize:13,marginTop:2}}>{auditLog.length} total events recorded · All systems operational</div>
        </div>
        <Btn v='ok' onClick={dlAudit}><span style={{display: 'flex', alignItems: 'center', gap: 6}}><ArrowDown size={14} /> Export Audit CSV</span></Btn>
      </div>

      {/* Animated security event tiles */}
      <div className='mob-grid1' style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:10,marginBottom:18}}>
        {SECURITY_EVENTS.map(ev=>{
          const isExpanded = expandedEvent===ev.key;
          const isHovered  = hoveredEvent===ev.key;
          const val = ev.dynamic ? `${auditLog.length} events` : 'Active';
          return (
            <div key={ev.key}
              className='sec-event'
              onMouseEnter={()=>setHoveredEvent(ev.key)}
              onMouseLeave={()=>setHoveredEvent(null)}
              onClick={()=>toggleEvent(ev.key)}
              style={{
                background: isExpanded ? ev.color+'18' : isHovered ? ev.color+'10' : T.card,
                border:`1px solid ${isExpanded||isHovered ? ev.color+'50' : ev.color+'20'}`,
                borderRadius:12, overflow:'hidden', cursor:'pointer',
                boxShadow: isExpanded ? `0 4px 20px ${ev.color}18` : 'none',
              }}>
              <div style={{display:'flex',alignItems:'center',gap:11,padding:'13px 14px'}}>
                <div style={{
                  width:36,height:36,borderRadius:11,
                  background:isHovered||isExpanded ? ev.color+'28' : ev.color+'14',
                  border:`1px solid ${ev.color}30`,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:18,flexShrink:0,
                  transition:'background .2s,transform .2s',
                  transform:isHovered?'scale(1.12)':'scale(1)',
                }}>{ev.icon}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:isHovered||isExpanded ? ev.color : T.txt,fontWeight:700,fontSize:13,transition:'color .2s'}}>{ev.key}</div>
                  <div style={{color:ev.color,fontSize:12,fontWeight:800,marginTop:1,display:'flex',alignItems:'center',gap:4}}><Check size={12} /> {val}</div>
                </div>
                <div style={{color:ev.color,fontSize:12,opacity:0.7,flexShrink:0,transition:'transform .2s',transform:isExpanded?'rotate(180deg)':'rotate(0deg)'}}><ChevronDown size={16} /></div>
              </div>
              {isExpanded&&(
                <div className='expand-in' style={{padding:'0 14px 14px',color:T.dim,fontSize:13,lineHeight:1.65,borderTop:`1px solid ${ev.color}20`}}>
                  <div style={{paddingTop:12}}>{ev.desc}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Audit log — clickable rows */}
      <Card>
        <CH title={<div style={{display:'flex',alignItems:'center',gap:8}}><ClipboardList size={18}/> Live Audit Log</div>} sub='Click any entry to see details' right={<Btn sm v='secondary' onClick={dlAudit}><span style={{display:'flex',alignItems:'center',gap:4}}><ArrowDown size={14}/> Export</span></Btn>}/>
        <div style={{maxHeight:'40vh',overflowY:'auto',overflowX:'auto'}}>
          <table style={{width:'100%',minWidth:600,borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr>{[['Timestamp',''],['User',''],['Action',''],['Target',''],['Details','']].map(([l])=>(
                <th key={l} style={{color:T.muted,fontWeight:700,fontSize:10,letterSpacing:1,textTransform:'uppercase',padding:'10px 13px',textAlign:'left',borderBottom:`1px solid ${T.border}`,whiteSpace:'nowrap',position:'sticky',top:0,background:T.card,zIndex:2}}>{l}</th>
              ))}</tr>
            </thead>
            <tbody>
              {auditLog.length===0
                ?<tr><td colSpan={5} style={{padding:32,textAlign:'center',color:T.muted}}>No audit events yet</td></tr>
                :auditLog.map((entry,i)=>(
                  <tr key={i} className='audit-row'
                    onClick={()=>{setSelAudit(entry);SFX.notify();}}
                    style={{borderBottom:`1px solid ${T.border}18`}}>
                    <td style={{padding:'10px 13px',color:T.muted,fontSize:12,fontFamily:T.mono,whiteSpace:'nowrap'}}>{entry.ts}</td>
                    <td style={{padding:'10px 13px'}}><span style={{color:T.accent,fontFamily:T.mono,fontSize:12}}>{entry.user}</span></td>
                    <td style={{padding:'10px 13px'}}><span style={{color:T.txt,fontWeight:600}}>{entry.action}</span></td>
                    <td style={{padding:'10px 13px'}}><span style={{color:T.gold,fontFamily:T.mono,fontSize:12}}>{entry.target}</span></td>
                    <td style={{padding:'10px 13px'}}><span style={{color:T.muted,fontSize:12}}>{entry.detail}</span></td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </Card>

      {selAudit&&<AuditEventDetail entry={selAudit} onClose={()=>setSelAudit(null)}/>}
    </div>
  );
};

// ═══════════════════════════════════════════
//  DATABASE MANAGEMENT — 3FA clear + backup
// ═══════════════════════════════════════════

export default SecurityTab;
