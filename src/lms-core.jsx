// ADEQUATE CAPITAL LMS — App Shell (Modularized)
import LoansTab from "@/modules/loans/LoansTab";
import PaymentsTab from "@/modules/payments/PaymentsTab";
import CollectionsTab from "@/modules/collections/CollectionsTab";
import DashboardTab from "@/modules/dashboard/DashboardTab";
import CustomersTab from "@/modules/customers/CustomersTab";
import CustomerProfile from "@/modules/customers/CustomerProfile";
import LeadsTab from "@/modules/leads/LeadsTab";
import WorkersTab from "@/modules/workers/WorkersTab";
import DatabaseTab from "@/modules/database/DatabaseTab";
import SecuritySettingsTab from "@/modules/security/SecuritySettingsTab";
import ReportsTab from "@/modules/reports/ReportsTab";
import AuditTrailTab from "@/modules/audit/AuditTrailTab";
import PaymentsHub from "@/pages/PaymentsHub"; // MODIFIED: Added Payments Hub

import { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback, memo } from "react";
import { _hashPw, _checkPw, SEED_WORKERS, SEED_CUSTOMERS, SEED_LOANS, SEED_PAYMENTS, SEED_LEADS, SEED_INTERACTIONS, SEED_AUDIT } from "@/data/seedData";
import DueLoansCalendar from "@/modules/calendar/DueLoansCalendar";
import WorkerPanel from "@/modules/workers/WorkerPanel";

import {
  T,
  SC,
  RC,
  SFX,
  fmt,
  fmtM,
  now,
  ts,
  uid,
  DAILY_RATE,
  INTEREST_DAYS,
  PENALTY_DAYS,
  FREEZE_AFTER,
  calculateLoanStatus,
  calcP,
  escHtml,
  toCSV,
  dlCSV,
  buildFullBackup,
  useToast,
  Styles,
  useContactPopup,
  useReminders,
  useModalLock,
  Badge,
  Av,
  Bar,
  KPI,
  Card,
  CH,
  Btn,
  BackBtn,
  RefreshBtn,
  FI,
  PhoneInput,
  NumericInput,
  Alert,
  ToastContainer,
  Dialog,
  ConfirmDialog,
  LoanForm,
  RepayTracker,
  DocViewer,
  StructuredDocUpload,
  LoanModal,
  CustomerEditForm,
  CustDocsTab,
  CustomerDetail,
  sbWrite,
  sbInsert,
  sbAuditInsert,
  sbDelete,
  fromSupabaseLoan,
  toSupabaseLoan,
  fromSupabaseCustomer,
  toSupabaseCustomer,
  fromSupabasePayment,
  toSupabasePayment,
  fromSupabaseLead,
  toSupabaseLead,
  fromSupabaseInteraction,
  toSupabaseInteraction,
  fromSupabaseWorker,
  toSupabaseWorker,
  generateLoanAgreementHTML,
  generateAssetListHTML,
  downloadLoanDoc,
  Search,
  Pills,
  DT,
  getSecConfig,
  ADMIN_NAV,
  checkPwAsync,
  DEFAULT_ADMIN_PW,
  hashPwAsync,
  ReminderAlertModal,
  RemindersPanel,
  WORKER_NAV,
} from "./lms-common";

export {
  T,
  SC,
  RC,
  SFX,
  fmt,
  fmtM,
  now,
  ts,
  uid,
  DAILY_RATE,
  INTEREST_DAYS,
  PENALTY_DAYS,
  FREEZE_AFTER,
  calculateLoanStatus,
  calcP,
  escHtml,
  toCSV,
  dlCSV,
  buildFullBackup,
  useToast,
  Styles,
  useContactPopup,
  useReminders,
  useModalLock,
  Badge,
  Av,
  Bar,
  KPI,
  Card,
  CH,
  Btn,
  BackBtn,
  RefreshBtn,
  FI,
  PhoneInput,
  NumericInput,
  Alert,
  ToastContainer,
  Dialog,
  ConfirmDialog,
  LoanForm,
  RepayTracker,
  DocViewer,
  StructuredDocUpload,
  LoanModal,
  CustomerEditForm,
  CustDocsTab,
  CustomerDetail,
  sbWrite,
  sbInsert,
  sbAuditInsert,
  sbDelete,
  fromSupabaseLoan,
  toSupabaseLoan,
  fromSupabaseCustomer,
  toSupabaseCustomer,
  fromSupabasePayment,
  toSupabasePayment,
  fromSupabaseLead,
  toSupabaseLead,
  fromSupabaseInteraction,
  toSupabaseInteraction,
  fromSupabaseWorker,
  toSupabaseWorker,
  generateLoanAgreementHTML,
  generateAssetListHTML,
  downloadLoanDoc,
  Search,
  Pills,
  DT,
  getSecConfig,
  ADMIN_NAV,
};

import { useSearchParams } from "react-router-dom"; // MODIFIED: Support parameterized redirects

