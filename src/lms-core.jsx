// ADEQUATE CAPITAL LMS — App Shell (Modularized)
import { Lock, ShieldAlert, Mail, Smartphone, Check, Search as SearchIcon, ChevronRight, Menu, ChevronLeft, LogOut, Home } from 'lucide-react';
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

import React, { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback, memo } from "react";
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
  ForwardBtn,
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
  ForwardBtn,
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
import { useTheme } from "@/context/ThemeContext";

const AdminPanel = ({onLogout,loans,setLoans,customers,setCustomers,workers,setWorkers,payments,setPayments,leads,setLeads,interactions,setInteractions,auditLog,setAuditLog,unallocatedC2BCount,setUnallocatedC2BCount,onOpenCustomerProfile,onRefresh}) => {
  const { theme, toggleTheme } = useTheme();
  const [screen,setScreen]=useState('dashboard');
  const [searchParams, setSearchParams] = useSearchParams(); // MODIFIED
  const [screenHistory,setScreenHistory]=useState([]);
  const [forwardHistory, setForwardHistory] = useState([]);
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const [sb, setSb] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showReminders, setShowReminders] = useState(false);
  const toggleSb = () => isMobile ? setSb(o => !o) : setSideCollapsed(o => !o);

  const [adminUser, setAdminUser] = useState(() => {
    const saved = localStorage.getItem('lms_admin_profile');
    return saved ? JSON.parse(saved) : { name: 'Don', role: 'Super Admin', ini: 'DO' };
  });

  useEffect(() => {
    localStorage.setItem('lms_admin_profile', JSON.stringify(adminUser));
  }, [adminUser]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const scrollRef = useRef(null);
  const scrollTop = () => {
    try{ scrollRef.current?.scrollTo({top:0,behavior:'instant'}); }catch(e){}
    try{ window.scrollTo({top:0,behavior:'instant'}); }catch(e){}
  };
  const navTo=(s, params)=>{ 
    setScreenHistory(h=>[...h.slice(-9),screen]); 
    setForwardHistory([]);
    setScreen(s); 
    if (params) setSearchParams(params); // MODIFIED: Apply params to URL
    setSb(false); 
    scrollTop(); 
    setTimeout(scrollTop,50); 
  };
  const goBack=()=>{ if(screenHistory.length===0) return; const prev=screenHistory[screenHistory.length-1]; setForwardHistory(h=>[...h.slice(-9), screen]); setScreenHistory(h=>h.slice(0,-1)); setScreen(prev); setTimeout(scrollTop,30); };
  const goForward=()=>{ if(forwardHistory.length===0) return; const next=forwardHistory[forwardHistory.length-1]; setScreenHistory(h=>[...h.slice(-9), screen]); setForwardHistory(h=>h.slice(0,-1)); setScreen(next); setTimeout(scrollTop,30); };

  // Sequential nav — scrolls through ADMIN_NAV in order, regardless of visit history
  const _navIdx = ADMIN_NAV.findIndex(item => item.id === screen);
  const navPrev = () => { if (_navIdx <= 0) return; navTo(ADMIN_NAV[_navIdx - 1].id); };
  const navNext = () => { if (_navIdx < 0 || _navIdx >= ADMIN_NAV.length - 1) return; navTo(ADMIN_NAV[_navIdx + 1].id); };
  const canNavPrev = _navIdx > 0;
  const canNavNext = _navIdx >= 0 && _navIdx < ADMIN_NAV.length - 1;

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
    const entry = { ts: ts(), user: adminUser.name || 'Admin', action, target, detail };
    setAuditLog(l => [entry, ...l].slice(0, 10));
    sbAuditInsert({
      ts: new Date().toISOString(),
      user_name: entry.user,
      action: entry.action,
      target_id: String(entry.target),
      detail: entry.detail
    }).catch(console.error);
  }, [setAuditLog, adminUser.name]);

  const unalloc=useMemo(()=>payments.filter(p=>p.status==='Unallocated').length + (unallocatedC2BCount || 0),[payments, unallocatedC2BCount]);
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
  // Enhanced Navigation Item with Active Indicators and Categories
  const navItem = useCallback((item, index, array) => {
    const isFirstInSection = index === 0 || array[index - 1].cat !== item.cat;
    const isActive = screen === item.id;

    return (
      <React.Fragment key={item.id}>
        {isFirstInSection && (!sideCollapsed || isMobile) && (
          <div style={{
            fontSize: 10,
            fontWeight: 800,
            color: T.dim,
            textTransform: 'uppercase',
            letterSpacing: 1.2,
            padding: isMobile ? '12px 12px 4px' : '18px 12px 6px',
            opacity: 0.6
          }}>
            {item.cat}
          </div>
        )}
        <button onClick={() => navTo(item.id)} className='nb nav-item-new'
          title={sideCollapsed && !isMobile ? item.l : ''}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: sideCollapsed && !isMobile ? 'center' : 'flex-start', gap: sideCollapsed && !isMobile ? 0 : 12, width: '100%', padding: '10px 12px', borderRadius: 12, border: 'none',
            background: isActive ? `${item.c}12` : 'none',
            color: isActive ? T.txt : T.muted,
            cursor: 'pointer', fontSize: 13.5, fontWeight: isActive ? 700 : 500, marginBottom: 2, textAlign: 'left',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', flexShrink: 0, position: 'relative',
            overflow: 'hidden'
          }}>
          {isActive && !sideCollapsed && (
            <div style={{
              position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 3, 
              background: item.c, borderRadius: '0 4px 4px 0',
              boxShadow: `0 0 10px ${item.c}80`
            }} />
          )}
          <span style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            width: 32, height: 32, borderRadius: 10,
            background: isActive ? item.c : `${item.c}15`,
            color: isActive ? '#fff' : item.c,
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: isActive ? `0 8px 16px ${item.c}30` : 'none',
            border: `1px solid ${isActive ? 'transparent' : `${item.c}20`}`
          }}>
            <item.i size={16} strokeWidth={isActive ? 2.5 : 2} />
          </span>
          {(!sideCollapsed || isMobile) && (
            <>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isActive ? T.txt : T.dim, marginLeft: 2 }}>{item.l}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {item.id === 'payments' && unalloc > 0 && <span style={{ background: T.danger, color: '#fff', borderRadius: 6, padding: '2px 6px', fontSize: 10, fontWeight: 800, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>{unalloc}</span>}
                {item.id === 'collections' && overdue > 0 && <span style={{ background: T.dLo, color: T.danger, borderRadius: 6, padding: '2px 6px', fontSize: 10, fontWeight: 800, border: `1px solid ${T.danger}38` }}>{overdue}</span>}
                {item.id === 'loans' && pendingApprovals > 0 && <span style={{ background: T.gLo, color: T.gold, borderRadius: 6, padding: '2px 6px', fontSize: 10, fontWeight: 800, border: `1px solid ${T.gold}38` }}>{pendingApprovals}</span>}
              </div>
            </>
          )}
        </button>
      </React.Fragment>
    );
  }, [screen, navTo, unalloc, overdue, pendingApprovals]);

  const S={
    dashboard:  ()=><DashboardTab adminUser={adminUser} loans={loans} setLoans={setLoans} customers={customers} setCustomers={setCustomers} payments={payments} setPayments={setPayments} workers={workers} interactions={interactions} setInteractions={setInteractions} addAudit={addAudit} onNav={navTo} scrollTop={scrollTop} onOpenCustomerProfile={onOpenCustomerProfile} onRefresh={onRefresh}/>,
    calendar:   ()=><DueLoansCalendar loans={loans} payments={payments} workers={workers} workerContext={{role:'admin',name:'Admin'}} onOpenCustomerProfile={onOpenCustomerProfile} />,
    loans:      ()=><LoansTab loans={loans} setLoans={setLoans} customers={customers} setCustomers={setCustomers} payments={payments} setPayments={setPayments} interactions={interactions} setInteractions={setInteractions} workers={workers} addAudit={addAudit} showToast={showToast} onOpenCustomerProfile={onOpenCustomerProfile} onNav={navTo} onRefresh={onRefresh}/>,
    customers:  ()=><CustomersTab customers={customers} setCustomers={setCustomers} workers={workers} loans={loans} setLoans={setLoans} payments={payments} setPayments={setPayments} interactions={interactions} setInteractions={setInteractions} addAudit={addAudit} showToast={showToast} onOpenCustomerProfile={onOpenCustomerProfile} onRefresh={onRefresh}/>,
    leads:      ()=><LeadsTab leads={leads} setLeads={setLeads} workers={workers} customers={customers} setCustomers={setCustomers} loans={loans} addAudit={addAudit} showToast={showToast} onOpenCustomerProfile={onOpenCustomerProfile} onNav={navTo}/>, // MODIFIED: Added onNav
    collections:()=><CollectionsTab loans={loans} setLoans={setLoans} customers={customers} setCustomers={setCustomers} payments={payments} setPayments={setPayments} interactions={interactions} setInteractions={setInteractions} workers={workers} addAudit={addAudit} scrollTop={scrollTop} currentUser='Admin' onOpenCustomerProfile={onOpenCustomerProfile} onRefresh={onRefresh}/>,
    payments:   ()=><PaymentsTab payments={payments} setPayments={setPayments} loans={loans} setLoans={setLoans} customers={customers} setCustomers={setCustomers} interactions={interactions} setInteractions={setInteractions} workers={workers} addAudit={addAudit} showToast={showToast} onOpenCustomerProfile={onOpenCustomerProfile} onRefresh={onRefresh}/>,
    workers:    ()=><WorkersTab workers={workers} setWorkers={setWorkers} loans={loans} setLoans={setLoans} payments={payments} customers={customers} setCustomers={setCustomers} leads={leads} setLeads={setLeads} interactions={interactions} setInteractions={setInteractions} allState={allState} addAudit={addAudit} showToast={showToast} onOpenCustomerProfile={onOpenCustomerProfile} onRefresh={onRefresh}/>,
    securitysettings: ()=><SecuritySettingsTab adminUser={adminUser} setAdminUser={setAdminUser} auditLog={auditLog} addAudit={addAudit} showToast={showToast}/>,
    database:   ()=><DatabaseTab allState={allState} setLoans={setLoans} setCustomers={setCustomers} setPayments={setPayments} setWorkers={setWorkers} setLeads={setLeads} setInteractions={setInteractions} setAuditLog={setAuditLog} addAudit={addAudit} showToast={showToast}/>,
    reports:    ()=><ReportsTab loans={loans} customers={customers} payments={payments} workers={workers} auditLog={auditLog} showToast={showToast} addAudit={addAudit}/>,
    audit:      ()=><AuditTrailTab allState={allState} setAuditLog={setAuditLog} />,
    paymentshub: ()=><PaymentsHub customers={customers} setCustomers={setCustomers} loans={loans} payments={payments} setLoans={setLoans} setPayments={setPayments} addAudit={addAudit} showToast={showToast} unallocatedC2BCount={unallocatedC2BCount} setUnallocatedC2BCount={setUnallocatedC2BCount} />, // MODIFIED: Added Payments Hub
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
      <div onClick={()=>setSb(false)}
        style={{
          position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:5099,
          backdropFilter:'var(--glass-blur)',WebkitBackdropFilter:'var(--glass-blur)',
          opacity: sb ? 1 : 0, pointerEvents: sb ? 'auto' : 'none',
          transition: 'opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}/>

      {/* Sidebar — Persistent on Desktop, Overlay on Mobile */}
      <div className="main-sidebar glass" style={{
        position: isMobile ? 'fixed' : 'relative',
        top: 0, bottom: 0, left: 0,
        width: sideCollapsed && !isMobile ? 80 : 260,
        zIndex: 5100,
        height: isMobile ? '100dvh' : '100vh',
        transform: isMobile ? `translateX(${sb ? '0%' : '-100%'})` : 'none',
        transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), width 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s ease',
        boxShadow: (isMobile && sb) ? '20px 0 60px rgba(0,0,0,0.6)' : (!isMobile && !sideCollapsed) ? '4px 0 20px rgba(0,0,0,0.05)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden'
      }}>
        <div style={{ padding: sideCollapsed && !isMobile ? '15px 0' : '15px 14px 12px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: sideCollapsed && !isMobile ? 'center' : 'space-between', minHeight: 64, flexShrink: 0 }}>
          {(!sideCollapsed || isMobile) ? (
            <div style={{ fontFamily: T.head, color: T.accent, fontWeight: 900, fontSize: 13, letterSpacing: -.2, lineHeight: 1.2 }}>ADEQUATE<br />CAPITAL</div>
          ) : (
            <div style={{ fontFamily: T.head, color: T.accent, fontWeight: 900, fontSize: 18 }}>AC</div>
          )}
          {isMobile && (
            <button onClick={() => setSb(false)} aria-label="Close navigation menu" style={{ background: T.card2, border: `1px solid ${T.border}`, color: T.dim, borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
          )}
        </div>
        <nav id="sidebar-nav" aria-label="Main navigation" style={{ flex: 1, padding: '8px 12px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {ADMIN_NAV.map((item, idx) => navItem(item, idx, ADMIN_NAV))}
          <div style={{ height: 16 }} />
        </nav>
        {/* Sidebar Nav Controls: Home + Back/Forward scroll buttons */}
        <div style={{
          padding: sideCollapsed && !isMobile ? '10px 8px' : '10px 16px',
          borderTop: `1px solid ${T.border}`,
          borderBottom: `1px solid ${T.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: sideCollapsed && !isMobile ? 'center' : 'space-between',
          gap: 6,
          flexShrink: 0,
          background: 'rgba(255,255,255,0.015)',
        }}>
          {/* Home button */}
          <button
            id="sidebar-home-btn"
            onClick={() => navTo('dashboard')}
            title="Dashboard (Home)"
            aria-label="Go to Dashboard"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: sideCollapsed && !isMobile ? 0 : 7,
              flex: sideCollapsed && !isMobile ? '0 0 auto' : 1,
              height: 34,
              padding: sideCollapsed && !isMobile ? '0 9px' : '0 14px',
              borderRadius: 10,
              border: `1px solid ${screen === 'dashboard' ? T.accent + '50' : T.border}`,
              background: screen === 'dashboard' ? `${T.accent}15` : T.card2,
              color: screen === 'dashboard' ? T.accent : T.dim,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            <Home size={14} strokeWidth={screen === 'dashboard' ? 2.5 : 2} />
            {(!sideCollapsed || isMobile) && <span>Home</span>}
          </button>
          {/* Back / Forward — sequential scroll through all pages */}
          {(!sideCollapsed || isMobile) && (
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button
                id="sidebar-back-btn"
                onClick={navPrev}
                disabled={!canNavPrev}
                title={canNavPrev ? `Back to ${ADMIN_NAV[_navIdx - 1]?.l}` : 'First page'}
                aria-label="Previous page"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 34, borderRadius: 9,
                  border: `1px solid ${T.border}`,
                  background: T.card2,
                  color: canNavPrev ? T.txt : T.dim,
                  cursor: canNavPrev ? 'pointer' : 'not-allowed',
                  opacity: canNavPrev ? 1 : 0.35,
                  transition: 'all 0.2s',
                  flexShrink: 0,
                }}
              >
                <ChevronLeft size={16} strokeWidth={2.5} />
              </button>
              <button
                id="sidebar-forward-btn"
                onClick={navNext}
                disabled={!canNavNext}
                title={canNavNext ? `Next: ${ADMIN_NAV[_navIdx + 1]?.l}` : 'Last page'}
                aria-label="Next page"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 34, borderRadius: 9,
                  border: `1px solid ${T.border}`,
                  background: T.card2,
                  color: canNavNext ? T.txt : T.dim,
                  cursor: canNavNext ? 'pointer' : 'not-allowed',
                  opacity: canNavNext ? 1 : 0.35,
                  transition: 'all 0.2s',
                  flexShrink: 0,
                }}
              >
                <ChevronRight size={16} strokeWidth={2.5} />
              </button>
            </div>
          )}
          {/* Collapsed sidebar — Back/Forward stacked */}
          {sideCollapsed && !isMobile && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button
                onClick={navPrev}
                disabled={!canNavPrev}
                title={canNavPrev ? `Back to ${ADMIN_NAV[_navIdx - 1]?.l}` : 'First page'}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 28, borderRadius: 8,
                  border: `1px solid ${T.border}`, background: T.card2,
                  color: T.dim, cursor: canNavPrev ? 'pointer' : 'not-allowed',
                  opacity: canNavPrev ? 0.8 : 0.3, transition: 'all 0.2s',
                }}
              >
                <ChevronLeft size={14} strokeWidth={2.5} />
              </button>
              <button
                onClick={navNext}
                disabled={!canNavNext}
                title={canNavNext ? `Next: ${ADMIN_NAV[_navIdx + 1]?.l}` : 'Last page'}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 28, borderRadius: 8,
                  border: `1px solid ${T.border}`, background: T.card2,
                  color: T.dim, cursor: canNavNext ? 'pointer' : 'not-allowed',
                  opacity: canNavNext ? 0.8 : 0.3, transition: 'all 0.2s',
                }}
              >
                <ChevronRight size={14} strokeWidth={2.5} />
              </button>
            </div>
          )}
        </div>
        <div style={{ 
          padding: sideCollapsed && !isMobile ? '16px 8px' : '16px 16px calc(16px + env(safe-area-inset-bottom))', 
          borderTop: `1px solid ${T.border}`, 
          flexShrink: 0, 
          background: 'rgba(255,255,255,0.02)' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: sideCollapsed && !isMobile ? 'center' : 'flex-start', gap: 12, marginBottom: 16, padding: sideCollapsed && !isMobile ? 0 : '0 8px' }}>
             <Av ini={adminUser.ini || 'AD'} size={sideCollapsed && !isMobile ? 40 : 36} color={T.accent} />
             {(!sideCollapsed || isMobile) && (
               <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: T.txt, fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{adminUser.name}</div>
                  <div style={{ color: T.dim, fontSize: 11, fontWeight: 600 }}>{adminUser.role}</div>
               </div>
             )}
          </div>
          <button onClick={onLogout} className='nb' title={sideCollapsed && !isMobile ? 'Logout' : ''} style={{ display: 'flex', alignItems: 'center', justifyContent: sideCollapsed && !isMobile ? 'center' : 'flex-start', gap: 10, width: '100%', padding: '10px 12px', borderRadius: 12, border: 'none', background: `${T.danger}10`, color: T.danger, cursor: 'pointer', fontSize: 13, fontWeight: 700, transition: 'all 0.2s' }}>
            <LogOut size={16} />
            {(!sideCollapsed || isMobile) && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Main content — always full width, never shifts */}
      <div ref={scrollRef} className='main-scroll' style={{flex:1,display:'flex',flexDirection:'column',minWidth:0}}>
        {/* Topbar */}
        <div className="glass" style={{padding:'10px 14px',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,zIndex:5000,flexShrink:0,gap:8}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <button onClick={toggleSb} aria-label={isMobile ? "Open navigation menu" : sideCollapsed ? "Expand sidebar" : "Collapse sidebar"} style={{ background: 'none', border: `1px solid ${T.border}`, color: T.dim, cursor: 'pointer', fontSize: 16, padding: '5px 9px', borderRadius: 8, lineHeight: 1, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 34 }}>
              {isMobile ? <Menu size={18} /> : sideCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>

            <RefreshBtn onRefresh={()=>{ scrollTop(); navTo(screen); }}/>
          </div>
          <div className="topbar-actions" style={{display:'flex',gap:7,alignItems:'center'}}>
            <button onClick={() => setShowSearch(true)} aria-label="Global Search" style={{background:T.card2,border:`1px solid ${T.border}`,color:T.dim,borderRadius:9,padding:'5px 10px',fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',width:36,height:34}}>
              <SearchIcon size={16}/>
            </button>

            <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle Theme" style={{background:T.card2,border:`1px solid ${T.border}`,color:T.dim,borderRadius:9,padding:'5px 10px',fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',width:36,height:34}}>
              {theme === 'dark' ? '🌙' : theme === 'dim' ? '🌓' : '☀️'}
            </button>

            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', gap: isMobile ? 4 : 7 }}>
              <button 
                onClick={()=>{setShowReminders(s=>!s);SFX.notify();}} 
                aria-label={'Notifications'} 
                aria-expanded={showReminders} 
                aria-haspopup="dialog" 
                style={{
                  background:showReminders?T.aLo:T.card2,
                  border:`1px solid ${showReminders?T.accent:T.border}`,
                  color:showReminders?T.accent:T.muted,
                  borderRadius:9,padding:'5px 10px',fontSize:14,height: 34, width: 36, 
                  cursor:'pointer',position:'relative',display:'flex',alignItems:'center',justifyContent: 'center',gap:5
                }}
              >
                <span aria-hidden="true">🔔</span>
                {(activeReminderCount + unalloc) > 0 && (
                  <span style={{
                    position:'absolute',top:-4,right:-4,
                    background: T.danger,
                    borderRadius:99,minWidth:14,height:14,padding:'0 4px',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:8,fontWeight:900,color:'#fff',boxShadow: '0 0 0 2px #060A10'
                  }}>
                    {activeReminderCount + unalloc}
                  </span>
                )}
              </button>

              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 2 : 7, alignItems: 'center' }}>
                {pendingApprovals > 0 && (
                  <button 
                    onClick={() => navTo('loans')} 
                    style={{ 
                      background: T.gLo, border: `1px solid ${T.gold}38`, borderRadius: 9, 
                      padding: '0 12px', color: T.gold, fontSize: isMobile ? 9 : 11, height: 34, minWidth: 34,
                      fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    {pendingApprovals}
                  </button>
                )}
                {overdue > 0 && (
                  <button 
                    onClick={() => navTo('collections')} 
                    style={{ 
                      background: T.dLo, border: `1px solid ${T.danger}38`, borderRadius: 9, 
                      padding: '0 12px', color: T.danger, fontSize: isMobile ? 9 : 11, height: 34, minWidth: 34,
                      fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' 
                    }}
                  >
                    {overdue}{!isMobile && ' Overdue'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        {firingReminder&&<ReminderAlertModal reminder={firingReminder} onDismiss={dismissFiring} onDone={doneReminder}/>}
        {showReminders&&<RemindersPanel reminders={reminders} unallocatedCount={unalloc} loans={loans} customers={customers} payments={payments} onAction={navTo} onAdd={addReminder} onDone={doneReminder} onRemove={removeReminder} onUpdate={updateReminder} onClose={()=>setShowReminders(false)}/>}
        {showSearch && <CommandCenter customers={customers} onClose={() => setShowSearch(false)} onSelect={onOpenCustomerProfile} />}
        <div id="main-content" className='admin-content' style={{ padding: '20px 22px', flex: 1, minWidth: 0 }}>
          <div key={screen} className='fu screen-fade-in' ref={el => { if (el) { scrollTop(); } }}>{renderScreen}</div>
        </div>
      </div>

      <style>{`
        .fu { animation: fadeUp .8s cubic-bezier(.22,1,.36,1) both; }
        .fu1, .fu2, .fu3, .fu4, .fu5 { animation-delay: 0s !important; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px) scale(0.99); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .nav-item-new:hover {
          background: rgba(255,255,255,0.05) !important;
        }
        .nav-item-new:active {
          transform: scale(0.98);
        }
      `}</style>

      <ToastContainer toasts={toasts}/>
    </div>
  );
};

// ═══════════════════════════════════════════
//  WORKER PORTAL
// ═══════════════════════════════════════════
const WorkerPortal = ({workers,setWorkers,loans,setLoans,customers,setCustomers,payments,setPayments,leads,setLeads,interactions,setInteractions,auditLog,setAuditLog,onBack,dataLoaded,onOpenCustomerProfile,unallocatedC2BCount,setUnallocatedC2BCount}) => {
  const { theme, toggleTheme } = useTheme();
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

  const [loading,setLoading]=useState(false);

  const login=()=>{
    if(!email||!pw){setErr('Enter your email and password.');return;}
    setLoading(true);
    import('@/config/supabaseClient').then(({supabase,DEMO_MODE})=>{
      // ── Supabase auth (production) ─────────────────────────
      if(!DEMO_MODE&&supabase){
        supabase.auth.signInWithPassword({email:email.trim(),password:pw})
          .then(({error})=>{
            if(error){
              setErr('Invalid credentials or inactive account.');
              setLoading(false);
              try{SFX.error();}catch(e){}
              return;
            }
            // Auth passed — fetch worker profile from workers table
            supabase.from('workers').select('*').eq('email',email.trim()).single()
              .then(({data:workerRow,error:wErr})=>{
                if(wErr||!workerRow){
                  setErr('Worker account not found. Contact admin.');
                  setLoading(false);
                  try{SFX.error();}catch(e){}
                  return;
                }
                if(workerRow.status!=='Active'){
                  setErr('Your account is inactive. Contact admin.');
                  setLoading(false);
                  try{SFX.error();}catch(e){}
                  return;
                }
                // Merge Supabase row into workers state so UI can show it
                setWorkers(ws=>{
                  const exists=ws.find(w=>w.email===workerRow.email);
                  if(exists) return ws.map(w=>w.email===workerRow.email?{...w,...workerRow}:w);
                  return [...ws,workerRow];
                });
                const candidate={...workerRow,avatar:workerRow.avatar||(workerRow.name||'').split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase()};
                setCurr(candidate);setLoggedIn(true);
                addAudit('Worker Login',candidate.id,candidate.name);SFX.login();
                // Note: loading state will be "cleared" by loggedIn changing, but we can set it to false too
                setLoading(false);
              }).catch(() => { setLoading(false); setErr('Account verification failed.'); });
          }).catch(err => { setLoading(false); setErr(err.message || 'Login failed.'); });
        return;
      }
      // ── Demo/offline fallback — local hash check ──────────
      const candidate=workers.find(x=>x.email===email&&x.status==='Active');
      if(!candidate){setErr('Invalid credentials or inactive account.');setLoading(false);try{SFX.error();}catch(e){};return;}
      checkPwAsync(pw,candidate.pwHash||'').then(ok=>{
        const legacyOk=!ok&&_checkPw(pw,candidate.pwHash||candidate.pw||'');
        if(ok||legacyOk){setCurr(candidate);setLoggedIn(true);addAudit('Worker Login',candidate.id,candidate.name);SFX.login();}
        else{setErr('Invalid credentials or inactive account.');try{SFX.error();}catch(e){};}
        setLoading(false);
      }).catch(()=>{
        if(_checkPw(pw,candidate.pwHash||candidate.pw||'')){
          setCurr(candidate);setLoggedIn(true);addAudit('Worker Login',candidate.id,candidate.name);SFX.login();
        }else{setErr('Invalid credentials or inactive account.');try{SFX.error();}catch(e){};}
        setLoading(false);
      });
    }).catch(()=> { setErr('Login failed. Check your connection.'); setLoading(false); });
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
        <Btn onClick={login} loading={loading} full>Sign In →</Btn>
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
          <button onClick={toggleTheme} aria-label="Toggle Theme" style={{background:T.card2,border:`1px solid ${T.border}`,color:T.muted,borderRadius:8,padding:'4px 8px',fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',gap:5,marginRight:4}}>
            <span>{theme === 'dark' ? '🌙' : theme === 'dim' ? '🌓' : '☀️'}</span>
            <span style={{fontSize:10,fontWeight:700,opacity:0.8}}>{theme.charAt(0).toUpperCase()+theme.slice(1)}</span>
          </button>
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
  const [loading,setLoading]=useState(false);
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
    setLoading(true);
    import('@/config/supabaseClient').then(({supabase,DEMO_MODE})=>{
      if(!DEMO_MODE&&supabase){
        supabase.auth.signInWithPassword({email:loginEmail.trim(),password:pw}).then(({error})=>{
          if(error){
            const c=_recordFailure();const lo=_getLockout();setLockout(lo);
            setErr(c>=3?<span style={{display:'inline-flex',alignItems:'center',gap:4}}><Lock size={14}/> Too many failed attempts. Wait 15 min.</span>:error.message||'Incorrect email or password.');
            setLoading(false);
            try{SFX.error();}catch(e){}
            return;
          }
          setErr('');
          const nextStep=enabledSteps[1];
          if(!nextStep){_clearLockout();setLockout(null);onLogin(loginEmail.trim());}
          else { setStep(2); setLoading(false); }
        }).catch(err => {
          setErr(err.message || 'Connection failed.');
          setLoading(false);
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
          setErr(c>=3?<span style={{display:'inline-flex',alignItems:'center',gap:4}}><Lock size={14}/> Too many failed attempts.</span>:'Incorrect password.');
          setLoading(false);
          try{SFX.error();}catch(e){}
          return;
        }
        setErr('');
        const nextStep=enabledSteps[1];
        if(!nextStep){_clearLockout();setLockout(null);onLogin();}
        else { setStep(2); setLoading(false); }
      });
    }).catch(()=>{
      const stored=secCfg.adminPwHash;
      const ok=stored?_checkPw(pw,stored):pw===DEFAULT_ADMIN_PW;
      if(!ok){setErr('Incorrect password.');setLoading(false);return;}
      setErr('');
      const nextStep=enabledSteps[1];
      if(!nextStep){_clearLockout();setLockout(null);onLogin();}
      else { setStep(2); setLoading(false); }
    });
  };

  const stepBio=async()=>{
    try{
      setLoading(true);
      if(!window.PublicKeyCredential) throw new Error('not supported');
      const challenge=crypto.getRandomValues(new Uint8Array(32));
      const credId=secCfg.bioCredId;
      const allowCreds=credId?[{type:'public-key',id:new Uint8Array(credId)}]:[];
      await navigator.credentials.get({publicKey:{challenge,allowCredentials:allowCreds,userVerification:'preferred',timeout:60000}});
      const nextStep=enabledSteps[2];
      if(!nextStep){_clearLockout();setLockout(null);onLogin(loginEmail.trim());}
      else { setStep(3); setLoading(false); }
    }catch(e){
      setErr('Biometric failed or cancelled. Try again.');
      setLoading(false);
      try{SFX.error();}catch(ex){}
    }
  };

  const sendOtp=()=>{
    const code=String(Math.floor(100000+Math.random()*900000));
    setOtpCodeState(code);setOtpInput('');
  };

  const stepTotp = () => {
    setLoading(true);
    if (!otpCode) { setErr('Generate OTP code first.'); setLoading(false); return; }
    if (otpInput !== otpCode) {
      const c = _recordFailure(); const lo = _getLockout(); setLockout(lo);
      setErr(c >= 3 ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Lock size={14} /> Too many failed attempts.</span> : 'Invalid OTP code.');
      setLoading(false);
      try { SFX.error(); } catch (e) { }
      return;
    }
    _clearLockout(); setLockout(null); onLogin(loginEmail.trim());
  };

  useEffect(() => {
    if (step === 2 && enabledSteps[1] === 'Biometric') stepBio();
    if (step === 2 && enabledSteps[1] === 'OTP') sendOtp();
    if (step === 3 && enabledSteps[2] === 'OTP') sendOtp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const steps = enabledSteps;
  return (
    <div style={{ minHeight: '100vh', background: '#02060C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.body, padding: 16, position: 'relative', overflow: 'hidden' }}>

      {/* Animated Immersive Background Elements */}
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '40%', height: '40%', background: `radial-gradient(circle, ${T.accent}15 0%, transparent 70%)`, filter: 'blur(80px)', animation: 'float 20s infinite alternate', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '45%', height: '45%', background: `radial-gradient(circle, ${T.gold}10 0%, transparent 70%)`, filter: 'blur(100px)', animation: 'float 25s infinite alternate-reverse', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '20%', right: '10%', width: '30%', height: '30%', background: `radial-gradient(circle, ${T.blue}10 0%, transparent 70%)`, filter: 'blur(90px)', animation: 'float 18s infinite alternate', pointerEvents: 'none' }} />

      <style>{`
        @keyframes float {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(40px, 40px) scale(1.1); }
        }
        .login-card {
           background: rgba(13, 20, 33, 0.65);
           backdrop-filter: blur(24px);
           -webkit-backdrop-filter: blur(24px);
           border: 1px solid rgba(255, 255, 255, 0.08);
           border-top: 1px solid rgba(255, 255, 255, 0.15);
           box-shadow: 0 40px 100px rgba(0,0,0,0.6);
           width: 100%;
           max-width: 420px;
           border-radius: 32px;
           padding: 48px 40px;
           position: relative;
           z-index: 10;
        }
        .login-input {
           transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .login-input:focus {
           border-color: var(--accent) !important;
           box-shadow: 0 0 0 4px rgba(0, 212, 170, 0.15) !important;
        }
      `}</style>

      <div className="login-card pop">
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
             <div style={{ width: 64, height: 64, borderRadius: 20, background: `linear-gradient(135deg, ${T.accent}, #00BFA5)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 20px 40px ${T.accent}30` }}>
                <Lock size={32} color="#000" strokeWidth={2.5} />
             </div>
          </div>
          <div style={{ fontFamily: T.head, color: '#fff', fontSize: 32, fontWeight: 900, letterSpacing: '-0.04em' }}>Adequate</div>
          <div style={{ color: T.accent, fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2, marginTop: -2 }}>Secure Portal</div>
        </div>

        {/* ── LOCKOUT STATE ─────────────────────── */}
        {locked && !showRecovery && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: T.danger, fontWeight: 900, fontSize: 18, fontFamily: T.head, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
               <ShieldAlert size={20} /> Access Restricted
            </div>
            <div style={{ color: T.dim, fontSize: 14, marginBottom: 28, lineHeight: 1.5 }}>Too many failed attempts. Security protocol activated.</div>

            {/* Countdown ring */}
            <div style={{ position: 'relative', width: 130, height: 130, margin: '0 auto 24px' }}>
              <svg width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="65" cy="65" r="58" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                <circle cx="65" cy="65" r="58" fill="none" stroke={T.danger} strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 58}`}
                  strokeDashoffset={`${2 * Math.PI * 58 * (1 - countdown / 900)}`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 1s linear' }} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ color: T.danger, fontFamily: T.mono, fontSize: 26, fontWeight: 900, lineHeight: 1 }}>{fmtCountdown(countdown)}</div>
                <div style={{ color: T.dim, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>Locked</div>
              </div>
            </div>

            <div style={{ color: T.dim, fontSize: 13, marginBottom: 20 }}>
              {countdown > 0 ? `Unlocks automatically in ${fmtCountdown(countdown)}` : 'Lockout expired — you can try again now.'}
            </div>

            {/* Recovery options */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '20px', marginBottom: 20 }}>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 14, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><ShieldAlert size={16} color={T.accent} /> Recover Access Now</div>
              {!hasEmail && !hasPhone && (
                <div style={{ color: T.dim, fontSize: 12 }}>No recovery contacts configured. Contact system administrator.</div>
              )}
              {(hasEmail || hasPhone) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {hasEmail && (
                    <button onClick={() => { setShowRecovery(true); sendRecoveryCode('email'); }}
                      style={{ background: `${T.accent}15`, border: `1px solid ${T.accent}30`, color: T.accent, borderRadius: 12, padding: '12px', cursor: 'pointer', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <Mail size={16} /> Restore via Email
                    </button>
                  )}
                  {hasPhone && (
                    <button onClick={() => { setShowRecovery(true); sendRecoveryCode('sms'); }}
                      style={{ background: `${T.gold}15`, border: `1px solid ${T.gold}30`, color: T.gold, borderRadius: 12, padding: '12px', cursor: 'pointer', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <Smartphone size={16} /> Restore via SMS
                    </button>
                  )}
                </div>
              )}
            </div>

            {countdown === 0 && (
              <Btn full onClick={() => { setErr(''); setPw(''); }}>Try Again Now →</Btn>
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
              <div style={{display:'flex',justifyContent:'center',marginBottom:10}}>{recMethod==='email'?<Mail size={32}/>:<Smartphone size={32}/>}</div>
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
              <Btn full loading={loading} onClick={verifyRecoveryCode}>Verify & Unlock →</Btn>
              <Btn v='secondary' onClick={()=>sendRecoveryCode(recMethod)}>Resend</Btn>
            </div>
          </div>
        )}

        {/* ── NORMAL LOGIN ─────────────────────── */}
        {!locked && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 32 }}>
              {steps.map((s, i) => {
                const done = step > i + 1, active = step === i + 1;
                return (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 10,
                      background: done ? T.accent : active ? `${T.accent}20` : 'transparent',
                      border: `1.5px solid ${done || active ? T.accent : 'rgba(255,255,255,0.1)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 900, color: done ? '#000' : active ? T.accent : T.dim,
                      transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                    }}>
                      {done ? <Check size={14} strokeWidth={3} /> : i + 1}
                    </div>
                    {active && <span style={{ fontSize: 12, color: T.txt, fontWeight: 800, letterSpacing: -0.2 }}>{s}</span>}
                  </div>
                );
              })}
            </div>
            {err && <Alert type='danger' style={{ marginBottom: 20, borderRadius: 14 }}>⚠ {err}</Alert>}
            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <FI label='Credential Email' type='email' value={loginEmail} onChange={setLoginEmail} placeholder='admin@adequatecapital.co.ke'
                   onKeyDown={(e) => { if (e.key === 'Enter' && !loading) stepPw(); }} />
                <FI label='System Password' type='password' value={pw} onChange={setPw} placeholder='••••••••'
                   hint='Secure encrypted connection'
                   onKeyDown={(e) => { if (e.key === 'Enter' && !loading) stepPw(); }} />
                <Btn onClick={stepPw} loading={loading} full style={{ height: 52, borderRadius: 16, fontSize: 16, fontWeight: 850 }}>
                   Sign In <ChevronRight size={18} style={{ marginLeft: 4 }} />
                </Btn>
              </div>
            )}
            {step===2&&enabledSteps[1]==='Biometric'&&(
              <div style={{textAlign:'center'}}>
                <div style={{background:T.aLo,border:`1px solid ${T.aMid}`,borderRadius:99,width:70,height:70,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 18px',fontSize:28}}>🪬</div>
                <div style={{color:T.txt,fontWeight:800,fontFamily:T.head,fontSize:15,marginBottom:7}}>Biometric Verification</div>
                <div style={{color:T.muted,fontSize:13,marginBottom:22}}>Fingerprint or Face ID · Follow your device prompt</div>
                <Btn onClick={stepBio} loading={loading} full>Retry Biometric</Btn>
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
                  onKeyDown={e => { if(e.key === 'Enter' && !loading) stepTotp(); }}
                  style={{width:'100%',background:T.surface,border:`1px solid ${T.hi}`,borderRadius:10,padding:'13px',color:T.accent,fontSize:26,fontWeight:800,letterSpacing:12,textAlign:'center',outline:'none',marginBottom:7,boxSizing:'border-box'}}/>
                <div style={{display:'flex',gap:8,marginBottom:8}}><Btn v='secondary' onClick={sendOtp} full>Resend Code</Btn></div>
                <Btn onClick={stepTotp} loading={loading} full>Verify & Enter →</Btn>
              </div>
            )}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '28px 0' }} />
            <button
              onClick={onWorkerPortal}
              className="hover-pop"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '14px', color: T.accent, fontSize: 13, fontWeight: 800, cursor: 'pointer', transition: 'all 0.3s' }}
            >
              👷 Access Worker Portal <ChevronRight size={16} />
            </button>
            <div style={{ color: T.dim, fontSize: 11, textAlign: 'center', marginTop: 16, fontWeight: 500 }}>
               Protected by AES-256 standard encryption
            </div>
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

let _hasLoadedDataGlobal = false;

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
  const [unallocatedC2BCount, setUnallocatedC2BCount] = useState(0);

  // ISSUE 4 FIX: Global Customer Profile State
  const [globalCustomerId, setGlobalCustomerId] = useState(null);

  // ── Local cache (speed up first paint after login) ──────────────────────────
  const CACHE_KEY = 'acl_cache_v2'; // bumped — forces fresh fetch, discards stale loan snapshots
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
      const CUSTOMERS_PAGE = 200; 
      const CUSTOMERS_MAX = 2000;
      const PAYMENTS_MAX = 5000;
      const CACHE_TTL = 180000; // 3 minutes in ms

      const [lFast, cFast, pFast, wR, unallocR] = await Promise.all([
        supabase.from('loans').select('id,customer_id,customer_name,amount,balance,status,repayment_type,officer,risk,disbursed,mpesa,phone,days_overdue,created_at').order('created_at', { ascending: false }).range(0, LOANS_FAST - 1),
        // OPTIMIZED: Fetch only essential searchable/navigable fields for global state. Full profiles load lazily in CustomerProfile.
        supabase.from('customers').select('id,name,phone,id_no,officer,loans,risk,blacklisted,joined,status,assigned_officer,mpesa_registered').order('name', { ascending: true }).range(0, CUSTOMERS_FAST - 1),
        supabase.from('payments').select('id,loan_id,customer_id,customer_name,amount,mpesa,date,status,allocated_by,is_reg_fee').order('date', { ascending: false }).range(0, PAYMENTS_FAST - 1),
        supabase.from('workers').select('id,name,email,phone,role,status').order('name'),
        supabase.from('unallocated_payments').select('*', { count: 'exact', head: true }).eq('status', 'Unallocated'),
      ]);
      if (!unallocR.error) setUnallocatedC2BCount(unallocR.count || 0);

      const nextLoansFast = (!lFast.error && lFast.data?.length) ? lFast.data.map(fromSupabaseLoan) : [];
      if (lFast.error) console.error('[load loans]', lFast.error.message);
      const nextCustomersFast = (!cFast.error && cFast.data?.length) ? cFast.data.map(fromSupabaseCustomer) : [];
      if (cFast.error) console.error('[load customers]', cFast.error.message);
      const nextPaymentsFast = (!pFast.error && pFast.data?.length) ? pFast.data.map(fromSupabasePayment) : [];
      if (pFast.error) console.error('[load payments]', pFast.error.message);
      if (!wR.error && wR.data?.length) setWorkers(wR.data.map(w => ({ ...w, docs: w.docs || [], avatar: w.avatar || (w.name || '').split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase() })));
      else if (wR.error) console.error('[load workers]', wR.error.message);

      // Guard each table independently against RLS returning 0 rows when the cache has data.
      // Previously only an all-three-empty scenario triggered the guard, meaning
      // a partial failure (e.g., loans OK but customers blocked by RLS) would
      // silently overwrite the customers cache with an empty array.
      const cache = readCache();
      const hasWarmLoans = !!(cache?.loans?.length);
      const hasWarmCustomers = !!(cache?.customers?.length);
      const hasWarmPayments = !!(cache?.payments?.length);
      const anyErrorFast = !!(lFast.error || cFast.error || pFast.error);

      // Guard state against connectivity wipes: Only update if fetch succeeded and returned data.
      if (!lFast.error && nextLoansFast.length > 0) setLoans(nextLoansFast);
      if (!cFast.error && nextCustomersFast.length > 0) {
        setCustomers(cs => {
          const existingIds = new Set(cs.map(c => c.id));
          const filtered = nextCustomersFast.filter(c => !existingIds.has(c.id));
          return [...cs, ...filtered];
        });
      }
      if (!pFast.error && nextPaymentsFast.length > 0) setPayments(nextPaymentsFast);

      if (!anyErrorFast && (nextLoansFast.length || nextCustomersFast.length || nextPaymentsFast.length)) {
        writeCache({
          loans: (!lFast.error && nextLoansFast.length) ? nextLoansFast : (cache?.loans || []),
          customers: (!cFast.error && nextCustomersFast.length) ? nextCustomersFast : (cache?.customers || []),
          payments: (!pFast.error && nextPaymentsFast.length) ? nextPaymentsFast : (cache?.payments || []),
        });
      }

      // Backfill missing customers referenced by loans (preserves previous behavior)
      if (!lFast.error && !cFast.error) {
        const ll = lFast.data || [];
        const lc = cFast.data || [];
        const cids = new Set(lc.map(c => c.id));
        const missing = [];
        ll.forEach(l => {
          if (l.customer_id && !cids.has(l.customer_id)) {
            const dbStub = {
              id: l.customer_id, 
              name: l.customer_name || 'Unknown', 
              phone: l.phone || null,
              alt_phone: null, 
              id_no: 'PENDING-' + l.customer_id,
              business: null, 
              location: null, 
              residence: null, 
              assigned_officer: l.officer || null,
              loans: 1, 
              risk: 'Medium', 
              status: 'Active',
              joined: l.disbursed || null,
              documents: [],
              mpesa_registered: false
            };
            cids.add(l.customer_id);
            missing.push(dbStub);
          }
        });
        if (missing.length > 0) {
          console.warn('[load] Synthesized', missing.length, 'missing customer records.');
          setCustomers(cs => {
            const existingIds = new Set(cs.map(c => c.id));
            const toAdd = missing
              .filter(m => !existingIds.has(m.id))
              .map(m => ({ ...fromSupabaseCustomer(m), _isSynthesized: true }));
            return toAdd.length > 0 ? [...cs, ...toAdd] : cs;
          });
          // Upsert to DB — use the sanitized snake_case records
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
          supabase.from('loans').select('id,customer_id,customer_name,amount,balance,status,repayment_type,officer,risk,disbursed,mpesa,phone,days_overdue,created_at').order('created_at', { ascending: false }).range(0, LOANS_MAX - 1),
          supabase.from('payments').select('id,loan_id,customer_id,customer_name,amount,mpesa,date,status,allocated_by,is_reg_fee').order('date', { ascending: false }).range(0, PAYMENTS_MAX - 1),
          supabase.from('unallocated_payments').select('*', { count: 'exact', head: true }).eq('status', 'Unallocated'),
        ]).then(([lFull, pFull, uFull]) => {
          if (!uFull.error) setUnallocatedC2BCount(uFull.count || 0);
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
                .select('id,name,phone,alt_phone,id_no,business,location,residence,officer,loans,risk,gender,dob,blacklisted,bl_reason,n1_name,n1_phone,n1_relation,n2_name,n2_phone,n2_relation,n3_name,n3_phone,n3_relation,joined,created_at,status,assigned_officer,mpesa_registered,business_name,business_type,business_location,documents,gps_coordinates')
                .order('name')
                .range(offset, offset + CUSTOMERS_PAGE - 1);

              if (error) { console.error('[load customers page]', error.message); break; }
              const page = (data && data.length) ? data.map(fromSupabaseCustomer) : [];
              if (page.length === 0) break;

              combined = combined.concat(page);
              offset += CUSTOMERS_PAGE;

              // Update progressively so categories populate gradually (not one big freeze)
              // Update progressively and deduplicate
              setCustomers(prev => {
                const next = [...prev];
                page.forEach(c => {
                  const idx = next.findIndex(x => x.id === c.id);
                  if (idx >= 0) {
                    if (next[idx]._isSynthesized) next[idx] = c;
                  } else {
                    next.push(c);
                  }
                });
                return next;
              });
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

      // Phase 2: Deferred loading removed to save egress. 
      // Leads, Interactions, and Audit Logs now load only when their respective tabs are opened.
    } catch (e) {
      console.error('[load] Failed to load from Supabase:', e?.message || e);
    }
  }, []);

  useEffect(() => {
    if (_hasLoadedDataGlobal) return;
    _hasLoadedDataGlobal = true;

    // Hydrate from cache immediately.
    const cache = readCache();
    let isStale = true;
    if (cache) {
      if (Array.isArray(cache.loans)) setLoans(cache.loans);
      if (Array.isArray(cache.customers)) setCustomers(cache.customers);
      if (Array.isArray(cache.payments)) setPayments(cache.payments);
      if ((cache.loans?.length || cache.customers?.length || cache.payments?.length)) setDataLoaded(true);
      
      // If cache is fresh (less than 3 mins old), skip the background eager load.
      const CACHE_TTL = 180000;
      if (cache.ts && (Date.now() - cache.ts < CACHE_TTL)) {
        isStale = false;
        console.log('[load] Cache is warm. Skipping background eager sync.');
      }
    }

    if (isStale) loadAllData();
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
        setAuditLog(l => [{ ts: ts(), user: email.trim(), action: 'Admin Login', target: 'System', detail: 'Login successful via Admin Portal' }, ...l].slice(0, 10));
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

  const shared={loans,setLoans,customers,setCustomers,workers,setWorkers,payments,setPayments,leads,setLeads,interactions,setInteractions,auditLog,setAuditLog,unallocatedC2BCount,setUnallocatedC2BCount,onOpenCustomerProfile: setGlobalCustomerId, onRefresh: loadAllData};

  return (
    <>
      <StylesMemo/>
      {mode==='admin-login'&&<AdminLogin onLogin={handleLogin} onWorkerPortal={()=>setMode('worker')}/>}
      {mode==='admin' && (!dataLoaded ? (
        <div style={{minHeight:'100vh',background:'#060A10',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:20}}>
          <div style={{fontFamily:T.head,color:T.accent,fontWeight:900,fontSize:22,letterSpacing:-.5}}>Adequate Capital</div>
          <div style={{width:32,height:32,border:'3px solid #1A2234',borderTop:'3px solid #00D4AA',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
          <div style={{color:T.muted,fontSize:13,fontFamily:T.body,fontWeight:500}}>Hydro-syncing workspace…</div>
        </div>
      ) : <AdminPanel {...shared} onLogout={()=>setMode('admin-login')}/>)}
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
            setAuditLog(l => [entry, ...l].slice(0, 10));
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

// ═══════════════════════════════════════════
//  GLOBAL COMMAND CENTER (SEARCH)
// ═══════════════════════════════════════════
const CommandCenter = ({ customers, onClose, onSelect }) => {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);
  const { theme } = useTheme();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo(() => {
    if (!q || q.length < 2) return [];
    const term = q.toLowerCase();
    
    return customers.map(c => {
      let matchType = null;
      let matchedValue = '';

      if (c.name?.toLowerCase().includes(term)) matchType = 'Customer';
      else if (c.phone?.includes(term)) matchType = 'Phone';
      else if (c.idNo?.toLowerCase().includes(term)) matchType = 'ID Match';
      else if (c.n1n?.toLowerCase().includes(term)) { matchType = 'NOK'; matchedValue = c.n1n; }
      else if (c.n1p?.includes(term)) { matchType = 'NOK'; matchedValue = c.n1p; }
      else if (c.n2n?.toLowerCase().includes(term)) { matchType = 'NOK'; matchedValue = c.n2n; }
      else if (c.n2p?.includes(term)) { matchType = 'NOK'; matchedValue = c.n2p; }
      else if (c.n3n?.toLowerCase().includes(term)) { matchType = 'NOK'; matchedValue = c.n3n; }
      else if (c.n3p?.includes(term)) { matchType = 'NOK'; matchedValue = c.n3p; }

      if (matchType) return { ...c, matchType, matchedValue };
      return null;
    }).filter(Boolean).slice(0, 8);
  }, [customers, q]);

  return (
    <div 
      className="fade ios-sheet-overlay"
      style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '12vh 16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        className="pop glass"
        style={{ 
          width: '100%', maxWidth: 600, 
          borderRadius: 32, 
          background: theme === 'dark' ? 'rgba(26, 39, 64, 0.85)' : 'rgba(255, 255, 255, 0.9)',
          boxShadow: '0 50px 100px -20px rgba(0,0,0,0.6)',
          overflow: 'hidden' 
        }}
      >
        <div style={{ padding: '24px 24px 12px' }}>
          <div style={{ 
            background: theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', 
            borderRadius: 20, 
            padding: '4px 16px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12,
            border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`
          }}>
            <SearchIcon size={20} color={T.accent} strokeWidth={2.5} />
            <input 
              ref={inputRef}
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search customers or families..."
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: T.txt, fontSize: 17, height: 48, fontWeight: 600 }}
              onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
            />
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
               {q && <button onClick={() => setQ('')} style={{ background:'none', border:'none', color:T.dim, padding:4, cursor:'pointer' }}>✕</button>}
               <kbd style={{ background: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', borderRadius: 6, padding: '3px 6px', fontSize: 10, color: T.dim, fontWeight: 700 }}>ESC</kbd>
            </div>
          </div>
        </div>

        <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '0 12px 24px' }}>
          {q.length >= 2 && results.length === 0 && (
            <div style={{ padding: 60, textAlign: 'center', color: T.dim }}>
              <div style={{ background: T.aLo, width: 64, height: 64, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: T.accent }}>
                <SearchIcon size={32} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>No matches found</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>We couldn't find a borrower with that info.</div>
            </div>
          )}
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {results.map(r => (
              <div 
                key={r.id}
                className="audit-row"
                onClick={() => { onSelect(r.id); onClose(); }}
                style={{ padding: '14px 16px', borderRadius: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all .25s ease' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ 
                    width: 48, height: 48, borderRadius: 16, 
                    background: `${T.accent}15`, color: T.accent, 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    fontSize: 20, fontWeight: 900,
                    border: `1.5px solid ${T.accent}30`
                  }}>
                    {r.name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ color: T.txt, fontWeight: 700, fontSize: 15 }}>{r.name}</div>
                    <div style={{ color: T.dim, fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                       {r.phone} {r.matchedValue && <span style={{ color: T.accent }}>• {r.matchedValue}</span>}
                    </div>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                   <Badge color={r.matchType === 'NOK' ? T.warn : T.accent}>{r.matchType}</Badge>
                   <ChevronRight size={16} color={T.dim} />
                </div>
              </div>
            ))}
          </div>

          {!q && (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
               <div style={{ 
                 width: 80, height: 80, background: T.aLo, 
                 borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', 
                 margin: '0 auto 24px', color: T.accent,
                 boxShadow: `0 20px 40px ${T.accent}20`
               }}>
                 <Lock size={40} style={{ opacity: 0.8 }} />
               </div>
               <div style={{ color: T.txt, fontWeight: 900, fontSize: 24, letterSpacing: '-0.02em' }}>Command Center</div>
               <div style={{ color: T.dim, fontSize: 14, marginTop: 12, maxWidth: 300, margin: '12px auto 0', lineHeight: 1.6 }}>
                 Scan across all borrowers and their families securely and instantly.
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};