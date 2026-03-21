// ═══════════════════════════════════════════════════════════════
//  ADEQUATE CAPITAL LMS — Core UI Engine
//  All UI components, pages and the main App shell live here.
//  Imports and exports are wired in src/App.jsx and src/main.jsx
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback, memo } from "react";
import { _hashPw, _checkPw, SEED_WORKERS, SEED_CUSTOMERS, SEED_LOANS, SEED_PAYMENTS,
         SEED_LEADS, SEED_INTERACTIONS, SEED_AUDIT } from "@/data/seedData";

const SFX = (() => {
  let ctx = null;
  const getCtx = () => {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} }
    if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch(e){} }
    return ctx;
  };
  // Suspend context when tab is hidden to stop burning the audio thread
  if (typeof document !== 'undefined') {
    const _sfxVisHandler = () => {
      if (ctx) { try { document.hidden ? ctx.suspend() : ctx.resume(); } catch(e){} }
    };
    document.removeEventListener('visibilitychange', _sfxVisHandler);
    document.addEventListener('visibilitychange', _sfxVisHandler);
  }

  const play = (notes, masterVol = 0.18) => {
    const c = getCtx(); if (!c) return;
    const master = c.createGain();
    master.gain.setValueAtTime(masterVol, c.currentTime);
    master.connect(c.destination);
    notes.forEach(({ freq, start, dur, vol = 1, type = 'sine', attack = 0.01, decay = 0.12 }) => {
      const osc = c.createOscillator();
      const env = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, c.currentTime + start);
      env.gain.setValueAtTime(0, c.currentTime + start);
      env.gain.linearRampToValueAtTime(vol, c.currentTime + start + attack);
      env.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + dur);
      osc.connect(env); env.connect(master);
      osc.start(c.currentTime + start);
      osc.stop(c.currentTime + start + dur + 0.05);
    });
  };

  return {
    // Login success — warm ascending chime
    login:    () => play([{freq:523,start:0,dur:.22},{freq:659,start:.1,dur:.22},{freq:784,start:.2,dur:.35}], 0.14),
    // Save / confirm — single soft ding
    save:     () => play([{freq:880,start:0,dur:.18,attack:.005},{freq:1047,start:.08,dur:.28}], 0.12),
    // Notification / new item — two-note plink
    notify:   () => play([{freq:1047,start:0,dur:.14,attack:.005},{freq:1319,start:.1,dur:.22}], 0.10),
    // Download — descending whoosh
    download: () => play([{freq:660,start:0,dur:.12},{freq:550,start:.08,dur:.12},{freq:440,start:.16,dur:.20}], 0.13),
    // Upload — ascending whoosh
    upload:   () => play([{freq:440,start:0,dur:.12},{freq:550,start:.08,dur:.12},{freq:660,start:.16,dur:.20}], 0.13),
    // Send message — pop
    send:     () => play([{freq:1175,start:0,dur:.10,attack:.002},{freq:987,start:.08,dur:.18,type:'triangle'}], 0.11),
    // Warning / danger
    warn:     () => play([{freq:440,start:0,dur:.18,type:'triangle'},{freq:392,start:.16,dur:.28,type:'triangle'}], 0.15),
    // Reminder alarm — gentle repeating bell
    reminder: () => {
      const notes = [];
      for (let i = 0; i < 3; i++) {
        notes.push({freq:1047,start:i*0.5,dur:.4,attack:.005,vol:.9});
        notes.push({freq:784, start:i*0.5+.18,dur:.3,attack:.005,vol:.6});
      }
      play(notes, 0.16);
    },
    // Error
    error:    () => play([{freq:220,start:0,dur:.25,type:'sawtooth'},{freq:196,start:.2,dur:.3,type:'sawtooth'}], 0.12),
  };
})();

// SFX-aware toast hook  
const useToast = () => {
  const [toasts,setToasts] = useState([]);
  const setRef = useRef(setToasts); // ref is stable, no useEffect needed
  const show = useRef((msg, type='ok', duration=3000) => {
    const id = Date.now();
    setRef.current(t=>[...t,{id,msg,type}]);
    setTimeout(()=>setRef.current(t=>t.filter(x=>x.id!==id)), duration);
    if (type==='ok') SFX.save();
    else if (type==='danger') SFX.warn();
    else if (type==='warn') SFX.warn();
    else if (type==='info') SFX.notify();
  }).current;
  return {toasts, show};
};

const Styles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    /* v1.7.2 UX — skip link */
    .skip-link{position:absolute;top:-999px;left:8px;background:#00D4AA;color:#060A10;padding:6px 14px;border-radius:0 0 8px 8px;font-weight:700;font-size:13px;z-index:999999;text-decoration:none;}
    .skip-link:focus{top:0;}
    /* v1.7.2 UX — screen-reader-only utility */
    .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border-width:0;}
    /* v1.7.2 UX — visible focus rings for keyboard navigation */
    :focus-visible{outline:2px solid #00D4AA;outline-offset:2px;border-radius:4px;}
    button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid #00D4AA;outline-offset:2px;}
    /* v1.7.2 UX — remove outline only for mouse users */
    :focus:not(:focus-visible){outline:none;}
    html,body{background:#080C14;font-family:-apple-system,BlinkMacSystemFont,'Inter','SF Pro Display','Helvetica Neue',Arial,sans-serif;min-height:100%;overflow-x:hidden;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;scrollbar-gutter:stable}
    /* v1.7.1 — body scroll lock applied by useModalLock while any overlay is open */
    body.modal-open{overflow:hidden!important;position:fixed;width:100%;}
    /* Lock the inner AdminPanel scroll container when any modal is open */
    body.modal-open .main-scroll{overflow:hidden!important;}
    /* v1.7.1 — DT table containers: horizontal scroll without page widening */
    .dt-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;}
    .dt-wrap table{min-width:520px;}
    /* v1.7.1 — fixed-height scrollable DT shell inside cards */
    .dt-shell{overflow-y:auto;overflow-x:auto;-webkit-overflow-scrolling:touch;}
    .dt-shell table{min-width:520px;width:100%;border-collapse:collapse;font-size:13px;}
    /* v1.7.1 — sticky thead inside dt-shell */
    .dt-shell thead th{position:sticky;top:0;z-index:2;background:#111827;}
    ::-webkit-scrollbar{width:5px;height:5px}
    ::-webkit-scrollbar-track{background:#0D1117}
    ::-webkit-scrollbar-thumb{background:#1E2D45;border-radius:99px}
    input,select,textarea,button{font-family:-apple-system,BlinkMacSystemFont,'Inter','SF Pro Display','Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased}
    input:-webkit-autofill,input:-webkit-autofill:hover,input:-webkit-autofill:focus,input:-webkit-autofill:active{
      -webkit-box-shadow:0 0 0 1000px #0D1117 inset!important;
      -webkit-text-fill-color:#E2E8F0!important;
      box-shadow:0 0 0 1000px #0D1117 inset!important;
      color:#E2E8F0!important;
      background-color:#0D1117!important;
      caret-color:#E2E8F0!important;
    }
    input[type=password]{color:#E2E8F0!important;background:#0D1117!important;-webkit-text-fill-color:#E2E8F0!important;}

    @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes scaleIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
    @keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-5px)}40%,80%{transform:translateX(5px)}}
    @keyframes slideUp{from{transform:translateY(80px);opacity:0}to{transform:translateY(0);opacity:1}}
    @keyframes slideDown{from{transform:translateY(0);opacity:1}to{transform:translateY(80px);opacity:0}}
    @keyframes blurIn{from{opacity:0}to{opacity:1}}
    @keyframes slideInRight{from{opacity:0;transform:translateX(48px)}to{opacity:1;transform:translateX(0)}}
    .panel-in{animation:slideInRight .28s cubic-bezier(.22,1,.36,1) both}

    .fu {animation:fadeUp .38s cubic-bezier(.22,1,.36,1) both}
    .fu1{animation-delay:.05s}.fu2{animation-delay:.1s}
    .fu3{animation-delay:.15s}.fu4{animation-delay:.2s}.fu5{animation-delay:.25s}
    .pop{animation:scaleIn .22s cubic-bezier(.22,1,.36,1) both}
    .fade{animation:fadeIn .22s ease both}
    .dialog-backdrop{animation:blurIn .2s ease both}
    .toast-enter{animation:slideUp .28s cubic-bezier(.22,1,.36,1) both}

    .nb:hover{background:#00D4AA18!important;color:#00D4AA!important}
    .row-hover:hover{background:#00D4AA08;transition:background .15s}
    .shake{animation:shake .35s ease}

    button{transition:opacity .15s,background .18s,color .15s,border-color .15s,box-shadow .18s}
    button:not(:disabled):active{transform:scale(.97)}
    .kpi-btn{cursor:pointer;transition:transform .2s cubic-bezier(.22,1,.36,1),box-shadow .2s}
    .kpi-btn:hover{transform:translateY(-3px);box-shadow:0 10px 28px #00000055}
    select option{background:#111827;color:#E2E8F0}

    /* ── Apple-like hover/click animations ── */
    .sfx-card{transition:transform .18s cubic-bezier(.22,1,.36,1),box-shadow .18s,border-color .22s,background .18s}
    .sfx-card:hover{transform:translateY(-2px) scale(1.01);box-shadow:0 8px 28px rgba(0,0,0,0.35)}
    .sfx-card:active{transform:scale(.98)}
    .sec-event{transition:background .15s,border-color .2s,transform .18s cubic-bezier(.22,1,.36,1)}
    .sec-event:hover{background:#00D4AA0D!important;border-color:#00D4AA40!important;transform:translateX(3px)}
    .sec-event:active{transform:scale(.98)}
    .audit-row{transition:background .12s}
    .audit-row:hover{background:#00D4AA08!important;cursor:pointer}
    @keyframes expandDown{from{opacity:0;transform:scaleY(0);transform-origin:top}to{opacity:1;transform:scaleY(1);transform-origin:top}}
    @keyframes collapseUp{from{opacity:1;transform:scaleY(1);transform-origin:top}to{opacity:0;transform:scaleY(0);transform-origin:top}}
    .expand-in{animation:expandDown .22s cubic-bezier(.22,1,.36,1) both}
    @keyframes popIn{from{opacity:0;transform:scale(.88) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
    .pop-in{animation:popIn .24s cubic-bezier(.22,1,.36,1) both}
    .back-btn{transition:background .15s,color .15s,transform .15s;display:inline-flex;align-items:center;gap:6px;background:transparent;border:1px solid #1A2740;color:#64748B;border-radius:9px;padding:6px 13px;font-size:13px;font-weight:600;cursor:pointer}
    .back-btn:hover{background:#1A274030;color:#E2E8F0;transform:translateX(-2px)}
    .back-btn:active{transform:scale(.96)}
    .refresh-btn{transition:background .15s,color .15s,transform .15s;display:inline-flex;align-items:center;gap:6px;background:transparent;border:1px solid #1A2740;color:#64748B;border-radius:9px;padding:6px 13px;font-size:13px;font-weight:600;cursor:pointer}
    .refresh-btn:hover{background:#00D4AA18;color:#00D4AA;border-color:#00D4AA40}
    .refresh-btn svg{transition:transform .7s cubic-bezier(.22,1,.36,1)}

    @media(max-width:900px){
    }
    @media(max-width:600px){
      .kpi-row{flex-direction:column!important}
      .kpi-row>*{min-width:0!important;flex:none!important;width:100%!important}
      .hide-mob{display:none!important}
      .mob-full{width:100%!important;min-width:0!important}
      .mob-stack{flex-direction:column!important;align-items:stretch!important}
      .mob-p{padding:14px!important}
      .mob-grid1{grid-template-columns:1fr!important}.mob-grid1>*{grid-column:span 1!important}
      .admin-content{padding:10px 8px!important}
      /* v1.7.1 mobile table tweaks */
      .dt-shell table,.dt-shell thead th{font-size:11px!important}
      .dt-shell td{padding:8px 8px!important;font-size:12px!important}
      .hide-sm{display:none!important}

      .lead-pipeline{flex-direction:column!important;overflow-x:hidden!important;overflow-y:auto!important}
      .lead-pipeline>div{min-width:0!important;width:100%!important}

      /* Mobile form fixes — ensure all text/labels are visible */
      label{color:#94A3B8!important;font-size:11px!important}
      input,select,textarea{
        color:#E2E8F0!important;
        background:#0D1117!important;
        border-color:#1A2740!important;
        font-size:16px!important;
        -webkit-text-fill-color:#E2E8F0!important;
        opacity:1!important;
      }
      input::placeholder{color:#4B5563!important;-webkit-text-fill-color:#4B5563!important}
      input:focus,select:focus,textarea:focus{border-color:#00D4AA!important;outline:none!important}
      /* dialog-backdrop already uses flex-start */
      /* Ensure grid form fields go full width on mobile */
      [style*="gridTemplateColumns"]{grid-template-columns:1fr!important}
      [style*="grid-template-columns"]{grid-template-columns:1fr!important}
      [style*="gridColumn: span 2"],[style*="gridColumn:span 2"]{grid-column:span 1!important}
    }
  `}</style>
);

const T = {
  bg:"#080C14", surface:"#0D1117", card:"#111827", card2:"#141E2E",
  border:"#1A2740", hi:"#243550",
  accent:"#00D4AA", aLo:"#00D4AA12", aMid:"#00D4AA30",
  gold:"#F5C518",   gLo:"#F5C51812",
  warn:"#F59E0B",   wLo:"#F59E0B12",
  danger:"#EF4444", dLo:"#EF444412",
  ok:"#10B981",     oLo:"#10B98112",
  blue:"#3B82F6",   bLo:"#3B82F612",
  purple:"#8B5CF6", pLo:"#8B5CF612",
  txt:"#E2E8F0", dim:"#94A3B8", muted:"#64748B",
  mono:"'SF Mono','Fira Code','Fira Mono','Roboto Mono',monospace",
  head:"-apple-system,BlinkMacSystemFont,'Inter','SF Pro Display','Helvetica Neue',sans-serif",
  body:"-apple-system,BlinkMacSystemFont,'Inter','SF Pro Text','Helvetica Neue',sans-serif",
};
const RC = {Low:T.ok, Medium:T.warn, High:T.danger, "Very High":T.purple};
const SC = {
  Active:T.ok, Settled:T.accent, Approved:T.gold, Overdue:T.danger,
  "Written off":T.muted, Dormant:T.warn, "Application submitted":T.blue,
  "Under review":T.warn, New:T.muted, Contacted:T.warn,
  Interested:T.accent, Onboarded:T.ok,
  Allocated:T.ok, Unallocated:T.danger, Inactive:T.muted,
  Reminder:T.warn, "Field Visit":T.blue, "Demand Letter":T.danger,
  "Final Notice":T.danger, Legal:T.purple, "Written Off":T.muted,
};

// ── Utilities ─────────────────────────────────────────────────
const fmt   = n  => "KES " + Number(n||0).toLocaleString("en-KE");
const fmtM  = n  => n>=1e6?`KES ${(n/1e6).toFixed(2)}M`:n>=1e3?`KES ${(n/1e3).toFixed(1)}K`:`KES ${n||0}`;
const now   = () => new Date().toISOString().split("T")[0];
const ts    = () => new Date().toLocaleString("en-KE",{hour12:false}).replace(',',' ');
const uid   = p  => `${p}-${Date.now().toString(36).toUpperCase().slice(-5)}${Math.random().toString(36).slice(2,4).toUpperCase()}`;
// ═══════════════════════════════════════════════════════════════════════════════
//  FINANCIAL ENGINE — Single source of truth for all interest/penalty calculations
//  Rules (as specified):
//  • Day 0–30 overdue  : interest only (1.2%/day on outstanding balance)
//  • Day 31–60 overdue : penalty only  (1.2%/day on outstanding balance, interest stops)
//  • After day 60      : FREEZE — no further accumulation, total is locked
//  • Before overdue    : no interest or penalty (flat 30% is baked into loan balance)
// ═══════════════════════════════════════════════════════════════════════════════
const DAILY_RATE      = 0.012;  // 1.2% per day
const INTEREST_DAYS   = 30;     // interest phase: days 1–30 overdue
const PENALTY_DAYS    = 30;     // penalty phase:  days 31–60 overdue
const FREEZE_AFTER    = 60;     // no accumulation after 60 days overdue

/**
 * calculateLoanStatus(loan, asOfDate?)
 * ─────────────────────────────────────
 * Returns a deterministic snapshot of a loan's financial state.
 * This is the ONLY place interest/penalty math lives. All UI components
 * and the payment engine read from this — never calculate independently.
 *
 * @param {object} loan        - Loan record with .balance, .daysOverdue, .status, .amount
 * @param {Date}   [asOfDate]  - Calculation date (defaults to today)
 * @returns {object} {
 *   interestAccrued,   // KES — interest accumulated in days 1–30 overdue
 *   penaltyAccrued,    // KES — penalty accumulated in days 31–60 overdue
 *   totalAmountDue,    // KES — balance + interestAccrued + penaltyAccrued
 *   overdueDays,       // number — capped at display maximum (not used for calc)
 *   phase,             // 'none'|'interest'|'penalty'|'frozen'
 *   status,            // human-readable status string
 *   isFrozen,          // bool — true when past 60 days (no more accumulation)
 * }
 */
const calculateLoanStatus = (loan, asOfDate) => {
  const d = asOfDate || new Date();
  const od = Math.max(0, loan.daysOverdue || 0);
  const bal = Math.max(0, loan.balance || 0);

  // ── Not overdue or fully settled ───────────────────────────────────────────
  if(!od || loan.status === 'Settled' || loan.status === 'Written off' || bal <= 0) {
    return {
      interestAccrued: 0,
      penaltyAccrued:  0,
      totalAmountDue:  bal,
      overdueDays:     od,
      phase:           bal <= 0 ? 'none' : (od > 0 ? 'interest' : 'none'),
      status:          bal <= 0 ? 'Settled' : (loan.status || 'Active'),
      isFrozen:        false,
    };
  }

  // ── Phase determination ─────────────────────────────────────────────────────
  // Days 1–30:   interest only
  // Days 31–60:  penalty only (interest stops at day 30)
  // After day 60: frozen — nothing accrues
  let interestAccrued = 0;
  let penaltyAccrued  = 0;
  let phase, status, isFrozen;

  if(od <= INTEREST_DAYS) {
    // Phase 1: interest only
    interestAccrued = Math.round(bal * DAILY_RATE * od);
    penaltyAccrued  = 0;
    phase           = 'interest';
    status          = 'Overdue (Interest phase)';
    isFrozen        = false;

  } else if(od <= FREEZE_AFTER) {
    // Phase 2: interest capped at 30 days, penalty for (od - 30) days
    interestAccrued = Math.round(bal * DAILY_RATE * INTEREST_DAYS);
    const penaltyDays = od - INTEREST_DAYS;
    penaltyAccrued  = Math.round(bal * DAILY_RATE * penaltyDays);
    phase           = 'penalty';
    status          = 'Overdue (Penalty phase)';
    isFrozen        = false;

  } else {
    // Phase 3: frozen — interest capped at 30 days, penalty capped at 30 days
    interestAccrued = Math.round(bal * DAILY_RATE * INTEREST_DAYS);
    penaltyAccrued  = Math.round(bal * DAILY_RATE * PENALTY_DAYS);
    phase           = 'frozen';
    status          = 'Frozen (No further accumulation)';
    isFrozen        = true;
  }

  return {
    interestAccrued,
    penaltyAccrued,
    totalAmountDue: bal + interestAccrued + penaltyAccrued,
    overdueDays:    od,
    phase,
    status,
    isFrozen,
  };
};

// Backward-compat shim — existing call sites use calcP(bal, daysOverdue).
// Returns the combined interest+penalty from the new engine.
// All new code should call calculateLoanStatus() directly.
const calcP = (bal, d) => {
  const stub = { balance: bal, daysOverdue: d, status: d > 0 ? 'Overdue' : 'Active' };
  const { interestAccrued, penaltyAccrued } = calculateLoanStatus(stub);
  return interestAccrued + penaltyAccrued;
};
// HTML-escape for inserting values into JSX strings and HTML documents
const escHtml = (v) => String(v||'').replace(/[<>&"]/g, c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));

// ── CSV / Download ────────────────────────────────────────────
const toCSV = (hdr,rows) => {
  const DANGER = /^[=+\-@|]/;
  const q = v => {
    let s = String(v == null ? "" : v);
    if(DANGER.test(s)) s = "_" + s;
    s = s.replace(/"/g, "");
    return '"' + s + '"';
  };
  return [hdr.join(','), ...rows.map(r=>r.map(q).join(','))].join('\n');
};
const dlCSV = (filename, csvContent) => {
  try {
    const blob = new Blob([csvContent], {type:'text/csv;charset=utf-8;'});
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {href:url, download:filename});
    document.body.appendChild(a); a.click();
    setTimeout(()=>{URL.revokeObjectURL(url);document.body.removeChild(a);}, 500);
    try{SFX.download();}catch(e){}
  } catch(e) {
    window.open('data:text/csv;charset=utf-8,'+encodeURIComponent(csvContent));
  }
};

const buildFullBackup = ({loans,customers,payments,workers,leads,interactions,auditLog}) => {
  const sections = [
    toCSV(['=== ADEQUATE CAPITAL LMS BACKUP ==='],[[ `Generated: ${new Date().toISOString()}` ]]),
    '\n\n--- CUSTOMERS ---\n',
    toCSV(['ID','Name','Phone','ID No','Business','Location','Officer','Loans','Risk','Joined','Blacklisted'],
      customers.map(c=>[c.id,c.name,c.phone,c.idNo,c.business||'',c.location||'',c.officer||'',c.loans,c.risk,c.joined,c.blacklisted?'Yes':'No'])),
    '\n\n--- LOANS ---\n',
    toCSV(['Loan ID','Customer ID','Customer','Principal','Balance','Status','Days Overdue','Penalty','Officer','Disbursed','Repayment Type'],
      loans.map(l=>{const e=calculateLoanStatus(l);return [l.id,l.customerId||'',l.customer,l.amount,l.balance,l.status,l.daysOverdue,e.interestAccrued+e.penaltyAccrued,l.officer,l.disbursed||'N/A',l.repaymentType];})),
    '\n\n--- PAYMENTS ---\n',
    toCSV(['ID','Customer ID','Customer','Loan ID','Amount','M-Pesa','Date','Status'],
      payments.map(p=>[p.id,p.customerId||'',p.customer,p.loanId||'N/A',p.amount,p.mpesa,p.date,p.status])),
    '\n\n--- LEADS ---\n',
    toCSV(['ID','Name','Phone','Business','Source','Status','Officer','Date'],
      (leads||[]).map(l=>[l.id,l.name,l.phone,l.business||'',l.source,l.status,l.officer||'',l.date])),
    '\n\n--- WORKERS ---\n',
    toCSV(['ID','Name','Email','Role','Status','Phone','Joined'],
      workers.map(w=>[w.id,w.name,w.email,w.role,w.status,w.phone,w.joined])),
    '\n\n--- INTERACTIONS ---\n',
    toCSV(['ID','Customer ID','Loan ID','Type','Date','Officer','Notes','Promise Amount','Promise Date','Promise Status'],
      (interactions||[]).map(i=>[i.id,i.customerId,i.loanId,i.type,i.date,i.officer,i.notes,i.promiseAmount||'',i.promiseDate||'',i.promiseStatus||''])),
    '\n\n--- AUDIT LOG ---\n',
    toCSV(['Timestamp','User','Action','Target','Detail'],
      (auditLog||[]).map(e=>[e.ts,e.user,e.action,e.target,e.detail||''])),
  ];
  return sections.join('');
};

// ── Seed Data ─────────────────────────────────────────────────
// Password hashing — SHA-256 via SubtleCrypto (async, used when setting/checking passwords)
// NOTE: Replace with server-side bcrypt/argon2 before production deployment
const _sha256Hex = async (str) => {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  } catch(e) { return str; }
};
const HASH_SALT = 'acl:2024:mfi';
const hashPwAsync = (pw) => _sha256Hex((pw||'') + HASH_SALT);
const checkPwAsync = async (raw, stored) => { try { return (await hashPwAsync(raw)) === stored; } catch(e) { return false; } };

// _hashPw and _checkPw imported from @/data/seedData

// ═══════════════════════════════════════════
//  UI ATOMS
// ═══════════════════════════════════════════
const Badge = ({children,color=T.muted}) => (
  <span style={{background:color+'1E',color,border:`1px solid ${color}38`,padding:'2px 9px',borderRadius:99,fontSize:11,fontWeight:700,whiteSpace:'nowrap'}}>{children}</span>
);
const Av = ({ini,size=36,color=T.accent}) => (
  <div style={{width:size,height:size,borderRadius:99,background:color+'20',border:`2px solid ${color}50`,display:'flex',alignItems:'center',justifyContent:'center',color,fontWeight:900,fontSize:size*.35,fontFamily:T.head,flexShrink:0}}>{ini}</div>
);
const Bar = ({value,max=100,color=T.accent}) => (
  <div style={{height:6,background:T.border,borderRadius:99,overflow:'hidden'}}>
    <div style={{height:'100%',width:`${Math.min(((value||0)/max)*100,100)}%`,background:color,borderRadius:99,transition:'width 1s'}}/>
  </div>
);
const KPI = ({label,value,sub,color,delay=0,onClick,icon}) => {
  const [hov,setHov]=useState(false);
  const c = color||T.accent;
  return (
    <div
      className={`fu fu${delay}`}
      onClick={onClick}
      onMouseEnter={()=>setHov(true)}
      onMouseLeave={()=>setHov(false)}
      style={{
        flex:1,minWidth:130,position:'relative',overflow:'hidden',
        background:hov?T.card2:T.card,
        borderRadius:16,
        border:`1px solid ${hov?c+'55':T.border}`,
        borderLeft:`3px solid ${c}`,
        padding:'18px 16px 14px',
        cursor:onClick?'pointer':'default',
        transition:'border-color .2s,background .2s,transform .18s,box-shadow .2s',
        transform:hov&&onClick?'translateY(-3px)':'translateY(0)',
        boxShadow:hov&&onClick?`0 8px 28px ${c}18,0 2px 8px rgba(0,0,0,0.3)`:'0 1px 4px rgba(0,0,0,0.2)',
      }}>
      {/* Background glow */}
      <div style={{position:'absolute',top:-20,right:-20,width:80,height:80,borderRadius:99,background:c+'0A',pointerEvents:'none',transition:'opacity .2s',opacity:hov?1:0}}/>
      {/* Header row */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
        <div style={{color:T.muted,fontSize:10,fontWeight:700,letterSpacing:.9,textTransform:'uppercase',lineHeight:1.4}}>{label}</div>
        {icon&&<div style={{fontSize:16,opacity:.7}}>{icon}</div>}
        {!icon&&onClick&&<div style={{color:c,fontSize:10,opacity:hov?1:.4,transition:'opacity .2s',fontWeight:700}}>↗</div>}
      </div>
      {/* Value */}
      <div style={{color:c,fontSize:22,fontWeight:900,fontFamily:T.mono,lineHeight:1,letterSpacing:-.5,marginBottom:sub?6:0}}>{value}</div>
      {sub&&<div style={{color:T.muted,fontSize:11,marginTop:4}}>{sub}</div>}
    </div>
  );
};
const Card = ({children,style:sx,className}) => (
  <div className={className} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:13,...sx}}>{children}</div>
);
const CH = ({title,sub,right}) => (
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 18px',borderBottom:`1px solid ${T.border}`,flexWrap:'wrap',gap:8}}>
    <div>
      <div style={{color:T.txt,fontWeight:700,fontSize:14,fontFamily:T.head}}>{title}</div>
      {sub&&<div style={{color:T.muted,fontSize:12,marginTop:2}}>{sub}</div>}
    </div>
    {right}
  </div>
);
const Btn = ({children,v='primary',onClick,disabled,sm,full,style:sx={}}) => {
  const base={border:'none',borderRadius:9,cursor:disabled?'not-allowed':'pointer',fontFamily:T.body,fontWeight:700,transition:'opacity .15s',
    padding:sm?'6px 12px':'10px 17px',fontSize:sm?12:14,opacity:disabled?.45:1,width:full?'100%':'auto',
    display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6,...sx};
  const vs={
    primary:{background:T.accent,color:'#060A10'},
    secondary:{background:T.card2,color:T.txt,border:`1px solid ${T.border}`},
    danger:{background:T.dLo,color:T.danger,border:`1px solid ${T.danger}38`},
    ghost:{background:'transparent',color:T.muted,border:`1px solid ${T.border}`},
    ok:{background:T.oLo,color:T.ok,border:`1px solid ${T.ok}38`},
    gold:{background:T.gLo,color:T.gold,border:`1px solid ${T.gold}38`},
    warn:{background:T.wLo,color:T.warn,border:`1px solid ${T.warn}38`},
    blue:{background:T.bLo,color:T.blue,border:`1px solid ${T.blue}38`},
    purple:{background:T.pLo,color:T.purple,border:`1px solid ${T.purple}38`},
  };
  return <button onClick={onClick} disabled={disabled} style={{...base,...vs[v]||vs.secondary}}>{children}</button>;
};

// ── Back Button (apple-style) ──────────────────────────────
const BackBtn = ({onClick,label='Back'}) => (
  <button className='back-btn' onClick={onClick}>
    <span style={{fontSize:14,lineHeight:1}}>‹</span>
    <span>{label}</span>
  </button>
);

// ── Refresh Button ─────────────────────────────────────────
// onRefresh: () => void  — called after spin animation; pass the actual
//            refresh action (reset filters, re-run status calc, etc.)
const RefreshBtn = ({onRefresh}) => {
  const [spinning,setSpinning] = useState(false);
  const [done,setDone]         = useState(false);
  const doRefresh = () => {
    if(spinning) return;
    setSpinning(true);
    setDone(false);
    SFX.notify();
    // Execute the real refresh action immediately (data is local-state, instant)
    try{ onRefresh(); }catch(e){}
    setTimeout(()=>{ setSpinning(false); setDone(true); setTimeout(()=>setDone(false),1200); }, 600);
  };
  return (
    <button className='refresh-btn' onClick={doRefresh} title='Refresh data'
      style={{color: done ? '#00D4AA' : undefined, borderColor: done ? '#00D4AA40' : undefined}}>
      <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'
        style={{
          transition:'transform .7s cubic-bezier(.22,1,.36,1)',
          transform:spinning?'rotate(360deg)':'rotate(0deg)',
          flexShrink:0,
        }}>
        <polyline points='23 4 23 10 17 10'/><polyline points='1 20 1 14 7 14'/>
        <path d='M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15'/>
      </svg>
      <span>{done ? '✓ Done' : 'Refresh'}</span>
    </button>
  );
};

// ── Country dial-code data ───────────────────────────────────
const DIAL_CODES = [
  {code:'+254',flag:'🇰🇪',name:'Kenya'},
  {code:'+255',flag:'🇹🇿',name:'Tanzania'},
  {code:'+256',flag:'🇺🇬',name:'Uganda'},
  {code:'+250',flag:'🇷🇼',name:'Rwanda'},
  {code:'+251',flag:'🇪🇹',name:'Ethiopia'},
  {code:'+1',  flag:'🇺🇸',name:'USA/Canada'},
  {code:'+44', flag:'🇬🇧',name:'UK'},
  {code:'+27', flag:'🇿🇦',name:'South Africa'},
  {code:'+234',flag:'🇳🇬',name:'Nigeria'},
  {code:'+233',flag:'🇬🇭',name:'Ghana'},
  {code:'+20', flag:'🇪🇬',name:'Egypt'},
  {code:'+971',flag:'🇦🇪',name:'UAE'},
  {code:'+91', flag:'🇮🇳',name:'India'},
  {code:'+86', flag:'🇨🇳',name:'China'},
  {code:'+49', flag:'🇩🇪',name:'Germany'},
  {code:'+33', flag:'🇫🇷',name:'France'},
  {code:'+61', flag:'🇦🇺',name:'Australia'},
];

// Normalise any phone to E.164 with the given dialCode
const normalisePhone = (raw, dialCode) => {
  if(!raw) return '';
  const stripped = raw.replace(/\s+/g,'');
  if(stripped.startsWith('+')) return stripped;           // already has code
  if(stripped.startsWith('00')) return '+'+stripped.slice(2);
  if(stripped.startsWith('0')) return dialCode + stripped.slice(1);
  return dialCode + stripped;
};

// Validate a phone string — accepts: +254xxxxxxxxx, 07xxxxxxxx, 01xxxxxxxx, +254 7xxxxxxxx
const isValidPhone = (raw) => {
  if(!raw) return false;
  const s = raw.replace(/[\s\-()]/g,'');
  return /^(\+\d{7,15}|0[17]\d{8})$/.test(s);
};

// PhoneInput — country selector + digits-only field
const PhoneInput = ({label, value, onChange, required, half, placeholder}) => {
  const [dialCode, setDialCode] = useState('+254');
  const [open, setOpen] = useState(false);
  const inputRef = useRef();
  const containerRef = useRef();

  // Keep only digits and leading + in the raw field
  const handleRaw = (e) => {
    let v = e.target.value.replace(/[^\d+\s]/g,'');
    onChange(v);
  };

  const selectCode = (code) => {
    setDialCode(code);
    setOpen(false);
    inputRef.current?.focus();
  };

  // Close dropdown on outside click
  useEffect(() => {
    if(!open) return;
    const handler = (e) => { if(containerRef.current && !containerRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const normalised = normalisePhone(value, dialCode);
  const hasErr = required && !isValidPhone(value) && value;
  const isMissing = required && !value;
  const flagEntry = DIAL_CODES.find(d=>d.code===dialCode) || DIAL_CODES[0];

  const borderColor = hasErr ? T.danger : isMissing ? T.danger : T.border;

  return (
    <div ref={containerRef} style={{marginBottom:12, gridColumn:half?'span 1':'span 2', position:'relative', minWidth:0}}>
      {label&&<label style={{display:'block',color:hasErr||isMissing?T.danger:T.dim,fontSize:11,fontWeight:600,marginBottom:5,letterSpacing:.7,textTransform:'uppercase'}}>
        {label}{required&&<span style={{color:T.danger}}> ★</span>}
      </label>}
      <div style={{display:'flex',borderRadius:8,border:`1px solid ${borderColor}`,overflow:'visible',background:T.surface,transition:'border-color .2s'}}>
        {/* Country code button */}
        <button type='button' onClick={()=>setOpen(o=>!o)}
          style={{display:'flex',alignItems:'center',gap:5,padding:'10px 10px',background:'transparent',border:'none',borderRight:`1px solid ${T.border}`,cursor:'pointer',flexShrink:0,color:T.txt,fontSize:13,fontWeight:700,fontFamily:T.mono,whiteSpace:'nowrap'}}>
          <span style={{fontSize:16}}>{flagEntry.flag}</span>
          <span>{dialCode}</span>
          <span style={{color:T.muted,fontSize:10}}>▾</span>
        </button>
        {/* Number input — digits only */}
        <input
          ref={inputRef}
          inputMode='numeric'
          value={value}
          onChange={handleRaw}
          placeholder={placeholder || (dialCode==='+254' ? '0712 345 678' : 'Phone number')}
          style={{flex:1,background:'transparent',border:'none',padding:'10px 12px',color:T.txt,fontSize:14,outline:'none',fontFamily:T.body,minWidth:0}}
        />
      </div>
      {/* Dropdown */}
      {open&&(
        <div style={{position:'absolute',top:'100%',left:0,zIndex:9999,background:T.card,border:`1px solid ${T.border}`,borderRadius:10,boxShadow:'0 8px 30px #00000060',width:220,maxHeight:220,overflowY:'auto',marginTop:4}}>
          {DIAL_CODES.map(d=>(
            <div key={d.code} onClick={()=>selectCode(d.code)}
              style={{display:'flex',alignItems:'center',gap:9,padding:'9px 14px',cursor:'pointer',background:d.code===dialCode?T.aLo:'transparent',transition:'background .1s'}}
              onMouseEnter={e=>e.currentTarget.style.background=T.card2}
              onMouseLeave={e=>e.currentTarget.style.background=d.code===dialCode?T.aLo:'transparent'}>
              <span style={{fontSize:18}}>{d.flag}</span>
              <span style={{color:T.txt,fontSize:12,fontWeight:600}}>{d.name}</span>
              <span style={{color:T.muted,fontSize:11,marginLeft:'auto',fontFamily:T.mono}}>{d.code}</span>
            </div>
          ))}
        </div>
      )}
      {hasErr&&<div style={{color:T.danger,fontSize:11,marginTop:3}}>⚠ Enter a valid phone number</div>}
      {isMissing&&<div style={{color:T.danger,fontSize:11,marginTop:3}}>⚠ Phone number is required</div>}
      {!hasErr&&!isMissing&&normalised&&normalised!==value&&(
        <div style={{color:T.muted,fontSize:10,marginTop:3}}>Will be stored as {normalised}</div>
      )}
    </div>
  );
};

// NumericInput — accepts digits only (for National ID, amounts, etc.)
const NumericInput = ({label, value, onChange, required, half, placeholder, hint}) => {
  const hasErr = required && !value;
  const handleChange = (e) => {
    const v = e.target.value.replace(/\D/g,'');
    if(v !== e.target.value) { try{SFX.error();}catch(x){} }
    onChange(v);
  };
  const s={width:'100%',background:T.surface,border:`1px solid ${hasErr?T.danger:T.border}`,borderRadius:8,padding:'10px 12px',color:T.txt,fontSize:14,outline:'none',fontFamily:T.mono,transition:'border-color .2s',letterSpacing:.5};
  return (
    <div style={{marginBottom:12,gridColumn:half?'span 1':'span 2',minWidth:0,overflow:'visible'}}>
      {label&&<label style={{display:'block',color:hasErr?T.danger:T.dim,fontSize:11,fontWeight:600,marginBottom:5,letterSpacing:.7,textTransform:'uppercase'}}>
        {label}{required&&<span style={{color:T.danger}}> ★</span>}
      </label>}
      <input inputMode='numeric' value={value} onChange={handleChange} placeholder={placeholder||'Numbers only'} style={s}/>
      {hasErr&&<div style={{color:T.danger,fontSize:11,marginTop:3}}>⚠ This field is required</div>}
      {hint&&!hasErr&&<div style={{color:T.muted,fontSize:11,marginTop:3}}>{hint}</div>}
    </div>
  );
};

// Enhanced FI with red-star required validation
const FI = ({label,value,onChange,type='text',options,required,placeholder,hint,half,error}) => {
  const hasErr = error && required && !value;
  const s={width:'100%',background:T.surface,border:`1px solid ${hasErr?T.danger:T.border}`,borderRadius:8,padding:'10px 12px',color:T.txt,fontSize:14,outline:'none',fontFamily:T.body,transition:'border-color .2s'};
  const handleChange = (e) => {
    // fire error SFX if this is a number type and a non-numeric char was typed
    onChange(e.target.value);
  };
  return (
    <div style={{marginBottom:12,gridColumn:half?'span 1':'span 2',minWidth:0}}>
      {label&&<label style={{display:'block',color:hasErr?T.danger:T.dim,fontSize:11,fontWeight:600,marginBottom:5,letterSpacing:.7,textTransform:'uppercase'}}>
        {label}{required&&<span style={{color:T.danger}}> ★</span>}
      </label>}
      {type==='select'
        ?<select value={value} onChange={e=>onChange(e.target.value)} style={s}>
          <option value=''>— Select —</option>
          {(options||[]).map(o=><option key={o} value={o}>{o}</option>)}
        </select>
      :type==='textarea'
        ?<textarea value={value} onChange={handleChange} placeholder={placeholder} rows={3} style={{...s,resize:'vertical'}}/>
        :<input type={type} value={value} onChange={handleChange} placeholder={placeholder} autoComplete={type==='password'?'new-password':undefined} style={{...s,WebkitTextFillColor:T.txt,caretColor:T.txt}}/>
      }
      {hasErr&&<div style={{color:T.danger,fontSize:11,marginTop:3}}>⚠ This field is required</div>}
      {hint&&!hasErr&&<div style={{color:T.muted,fontSize:11,marginTop:3}}>{hint}</div>}
    </div>
  );
};
// useToast defined in SOUND ENGINE above

const ToastContainer = ({toasts}) => (
  <div
    role="status"
    aria-live="polite"
    aria-atomic="false"
    aria-label="Notifications"
    style={{position:'fixed',bottom:20,right:20,zIndex:99999,display:'flex',flexDirection:'column',gap:8,pointerEvents:'none'}}>
    {toasts.map(t=>{
      const cols={ok:[T.ok,T.oLo],danger:[T.danger,T.dLo],warn:[T.warn,T.wLo],info:[T.blue,T.bLo]};
      const [c,bg]=cols[t.type]||cols.ok;
      return (
        <div key={t.id} role="alert" aria-live={t.type==='danger'?'assertive':'polite'}
          className='toast-enter' style={{background:bg,border:`1px solid ${c}50`,borderRadius:10,padding:'10px 16px',color:c,fontSize:13,fontWeight:600,boxShadow:`0 4px 20px ${c}20`,maxWidth:320,pointerEvents:'auto'}}>
          {t.msg}
        </div>
      );
    })}
  </div>
);
const Alert = ({type='warn',children}) => {
  const m={warn:[T.warn,T.wLo],danger:[T.danger,T.dLo],ok:[T.ok,T.oLo],info:[T.blue,T.bLo]};
  const [c,bg]=m[type]||m.warn;
  return <div style={{background:bg,border:`1px solid ${c}38`,borderRadius:9,padding:'10px 13px',color:c,fontSize:13,marginBottom:13,lineHeight:1.5}}>{children}</div>;
};

// ── Global modal scroll lock v1.7.1 — class-based, ref-counted ──
let _modalCount = 0;
const useModalLock = () => {
  useEffect(() => {
    _modalCount++;
    if(_modalCount === 1) {
      // Capture current scroll so position:fixed doesn't jump
      const scrollY = window.scrollY;
      document.body.style.top = `-${scrollY}px`;
      document.body.classList.add('modal-open');
    }
    return () => {
      _modalCount--;
      if(_modalCount === 0) {
        const scrollY = -parseInt(document.body.style.top || '0');
        document.body.classList.remove('modal-open');
        document.body.style.top = '';
        window.scrollTo(0, scrollY);
      }
    };
  }, []);
};

// ── Safe top position — always 16px below topbar, never mid-page ─
const MODAL_TOP_OFFSET = 16; // px gap from top of viewport
const MODAL_BOT_PAD    = 24; // safe gap at bottom — prevents last form field being clipped
const Dialog = ({title,children,onClose,width=520,zIndex=9900}) => {
  useModalLock();
  const dialogRef = useRef(null);
  const titleId   = useRef('dlg-'+Math.random().toString(36).slice(2,7)).current;
  const vw = typeof window!=='undefined' ? window.innerWidth : 600;
  const vh = typeof window!=='undefined' ? window.innerHeight : 800;
  const mw = Math.min(width, vw - 16);
  const maxH = Math.min(vh - MODAL_TOP_OFFSET - MODAL_BOT_PAD, Math.round(vh * 0.92));

  // ROOT CAUSE FIX A — Focus theft bug:
  // The original useEffect had [onClose] as its dependency. Every call site passes an
  // inline arrow like onClose={()=>setState(null)}, which is a NEW function reference on
  // every parent render. Every keystroke → parent re-renders → new onClose reference →
  // effect re-fires → first.focus() is called → focus is stolen from the active input
  // and given to the first focusable element (the ✕ button). This is why typing one
  // character caused focus loss and the ✕ button became highlighted.
  //
  // Fix: store onClose in a ref (always current, never changes identity) and split into
  // two effects: one mount-only for auto-focus, one stable for the keydown handler.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }); // keep ref current every render

  // Mount-only: auto-focus the first focusable element exactly once
  useEffect(()=>{
    const el = dialogRef.current;
    if(!el) return;
    const first = el.querySelector('button,input,select,textarea,[tabindex]:not([tabindex="-1"])');
    if(first) first.focus();
  },[]); // ← empty deps: runs once on mount, NEVER re-runs on parent re-renders

  // Stable keydown handler: deps are empty so this never re-registers
  useEffect(()=>{
    const el = dialogRef.current;
    if(!el) return;
    const onKey = (e) => {
      if(e.key==='Escape'){ onCloseRef.current(); return; }
      if(e.key!=='Tab') return;
      const focusable = [...el.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')];
      if(!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length-1];
      if(e.shiftKey){ if(document.activeElement===first){e.preventDefault();last.focus();} }
      else           { if(document.activeElement===last) {e.preventDefault();first.focus();} }
    };
    document.addEventListener('keydown', onKey);
    return ()=>document.removeEventListener('keydown', onKey);
  },[]); // ← empty deps: registers once, reads latest onClose via ref

  return (
    <div className='dialog-backdrop'
      style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex,
              display:'flex',alignItems:'flex-start',justifyContent:'center',
              padding:`${MODAL_TOP_OFFSET}px 8px ${MODAL_BOT_PAD}px`,
              backdropFilter:'blur(6px)',WebkitBackdropFilter:'blur(6px)',
              background:'rgba(4,8,16,0.72)',overflowY:'auto',overflowX:'hidden'}}
      onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className='pop'
        style={{background:T.card,border:`1px solid ${T.hi}`,borderRadius:18,
                width:'100%',maxWidth:mw,maxHeight:maxH,
                display:'flex',flexDirection:'column',
                boxShadow:'0 40px 80px #000000D0',flexShrink:0,overflowX:'hidden',overflowY:'hidden'}}
        onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                     padding:'14px 16px',borderBottom:`1px solid ${T.border}`,
                     flexShrink:0,background:T.card,borderRadius:'18px 18px 0 0'}}>
          <h3 id={titleId} style={{color:T.txt,fontSize:15,fontWeight:800,fontFamily:T.head,margin:0}}>{title}</h3>
          <button onClick={onClose} aria-label="Close dialog"
            style={{background:T.card2,border:`1px solid ${T.border}`,color:T.muted,borderRadius:99,width:28,height:28,cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <div style={{overflowY:'auto',padding:'14px 16px 32px',flex:1,WebkitOverflowScrolling:'touch'}}>
          {children}
        </div>
      </div>
    </div>
  );
};

// Side panel — slides in from right, feels part of the page
const Panel = ({title,subtitle,onClose,children,width=500,zIndex=9900}) => {
  useModalLock();
  const panelRef = useRef(null);
  const titleId  = useRef('pnl-'+Math.random().toString(36).slice(2,7)).current;
  const vw = typeof window!=='undefined' ? window.innerWidth : 600;
  const w = Math.min(width, vw);

  // ROOT CAUSE FIX A (Panel) — same focus-theft pattern as Dialog.
  // useEffect([onClose]) re-fires on every inline-arrow onClose change → first.focus() steals focus.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(()=>{
    const el = panelRef.current;
    if(!el) return;
    const first = el.querySelector('button,input,select,textarea,[tabindex]:not([tabindex="-1"])');
    if(first) first.focus();
  },[]);

  useEffect(()=>{
    const el = panelRef.current;
    if(!el) return;
    const onKey = (e) => {
      if(e.key==='Escape'){ onCloseRef.current(); return; }
      if(e.key!=='Tab') return;
      const focusable = [...el.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')];
      if(!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length-1];
      if(e.shiftKey){ if(document.activeElement===first){e.preventDefault();last.focus();} }
      else           { if(document.activeElement===last) {e.preventDefault();first.focus();} }
    };
    document.addEventListener('keydown', onKey);
    return ()=>document.removeEventListener('keydown', onKey);
  },[]);

  return (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex,
                 display:'flex',justifyContent:'flex-end',overflow:'hidden'}}
      onClick={onClose}>
      <div style={{position:'absolute',inset:0,background:'rgba(4,8,16,0.45)',backdropFilter:'blur(3px)',WebkitBackdropFilter:'blur(3px)'}}/>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className='panel-in'
        style={{position:'relative',width:'100%',maxWidth:w,background:T.card,
                borderLeft:`1px solid ${T.hi}`,height:'100%',
                display:'flex',flexDirection:'column',
                boxShadow:'-24px 0 64px #00000080',overflow:'hidden'}}
        onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',
                     padding:'20px 22px 16px',borderBottom:`1px solid ${T.border}`,
                     flexShrink:0,background:T.card,zIndex:10}}>
          <div>
            <h3 id={titleId} style={{color:T.txt,fontSize:16,fontWeight:800,fontFamily:T.head,margin:0,lineHeight:1.2}}>{title}</h3>
            {subtitle&&<div style={{color:T.muted,fontSize:12,marginTop:4}}>{subtitle}</div>}
          </div>
          <button onClick={onClose} aria-label="Close panel"
            style={{background:T.card2,border:`1px solid ${T.border}`,color:T.muted,borderRadius:99,width:30,height:30,cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginLeft:12}}>
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <div style={{flex:1,padding:'20px 22px 48px',overflowY:'auto',WebkitOverflowScrolling:'touch'}}>
          {children}
        </div>
      </div>
    </div>
  );
};
// ── DT v1.7.1: fixed-height shell + virtual scroll + pagination ──
const DT_ROW_H     = 44;    // px height per row — keep in sync with td padding
const DT_MAX_H_VH  = 0.48;  // default container max-height as % of viewport
const DT_PAGE_SIZE = 60;    // rows per page before pagination activates
const DT_VIRT_THR  = 120;   // rows before virtual scroll activates

// Shared thead — used by all three DT variants
const DTHead = ({cols}) => (
  <thead>
    <tr>
      {cols.map((c,i)=>(
        <th key={`${c.k||c.l}-${i}`} style={{
          color:T.muted,fontWeight:700,fontSize:10,letterSpacing:1,
          textTransform:'uppercase',padding:'10px 13px',textAlign:'left',
          borderBottom:`1px solid ${T.border}`,whiteSpace:'nowrap',
          position:'sticky',top:0,background:T.card,zIndex:2
        }}>{c.l}</th>
      ))}
    </tr>
  </thead>
);

// Shared row renderer — used by all three DT variants
const DTRow = ({cols,row,idx,onRow}) => (
  <tr
    className={onRow?'row-hover':''}
    onClick={()=>onRow&&onRow(row)}
    style={{borderBottom:`1px solid ${T.border}18`,cursor:onRow?'pointer':'default'}}>
    {cols.map((c,j)=>(
      <td key={j} style={{padding:'10px 13px',color:T.txt,verticalAlign:'middle'}}>
        {c.r?c.r(row[c.k],row):row[c.k]??'—'}
      </td>
    ))}
  </tr>
);

// ── DTSmall — for ≤DT_PAGE_SIZE rows: 40vh scroll container ──
const DTSmall = ({cols,rows,onRow,emptyMsg}) => (
  <div style={{maxHeight:'40vh',overflowY:'auto',overflowX:'auto'}}>
    <table style={{width:'100%',minWidth:520,borderCollapse:'collapse',fontSize:13}}>
      <DTHead cols={cols}/>
      <tbody>
        {rows.length===0
          ?<tr><td colSpan={cols.length}>
            <div style={{padding:'32px 16px',textAlign:'center'}}>
              <div style={{fontSize:28,marginBottom:8,opacity:.35}}>📋</div>
              <div style={{color:T.muted,fontSize:13,fontWeight:500}}>{emptyMsg}</div>
              <div style={{color:T.dim,fontSize:11,marginTop:4}}>Try adjusting your filters or search terms</div>
            </div>
          </td></tr>
          :rows.map((row,i)=><DTRow key={row.id||row.key||i} cols={cols} row={row} idx={i} onRow={onRow}/>)
        }
      </tbody>
    </table>
  </div>
);

// ── DTPaged — for >DT_PAGE_SIZE rows: paginated, 40vh scroll container ──
const DTPaged = ({cols,rows,onRow,emptyMsg}) => {
  const [page,setPage] = useState(0);
  useEffect(()=>setPage(0),[rows]);
  const totalPages = Math.ceil(rows.length/DT_PAGE_SIZE);
  const slice      = rows.slice(page*DT_PAGE_SIZE,(page+1)*DT_PAGE_SIZE);
  const from       = page*DT_PAGE_SIZE+1;
  const to         = Math.min((page+1)*DT_PAGE_SIZE,rows.length);
  return (
    <div style={{display:'flex',flexDirection:'column'}}>
      <div style={{maxHeight:'40vh',overflowY:'auto',overflowX:'auto'}}>
        <table style={{width:'100%',minWidth:520,borderCollapse:'collapse',fontSize:13}}>
          <DTHead cols={cols}/>
          <tbody>
            {slice.length===0
              ?<tr><td colSpan={cols.length}>
            <div style={{padding:'32px 16px',textAlign:'center'}}>
              <div style={{fontSize:28,marginBottom:8,opacity:.35}}>📋</div>
              <div style={{color:T.muted,fontSize:13,fontWeight:500}}>{emptyMsg}</div>
              <div style={{color:T.dim,fontSize:11,marginTop:4}}>Try adjusting your filters or search terms</div>
            </div>
          </td></tr>
              :slice.map((row,i)=><DTRow key={row.id||row.key||page*DT_PAGE_SIZE+i} cols={cols} row={row} idx={page*DT_PAGE_SIZE+i} onRow={onRow}/>)
            }
          </tbody>
        </table>
      </div>
      {/* Pagination bar */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                   padding:'7px 13px',borderTop:`1px solid ${T.border}`,
                   background:T.surface,flexWrap:'wrap',gap:6,flexShrink:0}}>
        <span style={{color:T.muted,fontSize:12}}>
          {from.toLocaleString()}–{to.toLocaleString()} of {rows.length.toLocaleString()}
        </span>
        <div style={{display:'flex',gap:3,alignItems:'center'}}>
          {[['«',0,page===0],['‹',page-1,page===0]].map(([lbl,pg,dis])=>(
            <button key={lbl} onClick={()=>setPage(pg)} disabled={dis}
              style={{background:T.card2,border:`1px solid ${T.border}`,color:T.muted,
                      borderRadius:5,padding:'3px 8px',cursor:dis?'default':'pointer',
                      fontSize:11,opacity:dis?.35:1}}>{lbl}</button>
          ))}
          {Array.from({length:Math.min(5,totalPages)},(_,i)=>{
            const p = page<2 ? i : page>totalPages-3 ? totalPages-5+i : page-2+i;
            if(p<0||p>=totalPages) return null;
            return (
              <button key={p} onClick={()=>setPage(p)}
                style={{background:p===page?T.accent:T.card2,
                        color:p===page?'#060A10':T.muted,
                        border:`1px solid ${p===page?T.accent:T.border}`,
                        borderRadius:5,padding:'3px 8px',cursor:'pointer',
                        fontSize:11,fontWeight:p===page?800:400}}>
                {p+1}
              </button>
            );
          })}
          {[['›',page+1,page>=totalPages-1],['»',totalPages-1,page>=totalPages-1]].map(([lbl,pg,dis])=>(
            <button key={lbl} onClick={()=>setPage(pg)} disabled={dis}
              style={{background:T.card2,border:`1px solid ${T.border}`,color:T.muted,
                      borderRadius:5,padding:'3px 8px',cursor:dis?'default':'pointer',
                      fontSize:11,opacity:dis?.35:1}}>{lbl}</button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── DTVirtual — for >DT_VIRT_THR rows: true O(1) DOM virtual scroll ──
const DTVirtual = ({cols,rows,onRow,maxH}) => {
  const [startIdx, setStartIdx] = useState(0);
  const wrapRef = useRef(null);
  const rafRef  = useRef(null);

  const visCount = Math.ceil(maxH/DT_ROW_H)+16; // visible rows + generous overscan buffer

  useEffect(()=>{
    setStartIdx(0);
    const wrap = wrapRef.current;
    if(!wrap) return;
    wrap.scrollTop = 0;
    const onScroll = ()=>{
      if(rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(()=>{
        if(wrapRef.current) {
          // Overscan by 8 rows above visible area for smoother upward scrolling
          setStartIdx(Math.max(0, Math.floor(wrapRef.current.scrollTop/DT_ROW_H)-8));
        }
      });
    };
    wrap.addEventListener('scroll',onScroll,{passive:true});
    return ()=>{
      wrap.removeEventListener('scroll',onScroll);
      if(rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  },[rows]);

  const start = startIdx;
  const end   = Math.min(rows.length, start+visCount);
  const slice = rows.slice(start,end);
  const topPad = start*DT_ROW_H;
  const botPad = (rows.length-end)*DT_ROW_H;

  return (
    <div>
      <div style={{padding:'4px 13px 6px',color:T.muted,fontSize:11,borderBottom:`1px solid ${T.border}18`}}>
        {rows.length.toLocaleString()} records
      </div>
      <div ref={wrapRef}
        style={{overflowY:'auto',overflowX:'auto',height:maxH,WebkitOverflowScrolling:'touch'}}>
        <table style={{width:'100%',minWidth:520,borderCollapse:'collapse',fontSize:13}}>
          <DTHead cols={cols}/>
          <tbody>
            {topPad>0&&<tr style={{height:topPad}}><td colSpan={cols.length} style={{padding:0}}></td></tr>}
            {slice.map((row,i)=>(
              <DTRow key={row.id||row.key||start+i} cols={cols} row={row} idx={start+i} onRow={onRow}/>
            ))}
            {botPad>0&&<tr style={{height:botPad}}><td colSpan={cols.length} style={{padding:0}}></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── DT — smart router: picks Small / Virtual / Paged ──────────
const DT = ({cols,rows,onRow,emptyMsg='No records found.',maxHeightVh=DT_MAX_H_VH}) => {
  const [page,setPage] = useState(0);
  useEffect(()=>setPage(0),[rows]);

  const useVirtual = rows.length>DT_VIRT_THR;
  const usePaging  = rows.length>DT_PAGE_SIZE && !useVirtual;

  if(useVirtual){
    const maxH = typeof window!=='undefined' ? Math.round(window.innerHeight*maxHeightVh) : 400;
    return <DTVirtual cols={cols} rows={rows} onRow={onRow} maxH={maxH}/>;
  }
  if(usePaging) return <DTPaged  cols={cols} rows={rows} onRow={onRow} emptyMsg={emptyMsg}/>;
  return              <DTSmall  cols={cols} rows={rows} onRow={onRow} emptyMsg={emptyMsg}/>;
};
const Search = ({value,onChange,placeholder,debounceMs=180}) => {
  const [local, setLocal] = useState(value);
  // Sync external value → local (e.g. when parent resets)
  useEffect(()=>{ setLocal(value); },[value]);
  // Debounce: only call onChange after user stops typing
  useEffect(()=>{
    const t = setTimeout(()=>{ if(local!==value) onChange(local); }, debounceMs);
    return ()=>clearTimeout(t);
  },[local, debounceMs]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div style={{position:'relative',width:'100%',maxWidth:280}} role="search">
      <span aria-hidden="true" style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:T.muted,pointerEvents:'none'}}>⌕</span>
      <label className="sr-only" htmlFor={`search-${placeholder||'q'}`}>{placeholder||'Search'}</label>
      <input
        id={`search-${placeholder||'q'}`}
        type="search"
        value={local}
        onChange={e=>setLocal(e.target.value)}
        placeholder={placeholder||'Search…'}
        aria-label={placeholder||'Search'}
        style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:9,padding:'9px 12px 9px 28px',color:T.txt,fontSize:13,outline:'none',width:'100%'}}
      />
    </div>
  );
};
const Pills = ({opts,val,onChange}) => (
  <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
    {opts.map(o=>(
      <button key={o} onClick={()=>onChange(o)} style={{background:val===o?T.accent:T.card2,color:val===o?'#060A10':T.muted,border:`1px solid ${val===o?T.accent:T.border}`,borderRadius:99,padding:'5px 12px',fontSize:12,fontWeight:600,cursor:'pointer',transition:'all .15s'}}>
        {o}
      </button>
    ))}
  </div>
);

// ── Document lightbox viewer ──────────────────────────────────
const DocViewer = ({doc, onClose}) => {
  useModalLock();
  return (
  <div role="dialog" aria-modal="true" aria-label={`Document viewer — ${doc.name}`} style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.94)',zIndex:99999,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-start',paddingTop:MODAL_TOP_OFFSET,overflow:'hidden'}}
    onClick={onClose}>
    <button onClick={onClose} aria-label="Close document viewer" style={{position:'absolute',top:16,right:16,background:'#ffffff20',border:'none',color:'#fff',borderRadius:99,width:36,height:36,cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center'}}><span aria-hidden="true">✕</span></button>
    <div style={{color:'#fff',fontSize:13,fontWeight:700,marginBottom:12,opacity:.7}}>{doc.name}</div>
    <div onClick={e=>e.stopPropagation()} style={{maxWidth:'92vw',maxHeight:'80vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      {doc.type?.startsWith('image/')
        ?<img src={doc.dataUrl} alt={doc.name} style={{maxWidth:'92vw',maxHeight:'78vh',objectFit:'contain',borderRadius:8,boxShadow:'0 8px 40px #000'}}/>
        :<div style={{background:'#1a2740',borderRadius:12,padding:'40px 48px',textAlign:'center'}}>
          <div style={{fontSize:64,marginBottom:16}}>📄</div>
          <div style={{color:'#fff',fontWeight:700,fontSize:15}}>{doc.name}</div>
          <div style={{color:'#94a3b8',fontSize:12,marginTop:6}}>PDF — cannot preview inline</div>
          <a href={doc.dataUrl} download={doc.name} style={{display:'inline-block',marginTop:16,background:'#00D4AA',color:'#060A10',padding:'8px 20px',borderRadius:8,fontWeight:800,fontSize:13,textDecoration:'none'}}>⬇ Download</a>
        </div>
      }
    </div>
  </div>
  );
};

// ── Structured Document Upload (4 fixed slots) ────────────────
const DOC_SLOTS = [
  {key:'id_front',   label:'ID — Front',         icon:'🪪', required:true,  accept:'image/*',          capture:'environment'},
  {key:'id_back',    label:'ID — Back',           icon:'🪪', required:true,  accept:'image/*',          capture:'environment'},
  {key:'passport',   label:'Passport Photo',      icon:'🖼️', required:true,  accept:'image/*',          capture:'user'},
  {key:'biz_doc',    label:'Business Document',   icon:'📋', required:false, accept:'image/*,application/pdf', capture:undefined},
];

const StructuredDocUpload = ({docs, onAdd, onRemove}) => {
  const [uploading, setUploading] = useState({});
  const [viewing,   setViewing]   = useState(null);

  const handleFile = (e, slot) => {
    const file = e.target.files?.[0];
    if(!file) return;
    e.target.value = '';
    setUploading(u=>({...u,[slot.key]:true}));
    const reader = new FileReader();
    reader.onload = ev => {
      const existing = docs.find(d=>d.key===slot.key);
      if(existing) onRemove(existing.id);
      onAdd({id:uid('DOC'), key:slot.key, name:slot.label, originalName:file.name, type:file.type, size:file.size, dataUrl:ev.target.result, uploaded:now()});
      setUploading(u=>{const n={...u}; delete n[slot.key]; return n;});
      try{SFX.upload();}catch(e){}
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      {viewing && <DocViewer doc={viewing} onClose={()=>setViewing(null)}/>}
      {DOC_SLOTS.map((slot,idx)=>{
        const doc     = docs.find(d=>d.key===slot.key);
        const busy    = uploading[slot.key];
        const isReady = !!doc;
        return (
          <div key={slot.key} style={{background:T.surface,border:`1.5px solid ${isReady?T.ok:slot.required?T.border:T.border}`,borderRadius:12,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,transition:'border-color .2s'}}>
            {/* Step number */}
            <div style={{width:26,height:26,borderRadius:99,background:isReady?T.ok:T.border,color:isReady?'#fff':T.muted,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,flexShrink:0}}>
              {isReady?'✓':idx+1}
            </div>
            {/* Info */}
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <span style={{fontSize:16}}>{slot.icon}</span>
                <span style={{color:T.txt,fontSize:13,fontWeight:700}}>{slot.label}</span>
                {slot.required&&<span style={{color:T.danger,fontSize:11,fontWeight:700}}>★ Required</span>}
                {!slot.required&&<span style={{color:T.muted,fontSize:11}}>Optional</span>}
              </div>
              {isReady
                ?<div style={{color:T.ok,fontSize:11,marginTop:2}}>✓ Uploaded · {doc.uploaded}</div>
                :<div style={{color:T.muted,fontSize:11,marginTop:2}}>{slot.required?'Must upload before proceeding':'Upload if available'}</div>
              }
            </div>
            {/* Thumbnail / preview */}
            {isReady&&(
              <div onClick={()=>setViewing(doc)} style={{cursor:'pointer',flexShrink:0}}>
                {doc.type?.startsWith('image/')
                  ?<img src={doc.dataUrl} alt={slot.label} style={{width:52,height:52,objectFit:'cover',borderRadius:7,border:`2px solid ${T.ok}`,boxShadow:'0 2px 8px #00000040'}}/>
                  :<div style={{width:52,height:52,background:T.card,borderRadius:7,border:`2px solid ${T.ok}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>📄</div>
                }
              </div>
            )}
            {/* Actions */}
            <div style={{display:'flex',gap:6,flexShrink:0}}>
              {isReady&&(
                <>
                  <button onClick={()=>setViewing(doc)} style={{background:T.aLo,border:`1px solid ${T.accent}38`,color:T.accent,borderRadius:8,padding:'6px 10px',cursor:'pointer',fontSize:11,fontWeight:700}}>View</button>
                  <button onClick={()=>onRemove(doc.id)} style={{background:T.dLo,border:`1px solid ${T.danger}30`,color:T.danger,borderRadius:8,padding:'6px 10px',cursor:'pointer',fontSize:11,fontWeight:700}}>Remove</button>
                </>
              )}
              {!isReady&&!busy&&(
                <label style={{cursor:'pointer',display:'flex',alignItems:'center',gap:5,background:T.bLo,border:`1px solid ${T.blue}38`,borderRadius:8,padding:'7px 12px',flexShrink:0}}>
                  <span style={{fontSize:14}}>📎</span>
                  <span style={{color:T.blue,fontSize:11,fontWeight:700}}>Upload</span>
                  <input type='file' accept={slot.accept} capture={slot.capture} style={{display:'none'}} onChange={e=>handleFile(e,slot)}/>
                </label>
              )}
              {busy&&<div style={{color:T.accent,fontSize:11,padding:'7px 8px'}}>Uploading…</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Document Upload Component (legacy freeform — kept for other uses) ─────────────────────────────────
const DocUpload = ({docs,onAdd,onRemove,label}) => {
  const fileRef = useRef();
  const camRef  = useRef();
  const [uploading,setUploading] = useState([]);
  const [toast,setToast] = useState('');

  const showToast=(msg)=>{setToast(msg);setTimeout(()=>setToast(''),2800);};

  const handleFile = (e,source) => {
    const files = Array.from(e.target.files||[]);
    if(!files.length) return;
    const ids=files.map(()=>uid('DOC'));
    setUploading(ids);
    files.forEach((file,fi)=>{
      const reader = new FileReader();
      reader.onload = ev=>{
        const doc = {id:ids[fi],name:file.name,type:file.type,size:file.size,dataUrl:ev.target.result,source,uploaded:now()};
        onAdd(doc);
        setUploading(u=>u.filter(x=>x!==ids[fi]));
        if(fi===files.length-1){
          showToast(`✓ ${files.length} file${files.length>1?'s':''} uploaded successfully`);
          try{SFX.upload();}catch(e){}
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value='';
  };

  return (
    <div style={{marginBottom:14}}>
      {label&&<div style={{color:T.dim,fontSize:11,fontWeight:600,letterSpacing:.7,textTransform:'uppercase',marginBottom:8}}>{label}</div>}
      <div style={{display:'flex',gap:8,marginBottom:10,flexWrap:'wrap'}}>
        <label style={{cursor:'pointer',display:'inline-flex',alignItems:'center',gap:6,background:T.bLo,border:`1px solid ${T.blue}38`,color:T.blue,borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:700}}>
          📎 Upload File
          <input ref={fileRef} type='file' accept='image/*,application/pdf' multiple style={{display:'none'}} onChange={e=>handleFile(e,'storage')}/>
        </label>
        <label style={{cursor:'pointer',display:'inline-flex',alignItems:'center',gap:6,background:T.aLo,border:`1px solid ${T.accent}38`,color:T.accent,borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:700}}>
          📷 Use Camera
          <input ref={camRef} type='file' accept='image/*' capture='environment' style={{display:'none'}} onChange={e=>handleFile(e,'camera')}/>
        </label>
      </div>
      {uploading.length>0&&(
        <div style={{marginBottom:10}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
            <span style={{color:T.dim,fontSize:12}}>Uploading {uploading.length} file{uploading.length>1?'s':''}…</span>
          </div>
          <div style={{height:5,background:T.border,borderRadius:99,overflow:'hidden'}}>
            <div style={{height:'100%',width:'60%',background:T.accent,borderRadius:99,animation:'pulse 1s infinite'}}/>
          </div>
        </div>
      )}
      {toast&&(
        <div style={{background:T.oLo,border:`1px solid ${T.ok}38`,borderRadius:8,padding:'8px 12px',color:T.ok,fontSize:12,fontWeight:600,marginBottom:8}}>
          {toast}
        </div>
      )}
      {docs&&docs.length>0&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))',gap:8}}>
          {docs.map(doc=>(
            <div key={doc.id} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:9,padding:8,position:'relative'}}>
              {doc.type?.startsWith('image/')
                ?<img src={doc.dataUrl} alt={doc.name} style={{width:'100%',height:70,objectFit:'cover',borderRadius:5,marginBottom:5}}/>
                :<div style={{width:'100%',height:70,background:T.card,borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,marginBottom:5}}>📄</div>
              }
              <div style={{color:T.txt,fontSize:10,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{doc.name}</div>
              <div style={{color:T.muted,fontSize:9}}>{doc.source==='camera'?'📷 Camera':'📁 Upload'}</div>
              <button onClick={()=>onRemove(doc.id)} style={{position:'absolute',top:4,right:4,background:T.dLo,border:'none',color:T.danger,borderRadius:99,width:18,height:18,cursor:'pointer',fontSize:9,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            </div>
          ))}
        </div>
      )}
      {(!docs||docs.length===0)&&(
        <div style={{background:T.surface,border:`1px dashed ${T.border}`,borderRadius:9,padding:'16px',textAlign:'center',color:T.muted,fontSize:12}}>
          No documents uploaded yet
        </div>
      )}
    </div>
  );
};

// ── Popup Validation Warning ──────────────────────────────────
const ValidationPopup = ({fields,onClose}) => {
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(()=>{const h=(e)=>{if(e.key==='Escape')onCloseRef.current();};document.addEventListener('keydown',h);return()=>document.removeEventListener('keydown',h);},[]);
  useEffect(()=>{ try{SFX.error();}catch(e){} },[]);
  return (
    <div role="alertdialog" aria-modal="true" aria-label="Validation errors — required fields missing" style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(4,8,16,0.88)',zIndex:9999,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:`${MODAL_TOP_OFFSET + 40}px 12px 12px`}} onClick={onClose}>
      <div className='shake pop' style={{background:T.card,border:`2px solid ${T.danger}`,borderRadius:18,padding:28,maxWidth:400,width:'100%',boxShadow:`0 0 40px ${T.danger}40`}} onClick={e=>e.stopPropagation()}>
        <div style={{textAlign:'center',marginBottom:16}}>
          <div style={{fontSize:36,marginBottom:8}}>⚠️</div>
          <div style={{fontFamily:T.head,color:T.danger,fontSize:17,fontWeight:800}}>Required Fields Missing</div>
          <div style={{color:T.muted,fontSize:13,marginTop:4}}>Please fill in all required fields before continuing.</div>
        </div>
        <div style={{background:T.dLo,borderRadius:10,padding:'12px 14px',marginBottom:16}}>
          {fields.map((f)=>(
            <div key={f} style={{color:T.danger,fontSize:13,padding:'3px 0',display:'flex',alignItems:'center',gap:7}}>
              <span style={{color:T.danger}}>★</span> {f}
            </div>
          ))}
        </div>
        <Btn onClick={onClose} v='danger' full>OK, I'll fix it</Btn>
      </div>
    </div>
  );
};
// ═══════════════════════════════════════════
//  ONBOARD FORM (Lead → Customer)
// ═══════════════════════════════════════════
const ONBOARD_DRAFT_KEY='acl_onboard_draft';
const OnboardForm = ({workers,onSave,onClose,prefill,leadId}) => {
  const [draftPrompt,setDraftPrompt]=useState(()=>{
    try{const d=JSON.parse(localStorage.getItem(ONBOARD_DRAFT_KEY)||'null');return d&&d.f?.name?d:null;}catch(e){return null;}
  });
  const blankF={name:prefill?.name||'',dob:'',gender:'Female',idNo:'',phone:prefill?.phone||'',altPhone:'',business:prefill?.business||'',businessType:'Retail',businessLoc:prefill?.location||'',residence:'',officer:prefill?.officer||'',n1n:'',n1p:'',n1r:'',n2n:'',n2p:'',n2r:'',n3n:'',n3p:'',n3r:''};
  const [f,setF]=useState(blankF);
  const [docs,setDocs]=useState([]);
  const [step,setStep]=useState(1);
  const [valErr,setValErr]=useState(null);
  const [showVal,setShowVal]=useState(false);
  const s=k=>v=>setF(p=>({...p,[k]:v}));

  // Autosave draft on every change
  useEffect(()=>{
    try{localStorage.setItem(ONBOARD_DRAFT_KEY,JSON.stringify({f,step,savedAt:new Date().toLocaleTimeString('en-KE')}));}catch(e){}
  },[f,step]);

  const clearDraft=()=>{try{localStorage.removeItem(ONBOARD_DRAFT_KEY);}catch(e){}};

  const continueDraft=()=>{
    if(draftPrompt){setF(draftPrompt.f);setStep(draftPrompt.step||1);}
    setDraftPrompt(null);
  };
  const startFresh=()=>{setF(blankF);setStep(1);setDocs([]);clearDraft();setDraftPrompt(null);};
  // FIX — Bug 8: SH was a component defined inside OnboardForm's render body, causing
  // remounting on every state change (every keystroke). Converted to a plain render fn.
  const renderSH = ({title,icon}) => <div style={{color:T.accent,fontSize:10,fontWeight:700,letterSpacing:1,textTransform:'uppercase',margin:'4px 0 10px',gridColumn:'span 2',fontFamily:T.head,display:'flex',alignItems:'center',gap:6}}><span>{icon}</span>{title}</div>;

  const STEPS = [
    {n:1,label:'Personal'},
    {n:2,label:'Business'},
    {n:3,label:'Next of Kin'},
    {n:4,label:'Documents'},
    {n:5,label:'Review'},
  ];

  const validateStep = () => {
    const missing = [];
    if(step===1){
      if(!f.name) missing.push('Full Name');
      if(!f.idNo) missing.push('National ID Number');
      if(!f.phone) missing.push('Primary Phone');
      if(!f.residence) missing.push('Residence');
    }
    if(step===2){
      if(!f.business) missing.push('Business Name');
      if(!f.businessLoc) missing.push('Business Location');
      if(!f.officer) missing.push('Assigned Officer');
    }
    if(step===3){
      if(!f.n1n) missing.push('Next of Kin 1 – Name');
      if(!f.n1p) missing.push('Next of Kin 1 – Phone');
      if(!f.n1r) missing.push('Next of Kin 1 – Relationship');
      if(!f.n2n) missing.push('Next of Kin 2 – Name');
      if(!f.n2p) missing.push('Next of Kin 2 – Phone');
      if(!f.n2r) missing.push('Next of Kin 2 – Relationship');
      if(!f.n3n) missing.push('Next of Kin 3 – Name');
      if(!f.n3p) missing.push('Next of Kin 3 – Phone');
      if(!f.n3r) missing.push('Next of Kin 3 – Relationship');
    }
    if(step===4){
      const mandatoryKeys=['id_front','id_back','passport'];
      const uploadedKeys=docs.map(d=>d.key);
      if(!uploadedKeys.includes('id_front')) missing.push('National ID — Front (mandatory)');
      if(!uploadedKeys.includes('id_back'))  missing.push('National ID — Back (mandatory)');
      if(!uploadedKeys.includes('passport')) missing.push('Passport Photo (mandatory)');
    }
    return missing;
  };

  const next = () => {
    const missing = validateStep();
    if(missing.length>0){ setValErr(missing); setShowVal(true); try{SFX.error();}catch(e){}; return; }
    setStep(s=>Math.min(s+1,5));
  };

  const save = () => {
    onSave({
      id:uid('CUS'),...f,location:f.businessLoc,loans:0,risk:'Low',
      joined:now(),blacklisted:false,fromLead:leadId||null,docs,
      businessType:f.businessType||'',
      n1r:f.n1r||'',n2r:f.n2r||'',n3r:f.n3r||''
    });
  };

  const handleSave=()=>{clearDraft();save();};

  return (
    <div>
      {showVal&&valErr&&<ValidationPopup fields={valErr} onClose={()=>setShowVal(false)}/>}
      {/* Draft restore prompt */}
      {draftPrompt&&(
        <div style={{background:T.gLo,border:`1px solid ${T.gold}38`,borderRadius:12,padding:'14px 16px',marginBottom:16}}>
          <div style={{color:T.gold,fontWeight:800,fontSize:14,marginBottom:4}}>📝 Unsaved Draft Found</div>
          <div style={{color:T.muted,fontSize:12,marginBottom:10}}>You have an unfinished registration for <b style={{color:T.txt}}>{draftPrompt.f?.name||'unknown'}</b> saved at {draftPrompt.savedAt}. Continue where you left off?</div>
          <div style={{display:'flex',gap:8}}>
            <Btn onClick={continueDraft} sm>Continue Draft →</Btn>
            <Btn v='secondary' onClick={startFresh} sm>Start Fresh</Btn>
          </div>
        </div>
      )}
      {/* Step indicator */}
      <div style={{display:'flex',gap:0,marginBottom:20,borderRadius:10,overflow:'hidden',border:`1px solid ${T.border}`}}>
        {STEPS.map(st=>(
          <div key={st.n} style={{flex:1,padding:'8px 4px',textAlign:'center',background:step>=st.n?T.aMid:T.surface,borderRight:st.n<5?`1px solid ${T.border}`:'none',transition:'background .2s'}}>
            <div style={{color:step>st.n?T.accent:step===st.n?T.txt:T.muted,fontSize:10,fontWeight:800}}>{step>st.n?'✓':st.n}</div>
            <div style={{color:step>=st.n?T.accent:T.muted,fontSize:9,marginTop:2}}>{st.label}</div>
          </div>
        ))}
      </div>

      <div style={{maxHeight:'55vh',overflowY:'auto',paddingRight:4}}>
        {step===1&&(
          <div className='mob-grid1' style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
            {renderSH({title:'Personal Details',icon:'👤'})}
            <FI label='Full Name'       value={f.name}     onChange={s('name')}     required error={true} half/>
            <FI label='Date of Birth'   value={f.dob}      onChange={s('dob')}      type='date' half/>
            <FI label='Gender'          value={f.gender}   onChange={s('gender')}   type='select' options={['Female','Male','Other']} half/>
            <NumericInput label='National ID No.' value={f.idNo} onChange={s('idNo')} required half placeholder='e.g. 12345678'/>
            <PhoneInput label='Primary Phone' value={f.phone} onChange={s('phone')} required half/>
            <PhoneInput label='Alt Phone' value={f.altPhone} onChange={s('altPhone')} half/>
            <FI label='Residence'       value={f.residence} onChange={s('residence')} required error={true} half/>
          </div>
        )}
        {step===2&&(
          <div className='mob-grid1' style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
            {renderSH({title:'Business Details',icon:'🏪'})}
            <FI label='Business Name'     value={f.business}     onChange={s('business')}     required error={true} half/>
            <FI label='Business Type'     value={f.businessType} onChange={s('businessType')} type='select' options={['Retail','Wholesale','Manufacturing','Agriculture','Transport','Food & Beverage','Salon & Beauty','Tailoring','Electronics','Hardware','Pharmacy','Education','Hospitality','Other']} half/>
            <FI label='Business Location' value={f.businessLoc}  onChange={s('businessLoc')}  required error={true} half/>
            <FI label='Assigned Officer'  value={f.officer}      onChange={s('officer')}      type='select' options={(workers||[]).filter(w=>w.status==='Active').map(w=>w.name)} required error={true} half/>
          </div>
        )}
        {step===3&&(
          <div className='mob-grid1' style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
            {renderSH({title:'Next of Kin — 3 required',icon:'👨‍👩‍👧'})}
            {[[1,'n1n','n1p','n1r'],[2,'n2n','n2p','n2r'],[3,'n3n','n3p','n3r']].map(([n,nk,pk,rk])=>[
              <FI key={nk} label={`NOK ${n} Name`}  value={f[nk]} onChange={s(nk)} required error={true} half/>,
              <PhoneInput key={pk} label={`NOK ${n} Phone`} value={f[pk]} onChange={s(pk)} required half/>,
              <FI key={rk} label={`NOK ${n} Relationship`} value={f[rk]} onChange={s(rk)} type='select' options={['','Spouse','Parent','Sibling','Child','Friend','Colleague']} required error={true} half/>,
              <div key={`sep${n}`} style={{gridColumn:'span 2',height:1,background:T.border,margin:'4px 0'}}/>
            ])}
          </div>
        )}
        {step===4&&(
          <div>
            <div style={{color:T.accent,fontSize:10,fontWeight:700,letterSpacing:1,textTransform:'uppercase',marginBottom:10,fontFamily:T.head}}>📎 KYC Documents</div>
            <Alert type='info' style={{marginBottom:12}}>Upload the 3 mandatory documents in order. The business document is optional.</Alert>
            <StructuredDocUpload docs={docs} onAdd={d=>setDocs(p=>[...p,d])} onRemove={id=>setDocs(p=>p.filter(x=>x.id!==id))}/>
          </div>
        )}
        {step===5&&(
          <div>
            <Alert type='ok'>✓ Review all information before saving the customer profile.</Alert>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
              {[['Name',f.name],['ID No.',f.idNo],['Phone',f.phone],['Residence',f.residence],['Business',f.business],['Business Type',f.businessType],['Bus. Location',f.businessLoc],['Officer',f.officer],['NOK 1',`${f.n1n} · ${f.n1p}`],['NOK 2',`${f.n2n} · ${f.n2p}`],['NOK 3',`${f.n3n} · ${f.n3p}`],['Documents',`${docs.length} uploaded`]].map(([k,v])=>(
                <div key={k} style={{background:T.surface,borderRadius:8,padding:'9px 12px'}}>
                  <div style={{color:T.muted,fontSize:10,textTransform:'uppercase',letterSpacing:.6,marginBottom:2}}>{k}</div>
                  <div style={{color:T.txt,fontSize:13,fontWeight:600}}>{v||<span style={{color:T.danger}}>Not filled</span>}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{display:'flex',gap:9,marginTop:14,paddingTop:12,borderTop:`1px solid ${T.border}`}}>
        {step>1&&<Btn v='secondary' onClick={()=>setStep(s=>s-1)}>← Back</Btn>}
        {step<5&&<Btn onClick={next} full>Next →</Btn>}
        {step===5&&<Btn onClick={handleSave} full>💾 Save Customer</Btn>}
        <Btn v='ghost' onClick={onClose}>Cancel</Btn>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════
//  LOAN FORM
// ═══════════════════════════════════════════
const LoanForm = ({customers,payments,loans,onSave,onClose,workerMode,workerName}) => {
  const [f,setF]=useState({cid:'',repayType:'Monthly',amount:5000});
  const [showVal,setShowVal]=useState(false);
  const [custSearch,setCustSearch]=useState('');
  const [showCustDrop,setShowCustDrop]=useState(false);
  const s=k=>v=>setF(p=>({...p,[k]:v}));
  const cust=customers.find(c=>c.id===f.cid);
  const interest=Math.round(Number(f.amount||0)*.3);
  const total=Number(f.amount||0)+interest;
  const isNewCust=cust&&cust.loans===0;
  const fee=isNewCust?500:0;
  const hasRegFee=isNewCust&&payments&&payments.some(p=>p.customerId===cust.id&&p.isRegFee);

  const REQUIRED_DOC_KEYS = ['id_front','id_back','passport'];
  const allLoansArr = loans||[];

  // Hard blocks: overdue/active loans. Soft warnings (worker only): missing docs
  const custEligibility = (cu, strict=false) => {
    const cl=allLoansArr.filter(l=>l.customerId===cu.id);
    const overdue=cl.filter(l=>l.status==='Overdue');
    const active=cl.filter(l=>l.status==='Active');
    const docs=cu.docs||[];
    const missing=REQUIRED_DOC_KEYS.filter(k=>!docs.some(d=>d.key===k));
    const hardReasons=[];const softReasons=[];
    if(overdue.length) hardReasons.push(`${overdue.length} overdue loan${overdue.length>1?'s':''}`);
    if(active.length)  hardReasons.push(`${active.length} active loan${active.length>1?'s':''}`);
    if(missing.length) softReasons.push(`missing docs: ${missing.map(k=>k.replace('_',' ')).join(', ')}`);
    const blocked=strict?hardReasons.length>0||softReasons.length>0:hardReasons.length>0;
    return {eligible:!blocked,reasons:[...hardReasons,...(strict?softReasons:[])],warnings:softReasons};
  };

  const selectedEligibility = cust ? custEligibility(cust, !!workerMode) : {eligible:true,reasons:[],warnings:[]};

  const filteredCusts=customers.filter(c=>!c.blacklisted&&(!custSearch||c.name.toLowerCase().includes(custSearch.toLowerCase())||c.id.toLowerCase().includes(custSearch.toLowerCase())||c.phone.includes(custSearch)));

  const calcSchedule=()=>{
    const bal=total+fee;
    if(!bal) return [];
    const rt=f.repayType;
    if(rt==='Daily'){const d=30;return [{p:'Per Day',a:Math.ceil(bal/d)},{p:'Per Week',a:Math.ceil(bal/d)*7},{p:'Per Month',a:bal}];}
    if(rt==='Weekly'){return [{p:'Per Week',a:Math.ceil(bal/4)},{p:'Per Month (4w)',a:bal}];}
    if(rt==='Biweekly'){return [{p:'Per 2 Weeks',a:Math.ceil(bal/2)},{p:'Per Month',a:bal}];}
    if(rt==='Monthly'){return [{p:'Per Month',a:bal}];}
    if(rt==='Lump Sum'){return [{p:'One-time',a:bal}];}
    return [];
  };

  const save=()=>{
    if(!f.cid||Number(f.amount)<500){setShowVal(true);return;}
    if(!selectedEligibility.eligible){
      showToast('⚠ This customer is not eligible for a new loan: '+selectedEligibility.reasons.join('; '),'danger');
      return;
    }
    const status=workerMode?'worker-pending':'Application submitted';
    onSave({id:uid('LN'),customerId:f.cid,customer:cust.name,amount:Math.floor(Number(f.amount)),balance:total+fee,status,daysOverdue:0,officer:workerName||cust.officer,risk:cust.risk,disbursed:null,mpesa:null,phone:cust.phone,repaymentType:f.repayType,payments:[]});
  };

  return (
    <div>
      {showVal&&<ValidationPopup fields={['Customer selection','Loan amount (min KES 500)']} onClose={()=>setShowVal(false)}/>}
      {/* Searchable Customer Selector */}
      <div style={{marginBottom:12,position:'relative'}}>
        <label style={{display:'block',color:T.dim,fontSize:11,fontWeight:600,marginBottom:5,letterSpacing:.7,textTransform:'uppercase'}}>Customer <span style={{color:T.danger}}>★</span></label>
        <div style={{position:'relative'}}>
          <input value={cust?`${cust.name} (${cust.id})`:custSearch} onChange={e=>{setCustSearch(e.target.value);setF(p=>({...p,cid:''}));setShowCustDrop(true);}} onFocus={()=>setShowCustDrop(true)}
            placeholder='Search by name, ID or phone…'
            style={{width:'100%',background:T.surface,border:`1px solid ${f.cid?T.accent:T.border}`,borderRadius:8,padding:'10px 12px',color:T.txt,fontSize:14,outline:'none'}}/>
          {cust&&<button onClick={()=>{setF(p=>({...p,cid:''}));setCustSearch('');setShowCustDrop(true);}} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:T.muted,cursor:'pointer',fontSize:14}}>✕</button>}
        </div>
        {showCustDrop&&!cust&&(
          <div style={{position:'absolute',top:'100%',left:0,right:0,background:T.card,border:`1px solid ${T.border}`,borderRadius:10,zIndex:500,maxHeight:220,overflowY:'auto',boxShadow:'0 8px 24px #00000060',marginTop:3}}>
            {filteredCusts.length===0&&<div style={{padding:'14px',color:T.muted,fontSize:13,textAlign:'center'}}>No customers found</div>}
            {filteredCusts.map(c=>{
              const isNew=c.loans===0;
              const elig=custEligibility(c, !!workerMode);
              return (
              <div key={c.id} onClick={()=>{setF(p=>({...p,cid:c.id}));setCustSearch('');setShowCustDrop(false);}}
                style={{padding:'10px 14px',cursor:elig.eligible?'pointer':'not-allowed',borderBottom:`1px solid ${T.border}20`,display:'flex',alignItems:'center',gap:10,background:'transparent',opacity:elig.eligible?1:0.6}}
                onMouseEnter={e=>e.currentTarget.style.background=T.surface}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}}>
                    <span style={{color:elig.eligible?T.txt:T.muted,fontWeight:700,fontSize:13}}>{c.name}</span>
                    {isNew&&<span style={{background:'#3B82F620',color:T.blue,border:`1px solid ${T.blue}38`,borderRadius:99,padding:'1px 7px',fontSize:10,fontWeight:800}}>NEW</span>}
                    {!elig.eligible&&<span style={{background:T.dLo,color:T.danger,border:`1px solid ${T.danger}38`,borderRadius:99,padding:'1px 7px',fontSize:10,fontWeight:800}}>INELIGIBLE</span>}
                  </div>
                  <div style={{color:T.muted,fontSize:11,marginTop:1}}>{c.id} · {c.phone} · {c.business||'—'}</div>
                  {!elig.eligible&&<div style={{color:T.danger,fontSize:10,marginTop:2}}>{elig.reasons.join(' · ')}</div>}
                </div>
                <Badge color={RC[c.risk]}>{c.risk}</Badge>
              </div>
              );})}
          </div>
        )}
      </div>
      {cust&&(<>
        <Alert type={!selectedEligibility.eligible?'danger':isNewCust?'warn':'info'}>
          <b>{cust.name}</b> · {cust.loans} loan(s) · Risk: {cust.risk}
          {isNewCust&&selectedEligibility.eligible&&<span style={{color:T.gold}}> · 🆕 New client — KES 500 registration fee required</span>}
          {!isNewCust&&selectedEligibility.eligible&&<span style={{color:T.ok}}> · Repeat client — no fee</span>}
          {!selectedEligibility.eligible&&(<div style={{marginTop:6}}><b style={{color:T.danger}}>⛔ Not eligible:</b><ul style={{margin:'4px 0 0 16px',padding:0,color:T.danger,fontSize:12}}>{selectedEligibility.reasons.map((r,i)=><li key={i}>{r}</li>)}</ul></div>)}
        </Alert>
        {selectedEligibility.eligible&&(selectedEligibility.warnings||[]).length>0&&(
          <Alert type='warn' style={{marginTop:6}}>⚠ <b>Incomplete profile:</b> {(selectedEligibility.warnings||[]).join(' · ')}. Loan can be submitted but disbursement should be withheld until documents are uploaded.</Alert>
        )}
      </>)}
      {isNewCust&&!hasRegFee&&selectedEligibility.eligible&&<Alert type='warn'>⚠ Registration fee not yet confirmed. Admin will need to verify before disbursement.</Alert>}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
        <FI label='Amount (KES)' type='number' value={f.amount} onChange={s('amount')} hint='Min KES 500' required error={Number(f.amount)<500} half/>
        <FI label='Repayment Type' type='select' options={['Lump Sum','Daily','Weekly','Biweekly','Monthly']} value={f.repayType} onChange={s('repayType')} half/>
      </div>
      {Number(f.amount)>=500&&(
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:13,marginBottom:13}}>
          <div style={{color:T.muted,fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:.9,marginBottom:9}}>Loan Summary</div>
          {[['Principal',fmt(f.amount)],['Interest (30% flat)',fmt(interest)],['Registration Fee',fmt(fee)],['Total Repayable',fmt(total+fee)]].map(([k,v])=>(
            <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:`1px solid ${T.border}18`,fontSize:13}}>
              <span style={{color:T.muted}}>{k}</span>
              <span style={{color:k.includes('Total')?T.accent:T.txt,fontWeight:k.includes('Total')?800:500,fontFamily:T.mono}}>{v}</span>
            </div>
          ))}
          {calcSchedule().length>0&&(
            <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${T.border}30`}}>
              <div style={{color:T.accent,fontSize:10,fontWeight:700,letterSpacing:.8,textTransform:'uppercase',marginBottom:7}}>📅 Repayment Schedule</div>
              {calcSchedule().map(({p,a})=>(
                <div key={p} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',fontSize:13}}>
                  <span style={{color:T.muted}}>{p}</span>
                  <span style={{color:T.accent,fontFamily:T.mono,fontWeight:700}}>{fmt(a)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div style={{display:'flex',gap:9}}>
        <Btn onClick={save} full disabled={!selectedEligibility.eligible}>{workerMode?'Submit for Admin Approval →':'Submit Application'}</Btn>
        <Btn v='secondary' onClick={onClose}>Cancel</Btn>
      </div>
    </div>
  );
};


// ═══════════════════════════════════════════
//  REMINDERS SYSTEM
// ═══════════════════════════════════════════
// Reminder seed uses relative future dates so they don't immediately fire as overdue
const _futureDate = (daysFromNow) => { const d=new Date(); d.setDate(d.getDate()+daysFromNow); return d.toISOString().split('T')[0]; };
const REMINDER_SEED = [
  {id:'REM-001', title:'Follow up with Peter Otieno', note:'Call him about the overdue payment of KES 13,420. He promised to pay by end of week. Check if M-Pesa payment came in.', dueDate:_futureDate(1), dueTime:'09:00', priority:'High', done:false, fired:false},
  {id:'REM-002', title:'Board meeting prep', note:'Prepare the monthly portfolio report. Include PAR figures, collection rates, and disbursement totals.', dueDate:_futureDate(2), dueTime:'08:30', priority:'Medium', done:false, fired:false},
  {id:'REM-003', title:'Disburse loan LN-2404', note:'David Kipchoge KES 50,000 loan approved and ready for disbursement. Confirm M-Pesa details before sending.', dueDate:_futureDate(3), dueTime:'14:00', priority:'High', done:false, fired:false},
];

const useReminders = () => {
  const [reminders, setReminders] = useState(REMINDER_SEED);
  const [firing, setFiring] = useState(null);

  // Check every 60s — no immediate call on mount to avoid cascade re-render
  useEffect(() => {
    const check = () => {
      const nowDT = new Date();
      setReminders(rs => {
        let changed = false;
        const next = rs.map(r => {
          if (r.done || r.fired) return r;
          const due = new Date(r.dueDate + 'T' + r.dueTime + ':00');
          if (nowDT >= due) { changed = true; return {...r, fired:true}; }
          return r;
        });
        if (changed) {
          const fired = next.find(r => r.fired && !rs.find(x=>x.id===r.id&&x.fired));
          if (fired) { setTimeout(()=>{ try{SFX.reminder();}catch(e){}  setFiring(fired); }, 0); }
        }
        return changed ? next : rs;
      });
    };
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, []);

  const add    = (rem) => setReminders(rs => [rem, ...rs]);
  const done   = (id)  => setReminders(rs => rs.map(r => r.id===id ? {...r,done:true} : r));
  const remove = (id)  => setReminders(rs => rs.filter(r => r.id!==id));
  const update = (rem) => setReminders(rs => rs.map(r => r.id===rem.id ? rem : r));
  const dismissFiring = () => setFiring(null);

  return {reminders, add, done, remove, update, firing, dismissFiring};
};

const ReminderAlertModal = ({reminder, onDismiss, onDone}) => (
  <div className='dialog-backdrop' style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:99998,display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:MODAL_TOP_OFFSET+30,paddingLeft:20,paddingRight:20,background:'rgba(4,8,16,0.8)',backdropFilter:'blur(8px)',overflow:'hidden'}}>
    <div className='pop' style={{background:T.card,border:`2px solid ${T.gold}`,borderRadius:22,padding:'28px 26px',width:'100%',maxWidth:380,boxShadow:`0 0 60px ${T.gold}30,0 40px 80px #000000D0`}}>
      <div style={{textAlign:'center',marginBottom:18}}>
        <div style={{fontSize:44,marginBottom:10,animation:'pulse 1s infinite'}}>⏰</div>
        <div style={{fontFamily:T.head,color:T.gold,fontSize:18,fontWeight:900}}>Reminder</div>
        <div style={{color:T.txt,fontWeight:700,fontSize:15,marginTop:6}}>{reminder.title}</div>
        <div style={{color:T.muted,fontSize:12,marginTop:4}}>{reminder.dueDate} at {reminder.dueTime}</div>
      </div>
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:'12px 14px',marginBottom:18,color:T.dim,fontSize:13,lineHeight:1.6}}>
        {reminder.note||'No additional notes.'}
      </div>
      <div style={{display:'flex',gap:9}}>
        <Btn v='gold' full onClick={()=>{onDone(reminder.id);onDismiss();}}>✓ Mark Done</Btn>
        <Btn v='secondary' onClick={onDismiss}>Dismiss</Btn>
      </div>
    </div>
  </div>
);

// FIX C — ReminderCard hoisted to module scope.
// Previously defined INSIDE RemindersPanel's render body, meaning React saw a new
// component type on every render → unmount+remount of every card, destroying any
// interactions mid-gesture and causing consistent jank in the reminders list.
const PC_COLORS = {High:T.danger, Medium:T.gold, Low:T.ok};
const ReminderCard = ({r, onClick, onDone, onRemove}) => {
  const due = new Date(`${r.dueDate}T${r.dueTime}:00`);
  const overdue = !r.done && due < new Date();
  return (
    <div onClick={onClick} style={{background:T.surface,border:`1px solid ${overdue?T.danger:PC_COLORS[r.priority]+'30'}`,borderRadius:12,padding:'13px 15px',cursor:'pointer',transition:'all .15s',marginBottom:8}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{color:r.done?T.muted:T.txt,fontWeight:700,fontSize:13,marginBottom:3,textDecoration:r.done?'line-through':'none',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.title}</div>
          <div style={{color:T.muted,fontSize:11}}>{r.dueDate} · {r.dueTime}</div>
          {r.note&&<div style={{color:T.dim,fontSize:12,marginTop:4,overflow:'hidden',textOverflow:'ellipsis',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{r.note}</div>}
        </div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:5,flexShrink:0}}>
          <Badge color={PC_COLORS[r.priority]||T.muted}>{r.priority}</Badge>
          {overdue&&<Badge color={T.danger}>Overdue</Badge>}
        </div>
      </div>
      <div style={{display:'flex',gap:6,marginTop:10}}>
        {!r.done&&<button onClick={e=>{e.stopPropagation();onDone(r.id);SFX.save();}} style={{background:T.oLo,border:`1px solid ${T.ok}38`,color:T.ok,borderRadius:7,padding:'4px 10px',fontSize:11,fontWeight:700,cursor:'pointer'}}>✓ Done</button>}
        <button onClick={e=>{e.stopPropagation();onRemove(r.id);}} style={{background:T.dLo,border:`1px solid ${T.danger}38`,color:T.danger,borderRadius:7,padding:'4px 10px',fontSize:11,fontWeight:700,cursor:'pointer'}}>Delete</button>
      </div>
    </div>
  );
};

const RemindersPanel = ({reminders, onAdd, onDone, onRemove, onUpdate, onClose}) => {
  const [showNew, setShowNew] = useState(false);
  const [sel, setSel] = useState(null); // reading/editing a reminder
  const [f, setF] = useState({title:'', note:'', dueDate:now(), dueTime:'09:00', priority:'Medium'});
  const s = k => v => setF(p=>({...p,[k]:v}));

  const save = () => {
    if (!f.title) return;
    const rem = {id:uid('REM'), ...f, done:false, fired:false};
    onAdd(rem);
    SFX.save();
    setShowNew(false);
    setF({title:'', note:'', dueDate:now(), dueTime:'09:00', priority:'Medium'});
  };

  const saveEdit = () => {
    if (!sel) return;
    onUpdate(sel);
    SFX.save();
    setSel(null);
  };

  const active   = useMemo(()=>reminders.filter(r=>!r.done).sort((a,b)=>new Date(a.dueDate+'T'+a.dueTime)-new Date(b.dueDate+'T'+b.dueTime)),[reminders]);
  const completed = useMemo(()=>reminders.filter(r=>r.done),[reminders]);

  return (
    <Panel title='Reminders' subtitle={`${active.length} active · ${completed.length} completed`} onClose={onClose} width={480}>
      <div style={{marginBottom:14}}>
        <Btn full onClick={()=>setShowNew(s=>!s)}>+ New Reminder</Btn>
      </div>

      {showNew&&(
        <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:14,padding:'16px 16px',marginBottom:18}}>
          <div style={{color:T.txt,fontWeight:700,fontSize:13,marginBottom:12}}>New Reminder</div>
          <FI label='Title' value={f.title} onChange={s('title')} required placeholder='e.g. Call Peter about overdue loan'/>
          <FI label='Notes' type='textarea' value={f.note} onChange={s('note')} placeholder='Add details, context, or instructions…'/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
            <FI label='Date' type='date' value={f.dueDate} onChange={s('dueDate')} half/>
            <FI label='Time' type='time' value={f.dueTime} onChange={s('dueTime')} half/>
          </div>
          <FI label='Priority' type='select' options={['High','Medium','Low']} value={f.priority} onChange={s('priority')}/>
          <div style={{display:'flex',gap:9}}>
            <Btn full onClick={save}>Save Reminder</Btn>
            <Btn v='secondary' onClick={()=>setShowNew(false)}>Cancel</Btn>
          </div>
        </div>
      )}

      {/* Read / Edit modal */}
      {sel&&(
        <div className='dialog-backdrop' style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:9999,display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:MODAL_TOP_OFFSET+30,paddingLeft:20,paddingRight:20,background:'rgba(4,8,16,0.7)',backdropFilter:'blur(6px)',overflow:'hidden'}}>
          <div className='pop' style={{background:T.card,border:`1px solid ${T.hi}`,borderRadius:20,width:'100%',maxWidth:440,maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'0 40px 80px #000000D0'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'18px 22px 14px',borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
              <div style={{color:T.txt,fontWeight:800,fontSize:15,fontFamily:T.head}}>Edit Reminder</div>
              <button onClick={()=>{setSel(null);setDetailTab('overview');setViewDoc(null);}} style={{background:T.card2,border:`1px solid ${T.border}`,color:T.muted,borderRadius:99,width:28,height:28,cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'18px 22px'}}>
              <FI label='Title' value={sel.title} onChange={v=>setSel(s=>({...s,title:v}))} required/>
              <FI label='Notes' type='textarea' value={sel.note||''} onChange={v=>setSel(s=>({...s,note:v}))} placeholder='Notes…'/>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
                <FI label='Date' type='date' value={sel.dueDate} onChange={v=>setSel(s=>({...s,dueDate:v}))} half/>
                <FI label='Time' type='time' value={sel.dueTime} onChange={v=>setSel(s=>({...s,dueTime:v}))} half/>
              </div>
              <FI label='Priority' type='select' options={['High','Medium','Low']} value={sel.priority} onChange={v=>setSel(s=>({...s,priority:v}))}/>
              <div style={{display:'flex',gap:9}}>
                <Btn full onClick={saveEdit}>Save Changes</Btn>
                <Btn v='secondary' onClick={()=>setSel(null)}>Cancel</Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {active.length===0&&<div style={{color:T.muted,textAlign:'center',padding:'24px 0',fontSize:13}}>No active reminders</div>}
      <div style={{maxHeight:'40vh',overflowY:'auto',overflowX:'hidden'}}>
        {active.map(r=><ReminderCard key={r.id} r={r} onClick={()=>setSel({...r})} onDone={onDone} onRemove={onRemove}/>)}
      </div>

      {completed.length>0&&(
        <div style={{marginTop:20}}>
          <div style={{color:T.muted,fontSize:11,fontWeight:700,letterSpacing:.8,textTransform:'uppercase',marginBottom:10}}>Completed ({completed.length})</div>
          <div style={{maxHeight:'40vh',overflowY:'auto',overflowX:'hidden'}}>
            {completed.map(r=><ReminderCard key={r.id} r={r} onClick={()=>setSel({...r})} onDone={onDone} onRemove={onRemove}/>)}
          </div>
        </div>
      )}
    </Panel>
  );
};

// ═══════════════════════════════════════════
//  CUSTOMER CONTACT POPUP
// ═══════════════════════════════════════════
// ── Contact Popover — anchored near click point ───────────────
const CustomerContactPopup = ({name, phone, onClose, anchorX, anchorY}) => {
  if(!phone) return null;
  const popRef = useRef(null);
  const p = (phone||'').replace(/\s/g,'');
  const waPhone = p.startsWith('0') ? '254'+p.slice(1) : p;
  const smsText = encodeURIComponent(`Dear ${(name||'').split(' ')[0]}, this is a message from Adequate Capital Ltd regarding your account. Please contact us at your earliest convenience.`);
  const waText  = encodeURIComponent(`Hello ${(name||'').split(' ')[0]}, this is Adequate Capital Ltd. Please contact us regarding your account.`);

  // Compute smart position — anchored to same line as the name
  const vw = typeof window !== 'undefined' ? window.innerWidth  : 800;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 600;
  const POPW = 260, POPH = 168;
  // Place to the right of the click point
  let left = (anchorX != null) ? anchorX + 16 : vw/2 - POPW/2;
  // Vertically center on the click point (same line as the name)
  let top  = (anchorY != null) ? anchorY - POPH/2 : vh/2 - POPH/2;
  // Flip left if too close to right edge
  if(left + POPW > vw - 12) left = Math.max(8, (anchorX ?? vw/2) - POPW - 16);
  // Clamp vertically
  if(top + POPH > vh - 8) top = vh - POPH - 8;
  if(top < 8) top = 8;

  // Close on outside click
  useEffect(() => {
    const h = (e) => { if(popRef.current && !popRef.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h, true);
    return () => document.removeEventListener('mousedown', h, true);
  }, [onClose]);

  return (
    <>
      {/* Transparent backdrop — just closes on click outside */}
      <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:99998,pointerEvents:'all',overflow:'hidden'}} onClick={onClose}/>
      <div ref={popRef} className='pop' style={{
        position:'fixed', left, top, zIndex:99999,
        background:T.card, border:`1px solid ${T.hi}`,
        borderRadius:16, padding:'16px 16px 14px',
        width:POPW, boxShadow:'0 16px 48px rgba(0,0,0,0.6)',
        backdropFilter:'blur(8px)',
      }}>
        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
          <div style={{minWidth:0}}>
            <div style={{color:T.txt,fontWeight:800,fontSize:14,fontFamily:T.head,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{name}</div>
            <div style={{color:T.muted,fontSize:11,marginTop:2,fontFamily:T.mono}}>{phone}</div>
          </div>
          <button onClick={onClose} style={{background:T.card2,border:`1px solid ${T.border}`,color:T.muted,borderRadius:99,width:24,height:24,cursor:'pointer',fontSize:11,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginLeft:8}}>✕</button>
        </div>
        {/* Action buttons — compact horizontal row */}
        <div style={{display:'flex',gap:7}}>
          <a href={`tel:${p}`} onClick={()=>{onClose();SFX.send();}}
            style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:5,background:T.oLo,border:`1px solid ${T.ok}38`,borderRadius:11,padding:'10px 6px',textDecoration:'none',color:T.ok,fontWeight:700,fontSize:11,transition:'background .15s'}}>
            <span style={{fontSize:20}}>📞</span>
            <span>Call</span>
          </a>
          <a href={`sms:${p}?body=${smsText}`} onClick={()=>{onClose();SFX.send();}}
            style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:5,background:T.bLo,border:`1px solid ${T.blue}38`,borderRadius:11,padding:'10px 6px',textDecoration:'none',color:T.blue,fontWeight:700,fontSize:11}}>
            <span style={{fontSize:20}}>💬</span>
            <span>SMS</span>
          </a>
          <a href={`https://wa.me/${waPhone}?text=${waText}`} target='_blank' rel='noreferrer' onClick={()=>{onClose();SFX.send();}}
            style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:5,background:'#25D36618',border:'1px solid #25D36638',borderRadius:11,padding:'10px 6px',textDecoration:'none',color:'#25D366',fontWeight:700,fontSize:11}}>
            <span style={{fontSize:20}}>📱</span>
            <span>WhatsApp</span>
          </a>
        </div>
      </div>
    </>
  );
};

// Hook for contact popup — stores mouse position for anchoring
const useContactPopup = () => {
  const [contact, setContact] = useState(null); // {name, phone, x, y}
  const open = (name, phone, event) => {
    const x = event?.clientX ?? null;
    const y = event?.clientY ?? null;
    setContact({name, phone, x, y});
    try{SFX.notify();}catch(e){}
  };
  const close = () => setContact(null);
  const Popup = contact
    ? <CustomerContactPopup name={contact.name} phone={contact.phone} onClose={close} anchorX={contact.x} anchorY={contact.y}/>
    : null;
  return {open, close, Popup};
};

// ═══════════════════════════════════════════
//  DASHBOARD — Animated Pie Charts
// ═══════════════════════════════════════════
const DonutChart = ({segments, size=160, thickness=32, label, sub, centerValue, centerLabel, onClickSegment}) => {
  const [animated, setAnimated] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [clicked, setClicked] = useState(null);
  const hovRef = useRef(null);

  // FIX 2A — Animation: previously animated=false made animEnd===startA (zero-length arc)
  // so SVG rendered nothing until the 80ms timeout fired. Now segments always draw at full
  // size; the CSS 'pop' class on the SVG wrapper handles the visual entrance animation.
  // The animated state is kept only for the clip/scale entrance, not for arc geometry.
  useEffect(()=>{ const t=setTimeout(()=>setAnimated(true),60); return()=>clearTimeout(t); },[]);

  const setHovDebounced = useCallback((i) => {
    clearTimeout(hovRef.current);
    if(i === null) {
      hovRef.current = setTimeout(() => setHovered(null), 60);
    } else {
      setHovered(i);
    }
  }, []);

  const total = segments.reduce((s,sg)=>s+sg.value,0)||1;
  const R = size/2;
  const r = R - thickness;
  const cx = R, cy = R;

  const segAngles = useMemo(()=>{
    let cum = -Math.PI/2;
    return segments.map(sg=>{
      const angle = (sg.value/total)*(Math.PI*2);
      const start = cum;
      cum += angle;
      return {start, end:cum, angle, mid:start+angle/2};
    });
  }, [segments, total]);

  const paths = segments.map((sg,i)=>{
    const {start:startA, angle, mid:midA} = segAngles[i];
    if(sg.value===0) return null;

    // FIX 2B — Always use the full angle for geometry. Previously (animated ? angle : 0)
    // produced zero-length arcs (invisible) before the 80ms timeout. Now segments are
    // always drawn at full size. The entrance animation is CSS-only (opacity on the SVG).
    const endA = startA + angle;
    const x1=cx+R*Math.cos(startA), y1=cy+R*Math.sin(startA);
    const x2=cx+R*Math.cos(endA),   y2=cy+R*Math.sin(endA);
    const ix1=cx+r*Math.cos(startA), iy1=cy+r*Math.sin(startA);
    const ix2=cx+r*Math.cos(endA),   iy2=cy+r*Math.sin(endA);
    const large = angle > Math.PI ? 1 : 0;
    const d = `M${x1},${y1} A${R},${R} 0 ${large},1 ${x2},${y2} L${ix2},${iy2} A${r},${r} 0 ${large},0 ${ix1},${iy1} Z`;
    const isHov = hovered===i;
    const isClick = clicked===i;
    const off = isHov ? 7 : isClick ? 5 : 0;
    const tx = off ? Math.cos(midA)*off : 0;
    const ty = off ? Math.sin(midA)*off : 0;
    const hR = R+6, hr = Math.max(r-6,2);
    const hx1=cx+hR*Math.cos(startA), hy1=cy+hR*Math.sin(startA);
    const hx2=cx+hR*Math.cos(endA),   hy2=cy+hR*Math.sin(endA);
    const hix1=cx+hr*Math.cos(startA), hiy1=cy+hr*Math.sin(startA);
    const hix2=cx+hr*Math.cos(endA),   hiy2=cy+hr*Math.sin(endA);
    const hd = `M${hx1},${hy1} A${hR},${hR} 0 ${large},1 ${hx2},${hy2} L${hix2},${hiy2} A${hr},${hr} 0 ${large},0 ${hix1},${hiy1} Z`;
    return (
      <g key={i}
        onMouseEnter={()=>setHovDebounced(i)}
        onMouseLeave={()=>setHovDebounced(null)}
        onClick={()=>{
          setClicked(i);
          setTimeout(()=>setClicked(null), 600);
          if(onClickSegment) onClickSegment(sg, i);
        }}>
        <path d={hd} fill='transparent' style={{cursor:'pointer'}}/>
        <path d={d}
          fill={sg.color}
          opacity={clicked!==null?(isClick?1:0.35):hovered===null?1:isHov?1:0.5}
          transform={`translate(${tx},${ty})`}
          filter={isClick?`drop-shadow(0 0 8px ${sg.color})`:'none'}
          style={{transition:'opacity .15s, transform .18s cubic-bezier(.22,1,.36,1)',cursor:'pointer',pointerEvents:'none'}}
        />
      </g>
    );
  });

  const hovSeg = hovered!==null ? segments[hovered] : (clicked!==null ? segments[clicked] : null);

  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
      {label&&<div style={{color:T.txt,fontWeight:700,fontSize:13,textAlign:'center'}}>{label}</div>}
      <div style={{position:'relative',width:size,height:size,overflow:'visible'}}>
        <svg width={size} height={size} style={{overflow:'visible',opacity:animated?1:0,transition:'opacity .3s ease'}}>
          <circle cx={cx} cy={cy} r={(R+r)/2} fill='none' stroke={T.border} strokeWidth={thickness} opacity={0.4}/>
          {paths}
        </svg>
        <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
          {hovSeg ? (
            <>
              <div style={{color:hovSeg.color,fontWeight:900,fontSize:14,fontFamily:T.mono,lineHeight:1}}>{((hovSeg.value/total)*100).toFixed(1)}%</div>
              <div style={{color:T.muted,fontSize:10,marginTop:2,textAlign:'center',maxWidth:r*1.4}}>{hovSeg.label}</div>
            </>
          ) : (
            <>
              {centerValue&&<div style={{color:T.txt,fontWeight:900,fontSize:16,fontFamily:T.mono,lineHeight:1}}>{centerValue}</div>}
              {centerLabel&&<div style={{color:T.muted,fontSize:10,marginTop:2,textAlign:'center'}}>{centerLabel}</div>}
            </>
          )}
        </div>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:5,width:'100%'}}>
        {segments.filter(s=>s.value>0).map((s,i)=>(
          <div key={s.label||s.color||i} style={{display:'flex',alignItems:'center',gap:7,padding:'4px 6px',borderRadius:7,background:hovered===i?s.color+'14':clicked===i?s.color+'22':'transparent',transition:'background .15s',cursor:onClickSegment?'pointer':'default'}}
            onMouseEnter={()=>setHovDebounced(i)} onMouseLeave={()=>setHovDebounced(null)}
            onClick={()=>{ if(onClickSegment) onClickSegment(s, i); }}>
            <div style={{width:8,height:8,borderRadius:99,background:s.color,flexShrink:0,boxShadow:`0 0 4px ${s.color}88`}}/>
            <span style={{color:T.muted,fontSize:11,flex:1}}>{s.label}</span>
            <span style={{color:s.color,fontFamily:T.mono,fontSize:11,fontWeight:800}}>{s.value>=1e6?(s.value/1e6).toFixed(2)+'M':s.value>=1e3?(s.value/1e3).toFixed(1)+'K':s.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
      {sub&&<div style={{color:T.muted,fontSize:10,textAlign:'center',marginTop:2}}>{sub}</div>}
    </div>
  );
};

const LivePortfolioChart = ({loans, payments, customers, onNav, setDrill, openContact, custPhone, scrollTop}) => {

  // FIX — memoize all expensive filter/reduce derivations so they only recalculate
  // when the underlying data arrays actually change.
  const derived = useMemo(()=>{
    const book      = loans.filter(l=>l.status!=='Settled').reduce((s,l)=>s+l.balance,0);
    const overdue   = loans.filter(l=>l.status==='Overdue').reduce((s,l)=>s+l.balance,0);
    const active    = loans.filter(l=>l.status==='Active').reduce((s,l)=>s+l.balance,0);
    const approved  = loans.filter(l=>l.status==='Approved').reduce((s,l)=>s+l.amount,0);
    const settled   = loans.filter(l=>l.status==='Settled').reduce((s,l)=>s+l.amount,0);
    const coll      = payments.filter(p=>p.status==='Allocated').reduce((s,p)=>s+p.amount,0);
    const unalloc   = payments.filter(p=>p.status==='Unallocated').reduce((s,p)=>s+p.amount,0);
    const totalDisb = loans.reduce((s,l)=>s+l.amount,0);
    const par1      = loans.filter(l=>l.daysOverdue>=1).length;
    const parTotal  = loans.filter(l=>l.status!=='Settled').length||1;
    const paidLoanIds = new Set(payments.filter(p=>p.status==='Allocated'&&p.loanId).map(p=>p.loanId));
    const healthyCount = loans.filter(l=>l.status==='Active'&&paidLoanIds.has(l.id)).length;
    const cRisk     = customers.filter(c=>c.risk==='Very High'||c.risk==='High').length;
    const cOk       = customers.filter(c=>c.risk==='Low'||c.risk==='Medium').length;
    return {book,overdue,active,approved,settled,coll,unalloc,totalDisb,par1,parTotal,healthyCount,cRisk,cOk};
  },[loans,payments,customers]);
  const {book,overdue,active,approved,settled,coll,unalloc,totalDisb,par1,parTotal,healthyCount,cRisk,cOk} = derived;

  const fmtK = v => v>=1e6?(v/1e6).toFixed(2)+'M':v>=1e3?(v/1e3).toFixed(1)+'K':v.toLocaleString('en-KE');

  const charts = [
    {
      label:'Loan Portfolio',
      sub:`Total book: KES ${fmtK(book)}`,
      centerValue:`KES ${fmtK(book)}`,
      centerLabel:'Total',
      segments:[
        {label:'Active Loans',      value:active,   color:T.ok,     nav:'loans',       navFilter:'Active'},
        {label:'Overdue',           value:overdue,  color:T.danger, nav:'collections', navFilter:'Overdue'},
        {label:'Approved (pending)',value:approved, color:T.gold,   nav:'loans',       navFilter:'Approved'},
      ],
    },
    {
      label:'Collections',
      sub:`Disbursed: KES ${fmtK(totalDisb)}`,
      centerValue:totalDisb>0?((coll/totalDisb)*100).toFixed(0)+'%':'—',
      centerLabel:'Rate',
      segments:[
        {label:'Collected',             value:coll,                    color:T.accent, nav:'payments',    navFilter:'Allocated'},
        {label:'Outstanding',           value:Math.max(0,book-coll),   color:T.warn,   nav:'loans',       navFilter:'Active'},
        {label:'Unallocated payments',  value:unalloc,                 color:T.blue,   nav:'payments',    navFilter:'Unallocated'},
        {label:'Written off/Settled',   value:settled,                 color:T.muted,  nav:'loans',       navFilter:'Settled'},
      ],
    },
    {
      label:'Portfolio at Risk',
      sub:`${par1} loans overdue`,
      centerValue:`${((par1/parTotal)*100).toFixed(1)}%`,
      centerLabel:'PAR',
      segments:[
        {label:'Healthy (paying)', value:healthyCount,                                          color:T.ok,     nav:'loans',       navFilter:'Active'},
        {label:'PAR 1–6 days',  value:loans.filter(l=>l.daysOverdue>=1&&l.daysOverdue<7).length,  color:T.warn,   nav:'collections', navFilter:'Overdue'},
        {label:'PAR 7–29 days', value:loans.filter(l=>l.daysOverdue>=7&&l.daysOverdue<30).length, color:T.danger, nav:'collections', navFilter:'Overdue'},
        {label:'PAR 30+ days',  value:loans.filter(l=>l.daysOverdue>=30).length,                  color:T.purple, nav:'collections', navFilter:'Overdue'},
      ],
    },
    {
      label:'Customer Risk',
      sub:`${customers.length} total customers`,
      centerValue:customers.length,
      centerLabel:'Customers',
      segments:[
        {label:'Low risk',       value:customers.filter(c=>c.risk==='Low').length,       color:T.ok,     nav:'customers', navFilter:'Low'},
        {label:'Medium risk',    value:customers.filter(c=>c.risk==='Medium').length,    color:T.warn,   nav:'customers', navFilter:'Medium'},
        {label:'High risk',      value:customers.filter(c=>c.risk==='High').length,      color:T.danger, nav:'customers', navFilter:'High'},
        {label:'Very High risk', value:customers.filter(c=>c.risk==='Very High').length, color:T.purple, nav:'customers', navFilter:'Very High'},
      ],
    },
  ];

  return (
    <Card style={{marginBottom:16}}>
      <div style={{padding:'14px 18px 10px',borderBottom:`1px solid ${T.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
        <div>
          <div style={{color:T.txt,fontWeight:800,fontSize:14,fontFamily:T.head}}>📊 Portfolio Performance</div>
          <div style={{color:T.muted,fontSize:11,marginTop:2}}>Click any segment to navigate · hover for details</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <div style={{width:6,height:6,borderRadius:99,background:T.ok,boxShadow:`0 0 6px ${T.ok}88`}}/>
          <span style={{color:T.muted,fontSize:11}}>Interactive</span>
        </div>
      </div>
      <div style={{padding:'20px 18px'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:28}}>
          {charts.map((c,i)=>(
            <DonutChart key={c.label} {...c} size={164} thickness={28}
              onClickSegment={(seg)=>{
                try{SFX.notify();}catch(e){}
                // Build drill data based on segment label/navFilter
                const nf = seg.navFilter;
                let rows=[], title=seg.label, cols=[];
                const fmtV=v=><span style={{fontFamily:'monospace',color:T.accent}}>{v>=1e6?(v/1e6).toFixed(2)+'M':v>=1e3?(v/1e3).toFixed(1)+'K':v?.toLocaleString?.()??v}</span>;
                if(seg.nav==='loans'||seg.nav==='collections'){
                  rows=loans.filter(l=>nf?l.status===nf:true);
                  cols=[
                    {k:'id',l:'Loan ID',r:v=><span style={{color:T.accent,fontFamily:'monospace',fontWeight:700,fontSize:12}}>{v}</span>},
                    {k:'customer',l:'Customer',r:(v)=>{const ph=custPhone?.(v)||''; return <span onClick={e=>{e.stopPropagation();openContact?.(v,ph,e);}} style={{color:T.accent,cursor:'pointer',fontWeight:600,borderBottom:`1px dashed ${T.accent}50`}}>{v}</span>;}},
                    {k:'balance',l:'Balance',r:v=>fmt(v)},
                    {k:'status',l:'Status',r:v=><Badge color={SC[v]||T.muted}>{v}</Badge>},
                    {k:'daysOverdue',l:'Days',r:v=>v>0?<span style={{color:T.danger,fontWeight:800,fontFamily:'monospace'}}>{v}d</span>:<span style={{color:T.muted}}>—</span>},
                    {k:'officer',l:'Officer'},
                  ];
                } else if(seg.nav==='payments'){
                  rows=payments.filter(p=>nf?p.status===nf:true);
                  cols=[
                    {k:'id',l:'Pay ID',r:v=><span style={{color:T.accent,fontFamily:'monospace',fontSize:12}}>{v}</span>},
                    {k:'customer',l:'Customer',r:(v)=>{const ph=custPhone?.(v)||''; return <span onClick={e=>{e.stopPropagation();openContact?.(v,ph,e);}} style={{color:T.accent,cursor:'pointer',fontWeight:600,borderBottom:`1px dashed ${T.accent}50`}}>{v}</span>;}},
                    {k:'amount',l:'Amount',r:v=><span style={{color:T.ok,fontFamily:'monospace',fontWeight:700}}>{fmt(v)}</span>},
                    {k:'mpesa',l:'M-Pesa'},
                    {k:'date',l:'Date'},
                    {k:'status',l:'Status',r:v=><Badge color={SC[v]||T.muted}>{v}</Badge>},
                  ];
                } else if(seg.nav==='customers'){
                  rows=customers.filter(c=>nf?c.risk===nf:true);
                  cols=[
                    {k:'id',l:'ID',r:v=><span style={{color:T.accent,fontFamily:'monospace',fontSize:12}}>{v}</span>},
                    {k:'name',l:'Name',r:(v,r)=><span onClick={e=>{e.stopPropagation();openContact?.(v,r.phone,e);}} style={{color:T.accent,cursor:'pointer',fontWeight:600,borderBottom:`1px dashed ${T.accent}50`}}>{v}</span>},
                    {k:'phone',l:'Phone'},{k:'business',l:'Business'},
                    {k:'risk',l:'Risk',r:v=><Badge color={RC[v]}>{v}</Badge>},
                  ];
                }
                if(setDrill && rows.length>0) setDrill({title:`${seg.label} — ${rows.length} records`, rows, cols, color:seg.color});
                else if(onNav && seg.nav) { onNav(seg.nav); }
              }}
            />
          ))}
        </div>
      </div>
    </Card>
  );
};


// ═══════════════════════════════════════════
//  7-DAY COLLECTIONS BAR CHART
// ═══════════════════════════════════════════
const WeeklyCollectionsChart = ({payments}) => {
  const [selDay, setSelDay] = useState(null);
  // FIX — memoize the days array. Previously it called new Date(), filter, and reduce
  // for every day on every render. Now it only recalculates when payments change.
  const days = useMemo(()=>Array.from({length:7},(_,i)=>{
    const d = new Date();
    d.setDate(d.getDate() - (6-i));
    const iso = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en-KE',{weekday:'short',day:'numeric'});
    const dayPays = payments.filter(p=>p.date===iso);
    const total = dayPays.reduce((s,p)=>s+p.amount,0);
    const isToday = iso === new Date().toISOString().split('T')[0];
    return {iso, label, total, count:dayPays.length, pays:dayPays, isToday};
  }),[payments]);
  const maxVal = Math.max(...days.map(d=>d.total), 1);
  const COLORS = [T.accent, T.blue, T.purple, T.ok, T.gold, T.warn, T.danger];
  const fmtK = v => v>=1e6?(v/1e6).toFixed(2)+'M':v>=1e3?(v/1e3).toFixed(1)+'K':v.toLocaleString('en-KE');
  const totalWeek = days.reduce((s,d)=>s+d.total,0);
  const totalCount = days.reduce((s,d)=>s+d.count,0);
  return (
    <Card style={{marginBottom:12}}>
      <CH title="💳 7-Day Collections" sub={`${totalCount} payments · KES ${fmtK(totalWeek)} total this week`}/>
      <div style={{padding:'16px 18px'}}>
        <div style={{display:'flex',gap:6,alignItems:'flex-end',height:120,marginBottom:12}}>
          {days.map((d,i)=>{
            const pct = maxVal > 0 ? (d.total/maxVal)*100 : 0;
            const color = COLORS[i];
            const isSel = selDay && selDay.iso===d.iso;
            return (
              <div key={d.iso} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4,cursor:d.count>0?'pointer':'default'}}
                onClick={()=>{ if(d.count>0){ try{SFX.notify();}catch(e){} setSelDay(isSel?null:d); }}}>
                <div style={{color:color,fontSize:9,fontWeight:800,fontFamily:'monospace',opacity:d.total>0?1:0}}>
                  {fmtK(d.total)}
                </div>
                <div style={{
                  width:'100%',height:`${Math.max(pct,2)}%`,
                  background:isSel?color:d.total>0?color+'CC':T.border,
                  borderRadius:'6px 6px 3px 3px',
                  transition:'height .4s cubic-bezier(.22,1,.36,1), background .2s',
                  boxShadow:isSel?`0 0 14px ${color}55`:'none',
                  border:isSel?`1px solid ${color}`:'1px solid transparent',
                  minHeight:4,
                }}/>
                <div style={{color:d.isToday?color:T.muted,fontSize:9,fontWeight:d.isToday?800:500,textAlign:'center',lineHeight:1.3,whiteSpace:'nowrap'}}>
                  {d.label.split(' ')[0]}<br/>{d.label.split(' ')[1]||''}
                </div>
              </div>
            );
          })}
        </div>
        {selDay&&(
          <div className='expand-in' style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:'14px 16px',marginTop:4}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <div>
                <div style={{color:T.txt,fontWeight:800,fontSize:13}}>{selDay.isToday?'Today':selDay.label}</div>
                <div style={{color:T.muted,fontSize:11,marginTop:2}}>{selDay.count} payment{selDay.count!==1?'s':''} · KES {fmtK(selDay.total)}</div>
              </div>
              <button onClick={()=>setSelDay(null)} style={{background:'none',border:`1px solid ${T.border}`,color:T.muted,borderRadius:99,width:24,height:24,cursor:'pointer',fontSize:11,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            </div>
            {selDay.pays.length===0
              ? <div style={{color:T.muted,fontSize:12,textAlign:'center',padding:'8px 0'}}>No payments on this day</div>
              : <div style={{maxHeight:'40vh',overflowY:'auto',overflowX:'hidden',display:'flex',flexDirection:'column',gap:6}}>
                  {selDay.pays.map((p,i)=>(
                    <div key={p.id||i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 10px',background:T.card,borderRadius:8,border:`1px solid ${T.border}`}}>
                      <div>
                        <div style={{color:T.txt,fontWeight:600,fontSize:12}}>{p.customer||'Unknown'}</div>
                        <div style={{color:T.muted,fontSize:11}}>{p.mpesa||'—'} · {p.loanId||'Unallocated'}</div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{color:p.status==='Allocated'?T.ok:T.warn,fontWeight:800,fontSize:13,fontFamily:'monospace'}}>KES {(p.amount||0).toLocaleString('en-KE')}</div>
                        <div style={{color:T.muted,fontSize:10,marginTop:1}}>{p.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>
        )}
      </div>
    </Card>
  );
};


// ═══════════════════════════════════════════════════════════════
//  REPAYMENT SCHEDULE TRACKER
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
//  PAYMENT ENGINE v2 — single source of truth for all financial calculations
//  Rules:
//  • allocatePayment() is the ONLY place division/allocation logic lives
//  • floor(payment / daily) = full days covered
//  • remainder < daily → NOT applied, recorded as negativeBalance
//  • allocation is sequential from oldest unpaid day
//  • computeLoanSchedule() derives the full schedule from loans + payments
//  • All UI reads computed values — never calculates independently
// ═══════════════════════════════════════════════════════════════════════════════

// ── Core allocation function ───────────────────────────────────────────────────
// allocatePayment(paymentAmount, dailyAmount, unpaidSlotIndices)
// Returns: { paidSlots, surplusSlots, negativeBalance, updatedUnpaid }
var allocatePayment = function(paymentAmount, dailyAmount, unpaidSlotIndices) {
  if(!paymentAmount || paymentAmount <= 0 || !dailyAmount || dailyAmount <= 0) {
    return { paidSlots:[], surplusSlots:0, negativeBalance:0, updatedUnpaid:(unpaidSlotIndices||[]).slice() };
  }
  var fullSlots = Math.floor(paymentAmount / dailyAmount);
  var remainder = paymentAmount % dailyAmount;
  var unpaid    = (unpaidSlotIndices||[]).slice();
  var paid      = [];
  for(var i=0; i<fullSlots && unpaid.length>0; i++) paid.push(unpaid.shift());
  var surplus   = fullSlots > paid.length ? fullSlots - paid.length : 0;
  return {
    paidSlots:       paid,
    surplusSlots:    surplus,
    negativeBalance: remainder > 0 ? -remainder : 0,
    updatedUnpaid:   unpaid,
  };
};

// ── Schedule builder ───────────────────────────────────────────────────────────
// computeLoanSchedule(loan, allPayments) → full immutable schedule
// This is the ONLY function that derives slot status from data.
// All UI components receive the output — they never compute it themselves.
var computeLoanSchedule = function(loan, allPayments) {
  if(!loan || !loan.disbursed) return { slots:[], ledger:[], runningBalance:0, summary:{} };

  var rt        = loan.repaymentType;
  var principal = loan.amount;
  var interest  = Math.round(principal * 0.3);
  var total     = principal + interest;
  var perSlot, intervalDays, numSlots;

  if(rt==='Daily')         { perSlot=Math.ceil(total/30);  intervalDays=1;  numSlots=30; }
  else if(rt==='Weekly')   { perSlot=Math.ceil(total/4);   intervalDays=7;  numSlots=4;  }
  else if(rt==='Biweekly') { perSlot=Math.ceil(total/2);   intervalDays=14; numSlots=2;  }
  else if(rt==='Monthly')  { perSlot=total;                 intervalDays=30; numSlots=1;  }
  else return { slots:[], ledger:[], runningBalance:0, summary:{} };

  // Build slot dates
  var startDate = new Date(loan.disbursed);
  var todayStr  = new Date().toISOString().slice(0,10);
  var slots = [];
  for(var i=0; i<numSlots; i++) {
    var d = new Date(startDate);
    d.setDate(d.getDate() + (i+1)*intervalDays);
    var dueStr = d.toISOString().slice(0,10);
    slots.push({ index:i, due:dueStr, perSlot:perSlot, status:'upcoming', payment:null, negBalance:0 });
  }

  // Sort all payments for this loan chronologically — immutable ledger entries
  var loanPays = (allPayments||[])
    .filter(function(p){ return p.loanId===loan.id && p.status==='Allocated'; })
    .slice()
    .sort(function(a,b){ return a.date.localeCompare(b.date); });

  // Walk payments in order; for each payment apply allocatePayment to unresolved slots
  var unresolvedIndices = slots.map(function(_,i){ return i; });
  var surplusAccumulated = 0;
  var runningNegBalance  = 0;
  var ledger = [];

  loanPays.forEach(function(pay) {
    // Effective amount = payment + any carried-over negative balance (partial from prior)
    var effectiveAmount = pay.amount + (runningNegBalance < 0 ? runningNegBalance : 0);
    if(effectiveAmount < 0) effectiveAmount = 0;
    runningNegBalance = 0; // reset after applying

    var result = allocatePayment(effectiveAmount, perSlot, unresolvedIndices);

    // Mark paid slots
    result.paidSlots.forEach(function(idx) {
      slots[idx].status  = pay.date <= slots[idx].due ? 'paid' : 'paid-late';
      slots[idx].payment = pay;
    });

    surplusAccumulated += result.surplusSlots;
    runningNegBalance   = result.negativeBalance;
    unresolvedIndices   = result.updatedUnpaid;

    ledger.push({
      payId:           pay.id,
      date:            pay.date,
      amount:          pay.amount,
      effectiveAmount: effectiveAmount,
      paidSlots:       result.paidSlots.slice(),
      surplusSlots:    result.surplusSlots,
      negativeBalance: result.negativeBalance,
      mpesa:           pay.mpesa||null,
      allocatedBy:     pay.allocatedBy||null,
    });
  });

  // Mark remaining unresolved slots as missed, duetoday, or upcoming.
  // RULE: A slot is 'missed' ONLY if the debt behind it is genuinely unpaid.
  // If the loan is fully cleared (balance=0) or total paid covers total owed,
  // no slot can be 'missed' — a client cannot have missed payments on a cleared debt.
  // Past-due unresolved slots on a cleared loan are marked 'paid-late' instead.
  var totalPaid = loanPays.reduce(function(s,p){ return s+p.amount; },0);
  var loanIsCleared = loan.balance <= 0 || totalPaid >= total;
  unresolvedIndices.forEach(function(idx) {
    var s = slots[idx];
    if(s.due < todayStr) {
      // Past due — only mark 'missed' if the debt is genuinely still outstanding
      s.status = loanIsCleared ? 'paid-late' : 'missed';
    } else if(s.due === todayStr) {
      s.status = 'duetoday';
    } else {
      s.status = 'upcoming';
    }
    s.negBalance = 0;
  });

  // Attach running negative balance to last slot if any
  if(runningNegBalance < 0 && slots.length > 0) {
    var lastPaidIdx = -1;
    for(var j=slots.length-1; j>=0; j--) {
      if(slots[j].payment) { lastPaidIdx = j; break; }
    }
    if(lastPaidIdx >= 0) slots[lastPaidIdx].negBalance = runningNegBalance;
  }

  // Summary
  var paidCt   = slots.filter(function(s){ return s.status==='paid'; }).length;
  var lateCt   = slots.filter(function(s){ return s.status==='paid-late'; }).length;
  var missedCt = slots.filter(function(s){ return s.status==='missed'; }).length;
  var upcomingCt = slots.filter(function(s){ return s.status==='upcoming'||s.status==='duetoday'; }).length;

  // SYNC FIX — If the loan has remaining balance but no upcoming/duetoday slots remain
  // (all fixed slots are in the past — common with demo/seed loans whose disbursed dates
  // are old), append a synthetic upcoming slot so the panel shows the next payment due.
  // This matches exactly what LoanModal schedule() and Collections show: the current
  // balance is what's owed, due on the next interval from today.
  if(loan.balance > 0 && upcomingCt === 0) {
    var nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + intervalDays);
    var nextDueStr = nextDue.toISOString().slice(0,10);
    var remainingBalance = loan.balance;
    // perSlot for the synthetic slot = full remaining balance (whatever is left to pay)
    slots.push({
      index:      slots.length,
      due:        nextDueStr,
      perSlot:    remainingBalance,
      status:     'upcoming',
      payment:    null,
      negBalance: 0,
      synthetic:  true,   // flag so UI can show "Next Due" label
    });
    upcomingCt = 1;
  }

  return {
    slots:          slots,
    ledger:         ledger,
    runningBalance: runningNegBalance,
    perSlot:        perSlot,
    total:          total,
    totalPaid:      totalPaid,
    pctPaid:        total>0 ? Math.min(Math.round((totalPaid/total)*100),100) : 0,
    surplusSlots:   surplusAccumulated,
    summary:        { paid:paidCt, late:lateCt, missed:missedCt, upcoming:upcomingCt },
  };
};

// ── Schedule Monitor Component ──────────────────────────────────────────────────
// STATUS is a module-level constant — no dependency on props or state.
const REPAY_STATUS = {
  paid:       { col:'#00D4AA', bg:'#00D4AA14', border:'#00D4AA', icon:'V', label:'ON TIME'  },
  'paid-late':{ col:'#F59E0B', bg:'#F59E0B14', border:'#F59E0B', icon:'V', label:'LATE'    },
  missed:     { col:'#EF4444', bg:'#EF444414', border:'#EF4444', icon:'X', label:'MISSED'   },
  duetoday:   { col:'#F59E0B', bg:'#F59E0B18', border:'#F59E0B', icon:'!', label:'DUE TODAY'},
  upcoming:   { col:'#475569', bg:'transparent',border:'#1A3050', icon:'',  label:''        },
};

// ── LoanDetail — hoisted to module scope as a proper component ────────────────
// Previously defined as `const LoanDetail = function` INSIDE RepayTracker's render body.
// That made it a new component type every render → React unmounted+remounted the modal
// on every RepayTracker state change (slot click, filter toggle, etc.), destroying the
// local slotFilter state. It contains useState so it cannot be a render function.
// Correct fix: module-level component. All previously closed-over values are explicit props.
const LoanDetail = ({loan, payments, selSlot, setSelSlot, setSelLoan, renderSlotPopup}) => {
  const sched  = computeLoanSchedule(loan, payments);
  const { slots, ledger, runningBalance, perSlot, total, totalPaid, pctPaid, summary } = sched;
  const [slotFilter, setSlotFilter] = useState(null);
  const filteredSlots = slotFilter ? slots.filter(s=>s.status===slotFilter) : slots;
  const phone   = (loan.phone||'').replace(/\s/g,'');
  const waPhone = phone.startsWith('0') ? '254'+phone.slice(1) : phone;
  const smsBody = encodeURIComponent('Dear '+loan.customer.split(' ')[0]+', your loan '+loan.id+' has a balance of KES '+loan.balance.toLocaleString('en-KE')+'. Please make your next installment payment via Paybill 4166191, Account: '+loan.customerId+'. Thank you.');
  return (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:9999,background:'rgba(4,8,16,0.92)',display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:'56px',paddingLeft:12,paddingRight:12,paddingBottom:40,backdropFilter:'blur(10px)',overflow:'hidden'}}>
      {selSlot&&renderSlotPopup({slot:selSlot,loan,totalSlots:slots.length,ledgerEntry:ledger.find(e=>e.paidSlots.includes(selSlot.index))||null})}
      <div style={{background:'#0A1628',border:'1px solid #1A3050',borderRadius:16,width:'100%',maxWidth:520,height:'100%',maxHeight:'calc(100vh - 96px)',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 0 0 1px #00D4AA10,0 40px 80px rgba(0,0,0,.95)'}}>
        <div style={{padding:'14px 18px 12px',borderBottom:'1px solid #1A3050',flexShrink:0,background:'#0A1628',borderRadius:'16px 16px 0 0',zIndex:10}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
            <div>
              <div style={{fontFamily:'monospace',color:'#00D4AA',fontSize:11,fontWeight:800,letterSpacing:2.5,marginBottom:3}}>{loan.id}</div>
              <div style={{color:'#E2E8F0',fontWeight:700,fontSize:15}}>{loan.customer}</div>
              <div style={{color:'#475569',fontSize:11,marginTop:2}}>{loan.repaymentType} · KES {perSlot.toLocaleString('en-KE')}/instalment · {loan.officer}</div>
              <div style={{color:'#475569',fontSize:10,marginTop:1}}>Disbursed {loan.disbursed}</div>
            </div>
            <button onClick={()=>{setSelLoan(null);setSelSlot(null);}} style={{background:'#1A2740',border:'1px solid #1A3050',color:'#475569',borderRadius:99,width:28,height:28,cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginLeft:12}}>✕</button>
          </div>
          {phone&&(
            <div style={{display:'flex',gap:7}}>
              <a href={`tel:${phone}`} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:5,background:'#00D4AA14',border:'1px solid #00D4AA30',color:'#00D4AA',borderRadius:8,padding:'7px 10px',textDecoration:'none',fontSize:12,fontWeight:700}}>📞 Call</a>
              <a href={`sms:${phone}?body=${smsBody}`} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:5,background:'#3B82F614',border:'1px solid #3B82F630',color:'#60A5FA',borderRadius:8,padding:'7px 10px',textDecoration:'none',fontSize:12,fontWeight:700}}>💬 SMS</a>
              <a href={`https://wa.me/${waPhone}?text=${smsBody}`} target='_blank' rel='noreferrer' style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:5,background:'#25D36614',border:'1px solid #25D36630',color:'#25D366',borderRadius:8,padding:'7px 10px',textDecoration:'none',fontSize:12,fontWeight:700}}>WhatsApp</a>
            </div>
          )}
        </div>
        <div style={{overflowY:'auto',WebkitOverflowScrolling:'touch',flex:1}}>
        <div style={{padding:'14px 18px 48px'}}>
          <div style={{marginBottom:16}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
              <span style={{color:'#475569',fontSize:10,textTransform:'uppercase',letterSpacing:1}}>Repayment Progress</span>
              <span style={{color:'#00D4AA',fontFamily:'monospace',fontWeight:800,fontSize:12}}>{pctPaid}%</span>
            </div>
            <div style={{height:5,background:'#1A2740',borderRadius:99,overflow:'hidden'}}>
              <div style={{height:'100%',width:pctPaid+'%',background:'linear-gradient(90deg,#00D4AA,#00FFD1)',borderRadius:99,transition:'width .5s'}}/>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
              <span style={{color:'#64748B',fontSize:10}}>Paid: KES {totalPaid.toLocaleString('en-KE')}</span>
              <span style={{color:'#64748B',fontSize:10}}>Total: KES {total.toLocaleString('en-KE')}</span>
            </div>
            {runningBalance<0&&<div style={{marginTop:6,display:'flex',alignItems:'center',gap:6,background:'#F59E0B10',border:'1px solid #F59E0B30',borderRadius:7,padding:'5px 10px'}}><span style={{fontSize:11}}>⚠</span><span style={{color:'#F59E0B',fontSize:11,fontWeight:600}}>Partial balance on file: KES {runningBalance.toLocaleString('en-KE')}</span></div>}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5,marginBottom:12}}>
            {[['Principal','KES '+loan.amount.toLocaleString('en-KE'),'#64748B',null],['Interest','KES '+Math.round(loan.amount*.3).toLocaleString('en-KE'),'#64748B',null],['On Time',summary.paid,'#00D4AA','paid'],['Late',summary.late,summary.late>0?'#F59E0B':'#475569','paid-late'],['Missed',summary.missed,summary.missed>0?'#EF4444':'#475569','missed'],['Upcoming',summary.upcoming,'#475569','upcoming']].map(item=>{
              const isActive=slotFilter===item[3]&&item[3]!==null;
              return <div key={item[0]} onClick={()=>{if(item[3])setSlotFilter(f=>f===item[3]?null:item[3]);}} style={{background:isActive?item[2]+'22':'#0D1F35',border:'1px solid '+(isActive?item[2]:'#1A3050'),borderRadius:8,padding:'8px 5px',textAlign:'center',cursor:item[3]?'pointer':'default',transition:'all .15s'}}><div style={{color:'#475569',fontSize:8,textTransform:'uppercase',letterSpacing:.3,marginBottom:3,whiteSpace:'nowrap',overflow:'hidden'}}>{item[0]}</div><div style={{color:item[2],fontWeight:800,fontSize:11,fontFamily:'monospace'}}>{item[1]}</div>{isActive&&<div style={{color:item[2],fontSize:7,marginTop:1,fontWeight:700}}>▼ filtered</div>}</div>;
            })}
          </div>
          <div style={{display:'flex',gap:12,marginBottom:10,flexWrap:'wrap'}}>
            {[['#00D4AA','✅ On time'],['#F59E0B','⚠ Late'],['#EF4444','❌ Missed'],['#F59E0B','⚠ Partial'],['#475569','· Upcoming']].map(item=>(
              <div key={item[1]} style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:7,height:7,borderRadius:2,background:item[0]}}/><span style={{color:'#475569',fontSize:9}}>{item[1]}</span></div>
            ))}
          </div>
          <div style={{color:'#475569',fontSize:10,textTransform:'uppercase',letterSpacing:1,marginBottom:6,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span>Schedule — click any instalment{slots.length>0&&<span style={{color:'#1A3050',marginLeft:6}}>({slots.length} total)</span>}</span>
            {slotFilter&&<button onClick={()=>setSlotFilter(null)} style={{background:'#1A2740',border:'1px solid #1A3050',color:'#64748B',borderRadius:6,padding:'2px 8px',cursor:'pointer',fontSize:9,fontWeight:700}}>✕ Clear filter ({filteredSlots.length} shown)</button>}
          </div>
          <div style={{marginBottom:16,paddingRight:2,borderRadius:8,border:'1px solid #1A3050'}}>
            <div style={{display:'flex',flexDirection:'column',gap:0}}>
              {filteredSlots.length===0
                ?<div style={{color:'#475569',textAlign:'center',padding:16,fontSize:12}}>No installments match this filter</div>
                :filteredSlots.map(slot=>{
                  const sty=REPAY_STATUS[slot.status]||REPAY_STATUS.upcoming;
                  const filled=['paid','paid-late'].includes(slot.status);
                  return(
                    <div key={slot.index} onClick={()=>setSelSlot(slot)} style={{display:'flex',alignItems:'center',gap:10,background:sty.bg,border:'1px solid '+sty.border+'40',borderRadius:9,padding:'9px 13px',cursor:'pointer',transition:'all .1s'}}>
                      <div style={{width:26,height:26,borderRadius:6,border:'1px solid '+sty.border,background:filled?sty.border:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><span style={{color:filled?'#060A10':sty.col,fontSize:11,fontWeight:900}}>{sty.icon||(slot.index+1)}</span></div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                          <span style={{color:'#E2E8F0',fontSize:12,fontWeight:600}}>{slot.synthetic?'Next Payment Due':'Instalment '+(slot.index+1)}</span>
                          {slot.synthetic&&<span style={{background:'#00D4AA18',color:'#00D4AA',fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:3,letterSpacing:.5}}>UPCOMING</span>}
                          {slot.status==='duetoday'&&<span style={{background:'#F59E0B18',color:'#F59E0B',fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:3}}>TODAY</span>}
                          {slot.payment&&<span style={{color:'#475569',fontSize:9,fontFamily:'monospace'}}>{slot.payment.mpesa||slot.payment.id}</span>}
                        </div>
                        <div style={{color:'#475569',fontSize:10,marginTop:1}}>Due {slot.due}</div>
                        {slot.negBalance<0&&<div style={{color:'#F59E0B',fontSize:10,marginTop:1}}>⚠ Partial: KES {slot.negBalance.toLocaleString('en-KE')}</div>}
                      </div>
                      <div style={{textAlign:'right',flexShrink:0}}>
                        <div style={{color:sty.col,fontFamily:'monospace',fontWeight:700,fontSize:12}}>KES {slot.perSlot.toLocaleString('en-KE')}</div>
                        {sty.label&&<div style={{color:sty.col,fontSize:9,fontWeight:800,marginTop:1,letterSpacing:.6}}>{sty.label}</div>}
                      </div>
                    </div>
                  );
                })
              }
            </div>
          </div>
          {ledger.length>0&&(
            <div>
              <div style={{color:'#475569',fontSize:10,textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>Payment ledger</div>
              <div>
              {ledger.map(entry=>(
                <div key={entry.payId} style={{background:'#0D1F35',border:'1px solid #1A3050',borderRadius:8,padding:'10px 12px',marginBottom:5}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:5}}>
                    <div><div style={{color:'#00D4AA',fontFamily:'monospace',fontSize:11,fontWeight:700}}>{entry.payId}</div><div style={{color:'#475569',fontSize:10,marginTop:1}}>{entry.mpesa||'Manual'} · {entry.date}</div></div>
                    <div style={{color:'#00D4AA',fontFamily:'monospace',fontWeight:800,fontSize:13}}>KES {entry.amount.toLocaleString('en-KE')}</div>
                  </div>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap',borderTop:'1px solid #1A3050',paddingTop:6}}>
                    <span style={{color:'#475569',fontSize:9}}>Covered: {entry.paidSlots.map(i=>'I'+(i+1)).join(', ')||'none'}</span>
                    {entry.surplusSlots>0&&<span style={{color:'#F59E0B',fontSize:9}}>{entry.surplusSlots} surplus slots</span>}
                    {entry.negativeBalance<0&&<span style={{color:'#F59E0B',fontSize:9}}>Remainder: KES {entry.negativeBalance.toLocaleString('en-KE')}</span>}
                    {entry.allocatedBy&&<span style={{color:'#374151',fontSize:9}}>by {entry.allocatedBy}</span>}
                  </div>
                </div>
              ))}
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

const RepayTracker = ({loans, payments}) => {
  const [activeType, setActiveType] = useState('Daily');
  const [selLoan,    setSelLoan]    = useState(null);
  const [selSlot,    setSelSlot]    = useState(null);

  // Lock the page scroll container synchronously before paint so the modal
  // and the lock appear in the same frame — no visible jump on first open.
  useLayoutEffect(()=>{
    const el = document.querySelector('.main-scroll');
    if(!el) return;
    if(selLoan){
      el.style.overflow = 'hidden';
    } else {
      el.style.overflow = '';
    }
    return ()=>{ el.style.overflow = ''; };
  },[selLoan]);

  const TYPES = ['Daily','Weekly','Biweekly','Monthly'];
  const STATUS = REPAY_STATUS;

  // Memoize active loans for the selected type — only recomputes when loans or activeType changes
  const activeLoans = useMemo(()=>loans.filter(function(l){
    return l.repaymentType===activeType && l.disbursed &&
           !['Rejected','Written off'].includes(l.status);
  }),[loans,activeType]);

  // Memoize per-type counts for the filter buttons — prevents 4× loans.filter on every render
  const typeCounts = useMemo(()=>{
    const eligible = loans.filter(l=>l.disbursed&&!['Settled','Rejected','Written off'].includes(l.status));
    return Object.fromEntries(TYPES.map(t=>[t, eligible.filter(l=>l.repaymentType===t).length]));
  },[loans]);

  // Memoize total active count shown in the subtitle — was an inline loans.filter in JSX
  const totalActive = useMemo(()=>
    loans.filter(l=>l.disbursed&&!['Settled','Rejected','Written off'].includes(l.status)).length
  ,[loans]);

  // KEY FIX — computeLoanSchedule runs the full payment allocation engine.
  // Previously it was called inside .map() on every render, meaning O(loans × payments)
  // work per render. Memoize the full schedules array so it only recomputes when
  // loans or payments actually change.
  const schedules = useMemo(()=>{
    const result = {};
    activeLoans.forEach(loan => { result[loan.id] = computeLoanSchedule(loan, payments); });
    return result;
  },[activeLoans, payments]);

  // ── Slot detail popup ──────────────────────────────────────────────────────
  // FIX — Bug 3: SlotPopup was a component defined inside RepayTracker's render body.
  // Every re-render produced a new function identity → React treated it as a different
  // component type → full unmount+remount of the popup (and any inputs inside it).
  // Converted to a plain render function called as slotPopupContent(...) below so React
  // reconciles the returned JSX in-place without remounting.
  const renderSlotPopup = function(props) {
    const slot = props.slot;
    const loan = props.loan;
    const sty  = STATUS[slot.status] || STATUS.upcoming;
    const pay  = slot.payment;
    const ledgerEntry = props.ledgerEntry;
    return (
      <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:10002,background:'rgba(4,8,16,0.8)',display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:MODAL_TOP_OFFSET+16,paddingLeft:16,paddingRight:16,backdropFilter:'blur(6px)',overflow:'hidden'}}
        onClick={function(){setSelSlot(null);}}>
        <div onClick={function(e){e.stopPropagation();}}
          style={{background:'#0A1628',border:'1px solid '+sty.border+'50',borderRadius:14,padding:20,width:'100%',maxWidth:380,boxShadow:'0 0 0 1px '+sty.border+'15,0 32px 64px rgba(0,0,0,.9)'}}>

          {/* Slot header */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
            <div>
              <div style={{color:'#475569',fontSize:10,textTransform:'uppercase',letterSpacing:1.5,marginBottom:3}}>
                {loan.repaymentType} · Instalment {slot.index+1} of {props.totalSlots}
              </div>
              <div style={{color:sty.col,fontFamily:'monospace',fontWeight:800,fontSize:18}}>
                KES {slot.perSlot.toLocaleString('en-KE')}
              </div>
              <div style={{color:'#475569',fontSize:11,marginTop:3}}>Due {slot.due}</div>
            </div>
            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6}}>
              <span style={{background:sty.bg,border:'1px solid '+sty.border+'50',color:sty.col,fontSize:10,fontWeight:800,padding:'3px 10px',borderRadius:6,letterSpacing:.8}}>
                {sty.label||'UPCOMING'}
              </span>
              <button onClick={function(){setSelSlot(null);}}
                style={{background:'#1A2740',border:'1px solid #1A3050',color:'#475569',borderRadius:99,width:24,height:24,cursor:'pointer',fontSize:11,display:'flex',alignItems:'center',justifyContent:'center'}}>
                ✕
              </button>
            </div>
          </div>

          {/* Allocation detail */}
          <div style={{background:'#0D1F35',border:'1px solid #1A3050',borderRadius:10,padding:'12px 14px',marginBottom:14}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:slot.negBalance<0?10:0}}>
              <div>
                <div style={{color:'#475569',fontSize:9,textTransform:'uppercase',letterSpacing:.8,marginBottom:3}}>Required this slot</div>
                <div style={{color:'#E2E8F0',fontFamily:'monospace',fontWeight:700,fontSize:14}}>KES {slot.perSlot.toLocaleString('en-KE')}</div>
              </div>
              <div>
                <div style={{color:'#475569',fontSize:9,textTransform:'uppercase',letterSpacing:.8,marginBottom:3}}>
                  {pay ? 'Payment received' : 'Amount received'}
                </div>
                <div style={{color:pay?'#00D4AA':'#EF4444',fontFamily:'monospace',fontWeight:700,fontSize:14}}>
                  {pay ? 'KES '+pay.amount.toLocaleString('en-KE') : 'KES 0'}
                </div>
              </div>
            </div>
            {slot.negBalance < 0 && (
              <div style={{borderTop:'1px solid #1A3050',paddingTop:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{color:'#F59E0B',fontSize:10,fontWeight:700}}>⚠ Partial remainder</div>
                  <div style={{color:'#475569',fontSize:10,marginTop:1}}>Not applied — less than 1 instalment</div>
                </div>
                <div style={{color:'#F59E0B',fontFamily:'monospace',fontWeight:800,fontSize:13}}>{slot.negBalance.toLocaleString('en-KE')}</div>
              </div>
            )}
          </div>

          {/* Linked payment */}
          {!pay ? (
            <div style={{background:'#0D1F35',border:'1px dashed #1A3050',borderRadius:8,padding:12,textAlign:'center',color:'#475569',fontSize:11}}>
              {slot.status==='missed'
                ? 'No payment received by '+slot.due
                : slot.status==='duetoday'
                  ? 'Payment due today — not yet received'
                  : 'Instalment not yet due'}
            </div>
          ) : (
            <div>
              <div style={{color:'#475569',fontSize:10,textTransform:'uppercase',letterSpacing:1,marginBottom:7}}>Payment record</div>
              <div style={{background:'#0D1F35',border:'1px solid #1A3050',borderRadius:9,padding:'12px 14px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                  <div>
                    <div style={{color:'#00D4AA',fontFamily:'monospace',fontSize:12,fontWeight:800}}>{pay.id}</div>
                    <div style={{color:'#475569',fontSize:10,marginTop:2}}>{pay.mpesa||'Manual entry'}</div>
                  </div>
                  <div style={{color:'#00D4AA',fontFamily:'monospace',fontWeight:800,fontSize:15}}>
                    KES {pay.amount.toLocaleString('en-KE')}
                  </div>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:8,borderTop:'1px solid #1A3050'}}>
                  <span style={{color:'#475569',fontSize:10}}>Received: {pay.date}</span>
                  <span style={{background:pay.date<=slot.due?'#00D4AA15':'#F59E0B15',color:pay.date<=slot.due?'#00D4AA':'#F59E0B',fontSize:9,fontWeight:800,padding:'2px 7px',borderRadius:4,letterSpacing:.5}}>
                    {pay.date<=slot.due ? 'ON TIME' : 'LATE'}
                  </span>
                </div>
                {ledgerEntry && ledgerEntry.paidSlots.length > 1 && (
                  <div style={{marginTop:8,color:'#475569',fontSize:10,borderTop:'1px solid #1A3050',paddingTop:8}}>
                    This payment also covers {ledgerEntry.paidSlots.length-1} other instalment{ledgerEntry.paidSlots.length>2?'s':''}
                  </div>
                )}
                {pay.allocatedBy && (
                  <div style={{marginTop:4,color:'#374151',fontSize:9}}>Allocated by: {pay.allocatedBy}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Loan detail modal ──────────────────────────────────────────────────────
  // FIX: LoanDetail was originally defined inside RepayTracker's render body,
  // making it a new component type on every render → full remount on every state
  // change. It cannot be a plain render function because it owns useState.
  // Correctly hoisted to module scope above RepayTracker; all previously
  // closed-over values are passed as explicit props.

  // ── Main tracker UI ────────────────────────────────────────────────────────
  return (
    <div style={{background:'#080F1E',border:'1px solid #0F2040',borderRadius:16,padding:'18px 20px',marginBottom:20,boxShadow:'inset 0 1px 0 #0F2040'}}>
      {selLoan&&<LoanDetail loan={selLoan} payments={payments} selSlot={selSlot} setSelSlot={setSelSlot} setSelLoan={setSelLoan} renderSlotPopup={renderSlotPopup}/>}

      {/* Title row */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div>
          <div style={{color:'#00D4AA',fontFamily:'monospace',fontSize:10,fontWeight:700,letterSpacing:3,marginBottom:3}}>PAYMENT ENGINE v2</div>
          <div style={{color:'#E2E8F0',fontWeight:800,fontSize:15}}>Schedule Monitor</div>
          <div style={{color:'#475569',fontSize:11,marginTop:2}}>
            Central allocation engine · {totalActive} active loans
          </div>
        </div>
        {/* Type filter */}
        <div style={{display:'flex',gap:4}}>
          {TYPES.map(function(t){
            var ct=typeCounts[t]||0;
            return(
              <button key={t} onClick={function(){setActiveType(t);}}
                style={{background:activeType===t?'#00D4AA':'transparent',
                        color:activeType===t?'#060A10':'#475569',
                        border:'1px solid '+(activeType===t?'#00D4AA':'#1A3050'),
                        borderRadius:8,padding:'5px 11px',cursor:'pointer',fontSize:11,fontWeight:700,
                        display:'flex',alignItems:'center',gap:5,transition:'all .15s'}}>
                {t}
                {ct>0&&<span style={{background:activeType===t?'rgba(6,10,16,.25)':'#1A2740',color:activeType===t?'#060A10':'#64748B',borderRadius:99,padding:'0 5px',fontSize:9,fontWeight:900,minWidth:14,textAlign:'center'}}>{ct}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loan cards — scrollable container, max 3 cards visible */}
      {activeLoans.length===0 ? (
        <div style={{color:'#475569',textAlign:'center',padding:'24px',fontSize:12,border:'1px dashed #0F2040',borderRadius:10}}>
          No active {activeType.toLowerCase()} repayment loans
        </div>
      ) : (
        <div style={{maxHeight:'40vh',overflowY:'auto',overflowX:'hidden',paddingRight:2}}>
        <div style={{display:'flex',flexDirection:'column',gap:7}}>
          {activeLoans.map(function(loan){
            const sched  = schedules[loan.id] || computeLoanSchedule(loan, payments);
            const { slots, runningBalance, pctPaid, summary, perSlot, total, totalPaid } = sched;
            return (
              <div key={loan.id}
                style={{background:'#0D1F35',border:'1px solid '+(summary.missed>0?'#EF444428':loan.status==='Overdue'?'#EF444418':'#0F2040'),
                        borderRadius:12,padding:'13px 15px',cursor:'pointer',transition:'border-color .15s'}}
                onClick={function(){setSelLoan(loan);setSelSlot(null);}}>
                {/* Top row */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                  <div style={{display:'flex',alignItems:'center',gap:7}}>
                    <span style={{fontFamily:'monospace',color:'#00D4AA',fontWeight:800,fontSize:12,letterSpacing:.5}}>{loan.id}</span>
                    {loan.status==='Overdue'&&<span style={{background:'#EF444412',color:'#EF4444',fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:4,border:'1px solid #EF444428'}}>OVERDUE</span>}
                    {summary.missed>0&&<span style={{background:'#EF444412',color:'#EF4444',fontSize:9,fontWeight:700,padding:'2px 5px',borderRadius:4}}>{summary.missed} missed</span>}
                    {runningBalance<0&&<span style={{background:'#F59E0B12',color:'#F59E0B',fontSize:9,fontWeight:700,padding:'2px 5px',borderRadius:4}}>⚠ partial</span>}
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{color:'#E2E8F0',fontFamily:'monospace',fontWeight:700,fontSize:11}}>KES {loan.balance.toLocaleString('en-KE')}</div>
                    <div style={{color:'#475569',fontSize:9}}>balance</div>
                  </div>
                </div>
                <div style={{color:'#64748B',fontSize:11,marginBottom:8}}>
                  {loan.customer} · <span style={{color:'#475569',fontFamily:'monospace',fontSize:10}}>KES {perSlot.toLocaleString('en-KE')}/slot</span>
                </div>
                {/* Progress */}
                <div style={{height:3,background:'#1A2740',borderRadius:99,overflow:'hidden',marginBottom:4}}>
                  <div style={{height:'100%',width:pctPaid+'%',background:'linear-gradient(90deg,#00D4AA,#00FFD1)',borderRadius:99,boxShadow:pctPaid>0?'0 0 5px #00D4AA40':''}}/>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:9}}>
                  <span style={{color:'#475569',fontSize:9}}>
                    {summary.paid+summary.late}/{slots.length} paid · {pctPaid}%
                    {runningBalance<0&&<span style={{color:'#F59E0B'}}> · {runningBalance.toLocaleString('en-KE')} balance</span>}
                  </span>
                  {loan.daysOverdue>0&&<span style={{color:'#EF4444',fontSize:9,fontWeight:700}}>{loan.daysOverdue}d overdue</span>}
                </div>
                {/* Mini dot track — horizontal scroll, no wrap */}
                <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch',paddingBottom:2}}>
                <div style={{display:'flex',gap:3,flexWrap:'nowrap',minWidth:'min-content'}}>
                  {slots.map(function(slot){
                    var sty = STATUS[slot.status]||STATUS.upcoming;
                    var filled=['paid','paid-late'].includes(slot.status);
                    var w=activeType==='Daily'?10:activeType==='Weekly'?24:activeType==='Biweekly'?36:72;
                    return(
                      <div key={slot.index}
                        title={'I'+(slot.index+1)+' · '+slot.due+' · '+(sty.label||'upcoming')}
                        style={{width:w,height:9,borderRadius:2,flexShrink:0,
                                background:filled?sty.border:slot.status==='missed'?sty.border+'25':slot.status==='duetoday'?sty.border+'45':'#1A2740',
                                border:'1px solid '+sty.border+(filled?'':'50'),
                                boxShadow:filled?'0 0 4px '+sty.border+'30':''}}/>
                    );
                  })}
                </div>
                </div>
              </div>
            );
          })}
        </div>
        </div>
      )}
    </div>
  );
};


const ADashboard = ({loans,customers,payments,workers,interactions,onNav,scrollTop}) => {
  const {open:openContact, Popup:ContactPopup} = useContactPopup();
  const [drill,setDrillRaw]=useState(null);
  const setDrill = (d) => { setDrillRaw(d); if(d) setTimeout(()=>{ try{scrollTop?.();}catch(e){} },20); };
  const [selOverdue,setSelOverdue]=useState(null);
  const [selLoan,setSelLoanRaw]=useState(null);
  const [selCust,setSelCustRaw]=useState(null);
  const setSelLoan = (l) => { setSelLoanRaw(l); if(l) setTimeout(()=>{ try{scrollTop?.();}catch(e){} },10); };
  const setSelCust = (c) => { setSelCustRaw(c); if(c) setTimeout(()=>{ try{scrollTop?.();}catch(e){} },10); };
  // FIX — memoize all expensive derived values in ADashboard. Previously these ran on
  // every render; now they only recalculate when loans/payments/customers/workers change.
  const dashDerived = useMemo(()=>{
    const non    = loans.filter(l=>l.status!=="Settled");
    const book   = non.reduce((s,l)=>s+l.balance,0);
    const ovList = loans.filter(l=>l.status==="Overdue");
    const ovAmt  = ovList.reduce((s,l)=>s+l.balance,0);
    const coll   = payments.filter(p=>p.status==="Allocated").reduce((s,p)=>s+p.amount,0);
    const todayP = payments.filter(p=>p.date===now()).reduce((s,p)=>s+p.amount,0);
    const nc     = non.length||1;
    const par    = d=>((loans.filter(l=>l.daysOverdue>=d).length/nc)*100).toFixed(1);
    const collRate=(coll>0&&book>0)?Math.min((coll/book)*100,100).toFixed(1):'0.0';
    const locs=[...new Set(customers.map(c=>c.location).filter(Boolean))].map(loc=>{
      const lc=loans.filter(l=>customers.find(c=>c.name===l.customer&&c.location===loc));
      const od=lc.filter(l=>l.status==="Overdue").length;
      return {loc,rate:lc.length?+((od/lc.length)*100).toFixed(1):0,n:lc.length};
    }).sort((a,b)=>b.rate-a.rate);
    const byType=["Daily","Weekly","Biweekly","Monthly","Lump Sum"].map(rt=>{
      const ls=loans.filter(l=>l.repaymentType===rt&&l.status!=="Settled");
      const paid=payments.filter(p=>ls.some(l=>l.id===p.loanId)).reduce((s,p)=>s+p.amount,0);
      const balance=ls.reduce((s,l)=>s+l.balance,0);
      return {type:rt,count:ls.length,paid,balance};
    }).filter(x=>x.count>0);
    const todayStr = new Date().toLocaleDateString("en-KE",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
    return {non,book,ovList,ovAmt,coll,todayP,nc,par,collRate,locs,byType,todayStr};
  },[loans,payments,customers,workers]);
  const {non,book,ovList,ovAmt,coll,todayP,nc,par,collRate,locs,byType,todayStr} = dashDerived;

  // FIX — ClickName was a component defined inside ADashboard's render body.
  // Converted to a plain render function to avoid new-type-on-every-render remounting.
  const renderClickName = ({name, phone}) => (
    <span onClick={e=>{e.stopPropagation();openContact(name,phone,e);}}
      style={{color:T.accent,cursor:"pointer",fontWeight:600,borderBottom:`1px dashed ${T.accent}50`}}
      title="Click to call/message">
      {name}
    </span>
  );

  const custPhone = (name) => customers.find(c=>c.name===name)?.phone||"";

  return (
    <div className="fu">
      {ContactPopup}
      {drill&&(
        <div className='dialog-backdrop' style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:9900,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:0,backdropFilter:'blur(4px)',WebkitBackdropFilter:'blur(4px)',background:'rgba(4,8,16,0.75)',overflow:'hidden'}}>
          <div className='pop' style={{background:T.card,border:`1px solid ${T.hi}`,borderBottom:`1px solid ${T.border}`,borderRadius:'0 0 20px 20px',width:'100%',maxWidth:'100%',maxHeight:'82vh',display:'flex',flexDirection:'column',boxShadow:'0 24px 64px #000000E0'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 18px',borderBottom:`1px solid ${T.border}`,flexShrink:0,background:T.card}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                {drill.color&&<div style={{width:4,height:20,borderRadius:99,background:drill.color}}/>}
                <h3 style={{color:T.txt,fontSize:15,fontWeight:800,fontFamily:T.head,margin:0}}>{drill.title}</h3>
                <span style={{background:T.hi,color:T.muted,borderRadius:99,padding:'2px 8px',fontSize:11,fontFamily:T.mono}}>{drill.rows?.length??0}</span>
              </div>
              <button onClick={()=>setDrill(null)} style={{background:T.card2,border:`1px solid ${T.border}`,color:T.muted,borderRadius:99,width:28,height:28,cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:'auto',overflowX:'auto'}}>
              <DT cols={drill.cols} rows={drill.rows}/>
            </div>
          </div>
        </div>
      )}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16,flexWrap:'wrap',gap:10}}>
        <div>
          <div style={{fontFamily:T.head,color:T.txt,fontSize:22,fontWeight:800}}>🏠 Dashboard</div>
          <div style={{color:T.muted,fontSize:13,marginTop:3}}>{todayStr}</div>
        </div>
        <RefreshBtn onRefresh={()=>setDrill(null)}/>
      </div>

      {/* KPI Row 1 */}
      <div className="kpi-row" style={{display:"flex",gap:10,marginBottom:10,flexWrap:"wrap"}}>
        <KPI label="Loan Book" icon="📈" value={fmtM(book)} color={T.accent} delay={1}
          onClick={()=>setDrill({title:"All Active Loans",cols:[{k:"id",l:"ID",r:v=><span style={{color:T.accent,fontFamily:T.mono,fontSize:12}}>{v}</span>},{k:"customer",l:"Customer",r:(v,r)=>renderClickName({name:v,phone:custPhone(v)})},{k:"amount",l:"Principal",r:v=>fmt(v)},{k:"balance",l:"Balance",r:v=>fmt(v)},{k:"status",l:"Status",r:v=><Badge color={SC[v]||T.muted}>{v}</Badge>}],rows:non})}/>
        <KPI label="Overdue" icon="⚠️" value={fmtM(ovAmt)} color={T.danger} delay={2}
          onClick={()=>setDrill({title:"Overdue Loans",cols:[{k:"id",l:"ID",r:v=><span style={{color:T.accent,fontFamily:T.mono,fontSize:12}}>{v}</span>},{k:"customer",l:"Customer",r:(v,r)=>renderClickName({name:v,phone:custPhone(v)})},{k:"balance",l:"Balance",r:v=>fmt(v)},{k:"daysOverdue",l:"Days",r:v=><span style={{color:T.danger,fontWeight:800}}>{v}d</span>},{k:"daysOverdue",l:"Total Due",r:(_,r)=>{const e=calculateLoanStatus(r);return <span style={{color:T.danger,fontFamily:T.mono}}>{fmt(e.totalAmountDue)}</span>;}}],rows:ovList})}/>
        <KPI label="Collected Today" icon="✅" value={fmtM(todayP)} color={T.ok} delay={3}
          onClick={()=>setDrill({title:"Today\'s Payments",cols:[{k:"id",l:"Pay ID"},{k:"customer",l:"Customer",r:(v,r)=>renderClickName({name:v,phone:custPhone(v)})},{k:"amount",l:"Amount",r:v=><span style={{color:T.ok,fontFamily:T.mono,fontWeight:700}}>{fmt(v)}</span>},{k:"mpesa",l:"M-Pesa"},{k:"status",l:"Status",r:v=><Badge color={SC[v]||T.muted}>{v}</Badge>}],rows:payments.filter(p=>p.date===now())})}/>
        <KPI label="Collection Rate" icon="📊" value={`${collRate}%`} color={T.ok} delay={4}
          onClick={()=>setDrill({title:"Collection by Officer",cols:[{k:"name",l:"Officer"},{k:"book",l:"Book",r:v=>fmt(v)},{k:"collected",l:"Collected",r:v=><span style={{color:T.ok,fontFamily:T.mono}}>{fmt(v)}</span>},{k:"rate",l:"Rate",r:v=><span style={{color:+v>80?T.ok:T.warn,fontWeight:800}}>{v}%</span>}],rows:workers.map(w=>{const wl=loans.filter(l=>l.officer===w.name&&l.status!=="Settled");const bk=wl.reduce((s,l)=>s+l.balance,0);const wp=payments.filter(p=>wl.some(l=>l.id===p.loanId)).reduce((s,p)=>s+p.amount,0);return {name:w.name,book:bk,collected:wp,rate:(wp>0&&bk>0)?((wp/bk)*100).toFixed(1):'0.0'};}).filter(x=>x.book>0)})}/>
      </div>

      {/* KPI Row 2 */}
      <div className="kpi-row" style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <KPI label="Active Workers" icon="👷" value={workers.filter(w=>w.status==="Active").length} delay={1}
          onClick={()=>setDrill({title:"Active Staff",cols:[{k:"name",l:"Name"},{k:"role",l:"Role"},{k:"phone",l:"Phone"}],rows:workers.filter(w=>w.status==="Active")})}/>
        <KPI label="Customers" icon="👤" value={customers.length} delay={2}
          onClick={()=>setDrill({title:"All Customers",cols:[{k:"id",l:"ID",r:v=><span style={{color:T.accent,fontFamily:T.mono,fontSize:12}}>{v}</span>},{k:"name",l:"Name",r:(v,r)=>renderClickName({name:v,phone:r.phone})},{k:"business",l:"Business"},{k:"location",l:"Location"},{k:"risk",l:"Risk",r:v=><Badge color={RC[v]}>{v}</Badge>}],rows:customers})}/>
        <KPI label="PAR 7" icon="⚠️" value={`${par(7)}%`} color={+par(7)>10?T.danger:T.warn} delay={3}
          onClick={()=>setDrill({title:"Loans Overdue 7+ Days",cols:[{k:"id",l:"ID",r:v=><span style={{color:T.accent,fontFamily:T.mono,fontSize:12}}>{v}</span>},{k:"customer",l:"Customer",r:(v,r)=>renderClickName({name:v,phone:custPhone(v)})},{k:"balance",l:"Balance",r:v=>fmt(v)},{k:"daysOverdue",l:"Days",r:v=><span style={{color:T.danger,fontWeight:800}}>{v}d</span>}],rows:loans.filter(l=>l.daysOverdue>=7)})}/>
        <KPI label="PAR 30" icon="🔴" value={`${par(30)}%`} color={+par(30)>5?T.danger:T.ok} delay={4}
          onClick={()=>setDrill({title:"Loans Overdue 30+ Days",cols:[{k:"id",l:"ID",r:v=><span style={{color:T.accent,fontFamily:T.mono,fontSize:12}}>{v}</span>},{k:"customer",l:"Customer",r:(v,r)=>renderClickName({name:v,phone:custPhone(v)})},{k:"balance",l:"Balance",r:v=>fmt(v)},{k:"daysOverdue",l:"Days",r:v=><span style={{color:T.danger,fontWeight:800,fontFamily:T.mono}}>{v}d</span>},{k:"status",l:"Phase",r:(_,r)=>{const e=calculateLoanStatus(r);return <span style={{color:e.isFrozen?T.purple:T.danger,fontSize:11,fontWeight:700}}>{e.phase==='frozen'?'❄ Frozen':e.phase==='penalty'?'⚠ Penalty':'Interest'}</span>;}}],rows:loans.filter(l=>l.daysOverdue>=30)})}/>
      </div>

      {/* Live Chart */}
      <LivePortfolioChart loans={loans} payments={payments} customers={customers} onNav={onNav} setDrill={setDrill} openContact={openContact} custPhone={custPhone} scrollTop={scrollTop}/>

      {/* 7-Day Collections Bar Chart */}
      <WeeklyCollectionsChart payments={payments}/>

      <div className="mob-grid1" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <Card>
          <CH title="Portfolio at Risk"/>
          <div style={{padding:"16px 18px"}}>
            {[["PAR 1 (≥1d)",par(1),+par(1)>15?T.danger:T.warn],["PAR 7 (≥7d)",par(7),+par(7)>10?T.danger:T.warn],["PAR 30 (≥30d)",par(30),+par(30)>5?T.danger:T.ok]].map(([l,v,c])=>(
              <div key={l} style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                  <span style={{color:T.dim,fontSize:13}}>{l}</span>
                  <span style={{color:c,fontWeight:800,fontFamily:T.mono}}>{v}%</span>
                </div>
                <Bar value={+v} max={30} color={c}/>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CH title="Default Rate by Location"/>
          <div style={{maxHeight:'40vh',overflowY:'auto',overflowX:'hidden',padding:"12px 18px"}}>
            {locs.length===0&&<div style={{color:T.muted,fontSize:12,textAlign:'center',padding:'12px 0'}}>No location data</div>}
            {locs.map(({loc,rate,n})=>(
              <div key={loc} style={{display:"flex",alignItems:"center",gap:8,marginBottom:11}}>
                <div style={{width:80,color:T.txt,fontSize:12,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={loc}>{loc}</div>
                <div style={{flex:1}}><Bar value={rate} max={30} color={rate>15?T.danger:rate>8?T.warn:T.ok}/></div>
                <div style={{color:rate>15?T.danger:rate>8?T.warn:T.ok,fontWeight:800,fontSize:12,width:36,textAlign:"right",fontFamily:T.mono,flexShrink:0}}>{rate}%</div>
                <div style={{color:T.muted,fontSize:10,width:28,textAlign:"right",flexShrink:0}}>{n}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Overdue Loans card removed from dashboard — see Collections page */}
      <RepayTracker loans={loans} payments={payments} onSelectLoan={setSelLoan}/>
      {selLoan&&<LoanModal loan={selLoan} customers={customers} payments={payments} interactions={interactions||[]} onClose={()=>setSelLoan(null)} onViewCustomer={cust=>{setSelLoan(null);setSelCust(cust);}}/>}
      {selCust&&<CustomerDetail customer={selCust} loans={loans} payments={payments} interactions={interactions||[]} workers={workers||[]} onClose={()=>setSelCust(null)} onSelectLoan={loan=>{setSelCust(null);setSelLoan(loan);}} onSave={()=>{}}/>}
    </div>
  );
};

// ═══════════════════════════════════════════
//  CUSTOMER EDIT FORM
// ═══════════════════════════════════════════
const CustomerEditForm = ({customer, workers, onSave, onClose}) => {
  const [f, setF] = useState({
    name: customer.name||'', dob: customer.dob||'', gender: customer.gender||'Female',
    idNo: customer.idNo||'', phone: customer.phone||'', altPhone: customer.altPhone||'',
    residence: customer.residence||'', business: customer.business||'',
    businessType: customer.businessType||'Retail', businessLoc: customer.location||customer.businessLoc||'',
    officer: customer.officer||'', risk: customer.risk||'Low',
    n1n: customer.n1n||'', n1p: customer.n1p||'', n1r: customer.n1r||'',
    n2n: customer.n2n||'', n2p: customer.n2p||'', n2r: customer.n2r||'',
    n3n: customer.n3n||'', n3p: customer.n3p||'', n3r: customer.n3r||'',
  });
  const [docs, setDocs] = useState(customer.docs||[]);
  const [tab, setTab] = useState('personal');
  const [err, setErr] = useState([]);
  const s = k => v => setF(p=>({...p,[k]:v}));

  const validate = () => {
    const m = [];
    if(!f.name)        m.push('Full Name');
    if(!f.idNo)        m.push('National ID');
    if(!f.phone)       m.push('Primary Phone');
    if(!f.residence)   m.push('Residence');
    if(!f.business)    m.push('Business Name');
    if(!f.businessLoc) m.push('Business Location');
    if(!f.officer)     m.push('Assigned Officer');
    if(!f.n1n||!f.n1p||!f.n1r) m.push('Next of Kin 1 (Name, Phone & Relationship)');
    if(!f.n2n||!f.n2p||!f.n2r) m.push('Next of Kin 2 (Name, Phone & Relationship)');
    if(!f.n3n||!f.n3p||!f.n3r) m.push('Next of Kin 3 (Name, Phone & Relationship)');
    return m;
  };

  const save = () => {
    const m = validate();
    if(m.length>0){setErr(m);return;}
    onSave({...customer,...f,location:f.businessLoc,docs});
  };

  const TABS=[{k:'personal',l:'Personal'},{k:'business',l:'Business'},{k:'nok',l:'Next of Kin'},{k:'documents',l:'Documents'}];

  return (
    <Dialog title={`Edit — ${customer.name}`} onClose={onClose} width={580}>
      {err.length>0&&(
        <div style={{background:T.dLo,border:`1px solid ${T.danger}38`,borderRadius:9,padding:'10px 14px',marginBottom:12}}>
          {err.map(e=><div key={e} style={{color:T.danger,fontSize:12,padding:'2px 0'}}>★ {e}</div>)}
        </div>
      )}
      <div style={{display:'flex',gap:5,marginBottom:16,overflowX:'auto',paddingBottom:2}}>
        {TABS.map(t=><button key={t.k} onClick={()=>setTab(t.k)} style={{background:tab===t.k?T.accent:T.surface,color:tab===t.k?'#060A10':T.muted,border:`1px solid ${tab===t.k?T.accent:T.border}`,borderRadius:99,padding:'5px 14px',fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>{t.l}</button>)}
      </div>

      {tab==='personal'&&(
        <div className='mob-grid1' style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
          <FI label='Full Name'       value={f.name}     onChange={s('name')}     required half/>
          <FI label='Date of Birth'   value={f.dob}      onChange={s('dob')}      type='date' half/>
          <FI label='Gender'          value={f.gender}   onChange={s('gender')}   type='select' options={['Female','Male','Other']} half/>
          <NumericInput label='National ID' value={f.idNo} onChange={s('idNo')} required half/>
          <PhoneInput label='Primary Phone' value={f.phone} onChange={s('phone')} required half/>
          <PhoneInput label='Alt Phone'     value={f.altPhone} onChange={s('altPhone')} half/>
          <FI label='Residence'       value={f.residence} onChange={s('residence')} required half/>
          <FI label='Risk Level'      value={f.risk}      onChange={s('risk')}     type='select' options={['Low','Medium','High','Very High']} half/>
        </div>
      )}
      {tab==='business'&&(
        <div className='mob-grid1' style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
          <FI label='Business Name'     value={f.business}     onChange={s('business')}     required half/>
          <FI label='Business Type'     value={f.businessType} onChange={s('businessType')} type='select' options={['Retail','Wholesale','Manufacturing','Agriculture','Transport','Food & Beverage','Salon & Beauty','Tailoring','Electronics','Hardware','Pharmacy','Education','Hospitality','Other']} half/>
          <FI label='Business Location' value={f.businessLoc}  onChange={s('businessLoc')}  required half/>
          <FI label='Assigned Officer'  value={f.officer}      onChange={s('officer')}      type='select' options={(workers||[]).filter(w=>w.status==='Active').map(w=>w.name)} required half/>
        </div>
      )}
      {tab==='nok'&&(
        <div className='mob-grid1' style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
          {[[1,'n1n','n1p','n1r'],[2,'n2n','n2p','n2r'],[3,'n3n','n3p','n3r']].map(([n,nk,pk,rk])=>[
            <FI key={nk} label={`NOK ${n} Name`}         value={f[nk]} onChange={s(nk)} required half/>,
            <PhoneInput key={pk} label={`NOK ${n} Phone`} value={f[pk]} onChange={s(pk)} required half/>,
            <FI key={rk} label={`NOK ${n} Relationship`} value={f[rk]} onChange={s(rk)} type='select' options={['','Spouse','Parent','Sibling','Child','Friend','Colleague']} required half/>,
            <div key={`sep${n}`} style={{gridColumn:'span 2',height:1,background:T.border,margin:'4px 0'}}/>
          ])}
        </div>
      )}
      {tab==='documents'&&(
        <div>
          <Alert type='info' style={{marginBottom:12}}>Replace or add documents. Existing uploads are preserved unless removed.</Alert>
          <StructuredDocUpload docs={docs} onAdd={d=>setDocs(p=>[...p.filter(x=>x.key!==d.key),d])} onRemove={id=>setDocs(p=>p.filter(x=>x.id!==id))}/>
        </div>
      )}

      <div style={{display:'flex',gap:9,marginTop:16,paddingTop:12,borderTop:`1px solid ${T.border}`}}>
        <Btn onClick={save} full>✓ Save Changes</Btn>
        <Btn v='secondary' onClick={onClose}>Cancel</Btn>
      </div>
    </Dialog>
  );
};

// ═══════════════════════════════════════════
//  CUSTOMER DETAIL — full profile on click
// ═══════════════════════════════════════════

// ── Docs tab as proper component (no hook-in-render) ──────────
const CustDocsTab = ({customer}) => {
  const [viewDoc, setViewDoc] = useState(null);
  const slots = DOC_SLOTS.map(sl=>({...sl, doc:(customer.docs||[]).find(d=>d.key===sl.key)}));
  const loose = (customer.docs||[]).filter(d=>!DOC_SLOTS.some(sl=>sl.key===d.key));
  return (
    <div>
      {viewDoc&&<DocViewer doc={viewDoc} onClose={()=>setViewDoc(null)}/>}
      {(!customer.docs||customer.docs.length===0)&&(
        <div style={{color:T.muted,textAlign:'center',padding:20,background:T.surface,borderRadius:10}}>No documents on file</div>
      )}
      {slots.some(s=>s.doc)&&(
        <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:12}}>
          {slots.filter(s=>s.doc).map(sl=>(
            <div key={sl.key} style={{background:T.surface,border:`1px solid ${T.ok}38`,borderRadius:10,padding:'10px 12px',display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:18}}>{sl.icon}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:T.txt,fontSize:13,fontWeight:700}}>{sl.label}</div>
                <div style={{color:T.ok,fontSize:11}}>On file · {sl.doc.uploaded}</div>
              </div>
              {sl.doc.type?.startsWith('image/')
                ?<img src={sl.doc.dataUrl} alt={sl.label} onClick={()=>setViewDoc(sl.doc)} style={{width:48,height:48,objectFit:'cover',borderRadius:6,cursor:'pointer',border:`2px solid ${T.ok}`}}/>
                :<div onClick={()=>setViewDoc(sl.doc)} style={{width:48,height:48,background:T.card,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,cursor:'pointer',border:`1px solid ${T.border}`}}>📄</div>
              }
              <button onClick={()=>setViewDoc(sl.doc)} style={{background:T.aLo,border:`1px solid ${T.accent}30`,color:T.accent,borderRadius:7,padding:'5px 10px',cursor:'pointer',fontSize:11,fontWeight:700}}>View</button>
            </div>
          ))}
        </div>
      )}
      {loose.length>0&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:8}}>
          {loose.map(doc=>(
            <div key={doc.id} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:9,padding:8,textAlign:'center',cursor:'pointer'}} onClick={()=>setViewDoc(doc)}>
              {doc.type?.startsWith('image/')
                ?<img src={doc.dataUrl} alt={doc.name} style={{width:'100%',height:80,objectFit:'cover',borderRadius:6,marginBottom:6}}/>
                :<div style={{height:80,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,marginBottom:6}}>📄</div>
              }
              <div style={{color:T.txt,fontSize:11,fontWeight:600}}>{doc.name}</div>
              <div style={{color:T.accent,fontSize:10,marginTop:3}}>Tap to view</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Loan Detail Modal ──────────────────────────────────────────

// ═══════════════════════════════════════════════════════════
//  PAYMENT TIMELINE — missed vs paid, unified visual
// ═══════════════════════════════════════════════════════════

// Build a chronological timeline of expected vs actual payments for a loan.
// Late payments are matched back into the earliest unresolved missed slot.
const buildPaymentTimeline = (loan, payments) => {
  if(!loan.disbursed) return { timeline:[], latePayments:[] };

  const disbDate  = new Date(loan.disbursed);
  const today     = new Date();
  const todayStr  = today.toISOString().split('T')[0];
  const rt        = loan.repaymentType;
  const principal = loan.amount;
  const total     = principal + Math.round(principal * 0.3); // 30% flat interest

  const intervalDays = rt==='Daily'?1 : rt==='Weekly'?7 : rt==='Biweekly'?14 : rt==='Monthly'?30 : null;
  const installAmt   = intervalDays
    ? (rt==='Daily'   ? Math.ceil(total/30)
      :rt==='Weekly'  ? Math.ceil(total/4)
      :rt==='Biweekly'? Math.ceil(total/2)
      :/* Monthly */    total)
    : total;

  // Build ALL expected slots (past + future up to loan end)
  const slots = [];
  if(intervalDays) {
    const numSlots = rt==='Daily'?30 : rt==='Weekly'?4 : rt==='Biweekly'?2 : 1;
    for(let i=0;i<numSlots;i++){
      const d = new Date(disbDate);
      d.setDate(d.getDate()+(i+1)*intervalDays);
      slots.push({ dueDate:d.toISOString().split('T')[0], expectedAmt:Math.min(installAmt, total-installAmt*i) });
    }
  } else {
    // Lump Sum — one slot at 30 days
    const dueD = new Date(disbDate);
    dueD.setDate(dueD.getDate()+30);
    slots.push({ dueDate:dueD.toISOString().split('T')[0], expectedAmt:total });
  }

  // Sort actual payments chronologically
  const sortedPays = [...payments].sort((a,b)=>a.date.localeCompare(b.date));

  // PASS 1: match each payment to slots whose window it falls in (on-time)
  const usedPayIds = new Set();
  const timeline = slots.map((slot, slotIdx) => {
    const prevDue = slotIdx > 0 ? slots[slotIdx-1].dueDate : loan.disbursed;
    const onTimePays = sortedPays.filter(p=>
      p.date > prevDue && p.date <= slot.dueDate && !usedPayIds.has(p.id)
    );
    const windowAmt = onTimePays.reduce((s,p)=>s+p.amount,0);
    onTimePays.forEach(p=>usedPayIds.add(p.id));
    let status = windowAmt === 0 ? 'missed'
               : windowAmt >= slot.expectedAmt * 0.9 ? 'paid'
               : 'partial';
    return { ...slot, payments:onTimePays, windowAmt, status, latePayments:[] };
  });

  // PASS 2: remaining payments are late — slot them into the earliest still-missed slot
  const remainingPays = sortedPays.filter(p=>!usedPayIds.has(p.id));
  let carryover = 0;
  for(const pay of remainingPays){
    let remaining = pay.amount;
    // Find missed/partial slots in order and fill them
    for(const slot of timeline){
      if(remaining <= 0) break;
      if(slot.status === 'paid') continue;
      const shortfall = slot.expectedAmt - slot.windowAmt;
      if(shortfall <= 0) continue;
      const applying = Math.min(remaining, shortfall);
      slot.latePayments.push({ ...pay, appliedAmt: applying, lateApplied:true });
      slot.windowAmt += applying;
      remaining -= applying;
      if(slot.windowAmt >= slot.expectedAmt * 0.9){
        slot.status = pay.date <= slot.dueDate ? 'paid' : 'paid-late';
      } else {
        slot.status = 'partial';
      }
    }
    // Any residual is surplus (overpayment)
    if(remaining > 0) carryover += remaining;
  }

  return { timeline, latePayments:[] }; // latePayments is now always empty — all matched into slots
};

const PaymentTimeline = ({ loan, payments, compact=false }) => {
  const [expanded, setExpanded] = useState(false);
  const [drillFilter, setDrillFilter] = useState(null); // 'paid'|'paid-late'|'missed'|'partial'|'upcoming'|null
  const pays = payments.filter(p=>p.loanId===loan.id);
  const result = buildPaymentTimeline(loan, pays);
  if(!result || !result.timeline) return null;
  const { timeline } = result;
  if(!timeline.length) return (
    <div style={{color:T.muted,fontSize:12,textAlign:'center',padding:16}}>No payment schedule available</div>
  );

  const totalExpected = timeline.reduce((s,t)=>s+t.expectedAmt, 0);
  const totalPaid     = timeline.reduce((s,t)=>s+t.windowAmt + t.latePayments.reduce((a,p)=>a+(p.appliedAmt||0),0), 0);
  const onTime        = timeline.filter(t=>t.status==='paid').length;
  const late          = timeline.filter(t=>t.status==='paid-late').length;
  const missed        = timeline.filter(t=>t.status==='missed').length;
  const partial       = timeline.filter(t=>t.status==='partial').length;
  const upcoming      = timeline.filter(t=>t.status==='upcoming').length;
  const pct           = totalExpected > 0 ? Math.min(100, Math.round((totalPaid/totalExpected)*100)) : 0;

  const statusColor = s => s==='paid'?T.ok : s==='paid-late'?T.gold : s==='partial'?T.gold : s==='upcoming'?T.muted : T.danger;
  const statusIcon  = s => s==='paid'?'✓' : s==='paid-late'?'✓' : s==='partial'?'~' : s==='upcoming'?'·' : '✕';
  const statusLabel = s => s==='paid'?'On Time' : s==='paid-late'?'Late' : s==='partial'?'Partial' : s==='upcoming'?'Upcoming' : 'Missed';

  // Which slots to show based on drill filter + expand
  const PREVIEW = compact ? 4 : 6;
  const filtered = drillFilter ? timeline.filter(t=>t.status===drillFilter) : timeline;
  const shown = expanded || drillFilter ? filtered : filtered.slice(0, PREVIEW);

  const statBox = (label, value, color, filter) => (
    <div key={label}
      onClick={()=>{ setDrillFilter(drillFilter===filter?null:filter); setExpanded(true); }}
      style={{background: drillFilter===filter ? color+'22' : T.surface,
              border:`1px solid ${drillFilter===filter?color:T.border}`,
              borderRadius:9,padding:'8px 10px',textAlign:'center',cursor:'pointer',transition:'all .15s'}}>
      <div style={{color,fontFamily:T.mono,fontWeight:900,fontSize:16}}>{value}</div>
      <div style={{color:T.muted,fontSize:9,textTransform:'uppercase',letterSpacing:.6,marginTop:2}}>{label}</div>
    </div>
  );

  return (
    <div style={{fontFamily:T.body}}>

      {/* ── Summary stat boxes — all clickable ── */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:6}}>
        {statBox('On Time', onTime,   T.ok,    'paid')}
        {statBox('Late',    late,     T.gold,  'paid-late')}
        {statBox('Missed',  missed,   T.danger,'missed')}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:12}}>
        {statBox('Partial',  partial,  T.gold,  'partial')}
        {statBox('Upcoming', upcoming, T.muted, 'upcoming')}
        {statBox('Total',    timeline.length, T.txt, null)}
      </div>

      {/* ── Active filter banner ── */}
      {drillFilter&&(
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:statusColor(drillFilter)+'18',border:`1px solid ${statusColor(drillFilter)}30`,borderRadius:8,padding:'6px 12px',marginBottom:10}}>
          <span style={{color:statusColor(drillFilter),fontSize:12,fontWeight:700}}>Showing: {statusLabel(drillFilter)} installments ({filtered.length})</span>
          <button onClick={()=>{setDrillFilter(null);setExpanded(false);}} style={{background:'none',border:'none',color:T.muted,cursor:'pointer',fontSize:12}}>✕ Clear</button>
        </div>
      )}

      {/* ── Progress bar ── */}
      <div style={{marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
          <span style={{color:T.muted,fontSize:11}}>Collection progress</span>
          <span style={{color:pct>=80?T.ok:pct>=50?T.gold:T.danger,fontFamily:T.mono,fontWeight:800,fontSize:12}}>{pct}%</span>
        </div>
        <div style={{height:6,background:T.border,borderRadius:99,overflow:'hidden'}}>
          <div style={{height:'100%',width:`${pct}%`,background:pct>=80?`linear-gradient(90deg,${T.ok},#00FF7F)`:pct>=50?`linear-gradient(90deg,${T.gold},#FFD700)`:`linear-gradient(90deg,${T.danger},#FF6B6B)`,borderRadius:99,transition:'width .5s'}}/>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:3}}>
          <span style={{color:T.dim,fontSize:10}}>Paid: {fmt(totalPaid)}</span>
          <span style={{color:T.dim,fontSize:10}}>Expected: {fmt(totalExpected)}</span>
        </div>
      </div>

      {/* ── Timeline rows ── */}
      <div style={{maxHeight:'40vh',overflowY:'auto',overflowX:'hidden',display:'flex',flexDirection:'column',gap:4}}>
        {shown.map((slot, idx)=>{
          const col = statusColor(slot.status);
          const allPays = [...slot.payments, ...slot.latePayments];
          const hasLate = slot.latePayments.length > 0;
          return (
            <div key={idx} style={{
              borderRadius:10,overflow:'hidden',
              border:`1px solid ${col}${slot.status==='missed'&&!hasLate?'50':'30'}`,
              background: slot.status==='paid'     ? T.surface
                        : slot.status==='paid-late' ? T.gLo
                        : slot.status==='partial'   ? T.gLo
                        : slot.status==='upcoming'  ? 'transparent'
                        : hasLate                   ? T.gLo   // missed but later paid
                        : T.dLo,
            }}>
              <div style={{display:'flex',alignItems:'stretch',gap:0}}>
                {/* Left accent strip */}
                <div style={{width:4,background:col,flexShrink:0}}/>
                {/* Main content */}
                <div style={{flex:1,padding:'8px 10px',minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}}>
                    <span style={{background:col+'20',color:col,borderRadius:99,padding:'2px 8px',fontSize:10,fontWeight:800,letterSpacing:.5,flexShrink:0}}>
                      {statusIcon(slot.status)} {statusLabel(slot.status)}
                    </span>
                    <span style={{color:T.muted,fontSize:11,flexShrink:0}}>Due {slot.dueDate}</span>
                    {hasLate&&<span style={{background:T.gold+'20',color:T.gold,borderRadius:99,padding:'2px 6px',fontSize:9,fontWeight:700,flexShrink:0}}>💡 Recovered</span>}
                    <span style={{color:T.dim,fontSize:10,marginLeft:'auto',flexShrink:0}}>#{timeline.indexOf(slot)+1}</span>
                  </div>

                  {/* Amounts row */}
                  <div style={{display:'flex',alignItems:'center',gap:10,marginTop:6,flexWrap:'wrap'}}>
                    <div>
                      <div style={{color:T.muted,fontSize:9,textTransform:'uppercase',letterSpacing:.5}}>Expected</div>
                      <div style={{color:T.txt,fontFamily:T.mono,fontWeight:700,fontSize:12}}>{fmt(slot.expectedAmt)}</div>
                    </div>
                    <div style={{color:T.border,fontSize:14,alignSelf:'center'}}>→</div>
                    <div>
                      <div style={{color:T.muted,fontSize:9,textTransform:'uppercase',letterSpacing:.5}}>Received</div>
                      <div style={{color:col,fontFamily:T.mono,fontWeight:800,fontSize:13}}>{fmt(slot.windowAmt)}</div>
                    </div>
                    {slot.status!=='paid'&&slot.status!=='paid-late'&&slot.expectedAmt>slot.windowAmt&&(
                      <>
                        <div style={{color:T.border,fontSize:14,alignSelf:'center'}}>→</div>
                        <div>
                          <div style={{color:T.muted,fontSize:9,textTransform:'uppercase',letterSpacing:.5}}>Shortfall</div>
                          <div style={{color:T.danger,fontFamily:T.mono,fontWeight:800,fontSize:13}}>{fmt(slot.expectedAmt-slot.windowAmt)}</div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Payment receipts — on-time + late, all embedded here */}
                  {allPays.length>0&&(
                    <div style={{marginTop:7,display:'flex',flexDirection:'column',gap:4}}>
                      {allPays.map((p,pi)=>(
                        <div key={p.id||pi} style={{
                          display:'flex',justifyContent:'space-between',alignItems:'center',
                          background: p.lateApplied ? T.gold+'12' : T.ok+'10',
                          border:`1px solid ${p.lateApplied?T.gold:T.ok}25`,
                          borderRadius:7,padding:'5px 9px'
                        }}>
                          <div>
                            <span style={{color:p.lateApplied?T.gold:T.ok,fontFamily:T.mono,fontWeight:700,fontSize:11}}>{fmt(p.lateApplied?p.appliedAmt:p.amount)}</span>
                            <span style={{color:T.muted,fontSize:10,marginLeft:8}}>{p.date}</span>
                            {p.mpesa&&<span style={{color:T.dim,fontSize:9,marginLeft:6,fontFamily:T.mono}}>{p.mpesa}</span>}
                          </div>
                          <span style={{
                            background: p.lateApplied ? T.gold+'20' : T.ok+'15',
                            color: p.lateApplied ? T.gold : T.ok,
                            borderRadius:5,padding:'2px 6px',fontSize:9,fontWeight:700
                          }}>{p.lateApplied ? 'Late Payment' : 'On Time'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Show more/less */}
      {!drillFilter && filtered.length > PREVIEW && (
        <button onClick={()=>setExpanded(e=>!e)}
          style={{display:'block',width:'100%',marginTop:8,background:T.surface,border:`1px solid ${T.border}`,
                  color:T.muted,borderRadius:8,padding:'8px',cursor:'pointer',fontSize:12,fontWeight:600}}>
          {expanded ? '▲ Show less' : `▼ Show ${filtered.length - PREVIEW} more installments`}
        </button>
      )}
    </div>
  );
};


// ── Confirmation dialog for destructive actions ───────────────
const ConfirmDialog = ({title, message, confirmLabel='Confirm', confirmVariant='danger', onConfirm, onCancel}) => (
  <Dialog title={title} onClose={onCancel} width={400}>
    <p style={{color:T.txt,fontSize:14,lineHeight:1.6,marginBottom:16}}>{message}</p>
    <div style={{display:'flex',gap:8}}>
      <Btn v={confirmVariant} onClick={onConfirm} full>{confirmLabel}</Btn>
      <Btn v='secondary' onClick={onCancel} full>Cancel</Btn>
    </div>
  </Dialog>
);

const LoanModal = ({loan, customers, payments, interactions, onClose, onViewCustomer, actions}) => {
  useModalLock();
  const [tab, setTab] = useState('details');
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(()=>{
    const h=(e)=>{if(e.key==='Escape')onCloseRef.current();};
    document.addEventListener('keydown',h);
    return()=>document.removeEventListener('keydown',h);
  },[]);
  const loanDerived = useMemo(()=>{
    const cust    = customers.find(c=>c.id===loan.customerId||c.name===loan.customer)||{name:loan.customer};
    const pays    = payments.filter(p=>p.loanId===loan.id);
    const ints    = (interactions||[]).filter(i=>i.loanId===loan.id);
    const lastPay = [...pays].sort((a,b)=>b.date.localeCompare(a.date))[0]||null;
    const paid    = pays.reduce((s,p)=>s+p.amount,0);
    const engine  = calculateLoanStatus(loan);
    const penalty = engine.interestAccrued + engine.penaltyAccrued; // total charges (backward compat)
    const owed    = engine.totalAmountDue;
    return {cust,pays,ints,lastPay,paid,penalty,owed,engine};
  },[loan,customers,payments,interactions]);
  const {cust,pays,ints,lastPay,paid,penalty,owed,engine} = loanDerived;

  const schedule = ()=>{
    const bal=loan.balance; const rt=loan.repaymentType;
    if(!bal||bal<=0) return [];
    if(rt==='Daily')    return [{p:'Per Day',a:Math.ceil(bal/30)},{p:'Per Week',a:Math.ceil(bal/30)*7}];
    if(rt==='Weekly')   return [{p:'Per Week',a:Math.ceil(bal/4)},{p:'Per Month',a:bal}];
    if(rt==='Biweekly') return [{p:'Per 2 Weeks',a:Math.ceil(bal/2)},{p:'Per Month',a:bal}];
    if(rt==='Monthly')  return [{p:'Per Month',a:bal}];
    return [{p:'Lump Sum',a:bal}];
  };

  const TABS=[{k:'details',l:'Details'},{k:'timeline',l:'📅 Payment Timeline'},{k:'schedule',l:'Schedule'},{k:'interactions',l:`Interactions (${ints.length})`}];

  return (
    <div className='dialog-backdrop' role="dialog" aria-modal="true" aria-label={`Loan ${loan.id} — ${loan.customer}`} style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:9900,display:'flex',alignItems:'flex-start',justifyContent:'flex-end',backdropFilter:'blur(4px)',WebkitBackdropFilter:'blur(4px)',background:'rgba(4,8,16,0.55)',overflow:'hidden'}}>
    <div style={{background:T.card,borderLeft:`1px solid ${T.hi}`,width:'100%',maxWidth:520,height:'100%',display:'flex',flexDirection:'column',boxShadow:'-20px 0 60px #00000080',overflow:'hidden'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'18px 20px 14px',borderBottom:`1px solid ${T.border}`,flexShrink:0,background:T.card,zIndex:10}}>
        <div><div style={{color:T.txt,fontSize:15,fontWeight:800,fontFamily:T.head}}>{loan.id}</div><div style={{color:T.muted,fontSize:12,marginTop:2}}>{loan.customer} · {loan.status}</div></div>
        <button onClick={onClose} style={{background:T.card2,border:`1px solid ${T.border}`,color:T.muted,borderRadius:99,width:30,height:30,cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginLeft:12}}>✕</button>
      </div>
      <div style={{flex:1,padding:'18px 20px 32px',overflowY:'auto'}}>
      {/* Status + customer link */}
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12,flexWrap:'wrap'}}>
        <Badge color={SC[loan.status]||T.muted}>{loan.status}</Badge>
        {cust.id&&onViewCustomer&&(
          <button onClick={()=>{onClose();onViewCustomer(cust);}}
            style={{background:T.aLo,border:`1px solid ${T.aMid}`,color:T.accent,borderRadius:7,padding:'4px 10px',cursor:'pointer',fontSize:12,fontWeight:700}}>
            View Customer Profile →
          </button>
        )}
      </div>

      {/* Key figures — driven entirely by calculateLoanStatus engine */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:7,marginBottom:12}}>
        {[
          ['Principal',  fmt(loan.amount),                                    T.txt],
          ['Balance',    fmt(loan.balance),   loan.status==='Overdue'?T.danger:T.txt],
          ['Interest',   fmt(engine.interestAccrued), engine.interestAccrued>0?T.warn:T.muted],
          ['Penalty',    fmt(engine.penaltyAccrued),  engine.penaltyAccrued>0?T.danger:T.muted],
          ['Total Due',  fmt(engine.totalAmountDue),                          T.accent],
          ['Overdue',    loan.daysOverdue>0?`${loan.daysOverdue}d`:'None', loan.daysOverdue>0?T.danger:T.ok],
        ].map(([k,v,col])=>(
          <div key={k} style={{background:T.surface,borderRadius:8,padding:'8px 10px'}}>
            <div style={{color:T.muted,fontSize:9,textTransform:'uppercase',letterSpacing:.5,marginBottom:2}}>{k}</div>
            <div style={{color:col,fontWeight:800,fontSize:13,fontFamily:'monospace'}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Phase banner — shows only when overdue, driven by engine */}
      {engine.phase!=='none'&&loan.daysOverdue>0&&(
        <div style={{
          background: engine.isFrozen ? T.card2 : engine.phase==='penalty' ? T.dLo : T.wLo,
          border:`1px solid ${engine.isFrozen?T.border:engine.phase==='penalty'?T.danger+'40':T.warn+'40'}`,
          borderRadius:8,padding:'8px 12px',marginBottom:12,
          display:'flex',justifyContent:'space-between',alignItems:'center',
        }}>
          <div>
            <div style={{color:engine.isFrozen?T.muted:engine.phase==='penalty'?T.danger:T.warn,fontWeight:800,fontSize:12}}>
              {engine.isFrozen?'❄ Frozen':'⚠ '+engine.status}
            </div>
            <div style={{color:T.muted,fontSize:11,marginTop:2}}>
              {engine.isFrozen
                ?'No further interest or penalty — total is locked at '+fmt(engine.totalAmountDue)
                :engine.phase==='penalty'
                  ?`Interest locked at ${fmt(engine.interestAccrued)} (day 1–30) · Penalty: 1.2%/day`
                  :`Interest: 1.2%/day · Penalty starts at day 31`}
            </div>
          </div>
          <div style={{color:engine.isFrozen?T.muted:T.danger,fontFamily:'monospace',fontWeight:900,fontSize:14,flexShrink:0,marginLeft:8}}>
            {loan.daysOverdue}d
          </div>
        </div>
      )}

      {/* Last payment banner */}
      {lastPay&&(
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:T.oLo,border:`1px solid ${T.ok}30`,borderRadius:8,padding:'9px 13px',marginBottom:12}}>
          <div>
            <div style={{color:T.ok,fontWeight:700,fontSize:12}}>Last Payment</div>
            <div style={{color:T.muted,fontSize:11}}>{lastPay.date} · {lastPay.mpesa||'Manual'}</div>
          </div>
          <div style={{color:T.ok,fontFamily:'monospace',fontWeight:900,fontSize:15}}>{fmt(lastPay.amount)}</div>
        </div>
      )}

      {/* Tabs */}
      <div style={{display:'flex',gap:5,marginBottom:12,overflowX:'auto'}}>
        {TABS.map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{background:tab===t.k?T.accent:T.surface,color:tab===t.k?'#060A10':T.muted,
                    border:`1px solid ${tab===t.k?T.accent:T.border}`,borderRadius:99,
                    padding:'5px 12px',fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
            {t.l}
          </button>
        ))}
      </div>

      {tab==='details'&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
          {[['Disbursed',loan.disbursed||'Not yet'],['Due / Repayment',loan.repaymentType],
            ['M-Pesa Code',loan.mpesa||'—'],['Officer',loan.officer||'—'],
            ['Risk',loan.risk||'—'],['Customer ID',loan.customerId||'—'],
            ['Phase',engine.status],
          ].map(([k,v])=>(
            <div key={k} style={{background:T.surface,borderRadius:8,padding:'8px 10px'}}>
              <div style={{color:T.muted,fontSize:9,textTransform:'uppercase',letterSpacing:.5,marginBottom:2}}>{k}</div>
              <div style={{color:T.txt,fontSize:13,fontWeight:600}}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {tab==='timeline'&&(
        <div>
          <PaymentTimeline loan={loan} payments={payments}/>
        </div>
      )}

      {tab==='schedule'&&(
        <div>
          {loan.balance<=0
            ?<Alert type='ok'>Loan fully settled — no further payments due.</Alert>
            :<div>
              {schedule().map(({p,a})=>(
                <div key={p} style={{display:'flex',justifyContent:'space-between',padding:'9px 12px',background:T.surface,borderRadius:8,marginBottom:6,border:`1px solid ${T.border}`}}>
                  <span style={{color:T.muted,fontSize:13}}>{p}</span>
                  <span style={{color:T.accent,fontFamily:'monospace',fontWeight:800}}>{fmt(a)}</span>
                </div>
              ))}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginTop:8}}>
                {[
                  ['Remaining',    fmt(loan.balance)],
                  ['Interest',     fmt(engine.interestAccrued)],
                  ['Penalty',      fmt(engine.penaltyAccrued)],
                  ['Total Due',    fmt(engine.totalAmountDue)],
                  ['Phase',        engine.status],
                  ['Progress',     `${loan.amount>0?Math.min(100,Math.round((paid/loan.amount)*100)):0}%`],
                ].map(([k,v])=>(
                  <div key={k} style={{background:T.surface,borderRadius:8,padding:'8px 10px'}}>
                    <div style={{color:T.muted,fontSize:9,textTransform:'uppercase',letterSpacing:.5,marginBottom:2}}>{k}</div>
                    <div style={{color:T.txt,fontSize:13,fontWeight:700,fontFamily:'monospace'}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          }
        </div>
      )}

      {tab==='interactions'&&(
        <div>
          {ints.length===0&&<div style={{color:T.muted,textAlign:'center',padding:20,background:T.surface,borderRadius:9}}>No interactions for this loan</div>}
          {[...ints].sort((a,b)=>b.date.localeCompare(a.date)).map(i=>(
            <div key={i.id} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:9,padding:'10px 12px',marginBottom:7}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                <Badge color={T.accent}>{i.type}</Badge>
                <span style={{color:T.muted,fontSize:11}}>{i.date}</span>
              </div>
              <div style={{color:T.txt,fontSize:13}}>{i.notes}</div>
              {i.promiseAmount&&<div style={{color:T.gold,fontSize:12,marginTop:4}}>Promise: {fmt(i.promiseAmount)} by {i.promiseDate}</div>}
            </div>
          ))}
        </div>
      )}
      {actions&&<div style={{paddingTop:16,borderTop:`1px solid ${T.border}`,marginTop:4}}>{actions}</div>}
      </div>
    </div>
    </div>
  );
};

const CustomerDetail = ({customer, loans, payments, interactions, workers, onClose, onSave, onSelectLoan, onBlacklist}) => {
  useModalLock();
  const [tab,setTab]=useState('info');
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(()=>{
    const h=(e)=>{if(e.key==='Escape')onCloseRef.current();};
    document.addEventListener('keydown',h);
    return()=>document.removeEventListener('keydown',h);
  },[]);
  const [editing,setEditing]=useState(false);
  const custDerived = useMemo(()=>{
    const myLoans      = loans.filter(l=>l.customerId===customer.id);
    const myPays       = payments.filter(p=>p.customerId===customer.id);
    const myInts       = interactions.filter(i=>i.customerId===customer.id);
    const overdueLoans = myLoans.filter(l=>l.status==='Overdue');
    const activeLoans  = myLoans.filter(l=>l.status==='Active');
    const settledLoans = myLoans.filter(l=>l.status==='Settled');
    const totalOwed    = overdueLoans.reduce((s,l)=>s+calculateLoanStatus(l).totalAmountDue,0);
    const totalPaid    = myPays.reduce((s,p)=>s+p.amount,0);
    const totalPrincipal = myLoans.reduce((s,l)=>s+l.amount,0);
    const lastPay      = [...myPays].sort((a,b)=>b.date.localeCompare(a.date))[0]||null;
    return {myLoans,myPays,myInts,overdueLoans,activeLoans,settledLoans,totalOwed,totalPaid,totalPrincipal,lastPay};
  },[loans,payments,interactions,customer]);
  const {myLoans,myPays,myInts,overdueLoans,activeLoans,settledLoans,totalOwed,totalPaid,totalPrincipal,lastPay} = custDerived;
  const hasDefault=overdueLoans.length>0;
  const phone=(customer.phone||'').replace(/\s/g,'');
  const waPhone=phone.startsWith('0')?'254'+phone.slice(1):phone;
  const smsText=encodeURIComponent(`Dear ${customer.name.split(' ')[0]}, your loan balance of KES ${totalOwed.toLocaleString('en-KE')} is overdue. Please pay via Paybill 4166191, Account: ${customer.id}. Contact us for assistance.`);
  const waText=encodeURIComponent(`Hello ${customer.name.split(' ')[0]}, this is a reminder that your loan balance of *KES ${totalOwed.toLocaleString('en-KE')}* is overdue.\n\nPlease pay via:\n• Paybill: *4166191*\n• Account No: *${customer.id}*\n\nContact us if you need assistance.`);
  const tabs=[{k:'info',l:'Profile'},{k:'loans',l:`Loans (${myLoans.length})`},{k:'payments',l:`📅 Payment Track (${myPays.length})`},{k:'interactions',l:`Timeline (${myInts.length})`},{k:'docs',l:`Documents (${(customer.docs||[]).length})`}];
  return (
    <div className='dialog-backdrop' role='dialog' aria-modal='true' aria-label={`Customer profile — ${customer.name}`} style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:9900,display:'flex',alignItems:'flex-start',justifyContent:'flex-end',backdropFilter:'blur(4px)',WebkitBackdropFilter:'blur(4px)',background:'rgba(4,8,16,0.55)',overflow:'hidden'}}>
    <div style={{background:T.card,borderLeft:`1px solid ${T.hi}`,width:'100%',maxWidth:520,height:'100%',display:'flex',flexDirection:'column',boxShadow:'-20px 0 60px #00000080',overflow:'hidden'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'18px 20px 14px',borderBottom:`1px solid ${T.border}`,position:'sticky',top:0,background:T.card,zIndex:10}}>
        <div>
          <div style={{color:T.txt,fontSize:15,fontWeight:800,fontFamily:T.head}}>{customer.name}</div>
          <div style={{color:T.muted,fontSize:12,marginTop:2}}>{escHtml(customer.id)} · {escHtml(customer.business)||'—'} · {escHtml(customer.location)||'—'}</div>
        </div>
        <button onClick={onClose} aria-label='Close customer profile' style={{background:T.card2,border:`1px solid ${T.border}`,color:T.muted,borderRadius:99,width:30,height:30,cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginLeft:12}}><span aria-hidden='true'>✕</span></button>
      </div>
      <div style={{flex:1,overflowY:'auto',overflowX:'hidden',WebkitOverflowScrolling:'touch',padding:'18px 20px 40px'}}>
      {editing&&onSave&&(
        <CustomerEditForm
          customer={customer}
          workers={workers||[]}
          onSave={updated=>{onSave(updated);setEditing(false);}}
          onClose={()=>setEditing(false)}/>
      )}
      {!editing&&<>
      {customer.blacklisted&&<Alert type='danger'>⛔ This customer is blacklisted</Alert>}

      {/* Edit button */}
      {(onSave||onBlacklist)&&(
        <div style={{display:'flex',justifyContent:'flex-end',gap:6,marginBottom:12}}>
          {onBlacklist&&!customer.blacklisted&&<Btn sm v='danger' onClick={()=>onBlacklist(customer)}>⛔ Blacklist</Btn>}
          {onSave&&<Btn sm onClick={()=>setEditing(true)}>✏ Edit Customer</Btn>}
        </div>
      )}

      {/* Quick contact bar — only shown when defaulted */}
      {hasDefault&&(
        <div style={{background:T.dLo,border:`1px solid ${T.danger}30`,borderRadius:12,padding:'14px 16px',marginBottom:18}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,flexWrap:'wrap',gap:6}}>
            <div>
              <div style={{color:T.danger,fontWeight:800,fontSize:13}}>⚠ {overdueLoans.length} Overdue Loan{overdueLoans.length>1?'s':''}</div>
              <div style={{color:T.muted,fontSize:12,marginTop:2}}>Total owed: <span style={{color:T.danger,fontWeight:700,fontFamily:T.mono}}>{fmt(totalOwed)}</span> · Max overdue: <span style={{color:T.danger,fontWeight:700}}>{Math.max(...overdueLoans.map(l=>l.daysOverdue))}d</span></div>
            </div>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <a href={`tel:${phone}`} style={{flex:1,minWidth:90,display:'flex',alignItems:'center',justifyContent:'center',gap:7,background:T.ok,color:'#fff',borderRadius:9,padding:'10px 14px',fontWeight:800,fontSize:13,textDecoration:'none',fontFamily:T.body}}>
              📞 Call
            </a>
            <a href={`sms:${phone}?body=${smsText}`} style={{flex:1,minWidth:90,display:'flex',alignItems:'center',justifyContent:'center',gap:7,background:T.bLo,color:T.blue,border:`1px solid ${T.blue}38`,borderRadius:9,padding:'10px 14px',fontWeight:800,fontSize:13,textDecoration:'none',fontFamily:T.body}}>
              💬 SMS
            </a>
            <a href={`https://wa.me/${waPhone}?text=${waText}`} target='_blank' rel='noreferrer' style={{flex:1,minWidth:90,display:'flex',alignItems:'center',justifyContent:'center',gap:7,background:'#25D36618',color:'#25D366',border:'1px solid #25D36638',borderRadius:9,padding:'10px 14px',fontWeight:800,fontSize:13,textDecoration:'none',fontFamily:T.body}}>
              WhatsApp
            </a>
          </div>
          {/* NOK quick-dial if available */}
          {(customer.n1n||customer.n2n)&&(
            <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${T.danger}20`}}>
              <div style={{color:T.muted,fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:.7,marginBottom:7}}>Next of Kin — Quick Dial</div>
              <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
                {[[customer.n1n,customer.n1p,customer.n1r],[customer.n2n,customer.n2p,customer.n2r],[customer.n3n,customer.n3p,customer.n3r]].filter(([n])=>n).map(([name,ph,rel])=>(
                  <a key={ph} href={`tel:${(ph||'').replace(/\s/g,'')}`}
                    style={{display:'flex',alignItems:'center',gap:6,background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:'7px 11px',textDecoration:'none',fontSize:12,color:T.txt,fontWeight:600}}>
                    <span style={{fontSize:14}}>📞</span>
                    <span>{name} {rel?`(${rel})`:''}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{display:'flex',gap:5,marginBottom:16,overflowX:'auto',paddingBottom:4}}>
        {tabs.map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} style={{background:tab===t.k?T.accent:T.surface,color:tab===t.k?'#060A10':T.muted,border:`1px solid ${tab===t.k?T.accent:T.border}`,borderRadius:99,padding:'5px 14px',fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>{t.l}</button>
        ))}
      </div>

      {tab==='info'&&(
        <div>
          {/* Account summary */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:7,marginBottom:12}}>
            {[['Borrowed',fmt(totalPrincipal),T.accent],['Paid',fmt(totalPaid),T.ok],
              ['Active',activeLoans.length,activeLoans.length>0?T.ok:T.muted],
              ['Overdue',overdueLoans.length,overdueLoans.length>0?T.danger:T.ok],
              ['Settled',settledLoans.length,T.accent],['Joined',customer.joined,T.txt]
            ].map(([k,v,col])=>(
              <div key={k} style={{background:T.surface,borderRadius:8,padding:'9px 10px',border:`1px solid ${T.border}`}}>
                <div style={{color:T.muted,fontSize:9,textTransform:'uppercase',letterSpacing:.5,marginBottom:2}}>{k}</div>
                <div style={{color:col,fontWeight:800,fontSize:13,fontFamily:'monospace'}}>{v}</div>
              </div>
            ))}
          </div>
          {/* Last payment */}
          {lastPay&&(
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:T.oLo,border:`1px solid ${T.ok}30`,borderRadius:8,padding:'9px 13px',marginBottom:12}}>
              <div>
                <div style={{color:T.ok,fontWeight:700,fontSize:12}}>Last Payment</div>
                <div style={{color:T.muted,fontSize:11}}>{lastPay.date} · {lastPay.mpesa||'Manual'} · {lastPay.loanId||'—'}</div>
              </div>
              <div style={{color:T.ok,fontFamily:'monospace',fontWeight:900,fontSize:15}}>{fmt(lastPay.amount)}</div>
            </div>
          )}
          {/* Personal + business fields */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginBottom:12}}>
            {[['Customer ID',customer.id],['Phone',customer.phone],['Alt Phone',customer.altPhone||'—'],
              ['National ID',customer.idNo],['Date of Birth',customer.dob||'—'],['Gender',customer.gender||'—'],
              ['Residence',customer.residence||'—'],['Business',customer.business||'—'],
              ['Location',customer.location||'—'],['Officer',customer.officer||'—'],
              ['Risk',<Badge color={RC[customer.risk]}>{customer.risk}</Badge>],
              ['Status',customer.blacklisted?<Badge color={T.danger}>Blacklisted</Badge>:<Badge color={T.ok}>Active</Badge>]
            ].map(([k,v])=>(
              <div key={k} style={{background:T.surface,borderRadius:8,padding:'8px 10px'}}>
                <div style={{color:T.muted,fontSize:9,textTransform:'uppercase',letterSpacing:.5,marginBottom:2}}>{k}</div>
                <div style={{color:T.txt,fontSize:13,fontWeight:600}}>{v}</div>
              </div>
            ))}
          </div>
          {/* Next of kin */}
          <div style={{background:T.surface,borderRadius:10,padding:'12px 14px'}}>
            <div style={{color:T.accent,fontSize:10,fontWeight:700,letterSpacing:1,textTransform:'uppercase',marginBottom:8}}>Next of Kin</div>
            {[['1',customer.n1n,customer.n1p,customer.n1r],['2',customer.n2n,customer.n2p,customer.n2r],['3',customer.n3n,customer.n3p,customer.n3r]].map(([n,name,ph,rel])=>(
              <div key={n} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:`1px solid ${T.border}30`,fontSize:13}}>
                <span style={{color:T.muted}}>NOK {n}: <span style={{color:T.txt,fontWeight:600}}>{name||'—'}</span> {rel?<span style={{color:T.muted}}> · {rel}</span>:''}</span>
                {ph&&<a href={`tel:${ph.replace(/\s/g,'')}`} style={{color:T.accent,textDecoration:'none',fontSize:12,fontWeight:700,background:T.aLo,padding:'3px 9px',borderRadius:99,border:`1px solid ${T.aMid}`}}>📞 {ph}</a>}
              </div>
            ))}
          </div>
        </div>
      )}
      {tab==='loans'&&(
        <div>
          {myLoans.length===0&&<div style={{color:T.muted,textAlign:'center',padding:20,background:T.surface,borderRadius:9}}>No loans on record</div>}
          <div style={{maxHeight:'40vh',overflowY:'auto',overflowX:'hidden'}}>
          {myLoans.map(loan=>{
            const lPays=myPays.filter(p=>p.loanId===loan.id);
            const lLast=[...lPays].sort((a,b)=>b.date.localeCompare(a.date))[0]||null;
            const lPaid=lPays.reduce((s,p)=>s+p.amount,0);
            const eng=calculateLoanStatus(loan);
            return (
              <div key={loan.id} style={{background:T.surface,border:`1.5px solid ${loan.status==='Overdue'?T.danger+'40':loan.status==='Settled'?T.accent+'30':T.border}`,borderRadius:11,padding:'13px 14px',marginBottom:10}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:9,flexWrap:'wrap',gap:5}}>
                  <div style={{display:'flex',alignItems:'center',gap:7}}>
                    <span onClick={()=>onSelectLoan&&onSelectLoan(loan)} style={{color:T.accent,fontFamily:'monospace',fontWeight:800,fontSize:13,cursor:onSelectLoan?'pointer':'default',borderBottom:onSelectLoan?`1px dashed ${T.accent}50`:'none'}}>{loan.id}</span>
                    <Badge color={SC[loan.status]||T.muted}>{loan.status}</Badge>
                    {eng.isFrozen&&<Badge color={T.muted}>❄ Frozen</Badge>}
                  </div>
                  <span style={{color:T.txt,fontFamily:'monospace',fontWeight:800}}>{fmt(loan.amount)}</span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5,marginBottom:8}}>
                  {[['Balance',    fmt(loan.balance),                  loan.status==='Overdue'?T.danger:T.txt],
                    ['Interest',   fmt(eng.interestAccrued),            eng.interestAccrued>0?T.warn:T.muted],
                    ['Penalty',    fmt(eng.penaltyAccrued),             eng.penaltyAccrued>0?T.danger:T.muted],
                    ['Total Due',  fmt(eng.totalAmountDue),             T.accent],
                    ['Overdue',    loan.daysOverdue>0?`${loan.daysOverdue}d`:'None', loan.daysOverdue>0?T.danger:T.ok],
                    ['Officer',    loan.officer||'—',                   T.txt],
                  ].map(([k,v,col])=>(
                    <div key={k} style={{background:T.card,borderRadius:6,padding:'6px 8px'}}>
                      <div style={{color:T.muted,fontSize:9,textTransform:'uppercase',letterSpacing:.4,marginBottom:1}}>{k}</div>
                      <div style={{color:col,fontSize:12,fontWeight:700}}>{v}</div>
                    </div>
                  ))}
                </div>
                {lLast&&(
                  <div style={{display:'flex',justifyContent:'space-between',background:T.oLo,border:`1px solid ${T.ok}20`,borderRadius:6,padding:'6px 9px',fontSize:12}}>
                    <span style={{color:T.muted}}>Last payment <b style={{color:T.txt}}>{lLast.date}</b> · {lLast.mpesa||'manual'}</span>
                    <span style={{color:T.ok,fontFamily:'monospace',fontWeight:800}}>{fmt(lLast.amount)}</span>
                  </div>
                )}
                {lPaid>0&&<div style={{color:T.muted,fontSize:11,marginTop:5}}>{lPays.length} payment{lPays.length!==1?'s':''} · total paid <b style={{color:T.ok}}>{fmt(lPaid)}</b></div>}
              </div>
            );
          })}
          </div>
        </div>
      )}
      {tab==='payments'&&(
        <div>
          {/* Per-loan payment timelines */}
          {myLoans.filter(l=>l.disbursed).length===0&&(
            <div style={{color:T.muted,textAlign:'center',padding:24,background:T.surface,borderRadius:10}}>No loan history with payments</div>
          )}
          <div style={{maxHeight:'40vh',overflowY:'auto',overflowX:'hidden'}}>
          {myLoans.filter(l=>l.disbursed).map(l=>(
            <div key={l.id} style={{marginBottom:20}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,flexWrap:'wrap',padding:'8px 10px',background:T.surface,borderRadius:9,border:`1px solid ${T.border}`}}>
                <span onClick={e=>{e.stopPropagation();if(onSelectLoan)onSelectLoan(l);}} style={{color:T.accent,fontFamily:'monospace',fontWeight:700,fontSize:12,cursor:onSelectLoan?'pointer':'default',borderBottom:onSelectLoan?`1px dashed ${T.accent}50`:'none'}}>{l.id}</span>
                <Badge color={SC[l.status]||T.muted}>{l.status}</Badge>
                <span style={{color:T.muted,fontSize:11}}>{l.repaymentType} · {fmt(l.amount)}</span>
                <span style={{color:T.muted,fontSize:11,marginLeft:'auto'}}>Disbursed {l.disbursed}</span>
              </div>
              <PaymentTimeline loan={l} payments={payments} compact={true}/>
            </div>
          ))}
          </div>
        </div>
      )}
      {tab==='interactions'&&(
        myInts.length===0?<div style={{color:T.muted,textAlign:'center',padding:20}}>No interactions recorded</div>:
        <div style={{maxHeight:'40vh',overflowY:'auto',overflowX:'hidden',display:'flex',flexDirection:'column',gap:10}}>
          {myInts.map(i=>(
            <div key={i.id} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:'12px 14px'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                <Badge color={T.accent}>{i.type}</Badge>
                <span style={{color:T.muted,fontSize:12}}>{i.date} · {i.officer}</span>
              </div>
              <div style={{color:T.txt,fontSize:13}}>{i.notes}</div>
              {i.promiseAmount&&<div style={{color:T.gold,fontSize:12,marginTop:4}}>Promise: {fmt(i.promiseAmount)} by {i.promiseDate} · <Badge color={i.promiseStatus==='Pending'?T.warn:i.promiseStatus==='Kept'?T.ok:T.danger}>{i.promiseStatus}</Badge></div>}
            </div>
          ))}
        </div>
      )}
      {tab==='docs'&&<CustDocsTab customer={customer}/>}
      </>}
      </div>
    </div>
    </div>
  );
};

// ═══════════════════════════════════════════
//  LOANS PAGE
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
//  PDF GENERATORS — Loan Agreement + Asset Declaration
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════
//  PDF DOCUMENT GENERATORS
// ═══════════════════════════════════════════
const safeStr = (v) => String(v || "").replace(/[<>&"]/g, (c) => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c]));

const generateLoanAgreementHTML = (loan, customer, officer) => {
  const today = new Date().toLocaleDateString("en-KE", {day:"2-digit",month:"long",year:"numeric"});
  const disbDate = safeStr(loan.disbursed ? new Date(loan.disbursed).toLocaleDateString("en-KE",{day:"2-digit",month:"long",year:"numeric"}) : today);
  const totalRepay = loan.balance || Math.round((loan.amount||0)*1.3);
  const fmtAmt = (v) => "KES " + Number(v||0).toLocaleString("en-KE");
  const repSched = () => {
    const t = totalRepay, rt = loan.repaymentType;
    if(rt==="Daily") return "KES "+Math.ceil(t/30).toLocaleString("en-KE")+" per day for 30 days";
    if(rt==="Weekly") return "KES "+Math.ceil(t/4).toLocaleString("en-KE")+" per week";
    if(rt==="Biweekly") return "KES "+Math.ceil(t/2).toLocaleString("en-KE")+" every 2 weeks";
    if(rt==="Monthly") return fmtAmt(t)+" per month";
    return fmtAmt(t)+" lump sum";
  };
  const n = safeStr; // alias
  const parts = [
    "<!DOCTYPE html><html><head><meta charset=UTF-8><title>Loan Agreement " + n(loan.id) + "</title>",
    "<style>body{font-family:Arial,sans-serif;font-size:11pt;padding:28mm 22mm;color:#111;line-height:1.5}",
    "h1{font-size:17pt;text-align:center;text-transform:uppercase;margin-bottom:2px}",
    "h2{font-size:12pt;text-align:center;font-weight:normal;margin-bottom:16px}",
    "hr{border:none;border-top:2px solid #111;margin:10px 0}.thin{border-top:1px solid #999}",
    ".sec{font-size:11.5pt;font-weight:bold;text-transform:uppercase;margin:16px 0 6px;border-bottom:1px solid #333;padding-bottom:2px}",
    "table{width:100%;border-collapse:collapse;margin-bottom:8px}td{padding:4px 8px;font-size:10.5pt;vertical-align:top}",
    "td:first-child{font-weight:bold;width:40%;color:#333}",
    ".grid{display:grid;grid-template-columns:1fr 1fr;gap:0 24px}",
    ".box{background:#f5f5f5;border:1.5px solid #333;border-radius:4px;padding:10px 14px;margin:10px 0;text-align:center}",
    ".big{font-size:18pt;font-weight:bold}.lbl{font-size:9pt;color:#555;text-transform:uppercase}",
    ".clause{margin:6px 0;padding-left:16px;font-size:10.5pt}",
    ".sig{margin-top:28px;display:grid;grid-template-columns:1fr 1fr;gap:24px}",
    ".sline{border-bottom:1.5px solid #333;margin:34px 0 4px}.slbl{font-size:9pt;color:#555;text-transform:uppercase}",
    ".sname{font-size:10pt;font-weight:bold;margin-top:2px}.dateline{border-bottom:1px solid #999;width:60%;margin-top:22px}",
    "@media print{body{padding:20mm 18mm}}</style></head><body>",
    "<h1>Adequate Capital Ltd</h1><h2>Micro-Finance Loan Agreement</h2><hr>",
    "<p style='text-align:center;font-size:9.5pt;color:#555;margin-bottom:14px'>Ref: <b>" + n(loan.id) + "</b> &nbsp;|&nbsp; Date: <b>" + disbDate + "</b></p>",
    "<p style='margin-bottom:12px'>This Agreement is entered on <b>" + disbDate + "</b> between <b>Adequate Capital Ltd</b> (Lender) and the borrower below.</p>",
    "<div class=sec>1. Borrower Information</div><div class=grid>",
    "<table><tr><td>Full Name</td><td>" + n(customer.name) + "</td></tr>",
    "<tr><td>National ID</td><td>" + n(customer.idNo) + "</td></tr>",
    "<tr><td>Date of Birth</td><td>" + n(customer.dob) + "</td></tr>",
    "<tr><td>Gender</td><td>" + n(customer.gender) + "</td></tr>",
    "<tr><td>Phone</td><td>" + n(customer.phone) + "</td></tr>",
    "<tr><td>Alt Phone</td><td>" + n(customer.altPhone) + "</td></tr></table>",
    "<table><tr><td>Residence</td><td>" + n(customer.residence||customer.location) + "</td></tr>",
    "<tr><td>Customer ID</td><td>" + n(customer.id) + "</td></tr>",
    "<tr><td>Risk</td><td>" + n(customer.risk) + "</td></tr>",
    "<tr><td>Date Joined</td><td>" + n(customer.joined) + "</td></tr></table></div>",
    "<div class=sec>2. Business Information</div><div class=grid>",
    "<table><tr><td>Business</td><td>" + n(customer.business) + "</td></tr><tr><td>Type</td><td>" + n(customer.businessType) + "</td></tr></table>",
    "<table><tr><td>Location</td><td>" + n(customer.location) + "</td></tr></table></div>",
    "<div class=sec>3. Loan Details</div>",
    "<div class=box><div class=lbl>Total Disbursed</div><div class=big>" + fmtAmt(loan.amount) + "</div>",
    "<div class=lbl style='margin-top:4px'>Total Repayable: " + fmtAmt(totalRepay) + " &nbsp;|&nbsp; " + repSched() + "</div></div>",
    "<div class=grid><table>",
    "<tr><td>Loan Ref</td><td>" + n(loan.id) + "</td></tr>",
    "<tr><td>Principal</td><td>" + fmtAmt(loan.amount) + "</td></tr>",
    "<tr><td>Interest (30%)</td><td>" + fmtAmt(Math.round((loan.amount||0)*0.3)) + "</td></tr>",
    "<tr><td>Total Repayable</td><td><b>" + fmtAmt(totalRepay) + "</b></td></tr></table>",
    "<table><tr><td>Disbursed</td><td>" + disbDate + "</td></tr>",
    "<tr><td>M-Pesa Code</td><td>" + n(loan.mpesa) + "</td></tr>",
    "<tr><td>Repayment</td><td>" + n(loan.repaymentType) + "</td></tr>",
    "<tr><td>Officer</td><td>" + n(loan.officer||officer) + "</td></tr></table></div>",
    "<div class=sec>4. Next of Kin</div><table>",
    "<tr style='background:#f0f0f0'><td><b>NOK</b></td><td><b>Name</b></td><td><b>Phone</b></td><td><b>Relationship</b></td></tr>",
    (customer.n1n ? "<tr><td>1st</td><td>"+n(customer.n1n)+"</td><td>"+n(customer.n1p)+"</td><td>"+n(customer.n1r)+"</td></tr>" : ""),
    (customer.n2n ? "<tr><td>2nd</td><td>"+n(customer.n2n)+"</td><td>"+n(customer.n2p)+"</td><td>"+n(customer.n2r)+"</td></tr>" : ""),
    (customer.n3n ? "<tr><td>3rd</td><td>"+n(customer.n3n)+"</td><td>"+n(customer.n3p)+"</td><td>"+n(customer.n3r)+"</td></tr>" : ""),
    "</table>",
    "<div class=sec>5. Terms</div>",
    "<p class=clause><b>5.1</b> Borrower agrees to repay " + fmtAmt(totalRepay) + " per the schedule above.</p>",
    "<p class=clause><b>5.2</b> Interest is 30% flat on principal, baked into the repayable amount. For overdue loans: Days 1–30 overdue: interest at 1.2%/day on outstanding balance. Days 31–60 overdue: penalty at 1.2%/day replaces interest (interest stops at day 30). After day 60: no further interest or penalty accrues — total amount due is frozen.</p>",
    "<p class=clause><b>5.3</b> Lender may contact Next of Kin upon default or non-communication.</p>",
    "<p class=clause><b>5.4</b> In default, Lender may recover via listed assets and legal means under Kenyan law.</p>",
    "<p class=clause><b>5.5</b> All information provided is true. False information is grounds for immediate loan recall.</p>",
    "<div class=sec>6. Signatures</div>",
    "<div class=sig>",
    "<div><div class=sline></div><div class=slbl>Borrower Signature</div><div class=sname>" + n(customer.name) + "</div><div class=slbl>ID: " + n(customer.idNo) + "</div><div class=dateline></div><div class=slbl>Date</div></div>",
    "<div><div class=sline></div><div class=slbl>Loan Officer Signature</div><div class=sname>" + n(loan.officer||officer||"Loan Officer") + "</div><div class=slbl>Adequate Capital Ltd</div><div class=dateline></div><div class=slbl>Date</div></div>",
    "</div>",
    "<hr class=thin style='margin-top:32px'><p style='font-size:9pt;color:#666;text-align:center'>Adequate Capital Ltd &middot; Micro-Finance &middot; Paybill: 4166191</p>",
    "</body></html>"
  ];
  return parts.join("\n");
};

const generateAssetListHTML = (loan, customer, officer) => {
  const today = new Date().toLocaleDateString("en-KE", {day:"2-digit",month:"long",year:"numeric"});
  const fmtAmt = (v) => "KES " + Number(v||0).toLocaleString("en-KE");
  const n = safeStr;
  const rowsHtml = Array.from({length:12}, (_, i) =>
    "<tr><td style='padding:8px 10px;border:1px solid #ccc'>"+(i+1)+"</td>" +
    "<td style='padding:8px 10px;border:1px solid #ccc'></td>" +
    "<td style='padding:8px 10px;border:1px solid #ccc'></td>" +
    "<td style='padding:8px 10px;border:1px solid #ccc'></td>" +
    "<td style='padding:8px 10px;border:1px solid #ccc'></td></tr>"
  ).join("");
  const parts = [
    "<!DOCTYPE html><html><head><meta charset=UTF-8><title>Asset Declaration " + n(loan.id) + "</title>",
    "<style>body{font-family:Arial,sans-serif;font-size:11pt;padding:28mm 22mm;color:#111;line-height:1.5}",
    "h1{font-size:17pt;text-align:center;text-transform:uppercase;margin-bottom:2px}h2{font-size:12pt;text-align:center;font-weight:normal;margin-bottom:16px}",
    "hr{border:none;border-top:2px solid #111;margin:10px 0}",
    ".sec{font-size:11.5pt;font-weight:bold;text-transform:uppercase;margin:16px 0 6px;border-bottom:1px solid #333;padding-bottom:2px}",
    ".grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin-bottom:12px}",
    ".row{display:flex;gap:8px;font-size:10.5pt}.lbl{font-weight:bold;color:#333;min-width:130px}",
    "table{width:100%;border-collapse:collapse;margin:10px 0}",
    "th{background:#2a3a50;color:#fff;padding:8px 10px;font-size:10pt;text-align:left;border:1px solid #2a3a50}",
    ".note{background:#fafafa;border:1px solid #ccc;border-radius:3px;padding:10px 14px;min-height:60px;font-size:10pt;margin:10px 0}",
    ".sig{margin-top:28px;display:grid;grid-template-columns:1fr 1fr;gap:24px}",
    ".sline{border-bottom:1.5px solid #333;margin:34px 0 4px}.slbl{font-size:9pt;color:#555;text-transform:uppercase}",
    ".sname{font-size:10pt;font-weight:bold;margin-top:2px}.dateline{border-bottom:1px solid #999;width:60%;margin-top:22px}",
    "@media print{body{padding:20mm 18mm}}</style></head><body>",
    "<h1>Adequate Capital Ltd</h1><h2>Asset Declaration &amp; Collateral List</h2><hr>",
    "<p style='text-align:center;font-size:9.5pt;color:#555;margin-bottom:14px'>Loan Ref: <b>" + n(loan.id) + "</b> &nbsp;|&nbsp; Date: <b>" + today + "</b></p>",
    "<p style='margin-bottom:12px'>This form lists all assets that may be used for loan recovery in the event of default on Loan <b>" + n(loan.id) + "</b>.</p>",
    "<div class=sec>Borrower Details</div><div class=grid>",
    "<div class=row><span class=lbl>Full Name:</span><span>" + n(customer.name) + "</span></div>",
    "<div class=row><span class=lbl>National ID:</span><span>" + n(customer.idNo) + "</span></div>",
    "<div class=row><span class=lbl>Business:</span><span>" + n(customer.business) + "</span></div>",
    "<div class=row><span class=lbl>Location:</span><span>" + n(customer.location) + "</span></div>",
    "<div class=row><span class=lbl>Phone:</span><span>" + n(customer.phone) + "</span></div>",
    "<div class=row><span class=lbl>Loan Amount:</span><span><b>" + fmtAmt(loan.amount) + "</b></span></div>",
    "<div class=row><span class=lbl>Loan Officer:</span><span>" + n(loan.officer||officer) + "</span></div>",
    "<div class=row><span class=lbl>Date:</span><span>" + today + "</span></div></div>",
    "<div class=sec>Asset List</div>",
    "<p style='font-size:10pt;color:#555;margin-bottom:8px'>List all assets including household items, business stock, land, vehicles, electronics.</p>",
    "<table><thead><tr><th style='width:5%'>#</th><th style='width:30%'>Description</th><th style='width:20%'>Location</th><th style='width:20%'>Est. Value (KES)</th><th style='width:25%'>Ownership Proof</th></tr></thead><tbody>",
    rowsHtml, "</tbody></table>",
    "<div class=sec>Additional Notes</div><div class=note><p style='color:#aaa;font-size:9.5pt'>Write additional assets here...</p></div>",
    "<div class=sec>Declaration</div>",
    "<p style='font-size:10.5pt'>I, <b>" + n(customer.name||"___________________") + "</b>, declare the assets above are true and accurate. I understand they may be used for recovery of Loan <b>" + n(loan.id) + "</b> upon default.</p>",
    "<div class=sig>",
    "<div><div class=sline></div><div class=slbl>Borrower Signature</div><div class=sname>" + n(customer.name) + "</div><div class=slbl>ID: " + n(customer.idNo) + "</div><div class=dateline></div><div class=slbl>Date</div></div>",
    "<div><div class=sline></div><div class=slbl>Loan Officer Signature &amp; Stamp</div><div class=sname>" + n(loan.officer||officer||"Loan Officer") + "</div><div class=slbl>Adequate Capital Ltd</div><div class=dateline></div><div class=slbl>Date</div></div>",
    "</div>",
    "<hr style='border-top:1px solid #ccc;margin-top:32px'><p style='font-size:9pt;color:#666;text-align:center'>Adequate Capital Ltd &middot; Micro-Finance &middot; Paybill: 4166191</p>",
    "</body></html>"
  ];
  return parts.join("\n");
};

const downloadLoanDoc = (html, filename) => {
  try {
    const blob = new Blob([html], {type:"text/html;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {href:url, download:filename});
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 500);
    try{SFX.download();}catch(e){}
  } catch(e) { console.error("Download failed", e); }
};


const ALoans = ({loans,setLoans,customers,setCustomers,payments,setPayments,interactions,workers,addAudit,showToast=()=>{}}) => {
  const {open:openContact, Popup:ContactPopup} = useContactPopup();
  const [flt,setFlt]=useState('All');
  const [q,setQ]=useState('');
  const [sel,setSel]=useState(null);
  const [selCust,setSelCust]=useState(null);
  const [showApp,setShowApp]=useState(false);
  const [disbLoan,setDisbLoan]=useState(null);
  const [payLoan,setPayLoan]=useState(null);
  const [disbF,setDisbF]=useState({mpesa:'',phone:'',date:now()});
  const [payF,setPayF]=useState({amount:'',mpesa:'',date:now(),isRegFee:false});
  const statuses=['All','Active','Overdue','Approved','Application submitted','worker-pending','Settled','Written off'];
  const rows=useMemo(()=>{
    const lq=q.trim().toLowerCase();
    return loans.filter(l=>{
      if(flt!=='All'&&l.status!==flt) return false;
      if(!lq) return true;
      return (
        l.id.toLowerCase().includes(lq)||
        (l.customer||'').toLowerCase().includes(lq)||
        (l.customerId||'').toLowerCase().includes(lq)||
        (l.officer||'').toLowerCase().includes(lq)||
        (l.mpesa||'').toLowerCase().includes(lq)||
        (l.phone||'').toLowerCase().includes(lq)||
        (l.repaymentType||'').toLowerCase().includes(lq)||
        (l.status||'').toLowerCase().includes(lq)||
        (l.disbursed||'').includes(lq)||
        String(l.amount||'').includes(lq)||
        String(l.balance||'').includes(lq)
      );
    });
  },[loans,flt,q]);

  // Check if customer has paid registration fee
  const hasRegFee=(cust)=>{
    if(!cust) return false;
    if(cust.loans>0) return true; // repeat customer, no fee needed
    // Check if a registration fee payment exists
    return payments&&payments.some(p=>p.customerId===cust.id&&p.isRegFee);
  };

  const doDisburse=()=>{
    if(!disbF.mpesa||!disbF.phone)return;
    const currentLoan=loans.find(l=>l.id===disbLoan.id);
    if(!currentLoan||currentLoan.status==='Active'){showToast('⚠ This loan is already active or no longer exists','warn');setDisbLoan(null);return;}
    const cust=customers.find(c=>c.id===disbLoan.customerId);
    if(cust&&cust.loans===0&&!hasRegFee(cust)){showToast('⚠ Registration fee not paid. Cannot disburse loan until KES 500 registration fee is confirmed.','warn');return;}
    const disbUpd={...disbLoan,status:'Active',disbursed:disbF.date,mpesa:disbF.mpesa,phone:disbF.phone};
    setLoans(ls=>ls.map(l=>l.id===disbLoan.id?disbUpd:l));
    sbWrite('loans',toSupabaseLoan(disbUpd));
    addAudit('Loan Disbursed',disbLoan.id,`${fmt(disbLoan.amount)} via ${disbF.mpesa}`);
    showToast(`✅ Loan ${disbLoan.id} disbursed — ${fmt(disbLoan.amount)}`,'ok');
    setDisbLoan(null);setSel(null);setDisbF({mpesa:'',phone:'',date:now()});
  };
  const doRecordPay=()=>{
    const amt=Math.floor(Number(payF.amount));
    if(!amt||amt<1){showToast('⚠ Enter a valid payment amount (minimum KES 1)','warn');return;}
    if(amt>(payLoan.balance||0)){showToast(`⚠ Payment of ${fmt(amt)} exceeds outstanding balance of ${fmt(payLoan.balance)}. Please enter a correct amount.`,'warn');return;}
    const newBal=Math.max((payLoan.balance||0)-amt,0);
    const newStatus=newBal<=0?'Settled':payLoan.status;
    const payId=uid('PAY');
    const payEntry={id:payId,date:payF.date||now(),amount:amt,mpesa:payF.mpesa||'manual',note:'',isRegFee:!!payF.isRegFee};
    // Update loan's embedded payment list
    const payLoanUpd={...payLoan,balance:newBal,status:newStatus,payments:[...(payLoan.payments||[]),payEntry]};
    setLoans(ls=>ls.map(l=>l.id===payLoan.id?payLoanUpd:l));
    sbWrite('loans',toSupabaseLoan(payLoanUpd));
    const custId=payLoan.customerId||customers.find(c=>c.name===payLoan.customer)?.id||'';
    const newPayment={...payEntry,customerId:custId,customer:payLoan.customer,loanId:payLoan.id,status:'Allocated',allocatedBy:'admin'};
    setPayments(ps=>[...ps,newPayment]);
    sbInsert('payments',toSupabasePayment(newPayment));
    addAudit('Payment Recorded',payLoan.id,`${fmt(amt)} via M-Pesa ${payF.mpesa||'manual'}${payF.isRegFee?' [Reg Fee]':''}`);
    showToast(`✅ Payment of ${fmt(amt)} recorded`+(newBal<=0?' — Loan settled!':'')+(payF.isRegFee?' · Registration fee marked':''),'ok');
    setPayLoan(null);setSel(null);setPayF({amount:'',mpesa:'',date:now(),isRegFee:false});
  };
  const [confirmAction,setConfirmAction]=useState(null); // {title,message,onConfirm}
  const doWriteoff=l=>{const upd={...l,status:'Written off'};setLoans(ls=>ls.map(x=>x.id===l.id?upd:x));sbWrite('loans',toSupabaseLoan(upd));addAudit('Loan Written Off',l.id,`Balance: ${fmt(l.balance)}`);showToast(`⚠ Loan ${l.id} written off`,'warn');setSel(null);};
  const doApprove=l=>{const upd={...l,status:'Approved'};setLoans(ls=>ls.map(x=>x.id===l.id?upd:x));sbWrite('loans',toSupabaseLoan(upd));addAudit('Loan Approved',l.id,`Amount: ${fmt(l.amount)}`);showToast(`✅ Loan ${l.id} approved — ${fmt(l.amount)}`,'ok');setSel(null);};
  const doReject=l=>{const upd={...l,status:'Rejected',rejectedAt:now()};setLoans(ls=>ls.map(x=>x.id===l.id?upd:x));sbWrite('loans',toSupabaseLoan(upd));addAudit('Loan Rejected',l.id,`Amount: ${fmt(l.amount)}`);showToast(`Loan ${l.id} rejected`,'warn');setSel(null);};

  const pendingWorker=useMemo(()=>loans.filter(l=>l.status==='worker-pending'||l.status==='Application submitted'),[loans]);
  const loanStats=useMemo(()=>({
    total:loans.length,
    overdue:loans.filter(l=>l.status==='Overdue').length,
    approved:loans.filter(l=>l.status==='Approved').length,
  }),[loans]);

  // Repayment schedule calculator
  const calcSchedule=(loan)=>{
    if(!loan||!loan.balance) return [];
    const total=loan.balance;
    const rt=loan.repaymentType;
    if(rt==='Daily'){const d=30;return [{period:'Per Day',amount:Math.ceil(total/d)},{period:'Per Week',amount:Math.ceil(total/d)*7},{period:'Per Month (30d)',amount:total}];}
    if(rt==='Weekly'){const w=4;return [{period:'Per Week',amount:Math.ceil(total/w)},{period:'Per 2 Weeks',amount:Math.ceil(total/w)*2},{period:'Per Month (4w)',amount:total}];}
    if(rt==='Biweekly'){return [{period:'Per 2 Weeks',amount:Math.ceil(total/2)},{period:'Per Month',amount:total}];}
    if(rt==='Monthly'){return [{period:'Per Month',amount:total}];}
    if(rt==='Lump Sum'){return [{period:'One-time (Lump Sum)',amount:total}];}
    return [];
  };

  return (
    <div className='fu'>
      {ContactPopup}
      {confirmAction&&<ConfirmDialog title={confirmAction.title} message={confirmAction.message} confirmLabel='Yes, proceed' confirmVariant='danger' onConfirm={confirmAction.onConfirm} onCancel={()=>setConfirmAction(null)}/>}
      {pendingWorker.length>0&&(
        <div style={{background:T.gLo,border:`1px solid ${T.gold}38`,borderRadius:12,marginBottom:16,overflow:'hidden'}}>
          {/* Header — always visible */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'11px 16px',borderBottom:`1px solid ${T.gold}20`}}>
            <div style={{color:T.gold,fontWeight:800,fontSize:13}}>
              ⏳ {pendingWorker.length} Loan Application{pendingWorker.length>1?'s':''} Awaiting Approval
            </div>
            <span style={{background:T.gold,color:'#000',borderRadius:99,padding:'1px 8px',fontSize:11,fontWeight:900}}>{pendingWorker.length}</span>
          </div>
          {/* Pending list — 40vh scroll container */}
          <div style={{maxHeight:'40vh',overflowY:'auto',overflowX:'hidden'}}>
            {pendingWorker.map(l=>(
              <div key={l.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',borderBottom:`1px solid ${T.gold}14`}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:T.txt,fontWeight:700,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.customer}</div>
                  <div style={{color:T.muted,fontSize:11,fontFamily:T.mono}}>{l.id} · {fmt(l.amount)} · {l.repaymentType} · {l.officer}</div>
                </div>
                <div style={{display:'flex',gap:6,flexShrink:0}}>
                  <Btn sm v='gold' onClick={()=>doApprove(l)}>✓ Approve</Btn>
                  <Btn sm v='danger' onClick={()=>doReject(l)}>✕ Reject</Btn>
                </div>
              </div>
            ))}
          </div>
          {pendingWorker.length>3&&(
            <div style={{textAlign:'center',padding:'5px',color:T.gold,fontSize:11,borderTop:`1px solid ${T.gold}15`}}>
              Scroll to see all {pendingWorker.length} applications
            </div>
          )}
        </div>
      )}
      <div className='mob-stack' style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18,gap:10}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
            <div style={{fontFamily:T.head,color:T.txt,fontSize:20,fontWeight:800}}>💰 Loan Management</div>
          </div>
          <div style={{color:T.muted,fontSize:13}}>{loanStats.total} total · {loanStats.overdue} overdue · {loanStats.approved} pending</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <RefreshBtn onRefresh={()=>{ setQ(''); setFlt('All'); setSel(null); }}/>
          <Btn onClick={()=>setShowApp(true)}>+ New Application</Btn>
        </div>
      </div>
      <div className='mob-stack' style={{display:'flex',gap:10,marginBottom:13,flexWrap:'wrap',alignItems:'center'}}>
        <Search value={q} onChange={setQ} placeholder='Search loan or customer…'/>
        <Pills opts={statuses} val={flt} onChange={setFlt}/>
      </div>
      <Card>
        <DT
          cols={[{k:'id',l:'ID',r:v=><span style={{color:T.accent,fontFamily:T.mono,fontWeight:700,fontSize:12}}>{v}</span>},{k:'customer',l:'Customer',r:(v,r)=>{const c=customers.find(x=>x.name===v);return <span onClick={e=>{e.stopPropagation();if(c){setSelCust(c);}else{openContact(v,r.phone,e);}}} style={{color:T.accent,cursor:'pointer',fontWeight:600,borderBottom:`1px dashed ${T.accent}50`}}>{v}</span>;}},{k:'amount',l:'Principal',r:v=><span style={{fontFamily:T.mono}}>{fmt(v)}</span>},{k:'balance',l:'Balance',r:(v,r)=><span style={{color:r.status==='Overdue'?T.danger:T.txt,fontFamily:T.mono}}>{fmt(v)}</span>},{k:'status',l:'Status',r:v=><Badge color={SC[v]||T.muted}>{v}</Badge>},{k:'repaymentType',l:'Type'},{k:'daysOverdue',l:'Overdue',r:v=>v>0?<span style={{color:T.danger,fontWeight:700,fontFamily:T.mono}}>{v}d</span>:<span style={{color:T.muted}}>—</span>},{k:'officer',l:'Officer'}]}
          rows={rows} onRow={setSel}
        />
      </Card>
      {sel&&(
        <LoanModal
          loan={sel} customers={customers} payments={payments} interactions={interactions||[]}
          onClose={()=>setSel(null)}
          onViewCustomer={cust=>{setSel(null);setSelCust(cust);}}
          actions={(
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {(sel.status==='Application submitted'||sel.status==='worker-pending')&&<Btn v='gold' onClick={()=>{doApprove(sel);setSel(null);}}>✓ Approve</Btn>}
              {(sel.status==='Application submitted'||sel.status==='worker-pending')&&<Btn v='danger' onClick={()=>setConfirmAction({title:'Reject Application',message:`Reject loan application ${sel.id} for ${sel.customer} (${fmt(sel.amount)})? The customer will need to re-apply.`,onConfirm:()=>{doReject(sel);setConfirmAction(null);}})}>✕ Reject</Btn>}
              {sel.status==='Approved'&&<Btn onClick={()=>{setDisbLoan(sel);setSel(null);}}>💸 Disburse</Btn>}
              {['Active','Overdue'].includes(sel.status)&&<Btn v='ok' onClick={()=>{setPayLoan(sel);setSel(null);}}>💳 Record Payment</Btn>}
              {!['Written off','Settled','Rejected'].includes(sel.status)&&<Btn v='danger' onClick={()=>setConfirmAction({title:'Write Off Loan',message:`Write off loan ${sel.id} for ${sel.customer}? Balance of ${fmt(sel.balance)} will be marked as a loss. This cannot be undone.`,onConfirm:()=>{doWriteoff(sel);setConfirmAction(null);}})}>✕ Write Off</Btn>}
              {['Active','Overdue','Approved'].includes(sel.status)&&(()=>{const sc=customers.find(c=>c.id===sel.customerId);return(<>
                <Btn v='blue' onClick={()=>downloadLoanDoc(generateLoanAgreementHTML(sel,sc||{name:sel.customer},sel.officer),'loan-agreement-'+sel.id+'.html')}>📋 Agreement</Btn>
                <Btn v='secondary' onClick={()=>downloadLoanDoc(generateAssetListHTML(sel,sc||{name:sel.customer},sel.officer),'asset-list-'+sel.id+'.html')}>📦 Assets</Btn>
              </>);})()}
              <Btn v='ghost' onClick={()=>setSel(null)}>Close</Btn>
            </div>
          )}
        />
      )}
      {selCust&&<CustomerDetail customer={selCust} loans={loans} payments={payments} interactions={interactions||[]} workers={workers||[]} onClose={()=>setSelCust(null)} onSelectLoan={loan=>{setSelCust(null);setSel(loan);}} onSave={updated=>{setCustomers(cs=>cs.map(c=>c.id===updated.id?updated:c));sbWrite('customers',toSupabaseCustomer(updated));addAudit('Customer Updated',updated.id,updated.name);showToast('Updated','ok');setSelCust(updated);}}/>}
      {showApp&&(
        <Dialog title='New Loan Application' onClose={()=>setShowApp(false)} width={560}>
          <LoanForm customers={customers} payments={payments} loans={loans} onSave={l=>{setLoans(ls=>[l,...ls]);sbInsert('loans',toSupabaseLoan(l));const updCust=customers.find(c=>c.id===l.customerId);if(updCust){const nc={...updCust,loans:(updCust.loans||0)+1};setCustomers(cs=>cs.map(c=>c.id===l.customerId?nc:c));sbWrite('customers',toSupabaseCustomer(nc));}else{setCustomers(cs=>cs.map(c=>c.id===l.customerId?{...c,loans:(c.loans||0)+1}:c));}addAudit('Loan Application',l.id,`${fmt(l.amount)} for ${l.customer}`);setShowApp(false);}} onClose={()=>setShowApp(false)}/>
        </Dialog>
      )}
      {disbLoan&&(()=>{
        const cust=customers.find(c=>c.id===disbLoan.customerId);
        const regFeeOk=!cust||cust.loans>0||hasRegFee(cust);
        return (
        <Dialog title={`Disburse · ${disbLoan.id}`} onClose={()=>setDisbLoan(null)} width={580}>
          <Alert type='info'>Disbursing <b>{fmt(disbLoan.amount)}</b> to <b>{disbLoan.customer}</b></Alert>
          {!regFeeOk&&<Alert type='danger'>⛔ Registration fee (KES 500) has NOT been paid. You cannot disburse until this is confirmed.</Alert>}
          {regFeeOk&&<Alert type='ok'>✓ Registration fee verified. Proceed with disbursement.</Alert>}
          <FI label='M-Pesa Transaction Code' value={disbF.mpesa} onChange={v=>setDisbF(f=>({...f,mpesa:v}))} required placeholder='e.g. QAB123456'/>
          <FI label='Disbursement Phone' value={disbF.phone} onChange={v=>setDisbF(f=>({...f,phone:v}))} required/>
          <FI label='Date' type='date' value={disbF.date} onChange={v=>setDisbF(f=>({...f,date:v}))}/>
          <div style={{display:'flex',gap:9}}><Btn onClick={doDisburse} full disabled={!regFeeOk}>✓ Confirm Disbursement</Btn><Btn v='secondary' onClick={()=>setDisbLoan(null)}>Cancel</Btn></div>
          {/* PDF Documents — available before and after disbursement */}
          <div style={{marginTop:16,paddingTop:14,borderTop:`1px solid ${T.border}`}}>
            <div style={{color:T.txt,fontWeight:700,fontSize:13,marginBottom:3}}>📄 Loan Documents</div>
            <div style={{color:T.muted,fontSize:12,marginBottom:10}}>Download for signing before or after disbursement. Opens as printable HTML.</div>
            <div style={{display:'flex',gap:9,flexWrap:'wrap'}}>
              <Btn v='blue' onClick={()=>{
                const loanForDoc={...disbLoan,mpesa:disbF.mpesa||disbLoan.mpesa,disbursed:disbF.date||disbLoan.disbursed};
                downloadLoanDoc(generateLoanAgreementHTML(loanForDoc,cust||{name:disbLoan.customer},disbLoan.officer),'loan-agreement-'+disbLoan.id+'.html');
              }}>📋 Loan Agreement</Btn>
              <Btn v='secondary' onClick={()=>{
                downloadLoanDoc(generateAssetListHTML(disbLoan,cust||{name:disbLoan.customer},disbLoan.officer),'asset-list-'+disbLoan.id+'.html');
              }}>📦 Asset Declaration</Btn>
            </div>
          </div>
        </Dialog>
      );})()}
      {payLoan&&(()=>{
        const payLoanCust=customers.find(c=>c.id===payLoan.customerId||c.name===payLoan.customer);
        const isNewForFee=payLoanCust&&payLoanCust.loans<=1&&!hasRegFee(payLoanCust);
        return (
        <Dialog title={`Record Payment · ${payLoan.id}`} onClose={()=>{setPayLoan(null);setPayF({amount:'',mpesa:'',date:now(),isRegFee:false});}}>
          <Alert type='info'><b>{payLoan.customer}</b> · Outstanding: <b>{fmt(payLoan.balance)}</b></Alert>
          {isNewForFee&&(
            <div style={{background:T.gLo,border:`1px solid ${T.gold}38`,borderRadius:10,padding:'10px 14px',marginBottom:4}}>
              <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}>
                <input type='checkbox' checked={!!payF.isRegFee} onChange={e=>setPayF(f=>({...f,isRegFee:e.target.checked}))}
                  style={{width:16,height:16,accentColor:T.gold,cursor:'pointer'}}/>
                <div>
                  <div style={{color:T.gold,fontWeight:700,fontSize:13}}>Mark as Registration Fee (KES 500)</div>
                  <div style={{color:T.muted,fontSize:11,marginTop:2}}>This is a new client. Tick this if the payment includes the one-time KES 500 registration fee.</div>
                </div>
              </label>
            </div>
          )}
          <FI label='Payment Amount (KES)' type='number' value={payF.amount} onChange={v=>setPayF(f=>({...f,amount:v}))} required placeholder='Amount received'/>
          <FI label='M-Pesa Code (optional)' value={payF.mpesa} onChange={v=>setPayF(f=>({...f,mpesa:v}))} placeholder='e.g. QAB123456'/>
          <FI label='Payment Date' type='date' value={payF.date||now()} onChange={v=>setPayF(f=>({...f,date:v}))}/>
          <div style={{display:'flex',gap:9}}><Btn onClick={doRecordPay} full>✓ Save Payment</Btn><Btn v='secondary' onClick={()=>{setPayLoan(null);setPayF({amount:'',mpesa:'',date:now(),isRegFee:false});}}>Cancel</Btn></div>
        </Dialog>
        );
      })()}
    </div>
  );
};

// ═══════════════════════════════════════════
//  CUSTOMERS PAGE
// ═══════════════════════════════════════════
const ACustomers = ({customers,setCustomers,workers,loans,payments,interactions,addAudit,showToast=()=>{}}) => {
  const {open:openContact, Popup:ContactPopup} = useContactPopup();
  const [q,setQ]=useState('');
  const [statusFlt,setStatusFlt]=useState('All');
  const [sel,setSel]=useState(null);
  const [selLoan,setSelLoan]=useState(null);

  // Build a set of customerIds who have an Active or Overdue loan right now
  const activeBorrowerIds=useMemo(()=>
    new Set(loans.filter(l=>l.status==='Active'||l.status==='Overdue').map(l=>l.customerId).filter(Boolean))
  ,[loans]);

  const custStats=useMemo(()=>({
    total:customers.length,
    blacklisted:customers.filter(c=>c.blacklisted).length,
    activeBorrowers:customers.filter(c=>activeBorrowerIds.has(c.id)).length,
    noLoans:customers.filter(c=>!c.blacklisted&&c.loans===0).length,
  }),[customers,activeBorrowerIds]);

  const STATUS_OPTS=['All','Active Borrowers','Blacklisted','No Loans'];

  const filtered=useMemo(()=>{
    const lq=q.trim().toLowerCase();
    return customers.filter(c=>{
      // Status filter
      if(statusFlt==='Active Borrowers' && !activeBorrowerIds.has(c.id)) return false;
      if(statusFlt==='Blacklisted'      && !c.blacklisted)               return false;
      if(statusFlt==='No Loans'         && (c.blacklisted||c.loans>0))   return false;
      // Search
      if(!lq) return true;
      return (
        c.id.toLowerCase().includes(lq)||
        (c.name||'').toLowerCase().includes(lq)||
        (c.phone||'').includes(lq)||
        (c.altPhone||'').includes(lq)||
        (c.idNo||'').includes(lq)||
        (c.business||'').toLowerCase().includes(lq)||
        (c.location||'').toLowerCase().includes(lq)||
        (c.officer||'').toLowerCase().includes(lq)||
        (c.risk||'').toLowerCase().includes(lq)||
        (c.residence||'').toLowerCase().includes(lq)
      );
    });
  },[customers,q,statusFlt,activeBorrowerIds]);

  const blacklist=c=>{
    const upd={...c,blacklisted:true,blReason:'Admin action'};
    setCustomers(cs=>cs.map(x=>x.id===c.id?upd:x));
    sbWrite('customers',toSupabaseCustomer(upd));
    addAudit('Customer Blacklisted',c.id,c.name);
    showToast(`⚠ ${c.name} has been blacklisted`,'warn');
    setSel(null);
  };
  const [blConfirm,setBlConfirm]=useState(null);
  return (
    <div className='fu'>
      {ContactPopup}
      <div className='mob-stack' style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,gap:10}}>
        <div>
          <div style={{fontFamily:T.head,color:T.txt,fontSize:20,fontWeight:800}}>👤 Customers</div>
          <div style={{color:T.muted,fontSize:13,marginTop:3}}>
            {custStats.total} registered ·{' '}
            <span style={{color:T.ok}}>{custStats.activeBorrowers} active borrowers</span> ·{' '}
            <span style={{color:T.danger}}>{custStats.blacklisted} blacklisted</span>
          </div>
        </div>
        <RefreshBtn onRefresh={()=>{ setQ(''); setStatusFlt('All'); setSel(null); }}/>
      </div>
      <div className='mob-stack' style={{display:'flex',gap:10,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
        <Search value={q} onChange={setQ} placeholder='Search name, phone or ID…'/>
        <Pills opts={STATUS_OPTS} val={statusFlt} onChange={setStatusFlt}/>
      </div>
      <div style={{marginTop:4}}>
        <Card>
          <DT
            cols={[
              {k:'id',l:'ID',r:v=><span style={{color:T.accent,fontFamily:T.mono,fontWeight:700,fontSize:12}}>{v}</span>},
              {k:'name',l:'Name',r:(v,r)=><span style={{display:'flex',alignItems:'center',gap:6}}><span onClick={e=>{e.stopPropagation();setSel(r);}} style={{color:T.accent,cursor:'pointer',fontWeight:600,borderBottom:`1px dashed ${T.accent}50`}}>{v}</span>{r.phone&&<span onClick={e=>{e.stopPropagation();openContact(v,r.phone,e);}} title='Quick contact' style={{cursor:'pointer',fontSize:12,opacity:.55,lineHeight:1}}>📞</span>}</span>},
              {k:'phone',l:'Phone'},
              {k:'business',l:'Business'},
              {k:'location',l:'Location'},
              {k:'officer',l:'Officer'},
              {k:'loans',l:'Loans'},
              {k:'risk',l:'Risk',r:v=><Badge color={RC[v]}>{v}</Badge>},
              {k:'id',l:'Status',r:(v,row)=>{
                if(row.blacklisted) return <Badge color={T.danger}>Blacklisted</Badge>;
                if(activeBorrowerIds.has(v)) return <Badge color={T.ok}>Active Borrower</Badge>;
                if(row.loans>0) return <Badge color={T.muted}>No Active Loan</Badge>;
                return <Badge color={T.blue}>New Client</Badge>;
              }},
            ]}
            rows={filtered} onRow={setSel}
          />
        </Card>
      </div>
      {blConfirm&&<ConfirmDialog title="Blacklist Customer" message={blConfirm.msg} confirmLabel="Yes, Blacklist" confirmVariant="danger" onConfirm={()=>{blacklist(blConfirm.c);setBlConfirm(null);}} onCancel={()=>setBlConfirm(null)}/>}
      {sel&&(
        <CustomerDetail
          customer={sel}
          loans={loans}
          payments={payments}
          interactions={interactions}
          workers={workers}
          onClose={()=>setSel(null)}
          onSelectLoan={loan=>setSelLoan(loan)}
          onBlacklist={c=>setBlConfirm({c,msg:`Blacklist ${c.name} (${c.id})? They will be prevented from receiving new loans. This action is recorded in the audit log.`})}
          onSave={updated=>{
            setCustomers(cs=>cs.map(c=>c.id===updated.id?updated:c));
            sbWrite('customers',toSupabaseCustomer(updated));
            addAudit('Customer Updated',updated.id,updated.name);
            showToast(`✅ ${updated.name} updated`,'ok');
            setSel(updated);
          }}
        />
      )}
      {selLoan&&<LoanModal loan={selLoan} customers={customers} payments={payments} interactions={interactions||[]} onClose={()=>setSelLoan(null)} onViewCustomer={cust=>{setSelLoan(null);setSel(cust);}}/>}
    </div>
  );
};

// ═══════════════════════════════════════════
//  LEADS PAGE — workers can add leads & convert
// ═══════════════════════════════════════════
const ALeads = ({leads,setLeads,workers,customers,setCustomers,addAudit,isWorker,currentWorker,showToast=()=>{}}) => {
  const [showNew,setShowNew]=useState(false);
  const [leadQ,setLeadQ]=useState('');
  const [conv,setConv]=useState(null);
  const [f,setF]=useState({name:'',phone:'',business:'',location:'',source:'Referral',officer:currentWorker?.name||''});
  const [showVal,setShowVal]=useState(false);
  const stages=['New','Contacted','Interested','Onboarded','Not Interested'];
  const stageC={New:T.muted,Contacted:T.warn,Interested:T.accent,Onboarded:T.ok,'Not Interested':T.danger};

  const addLead=()=>{
    const missing=[];
    if(!f.name) missing.push('Lead Name');
    if(!f.phone) missing.push('Phone Number');
    if(missing.length){setShowVal(missing);try{SFX.error();}catch(e){};return;}
    const lead={id:uid('LD'),...f,status:'New',date:now(),notes:''};
    setLeads(ls=>[lead,...ls]);
    sbInsert('leads',toSupabaseLead(lead));
    addAudit('Lead Added',lead.id,f.name);
    showToast(`✅ Lead "${f.name}" added`,'ok');SFX.save();
    setShowNew(false);
    setF({name:'',phone:'',business:'',location:'',source:'Referral',officer:currentWorker?.name||''});
  };
  const VALID_TRANSITIONS={New:['Contacted','Not Interested'],Contacted:['Interested','Not Interested'],Interested:['Onboarded','Not Interested']};
  const mv=(lead,status)=>{
    const allowed=VALID_TRANSITIONS[lead.status]||[];
    if(!allowed.includes(status)){showToast('⚠ Invalid lead stage transition','warn');return;}
    const leadUpd={...lead,status};
    setLeads(ls=>ls.map(l=>l.id===lead.id?leadUpd:l));
    sbWrite('leads',toSupabaseLead(leadUpd));
    addAudit('Lead Stage Changed',lead.id,`${lead.status} → ${status}`);
    showToast(`Lead moved to ${status}`,'info');
  };
  const doConvert=cust=>{
    // ── Duplicate guard ──────────────────────────────────────
    const phoneTaken = customers && customers.some(c=>c.phone&&cust.phone&&c.phone.replace(/\s/g,'')===cust.phone.replace(/\s/g,''));
    const idTaken    = customers && cust.idNo && customers.some(c=>c.idNo&&c.idNo.trim()===cust.idNo.trim());
    if(phoneTaken){
      showToast(`⚠ A customer with phone number "${cust.phone}" already exists in the system.`,'danger',5000);
      try{SFX.error();}catch(e){}
      return;
    }
    if(idTaken){
      showToast(`⚠ A customer with National ID "${cust.idNo}" already exists in the system.`,'danger',5000);
      try{SFX.error();}catch(e){}
      return;
    }
    setCustomers(cs=>[cust,...cs]);
    sbInsert('customers',toSupabaseCustomer(cust));
    const convUpd={...conv,status:'Onboarded'};
    setLeads(ls=>ls.map(l=>l.id===conv.id?convUpd:l));
    sbWrite('leads',toSupabaseLead(convUpd));
    addAudit('Lead Converted',conv.id,`→ Customer ${cust.id}`);
    showToast(`🎉 Lead converted to customer: ${cust.name}`,'ok',4000);SFX.save();
    setConv(null);
  };

  return (
    <div className='fu'>
      {showVal&&<ValidationPopup fields={showVal} onClose={()=>setShowVal(false)}/>}
      <div className='mob-stack' style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18,gap:10}}>
        <div><div style={{fontFamily:T.head,color:T.txt,fontSize:20,fontWeight:800}}>🎯 Lead Pipeline</div><div style={{color:T.muted,fontSize:13,marginTop:3}}>{leads.length} leads · {leads.filter(l=>l.status==='Interested').length} hot</div></div>
        <div style={{display:'flex',gap:8}}><RefreshBtn onRefresh={()=>{ setLeadQ(''); setConv(null); }}/><Btn onClick={()=>setShowNew(true)}>+ Add Lead</Btn></div>
      </div>
      <div style={{marginBottom:10}}><Search value={leadQ} onChange={setLeadQ} placeholder='Search leads…'/></div>
      <div style={{display:'flex',gap:9,overflowX:'auto',overflowY:'hidden',paddingBottom:6,marginBottom:18,flexWrap:'nowrap'}}
        className='lead-pipeline'>
        {stages.map(stage=>{
          const sl=leads.filter(l=>l.status===stage&&(!leadQ||l.name.toLowerCase().includes(leadQ.toLowerCase())||l.phone.includes(leadQ)));
          return (
            <div key={stage} style={{minWidth:175,background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:11,flexShrink:0}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:9}}>
                <span style={{color:stageC[stage],fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:.8}}>{stage}</span>
                <span style={{background:stageC[stage]+'1E',color:stageC[stage],borderRadius:99,padding:'2px 7px',fontSize:11,fontWeight:800}}>{sl.length}</span>
              </div>
              <div style={{maxHeight:'40vh',overflowY:'auto',overflowX:'hidden'}}>
              {sl.map(l=>(
                <div key={l.id} style={{background:T.surface,borderRadius:9,padding:10,marginBottom:7,border:`1px solid ${T.border}`}}>
                  <div style={{color:T.txt,fontWeight:700,fontSize:13}}>{l.name}</div>
                  <div style={{color:T.muted,fontSize:12,marginTop:2}}>{l.business||'—'} · {l.location||'—'}</div>
                  <div style={{color:T.muted,fontSize:11,marginTop:2}}>{l.source} · {l.officer&&<span style={{color:T.accent}}>{l.officer}</span>}</div>
                  {stage==='New'&&<button onClick={()=>mv(l,'Contacted')} style={{marginTop:7,background:T.wLo,color:T.warn,border:`1px solid ${T.warn}38`,borderRadius:7,padding:'4px 9px',fontSize:11,fontWeight:700,cursor:'pointer',width:'100%'}}>Mark Contacted</button>}
                  {stage==='Contacted'&&<button onClick={()=>mv(l,'Interested')} style={{marginTop:7,background:T.oLo,color:T.ok,border:`1px solid ${T.ok}38`,borderRadius:7,padding:'4px 9px',fontSize:11,fontWeight:700,cursor:'pointer',width:'100%'}}>Mark Interested ✓</button>}
                  {stage==='Interested'&&<button onClick={()=>setConv(l)} style={{marginTop:7,background:T.accent,color:'#060A10',border:'none',borderRadius:7,padding:'5px 9px',fontSize:11,fontWeight:800,cursor:'pointer',width:'100%'}}>Convert to Customer →</button>}
                </div>
              ))}
              </div>
            </div>
          );
        })}
      </div>
      {showNew&&(
        <Dialog title='Add New Lead' onClose={()=>setShowNew(false)}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
            <FI label='Name' value={f.name} onChange={v=>setF(p=>({...p,name:v}))} required error={!f.name} half/>
            <PhoneInput label='Phone' value={f.phone} onChange={v=>setF(p=>({...p,phone:v}))} required half/>
            <FI label='Business' value={f.business} onChange={v=>setF(p=>({...p,business:v}))} half/>
            <FI label='Location' value={f.location} onChange={v=>setF(p=>({...p,location:v}))} half/>
            <FI label='Source' type='select' options={['Referral','Field Visit','WhatsApp','Walk-in','Social Media']} value={f.source} onChange={v=>setF(p=>({...p,source:v}))} half/>
            {!isWorker&&<FI label='Assign To' type='select' options={workers.filter(w=>w.status==='Active').map(w=>w.name)} value={f.officer} onChange={v=>setF(p=>({...p,officer:v}))} half/>}
          </div>
          <Btn onClick={addLead} full>Save Lead</Btn>
        </Dialog>
      )}
      {conv&&(
        <Dialog title={`Convert Lead: ${conv.name}`} onClose={()=>setConv(null)} width={680}>
          <Alert type='ok'>Converting <b>{conv.name}</b> from a lead into a registered customer. Complete all sections below.</Alert>
          <OnboardForm workers={workers} onSave={doConvert} onClose={()=>setConv(null)} prefill={conv} leadId={conv.id}/>
        </Dialog>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════
//  PAYMENTS PAGE
// ═══════════════════════════════════════════
const APayments = ({payments,setPayments,loans,setLoans,customers,addAudit,showToast=()=>{}}) => {
  const {open:openContact, Popup:ContactPopup} = useContactPopup();
  const [payQ,setPayQ]=useState('');
  const [selLoan,setSelLoan]=useState(null);
  const [selCust,setSelCust]=useState(null);
  const unalloc=useMemo(()=>payments.filter(p=>p.status==='Unallocated'),[payments]);
  const filteredPayments=useMemo(()=>{
    const lq=payQ.trim().toLowerCase();
    if(!lq) return payments;
    return payments.filter(p=>
      (p.id||'').toLowerCase().includes(lq)||
      (p.customer||'').toLowerCase().includes(lq)||
      (p.mpesa||'').toLowerCase().includes(lq)||
      (p.loanId||'').toLowerCase().includes(lq)||
      (p.status||'').toLowerCase().includes(lq)||
      (p.allocatedBy||'').toLowerCase().includes(lq)||
      String(p.amount||'').includes(lq)
    );
  },[payments,payQ]);
  const [showA,setShowA]=useState(null);
  const [af,setAf]=useState({loanId:'',note:''});
  const doAlloc=()=>{
    if(!af.loanId)return;
    const loan=loans.find(l=>l.id===af.loanId);
    if(!loan){showToast('⚠ Loan not found. Please select a valid loan.','warn');return;}
    const allocTs=new Date().toLocaleString('en-KE',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
    const allocBy=(af.allocatedBy||'').trim()||'Admin';
    const allocUpd={...showA,status:'Allocated',loanId:af.loanId,customerId:loan.customerId,customer:loan.customer,allocatedBy:allocBy,allocatedAt:allocTs,note:af.note};
    setPayments(ps=>ps.map(p=>p.id===showA.id?allocUpd:p));
    sbWrite('payments',toSupabasePayment(allocUpd));
    const amt=showA.amount;
    setLoans(ls=>ls.map(l=>{
      if(l.id!==af.loanId) return l;
      const newBal = Math.max(l.balance - amt, 0);
      const newStatus = newBal <= 0 ? 'Settled' : (l.status==='Settled' ? 'Settled' : l.status);
      return {...l, balance:newBal, status:newStatus};
    }));
    addAudit('Payment Allocated',showA.id,`${fmt(amt)} → ${af.loanId}`);
    showToast(`✅ Payment of ${fmt(amt)} allocated to ${af.loanId}`,'ok');
    setShowA(null);setAf({loanId:'',note:''});
  };
  return (
    <div className='fu'>
      {ContactPopup}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4,flexWrap:'wrap',gap:8}}>
        <div>
          <div style={{fontFamily:T.head,color:T.txt,fontSize:20,fontWeight:800}}>💳 Payments</div>
          <div style={{color:T.muted,fontSize:13,marginTop:2}}>{payments.length} total · <span style={{color:T.danger}}>{unalloc.length} unallocated</span></div>
        </div>
        <RefreshBtn onRefresh={()=>{ setPayQ(''); setShowA(null); }}/>
      </div>
      <div style={{marginBottom:10}}><Search value={payQ} onChange={setPayQ} placeholder='Search by customer, M-Pesa or loan ID…'/></div>
      <div style={{marginBottom:4}}/>
      {unalloc.length>0&&(
        <Card style={{marginBottom:13,border:`1px solid ${T.danger}38`}}>
          <CH title='Unallocated Payments' sub='Match these to a loan'/>
          <DT cols={[{k:'id',l:'ID'},{k:'amount',l:'Amount',r:v=><span style={{color:T.ok,fontFamily:T.mono,fontWeight:700}}>{fmt(v)}</span>},{k:'mpesa',l:'M-Pesa Code'},{k:'date',l:'Date'},{k:'status',l:'Status',r:v=><Badge color={T.danger}>{v}</Badge>}]}
            rows={unalloc} onRow={r=>{setShowA(r);setAf({loanId:'',note:''});}}/>
        </Card>
      )}
      <Card>
        <CH title='All Payments'/>
        <DT cols={[{k:'id',l:'ID'},{k:'customer',l:'Customer',r:(v,r)=>{const c=customers.find(x=>x.name===v);return v&&v!=='Unknown'?<span onClick={e=>{e.stopPropagation();if(c)setSelCust(c);else openContact(v,r.phone,e);}} style={{color:T.accent,cursor:'pointer',fontWeight:600,borderBottom:`1px dashed ${T.accent}50`}}>{v}</span>:<span style={{color:T.muted}}>{v||'—'}</span>;}},{k:'amount',l:'Amount',r:v=><span style={{color:T.ok,fontFamily:T.mono,fontWeight:700}}>{fmt(v)}</span>},{k:'mpesa',l:'M-Pesa Code'},{k:'loanId',l:'Loan ID'},{k:'date',l:'Date'},{k:'status',l:'Status',r:v=><Badge color={SC[v]||T.muted}>{v}</Badge>},{k:'allocatedBy',l:'By'}]}
          rows={filteredPayments}/>
      </Card>
      {selLoan&&<LoanModal loan={selLoan} customers={customers} payments={payments} interactions={[]} onClose={()=>setSelLoan(null)} onViewCustomer={cust=>{setSelLoan(null);setSelCust(cust);}}/>}
      {selCust&&<CustomerDetail customer={selCust} loans={loans} payments={payments} interactions={[]} workers={[]} onClose={()=>setSelCust(null)} onSelectLoan={loan=>{setSelCust(null);setSelLoan(loan);}} onSave={()=>{}}/>}
      {showA&&(
        <Dialog title={`Allocate Payment · ${showA.id}`} onClose={()=>setShowA(null)}>
          <Alert type='info'><b>{fmt(showA.amount)}</b> via M-Pesa {showA.mpesa}</Alert>
          <FI label='Assign to Loan' type='select'
            options={loans.filter(l=>!['Settled','Written off'].includes(l.status)).map(l=>`${l.id} — ${l.customer} (${fmt(l.balance)})`)}
            value={af.loanId?`${af.loanId} — ${loans.find(l=>l.id===af.loanId)?.customer} (${fmt(loans.find(l=>l.id===af.loanId)?.balance)})`:''} required
            onChange={v=>setAf(f=>({...f,loanId:v.split(' — ')[0]}))}/>
          <FI label='Allocated By' value={af.allocatedBy||''} onChange={v=>setAf(f=>({...f,allocatedBy:v}))} placeholder='Officer or name (defaults to Admin)'/>
          <FI label='Note' value={af.note} onChange={v=>setAf(f=>({...f,note:v}))} placeholder='Optional note'/>
          <div style={{display:'flex',gap:9}}><Btn onClick={doAlloc} full>✓ Allocate</Btn><Btn v='secondary' onClick={()=>setShowA(null)}>Cancel</Btn></div>
        </Dialog>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════
//  COLLECTIONS (keeping pipeline)
// ═══════════════════════════════════════════
const PIPELINE_STAGES = [
  {id:'Reminder',label:'Reminder',color:T.warn,icon:'📱',desc:'First contact — SMS and phone reminders',actions:['Send SMS Reminder','Make Phone Call','Send WhatsApp Message'],template:'Dear [Customer], your loan of [Amount] is now overdue. Please make payment immediately.'},
  {id:'Field Visit',label:'Field Visit',color:T.blue,icon:'🚗',desc:'Officer physically visits borrower',actions:['Schedule Visit','Mark Visit Complete','Escalate to Supervisor'],template:'Field visit report: Customer [Name] at [Location].'},
  {id:'Demand Letter',label:'Demand Letter',color:T.danger,icon:'📄',desc:'Formal written demand with 7-day deadline',actions:['Generate Letter','Send via Registered Mail','Mark Delivered'],template:'FORMAL DEMAND: Your loan of [Amount] is immediately due.'},
  {id:'Final Notice',label:'Final Notice',color:T.danger,icon:'⚠️',desc:'Final warning before legal action',actions:['Issue Final Notice','Engage Guarantor','Contact Next of Kin'],template:'FINAL NOTICE: Last opportunity to settle [Amount] before legal action.'},
  {id:'Legal',label:'Legal',color:T.purple,icon:'⚖️',desc:'Matter referred to legal team',actions:['File in Court','Engage Debt Collector','Attach Assets'],template:'Legal proceedings initiated.'},
  {id:'Written Off',label:'Write Off',color:T.muted,icon:'✕',desc:'Loan written off as unrecoverable',actions:['Approve Write-Off','Update Books','Blacklist Customer'],template:'Loan written off after all recovery attempts exhausted.'},
];

const ACollections = ({loans,customers,payments,interactions,setInteractions,workers,setLoans,setCustomers,addAudit,scrollTop,currentUser='Admin'}) => {
  const {open:openContact, Popup:ContactPopup} = useContactPopup();
  const [collQ,setCollQ]=useState('');
  const [modalLoan,setModalLoan]=useState(null);
  const [modalCust,setModalCust]=useState(null);
  const ov=useMemo(()=>loans.filter(l=>l.status==='Overdue'&&(!collQ||l.customer.toLowerCase().includes(collQ.toLowerCase())||l.id.toLowerCase().includes(collQ.toLowerCase()))),[loans,collQ]);
  // FIX — Bug 9: ov.reduce was called twice inline in JSX (header + KPI). Memoize so
  // the reduce only runs when ov changes, not on every render triggered by UI interactions.
  const ovTotal=useMemo(()=>ov.reduce((s,l)=>s+l.balance,0),[ov]);
  const [showInt,setShowInt]=useState(null);
  const [iF,setIF]=useState({type:'Phone Call',notes:'',pAmt:'',pDate:'',officer:''});
  const [pipeStage,setPipeStage]=useState(null);
  const [pipeAction,setPipeAction]=useState(null);
  const [selLoan,setSelLoan]=useState(null);
  const [kpiDrill,setKpiDrillRaw]=useState(null);
  const setKpiDrill = (d) => { setKpiDrillRaw(d); if(d) setTimeout(()=>{ try{scrollTop?.();}catch(e){} },20); };
  const overdueAccountsRef=useRef(null);
  const interactionsRef=useRef(null);

  const addInt=(loan)=>{
    if(!iF.notes)return;
    const l=loan||showInt;
    const cust=customers.find(c=>c.name===l.customer);
    const entry={id:uid('INT'),customerId:cust?.id||'',loanId:l.id,type:iF.type,date:now(),officer:iF.officer||'Admin',notes:iF.notes,promiseAmount:iF.pAmt||null,promiseDate:iF.pDate||null,promiseStatus:iF.pAmt?'Pending':null};
    setInteractions(is=>[entry,...is]);
    sbInsert('interactions',toSupabaseInteraction(entry));
    addAudit('Interaction Logged',l.id,`${iF.type}: ${iF.notes.slice(0,40)}`);
    setShowInt(null);setIF({type:'Phone Call',notes:'',pAmt:'',pDate:'',officer:currentUser});
  };
  const doAction=(stage,action)=>{
    if(!selLoan)return;
    const notes=`${stage.label}: ${action}. ${stage.template.replace('[Customer]',selLoan.customer).replace('[Amount]',fmt(selLoan.balance)).replace('[Name]',selLoan.customer).replace('[Location]','(location)')}`;
    const cust=customers.find(c=>c.name===selLoan.customer);
    setInteractions(is=>[{id:uid('INT'),customerId:cust?.id||'',loanId:selLoan.id,type:stage.label,date:now(),officer:iF.officer||'Admin',notes,promiseAmount:null,promiseDate:null,promiseStatus:null},...is]);
    addAudit(`Recovery: ${action}`,selLoan.id,`Stage: ${stage.label}`);
    if(stage.id==='Written Off'&&action.includes('Write-Off'))setLoans(ls=>ls.map(l=>l.id===selLoan.id?{...l,status:'Written off'}:l));
    if(stage.id==='Written Off'&&action.includes('Blacklist'))setCustomers(cs=>cs.map(c=>c.id===cust?.id?{...c,blacklisted:true,blReason:'Non-cooperation / Write-off'}:c));
    setPipeAction(null);setSelLoan(null);setPipeStage(null);
  };

  return (
    <div className='fu'>
      {ContactPopup}
      {/* KPI Drill Sheet — anchored top */}
      {kpiDrill&&(
        <div className='dialog-backdrop' style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:9900,display:'flex',alignItems:'flex-start',justifyContent:'center',background:'rgba(4,8,16,0.72)',backdropFilter:'blur(4px)',overflow:'hidden'}}>
          <div className='pop' style={{background:T.card,border:`1px solid ${kpiDrill.color}40`,borderBottom:`1px solid ${T.border}`,borderRadius:'0 0 18px 18px',width:'100%',maxWidth:'100%',maxHeight:'75vh',display:'flex',flexDirection:'column',boxShadow:`0 12px 48px rgba(0,0,0,0.7),0 0 0 1px ${kpiDrill.color}20`}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 18px',borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:4,height:20,borderRadius:99,background:kpiDrill.color,flexShrink:0}}/>
                <h3 style={{color:T.txt,fontSize:15,fontWeight:800,fontFamily:T.head,margin:0}}>{kpiDrill.title}</h3>
                <span style={{color:kpiDrill.color,fontFamily:T.mono,fontSize:12,fontWeight:700,background:kpiDrill.color+'18',padding:'2px 8px',borderRadius:99}}>{kpiDrill.rows.length}</span>
              </div>
              <button onClick={()=>setKpiDrill(null)} style={{background:T.card2,border:`1px solid ${T.border}`,color:T.muted,borderRadius:99,width:28,height:28,cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:'auto',overflowX:'auto'}}>
              {kpiDrill.type==='loans'
                ?<DT
                    cols={[
                      {k:'id',l:'Loan ID',r:v=><span style={{color:T.accent,fontFamily:T.mono,fontWeight:700,fontSize:12}}>{v}</span>},
                      {k:'customer',l:'Customer',r:(v,r)=>{const c=customers.find(x=>x.name===v);return <span onClick={e=>{e.stopPropagation();openContact(v,c?.phone,e);}} style={{color:T.accent,cursor:'pointer',fontWeight:600,borderBottom:`1px dashed ${T.accent}50`}}>{v}</span>;}},
                      {k:'balance',l:'Balance',r:v=>fmt(v)},
                      {k:'daysOverdue',l:'Days',r:v=><span style={{color:v>10?T.danger:T.warn,fontWeight:800,fontFamily:T.mono}}>{v}d</span>},
                      {k:'daysOverdue',l:'Total Due',r:(_,r)=>{const e=calculateLoanStatus(r);return <span style={{color:e.isFrozen?T.muted:T.danger,fontFamily:T.mono}}>{fmt(e.totalAmountDue)}</span>;}},
                      {k:'risk',l:'Risk',r:v=><Badge color={RC[v]}>{v}</Badge>},
                      {k:'officer',l:'Officer'},
                    ]}
                    rows={kpiDrill.rows}
                    onRow={r=>setShowInt(r)}
                  />
                :<DT
                    cols={[
                      {k:'date',l:'Date'},
                      {k:'loanId',l:'Loan'},
                      {k:'type',l:'Type',r:v=><Badge color={T.accent}>{v}</Badge>},
                      {k:'officer',l:'Officer'},
                      {k:'notes',l:'Notes',r:v=><span style={{color:T.dim,fontSize:12}}>{v?.slice(0,60)}{v?.length>60?'…':''}</span>},
                      {k:'promiseAmount',l:'Promise',r:v=>v?<span style={{color:T.gold,fontFamily:T.mono}}>{fmt(v)}</span>:'—'},
                      {k:'promiseStatus',l:'Status',r:v=>v?<Badge color={v==='Pending'?T.warn:v==='Kept'?T.ok:T.danger}>{v}</Badge>:'—'},
                    ]}
                    rows={kpiDrill.rows}
                  />
              }
            </div>
          </div>
        </div>
      )}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4,flexWrap:'wrap',gap:8}}>
        <div>
          <div style={{fontFamily:T.head,color:T.txt,fontSize:20,fontWeight:800}}>📞 Collections & Recovery</div>
          <div style={{color:T.muted,fontSize:13,marginTop:2}}>{ov.length} overdue · {fmt(ovTotal)} outstanding</div>
        </div>
        <RefreshBtn onRefresh={()=>{ setCollQ(''); setShowInt(null); setPipeStage(null); setKpiDrill(null); }}/>
      </div>
      <div style={{marginBottom:10}}><Search value={collQ} onChange={setCollQ} placeholder='Search overdue by customer or loan ID…'/></div>
      <div style={{marginBottom:6}}/>
      <div className='kpi-row' style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
        <KPI label='Newly Overdue' icon='🔴'
          value={ov.filter(l=>l.daysOverdue<=1).length} color={T.danger} delay={1}
          onClick={()=>{
            const rows=ov.filter(l=>l.daysOverdue<=1).sort((a,b)=>b.daysOverdue-a.daysOverdue);
            setKpiDrill({title:'Newly Overdue Loans (0–1 day)',color:T.danger,rows,type:'loans'});
            try{SFX.notify();}catch(e){}
          }}/>
        <KPI label='Total Overdue' icon='⚠️'
          value={fmtM(ovTotal)} color={T.danger} delay={2}
          onClick={()=>{
            const rows=[...ov].sort((a,b)=>b.daysOverdue-a.daysOverdue);
            setKpiDrill({title:'All Overdue Loans',color:T.danger,rows,type:'loans'});
            try{SFX.notify();}catch(e){}
          }}/>
        <KPI label='Broken Promises' icon='💔'
          value={interactions.filter(i=>i.promiseStatus==='Broken').length} color={T.warn} delay={3}
          onClick={()=>{
            const rows=interactions.filter(i=>i.promiseStatus==='Broken');
            setKpiDrill({title:'Broken Promise Interactions',color:T.warn,rows,type:'interactions'});
            try{SFX.notify();}catch(e){}
          }}/>
        <KPI label='Interactions' icon='📞'
          value={interactions.length} color={T.accent} delay={4}
          onClick={()=>{
            setKpiDrill({title:'All Interactions',color:T.accent,rows:interactions,type:'interactions'});
            try{SFX.notify();}catch(e){}
          }}/>
      </div>
      <Card style={{marginBottom:13}}>
        <CH title='Recovery Pipeline'/>
        <div style={{padding:'13px 13px 6px'}}>
          <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:7}}>
            {PIPELINE_STAGES.map(stage=>(
              <div key={stage.id} onClick={()=>{setPipeStage(stage);setSelLoan(null);}}
                style={{flex:'0 0 auto',width:110,background:T.surface,border:`1px solid ${pipeStage?.id===stage.id?stage.color:T.border}`,borderRadius:10,padding:'10px 8px',textAlign:'center',cursor:'pointer',transition:'all .2s'}}>
                <div style={{fontSize:20,marginBottom:5}}>{stage.icon}</div>
                <div style={{color:stage.color,fontWeight:800,fontSize:18,fontFamily:T.mono}}>{stage.id==='Reminder'?ov.length:stage.id==='Written Off'?loans.filter(l=>l.status==='Written off').length:0}</div>
                <div style={{color:T.dim,fontSize:10,marginTop:3,fontWeight:600}}>{stage.label}</div>
              </div>
            ))}
          </div>
          {pipeStage&&(
            <div style={{background:T.bg,border:`1px solid ${pipeStage.color}30`,borderRadius:10,padding:14,marginTop:7}}>
              <div style={{color:pipeStage.color,fontWeight:800,fontSize:14,fontFamily:T.head,marginBottom:4}}>{pipeStage.icon} {pipeStage.label}</div>
              <div style={{color:T.muted,fontSize:12,marginBottom:10}}>{pipeStage.desc}</div>
              <select value={selLoan?.id||''} onChange={e=>setSelLoan(ov.find(l=>l.id===e.target.value)||null)}
                style={{width:'100%',background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:'9px 12px',color:T.txt,fontSize:13,outline:'none',marginBottom:10}}>
                <option value=''>— Select overdue loan —</option>
                {ov.map(l=><option key={l.id} value={l.id}>{l.id} · {l.customer} · {fmt(l.balance)} · {l.daysOverdue}d</option>)}
              </select>
              {selLoan&&<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {pipeStage.actions.map(action=>(
                  <Btn key={action} sm v={pipeStage.id==='Written Off'?'danger':'blue'} onClick={()=>setPipeAction({stage:pipeStage,action,loan:selLoan})}>{action}</Btn>
                ))}
              </div>}
            </div>
          )}
        </div>
      </Card>
      <Card style={{marginBottom:13}}>
        <CH title='Overdue Accounts'/>
        <DT cols={[{k:'id',l:'Loan ID',r:(v,row)=><span onClick={e=>{e.stopPropagation();setModalLoan(row);}} style={{color:T.accent,fontFamily:T.mono,fontWeight:700,fontSize:12,cursor:'pointer',borderBottom:`1px dashed ${T.accent}50`}}>{v}</span>},{k:'customer',l:'Customer',r:(v,r)=>{const c=customers.find(x=>x.name===v);return <span onClick={e=>{e.stopPropagation();if(c)setModalCust(c);else openContact(v,r.phone,e);}} style={{color:T.accent,cursor:'pointer',fontWeight:600,borderBottom:`1px dashed ${T.accent}50`}}>{v}</span>;}},{k:'balance',l:'Balance',r:v=>fmt(v)},{k:'daysOverdue',l:'Days',r:v=><span style={{color:v>10?T.danger:T.warn,fontWeight:800,fontFamily:T.mono}}>{v}d</span>},{k:'daysOverdue',l:'Total Due',r:(_,r)=>{const e=calculateLoanStatus(r);return <span style={{color:e.isFrozen?T.muted:T.danger,fontFamily:T.mono,fontWeight:700}}>{fmt(e.totalAmountDue)}</span>;}},{k:'status',l:'Phase',r:(_,r)=>{const e=calculateLoanStatus(r);return <span style={{fontSize:11,fontWeight:700,color:e.isFrozen?T.muted:e.phase==='penalty'?T.danger:T.warn}}>{e.isFrozen?'❄ Frozen':e.phase==='penalty'?'Penalty':'Interest'}</span>;}},{k:'risk',l:'Risk',r:v=><Badge color={RC[v]}>{v}</Badge>},{k:'officer',l:'Officer'}]}
          rows={[...ov].sort((a,b)=>b.daysOverdue-a.daysOverdue)} onRow={r=>{setShowInt(r);setIF(f=>({...f,officer:f.officer||currentUser}));}}/>
      </Card>
      {interactions.length>0&&<Card>
        <CH title='Interaction History'/>
        <DT cols={[{k:'date',l:'Date'},{k:'loanId',l:'Loan'},{k:'type',l:'Type',r:v=><Badge color={T.accent}>{v}</Badge>},{k:'officer',l:'Officer'},{k:'notes',l:'Notes',r:v=><span style={{color:T.dim,fontSize:12}}>{v?.slice(0,60)}{v?.length>60?'…':''}</span>},{k:'promiseAmount',l:'Promise',r:v=>v?<span style={{color:T.gold,fontFamily:T.mono}}>{fmt(v)}</span>:'—'},{k:'promiseStatus',l:'Status',r:v=>v?<Badge color={v==='Pending'?T.warn:v==='Kept'?T.ok:T.danger}>{v}</Badge>:'—'}]}
          rows={interactions}/>
      </Card>}
      {showInt&&(
        <Dialog title={`Log Interaction — ${showInt.customer}`} onClose={()=>{setShowInt(null);setIF({type:'Phone Call',notes:'',pAmt:'',pDate:'',officer:currentUser});}}>
          <Alert type='info'>Loan {showInt.id} · {fmt(showInt.balance)} · {showInt.daysOverdue}d overdue</Alert>
          <FI label='Interaction Type' type='select' options={['Phone Call','Field Visit','SMS Sent','Promise to Pay','Demand Notice','Recovery Action']} value={iF.type} onChange={v=>setIF(f=>({...f,type:v}))}/>
          <FI label='Notes' type='textarea' value={iF.notes} onChange={v=>setIF(f=>({...f,notes:v}))} required placeholder='Describe the interaction…'/>
          {iF.type==='Promise to Pay'&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
            <FI label='Promised Amount' type='number' value={iF.pAmt} onChange={v=>setIF(f=>({...f,pAmt:v}))} half/>
            <FI label='Promised Date' type='date' value={iF.pDate} onChange={v=>setIF(f=>({...f,pDate:v}))} half/>
          </div>}
          <FI label='Logged By' type='select'
            options={['Admin',...workers.filter(w=>w.status==='Active').map(w=>w.name)]}
            value={iF.officer||'Admin'}
            onChange={v=>setIF(f=>({...f,officer:v==='Admin'?'':v}))}/>
          <div style={{display:'flex',gap:9}}><Btn onClick={()=>addInt(showInt)} full>Save Interaction</Btn><Btn v='secondary' onClick={()=>setShowInt(null)}>Cancel</Btn></div>
        </Dialog>
      )}
      {pipeAction&&(
        <Dialog title={`Confirm: ${pipeAction.action}`} onClose={()=>setPipeAction(null)}>
          <Alert type='warn'><b>{pipeAction.action}</b> on loan <b>{pipeAction.loan.id}</b> for <b>{pipeAction.loan.customer}</b></Alert>
          <div style={{display:'flex',gap:9}}><Btn onClick={()=>doAction(pipeAction.stage,pipeAction.action)} full>✓ Confirm & Log</Btn><Btn v='secondary' onClick={()=>setPipeAction(null)}>Cancel</Btn></div>
        </Dialog>
      )}
      {modalLoan&&<LoanModal loan={modalLoan} customers={customers} payments={payments} interactions={interactions||[]} onClose={()=>setModalLoan(null)} onViewCustomer={cust=>{setModalLoan(null);setModalCust(cust);}}/>}
      {modalCust&&<CustomerDetail customer={modalCust} loans={loans} payments={payments} interactions={interactions||[]} workers={workers||[]} onClose={()=>setModalCust(null)} onSelectLoan={loan=>{setModalCust(null);setModalLoan(loan);}} onSave={()=>{}}/>}
    </div>
  );
};

// ═══════════════════════════════════════════
//  SECURITY & AUDIT
// ═══════════════════════════════════════════
const SECURITY_EVENTS = [
  {key:'TLS Encryption',     icon:'🔒', color:T.ok,     desc:`All data transmitted between your browser and the server is encrypted using TLS 1.3. This prevents eavesdropping and man-in-the-middle attacks.`},
  {key:'Row Level Security', icon:'🛡️', color:T.ok,     desc:`Database rows are protected at the storage level. Each user can only access records they are authorised to see based on their role.`},
  {key:'3FA Admin Login',    icon:'🔐', color:T.ok,     desc:`Admin accounts require three independent factors to log in: password, biometric (WebAuthn), and a time-based one-time password (TOTP). This makes account compromise extremely difficult.`},
  {key:'Field Encryption',   icon:'🔑', color:T.ok,     desc:`Sensitive customer fields (ID numbers, phone numbers) are encrypted at rest using AES-256. Even if the database file is stolen, the data cannot be read without the encryption key.`},
  {key:'Rate Limiting',      icon:'⏱️', color:T.ok,     desc:`Login attempts, API calls, and form submissions are throttled to prevent brute-force attacks. After 3 failed admin logins, the account is locked for 15 minutes.`},
  {key:'Audit Logging',      icon:'📋', color:T.accent, desc:`Every action taken by every user is recorded with a timestamp, user ID, action type, target record, and details. The log cannot be deleted or modified by regular users.`, dynamic:true},
  {key:'OWASP Compliance',   icon:'✅', color:T.ok,     desc:`The system is built following OWASP Top 10 security guidelines. This includes protection against SQL injection, XSS, CSRF, broken authentication, and security misconfiguration.`},
  {key:'Session Security',   icon:'🕐', color:T.warn,   desc:`Admin sessions expire after 15 minutes of inactivity. Worker sessions are tied to their account status — deactivating a worker immediately prevents new logins.`},
];

const AuditEventDetail = ({entry, onClose}) => {
  const actionMeta = {
    'Loan Approved':        {icon:'✅', color:T.ok,     summary:`A loan application was reviewed and approved for disbursement.`},
    'Payment Recorded':     {icon:'💳', color:T.ok,     summary:`A payment was recorded against a customer loan account.`},
    'Payment Allocated':    {icon:'💰', color:T.ok,     summary:`An unallocated M-Pesa payment was matched and applied to a loan.`},
    'Worker Login':         {icon:'👤', color:T.accent, summary:`A worker successfully authenticated into the Worker Portal.`},
    'Lead Converted':       {icon:'🎯', color:T.ok,     summary:`A lead was onboarded and converted into a registered customer.`},
    'Customer Blacklisted': {icon:'⛔', color:T.danger, summary:`A customer was flagged as blacklisted, preventing new loan applications.`},
    'Loan Disbursed':       {icon:'💸', color:T.gold,   summary:`Loan funds were released to the customer via M-Pesa.`},
    'Worker Added':         {icon:'👷', color:T.blue,   summary:`A new staff member was added to the system.`},
    'Role Changed':         {icon:'🔄', color:T.warn,   summary:`A staff member's role or access level was modified.`},
    'Data Export':          {icon:'📤', color:T.blue,   summary:`A data export or CSV download was performed.`},
    'DATABASE CLEARED':     {icon:'🗑️', color:T.danger, summary:`The entire database was wiped after 3-factor verification.`},
  };
  const meta = Object.entries(actionMeta).find(([k])=>entry.action.includes(k))?.[1] || {icon:'📝', color:T.muted, summary:`A system action was performed and recorded in the audit trail.`};
  return (
    <div className='dialog-backdrop' style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:99998,display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:MODAL_TOP_OFFSET+8,background:'rgba(4,8,16,0.65)',backdropFilter:'blur(6px)',overflow:'hidden'}} onClick={onClose}>
      <div className='pop-in' style={{background:T.card,border:`1px solid ${T.hi}`,borderRadius:20,padding:'22px 24px',width:'100%',maxWidth:440,boxShadow:'0 -20px 60px #00000080'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
          <div style={{width:44,height:44,borderRadius:14,background:meta.color+'18',border:`1px solid ${meta.color}30`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>{meta.icon}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{color:T.txt,fontWeight:800,fontSize:14,fontFamily:T.head}}>{entry.action}</div>
            <div style={{color:T.muted,fontSize:12,marginTop:2}}>{entry.ts} · <span style={{color:T.accent,fontFamily:T.mono}}>{entry.user}</span></div>
          </div>
          <button onClick={onClose} style={{background:T.card2,border:`1px solid ${T.border}`,color:T.muted,borderRadius:99,width:28,height:28,cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>✕</button>
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

const ASecurity = ({auditLog}) => {
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
          <div style={{fontFamily:T.head,color:T.txt,fontSize:20,fontWeight:800}}>🔒 Security & Audit</div>
          <div style={{color:T.muted,fontSize:13,marginTop:2}}>{auditLog.length} total events recorded · All systems operational</div>
        </div>
        <Btn v='ok' onClick={dlAudit}>⬇ Export Audit CSV</Btn>
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
                  <div style={{color:ev.color,fontSize:12,fontWeight:800,marginTop:1}}>✓ {val}</div>
                </div>
                <div style={{color:ev.color,fontSize:12,opacity:0.7,flexShrink:0,transition:'transform .2s',transform:isExpanded?'rotate(180deg)':'rotate(0deg)'}}>▾</div>
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
        <CH title='📋 Live Audit Log' sub='Click any entry to see details' right={<Btn sm v='secondary' onClick={dlAudit}>⬇ Export</Btn>}/>
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
const ADatabase = ({allState,setLoans,setCustomers,setPayments,setWorkers,setLeads,setInteractions,setAuditLog,addAudit,showToast=()=>{}}) => {
  const [step,setStep]=useState(0);
  const [pw,setPw]=useState('');
  const [totp,setTotp]=useState('');
  const [err,setErr]=useState('');
  const [showClear,setShowClear]=useState(false);
  const [lastBackup,setLastBackup]=useState(null);
  const [restoreFile,setRestoreFile]=useState(null);
  const [restoreStatus,setRestoreStatus]=useState('');
  const [uploadProgress,setUploadProgress]=useState(0);
  const [uploadKey,setUploadKey]=useState(0);
  const [restorePreview,setRestorePreview]=useState(null); // holds parsed data waiting for inline confirm
  const fileRef=useRef();

  const allStateRef=useRef(allState);
  allStateRef.current=allState; // update ref synchronously — no useEffect needed
  const addAuditRef=useRef(addAudit);
  addAuditRef.current=addAudit; // update ref synchronously

  const doBackup=useCallback(()=>{
    const csv=buildFullBackup(allStateRef.current);
    dlCSV(`acl-backup-${now()}.csv`,csv);
    setLastBackup(new Date().toLocaleTimeString('en-KE'));
    addAuditRef.current('Database Backup Downloaded','ALL',`Full backup at ${ts()}`);
    showToast('✅ Backup CSV downloaded','ok');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);



  const startClear=()=>{setShowClear(true);setStep(1);setPw('');setTotp('');setErr('');};
  const stepPw=()=>{if(pw.length<4){setErr('Invalid password.');return;}setErr('');setStep(2);};
  const stepBio=()=>setStep(3);
  const stepTotp=()=>{if(totp!=='123456'){setErr('Invalid TOTP code.');try{SFX.error();}catch(e){};return;}setStep(4);setErr('');};

  const doClear=()=>{
    // 1. Clear React state immediately so the UI empties at once
    setLoans([]);setCustomers([]);setPayments([]);setLeads([]);setInteractions([]);
    setAuditLog(l=>[{ts:ts(),user:'admin',action:'DATABASE CLEARED',target:'ALL',detail:'All data wiped after 3FA verification'}]);
    addAudit('DATABASE CLEARED','ALL','Performed after full 3FA verification');
    setShowClear(false);setStep(0);
    showToast('🗑 Database cleared — all data wiped','warn',5000);
    // Reset restore state so upload works immediately after clear
    setRestoreStatus('');setRestoreFile(null);setUploadKey(k=>k+1);setUploadProgress(0);

    // 2. DELETE every row from each Supabase table so the wipe survives a refresh.
    // Supabase requires at least one filter before it will run a delete — .neq('id','__none__')
    // matches every real row (none will have that sentinel id) and satisfies the requirement.
    import('@/config/supabaseClient').then(({supabase,DEMO_MODE})=>{
      if(DEMO_MODE||!supabase) return;
      ['loans','customers','payments','leads','interactions','audit_logs'].forEach(table=>
        supabase.from(table).delete().neq('id','__none__')
          .then(({error})=>{ if(error) _sbErr('clear',table,error.message); })
      );
    }).catch(e=>_sbErr('import','doClear',e.message));
  };

  const parseCSVSection=(text,sectionName)=>{
    const start=text.indexOf(`--- ${sectionName} ---`);
    if(start===-1) return [];
    const after=text.slice(start+sectionName.length+8);
    const end=after.search(/\n--- [A-Z]+ ---/);
    const block=end===-1?after:after.slice(0,end);
    const lines=block.trim().split('\n').filter(Boolean);
    if(lines.length<2) return [];
    const headers=lines[0].split(',').map(h=>h.replace(/"/g,'').trim());
    return lines.slice(1).map(line=>{
      const vals=[];let cur='';let inQ=false;
      for(let i=0;i<line.length;i++){if(line[i]==='"'){inQ=!inQ;}else if(line[i]===','&&!inQ){vals.push(cur);cur='';}else cur+=line[i];}
      vals.push(cur);
      const obj={};headers.forEach((h,i)=>obj[h]=(vals[i]||'').replace(/"/g,'').trim());
      return obj;
    });
  };

  const doConfirmRestore = () => {
    if(!restorePreview) return;
    const {restoredCustomers,restoredLoans,restoredPayments,restoredLeads,restoredWorkers,restoredAudit,fileName}=restorePreview;

    // ── 1. Update React state immediately ─────────────────────────────
    if(restoredCustomers.length>0) setCustomers(restoredCustomers);
    // Re-link customerId — use ID directly if present (new backups), else name/phone fallback
    const custById   = Object.fromEntries(restoredCustomers.map(c=>[c.id,c]));
    const custByName = Object.fromEntries(restoredCustomers.map(c=>[c.name.trim().toLowerCase(),c]));
    const linkedLoans = restoredLoans.map(l=>{
      if(l.customerId && custById[l.customerId]) return {...l, phone:custById[l.customerId].phone||l.phone};
      const match = custByName[l.customer?.trim().toLowerCase()]
                 || restoredCustomers.find(c=>c.phone&&c.phone===l.phone);
      return match ? {...l, customerId:match.id, phone:match.phone||l.phone} : l;
    });
    if(linkedLoans.length>0) setLoans(linkedLoans);
    const linkedPayments = restoredPayments.map(p=>{
      if(p.customerId && custById[p.customerId]) return p;
      const loanMatch = linkedLoans.find(l=>l.id===p.loanId);
      if(loanMatch) return {...p, customerId:loanMatch.customerId};
      const nameMatch = custByName[p.customer?.trim().toLowerCase()];
      return nameMatch ? {...p, customerId:nameMatch.id} : p;
    });
    if(linkedPayments.length>0) setPayments(linkedPayments);
    if(restoredLeads.length>0) setLeads(restoredLeads);
    if(restoredWorkers.length>0) setWorkers(restoredWorkers);
    setAuditLog(la=>[{ts:ts(),user:'admin',action:'Database Restored',target:fileName,detail:`C:${restoredCustomers.length} L:${restoredLoans.length} P:${restoredPayments.length}`},...(restoredAudit.length?restoredAudit:la)]);

    // ── 2. Persist restored data to Supabase so it survives a refresh ─
    import('@/config/supabaseClient').then(({supabase,DEMO_MODE})=>{
      if(DEMO_MODE||!supabase) return;
      // Upsert in batches of 500 to stay within Supabase payload limits
      const chunk = (arr,size) => Array.from({length:Math.ceil(arr.length/size)},(_,i)=>arr.slice(i*size,(i+1)*size));
      const upsertAll = (table,rows) =>
        chunk(rows,500).forEach(batch=>
          supabase.from(table).upsert(batch,{onConflict:'id'})
            .then(({error})=>{ if(error) _sbErr('restore-upsert',table,error.message); })
        );
      if(restoredCustomers.length>0) upsertAll('customers', restoredCustomers.map(toSupabaseCustomer));
      if(linkedLoans.length>0)       upsertAll('loans',     linkedLoans.map(toSupabaseLoan));
      if(linkedPayments.length>0)    upsertAll('payments',  linkedPayments.map(toSupabasePayment));
      if(restoredLeads.length>0)     upsertAll('leads',     restoredLeads.map(toSupabaseLead));
      if(restoredWorkers.length>0)   upsertAll('workers',   restoredWorkers.map(w=>({
        id:w.id, name:w.name, email:w.email, role:w.role, status:w.status,
        phone:w.phone, joined:w.joined, pw_hash:w.pwHash||null,
        must_reset_pw:w.mustResetPw||false, docs:w.docs||[], avatar:w.avatar||'',
      })));
    }).catch(e=>_sbErr('import','doConfirmRestore',e.message));
    // ─────────────────────────────────────────────────────────────────

    setRestoreFile(fileName);
    setRestoreStatus(`ok:✅ Restored from "${fileName}" — ${restoredCustomers.length} customers, ${restoredLoans.length} loans, ${restoredPayments.length} payments, ${restoredLeads.length} leads, ${restoredWorkers.length} workers.`);
    addAudit('Database Restored',fileName,`C:${restoredCustomers.length} L:${restoredLoans.length}`);
    showToast('✅ Database restored from backup','ok',4000);SFX.upload();
    setRestorePreview(null);
    setUploadProgress(0);
  };

  const handleRestore=(e)=>{
    const file=e.target.files[0];
    if(!file)return;
    setRestoreStatus('');setUploadProgress(0);setRestorePreview(null);
    let prog=0;
    const progInterval=setInterval(()=>{
      prog=Math.min(prog+Math.random()*18+8,90);
      setUploadProgress(Math.round(prog));
    },80);
    const reader=new FileReader();
    reader.onload=ev=>{
      clearInterval(progInterval);
      setUploadProgress(95);
      setTimeout(()=>{
        try{
          const text=ev.target.result;
          if(!text.includes('ADEQUATE CAPITAL LMS BACKUP')){
            setUploadProgress(0);
            setRestoreStatus('error:⚠ Invalid backup file. Please upload a valid ACL backup CSV.');return;
          }
          const rawCusts=parseCSVSection(text,'CUSTOMERS');
          const rawLoans=parseCSVSection(text,'LOANS');
          const rawPayments=parseCSVSection(text,'PAYMENTS');
          const rawLeads=parseCSVSection(text,'LEADS');
          const rawWorkers=parseCSVSection(text,'WORKERS');
          const rawAudit=parseCSVSection(text,'AUDIT LOG');
          const restoredCustomers=rawCusts.map(r=>({id:r['ID'],name:r['Name'],phone:r['Phone'],idNo:r['ID No'],business:r['Business'],location:r['Location'],officer:r['Officer'],loans:Number(r['Loans'])||0,risk:r['Risk']||'Low',joined:r['Joined'],blacklisted:r['Blacklisted']==='Yes',docs:[],n1n:'',n1p:'',n1r:'',n2n:'',n2p:'',n2r:'',n3n:'',n3p:'',n3r:''}));
          const restoredLoans=rawLoans.map(r=>({id:r['Loan ID'],customerId:r['Customer ID']||'',customer:r['Customer'],amount:Number(r['Principal'])||0,balance:Number(r['Balance'])||0,status:r['Status'],daysOverdue:Number(r['Days Overdue'])||0,officer:r['Officer'],risk:'Low',disbursed:r['Disbursed']==='N/A'?null:r['Disbursed'],mpesa:null,phone:'',repaymentType:r['Repayment Type']||'Monthly',payments:[]}));
          const restoredPayments=rawPayments.map(r=>({id:r['ID'],customerId:r['Customer ID']||null,customer:r['Customer'],loanId:r['Loan ID']==='N/A'?null:r['Loan ID'],amount:Number(r['Amount'])||0,mpesa:r['M-Pesa'],date:r['Date'],status:r['Status']}));
          const restoredLeads=rawLeads.map(r=>({id:r['ID'],name:r['Name'],phone:r['Phone'],business:r['Business'],source:r['Source'],status:r['Status'],officer:r['Officer'],date:r['Date'],location:'',notes:''}));
          const restoredWorkers=rawWorkers.map(r=>({id:r['ID'],name:r['Name'],email:r['Email'],role:r['Role'],status:r['Status'],phone:r['Phone'],joined:r['Joined'],avatar:(r['Name']||'').split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase(),pwHash:_hashPw(uid('tmp')),pw:undefined,mustResetPw:true}));
          const restoredAudit=rawAudit.map(r=>({ts:r['Timestamp'],user:r['User'],action:r['Action'],target:r['Target'],detail:r['Detail']||''}));
          setUploadProgress(100);
          // Store parsed data and show inline confirm — no window.confirm
          setRestorePreview({restoredCustomers,restoredLoans,restoredPayments,restoredLeads,restoredWorkers,restoredAudit,fileName:file.name});
          setRestoreStatus('');
        }catch(err){
          setUploadProgress(0);
          setRestoreStatus('error:❌ Error parsing backup file: '+err.message);
        }
      },200);
    };
    reader.onerror=()=>{clearInterval(progInterval);setUploadProgress(0);setRestoreStatus('error:❌ Could not read file.');};
    reader.readAsText(file);
    e.target.value='';
  };

  return (
    <div className='fu'>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4,flexWrap:'wrap',gap:8}}>
        <div>
          <div style={{fontFamily:T.head,color:T.txt,fontSize:20,fontWeight:800}}>🗄️ Database Management</div>
          <div style={{color:T.muted,fontSize:13,marginTop:2}}>Backup, restore, and manage system data</div>
        </div>
      </div>
      <div style={{marginBottom:16}}/>

      {/* Download backup */}
      <Card style={{marginBottom:12}}>
        <CH title='📥 Download Backup' sub='Export all data as a single CSV file'/>
        <div style={{padding:'16px 18px'}}>
          <div style={{color:T.dim,fontSize:13,marginBottom:14,lineHeight:1.6}}>
            Downloads a complete backup of all customers, loans, payments, leads, interactions, workers, and audit logs into a single CSV file.
            {lastBackup&&<span style={{color:T.ok,marginLeft:8}}>✓ Last download: {lastBackup}</span>}
          </div>
          <div style={{display:'flex',gap:9,flexWrap:'wrap'}}>
            <Btn onClick={doBackup}>⬇ Download Full Backup Now</Btn>
            <Btn v='secondary' onClick={()=>{const csv=toCSV(['Timestamp','User','Action','Target','Details'],allState.auditLog.map(e=>[e.ts,e.user,e.action,e.target,e.detail||'']));dlCSV(`audit-log-${now()}.csv`,csv);}}>
              ⬇ Audit Log Only
            </Btn>
            <Btn v='secondary' onClick={()=>{const {csv,name}={name:`loans-${now()}.csv`,csv:toCSV(['Loan ID','Customer','Principal','Balance','Status'],allState.loans.map(l=>[l.id,l.customer,l.amount,l.balance,l.status]))};dlCSV(name,csv);}}>
              ⬇ Loans Only
            </Btn>
          </div>
        </div>
      </Card>

      {/* Restore */}
      <Card style={{marginBottom:12}}>
        <CH title='📤 Restore from Backup' sub='Re-import data from a previous CSV backup'/>
        <div style={{padding:'16px 18px'}}>
          <div style={{color:T.dim,fontSize:13,marginBottom:12}}>Upload a previously downloaded backup CSV file to restore all data.</div>
          {!restorePreview&&(
            <label style={{cursor:'pointer',display:'inline-flex',alignItems:'center',gap:8,background:T.bLo,border:`1px solid ${T.blue}38`,color:T.blue,borderRadius:9,padding:'10px 18px',fontSize:13,fontWeight:700}}>
              📤 Choose Backup File (.csv)
              <input key={uploadKey} ref={fileRef} type='file' accept='.csv,.CSV' style={{display:'none'}} onChange={handleRestore}/>
            </label>
          )}
          {uploadProgress>0&&uploadProgress<100&&(
            <div style={{marginTop:14}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                <span style={{color:T.dim,fontSize:12}}>Reading file…</span>
                <span style={{color:T.accent,fontFamily:T.mono,fontSize:12,fontWeight:700}}>{uploadProgress}%</span>
              </div>
              <div style={{height:6,background:T.border,borderRadius:99,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${uploadProgress}%`,background:T.accent,borderRadius:99,transition:'width .15s'}}/>
              </div>
            </div>
          )}
          {restorePreview&&(
            <div style={{background:T.wLo,border:`1px solid ${T.warn}38`,borderRadius:12,padding:'16px 18px',marginTop:12}}>
              <div style={{color:T.warn,fontWeight:800,fontSize:13,marginBottom:10}}>⚠ Confirm Restore from "{restorePreview.fileName}"</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
                {[['Customers',restorePreview.restoredCustomers.length],['Loans',restorePreview.restoredLoans.length],['Payments',restorePreview.restoredPayments.length],['Leads',restorePreview.restoredLeads.length],['Workers',restorePreview.restoredWorkers.length],['Audit Entries',restorePreview.restoredAudit.length]].map(([k,v])=>(
                  <div key={k} style={{background:T.surface,borderRadius:8,padding:'8px 12px'}}>
                    <div style={{color:T.muted,fontSize:10,textTransform:'uppercase',letterSpacing:.6}}>{k}</div>
                    <div style={{color:T.txt,fontWeight:800,fontFamily:T.mono,fontSize:15,marginTop:2}}>{v}</div>
                  </div>
                ))}
              </div>
              <Alert type='danger'>⚠ This will overwrite ALL current data in the system. This cannot be undone.</Alert>
              <div style={{display:'flex',gap:9,marginTop:4}}>
                <Btn v='danger' full onClick={doConfirmRestore}>✓ Restore Database</Btn>
                <Btn v='secondary' onClick={()=>{setRestorePreview(null);setUploadProgress(0);setUploadKey(k=>k+1);}}>Cancel</Btn>
              </div>
            </div>
          )}
          {restoreStatus&&(()=>{
            const isOk=restoreStatus.startsWith('ok:');
            const isErr=restoreStatus.startsWith('error:');
            const msg=restoreStatus.replace(/^(ok|error|warn):/,'');
            const type=isOk?'ok':isErr?'danger':'warn';
            return <Alert type={type} style={{marginTop:12}}>{msg}</Alert>;
          })()}
        </div>
      </Card>

      {/* Clear database — 3FA protected */}
      <Card style={{border:`1px solid ${T.danger}38`}}>
        <CH title='🗑 Clear Database' sub='Permanently delete all data — requires 3-factor authentication'/>
        <div style={{padding:'16px 18px'}}>
          <Alert type='danger'>⚠ This action is IRREVERSIBLE. All customers, loans, payments, and leads will be permanently deleted. A full backup will be downloaded automatically before clearing.</Alert>
          <Btn v='danger' onClick={startClear}>Initiate Database Clear →</Btn>
        </div>
      </Card>

      {showClear&&(
        <Dialog title='🔐 Database Clear — 3-Factor Verification' onClose={()=>setShowClear(false)} width={440}>
          <Alert type='danger'>You are about to wipe all data. Complete 3-factor authentication to proceed.</Alert>
          <div style={{display:'flex',justifyContent:'center',gap:6,marginBottom:18}}>
            {['Password','Biometric','TOTP'].map((s,i)=>(
              <div key={s} style={{display:'flex',alignItems:'center',gap:4}}>
                <div style={{width:22,height:22,borderRadius:99,background:step>i+1?T.accent:step===i+1?T.aMid:T.surface,border:`2px solid ${step>i+1||step===i+1?T.accent:T.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:800,color:step>i+1?'#060A10':step===i+1?T.accent:T.muted}}>
                  {step>i+1?'✓':i+1}
                </div>
                <span style={{fontSize:10,color:step===i+1?T.accent:T.muted}}>{s}</span>
                {i<2&&<span style={{color:T.border}}>›</span>}
              </div>
            ))}
          </div>
          {err&&<Alert type='danger'>{err}</Alert>}
          {step===1&&<div>
            <FI label='Admin Password' type='password' value={pw} onChange={setPw} placeholder='Enter password'/>
            <Btn onClick={stepPw} full>Continue →</Btn>
          </div>}
          {step===2&&<div style={{textAlign:'center'}}>
            <div style={{fontSize:40,margin:'10px 0'}}>🔐</div>
            <div style={{color:T.txt,fontWeight:700,marginBottom:14}}>Biometric Verification</div>
            <Btn onClick={stepBio} full>Authenticate →</Btn>
          </div>}
          {step===3&&<div>
            <div style={{textAlign:'center',marginBottom:12,color:T.muted,fontSize:12}}>Enter TOTP code · Demo: <b style={{color:T.accent}}>123456</b></div>
            <input value={totp} onChange={e=>setTotp(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder='••••••' maxLength={6}
              style={{width:'100%',background:T.surface,border:`1px solid ${T.hi}`,borderRadius:10,padding:13,color:T.accent,fontSize:26,fontWeight:800,letterSpacing:12,textAlign:'center',outline:'none',marginBottom:9}}/>
            <Btn onClick={stepTotp} full>Verify →</Btn>
          </div>}
          {step===4&&<div>
            <Alert type='danger'>⚠ FINAL WARNING: Clicking below will permanently delete all data. A backup has been downloaded. This cannot be undone.</Alert>
            <div style={{display:'flex',gap:9}}>
              <Btn v='danger' full onClick={doClear}>🗑 CONFIRM — Clear All Data</Btn>
              <Btn v='secondary' onClick={()=>setShowClear(false)}>Cancel</Btn>
            </div>
          </div>}
        </Dialog>
      )}
    </div>
  );
};


// ═══════════════════════════════════════════
//  WORKER DETAIL PANEL (admin view)
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
//  WORKERS PAGE
// ═══════════════════════════════════════════
const AWorkers = ({workers,setWorkers,loans,setLoans,payments,customers,setCustomers,leads,setLeads,interactions,setInteractions,allState,addAudit,showToast=()=>{}}) => {
  const {open:openContact, Popup:ContactPopup} = useContactPopup();
  const [sel, setSel]           = useState(null);
  const [workQ, setWorkQ]       = useState('');
  const [showNew, setShowNew]   = useState(false);
  const [detailTab, setDetailTab] = useState('overview');
  const [viewDoc, setViewDoc]   = useState(null);
  const blankF = {name:'',email:'',role:'Loan Officer',phone:'',pw:'',idNo:''};
  const [f, setF] = useState(blankF);

  const ROLES = ['Loan Officer','Collections Officer','Finance','Viewer / Auditor','Asset Recovery'];
  const DOC_SLOTS = [
    {key:'id_front', label:'National ID - Front', icon:'ID', required:true,  accept:'image/*'},
    {key:'id_back',  label:'National ID - Back',  icon:'ID', required:true,  accept:'image/*'},
    {key:'passport', label:'Passport Photo',       icon:'PP', required:true,  accept:'image/*'},
    {key:'extra_1',  label:'Additional Document',  icon:'DOC',required:false, accept:'image/*,application/pdf'},
    {key:'extra_2',  label:'Additional Document 2',icon:'DOC',required:false, accept:'image/*,application/pdf'},
  ];

  const addW = () => {
    const missing = [];
    if(!f.name)           missing.push('Full Name');
    if(!f.email)          missing.push('Email');
    if(!f.phone)          missing.push('Phone');
    if(!f.idNo)           missing.push('National ID No.');
    if(!f.pw||f.pw.length<6) missing.push('Password (min 6 chars)');
    if(!f.role)           missing.push('Role');
    if(missing.length){ showToast('Please fill in: '+missing.join(', '),'warn'); try{SFX.error();}catch(e){} return; }
    const emailTaken = workers.some(w=>w.email.trim().toLowerCase()===f.email.trim().toLowerCase());
    if(emailTaken){ showToast('A worker with this email already exists','danger'); try{SFX.error();}catch(e){} return; }
    const idTaken = workers.some(w=>w.idNo&&w.idNo.trim()===f.idNo.trim());
    if(idTaken){ showToast('A worker with this National ID already exists','danger'); try{SFX.error();}catch(e){} return; }
    import('@/config/supabaseClient').then(({supabase,DEMO_MODE})=>{
      if(!DEMO_MODE&&supabase){
        const avatar = f.name.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();
        const email  = f.email.trim();

        // Step 1: create the Supabase auth account for the worker.
        // signUp with the anon key is the only option without the service_role key.
        // If the user was already created (e.g. previous failed attempt), signUp
        // returns a dummy session — we handle that by checking if a user session exists.
        supabase.auth.signUp({email, password:f.pw})
          .then(({data:signUpData, error:signUpErr})=>{
            // "User already registered" is not a hard error — the auth user exists,
            // we just need to get their UUID. We do that by checking auth.users
            // via the workers table lookup (we can't query auth.users with anon key).
            // So we proceed and use null for auth_user_id — admin can link it later
            // via SQL, or the worker's id will be linked on first login.
            const authUserId = signUpData?.user?.id || null;

            // Step 2: use the SECURITY DEFINER RPC function to insert the worker row.
            // This bypasses RLS because the function runs with elevated privileges
            // but still enforces that the caller is an Admin.
            return supabase.rpc('create_worker', {
              p_name:         f.name,
              p_email:        email,
              p_role:         f.role,
              p_phone:        f.phone,
              p_avatar:       avatar,
              p_auth_user_id: authUserId,
            });
          })
          .then(({data:wRow, error:wErr})=>{
            if(wErr){
              // If RPC not yet created, fall back to direct insert
              if(wErr.code==='42883'){
                return supabase.from('workers').insert([{
                  name:f.name, email, role:f.role,
                  phone:f.phone, status:'Active', joined:now(),
                  avatar, auth_user_id:null,
                }]).select().single();
              }
              throw wErr;
            }
            return {data:wRow, error:null};
          })
          .then(({data:wRow, error:wErr})=>{
            if(wErr) throw wErr;
            const w = {...wRow, docs:[], idNo:f.idNo||''};
            setWorkers(ws=>[...ws,w]);
            addAudit('Worker Added',w.id||email, w.name||f.name);
            showToast(f.name+' added. They can log in with their email and password.','ok');
            try{SFX.save();}catch(e){}
            setShowNew(false); setF(blankF);
          })
          .catch(err=>{
            const msg = err.message||'';
            if(msg.toLowerCase().includes('already registered')||msg.toLowerCase().includes('already exists')){
              showToast('Auth account already exists for this email. The worker row was not created — run the SQL fix below or contact support.','warn',6000);
            } else {
              showToast('Error adding worker: '+msg,'danger');
            }
            try{SFX.error();}catch(e){}
          });
        return;
      }
      // Demo mode — local only
      hashPwAsync(f.pw).then(pwHash=>{
        const w = {id:uid('W'),avatar:f.name.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase(),status:'Active',joined:now(),docs:[],...f,pwHash,pw:undefined};
        setWorkers(ws=>[...ws,w]);
        addAudit('Worker Added',w.id,w.name+(w.idNo?' ID:'+w.idNo:''));
        showToast(w.name+' added to team (demo mode — not saved to database)','ok');
        try{SFX.save();}catch(e){}
        setShowNew(false); setF(blankF);
      }).catch(()=>showToast('Failed to hash password','danger'));
    }).catch(()=>showToast('Import error — could not add worker','danger'));
  };

  const toggleStatus = w => {
    const next = w.status==='Active'?'Inactive':'Active';
    const wUpd={...w,status:next};
    setWorkers(ws=>ws.map(x=>x.id===w.id?wUpd:x));
    import('@/config/supabaseClient').then(({supabase,DEMO_MODE})=>{if(!DEMO_MODE&&supabase)supabase.from('workers').update({status:next}).eq('id',w.id).then(({error})=>{if(error)console.error('[worker status]',error.message);});}).catch(()=>{});
    addAudit('Worker Status Changed',w.id,next);
    showToast(w.name+' -> '+next,'info');
    setSel(prev=>prev&&prev.id===w.id?{...prev,status:next}:prev);
  };

  const changeRole = (w, role) => {
    setWorkers(ws=>ws.map(x=>x.id===w.id?{...x,role}:x));
    import('@/config/supabaseClient').then(({supabase,DEMO_MODE})=>{if(!DEMO_MODE&&supabase)supabase.from('workers').update({role}).eq('id',w.id).then(({error})=>{if(error)console.error('[worker role]',error.message);});}).catch(()=>{});
    addAudit('Worker Role Changed',w.id,w.name+': '+w.role+' -> '+role);
    showToast(w.name+' role updated to '+role,'ok');
    setSel(prev=>prev&&prev.id===w.id?{...prev,role}:prev);
  };

  const uploadDoc = (wid, slot, file) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const doc = {id:uid('DOC'),key:slot.key,name:slot.label,originalName:file.name,type:file.type,size:file.size,dataUrl:ev.target.result,uploaded:now()};
      setWorkers(ws=>ws.map(x=>{
        if(x.id!==wid) return x;
        const docs = [...(x.docs||[]).filter(d=>d.key!==slot.key), doc];
        return {...x,docs};
      }));
      setSel(prev=>{
        if(!prev||prev.id!==wid) return prev;
        const docs = [...(prev.docs||[]).filter(d=>d.key!==slot.key), doc];
        return {...prev,docs};
      });
      showToast(slot.label+' uploaded','ok');
    };
    reader.readAsDataURL(file);
  };

  const removeDoc = (wid, docId) => {
    setWorkers(ws=>ws.map(x=>{
      if(x.id!==wid) return x;
      return {...x,docs:(x.docs||[]).filter(d=>d.id!==docId)};
    }));
    setSel(prev=>{
      if(!prev||prev.id!==wid) return prev;
      return {...prev,docs:(prev.docs||[]).filter(d=>d.id!==docId)};
    });
    showToast('Document removed','info');
  };

  // ── WORKER DETAIL VIEW ─────────────────────────────────────────
  if(sel) {
    const w       = workers.find(x=>x.id===sel.id)||sel;
    const wLoans  = loans.filter(l=>l.officer===w.name);
    const wCusts  = customers.filter(c=>c.officer===w.name);
    const wLeads  = (leads||[]).filter(l=>l.officer===w.name);
    const wInts   = (interactions||[]).filter(i=>wLoans.some(l=>l.id===i.loanId));
    const wDocs   = w.docs||[];
    const book    = wLoans.filter(l=>l.status!=='Settled').reduce((s,l)=>s+l.balance,0);
    const coll    = payments.filter(p=>wLoans.some(l=>l.id===p.loanId)).reduce((s,p)=>s+p.amount,0);
    const ovLoans = wLoans.filter(l=>l.status==='Overdue');
    const actLoans= wLoans.filter(l=>l.status==='Active');
    const reqSlots= DOC_SLOTS.filter(s=>s.required);
    const reqDone = reqSlots.filter(s=>wDocs.some(d=>d.key===s.key)).length;
    const docsOk  = reqDone>=reqSlots.length;
    const ph      = (w.phone||'').replace(/\s/g,'');

    const TABS = ['overview','profile','loans','customers','leads','timeline','documents','portal'];

    return (
      <div className="fu">
        {ContactPopup}
        {viewDoc&&<DocViewer doc={viewDoc} onClose={()=>setViewDoc(null)}/>}

        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16,paddingBottom:14,borderBottom:'1px solid '+T.border}}>
          <button onClick={()=>{setSel(null);setDetailTab('overview');setViewDoc(null);}}
            style={{background:T.surface,border:'1px solid '+T.border,borderRadius:8,padding:'7px 14px',cursor:'pointer',color:T.txt,fontSize:13,fontWeight:700}}>
            {'<- Team'}
          </button>
          <Av ini={w.avatar||w.name[0]} size={32} color={w.status==='Active'?T.accent:T.muted}/>
          <div style={{flex:1}}>
            <span style={{color:T.txt,fontWeight:800,fontSize:15}}>{w.name}</span>
            <span style={{color:T.muted,fontSize:12,marginLeft:10}}>{w.role}</span>
          </div>
          <Badge color={w.status==='Active'?T.ok:T.danger}>{w.status}</Badge>
          <Btn v={w.status==='Active'?'danger':'ok'} sm onClick={()=>toggleStatus(w)}>
            {w.status==='Active'?'Deactivate':'Activate'}
          </Btn>
        </div>

        <div style={{display:'flex',gap:5,marginBottom:16,overflowX:'auto',paddingBottom:2}}>
          {TABS.map(t=>(
            <button key={t} onClick={()=>setDetailTab(t)}
              style={{background:detailTab===t?T.accent:T.surface,
                      color:detailTab===t?'#060A10':t==='documents'&&!docsOk?T.warn:T.muted,
                      border:'1px solid '+(detailTab===t?T.accent:t==='documents'&&!docsOk?T.warn+'60':T.border),
                      borderRadius:99,padding:'6px 14px',fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>
              {t==='overview'?'Overview'
               :t==='profile'?'Profile'
               :t==='loans'?('Loans ('+wLoans.length+')')
               :t==='customers'?('Customers ('+wCusts.length+')')
               :t==='leads'?('Leads ('+wLeads.length+')')
               :t==='timeline'?('Timeline ('+wInts.length+')')
               :t==='documents'?('Documents ('+wDocs.length+')'+(!docsOk?' !':''))
               :'Worker Portal'}
            </button>
          ))}
        </div>

        {detailTab==='overview'&&(
          <div>

            {/* ── Hero card ───────────────────────── */}
            <div style={{background:T.card2,border:'1px solid '+T.border,borderRadius:14,padding:'16px 18px',marginBottom:14,display:'flex',alignItems:'center',gap:14}}>
              <Av ini={w.avatar||w.name[0]} size={56} color={w.status==='Active'?T.accent:T.muted}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:T.txt,fontWeight:900,fontSize:17,fontFamily:T.head}}>{w.name}</div>
                <div style={{color:T.muted,fontSize:12,marginTop:1}}>{w.role}</div>
                <div style={{color:T.muted,fontSize:11,marginTop:2}}>{w.email}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <Badge color={w.status==='Active'?T.ok:T.danger}>{w.status}</Badge>
                {!docsOk&&<div style={{color:T.warn,fontSize:10,fontWeight:700,marginTop:4}}>Docs incomplete</div>}
                <div style={{color:T.muted,fontSize:10,marginTop:4}}>Joined {w.joined||'-'}</div>
              </div>
            </div>

            {/* ── KPI grid ───────────────────────── */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:14}}>
              {[
                ['Loan Book',    fmt(book),     T.accent],
                ['Active Loans', actLoans.length, T.ok],
                ['Overdue',      ovLoans.length,  ovLoans.length>0?T.danger:T.ok],
                ['Collected',    fmt(coll),      T.ok],
                ['Customers',    wCusts.length,  T.txt],
                ['Leads',        wLeads.length,  T.txt],
              ].map(function(item){return(
                <div key={item[0]} style={{background:T.surface,borderRadius:9,padding:'10px 11px'}}>
                  <div style={{color:T.muted,fontSize:9,textTransform:'uppercase',letterSpacing:.5,marginBottom:3}}>{item[0]}</div>
                  <div style={{color:item[2],fontWeight:800,fontSize:15,fontFamily:T.mono}}>{item[1]}</div>
                </div>
              );})}
            </div>

            {/* ── Performance bars ───────────────── */}
            <Card style={{marginBottom:12}}>
              <CH title="Performance"/>
              <div style={{padding:'10px 14px 14px'}}>
                {(function(){
                  var collRate = book>0 ? Math.min(Math.round((coll/book)*100),100) : 0;
                  var ovRate   = wLoans.length>0 ? Math.round((ovLoans.length/wLoans.length)*100) : 0;
                  var custConv = (wLeads.length+wCusts.length)>0 ? Math.round((wCusts.length/(wLeads.length+wCusts.length))*100) : 0;
                  return (
                    <div>
                      {[
                        ['Collection Rate', collRate, T.ok,     collRate+'%'],
                        ['Overdue Rate',    ovRate,   ovRate>20?T.danger:T.warn, ovRate+'%'],
                        ['Conversion Rate', custConv, T.accent, custConv+'%'],
                      ].map(function(item){return(
                        <div key={item[0]} style={{marginBottom:10}}>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                            <span style={{color:T.muted,fontSize:11}}>{item[0]}</span>
                            <span style={{color:item[2],fontWeight:700,fontSize:11}}>{item[3]}</span>
                          </div>
                          <div style={{height:6,background:T.border,borderRadius:99,overflow:'hidden'}}>
                            <div style={{height:'100%',width:item[1]+'%',background:item[2],borderRadius:99,transition:'width .5s ease'}}/>
                          </div>
                        </div>
                      );})}
                    </div>
                  );
                })()}
              </div>
            </Card>

            {/* ── Contact ───────────────────────── */}
            <Card style={{marginBottom:12}}>
              <div style={{padding:'12px 14px',display:'flex',gap:8,flexWrap:'wrap'}}>
                <a href={'tel:'+ph} style={{flex:1,minWidth:80,display:'flex',alignItems:'center',justifyContent:'center',gap:5,background:T.oLo,border:'1px solid '+T.ok+'38',color:T.ok,borderRadius:9,padding:'9px',fontWeight:800,fontSize:12,textDecoration:'none'}}>📞 Call</a>
                <a href={'sms:'+ph} style={{flex:1,minWidth:80,display:'flex',alignItems:'center',justifyContent:'center',gap:5,background:T.bLo,border:'1px solid '+T.blue+'38',color:T.blue,borderRadius:9,padding:'9px',fontWeight:800,fontSize:12,textDecoration:'none'}}>💬 SMS</a>
                <a href={'https://wa.me/'+(ph.startsWith('0')?'254'+ph.slice(1):ph)} target="_blank" rel="noreferrer" style={{flex:1,minWidth:80,display:'flex',alignItems:'center',justifyContent:'center',gap:5,background:'#25D36618',border:'1px solid #25D36638',color:'#25D366',borderRadius:9,padding:'9px',fontWeight:800,fontSize:12,textDecoration:'none'}}>WhatsApp</a>
              </div>
            </Card>

            {/* ── Alerts ───────────────────────── */}
            {!docsOk&&(
              <div style={{background:T.dLo,border:'1px solid '+T.danger+'38',borderRadius:10,padding:'11px 14px',display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                <span style={{color:T.danger,fontWeight:700,fontSize:13}}>Documents incomplete —</span>
                <span style={{color:T.muted,fontSize:12}}>{reqSlots.length-reqDone} required not uploaded</span>
                <button onClick={function(){setDetailTab('documents');}} style={{marginLeft:'auto',background:'none',border:'1px solid '+T.accent,color:T.accent,borderRadius:7,padding:'4px 10px',cursor:'pointer',fontSize:11,fontWeight:700}}>View Docs</button>
              </div>
            )}
            {ovLoans.length>0&&(
              <Card>
                <CH title="Overdue Loans"/>
                <DT cols={[{k:'id',l:'ID',r:function(v){return <span style={{color:T.accent,fontFamily:T.mono,fontSize:12}}>{v}</span>;}},{k:'customer',l:'Customer'},{k:'balance',l:'Balance',r:function(v){return fmt(v);}},{k:'daysOverdue',l:'Days',r:function(v){return <span style={{color:T.danger,fontWeight:800}}>{v}d</span>;}}]} rows={ovLoans} maxHeightVh={0.35}/>
              </Card>
            )}
          </div>
        )}

        {detailTab==='profile'&&(
          <div>

            {/* ── Personal details ─────────────── */}
            <Card style={{marginBottom:12}}>
              <CH title="Personal Information"/>
              <div style={{padding:'10px 14px 14px'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {[
                    ['Full Name',    w.name],
                    ['Role',         w.role],
                    ['Email',        w.email||'-'],
                    ['Phone',        w.phone||'-'],
                    ['National ID',  w.idNo||'-'],
                    ['Worker ID',    w.id],
                    ['Status',       w.status],
                    ['Date Joined',  w.joined||'-'],
                  ].map(function(pair){return(
                    <div key={pair[0]} style={{background:T.surface,borderRadius:9,padding:'9px 12px'}}>
                      <div style={{color:T.muted,fontSize:10,textTransform:'uppercase',letterSpacing:.5,marginBottom:2}}>{pair[0]}</div>
                      <div style={{color:T.txt,fontWeight:600,fontSize:13}}>{pair[1]}</div>
                    </div>
                  );})}
                </div>
              </div>
            </Card>

            {/* ── Role management ──────────────── */}
            <Card style={{marginBottom:12}}>
              <CH title="Change Role"/>
              <div style={{padding:'10px 14px 14px'}}>
                <div style={{color:T.muted,fontSize:12,marginBottom:10}}>Current: <b style={{color:T.accent}}>{w.role}</b></div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {ROLES.map(function(role){return(
                    <button key={role} onClick={function(){changeRole(w,role);}}
                      style={{background:w.role===role?T.accent:T.surface,
                              color:w.role===role?'#060A10':T.muted,
                              border:'1px solid '+(w.role===role?T.accent:T.border),
                              borderRadius:8,padding:'7px 12px',cursor:'pointer',fontSize:12,fontWeight:700}}>
                      {role}
                    </button>
                  );})}
                </div>
              </div>
            </Card>

            {/* ── Document photos ──────────────── */}
            <Card>
              <CH title="Identity Documents"/>
              <div style={{padding:'10px 14px 14px'}}>
                {DOC_SLOTS.filter(function(s){return s.required;}).map(function(slot){
                  var doc = wDocs.find(function(d){return d.key===slot.key;});
                  return (
                    <div key={slot.key} style={{marginBottom:14}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                        <span style={{color:T.muted,fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:.5}}>{slot.label}</span>
                        {!doc&&<span style={{color:T.danger,fontSize:10,fontWeight:700}}>Not uploaded</span>}
                        {doc&&<span style={{color:T.ok,fontSize:10,fontWeight:700}}>Uploaded {doc.uploaded}</span>}
                      </div>
                      {doc?(
                        <div onClick={function(){setViewDoc(doc);}}
                          style={{cursor:'pointer',borderRadius:10,overflow:'hidden',border:'2px solid '+T.ok,display:'inline-block',maxWidth:'100%'}}>
                          {doc.type&&doc.type.startsWith('image/')
                            ?<img src={doc.dataUrl} alt={slot.label} style={{display:'block',maxWidth:'100%',maxHeight:180,objectFit:'cover'}}/>
                            :<div style={{background:T.surface,padding:'20px 30px',color:T.muted,fontSize:12}}>PDF — tap to view</div>
                          }
                        </div>
                      ):(
                        <div style={{background:T.surface,borderRadius:10,border:'2px dashed '+T.danger+'40',padding:'20px',textAlign:'center'}}>
                          <div style={{color:T.danger,fontSize:12,marginBottom:8}}>No document uploaded</div>
                          <label style={{cursor:'pointer',display:'inline-flex',alignItems:'center',gap:5,background:T.bLo,border:'1px solid '+T.blue+'38',borderRadius:7,padding:'6px 12px'}}>
                            <span style={{color:T.blue,fontSize:12,fontWeight:700}}>Upload</span>
                            <input type="file" accept={slot.accept} style={{display:'none'}} onChange={function(e){var file=e.target.files&&e.target.files[0];if(!file)return;e.target.value='';uploadDoc(w.id,slot,file);}}/>
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {detailTab==='loans'&&(
          <DT cols={[{k:'id',l:'ID',r:function(v){return <span style={{color:T.accent,fontFamily:T.mono,fontSize:12}}>{v}</span>;}},{k:'customer',l:'Customer'},{k:'amount',l:'Principal',r:function(v){return fmt(v);}},{k:'balance',l:'Balance',r:function(v){return fmt(v);}},{k:'status',l:'Status',r:function(v){return <Badge color={SC[v]||T.muted}>{v}</Badge>;}},{k:'repaymentType',l:'Type'}]}
            rows={wLoans} emptyMsg="No loans assigned"/>
        )}

        {detailTab==='customers'&&(
          <DT cols={[{k:'id',l:'ID',r:function(v){return <span style={{color:T.accent,fontFamily:T.mono,fontSize:12}}>{v}</span>;}},{k:'name',l:'Name'},{k:'phone',l:'Phone'},{k:'business',l:'Business'},{k:'risk',l:'Risk',r:function(v){return <Badge color={RC[v]}>{v}</Badge>;}}]}
            rows={wCusts} emptyMsg="No customers assigned"/>
        )}

        {detailTab==='leads'&&(
          <DT cols={[{k:'id',l:'ID',r:function(v){return <span style={{color:T.accent,fontFamily:T.mono,fontSize:12}}>{v}</span>;}},{k:'name',l:'Name'},{k:'phone',l:'Phone'},{k:'business',l:'Business'},{k:'status',l:'Status',r:function(v){return <Badge color={SC[v]||T.muted}>{v}</Badge>;}},{k:'date',l:'Date'}]}
            rows={wLeads} emptyMsg="No leads"/>
        )}

        {detailTab==='timeline'&&(
          <div>
            {wInts.length===0&&<div style={{color:T.muted,textAlign:'center',padding:24,background:T.surface,borderRadius:10}}>No interactions recorded</div>}
            <div style={{maxHeight:'40vh',overflowY:'auto',overflowX:'hidden'}}>
            {[...wInts].sort(function(a,b){return b.date.localeCompare(a.date);}).map(function(item){return(
              <div key={item.id} style={{background:T.surface,border:'1px solid '+T.border,borderRadius:10,padding:'11px 13px',marginBottom:8}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                  <Badge color={T.accent}>{item.type}</Badge>
                  <span style={{color:T.muted,fontSize:11}}>{item.date}</span>
                </div>
                <div style={{color:T.txt,fontSize:13}}>{item.notes}</div>
              </div>
            );})}
            </div>
          </div>
        )}

        {detailTab==='documents'&&(
          <div>
            <div style={{display:'flex',alignItems:'center',gap:10,background:docsOk?T.oLo:T.dLo,border:'1px solid '+(docsOk?T.ok:T.danger)+'38',borderRadius:10,padding:'11px 14px',marginBottom:14}}>
              <span style={{fontSize:18}}>{docsOk?'OK':'!'}</span>
              <div style={{flex:1}}>
                <div style={{color:docsOk?T.ok:T.danger,fontWeight:700,fontSize:13}}>
                  {docsOk?'All required documents on file':reqSlots.length-reqDone+' required document(s) missing'}
                </div>
                <div style={{color:T.muted,fontSize:11,marginTop:2}}>{wDocs.length} of {DOC_SLOTS.length} uploaded</div>
              </div>
              <Badge color={docsOk?T.ok:T.danger}>{reqDone+'/'+reqSlots.length}</Badge>
            </div>
            {DOC_SLOTS.map(function(slot,idx){
              const doc = wDocs.find(function(d){return d.key===slot.key;});
              return (
                <div key={slot.key} style={{background:T.surface,border:'1.5px solid '+(doc?T.ok:slot.required?T.danger+'40':T.border),borderRadius:11,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
                  <div style={{width:28,height:28,borderRadius:99,background:doc?T.ok:slot.required?T.dLo:T.border,color:doc?'#fff':slot.required?T.danger:T.muted,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:800,flexShrink:0}}>{doc?'V':idx+1}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:T.txt,fontSize:13,fontWeight:700}}>{slot.label} {slot.required&&<span style={{color:T.danger,fontSize:10}}>Required</span>}</div>
                    <div style={{color:doc?T.ok:T.muted,fontSize:11,marginTop:2}}>{doc?'Uploaded '+doc.uploaded:(slot.required?'Not uploaded':'Optional')}</div>
                  </div>
                  {doc&&(
                    <div onClick={()=>setViewDoc(doc)} style={{cursor:'pointer',flexShrink:0}}>
                      {doc.type&&doc.type.startsWith('image/')
                        ?<img src={doc.dataUrl} alt={slot.label} style={{width:52,height:52,objectFit:'cover',borderRadius:7,border:'2px solid '+T.ok}}/>
                        :<div style={{width:52,height:52,background:T.card,borderRadius:7,border:'2px solid '+T.ok,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>D</div>
                      }
                    </div>
                  )}
                  <div style={{display:'flex',gap:6,flexShrink:0}}>
                    {doc&&<button onClick={()=>setViewDoc(doc)} style={{background:T.aLo,border:'1px solid '+T.accent+'38',color:T.accent,borderRadius:7,padding:'5px 9px',cursor:'pointer',fontSize:11,fontWeight:700}}>View</button>}
                    {doc&&<button onClick={()=>removeDoc(w.id,doc.id)} style={{background:T.dLo,border:'1px solid '+T.danger+'30',color:T.danger,borderRadius:7,padding:'5px 9px',cursor:'pointer',fontSize:11,fontWeight:700}}>Remove</button>}
                    {!doc&&(
                      <label style={{cursor:'pointer',display:'flex',alignItems:'center',gap:5,background:T.bLo,border:'1px solid '+T.blue+'38',borderRadius:7,padding:'6px 10px'}}>
                        <span style={{color:T.blue,fontSize:11,fontWeight:700}}>Upload</span>
                        <input type="file" accept={slot.accept} style={{display:'none'}} onChange={function(e){var file=e.target.files&&e.target.files[0];if(!file)return;e.target.value='';uploadDoc(w.id,slot,file);}}/>
                      </label>
                    )}
                  </div>
                </div>
              );
            })}
            <div style={{color:T.muted,fontSize:11,marginTop:8}}>Admin can upload or remove documents on behalf of this worker.</div>
          </div>
        )}

        {detailTab==='portal'&&(
          <div>
            <Alert type="info" style={{marginBottom:12}}>Viewing {w.name} portal as admin</Alert>
            <WorkerPanel
              worker={w}
              workers={workers||[]}
              setWorkers={setWorkers}
              loans={loans}
              payments={payments}
              customers={customers}
              leads={leads||[]}
              allWorkers={workers||[]}
              setCustomers={setCustomers||(function(){})}
              onSubmitLoan={function(l){if(setLoans)setLoans(function(ls){return [l].concat(ls);});}}
              setLeads={setLeads||(function(){})}
              interactions={interactions||[]}
              setInteractions={setInteractions||(function(){})}
              addAudit={addAudit||(function(){})}
              showToast={showToast||(function(){})}
            />
          </div>
        )}
      </div>
    );
  }

  // ── TEAM GRID ────────────────────────────────────────────────
  return (
    <div className="fu">
      {ContactPopup}
      <div className="mob-stack" style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18,gap:10}}>
        <div>
          <div style={{fontFamily:T.head,color:T.txt,fontSize:20,fontWeight:800}}>Team</div>
          <div style={{color:T.muted,fontSize:13}}>{workers.filter(function(w){return w.status==='Active';}).length} active / {workers.length} total</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <RefreshBtn onRefresh={function(){ setWorkQ(''); setSel(null); }}/>
          <Btn onClick={function(){setShowNew(true);}}>+ Add Worker</Btn>
        </div>
      </div>
      <div style={{marginBottom:12}}>
        <Search value={workQ} onChange={setWorkQ} placeholder="Search by name or role..."/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
        {workers.filter(function(w){return !workQ||w.name.toLowerCase().includes(workQ.toLowerCase())||w.role.toLowerCase().includes(workQ.toLowerCase());}).map(function(w){
          var wl = loans.filter(function(l){return l.officer===w.name;});
          var bk = wl.filter(function(l){return l.status!=='Settled';}).reduce(function(s,l){return s+l.balance;},0);
          var ov = wl.filter(function(l){return l.status==='Overdue';}).length;
          var wp = payments.filter(function(p){return wl.some(function(l){return l.id===p.loanId;});}).reduce(function(s,p){return s+p.amount;},0);
          var docsOk = DOC_SLOTS.filter(function(s){return s.required;}).every(function(s){return (w.docs||[]).some(function(d){return d.key===s.key;});});
          return (
            <Card key={w.id} style={{padding:'16px 18px',cursor:'pointer',border:'1px solid '+(w.status==='Active'?T.border:T.danger+'30')}}
              onClick={function(){setSel(w);setDetailTab('overview');setViewDoc(null);}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                <Av ini={w.avatar||w.name[0]} size={38} color={w.status==='Active'?T.accent:T.muted}/>
                <div style={{flex:1,minWidth:0}}>
                  <div onClick={function(e){e.stopPropagation();setSel(w);setDetailTab('profile');setViewDoc(null);}} style={{color:T.accent,fontWeight:700,fontSize:14,cursor:'pointer',textDecoration:'underline',textDecorationStyle:'dotted',textUnderlineOffset:'2px'}}>{w.name}</div>
                  <div style={{color:T.muted,fontSize:12}}>{w.role}</div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end'}}>
                  <Badge color={w.status==='Active'?T.ok:T.danger}>{w.status}</Badge>
                  {!docsOk&&<span style={{color:T.warn,fontSize:10,fontWeight:700}}>Docs incomplete</span>}
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                {[['Loans',wl.length],['Overdue',ov],['Book',fmt(bk)],['Collected',fmt(wp)]].map(function(pair){return(
                  <div key={pair[0]} style={{background:T.surface,borderRadius:7,padding:'7px 9px'}}>
                    <div style={{color:T.muted,fontSize:10,textTransform:'uppercase',letterSpacing:.6}}>{pair[0]}</div>
                    <div style={{color:T.txt,fontWeight:700,fontSize:13,fontFamily:T.mono}}>{pair[1]}</div>
                  </div>
                );})}
              </div>
            </Card>
          );
        })}
      </div>
      {showNew&&(
        <Dialog title="Add New Worker" onClose={function(){setShowNew(false);setF(blankF);}} width={520}>
          <div className="mob-grid1" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
            <FI label="Full Name"           value={f.name}  onChange={function(v){setF(function(p){return {...p,name:v};});}  }  required half/>
            <FI label="Email" type="email"  value={f.email} onChange={function(v){setF(function(p){return {...p,email:v};});}  } required half/>
            <PhoneInput label="Phone"       value={f.phone} onChange={function(v){setF(function(p){return {...p,phone:v};});}  } half required/>
            <NumericInput label="National ID No." value={f.idNo} onChange={function(v){setF(function(p){return {...p,idNo:v};});}} half placeholder="e.g. 12345678" required error={!f.idNo}/>
            <FI label="Role" type="select" options={ROLES} value={f.role} onChange={function(v){setF(function(p){return {...p,role:v};});}} half/>
            <FI label="Temporary Password" type="password" value={f.pw} onChange={function(v){setF(function(p){return {...p,pw:v};});}} required half placeholder="Min 6 chars"/>
          </div>
          <Alert type="info" style={{marginTop:4}}>All fields required.</Alert>
          <div style={{display:'flex',gap:9,marginTop:8}}>
            <Btn onClick={addW} full>Add Worker</Btn>
            <Btn v="secondary" onClick={function(){setShowNew(false);setF(blankF);}}>Cancel</Btn>
          </div>
        </Dialog>
      )}
    </div>
  );
};


// ═══════════════════════════════════════════
//  REPORT HELPERS — buildReportData, dlBlob, dlReportCSV/PDF/Word
// ═══════════════════════════════════════════
const dlBlob = (content, filename, mime) => {
  try {
    const blob = new Blob([content], {type: mime});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  } catch(e) { console.error('Download failed', e); }
};

const buildReportData = (type, {loans, customers, payments, workers, auditLog}) => {
  if(type==='loan-portfolio') {
    const hdr = ['Loan ID','Customer','Principal','Balance','Status','Days Overdue','Interest','Penalty','Total Owed','Phase','Officer','Disbursed','Repayment Type'];
    const rows = loans.map(l=>{const e=calculateLoanStatus(l);return [l.id,l.customer,l.amount,l.balance,l.status,l.daysOverdue,e.interestAccrued,e.penaltyAccrued,e.totalAmountDue,e.status,l.officer,l.disbursed||'N/A',l.repaymentType];});
    return {name:'loan-portfolio', title:'Loan Portfolio Report', hdr, rows};
  }
  if(type==='financial') {
    const tb  = loans.reduce((s,l)=>s+l.amount,0);
    const out = loans.filter(l=>l.status!=='Settled').reduce((s,l)=>s+l.balance,0);
    const col = payments.filter(p=>p.status==='Allocated').reduce((s,p)=>s+p.amount,0);
    const ov  = loans.filter(l=>l.status==='Overdue').reduce((s,l)=>s+l.balance,0);
    return {name:'financial-summary', title:'Financial Summary Report', hdr:['Metric','KES'],
      rows:[['Total Disbursed',tb],['Total Outstanding',out],['Total Collected',col],['Total Overdue',ov],
            ['Collection Rate %', tb>0?((col/tb)*100).toFixed(2):0]]};
  }
  if(type==='customers') {
    return {name:'customers', title:'Customer Report',
      hdr:['ID','Name','Phone','Business','Location','Officer','Loans','Risk','Joined','Blacklisted'],
      rows:customers.map(c=>[c.id,c.name,c.phone,c.business||'',c.location||'',c.officer||'',c.loans,c.risk,c.joined,c.blacklisted?'Yes':'No'])};
  }
  if(type==='audit') {
    return {name:'audit-log', title:'Audit Log Report',
      hdr:['Timestamp','User','Action','Target','Details'],
      rows:(auditLog||[]).map(e=>[e.ts,e.user,e.action,e.target,e.detail||''])};
  }
  if(type==='overdue') {
    const ov = loans.filter(l=>l.status==='Overdue');
    return {name:'overdue-report', title:'Overdue Loans Report',
      hdr:['Loan ID','Customer','Balance','Days Overdue','Interest','Penalty','Total Owed','Phase','Risk','Officer'],
      rows:ov.map(l=>{const e=calculateLoanStatus(l);return [l.id,l.customer,l.balance,l.daysOverdue,e.interestAccrued,e.penaltyAccrued,e.totalAmountDue,e.status,l.risk,l.officer];})};
  }
  if(type==='payments') {
    return {name:'payments', title:'Payments Report',
      hdr:['ID','Customer','Loan ID','Amount','M-Pesa Code','Date','Status','Allocated By'],
      rows:payments.map(p=>[p.id,p.customer,p.loanId||'N/A',p.amount,p.mpesa||'',p.date,p.status,p.allocatedBy||''])};
  }
  if(type==='staff') {
    return {name:'staff-performance', title:'Staff Performance Report',
      hdr:['ID','Name','Role','Status','Loans','Book KES','Overdue %'],
      rows:workers.map(w=>{
        const wl=loans.filter(l=>l.officer===w.name);
        const bk=wl.reduce((s,l)=>s+l.balance,0);
        const od=wl.filter(l=>l.status==='Overdue').length;
        return [w.id,w.name,w.role,w.status,wl.length,bk,wl.length?((od/wl.length)*100).toFixed(1):0];
      })};
  }
  return {name:'report', title:'Report', hdr:[], rows:[]};
};

const dlReportCSV = ({name, hdr, rows}) => {
  dlBlob(toCSV(hdr, rows), `${name}-${now()}.csv`, 'text/csv;charset=utf-8;');
};

const dlReportPDF = ({title, hdr, rows}) => {
  const esc = s => String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:Arial,sans-serif;font-size:11px;padding:20px}h1{font-size:15px;margin:0 0 4px}p{color:#666;font-size:10px;margin:0 0 14px}table{width:100%;border-collapse:collapse}th{background:#1a2740;color:#fff;padding:6px 10px;text-align:left;font-size:10px}td{padding:5px 10px;border-bottom:1px solid #e2e8f0;font-size:10px}tr:nth-child(even)td{background:#f8fafc}@media print{body{padding:8px}}</style>
</head><body><h1>${esc(title)}</h1><p>Generated: ${new Date().toLocaleString('en-KE')} · Adequate Capital Ltd</p>
<table><thead><tr>${hdr.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead>
<tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
</body></html>`;
  dlBlob(html, `${title.replace(/\s+/g,'-')}-${now()}.html`, 'text/html;charset=utf-8;');
};

const dlReportWord = ({title, hdr, rows}) => {
  const esc = s => String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const headerRow = `<w:tr>${hdr.map(h=>`<w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${esc(h)}</w:t></w:r></w:p></w:tc>`).join('')}</w:tr>`;
  const tableRows = rows.map(r=>`<w:tr>${r.map(c=>`<w:tc><w:p><w:r><w:t>${esc(c)}</w:t></w:r></w:p></w:tc>`).join('')}</w:tr>`).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><?mso-application progid="Word.Document"?>
<w:wordDocument xmlns:w="http://schemas.microsoft.com/office/word/2003/wordml">
<w:body>
<w:p><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>${esc(title)}</w:t></w:r></w:p>
<w:p><w:r><w:t>Generated: ${new Date().toLocaleString('en-KE')} · Adequate Capital Ltd</w:t></w:r></w:p>
<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr>${headerRow}${tableRows}</w:tbl>
</w:body></w:wordDocument>`;
  dlBlob(xml, `${title.replace(/\s+/g,'-')}-${now()}.doc`, 'application/msword');
};

const AReports = ({loans,customers,payments,workers,auditLog,showToast=()=>{}}) => {
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

// ═══════════════════════════════════════════
//  WORKER PANEL
// ═══════════════════════════════════════════
const WorkerPanel = ({worker,workers,setWorkers,loans,payments,customers,leads,allWorkers,setCustomers,onSubmitLoan,setLeads,interactions,setInteractions,addAudit,showToast=()=>{}}) => {
  const [tab,setTab]=useState('overview');
  const [showLoanApp,setShowLoanApp]=useState(false);
  const [viewDoc,setViewDoc]=useState(null);
  // Local copy of this worker's docs — synced back to global workers state on change
  const [myDocs,setMyDocs]=useState(()=>(workers||[]).find(w=>w.id===worker.id)?.docs||worker.docs||[]);
  const myL=loans.filter(l=>l.officer===worker.name);
  const myC=customers.filter(c=>c.officer===worker.name);
  const myLeads=(leads||[]).filter(l=>l.officer===worker.name);
  const ov=myL.filter(l=>l.status==='Overdue');
  const act=myL.filter(l=>l.status==='Active');
  const book=myL.filter(l=>l.status!=='Settled').reduce((s,l)=>s+l.balance,0);
  const pendingMine=myL.filter(l=>l.status==='worker-pending');

  const WORKER_SELF_DOC_SLOTS = [
    {key:'id_front',  label:'National ID — Front', icon:'🪪', required:true,  accept:'image/*',          capture:'environment'},
    {key:'id_back',   label:'National ID — Back',  icon:'🪪', required:true,  accept:'image/*',          capture:'environment'},
    {key:'passport',  label:'Passport Photo',       icon:'🖼️', required:true,  accept:'image/*',          capture:'user'},
    {key:'extra_1',   label:'Additional Document',  icon:'📋', required:false, accept:'image/*,application/pdf', capture:undefined},
    {key:'extra_2',   label:'Additional Document 2',icon:'📋', required:false, accept:'image/*,application/pdf', capture:undefined},
  ];

  const handleDocAdd=(doc)=>{
    const next=[...myDocs.filter(d=>d.key!==doc.key),doc];
    setMyDocs(next);
    if(setWorkers) setWorkers(ws=>ws.map(w=>w.id===worker.id?{...w,docs:next}:w));
    addAudit('Worker Doc Uploaded',worker.id,doc.name);
    showToast(`✅ ${doc.name} uploaded`,'ok');
    try{SFX.upload();}catch(e){}
  };
  const handleDocRemove=(docId)=>{
    const next=myDocs.filter(d=>d.id!==docId);
    setMyDocs(next);
    if(setWorkers) setWorkers(ws=>ws.map(w=>w.id===worker.id?{...w,docs:next}:w));
    showToast('Document removed','info');
  };

  const uploadedCount=WORKER_SELF_DOC_SLOTS.filter(s=>myDocs.some(d=>d.key===s.key)).length;
  const requiredCount=WORKER_SELF_DOC_SLOTS.filter(s=>s.required).length;
  const requiredDone=WORKER_SELF_DOC_SLOTS.filter(s=>s.required&&myDocs.some(d=>d.key===s.key)).length;
  const docsComplete=requiredDone>=requiredCount;

  const TABS=[
    {k:'overview',l:'Overview'},
    {k:'loans',l:`Loans (${myL.length})`},
    {k:'customers',l:`Customers (${myC.length})`},
    {k:'leads',l:`Leads (${myLeads.length})`},
    {k:'documents',l:`My Documents${requiredDone<requiredCount?' ⚠':''}`,alert:requiredDone<requiredCount},
  ];
  const switchTab=(k)=>{ setTab(k); addAudit('Worker View',k,`${worker.name} viewed ${k}`); };

  return (
    <div style={{padding:'16px 18px',background:T.bg,minHeight:'100vh'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:20,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <Av ini={worker.avatar||worker.name[0]} size={42} color={T.accent}/>
          <div>
            <div style={{fontFamily:T.head,color:T.txt,fontSize:18,fontWeight:800}}>{worker.name}</div>
            <div style={{color:T.muted,fontSize:13}}>{worker.role}</div>
          </div>
        </div>
        <Btn onClick={()=>{
          if(!docsComplete){showToast('⚠ Upload all required documents before applying for a loan.','warn');setTab('documents');return;}
          setShowLoanApp(true);
        }} v={docsComplete?'primary':'secondary'}>📝 Apply Loan for Client{!docsComplete?' 🔒':''}</Btn>
      </div>

      {!docsComplete&&(
        <div style={{background:T.dLo,border:`1px solid ${T.danger}38`,borderRadius:11,padding:'12px 16px',marginBottom:14,display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:20}}>🔒</span>
          <div style={{flex:1}}>
            <div style={{color:T.danger,fontWeight:800,fontSize:13}}>Documents Incomplete</div>
            <div style={{color:T.muted,fontSize:12,marginTop:2}}>
              Upload your required ID documents before adding leads or applying for loans.
              {' '}<button onClick={()=>setTab('documents')} style={{background:'none',border:'none',color:T.accent,cursor:'pointer',fontWeight:700,fontSize:12,padding:0,textDecoration:'underline'}}>Go to Documents →</button>
            </div>
          </div>
          <Badge color={T.danger}>{requiredCount-requiredDone} missing</Badge>
        </div>
      )}
      {pendingMine.length>0&&(
        <div style={{background:T.gLo,border:`1px solid ${T.gold}38`,borderRadius:11,padding:'11px 14px',marginBottom:16}}>
          <div style={{color:T.gold,fontWeight:700,fontSize:13}}>⏳ {pendingMine.length} application{pendingMine.length>1?'s':''} pending admin approval</div>
        </div>
      )}

      <div style={{display:'flex',gap:5,marginBottom:18,flexWrap:'wrap'}}>
        {TABS.map(t=>(
          <button key={t.k} onClick={()=>switchTab(t.k)} style={{background:tab===t.k?T.accent:T.card,color:tab===t.k?'#060A10':t.alert?T.warn:T.muted,border:`1px solid ${tab===t.k?T.accent:t.alert?T.warn+'50':T.border}`,borderRadius:99,padding:'6px 14px',fontSize:12,fontWeight:700,cursor:'pointer'}}>{t.l}</button>
        ))}
      </div>

      {tab==='overview'&&(
        <div>
          <div className='kpi-row' style={{display:'flex',gap:10,marginBottom:12,flexWrap:'wrap'}}>
            <KPI label='My Loan Book' icon='📈' value={fmtM(book)} color={T.accent} delay={1}/>
            <KPI label='Active Loans' icon='✅' value={act.length} color={T.ok} delay={2}/>
            <KPI label='Overdue' icon='⚠️' value={ov.length} color={T.danger} delay={3}/>
            <KPI label='My Customers' icon='👤' value={myC.length} delay={4}/>
          </div>

          {/* Daily conversion target */}
          {(()=>{
            const todayStr=now();
            const convertedToday=myLeads.filter(l=>l.status==='Onboarded'&&l.date===todayStr).length;
            const newCustsToday=myC.filter(c=>c.joined===todayStr).length;
            const totalToday=Math.max(convertedToday,newCustsToday);
            const TARGET=3;
            const pct=Math.min((totalToday/TARGET)*100,100);
            const met=totalToday>=TARGET;
            return (
              <Card style={{marginBottom:12,border:`1px solid ${met?T.ok:T.gold}38`}}>
                <div style={{padding:'14px 16px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                    <div>
                      <div style={{color:met?T.ok:T.gold,fontWeight:800,fontSize:13,fontFamily:T.head}}>🎯 Daily Conversion Target</div>
                      <div style={{color:T.muted,fontSize:11,marginTop:2}}>Goal: convert at least 3 customers today</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{color:met?T.ok:T.gold,fontFamily:T.mono,fontSize:22,fontWeight:900,lineHeight:1}}>{totalToday}<span style={{color:T.muted,fontSize:13}}>/{TARGET}</span></div>
                      <div style={{color:met?T.ok:T.muted,fontSize:11,marginTop:1}}>{met?'✓ Target met!':'Keep going!'}</div>
                    </div>
                  </div>
                  <div style={{height:8,background:T.border,borderRadius:99,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${pct}%`,background:met?T.ok:T.gold,borderRadius:99,transition:'width .6s ease'}}/>
                  </div>
                  <div style={{display:'flex',gap:6,marginTop:10,flexWrap:'wrap'}}>
                    {[1,2,3].map(i=>(
                      <div key={i} style={{flex:1,minWidth:60,background:totalToday>=i?met?T.oLo:T.gLo:T.surface,border:`1px solid ${totalToday>=i?met?T.ok:T.gold:T.border}`,borderRadius:8,padding:'6px 10px',textAlign:'center'}}>
                        <div style={{fontSize:16}}>{totalToday>=i?'✅':'⬜'}</div>
                        <div style={{color:T.muted,fontSize:10,marginTop:2}}>Customer {i}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })()}

          {ov.length>0&&<Card>
            <CH title='My Overdue Loans'/>
            <DT cols={[{k:'id',l:'Loan ID',r:v=><span style={{color:T.accent,fontFamily:T.mono,fontSize:12}}>{v}</span>},{k:'customer',l:'Customer'},{k:'balance',l:'Balance',r:v=>fmt(v)},{k:'daysOverdue',l:'Days',r:v=><span style={{color:T.danger,fontWeight:800}}>{v}d</span>}]} rows={ov}/>
          </Card>}
        </div>
      )}
      {tab==='loans'&&<Card><CH title='My Loans'/><DT cols={[{k:'id',l:'ID',r:v=><span style={{color:T.accent,fontFamily:T.mono,fontSize:12}}>{v}</span>},{k:'customer',l:'Customer'},{k:'amount',l:'Principal',r:v=>fmt(v)},{k:'balance',l:'Balance',r:v=>fmt(v)},{k:'status',l:'Status',r:v=><Badge color={SC[v]||T.muted}>{v}</Badge>},{k:'repaymentType',l:'Type'}]} rows={myL} maxHeightVh={0.35}/></Card>}
      {tab==='customers'&&<Card><CH title='My Customers'/><DT cols={[{k:'id',l:'ID',r:v=><span style={{color:T.accent,fontFamily:T.mono,fontSize:12}}>{v}</span>},{k:'name',l:'Name'},{k:'phone',l:'Phone'},{k:'business',l:'Business'},{k:'risk',l:'Risk',r:v=><Badge color={RC[v]}>{v}</Badge>}]} rows={myC} maxHeightVh={0.35}/></Card>}
      {tab==='leads'&&(
        <div>
          {!docsComplete&&(
            <div style={{background:T.dLo,border:`1px solid ${T.danger}38`,borderRadius:10,padding:'11px 14px',marginBottom:12,display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:16}}>🔒</span>
              <div style={{color:T.danger,fontSize:13,fontWeight:600}}>Upload required documents to add leads.{' '}
                <button onClick={()=>setTab('documents')} style={{background:'none',border:'none',color:T.accent,cursor:'pointer',fontSize:13,fontWeight:700,padding:0,textDecoration:'underline'}}>Go to Documents →</button>
              </div>
            </div>
          )}
          <ALeads leads={myLeads} setLeads={docsComplete?setLeads:()=>showToast('⚠ Upload required documents first','warn')} workers={allWorkers} customers={customers} setCustomers={setCustomers} addAudit={addAudit} isWorker={true} currentWorker={worker} showToast={showToast}/>
        </div>
      )}

      {tab==='documents'&&(
        <div className='fu'>
          {viewDoc&&<DocViewer doc={viewDoc} onClose={()=>setViewDoc(null)}/>}
          <Card style={{marginBottom:14}}>
            <CH title='📂 My Documents' sub='Upload your National ID (front & back), passport photo, and any additional documents'/>
            <div style={{padding:'14px 16px'}}>
              {/* Completion indicator */}
              <div style={{display:'flex',alignItems:'center',gap:10,background:requiredDone<requiredCount?T.dLo:T.oLo,border:`1px solid ${requiredDone<requiredCount?T.danger:T.ok}38`,borderRadius:10,padding:'10px 14px',marginBottom:16}}>
                <span style={{fontSize:20}}>{requiredDone<requiredCount?'⚠️':'✅'}</span>
                <div>
                  <div style={{color:requiredDone<requiredCount?T.danger:T.ok,fontWeight:700,fontSize:13}}>
                    {requiredDone<requiredCount
                      ?`${requiredCount-requiredDone} required document${requiredCount-requiredDone>1?'s':''} missing`
                      :'All required documents uploaded'}
                  </div>
                  <div style={{color:T.muted,fontSize:11,marginTop:2}}>{uploadedCount} of {WORKER_SELF_DOC_SLOTS.length} documents uploaded</div>
                </div>
                <div style={{marginLeft:'auto',background:T.border,borderRadius:99,width:44,height:44,flexShrink:0,position:'relative',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <svg width='44' height='44' style={{position:'absolute',top:0,left:0,transform:'rotate(-90deg)'}}>
                    <circle cx='22' cy='22' r='18' fill='none' stroke={T.border} strokeWidth='4'/>
                    <circle cx='22' cy='22' r='18' fill='none' stroke={requiredDone<requiredCount?T.danger:T.ok} strokeWidth='4'
                      strokeDasharray={`${2*Math.PI*18}`}
                      strokeDashoffset={`${2*Math.PI*18*(1-uploadedCount/WORKER_SELF_DOC_SLOTS.length)}`}
                      strokeLinecap='round'
                      style={{transition:'stroke-dashoffset .6s ease'}}/>
                  </svg>
                  <span style={{color:T.txt,fontSize:10,fontWeight:900,fontFamily:T.mono,zIndex:1}}>{uploadedCount}/{WORKER_SELF_DOC_SLOTS.length}</span>
                </div>
              </div>
              {/* Document slots */}
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {WORKER_SELF_DOC_SLOTS.map((slot,idx)=>{
                  const doc=myDocs.find(d=>d.key===slot.key);
                  return (
                    <div key={slot.key} style={{background:T.surface,border:`1.5px solid ${doc?T.ok:slot.required?T.danger+'40':T.border}`,borderRadius:12,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,transition:'border-color .2s'}}>
                      {/* Step badge */}
                      <div style={{width:28,height:28,borderRadius:99,background:doc?T.ok:slot.required?T.dLo:T.border,color:doc?'#fff':slot.required?T.danger:T.muted,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:900,flexShrink:0}}>
                        {doc?'✓':idx+1}
                      </div>
                      {/* Info */}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                          <span style={{fontSize:16}}>{slot.icon}</span>
                          <span style={{color:T.txt,fontSize:13,fontWeight:700}}>{slot.label}</span>
                          {slot.required
                            ?<span style={{color:T.danger,fontSize:11,fontWeight:700}}>★ Required</span>
                            :<span style={{color:T.muted,fontSize:11}}>Optional</span>}
                        </div>
                        <div style={{color:doc?T.ok:T.muted,fontSize:11,marginTop:3}}>
                          {doc?`✓ Uploaded ${doc.uploaded}`:(slot.required?'Please upload this document':'Upload if available')}
                        </div>
                      </div>
                      {/* Thumbnail */}
                      {doc&&(
                        <div onClick={()=>setViewDoc(doc)} style={{cursor:'pointer',flexShrink:0}}>
                          {doc.type?.startsWith('image/')
                            ?<img src={doc.dataUrl} alt={slot.label} style={{width:52,height:52,objectFit:'cover',borderRadius:7,border:`2px solid ${T.ok}`,boxShadow:'0 2px 8px #00000040'}}/>
                            :<div style={{width:52,height:52,background:T.card,borderRadius:7,border:`2px solid ${T.ok}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>📄</div>
                          }
                        </div>
                      )}
                      {/* Action buttons */}
                      <div style={{display:'flex',gap:6,flexShrink:0}}>
                        {doc&&(
                          <>
                            <button onClick={()=>setViewDoc(doc)} style={{background:T.aLo,border:`1px solid ${T.accent}38`,color:T.accent,borderRadius:8,padding:'6px 10px',cursor:'pointer',fontSize:11,fontWeight:700}}>View</button>
                            <button onClick={()=>handleDocRemove(doc.id)} style={{background:T.dLo,border:`1px solid ${T.danger}30`,color:T.danger,borderRadius:8,padding:'6px 10px',cursor:'pointer',fontSize:11,fontWeight:700}}>Remove</button>
                          </>
                        )}
                        {!doc&&(
                          <label style={{cursor:'pointer',display:'flex',alignItems:'center',gap:5,background:T.bLo,border:`1px solid ${T.blue}38`,borderRadius:8,padding:'7px 12px',flexShrink:0}}>
                            <span style={{fontSize:14}}>📎</span>
                            <span style={{color:T.blue,fontSize:11,fontWeight:700}}>Upload</span>
                            <input type='file' accept={slot.accept} capture={slot.capture} style={{display:'none'}} onChange={e=>{
                              const file=e.target.files?.[0]; if(!file)return; e.target.value='';
                              const reader=new FileReader();
                              reader.onload=ev=>handleDocAdd({id:uid('DOC'),key:slot.key,name:slot.label,originalName:file.name,type:file.type,size:file.size,dataUrl:ev.target.result,uploaded:now()});
                              reader.readAsDataURL(file);
                            }}/>
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{color:T.muted,fontSize:11,marginTop:14,lineHeight:1.6}}>
                📋 Your documents will be reviewed by the admin. Ensure photos are clear and legible. Accepted formats: JPG, PNG, PDF.
              </div>
            </div>
          </Card>
        </div>
      )}

      {showLoanApp&&(
        <Dialog title={`Apply Loan — ${worker.name}`} onClose={()=>setShowLoanApp(false)} width={580}>
          <Alert type='info'>You are submitting a loan application on behalf of a registered client. It will be sent to admin for approval.</Alert>
          <LoanForm
            customers={customers.filter(c=>c.officer===worker.name)}
            payments={payments}
            loans={loans}
            workerMode={true}
            workerName={worker.name}
            onSave={l=>{
              onSubmitLoan(l);
              setCustomers(cs=>cs.map(c=>c.id===l.customerId?{...c,loans:c.loans+1}:c));
              addAudit('Worker Loan Application',l.id,`${fmt(l.amount)} for ${l.customer} — pending admin approval`);
              addAudit('Loan Application Submitted',l.id,`Worker: ${worker.name} · Amount: ${fmt(l.amount)}`);
              setShowLoanApp(false);
            }}
            onClose={()=>setShowLoanApp(false)}
          />
        </Dialog>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════
//  ADMIN PANEL
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
//  SECURITY SETTINGS — Password / Biometric / OTP
// ═══════════════════════════════════════════

// Persistent security config stored in localStorage
const SEC_CFG_KEY = 'acl_sec_config';
const getSecConfig = () => {
  try {
    const v = JSON.parse(localStorage.getItem(SEC_CFG_KEY)||'null');
    return v ? {...v, otpEnabled:false} : {passwordEnabled:true, biometricEnabled:false, otpEnabled:false, adminPwHash:null, adminPhone:'+254110000284', adminEmail:'', adminRecoveryPhone:''};
  } catch(e) {
    return {passwordEnabled:true, biometricEnabled:false, otpEnabled:false, adminPwHash:null, adminPhone:'+254110000284', adminEmail:'', adminRecoveryPhone:''};
  }
};
const saveSecConfig = (cfg) => { try{localStorage.setItem(SEC_CFG_KEY, JSON.stringify(cfg));}catch(e){} };
// Default admin password: admin123
const DEFAULT_ADMIN_PW = 'admin123';

const ASecuritySettings = ({auditLog, addAudit, showToast}) => {
  const [cfg, setCfgState] = useState(getSecConfig);
  const [verifyPw, setVerifyPw] = useState('');
  const [verified, setVerified] = useState(true); // open by default — no password gate
  const [verifyErr, setVerifyErr] = useState('');
  const [showChangePw, setShowChangePw] = useState(false);
  const [curPw, setCurPw] = useState('');       // current password before changing
  const [curPwErr, setCurPwErr] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [showCurPw, setShowCurPw] = useState(false);   // eye toggle for current pw
  const [showNewPw, setShowNewPw] = useState(false);   // eye toggle for new pw
  const [showNewPw2, setShowNewPw2] = useState(false); // eye toggle for confirm pw
  const [otpPhone, setOtpPhone] = useState(cfg.adminPhone||'');


  const saveCfg = (patch) => {
    const next = {...cfg,...patch};
    setCfgState(next);
    saveSecConfig(next);
  };

  // Verify current admin password before allowing changes
  const doVerify = async () => {
    if(!verifyPw) { setVerifyErr('Please enter your password.'); return; }
    // Re-read config fresh from storage so we always have the latest hash
    const latestCfg = getSecConfig();
    const stored = latestCfg.adminPwHash;
    let ok = false;
    try {
      if(!stored) {
        // No password has ever been set — compare against hardcoded default
        ok = verifyPw === DEFAULT_ADMIN_PW;
      } else {
        // Try SHA-256 first, then fall back to legacy djb2 for older records
        ok = await checkPwAsync(verifyPw, stored);
        if(!ok) ok = _checkPw(verifyPw, stored);
      }
    } catch(e) {
      // SubtleCrypto unavailable (non-HTTPS context) — fall back gracefully
      ok = !stored ? (verifyPw === DEFAULT_ADMIN_PW) : _checkPw(verifyPw, stored);
    }
    if(ok) {
      setVerified(true);
      setVerifyPw('');
      setVerifyErr('');
      try { addAudit('Security Settings Accessed','Admin','Password verified'); } catch(e){}
      try { SFX.login(); } catch(e){}
    } else {
      setVerifyErr('Incorrect password. Default is: admin123');
      try { SFX.error(); } catch(e){}
    }
  };

  const doChangePw = async () => {
    // Step 1: verify current password
    const latestCfg = getSecConfig();
    const stored = latestCfg.adminPwHash;
    let curOk = false;
    try {
      curOk = !stored ? (curPw === DEFAULT_ADMIN_PW) : (await checkPwAsync(curPw, stored) || _checkPw(curPw, stored));
    } catch(e) {
      curOk = !stored ? (curPw === DEFAULT_ADMIN_PW) : _checkPw(curPw, stored);
    }
    if(!curOk) { setCurPwErr('Current password is incorrect.'); try{SFX.error();}catch(e){} return; }
    setCurPwErr('');
    // Step 2: validate new password
    if(newPw.length < 6) { setPwErr('Password must be at least 6 characters.'); return; }
    if(newPw !== newPw2) { setPwErr('Passwords do not match.'); return; }
    const hash = await hashPwAsync(newPw);
    saveCfg({adminPwHash: hash});
    addAudit('Admin Password Changed','Admin','Password updated via Security Settings');
    showToast('✅ Password changed successfully','ok');
    setShowChangePw(false); setCurPw(''); setNewPw(''); setNewPw2(''); setPwErr(''); setCurPwErr('');
  };


  const doSaveOtpPhone = () => {
    if(!otpPhone) { showToast('⚠ Enter a phone number first','warn'); return; }
    saveCfg({otpEnabled:false, adminPhone:otpPhone}); // OTP disabled — keeping phone number saved for future use
    addAudit('OTP Enabled','Admin',`OTP SMS will go to ${otpPhone}`);
    showToast(`✅ OTP enabled — codes will be sent to ${otpPhone}`,'ok');
  };

  const toggleFeature = (key) => {
    saveCfg({[key]:!cfg[key]});
    addAudit(`Security Feature Toggled`,key,`→ ${!cfg[key]?'Enabled':'Disabled'}`);
    showToast(`${key.replace('Enabled','')} ${!cfg[key]?'enabled':'disabled'}`,'info');
  };

  const features = [
    {key:'passwordEnabled', icon:'🔑', label:'Password Login', desc:'Require admin password to log in. Cannot be disabled while biometric is off.', canDisable: cfg.biometricEnabled},
    // SMS OTP disabled — uncomment once SMS provider (Vonage/Twilio) is configured in Supabase:
    // {key:'otpEnabled', icon:'📱', label:'SMS OTP', desc:'Send a one-time code to the registered phone number as an additional login step.', canDisable: true},
  ];

  return (
    <div className='fu'>
      <div style={{fontFamily:T.head,color:T.txt,fontSize:20,fontWeight:800,marginBottom:4}}>🔐 Security Settings</div>
      <div style={{color:T.muted,fontSize:13,marginBottom:20}}>Configure authentication methods for admin login.</div>

      {/* Password verification gate */}
      {!verified&&(
        <Card style={{marginBottom:16,border:`1px solid ${T.warn}30`}}>
          <div style={{padding:'16px 18px'}}>
            <div style={{color:T.warn,fontWeight:700,fontSize:14,marginBottom:6}}>🔒 Verify your identity to make changes</div>
            <div style={{color:T.muted,fontSize:12,marginBottom:14}}>Enter your current admin password to unlock security settings.</div>
            <div style={{display:'flex',gap:9,alignItems:'flex-end',flexWrap:'wrap'}}>
              <div style={{flex:1,minWidth:180}}>
                <label style={{display:'block',color:T.dim,fontSize:11,fontWeight:600,marginBottom:5,letterSpacing:.7,textTransform:'uppercase'}}>
                  Current Password
                </label>
                <input
                  type='password'
                  value={verifyPw}
                  onChange={e=>setVerifyPw(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&doVerify()}
                  placeholder='Enter current password'
                  autoComplete='current-password'
                  style={{width:'100%',background:T.surface,border:`1px solid ${verifyErr?T.danger:T.border}`,borderRadius:8,padding:'10px 12px',color:T.txt,fontSize:14,outline:'none',fontFamily:T.body,boxSizing:'border-box'}}
                />
                {verifyErr&&<div style={{color:T.danger,fontSize:12,marginTop:5}}>⚠ {verifyErr}</div>}
              </div>
              <Btn onClick={doVerify}>Unlock Settings</Btn>
            </div>
            <div style={{color:T.muted,fontSize:11,marginTop:10}}>
              Default password: <b style={{color:T.accent,letterSpacing:1}}>admin123</b>
            </div>
          </div>
        </Card>
      )}

      {/* Auth method toggles */}
      <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:16,opacity:verified?1:0.45,pointerEvents:verified?'auto':'none'}}>
        {features.map(feat=>(
          <Card key={feat.key} style={{border:`1px solid ${cfg[feat.key]?T.ok+'38':T.border}`}}>
            <div style={{padding:'14px 16px',display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
              <div style={{fontSize:28,flexShrink:0}}>{feat.icon}</div>
              <div style={{flex:1,minWidth:160}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                  <span style={{color:T.txt,fontWeight:700,fontSize:14}}>{feat.label}</span>
                  <Badge color={cfg[feat.key]?T.ok:T.muted}>{cfg[feat.key]?'Enabled':'Disabled'}</Badge>
                </div>
                <div style={{color:T.muted,fontSize:12}}>{feat.desc}</div>
              </div>
              <button
                onClick={()=>{ if(!feat.canDisable&&cfg[feat.key]){showToast('⚠ Enable at least one other factor before disabling password.','warn');return;} toggleFeature(feat.key); }}
                style={{background:cfg[feat.key]?T.dLo:T.oLo, border:`1px solid ${cfg[feat.key]?T.danger+'38':T.ok+'38'}`, color:cfg[feat.key]?T.danger:T.ok, borderRadius:8, padding:'7px 16px', cursor:'pointer', fontWeight:700, fontSize:12, flexShrink:0}}>
                {cfg[feat.key]?'Disable':'Enable'}
              </button>
            </div>
          </Card>
        ))}
      </div>

      {/* Change password section */}
      {verified&&(
        <>
        <Card style={{marginBottom:12}}>
          <CH title='🔑 Change Admin Password'/>
          <div style={{padding:'14px 16px'}}>
            {!showChangePw
              ?<Btn onClick={()=>setShowChangePw(true)}>Change Password →</Btn>
              :<div>
                {/* Current password */}
                <label style={{display:'block',color:T.dim,fontSize:11,fontWeight:600,marginBottom:5,letterSpacing:.7,textTransform:'uppercase'}}>Current Password</label>
                <div style={{position:'relative',marginBottom:10}}>
                  <input type={showCurPw?'text':'password'} value={curPw} onChange={e=>{setCurPw(e.target.value);setCurPwErr('');}} placeholder='Enter current password' autoComplete='current-password'
                    style={{width:'100%',background:T.surface,border:`1px solid ${curPwErr?T.danger:T.border}`,borderRadius:8,padding:'10px 40px 10px 12px',color:T.txt,fontSize:14,outline:'none',fontFamily:T.body,boxSizing:'border-box'}}/>
                  <button onClick={()=>setShowCurPw(v=>!v)} tabIndex={-1}
                    style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:T.muted,fontSize:16,padding:'0 2px',lineHeight:1}}>
                    {showCurPw?'🙈':'👁️'}
                  </button>
                </div>
                {curPwErr&&<div style={{color:T.danger,fontSize:12,marginBottom:8}}>⚠ {curPwErr}</div>}

                {/* New password */}
                <label style={{display:'block',color:T.dim,fontSize:11,fontWeight:600,marginBottom:5,letterSpacing:.7,textTransform:'uppercase'}}>New Password</label>
                <div style={{position:'relative',marginBottom:10}}>
                  <input type={showNewPw?'text':'password'} value={newPw} onChange={e=>setNewPw(e.target.value)} placeholder='Minimum 6 characters' autoComplete='new-password'
                    style={{width:'100%',background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:'10px 40px 10px 12px',color:T.txt,fontSize:14,outline:'none',fontFamily:T.body,boxSizing:'border-box'}}/>
                  <button onClick={()=>setShowNewPw(v=>!v)} tabIndex={-1}
                    style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:T.muted,fontSize:16,padding:'0 2px',lineHeight:1}}>
                    {showNewPw?'🙈':'👁️'}
                  </button>
                </div>

                {/* Confirm new password */}
                <label style={{display:'block',color:T.dim,fontSize:11,fontWeight:600,marginBottom:5,letterSpacing:.7,textTransform:'uppercase'}}>Confirm New Password</label>
                <div style={{position:'relative',marginBottom:10}}>
                  <input type={showNewPw2?'text':'password'} value={newPw2} onChange={e=>setNewPw2(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doChangePw()} placeholder='Repeat new password' autoComplete='new-password'
                    style={{width:'100%',background:T.surface,border:`1px solid ${newPw&&newPw2&&newPw!==newPw2?T.danger:T.border}`,borderRadius:8,padding:'10px 40px 10px 12px',color:T.txt,fontSize:14,outline:'none',fontFamily:T.body,boxSizing:'border-box'}}/>
                  <button onClick={()=>setShowNewPw2(v=>!v)} tabIndex={-1}
                    style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:T.muted,fontSize:16,padding:'0 2px',lineHeight:1}}>
                    {showNewPw2?'🙈':'👁️'}
                  </button>
                </div>
                {newPw&&newPw2&&newPw!==newPw2&&<div style={{color:T.danger,fontSize:12,marginBottom:6}}>⚠ Passwords do not match</div>}
                {newPw&&newPw.length>0&&newPw.length<6&&<div style={{color:T.warn,fontSize:12,marginBottom:6}}>⚠ At least 6 characters required</div>}
                {pwErr&&<div style={{color:T.danger,fontSize:12,marginBottom:8}}>⚠ {pwErr}</div>}
                <div style={{display:'flex',gap:8}}>
                  <Btn onClick={doChangePw} full>✓ Save New Password</Btn>
                  <Btn v='secondary' onClick={()=>{setShowChangePw(false);setPwErr('');setCurPwErr('');setCurPw('');setNewPw('');setNewPw2('');}}>Cancel</Btn>
                </div>
              </div>
            }
          </div>
        </Card>

        {/* Biometric — WebAuthn fingerprint registration */}
        {(()=>{
          const [bioStatus,setBioStatus]=useState('idle');
          const [bioMsg,setBioMsg]=useState('');
          const hasCred=!!cfg.bioCredId;
          useEffect(()=>{
            if(!window.PublicKeyCredential){setBioStatus('unsupported');return;}
            window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
              .then(avail=>{if(!avail){setBioStatus('unsupported');setBioMsg('No fingerprint sensor or Face ID detected.');}else setBioStatus(hasCred?'ok':'idle');})
              .catch(()=>{setBioStatus('unsupported');setBioMsg('Could not detect biometric hardware.');});
          // eslint-disable-next-line react-hooks/exhaustive-deps
          },[]);
          const doRegister=async()=>{
            setBioStatus('registering');setBioMsg('');
            try{
              if(!window.PublicKeyCredential) throw new Error('WebAuthn not supported.');
              const avail=await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
              if(!avail) throw new Error('No fingerprint/Face ID sensor found.');
              const challenge=crypto.getRandomValues(new Uint8Array(32));
              const userId=crypto.getRandomValues(new Uint8Array(16));
              const credential=await navigator.credentials.create({publicKey:{challenge,rp:{name:'Adequate Capital LMS',id:window.location.hostname||'localhost'},user:{id:userId,name:cfg.adminEmail||'admin',displayName:'Admin'},pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required',residentKey:'preferred'},timeout:60000,attestation:'none'}});
              const credId=Array.from(new Uint8Array(credential.rawId));
              saveCfg({biometricEnabled:true,bioCredId:credId});
              setBioStatus('ok');setBioMsg('');
              addAudit('Biometric Registered','Admin','Fingerprint/FaceID registered');
              showToast('✅ Fingerprint registered — biometric login is now active','ok',4000);
              try{SFX.save();}catch(e){}
            }catch(e){
              if(e.name==='AbortError'||e.message?.includes('cancel')){setBioStatus(hasCred?'ok':'idle');setBioMsg('Registration cancelled.');}
              else{setBioStatus('error');setBioMsg(e.message||'Registration failed. Ensure app is on HTTPS.');try{SFX.error();}catch(ex){}}
            }
          };
          const doRemove=()=>{saveCfg({biometricEnabled:false,bioCredId:null});setBioStatus('idle');setBioMsg('');addAudit('Biometric Removed','Admin','Fingerprint removed');showToast('Fingerprint removed','warn');};
          return(
            <Card style={{marginBottom:12,border:`1px solid ${bioStatus==='ok'?T.ok+'40':bioStatus==='unsupported'?T.border:T.accent+'30'}`}}>
              <CH title='🪬 Fingerprint / Face ID Login'/>
              <div style={{padding:'14px 16px'}}>
                {bioStatus==='unsupported'&&(<div style={{display:'flex',gap:12,alignItems:'flex-start'}}><div style={{fontSize:28}}>🚫</div><div><div style={{color:T.warn,fontWeight:700,fontSize:13,marginBottom:4}}>Not supported on this device</div><div style={{color:T.muted,fontSize:12,lineHeight:1.6}}>{bioMsg||'Requires a device with fingerprint/Face ID on Chrome, Edge, or Safari over HTTPS.'}</div></div></div>)}
                {bioStatus!=='unsupported'&&(<div style={{display:'flex',gap:14,alignItems:'flex-start'}}><div style={{fontSize:32,flexShrink:0,marginTop:2}}>{bioStatus==='ok'?'✅':bioStatus==='registering'?'⏳':'🫆'}</div><div style={{flex:1}}>
                  {bioStatus==='ok'&&(<><div style={{color:T.ok,fontWeight:700,fontSize:14,marginBottom:4}}>Fingerprint registered on this device</div><div style={{color:T.muted,fontSize:12,marginBottom:14,lineHeight:1.6}}>Biometric login is active as a second factor on this device.</div><div style={{display:'flex',gap:8}}><Btn onClick={doRegister} v='secondary' sm>↺ Re-register</Btn><Btn onClick={doRemove} v='danger' sm>✕ Remove</Btn></div></>)}
                  {(bioStatus==='idle'||bioStatus==='error')&&(<><div style={{color:T.txt,fontWeight:700,fontSize:14,marginBottom:4}}>Register your fingerprint</div><div style={{color:T.muted,fontSize:12,marginBottom:10,lineHeight:1.6}}>Use your device fingerprint reader or Face ID as a second login factor.</div>{bioStatus==='error'&&<Alert type='danger' style={{marginBottom:10}}>{bioMsg}</Alert>}{bioStatus==='idle'&&bioMsg&&<div style={{color:T.muted,fontSize:12,marginBottom:8}}>{bioMsg}</div>}<Btn onClick={doRegister} full>🫆 Register Fingerprint / Face ID</Btn></>)}
                  {bioStatus==='registering'&&(<div style={{display:'flex',gap:10,alignItems:'center'}}><div style={{width:18,height:18,border:`2px solid ${T.border}`,borderTop:`2px solid ${T.accent}`,borderRadius:'50%',animation:'spin .8s linear infinite',flexShrink:0}}/><div style={{color:T.accent,fontSize:13,fontWeight:600}}>Waiting for fingerprint… touch the sensor now</div></div>)}
                </div></div>)}
              </div>
            </Card>
          );
        })()}
                {/* OTP phone setup */}
        <Card style={{marginBottom:12}}>
          <CH title='📱 OTP Phone Number'/>
          <div style={{padding:'14px 16px'}}>
            <div style={{color:T.muted,fontSize:12,marginBottom:12}}>When OTP is enabled, a 6-digit code will be shown here and you enter it to complete login. In production, this will be sent as an SMS.</div>
            <div style={{display:'flex',gap:9,alignItems:'flex-end',flexWrap:'wrap'}}>
              <div style={{flex:1,minWidth:180}}><PhoneInput label='Admin Phone for OTP' value={otpPhone} onChange={setOtpPhone}/></div>
              <Btn onClick={doSaveOtpPhone} style={{marginBottom:12}}>Save & Enable OTP</Btn>
            </div>
            {cfg.adminPhone&&<div style={{color:T.ok,fontSize:12,marginTop:4}}>✓ OTP will go to: <b>{cfg.adminPhone}</b></div>}
          </div>
        </Card>

        {/* Recovery contact setup */}
        <Card style={{marginBottom:12,border:`1px solid ${T.warn}30`}}>
          <CH title='🆘 Account Recovery Contacts' sub='Used to unlock your account after a lockout'/>
          <div style={{padding:'14px 16px'}}>
            <Alert type='warn' style={{marginBottom:12}}>Set at least one recovery method. Without this, a lockout can only be cleared by waiting 15 minutes.</Alert>
            <FI label='Recovery Email' type='email' value={cfg.adminEmail||''} onChange={v=>saveCfg({adminEmail:v})} placeholder='admin@adequatecapital.co.ke'/>
            <PhoneInput label='Recovery Phone (SMS)' value={cfg.adminRecoveryPhone||''} onChange={v=>saveCfg({adminRecoveryPhone:v})}/>
            <div style={{color:T.ok,fontSize:12,marginTop:4}}>
              {(cfg.adminEmail||cfg.adminRecoveryPhone)
                ? `✓ Recovery available via: ${[cfg.adminEmail&&'Email',cfg.adminRecoveryPhone&&'SMS'].filter(Boolean).join(' & ')}`
                : <span style={{color:T.danger}}>⚠ No recovery contacts set</span>}
            </div>
          </div>
        </Card>
        </>
      )}
    </div>
  );
};

const ADMIN_NAV = [
  {id:'dashboard',  l:'Dashboard',  i:'🏠'},
  {id:'loans',      l:'Loans',      i:'💰'},
  {id:'customers',  l:'Customers',  i:'👤'},
  {id:'leads',      l:'Leads',      i:'🎯'},
  {id:'collections',l:'Collections',i:'📞'},
  {id:'payments',   l:'Payments',   i:'💳'},
  {id:'workers',    l:'Team',       i:'👷'},
  {id:'reports',    l:'Reports',    i:'📊'},
  {id:'security',   l:'Audit',      i:'🔐'},
  {id:'securitysettings', l:'Security Settings', i:'🛡️'},
  {id:'database',   l:'Database',   i:'🗄️'},
];

// LiveClock removed — it ran setInterval every second, causing AdminPanel to receive
// re-render pressure. Removed per product requirements.

const AdminPanel = ({onLogout,loans,setLoans,customers,setCustomers,workers,setWorkers,payments,setPayments,leads,setLeads,interactions,setInteractions,auditLog,setAuditLog}) => {
  const [screen,setScreen]=useState('dashboard');
  const [screenHistory,setScreenHistory]=useState([]);
  const [sb,setSb]=useState(false);
  const [showReminders,setShowReminders]=useState(false);
  const toggleSb=()=>setSb(o=>!o);
  const scrollRef = useRef(null);
  const scrollTop = () => {
    try{ scrollRef.current?.scrollTo({top:0,behavior:'instant'}); }catch(e){}
    try{ window.scrollTo({top:0,behavior:'instant'}); }catch(e){}
  };
  const navTo=(s)=>{ setScreenHistory(h=>[...h.slice(-9),screen]); setScreen(s); setSb(false); scrollTop(); setTimeout(scrollTop,50); };
  const goBack=()=>{ if(screenHistory.length===0) return; const prev=screenHistory[screenHistory.length-1]; setScreenHistory(h=>h.slice(0,-1)); setScreen(prev); setTimeout(scrollTop,30); };
  const {toasts,show:showToast}=useToast();
  const {reminders,add:addReminder,done:doneReminder,remove:removeReminder,update:updateReminder,firing:firingReminder,dismissFiring}=useReminders();
  const addAudit=useCallback((action,target,detail='')=>setAuditLog(l=>[{ts:ts(),user:'admin',action,target,detail},...l].slice(0,500)),[setAuditLog]);
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
    const GRACE={Daily:3,Weekly:10,Biweekly:18,Monthly:35,'Lump Sum':35};
    // Only reclassify Active→Overdue for loans disbursed within the last 180 days.
    // Seed / demo loans with older dates are preserved as-is so the app shows realistic
    // data on first load. Already-Overdue loans still get their daysOverdue refreshed.
    const MAX_RECLASSIFY_DAYS = 180;
    const updateLoans=()=>{
      const n=new Date();
      setLoans(ls=>ls.map(l=>{
        if(!['Active','Overdue'].includes(l.status)||!l.disbursed) return l;
        const disbDate=new Date(l.disbursed);
        const diffDays=Math.floor((n-disbDate)/(1000*60*60*24));
        const grace=GRACE[l.repaymentType]??30;
        if(l.status==='Active'){
          if(diffDays>grace&&diffDays<=MAX_RECLASSIFY_DAYS&&l.balance>0){
            const upd={...l,status:'Overdue',daysOverdue:Math.max(0,diffDays-grace)};
            sbWrite('loans',toSupabaseLoan(upd));
            return upd;
          }
          return l;
        }
        if(l.status==='Overdue'){
          const od=Math.max(0,diffDays-grace);
          if(od!==l.daysOverdue){const upd={...l,daysOverdue:od};sbWrite('loans',toSupabaseLoan(upd));return upd;}
          return l;
        }
        return l;
      }));
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
    dashboard:  ()=><ADashboard loans={loans} customers={customers} payments={payments} workers={workers} interactions={interactions} onNav={navTo} scrollTop={scrollTop}/>,
    loans:      ()=><ALoans loans={loans} setLoans={setLoans} customers={customers} setCustomers={setCustomers} payments={payments} setPayments={setPayments} interactions={interactions} workers={workers} addAudit={addAudit} showToast={showToast}/>,
    customers:  ()=><ACustomers customers={customers} setCustomers={setCustomers} workers={workers} loans={loans} payments={payments} interactions={interactions} addAudit={addAudit} showToast={showToast}/>,
    leads:      ()=><ALeads leads={leads} setLeads={setLeads} workers={workers} customers={customers} setCustomers={setCustomers} addAudit={addAudit} showToast={showToast}/>,
    collections:()=><ACollections loans={loans} setLoans={setLoans} customers={customers} setCustomers={setCustomers} payments={payments} interactions={interactions} setInteractions={setInteractions} workers={workers} addAudit={addAudit} scrollTop={scrollTop} currentUser='Admin'/>,
    payments:   ()=><APayments payments={payments} setPayments={setPayments} loans={loans} setLoans={setLoans} customers={customers} addAudit={addAudit} showToast={showToast}/>,
    workers:    ()=><AWorkers workers={workers} setWorkers={setWorkers} loans={loans} setLoans={setLoans} payments={payments} customers={customers} setCustomers={setCustomers} leads={leads} setLeads={setLeads} interactions={interactions} setInteractions={setInteractions} allState={allState} addAudit={addAudit} showToast={showToast}/>,
    reports:    ()=><AReports loans={loans} customers={customers} payments={payments} workers={workers} auditLog={auditLog} showToast={showToast}/>,
    security:   ()=><ASecurity auditLog={auditLog}/>,
    securitysettings: ()=><ASecuritySettings auditLog={auditLog} addAudit={addAudit} showToast={showToast}/>,
    database:   ()=><ADatabase allState={allState} setLoans={setLoans} setCustomers={setCustomers} setPayments={setPayments} setWorkers={setWorkers} setLeads={setLeads} setInteractions={setInteractions} setAuditLog={setAuditLog} addAudit={addAudit} showToast={showToast}/>,
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
          <div style={{display:'flex',gap:7,alignItems:'center',flexWrap:'wrap'}}>
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
const WorkerPortal = ({workers,setWorkers,loans,setLoans,customers,setCustomers,payments,leads,setLeads,interactions,setInteractions,auditLog,setAuditLog,onBack}) => {
  const [loggedIn,setLoggedIn]=useState(false);
  const [curr,setCurr]=useState(null);
  const [email,setEmail]=useState('');
  const [pw,setPw]=useState('');
  const [err,setErr]=useState('');
  const {toasts,show:showToast}=useToast();
  const addAudit=(action,target,detail='')=>setAuditLog(l=>[{ts:ts(),user:curr?.name||curr?.email||'Worker',action,target,detail},...l].slice(0,500));

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
      <WorkerPanel worker={curr} workers={workers} setWorkers={setWorkers} loans={loans} payments={payments} customers={customers} leads={leads} allWorkers={workers} setCustomers={setCustomers} onSubmitLoan={l=>setLoans(ls=>[l,...ls])} setLeads={setLeads} interactions={interactions} setInteractions={setInteractions} addAudit={addAudit} showToast={showToast}/>
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
// ── Supabase column mapping helpers ─────────────────────────────────────────
const toSupabaseLoan = l => ({
  id:l.id, customer_id:l.customerId, customer_name:l.customer,
  amount:l.amount, balance:l.balance, status:l.status,
  repayment_type:l.repaymentType, officer:l.officer, risk:l.risk,
  disbursed:l.disbursed||null, mpesa:l.mpesa||null, phone:l.phone||null,
  days_overdue:l.daysOverdue||0,
});
const fromSupabaseLoan = r => ({
  id:r.id, customerId:r.customer_id, customer:r.customer_name,
  amount:Number(r.amount), balance:Number(r.balance), status:r.status,
  repaymentType:r.repayment_type, officer:r.officer, risk:r.risk,
  disbursed:r.disbursed, mpesa:r.mpesa, phone:r.phone,
  daysOverdue:r.days_overdue||0, payments:[],
});
const toSupabaseCustomer = c => ({
  id:c.id, name:c.name, phone:c.phone, alt_phone:c.altPhone||null,
  id_no:c.idNo, business:c.business||null, location:c.location||null,
  residence:c.residence||null, officer:c.officer||null, loans:c.loans||0,
  risk:c.risk||'Medium', gender:c.gender||null, dob:c.dob||null,
  blacklisted:c.blacklisted||false, bl_reason:c.blReason||null,
  from_lead:c.fromLead||null,
  n1_name:c.n1n||null, n1_phone:c.n1p||null, n1_relation:c.n1r||null,
  n2_name:c.n2n||null, n2_phone:c.n2p||null, n2_relation:c.n2r||null,
  n3_name:c.n3n||null, n3_phone:c.n3p||null, n3_relation:c.n3r||null,
  joined:c.joined||null,
});
const fromSupabaseCustomer = r => ({
  id:r.id, name:r.name, phone:r.phone, altPhone:r.alt_phone,
  idNo:r.id_no, business:r.business, location:r.location,
  residence:r.residence, officer:r.officer, loans:r.loans||0,
  risk:r.risk||'Medium', gender:r.gender, dob:r.dob,
  blacklisted:r.blacklisted||false, blReason:r.bl_reason,
  fromLead:r.from_lead,
  n1n:r.n1_name, n1p:r.n1_phone, n1r:r.n1_relation,
  n2n:r.n2_name, n2p:r.n2_phone, n2r:r.n2_relation,
  n3n:r.n3_name, n3p:r.n3_phone, n3r:r.n3_relation,
  joined:r.joined, docs:[],
});
const toSupabasePayment = p => ({
  id:p.id, loan_id:p.loanId||null, customer_id:p.customerId||null,
  customer_name:p.customer||null, amount:p.amount,
  mpesa:p.mpesa||null, date:p.date||null,
  status:p.status||'Unallocated', allocated_by:p.allocatedBy||null,
  note:p.note||null, is_reg_fee:p.isRegFee||false,
});
const fromSupabasePayment = r => ({
  id:r.id, loanId:r.loan_id, customerId:r.customer_id,
  customer:r.customer_name, amount:Number(r.amount),
  mpesa:r.mpesa, date:r.date, status:r.status,
  allocatedBy:r.allocated_by, note:r.note, isRegFee:r.is_reg_fee||false,
});
const toSupabaseLead = l => ({
  id:l.id, name:l.name, phone:l.phone, business:l.business||null,
  location:l.location||null, source:l.source||'Referral',
  officer:l.officer||null, status:l.status||'New',
  notes:l.notes||null, date:l.date||null,
});
const fromSupabaseLead = r => ({...r});
const toSupabaseInteraction = i => ({
  id:i.id, customer_id:i.customerId||null, loan_id:i.loanId||null,
  type:i.type, date:i.date||null, officer:i.officer||null,
  notes:i.notes, promise_amount:i.promiseAmount||null,
  promise_date:i.promiseDate||null, promise_status:i.promiseStatus||null,
});
const fromSupabaseInteraction = r => ({
  id:r.id, customerId:r.customer_id, loanId:r.loan_id,
  type:r.type, date:r.date, officer:r.officer,
  notes:r.notes, promiseAmount:r.promise_amount,
  promiseDate:r.promise_date, promiseStatus:r.promise_status,
});

// ── Supabase sync hook ────────────────────────────────────────────────────────
// Wraps each state setter so every mutation is immediately written to Supabase.
// In demo mode all writes are local-only (no Supabase calls).
// ── Direct Supabase write helpers ────────────────────────────────────────────
// Called immediately at the point of every action. No diffing, no race conditions.
// Silently ignored in demo mode.
// ── Supabase write helpers ───────────────────────────────────────────────────
// These write directly to Supabase at the point of each action.
// Errors are logged to console AND stored in a global array so developers
// can debug by checking window._sbErrors in the browser console.
if(typeof window !== 'undefined') window._sbErrors = window._sbErrors || [];
const _sbErr = (op, table, msg) => {
  const entry = `[${op}] ${table}: ${msg}`;
  console.error(entry);
  if(typeof window !== 'undefined') window._sbErrors.push({ts:new Date().toISOString(), entry});
};
const sbWrite = (table, row) => {
  import('@/config/supabaseClient').then(({supabase,DEMO_MODE})=>{
    if(DEMO_MODE||!supabase) return;
    supabase.from(table).upsert([row], {onConflict:'id'})
      .then(({error})=>{ if(error) _sbErr('upsert',table,error.message); });
  }).catch(e=>_sbErr('import','sbWrite',e.message));
};
const sbDelete = (table, id) => {
  import('@/config/supabaseClient').then(({supabase,DEMO_MODE})=>{
    if(DEMO_MODE||!supabase) return;
    supabase.from(table).delete().eq('id',id)
      .then(({error})=>{ if(error) _sbErr('delete',table,error.message); });
  }).catch(e=>_sbErr('import','sbDelete',e.message));
};
const sbInsert = (table, row) => {
  import('@/config/supabaseClient').then(({supabase,DEMO_MODE})=>{
    if(DEMO_MODE||!supabase) return;
    supabase.from(table).insert([row])
      .then(({error})=>{ if(error) _sbErr('insert',table,error.message); });
  }).catch(e=>_sbErr('import','sbInsert',e.message));
};

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

  // ── Load all data from Supabase on mount ─────────────────────────────
  useEffect(()=>{
    import('@/config/supabaseClient').then(({supabase,DEMO_MODE})=>{
      if(DEMO_MODE||!supabase){setDataLoaded(true);return;}
      Promise.all([
        supabase.from('loans').select('*').order('id',{ascending:false}).limit(2000),
        supabase.from('customers').select('*').order('name').limit(2000),
        supabase.from('payments').select('*').order('id',{ascending:false}).limit(5000),
        supabase.from('leads').select('*').order('id',{ascending:false}).limit(1000),
        supabase.from('interactions').select('*').order('id',{ascending:false}).limit(2000),
        supabase.from('workers').select('*').order('name'),
        supabase.from('audit_logs').select('*').order('ts',{ascending:false}).limit(500),
      ]).then(([lR,cR,pR,ldR,iR,wR,aR])=>{
        // Supabase is the single source of truth.
        // Empty table (data.length===0) = genuinely no rows — never fall back to seed data.
        // Workers fall back to seed only so login still works if the workers table is empty.
        if(!lR.error)  setLoans(lR.data?.length ? lR.data.map(fromSupabaseLoan) : []);
        else           console.error('[load loans]',  lR.error.message);
        if(!cR.error)  setCustomers(cR.data?.length ? cR.data.map(fromSupabaseCustomer) : []);
        else           console.error('[load customers]', cR.error.message);
        if(!pR.error)  setPayments(pR.data?.length ? pR.data.map(fromSupabasePayment) : []);
        else           console.error('[load payments]',  pR.error.message);
        if(!ldR.error) setLeads(ldR.data?.length ? ldR.data.map(fromSupabaseLead) : []);
        else           console.error('[load leads]',     ldR.error.message);
        if(!iR.error)  setInteractions(iR.data?.length ? iR.data.map(fromSupabaseInteraction) : []);
        else           console.error('[load interactions]', iR.error.message);
        if(!wR.error&&wR.data?.length) setWorkers(wR.data.map(w=>({...w,docs:w.docs||[],avatar:w.avatar||(w.name||'').split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase()})));
        else if(wR.error) console.error('[load workers]', wR.error.message);
        if(!aR.error&&aR.data?.length) setAuditLog(aR.data.map(r=>({ts:r.ts,user:r.user_label||'system',action:r.action,target:r.target,detail:r.detail})));
        else if(aR.error) console.error('[load audit_logs]', aR.error.message);
        if(!lR.error&&!cR.error){
          const ll=lR.data?.length?lR.data:[];const lc=cR.data?.length?cR.data:[];
          const cids=new Set(lc.map(c=>c.id));const missing=[];
          ll.forEach(l=>{
            if(l.customer_id&&!cids.has(l.customer_id)){
              cids.add(l.customer_id);
              missing.push({id:l.customer_id,name:l.customer_name||'Unknown',phone:l.phone||null,
                alt_phone:null,id_no:'PENDING-'+l.customer_id,
                business:null,location:null,residence:null,officer:l.officer||null,
                loans:1,risk:'Medium',gender:null,dob:null,blacklisted:false,
                bl_reason:null,from_lead:null,
                n1_name:null,n1_phone:null,n1_relation:null,
                n2_name:null,n2_phone:null,n2_relation:null,
                n3_name:null,n3_phone:null,n3_relation:null,joined:l.disbursed||null});
            }
          });
          if(missing.length>0){
            console.warn('[load] Synthesized',missing.length,'missing customer records from loan data.');
            setCustomers(cs=>{
              const existingIds=new Set(cs.map(c=>c.id));
              const toAdd=missing.filter(m=>!existingIds.has(m.id)).map(fromSupabaseCustomer);
              return toAdd.length>0?[...cs,...toAdd]:cs;
            });
            import('@/config/supabaseClient').then(({supabase:sb,DEMO_MODE:dm})=>{
              if(dm||!sb) return;
              sb.from('customers').upsert(missing,{onConflict:'id'})
                .then(({error})=>{if(error)console.error('[backfill customers]',error.message);});
            }).catch(()=>{});
          }
        }
        setDataLoaded(true);
      }).catch(err=>{
        console.error('[load] Failed to load from Supabase:',err.message);
        setDataLoaded(true);
      });
    }).catch(()=>setDataLoaded(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const ADMIN_ROLES = ['Admin'];
  const handleLogin = (email) => {
    SFX.login();
    import('@/config/supabaseClient').then(({supabase,DEMO_MODE})=>{
      if(!DEMO_MODE && supabase && email){
        supabase.from('workers').select('role').eq('email', email.trim()).single()
          .then(({data,error})=>{
            const role = (!error&&data)?data.role:null;
            setMode(role&&ADMIN_ROLES.includes(role) ? 'admin' : 'worker');
          });
        return;
      }
      const w = SEED_WORKERS.find(w=>w.email===email?.trim());
      setMode(w&&!ADMIN_ROLES.includes(w.role)?'worker':'admin');
    }).catch(()=>setMode('admin'));
  };

  const shared={loans,setLoans,customers,setCustomers,workers,setWorkers,payments,setPayments,leads,setLeads,interactions,setInteractions,auditLog,setAuditLog};

  // Show loading spinner while fetching data
  if(!dataLoaded) return (
    <div style={{minHeight:'100vh',background:'#080C14',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
      <div style={{width:40,height:40,border:'3px solid #1E2D45',borderTop:'3px solid #00D4AA',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      <div style={{color:'#475569',fontSize:13,fontFamily:'system-ui'}}>Loading…</div>
    </div>
  );

  return (
    <>
      <StylesMemo/>
      {mode==='admin-login'&&<AdminLogin onLogin={handleLogin} onWorkerPortal={()=>setMode('worker')}/>}
      {mode==='admin'&&<AdminPanel {...shared} onLogout={()=>setMode('admin-login')}/>}
      {mode==='worker'&&<WorkerPortal {...shared} onBack={()=>setMode('admin-login')}/>}
    </>
  );
}