const AdminPanel = ({onLogout,loans,setLoans,customers,setCustomers,workers,setWorkers,payments,setPayments,leads,setLeads,interactions,setInteractions,auditLog,setAuditLog,onOpenCustomerProfile}) => {
  const [screen,setScreen]=useState('dashboard');
  const [searchParams, setSearchParams] = useSearchParams(); // MODIFIED
  const [screenHistory,setScreenHistory]=useState([]);
  const [sb,setSb]=useState(false);
  const [showReminders,setShowReminders]=useState(false);
  const toggleSb=()=>setSb(o=>!o);
  const scrollRef = useRef(null);
  const scrollTop = () => {
    try{ scrollRef.current?.scrollTo({top:0,behavior:'instant'}); }catch(e){}
    try{ window.scrollTo({top:0,behavior:'instant'}); }catch(e){}
  };
  const navTo=(s, params)=>{ 
    setScreenHistory(h=>[...h.slice(-9),screen]); 
    setScreen(s); 
    if (params) setSearchParams(params); // MODIFIED: Apply params to URL
    setSb(false); 
    scrollTop(); 
    setTimeout(scrollTop,50); 
  };
  const goBack=()=>{ if(screenHistory.length===0) return; const prev=screenHistory[screenHistory.length-1]; setScreenHistory(h=>h.slice(0,-1)); setScreen(prev); setTimeout(scrollTop,30); };

  // MODIFIED: Sync screen from URL on mount (Fixes refresh desync)
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['disbursements', 'registration-fee', 'paybill', 'audit'].includes(tab)) {
      setScreen('paymentshub');
    }
  }, []); // Only on mount

  const {toasts,show:showToast}=useToast();
  const {reminders,add:addReminder,done:doneReminder,remove:removeReminder,update:updateReminder,firing:firingReminder,dismissFiring}=useReminders();
  const addAudit = useCallback((action, target, detail = '') => {
    const entry = { ts: ts(), user: 'admin', action, target, detail };
    setAuditLog(l => [entry, ...l].slice(0, 500));
    sbAuditInsert({
      ts: new Date().toISOString(),
      user_name: entry.user,
      action: entry.action,
      target_id: String(entry.target),
      detail: entry.detail
    }).catch(console.error);
  }, [setAuditLog]);

  const unalloc=useMemo(()=>payments.filter(p=>p.status==='Unallocated').length,[payments]);
  const overdue=useMemo(()=>loans.filter(l=>l.status==='Overdue').length,[loans]);
  const pendingApprovals=useMemo(()=>loans.filter(l=>l.status==='Application submitted'||l.status==='worker-pending').length,[loans]);
  const allState=useMemo(()=>({loans,customers,payments,workers,leads,interactions,auditLog}),[loans,customers,payments,workers,leads,interactions,auditLog]);
  // FIX B — reminders.filter called 3× inline in JSX on every render. Memoize counts.
  const activeReminderCount=useMemo(()=>reminders.filter(r=>!r.done).length,[reminders]);
  const firingReminderCount=useMemo(()=>reminders.filter(r=>!r.done&&new Date(`${r.dueDate}T${r.dueTime}:00`)>new Date()).length,[reminders]);

  // 15-min inactivity session timeout
  useEffect(()=>{
    const TIMEOUT=15*60*1000;
    let timer;
    const reset=()=>{clearTimeout(timer);timer=setTimeout(()=>{addAudit('Session Expired','Admin','Auto-logout after 15 min inactivity');onLogout();},TIMEOUT);};
    const events=['mousemove','mousedown','keydown','touchstart','scroll','click'];
    events.forEach(e=>window.addEventListener(e,reset,{passive:true}));
    reset();
    return()=>{clearTimeout(timer);events.forEach(e=>window.removeEventListener(e,reset));};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // Loan status update — runs on mount and then every 24 hours
  useEffect(()=>{
    // Strict Business Logic: Repayment frequency does not determine loan maturity.
    // A loan is 'due' strictly 30 days from disbursement date calculation.

    const updateLoans = () => {
      const n = new Date();
      setLoans((ls) =>
        ls.map((l) => {
          if (!["Active", "Overdue", "Frozen"].includes(l.status) || !l.disbursed)
            return l;
          const disbDate = new Date(l.disbursed);
          const diffDays = Math.floor((n - disbDate) / (1000 * 60 * 60 * 24));
          const grace = 30; // Enforced strict due logic
          const od = Math.max(0, diffDays - grace);

          if (l.status === "Active") {
            if (diffDays > grace && l.balance > 0) {
              const targetStatus = od > FREEZE_AFTER ? "Frozen" : "Overdue";
              const upd = { ...l, status: targetStatus, daysOverdue: od };
              sbWrite("loans", toSupabaseLoan(upd));
              return upd;
            }
            return l;
          }
          if (l.status === "Overdue" || l.status === "Frozen") {
            // Automatic write-off if 121+ days since disbursement (91+ days overdue)
            if (od >= 91) {
              const upd = { ...l, status: "Written off", daysOverdue: od };
              sbWrite("loans", toSupabaseLoan(upd));
              addAudit(
                "Auto Write-Off",
                l.id,
                `Amount: ${fmt(l.amount)} (Automated after ${diffDays}d total age / 91d overdue)`
              );
              return upd;
            }

            const targetStatus = od > FREEZE_AFTER ? "Frozen" : "Overdue";
            if (od !== l.daysOverdue || l.status !== targetStatus) {
              const upd = { ...l, status: targetStatus, daysOverdue: od };
              sbWrite("loans", toSupabaseLoan(upd));
              return upd;
            }
            return l;
          }
          return l;
        })
      );
    };
    updateLoans();
    const id=setInterval(updateLoans,24*60*60*1000);
    return()=>clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // FIX — Bug 2 (Dashboard/sidebar perf): navItem was an inline arrow re-created every
  // render. LiveClock ticks every second, so AdminPanel re-renders every second, meaning
  // navItem (and every button it produces) was a brand-new function/element each tick.
  // useCallback stabilizes it so it only re-creates when its actual dependencies change.
  const navItem=useCallback((item)=>(
    <button key={item.id} onClick={()=>navTo(item.id)} className='nb'
      style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 12px',borderRadius:9,border:'none',background:screen===item.id?T.aLo:'none',color:screen===item.id?T.accent:T.muted,cursor:'pointer',fontSize:13,fontWeight:screen===item.id?700:500,marginBottom:2,textAlign:'left',transition:'background .18s,color .18s',flexShrink:0,position:'relative'}}>
      <span style={{fontSize:15,flexShrink:0,width:22,textAlign:'center'}}>{item.i}</span>
      <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.l}</span>
      {item.id==='payments'&&unalloc>0&&<span style={{background:T.danger,color:'#fff',borderRadius:99,padding:'1px 6px',fontSize:10,fontWeight:800}}>{unalloc}</span>}
      {item.id==='collections'&&overdue>0&&<span style={{background:T.dLo,color:T.danger,borderRadius:99,padding:'1px 6px',fontSize:10,fontWeight:800,border:`1px solid ${T.danger}38`}}>{overdue}</span>}
      {item.id==='loans'&&pendingApprovals>0&&<span style={{background:T.gLo,color:T.gold,borderRadius:99,padding:'1px 6px',fontSize:10,fontWeight:800,border:`1px solid ${T.gold}38`}}>{pendingApprovals}</span>}
    </button>
  ),[screen,navTo,unalloc,overdue,pendingApprovals]);

  const S={
    dashboard:  ()=><DashboardTab loans={loans} setLoans={setLoans} customers={customers} setCustomers={setCustomers} payments={payments} setPayments={setPayments} workers={workers} interactions={interactions} setInteractions={setInteractions} addAudit={addAudit} onNav={navTo} scrollTop={scrollTop} onOpenCustomerProfile={onOpenCustomerProfile}/>,
    calendar:   ()=><DueLoansCalendar loans={loans} payments={payments} workers={workers} workerContext={{role:'admin',name:'Admin'}} onOpenCustomerProfile={onOpenCustomerProfile} />,
    loans:      ()=><LoansTab loans={loans} setLoans={setLoans} customers={customers} setCustomers={setCustomers} payments={payments} setPayments={setPayments} interactions={interactions} setInteractions={setInteractions} workers={workers} addAudit={addAudit} showToast={showToast} onOpenCustomerProfile={onOpenCustomerProfile}/>,
    customers:  ()=><CustomersTab customers={customers} setCustomers={setCustomers} workers={workers} loans={loans} setLoans={setLoans} payments={payments} setPayments={setPayments} interactions={interactions} setInteractions={setInteractions} addAudit={addAudit} showToast={showToast} onOpenCustomerProfile={onOpenCustomerProfile}/>,
    leads:      ()=><LeadsTab leads={leads} setLeads={setLeads} workers={workers} customers={customers} setCustomers={setCustomers} loans={loans} addAudit={addAudit} showToast={showToast} onOpenCustomerProfile={onOpenCustomerProfile} onNav={navTo}/>, // MODIFIED: Added onNav
    collections:()=><CollectionsTab loans={loans} setLoans={setLoans} customers={customers} setCustomers={setCustomers} payments={payments} setPayments={setPayments} interactions={interactions} setInteractions={setInteractions} workers={workers} addAudit={addAudit} scrollTop={scrollTop} currentUser='Admin' onOpenCustomerProfile={onOpenCustomerProfile}/>,
    payments:   ()=><PaymentsTab payments={payments} setPayments={setPayments} loans={loans} setLoans={setLoans} customers={customers} setCustomers={setCustomers} interactions={interactions} setInteractions={setInteractions} workers={workers} addAudit={addAudit} showToast={showToast} onOpenCustomerProfile={onOpenCustomerProfile}/>,
    workers:    ()=><WorkersTab workers={workers} setWorkers={setWorkers} loans={loans} setLoans={setLoans} payments={payments} customers={customers} setCustomers={setCustomers} leads={leads} setLeads={setLeads} interactions={interactions} setInteractions={setInteractions} allState={allState} addAudit={addAudit} showToast={showToast} onOpenCustomerProfile={onOpenCustomerProfile}/>,
    securitysettings: ()=><SecuritySettingsTab auditLog={auditLog} addAudit={addAudit} showToast={showToast}/>,
    database:   ()=><DatabaseTab allState={allState} setLoans={setLoans} setCustomers={setCustomers} setPayments={setPayments} setWorkers={setWorkers} setLeads={setLeads} setInteractions={setInteractions} setAuditLog={setAuditLog} addAudit={addAudit} showToast={showToast}/>,
    reports:    ()=><ReportsTab loans={loans} customers={customers} payments={payments} workers={workers} auditLog={auditLog} showToast={showToast} addAudit={addAudit}/>,
    audit:      ()=><AuditTrailTab allState={allState} setAuditLog={setAuditLog} />,
    paymentshub: ()=><PaymentsHub customers={customers} loans={loans} payments={payments} addAudit={addAudit} showToast={showToast} />, // MODIFIED: Added Payments Hub
  };

  // FIX — Bug 1 (Form focus / remounting): S contains plain arrow functions, NOT React
  // component types. Writing <Screen/> (capital S) makes React treat a brand-new function
  // reference as a new component type on every render, causing full unmount+remount which
  // destroys input focus after every keystroke. Call Screen() as a plain render function so
  // React reconciles the returned JSX in-place without remounting.
  const renderScreen = (S[screen] || S.dashboard)();

  return (
    <div style={{display:'flex',minHeight:'100vh',background:T.bg,fontFamily:T.body,position:'relative'}}>
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Backdrop — dims page, closes sidebar on tap */}
      {sb&&(
        <div onClick={()=>setSb(false)}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:199,backdropFilter:'blur(2px)',WebkitBackdropFilter:'blur(2px)'}}/>
      )}

      {/* Sidebar — slides in from left as overlay, hidden until toggled */}
      <div style={{
        position:'fixed',top:0,bottom:0,left:sb?0:-280,width:260,
        background:T.surface,borderRight:`1px solid ${T.border}`,
        display:'flex',flexDirection:'column',zIndex:200,
        transition:'left .25s cubic-bezier(.22,1,.36,1)',
        boxShadow:sb?'6px 0 40px #00000080':'none',
      }}>
        <div style={{padding:'15px 14px 12px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',minHeight:56,flexShrink:0}}>
          <div style={{fontFamily:T.head,color:T.accent,fontWeight:900,fontSize:13,letterSpacing:-.2,lineHeight:1.3}}>Adequate<br/>Capital</div>
          <button onClick={()=>setSb(false)} aria-label="Close navigation menu" style={{background:T.card2,border:`1px solid ${T.border}`,color:T.muted,borderRadius:8,width:30,height:30,cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><span aria-hidden="true">✕</span></button>
        </div>
        <nav id="sidebar-nav" aria-label="Main navigation" style={{flex:1,padding:'8px 6px',overflowY:'auto'}}>{ADMIN_NAV.map(navItem)}</nav>
        <div style={{padding:'8px 6px',borderTop:`1px solid ${T.border}`,flexShrink:0}}>
          <button onClick={onLogout} className='nb' style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 12px',borderRadius:9,border:'none',background:'none',color:T.danger,cursor:'pointer',fontSize:13,fontWeight:600}}>
            <span style={{width:22,textAlign:'center',fontSize:15}}>⎋</span>
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main content — always full width, never shifts */}
      <div ref={scrollRef} className='main-scroll' style={{flex:1,overflow:'auto',display:'flex',flexDirection:'column',minWidth:0,height:'100vh',maxHeight:'100vh'}}>
        {/* Topbar */}
        <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,padding:'10px 14px',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,zIndex:100,flexShrink:0,gap:8}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <button onClick={toggleSb} aria-label="Open navigation menu" aria-expanded={sb} aria-controls="sidebar-nav" style={{background:'none',border:`1px solid ${T.border}`,color:T.muted,cursor:'pointer',fontSize:16,padding:'5px 9px',borderRadius:8,lineHeight:1,flexShrink:0}}><span aria-hidden="true">☰</span></button>
            {screenHistory.length>0&&(
              <button onClick={goBack} className='back-btn' style={{flexShrink:0}}>
                <span style={{fontSize:15,lineHeight:1}}>‹</span>
                <span style={{fontSize:12}}>{screenHistory[screenHistory.length-1].charAt(0).toUpperCase()+screenHistory[screenHistory.length-1].slice(1)}</span>
              </button>
            )}
            <RefreshBtn onRefresh={()=>{ scrollTop(); navTo(screen); }}/>
          </div>
          <div className="topbar-actions" style={{display:'flex',gap:7,alignItems:'center',flexWrap:'wrap'}}>
            {pendingApprovals>0&&<button onClick={()=>navTo('loans')} style={{background:T.gLo,border:`1px solid ${T.gold}38`,borderRadius:8,padding:'4px 9px',color:T.gold,fontSize:12,fontWeight:700,cursor:'pointer'}}>⏳ {pendingApprovals}</button>}
            {overdue>0&&<button onClick={()=>navTo('collections')} style={{background:T.dLo,border:`1px solid ${T.danger}38`,borderRadius:8,padding:'4px 9px',color:T.danger,fontSize:12,fontWeight:700,cursor:'pointer'}}>{overdue} Overdue</button>}
            {unalloc>0&&<button onClick={()=>navTo('payments')} style={{background:T.wLo,border:`1px solid ${T.warn}38`,borderRadius:8,padding:'4px 9px',color:T.warn,fontSize:12,fontWeight:700,cursor:'pointer'}}>{unalloc} Unalloc</button>}
            <button onClick={()=>{setShowReminders(s=>!s);SFX.notify();}} aria-label={'Reminders'+(activeReminderCount>0?' — '+activeReminderCount+' active':'')} aria-expanded={showReminders} aria-haspopup="dialog" style={{background:showReminders?T.aLo:T.card2,border:`1px solid ${showReminders?T.accent:T.border}`,color:showReminders?T.accent:T.muted,borderRadius:9,padding:'5px 10px',fontSize:14,cursor:'pointer',position:'relative',display:'flex',alignItems:'center',gap:5}}>
              <span aria-hidden="true">🔔</span>
              {firingReminderCount>0&&(
                <span style={{position:'absolute',top:-4,right:-4,background:T.danger,borderRadius:99,width:14,height:14,display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:900,color:'#fff'}}>
                  {activeReminderCount}
                </span>
              )}
            </button>
          </div>
        </div>
        {firingReminder&&<ReminderAlertModal reminder={firingReminder} onDismiss={dismissFiring} onDone={doneReminder}/>}
        {showReminders&&<RemindersPanel reminders={reminders} onAdd={addReminder} onDone={doneReminder} onRemove={removeReminder} onUpdate={updateReminder} onClose={()=>setShowReminders(false)}/>}
        <div id="main-content" className='admin-content' style={{padding:'20px 22px',flex:1,minWidth:0}}>
          <div className='fu' ref={el=>{ if(el){ scrollTop(); } }}>{renderScreen}</div>
        </div>
      </div>

      <ToastContainer toasts={toasts}/>
    </div>
  );
};

// ═══════════════════════════════════════════
//  WORKER PORTAL
// ═══════════════════════════════════════════
const WorkerPortal = ({workers,setWorkers,loans,setLoans,customers,setCustomers,payments,leads,setLeads,interactions,setInteractions,auditLog,setAuditLog,onBack,dataLoaded,onOpenCustomerProfile}) => {
  const [loggedIn,setLoggedIn]=useState(false);
  const [curr,setCurr]=useState(null);
  const [email,setEmail]=useState('');
  const [pw,setPw]=useState('');
  const [err,setErr]=useState('');
  const {toasts,show:showToast}=useToast();
  const addAudit=(action,target,detail='')=>{
    const entry={ts:ts(),user:curr?.name||curr?.email||'Worker',action,target,detail};
    setAuditLog(l=>[entry,...l].slice(0,500));
    sbAuditInsert({
      ts: new Date().toISOString(),
      user_name: entry.user,
      action: entry.action,
      target_id: String(entry.target),
      detail: entry.detail
    }).catch(console.error);
  };

  const login=()=>{
    if(!email||!pw){setErr('Enter your email and password.');return;}
    import('@/config/supabaseClient').then(({supabase,DEMO_MODE})=>{
      // ── Supabase auth (production) ─────────────────────────
      if(!DEMO_MODE&&supabase){
        supabase.auth.signInWithPassword({email:email.trim(),password:pw})
          .then(({error})=>{
            if(error){setErr('Invalid credentials or inactive account.');try{SFX.error();}catch(e){}return;}
            // Auth passed — fetch worker profile from workers table
            supabase.from('workers').select('*').eq('email',email.trim()).single()
              .then(({data:workerRow,error:wErr})=>{
                if(wErr||!workerRow){setErr('Worker account not found. Contact admin.');try{SFX.error();}catch(e){}return;}
                if(workerRow.status!=='Active'){setErr('Your account is inactive. Contact admin.');try{SFX.error();}catch(e){}return;}
                // Merge Supabase row into workers state so UI can show it
                setWorkers(ws=>{
                  const exists=ws.find(w=>w.email===workerRow.email);
                  if(exists) return ws.map(w=>w.email===workerRow.email?{...w,...workerRow}:w);
                  return [...ws,workerRow];
                });
                const candidate={...workerRow,avatar:workerRow.avatar||(workerRow.name||'').split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase()};
                setCurr(candidate);setLoggedIn(true);
                addAudit('Worker Login',candidate.id,candidate.name);SFX.login();
              });
          });
        return;
      }
      // ── Demo/offline fallback — local hash check ──────────
      const candidate=workers.find(x=>x.email===email&&x.status==='Active');
      if(!candidate){setErr('Invalid credentials or inactive account.');try{SFX.error();}catch(e){};return;}
      checkPwAsync(pw,candidate.pwHash||'').then(ok=>{
        const legacyOk=!ok&&_checkPw(pw,candidate.pwHash||candidate.pw||'');
        if(ok||legacyOk){setCurr(candidate);setLoggedIn(true);addAudit('Worker Login',candidate.id,candidate.name);SFX.login();}
        else{setErr('Invalid credentials or inactive account.');try{SFX.error();}catch(e){};}
      }).catch(()=>{
        if(_checkPw(pw,candidate.pwHash||candidate.pw||'')){
          setCurr(candidate);setLoggedIn(true);addAudit('Worker Login',candidate.id,candidate.name);SFX.login();
        }else{setErr('Invalid credentials or inactive account.');try{SFX.error();}catch(e){};}
      });
    }).catch(()=>setErr('Login failed. Check your connection.'));
  };

  if(!loggedIn) return (
    <div style={{minHeight:'100vh',background:T.bg,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:T.body,padding:16}}>
      <div style={{background:T.card,border:`1px solid ${T.hi}`,borderRadius:20,padding:'40px 34px',width:'100%',maxWidth:380,boxShadow:'0 50px 90px #00000070'}}>
        <div style={{textAlign:'center',marginBottom:26}}>
          <div style={{fontFamily:T.head,color:T.accent,fontSize:22,fontWeight:900}}>Worker Portal</div>
          <div style={{color:T.muted,fontSize:12,marginTop:4}}>Adequate Capital Ltd</div>
        </div>
        {err&&<Alert type='danger'>{err}</Alert>}
        <FI label='Email' type='email' value={email} onChange={setEmail} placeholder='your.email@adequatecapital.co.ke'/>
        <FI label='Password' type='password' value={pw} onChange={setPw} placeholder='Your password'/>
        <Btn onClick={login} full>Sign In →</Btn>
        <div style={{height:1,background:T.border,margin:'18px 0'}}/>
        <button onClick={onBack} style={{display:'block',width:'100%',background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:'9px',color:T.muted,fontSize:12,cursor:'pointer',textAlign:'center'}}>← Back to Admin Login</button>
      </div>
    </div>
  );

  if (!dataLoaded) return (
    <div style={{minHeight:'100vh',background:'#080C14',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
      <div style={{width:40,height:40,border:'3px solid #1E2D45',borderTop:'3px solid #00D4AA',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
      <div style={{color:'#475569',fontSize:13,fontFamily:'system-ui'}}>Loading Workspace…</div>
    </div>
  );

  return (
    <div style={{minHeight:'100vh',background:T.bg}}>
      <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,padding:'10px 18px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{fontFamily:T.head,color:T.accent,fontWeight:900,fontSize:14}}>Adequate Capital — Worker Portal</div>
        <div style={{display:'flex',gap:9,alignItems:'center'}}>
          <Av ini={curr?.avatar||curr?.name[0]} size={26} color={T.accent}/>
          <span style={{color:T.dim,fontSize:13}}>{curr?.name}</span>
          <Btn sm v='ghost' onClick={()=>{setLoggedIn(false);setCurr(null);}}>Logout</Btn>
        </div>
      </div>
      <WorkerPanel worker={curr} workers={workers} setWorkers={setWorkers} loans={loans} payments={payments} customers={customers} leads={leads} allWorkers={workers} setCustomers={setCustomers} onSubmitLoan={l=>setLoans(ls=>[l,...ls])} setLeads={setLeads} interactions={interactions} setInteractions={setInteractions} addAudit={addAudit} showToast={showToast} onOpenCustomerProfile={onOpenCustomerProfile}/>
      <ToastContainer toasts={toasts}/>
    </div>
  );
};

// ═══════════════════════════════════════════
//  ADMIN LOGIN
// ═══════════════════════════════════════════
const _LOCK_KEY = '_acl_lockout';
const _LOCK_MS  = 15 * 60 * 1000;
const _getLockout    = () => { try { const v=JSON.parse(localStorage.getItem(_LOCK_KEY)||'null'); return (v&&Date.now()<v.until)?v:null; } catch(e){ return null; } };
const _recordFailure = () => { try { const v=JSON.parse(localStorage.getItem(_LOCK_KEY)||'null')||{count:0,until:0}; const c=(v.count||0)+1; const until=c>=3?Date.now()+_LOCK_MS:v.until; localStorage.setItem(_LOCK_KEY,JSON.stringify({count:c,until})); return c; } catch(e){ return 1; } };
const _clearLockout  = () => { try { localStorage.removeItem(_LOCK_KEY); } catch(e){} };

const AdminLogin = ({onLogin,onWorkerPortal}) => {
  const [lockout,setLockout]=useState(_getLockout);
  const locked=!!(lockout&&Date.now()<lockout.until);

  // ── Live countdown ─────────────────────────────────────────
  const [countdown,setCountdown]=useState(0);
  useEffect(()=>{
    if(!locked){setCountdown(0);return;}
    const tick=()=>{
      const rem=Math.max(0,Math.ceil((lockout.until-Date.now())/1000));
      setCountdown(rem);
      if(rem===0){setLockout(null);}
    };
    tick();
    const id=setInterval(tick,1000);
    return()=>clearInterval(id);
  },[locked,lockout]);
  const fmtCountdown=(s)=>{const m=Math.floor(s/60);const sec=s%60;return `${m}:${String(sec).padStart(2,'0')}`;}

  // ── Recovery flow ──────────────────────────────────────────
  const [showRecovery,setShowRecovery]=useState(false);
  const [recMethod,setRecMethod]=useState(''); // 'email' | 'sms'
  const [recCode,setRecCode]=useState('');
  const [recInput,setRecInput]=useState('');
  const [recErr,setRecErr]=useState('');
  const [recSent,setRecSent]=useState(false);

  const secCfgForRec=getSecConfig();
  const hasEmail=!!(secCfgForRec.adminEmail);
  const hasPhone=!!(secCfgForRec.adminRecoveryPhone||secCfgForRec.adminPhone);

  const sendRecoveryCode=(method)=>{
    const code=String(Math.floor(100000+Math.random()*900000));
    setRecCode(code);setRecInput('');setRecErr('');setRecSent(true);setRecMethod(method);
    // Production: send via email/SMS gateway
    // Demo: code shown inline
  };

  const verifyRecoveryCode=()=>{
    if(recInput.trim()!==recCode){setRecErr('Incorrect code. Try again.');return;}
    _clearLockout();setLockout(null);setShowRecovery(false);
    setRecCode('');setRecInput('');setRecSent(false);setRecErr('');
  };

  // ── Main login state ───────────────────────────────────────
  const [step,setStep]=useState(1);
  const [loginEmail,setLoginEmail]=useState('admin@adequatecapital.co.ke');
  const [pw,setPw]=useState('');
  const [err,setErr]=useState('');
  const [otpCode,setOtpCodeState]=useState(null);
  const [otpInput,setOtpInput]=useState('');
  const secCfg=getSecConfig();
  const enabledSteps=[];
  if(secCfg.passwordEnabled!==false) enabledSteps.push('Password');
  if(secCfg.biometricEnabled) enabledSteps.push('Biometric');
  // OTP login disabled — re-enable by uncommenting once SMS provider is configured:
  // if(secCfg.otpEnabled) enabledSteps.push('OTP');
  if(enabledSteps.length===0) enabledSteps.push('Password');

  const stepPw=()=>{
    if(locked)return;
    if(pw.length<4){setErr('Password too short.');return;}
    import('@/config/supabaseClient').then(({supabase,DEMO_MODE})=>{
      if(!DEMO_MODE&&supabase){
        supabase.auth.signInWithPassword({email:loginEmail.trim(),password:pw}).then(({error})=>{
          if(error){
            const c=_recordFailure();const lo=_getLockout();setLockout(lo);
            setErr(c>=3?'🔒 Too many failed attempts. Wait 15 min.':error.message||'Incorrect email or password.');
            try{SFX.error();}catch(e){}
            return;
          }
          setErr('');
          const nextStep=enabledSteps[1];
          if(!nextStep){_clearLockout();setLockout(null);onLogin(loginEmail.trim());}
          else setStep(2);
        });
        return;
      }
      // Demo/offline fallback
      const stored=secCfg.adminPwHash;
      const checkOk=stored
        ? checkPwAsync(pw,stored).catch(()=>Promise.resolve(_checkPw(pw,stored)))
        : Promise.resolve(pw===DEFAULT_ADMIN_PW);
      checkOk.then(ok=>{
        if(!ok){
          const c=_recordFailure();const lo=_getLockout();setLockout(lo);
          setErr(c>=3?'🔒 Too many failed attempts.':'Incorrect password.');
          try{SFX.error();}catch(e){}
          return;
        }
        setErr('');
        const nextStep=enabledSteps[1];
        if(!nextStep){_clearLockout();setLockout(null);onLogin();}
        else setStep(2);
      });
    }).catch(()=>{
      const stored=secCfg.adminPwHash;
      const ok=stored?_checkPw(pw,stored):pw===DEFAULT_ADMIN_PW;
      if(!ok){setErr('Incorrect password.');return;}
      setErr('');
      const nextStep=enabledSteps[1];
      if(!nextStep){_clearLockout();setLockout(null);onLogin();}
      else setStep(2);
    });
  };

  const stepBio=async()=>{
    try{
      if(!window.PublicKeyCredential) throw new Error('not supported');
      const challenge=crypto.getRandomValues(new Uint8Array(32));
      const credId=secCfg.bioCredId;
      const allowCreds=credId?[{type:'public-key',id:new Uint8Array(credId)}]:[];
      await navigator.credentials.get({publicKey:{challenge,allowCredentials:allowCreds,userVerification:'preferred',timeout:60000}});
      const nextStep=enabledSteps[2];
      if(!nextStep){_clearLockout();setLockout(null);onLogin(loginEmail.trim());}
      else setStep(3);
    }catch(e){
      setErr('Biometric failed or cancelled. Try again.');
      try{SFX.error();}catch(ex){}
    }
  };

  const sendOtp=()=>{
    const code=String(Math.floor(100000+Math.random()*900000));
    setOtpCodeState(code);setOtpInput('');
  };

  const stepTotp=()=>{
    if(!otpCode){setErr('Generate OTP code first.');return;}
    if(otpInput!==otpCode){
      const c=_recordFailure();const lo=_getLockout();setLockout(lo);
      setErr(c>=3?'🔒 Too many failed attempts.':'Invalid OTP code.');
      try{SFX.error();}catch(e){}
      return;
    }
    _clearLockout();setLockout(null);onLogin(loginEmail.trim());
  };

  useEffect(()=>{
    if(step===2&&enabledSteps[1]==='Biometric') stepBio();
    if(step===2&&enabledSteps[1]==='OTP') sendOtp();
    if(step===3&&enabledSteps[2]==='OTP') sendOtp();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[step]);

  const steps=enabledSteps;
  return (
    <div style={{minHeight:'100vh',background:T.bg,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:T.body,padding:16,position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',inset:0,backgroundImage:`radial-gradient(${T.accent}07 1px,transparent 1px)`,backgroundSize:'30px 30px',pointerEvents:'none'}}/>
      <div style={{background:T.card,border:`1px solid ${T.hi}`,borderRadius:20,padding:'40px 34px',width:'100%',maxWidth:420,position:'relative',boxShadow:'0 50px 90px #00000070'}}>
        <div style={{textAlign:'center',marginBottom:30}}>
          <div style={{fontFamily:T.head,color:T.accent,fontSize:26,fontWeight:900,letterSpacing:-1}}>Adequate Capital</div>
          <div style={{color:T.muted,fontSize:13,marginTop:4}}>Secure Admin Access</div>
        </div>

        {/* ── LOCKOUT STATE ─────────────────────── */}
        {locked&&!showRecovery&&(
          <div style={{textAlign:'center'}}>
            {/* Lock icon */}
            <div style={{width:72,height:72,borderRadius:99,background:T.dLo,border:`2px solid ${T.danger}40`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',fontSize:32}}>🔒</div>
            <div style={{color:T.danger,fontWeight:800,fontSize:16,fontFamily:T.head,marginBottom:6}}>Account Locked</div>
            <div style={{color:T.muted,fontSize:13,marginBottom:20}}>Too many failed attempts. Please wait or use account recovery.</div>

            {/* Countdown ring */}
            <div style={{position:'relative',width:110,height:110,margin:'0 auto 20px'}}>
              <svg width="110" height="110" style={{transform:'rotate(-90deg)'}}>
                <circle cx="55" cy="55" r="48" fill="none" stroke={T.border} strokeWidth="6"/>
                <circle cx="55" cy="55" r="48" fill="none" stroke={T.danger} strokeWidth="6"
                  strokeDasharray={`${2*Math.PI*48}`}
                  strokeDashoffset={`${2*Math.PI*48*(1-countdown/900)}`}
                  strokeLinecap="round"
                  style={{transition:'stroke-dashoffset 1s linear'}}/>
              </svg>
              <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                <div style={{color:T.danger,fontFamily:T.mono,fontSize:22,fontWeight:900,lineHeight:1}}>{fmtCountdown(countdown)}</div>
                <div style={{color:T.muted,fontSize:10,marginTop:3}}>remaining</div>
              </div>
            </div>

            <div style={{color:T.muted,fontSize:12,marginBottom:20}}>
              {countdown>0 ? `Unlocks automatically in ${fmtCountdown(countdown)}` : 'Lockout expired — you can try again now.'}
            </div>

            {/* Recovery options */}
            <div style={{background:T.surface,borderRadius:12,padding:'16px',marginBottom:16}}>
              <div style={{color:T.txt,fontWeight:700,fontSize:13,marginBottom:10}}>🆘 Recover Access Now</div>
              {!hasEmail&&!hasPhone&&(
                <div style={{color:T.muted,fontSize:12}}>No recovery contacts configured. Go to Security Settings after the lockout expires to add email or phone.</div>
              )}
              {(hasEmail||hasPhone)&&(
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {hasEmail&&(
                    <button onClick={()=>{setShowRecovery(true);sendRecoveryCode('email');}}
                      style={{background:T.bLo,border:`1px solid ${T.blue}38`,color:T.blue,borderRadius:9,padding:'10px 14px',cursor:'pointer',fontWeight:700,fontSize:13,display:'flex',alignItems:'center',gap:8}}>
                      📧 Send recovery code to email
                      <span style={{color:T.muted,fontSize:11,fontWeight:400}}>{secCfgForRec.adminEmail}</span>
                    </button>
                  )}
                  {hasPhone&&(
                    <button onClick={()=>{setShowRecovery(true);sendRecoveryCode('sms');}}
                      style={{background:T.oLo,border:`1px solid ${T.ok}38`,color:T.ok,borderRadius:9,padding:'10px 14px',cursor:'pointer',fontWeight:700,fontSize:13,display:'flex',alignItems:'center',gap:8}}>
                      📱 Send recovery code via SMS
                      <span style={{color:T.muted,fontSize:11,fontWeight:400}}>{secCfgForRec.adminRecoveryPhone||secCfgForRec.adminPhone}</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {countdown===0&&(
              <Btn full onClick={()=>{setErr('');setPw('');}}>Try Again →</Btn>
            )}
          </div>
        )}

        {/* ── RECOVERY CODE ENTRY ──────────────── */}
        {locked&&showRecovery&&(
          <div>
            <button onClick={()=>{setShowRecovery(false);setRecErr('');setRecSent(false);}}
              style={{background:'none',border:'none',color:T.muted,cursor:'pointer',fontSize:13,marginBottom:16,display:'flex',alignItems:'center',gap:5}}>
              ← Back
            </button>
            <div style={{textAlign:'center',marginBottom:20}}>
              <div style={{fontSize:32,marginBottom:10}}>{recMethod==='email'?'📧':'📱'}</div>
              <div style={{color:T.txt,fontWeight:800,fontSize:15,fontFamily:T.head,marginBottom:4}}>Enter Recovery Code</div>
              <div style={{color:T.muted,fontSize:12}}>
                {recMethod==='email'
                  ?`Code sent to ${secCfgForRec.adminEmail}`
                  :`Code sent to ${secCfgForRec.adminRecoveryPhone||secCfgForRec.adminPhone}`}
              </div>
            </div>

            {/* Demo: show the code */}
            {recSent&&recCode&&(
              <div style={{background:T.gLo,border:`1px solid ${T.gold}38`,borderRadius:10,padding:'12px',textAlign:'center',marginBottom:16}}>
                <div style={{color:T.muted,fontSize:11,marginBottom:4}}>Recovery Code (demo — sent to {recMethod==='email'?'email':'phone'})</div>
                <div style={{color:T.gold,fontFamily:T.mono,fontSize:28,fontWeight:900,letterSpacing:8}}>{recCode}</div>
              </div>
            )}

            <input
              value={recInput}
              onChange={e=>setRecInput(e.target.value.replace(/\D/g,'').slice(0,6))}
              placeholder='••••••'
              maxLength={6}
              style={{width:'100%',background:T.surface,border:`1px solid ${T.hi}`,borderRadius:10,padding:'13px',color:T.accent,fontSize:26,fontWeight:800,letterSpacing:12,textAlign:'center',outline:'none',marginBottom:7,boxSizing:'border-box'}}
            />
            {recErr&&<div style={{color:T.danger,fontSize:12,textAlign:'center',marginBottom:8}}>⚠ {recErr}</div>}
            <div style={{display:'flex',gap:8}}>
              <Btn full onClick={verifyRecoveryCode}>Verify & Unlock →</Btn>
              <Btn v='secondary' onClick={()=>sendRecoveryCode(recMethod)}>Resend</Btn>
            </div>
          </div>
        )}

        {/* ── NORMAL LOGIN ─────────────────────── */}
        {!locked&&(
          <>
            <div style={{display:'flex',justifyContent:'center',gap:4,marginBottom:24}}>
              {steps.map((s,i)=>{const done=step>i+1,active=step===i+1;return(
                <div key={s} style={{display:'flex',alignItems:'center',gap:4}}>
                  <div style={{width:24,height:24,borderRadius:99,background:done?T.accent:active?T.aMid:T.surface,border:`2px solid ${done||active?T.accent:T.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,color:done?'#060A10':active?T.accent:T.muted}}>
                    {done?'✓':i+1}
                  </div>
                  <span style={{fontSize:11,color:active?T.accent:T.muted,fontWeight:active?700:400}}>{s}</span>
                  {i<steps.length-1&&<span style={{color:T.border,margin:'0 1px'}}>›</span>}
                </div>
              );})}
            </div>
            {err&&<Alert type='danger' style={{marginBottom:12}}>⚠ {err}</Alert>}
            {step===1&&(
              <div>
                <FI label='Email' type='email' value={loginEmail} onChange={setLoginEmail} placeholder='admin@adequatecapital.co.ke'/>
                <FI label='Password' type='password' value={pw} onChange={setPw} placeholder='Enter your password'
                  hint='Session expires after 15 min'/>
                <Btn onClick={stepPw} full>Continue →</Btn>
              </div>
            )}
            {step===2&&enabledSteps[1]==='Biometric'&&(
              <div style={{textAlign:'center'}}>
                <div style={{background:T.aLo,border:`1px solid ${T.aMid}`,borderRadius:99,width:70,height:70,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 18px',fontSize:28}}>🪬</div>
                <div style={{color:T.txt,fontWeight:800,fontFamily:T.head,fontSize:15,marginBottom:7}}>Biometric Verification</div>
                <div style={{color:T.muted,fontSize:13,marginBottom:22}}>Fingerprint or Face ID · Follow your device prompt</div>
                <Btn onClick={stepBio} full>Retry Biometric</Btn>
              </div>
            )}
            {((step===2&&enabledSteps[1]==='OTP')||(step===3&&enabledSteps[2]==='OTP'))&&(
              <div>
                <div style={{textAlign:'center',marginBottom:18}}>
                  <div style={{color:T.txt,fontWeight:800,fontFamily:T.head,fontSize:15,marginBottom:5}}>One-Time Password</div>
                  <div style={{color:T.muted,fontSize:12}}>Code sent to: <b>{secCfg.adminPhone||'registered phone'}</b></div>
                </div>
                {otpCode&&(
                  <div style={{background:T.gLo,border:`1px solid ${T.gold}38`,borderRadius:10,padding:'12px',textAlign:'center',marginBottom:12}}>
                    <div style={{color:T.muted,fontSize:11,marginBottom:4}}>OTP Code (demo)</div>
                    <div style={{color:T.gold,fontFamily:T.mono,fontSize:28,fontWeight:900,letterSpacing:8}}>{otpCode}</div>
                  </div>
                )}
                <input value={otpInput} onChange={e=>setOtpInput(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder='••••••' maxLength={6}
                  style={{width:'100%',background:T.surface,border:`1px solid ${T.hi}`,borderRadius:10,padding:'13px',color:T.accent,fontSize:26,fontWeight:800,letterSpacing:12,textAlign:'center',outline:'none',marginBottom:7,boxSizing:'border-box'}}/>
                <div style={{display:'flex',gap:8,marginBottom:8}}><Btn v='secondary' onClick={sendOtp} full>Resend Code</Btn></div>
                <Btn onClick={stepTotp} full>Verify & Enter →</Btn>
              </div>
            )}
            <div style={{height:1,background:T.border,margin:'20px 0'}}/>
            <button onClick={onWorkerPortal} style={{display:'block',width:'100%',background:T.aLo,border:`1px solid ${T.aMid}`,borderRadius:10,padding:'11px',color:T.accent,fontSize:13,fontWeight:700,cursor:'pointer',textAlign:'center'}}>
              👷 Worker Portal Login →
            </button>
            <div style={{color:T.muted,fontSize:11,textAlign:'center',marginTop:11}}>3 failed attempts → 15 min lockout</div>
          </>
        )}
      </div>
    </div>
  );
};

// FIX D — Styles: the original Styles component re-rendered every time App re-rendered
// (on every state mutation: loan save, payment, navigation, etc.), causing the browser
// to re-parse the entire ~200-line CSS block each time. Wrapped in React.memo so React
// skips it on every re-render since it has no props that ever change.
const StylesMemo = memo(Styles);

// ═══════════════════════════════════════════
//  ROOT APP
// ═══════════════════════════════════════════
// Infrastructure symbols are imported and re-exported at the top of this file from ./lms-common

export default function App() {

  const [mode,setMode]=useState('admin-login');
  const [dataLoaded,setDataLoaded]=useState(false);

  const [loans,        setLoans]        = useState([]);
  const [customers,    setCustomers]    = useState([]);
  const [payments,     setPayments]     = useState([]);
  const [leads,        setLeads]        = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [workers,      setWorkers]      = useState(SEED_WORKERS); // keep — needed for login before Supabase loads
  const [auditLog,     setAuditLog]     = useState([]);

  // ISSUE 4 FIX: Global Customer Profile State
  const [globalCustomerId, setGlobalCustomerId] = useState(null);

  // ── Local cache (speed up first paint after login) ──────────────────────────
  const CACHE_KEY = 'acl_cache_v1';
  const readCache = () => {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch(e){ return null; }
  };
  const writeCache = (next) => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ...next, ts: Date.now() })); } catch(e){}
  };

  // ── Load all data from Supabase (after session is available) ──────────────────
  const loadAllData = useCallback(async () => {
    try {
      const { supabase, DEMO_MODE } = await import('@/config/supabaseClient');
      if (DEMO_MODE || !supabase) { setDataLoaded(true); return; }

      // Phase 1 (fast): load a small first page so UI populates quickly.
      const LOANS_FAST = 200;
      const CUSTOMERS_FAST = 200;
      const PAYMENTS_FAST = 500;
      const LOANS_MAX = 2000;
      const CUSTOMERS_PAGE = 200; // always page customers in 200s to avoid timeouts
      const CUSTOMERS_MAX = 2000;
      const PAYMENTS_MAX = 5000;

      const [lFast, cFast, pFast, wR] = await Promise.all([
        supabase.from('loans').select('*').order('created_at', { ascending: false }).range(0, LOANS_FAST - 1),
        supabase.from('customers').select('*').order('name').range(0, CUSTOMERS_FAST - 1),
        supabase.from('payments').select('*').order('date', { ascending: false }).range(0, PAYMENTS_FAST - 1),
        supabase.from('workers').select('*').order('name'),
      ]);

      const nextLoansFast = (!lFast.error && lFast.data?.length) ? lFast.data.map(fromSupabaseLoan) : [];
      if (lFast.error) console.error('[load loans]', lFast.error.message);
      const nextCustomersFast = (!cFast.error && cFast.data?.length) ? cFast.data.map(fromSupabaseCustomer) : [];
      if (cFast.error) console.error('[load customers]', cFast.error.message);
      const nextPaymentsFast = (!pFast.error && pFast.data?.length) ? pFast.data.map(fromSupabasePayment) : [];
      if (pFast.error) console.error('[load payments]', pFast.error.message);
      if (!wR.error && wR.data?.length) setWorkers(wR.data.map(w => ({ ...w, docs: w.docs || [], avatar: w.avatar || (w.name || '').split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase() })));
      else if (wR.error) console.error('[load workers]', wR.error.message);

      // Prevent wiping a warm cache when Supabase returns 0 rows unexpectedly (e.g., RLS)
      const cache = readCache();
      const hasWarm = !!(cache?.customers?.length || cache?.loans?.length || cache?.payments?.length);
      const allEmptyFast = nextLoansFast.length === 0 && nextCustomersFast.length === 0 && nextPaymentsFast.length === 0;
      const anyErrorFast = !!(lFast.error || cFast.error || pFast.error);

      if (!anyErrorFast && !(hasWarm && allEmptyFast)) {
        // Only update state if it would actually populate something or there is no warm cache.
        setLoans(nextLoansFast);
        setCustomers(nextCustomersFast);
        setPayments(nextPaymentsFast);
        writeCache({ loans: nextLoansFast, customers: nextCustomersFast, payments: nextPaymentsFast });
      } else if (hasWarm && allEmptyFast) {
        console.warn('[load] Supabase returned empty datasets; keeping cached data.');
      }

      // Backfill missing customers referenced by loans (preserves previous behavior)
      if (!lFast.error && !cFast.error) {
        const ll = lFast.data?.length ? lFast.data : [];
        const lc = cFast.data?.length ? cFast.data : [];
        const cids = new Set(lc.map(c => c.id));
        const missing = [];
        ll.forEach(l => {
          if (l.customer_id && !cids.has(l.customer_id)) {
            cids.add(l.customer_id);
            missing.push({
              id: l.customer_id, name: l.customer_name || 'Unknown', phone: l.phone || null,
              alt_phone: null, id_no: 'PENDING-' + l.customer_id,
              business: null, location: null, residence: null, officer: l.officer || null,
              loans: 1, risk: 'Medium', gender: null, dob: null, blacklisted: false,
              bl_reason: null, from_lead: null,
              n1_name: null, n1_phone: null, n1_relation: null,
              n2_name: null, n2_phone: null, n2_relation: null,
              n3_name: null, n3_phone: null, n3_relation: null, joined: l.disbursed || null
            });
          }
        });
        if (missing.length > 0) {
          console.warn('[load] Synthesized', missing.length, 'missing customer records from loan data.');
          setCustomers(cs => {
            const existingIds = new Set(cs.map(c => c.id));
            const toAdd = missing.filter(m => !existingIds.has(m.id)).map(fromSupabaseCustomer);
            return toAdd.length > 0 ? [...cs, ...toAdd] : cs;
          });
          supabase.from('customers').upsert(missing, { onConflict: 'id' })
            .then(({ error }) => { if (error) console.error('[backfill customers]', error.message); })
            .catch(() => {});
        }
      }

      setDataLoaded(true);

      // Phase 1b (background): fetch remaining data without heavy single queries.
      // - Loans/payments can still be fetched in one go
      // - Customers MUST be paged (200/page) to avoid "statement timeout" on order(name)
      setTimeout(() => {
        // Loans + payments (single query)
        Promise.all([
          supabase.from('loans').select('*').order('created_at', { ascending: false }).range(0, LOANS_MAX - 1),
          supabase.from('payments').select('*').order('date', { ascending: false }).range(0, PAYMENTS_MAX - 1),
        ]).then(([lFull, pFull]) => {
          const nextLoans = (!lFull.error && lFull.data?.length) ? lFull.data.map(fromSupabaseLoan) : [];
          if (lFull.error) console.error('[load loans full]', lFull.error.message);
          const nextPayments = (!pFull.error && pFull.data?.length) ? pFull.data.map(fromSupabasePayment) : [];
          if (pFull.error) console.error('[load payments full]', pFull.error.message);

          const cache2 = readCache();
          const hasWarm2 = !!(cache2?.customers?.length || cache2?.loans?.length || cache2?.payments?.length);
          const anyErrorFull = !!(lFull.error || pFull.error);
          const allEmptyFull = nextLoans.length === 0 && nextPayments.length === 0;
          if (!anyErrorFull && !(hasWarm2 && allEmptyFull)) {
            setLoans(nextLoans);
            setPayments(nextPayments);
            writeCache({
              loans: nextLoans,
              customers: (readCache()?.customers) || customers,
              payments: nextPayments,
            });
          }
        }).catch((err) => console.error('[load full loans/payments]', err?.message || err));

        // Customers (paged)
        (async () => {
          try {
            // Only start paging if the first page was "full" (likely more data exists)
            const firstPageCount = Array.isArray(cFast.data) ? cFast.data.length : 0;
            if (firstPageCount < CUSTOMERS_FAST) return;

            let offset = CUSTOMERS_FAST;
            let combined = nextCustomersFast.slice();
            // Fetch up to CUSTOMERS_MAX total
            while (combined.length < CUSTOMERS_MAX) {
              const { data, error } = await supabase
                .from('customers')
                .select('*')
                .order('name')
                .range(offset, offset + CUSTOMERS_PAGE - 1);

              if (error) { console.error('[load customers page]', error.message); break; }
              const page = (data && data.length) ? data.map(fromSupabaseCustomer) : [];
              if (page.length === 0) break;

              combined = combined.concat(page);
              offset += CUSTOMERS_PAGE;

              // Update progressively so categories populate gradually (not one big freeze)
              setCustomers(combined);
              writeCache({
                loans: (readCache()?.loans) || loans,
                customers: combined,
                payments: (readCache()?.payments) || payments,
              });

              // Yield to UI thread between pages
              await new Promise(r => setTimeout(r, 50));
            }
          } catch (e) {
            console.error('[load customers paged]', e?.message || e);
          }
        })();
      }, 300); // slight delay so first paint happens before background work

      // Phase 2: Lazy Load secondary data
      Promise.all([
        supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(1000),
        supabase.from('interactions').select('*').order('created_at', { ascending: false }).limit(2000),
        supabase.from('audit_log').select('*').order('ts', { ascending: false }).limit(500),
      ]).then(([ldR, iR, aR]) => {
        if (!ldR.error) setLeads(ldR.data?.length ? ldR.data.map(fromSupabaseLead) : []);
        else console.error('[load leads]', ldR.error.message);
        if (!iR.error) setInteractions(iR.data?.length ? iR.data.map(fromSupabaseInteraction) : []);
        else console.error('[load interactions]', iR.error.message);
        if (!aR.error && aR.data?.length) setAuditLog(aR.data.map(r => ({ ts: r.ts, user: r.user_name || 'system', action: r.action, target: r.target_id, detail: r.detail, device_type: r.device_type, browser: r.browser, os: r.os, ip_address: r.ip_address, country: r.country, city: r.city })));
        else if (aR.error) console.error('[load audit_log]', aR.error.message);
      }).catch(err => console.error('[lazy load fallback]', err.message));
    } catch (e) {
      console.error('[load] Failed to load from Supabase:', e?.message || e);
      // Don't flip to loaded on auth-less failures; allow re-attempt post-login
    }
  }, []);

  useEffect(() => {
    // React 18 StrictMode runs effects twice in dev; guard so we don't double-load.
    // (Production runs once.)
    const onceRef = (globalThis.__acl_load_once_ref ||= { ran: false });
    if (onceRef.ran) return;
    onceRef.ran = true;

    // Hydrate from cache immediately, then refresh from Supabase.
    const cache = readCache();
    if (cache) {
      if (Array.isArray(cache.loans) && cache.loans.length) setLoans(cache.loans);
      if (Array.isArray(cache.customers) && cache.customers.length) setCustomers(cache.customers);
      if (Array.isArray(cache.payments) && cache.payments.length) setPayments(cache.payments);
      if ((cache.loans?.length || cache.customers?.length || cache.payments?.length)) setDataLoaded(true);
    }

    // Attempt load (will refresh cache/state)
    loadAllData();
  }, [loadAllData]);

  const ADMIN_ROLES = ['admin', 'Admin'];
  const handleLogin = (email) => {
    SFX.login();
    import('@/config/supabaseClient').then(({supabase,DEMO_MODE})=>{
      if(!DEMO_MODE && supabase && email){
        // Render the app shell immediately after auth, then correct mode once role is known.
        // This avoids a long post-login blank screen caused by waiting on network calls.
        setMode('admin');
        // Now that auth succeeded, load the protected data immediately.
        // This restores customers/loans/payments that are hidden when unauthenticated.
        loadAllData();
        const currTs = new Date().toISOString();
        sbAuditInsert({
          ts: currTs,
          user_name: email.trim(),
          action: 'Admin Login',
          target_id: 'System',
          detail: 'Login successful via Admin Portal'
        }).catch(console.error);
        setAuditLog(l => [{ ts: ts(), user: email.trim(), action: 'Admin Login', target: 'System', detail: 'Login successful via Admin Portal' }, ...l].slice(0, 500));
        supabase.from('workers').select('role').eq('email', email.trim()).single()
          .then(({data,error})=>{
            const role = (!error&&data)?data.role:null;
            if (role && !ADMIN_ROLES.includes(role)) setMode('worker');
          }).catch(()=>{});
        return;
      }
      const w = SEED_WORKERS.find(w=>w.email===email?.trim());
      setMode(w&&!ADMIN_ROLES.includes(w.role)?'worker':'admin');
    }).catch(()=>setMode('admin'));
  };

  const shared={loans,setLoans,customers,setCustomers,workers,setWorkers,payments,setPayments,leads,setLeads,interactions,setInteractions,auditLog,setAuditLog,onOpenCustomerProfile: setGlobalCustomerId};

  return (
    <>
      <StylesMemo/>
      {mode==='admin-login'&&<AdminLogin onLogin={handleLogin} onWorkerPortal={()=>setMode('worker')}/>}
      {mode==='admin'&&dataLoaded&&<AdminPanel {...shared} onLogout={()=>setMode('admin-login')}/>}
      {mode==='worker'&&<WorkerPortal {...shared} dataLoaded={dataLoaded} onBack={()=>setMode('admin-login')}/>}

      {/* Global Customer Profile Overlay */}
      {globalCustomerId && (
        <CustomerProfile
          customerId={globalCustomerId}
          onSelectLoan={(row) => { setGlobalCustomerId(null); /* Could add navigation here later */ }}
          workerContext={{ role: 'admin', name: 'Admin' }}
          onClose={(e) => { if(e) e.stopPropagation(); setGlobalCustomerId(null); }}
          loans={loans} setLoans={setLoans}
          payments={payments} setPayments={setPayments}
          interactions={interactions} setInteractions={setInteractions}
          customers={customers} setCustomers={setCustomers}
          workers={workers} setWorkers={setWorkers}
          addAudit={(action, target, detail) => {
            const entry = { ts: ts(), user: 'admin', action, target, detail };
            setAuditLog(l => [entry, ...l].slice(0, 500));
            sbAuditInsert({
              ts: new Date().toISOString(),
              user_name: entry.user,
              action: entry.action,
              target_id: String(entry.target),
              detail: entry.detail
            }).catch(console.error);
          }}
        />

      )}
    </>
  );
}