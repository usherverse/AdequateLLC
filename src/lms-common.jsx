import React, {
  useState,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  memo,
} from "react";
import {
  _hashPw,
  _checkPw,
  SEED_WORKERS,
  SEED_CUSTOMERS,
  SEED_LOANS,
  SEED_PAYMENTS,
  SEED_LEADS,
  SEED_INTERACTIONS,
  SEED_AUDIT,
} from "@/data/seedData";

export const SFX = (() => {
  let ctx = null;
  const getCtx = () => {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {}
    }
    if (ctx && ctx.state === "suspended") {
      try {
        ctx.resume();
      } catch (e) {}
    }
    return ctx;
  };
  // Suspend context when tab is hidden to stop burning the audio thread
  if (typeof document !== "undefined") {
    const _sfxVisHandler = () => {
      if (ctx) {
        try {
          document.hidden ? ctx.suspend() : ctx.resume();
        } catch (e) {}
      }
    };
    document.removeEventListener("visibilitychange", _sfxVisHandler);
    document.addEventListener("visibilitychange", _sfxVisHandler);
  }

  const play = (notes, masterVol = 0.18) => {
    const c = getCtx();
    if (!c) return;
    const master = c.createGain();
    master.gain.setValueAtTime(masterVol, c.currentTime);
    master.connect(c.destination);
    notes.forEach(
      ({
        freq,
        start,
        dur,
        vol = 1,
        type = "sine",
        attack = 0.01,
        decay = 0.12,
      }) => {
        const osc = c.createOscillator();
        const env = c.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, c.currentTime + start);
        env.gain.setValueAtTime(0, c.currentTime + start);
        env.gain.linearRampToValueAtTime(vol, c.currentTime + start + attack);
        env.gain.exponentialRampToValueAtTime(
          0.001,
          c.currentTime + start + dur,
        );
        osc.connect(env);
        env.connect(master);
        osc.start(c.currentTime + start);
        osc.stop(c.currentTime + start + dur + 0.05);
      },
    );
  };

  return {
    // Login success — warm ascending chime
    login: () =>
      play(
        [
          { freq: 523, start: 0, dur: 0.22 },
          { freq: 659, start: 0.1, dur: 0.22 },
          { freq: 784, start: 0.2, dur: 0.35 },
        ],
        0.14,
      ),
    // Save / confirm — single soft ding
    save: () =>
      play(
        [
          { freq: 880, start: 0, dur: 0.18, attack: 0.005 },
          { freq: 1047, start: 0.08, dur: 0.28 },
        ],
        0.12,
      ),
    // Notification / new item — two-note plink
    notify: () =>
      play(
        [
          { freq: 1047, start: 0, dur: 0.14, attack: 0.005 },
          { freq: 1319, start: 0.1, dur: 0.22 },
        ],
        0.1,
      ),
    // Download — descending whoosh
    download: () =>
      play(
        [
          { freq: 660, start: 0, dur: 0.12 },
          { freq: 550, start: 0.08, dur: 0.12 },
          { freq: 440, start: 0.16, dur: 0.2 },
        ],
        0.13,
      ),
    // Upload — ascending whoosh
    upload: () =>
      play(
        [
          { freq: 440, start: 0, dur: 0.12 },
          { freq: 550, start: 0.08, dur: 0.12 },
          { freq: 660, start: 0.16, dur: 0.2 },
        ],
        0.13,
      ),
    // Send message — pop
    send: () =>
      play(
        [
          { freq: 1175, start: 0, dur: 0.1, attack: 0.002 },
          { freq: 987, start: 0.08, dur: 0.18, type: "triangle" },
        ],
        0.11,
      ),
    // Warning / danger
    warn: () =>
      play(
        [
          { freq: 440, start: 0, dur: 0.18, type: "triangle" },
          { freq: 392, start: 0.16, dur: 0.28, type: "triangle" },
        ],
        0.15,
      ),
    // Reminder alarm — gentle repeating bell
    reminder: () => {
      const notes = [];
      for (let i = 0; i < 3; i++) {
        notes.push({
          freq: 1047,
          start: i * 0.5,
          dur: 0.4,
          attack: 0.005,
          vol: 0.9,
        });
        notes.push({
          freq: 784,
          start: i * 0.5 + 0.18,
          dur: 0.3,
          attack: 0.005,
          vol: 0.6,
        });
      }
      play(notes, 0.16);
    },
    // Error
    error: () =>
      play(
        [
          { freq: 220, start: 0, dur: 0.25, type: "sawtooth" },
          { freq: 196, start: 0.2, dur: 0.3, type: "sawtooth" },
        ],
        0.12,
      ),
  };
})();

// SFX-aware toast hook
export const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const setRef = useRef(setToasts); // ref is stable, no useEffect needed
  const show = useRef((msg, type = "ok", duration = 3000) => {
    const id = Date.now();
    setRef.current((t) => [...t, { id, msg, type }]);
    setTimeout(
      () => setRef.current((t) => t.filter((x) => x.id !== id)),
      duration,
    );
    if (type === "ok") SFX.save();
    else if (type === "danger") SFX.warn();
    else if (type === "warn") SFX.warn();
    else if (type === "info") SFX.notify();
  }).current;
  return { toasts, show };
};

export const Styles = () => (
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
    html,body{background:#080C14;font-family:-apple-system,BlinkMacSystemFont,'Inter','SF Pro Display','Helvetica Neue',Arial,sans-serif;min-height:100%;overflow-x:hidden;-webkit-font-smoothing:antialiased;scrollbar-gutter:stable}
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

      /* ── REPAYMENTS COMMAND CENTER MOBILE ── */
      .topbar-actions {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        width: 100%;
        gap: 8px !important;
      }
      .topbar-actions > button {
        height: 44px;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 13px !important;
      }
      .rcc-header {
        flex-direction: column !important;
        gap: 12px;
      }
      .rcc-summary-bar {
        grid-template-columns: repeat(4, 1fr) !important;
        gap: 8px !important;
      }
      .rcc-summary-bar > div {
        padding: 10px !important;
        text-align: center;
      }
      .rcc-summary-bar > div > div:first-child {
        font-size: 9px !important;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .rcc-summary-bar > div > div:nth-child(2) {
        font-size: 14px !important;
      }
      /* Fifth button drops down and spans full width */
      .rcc-summary-bar > div:nth-child(5) {
        grid-column: 1 / -1;
      }
      .rcc-calendar-grid {
        gap: 2px !important;
      }
      .rcc-calendar-grid > div {
        font-size: 10px !important;
      }
      .rcc-side-panel {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        max-height: 100% !important;
        z-index: 9999 !important;
        border-radius: 0 !important;
        border: none !important;
      }

    }
  `}</style>
);

export const T = {
  bg: "#080C14",
  surface: "#0D1117",
  card: "#111827",
  card2: "#141E2E",
  border: "#1A2740",
  hi: "#243550",
  accent: "#00D4AA",
  aLo: "#00D4AA12",
  aMid: "#00D4AA30",
  gold: "#F5C518",
  gLo: "#F5C51812",
  warn: "#F59E0B",
  wLo: "#F59E0B12",
  danger: "#EF4444",
  dLo: "#EF444412",
  ok: "#10B981",
  oLo: "#10B98112",
  blue: "#3B82F6",
  bLo: "#3B82F612",
  purple: "#8B5CF6",
  pLo: "#8B5CF612",
  txt: "#E2E8F0",
  dim: "#94A3B8",
  muted: "#64748B",
  mono: "'SF Mono','Fira Code','Fira Mono','Roboto Mono',monospace",
  head: "-apple-system,BlinkMacSystemFont,'Inter','SF Pro Display','Helvetica Neue',sans-serif",
  body: "-apple-system,BlinkMacSystemFont,'Inter','SF Pro Text','Helvetica Neue',sans-serif",
};
export const RC = {
  Low: T.ok,
  Medium: T.warn,
  High: T.danger,
  "Very High": T.purple,
};
export const SC = {
  Active: T.ok,
  Settled: T.accent,
  Approved: T.gold,
  Overdue: T.danger,
  "Written off": T.muted,
  Dormant: T.warn,
  "Application submitted": T.blue,
  "Under review": T.warn,
  New: T.muted,
  Contacted: T.warn,
  Interested: T.accent,
  Onboarded: T.ok,
  Allocated: T.ok,
  Unallocated: T.danger,
  Inactive: T.muted,
  Reminder: T.warn,
  "Field Visit": T.blue,
  "Demand Letter": T.danger,
  "Final Notice": T.danger,
  Legal: T.purple,
  "Written Off": T.muted,
};

// ── Utilities ─────────────────────────────────────────────────
export const fmt = (n) => "KES " + Number(n || 0).toLocaleString("en-KE");
export const fmtM = (n) =>
  n >= 1e6
    ? `KES ${(n / 1e6).toFixed(2)}M`
    : n >= 1e3
      ? `KES ${(n / 1e3).toFixed(1)}K`
      : `KES ${n || 0}`;
export const now = () => new Date().toISOString().split("T")[0];
export const ts = () =>
  new Date().toLocaleString("en-KE", { hour12: false }).replace(",", " ");
export const uid = (p) =>
  `${p}-${Date.now().toString(36).toUpperCase().slice(-5)}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
// ═══════════════════════════════════════════════════════════════════════════════
//  FINANCIAL ENGINE — Single source of truth for all interest/penalty calculations
//  Rules (as specified):
//  • Day 0–30 overdue  : interest only (1.2%/day on outstanding balance)
//  • Day 31–60 overdue : penalty only  (1.2%/day on outstanding balance, interest stops)
//  • After day 60      : FREEZE — no further accumulation, total is locked
//  • Before overdue    : no interest or penalty (flat 30% is baked into loan balance)
// ═══════════════════════════════════════════════════════════════════════════════
export const DAILY_RATE = 0.012; // 1.2% per day
export const INTEREST_DAYS = 30; // interest phase: days 1–30 overdue
export const PENALTY_DAYS = 30; // penalty phase:  days 31–60 overdue
export const FREEZE_AFTER = 60; // no accumulation after 60 days overdue

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
export const calculateLoanStatus = (loan, asOfDate) => {
  const d = asOfDate || new Date();
  const od = Math.max(0, loan.daysOverdue || 0);
  const bal = Math.max(0, loan.balance || 0);

  // ── Not overdue or fully settled ───────────────────────────────────────────
  if (
    !od ||
    loan.status === "Settled" ||
    loan.status === "Written off" ||
    bal <= 0
  ) {
    return {
      interestAccrued: 0,
      penaltyAccrued: 0,
      totalAmountDue: bal,
      overdueDays: od,
      phase: bal <= 0 ? "none" : od > 0 ? "interest" : "none",
      status: bal <= 0 ? "Settled" : loan.status || "Active",
      isFrozen: false,
    };
  }

  // ── Phase determination ─────────────────────────────────────────────────────
  // Days 1–30:   interest only
  // Days 31–60:  penalty only (interest stops at day 30)
  // After day 60: frozen — nothing accrues
  let interestAccrued = 0;
  let penaltyAccrued = 0;
  let phase, status, isFrozen;

  if (od <= INTEREST_DAYS) {
    // Phase 1: interest only
    interestAccrued = Math.round(bal * DAILY_RATE * od);
    penaltyAccrued = 0;
    phase = "interest";
    status = "Overdue (Interest phase)";
    isFrozen = false;
  } else if (od <= FREEZE_AFTER) {
    // Phase 2: interest capped at 30 days, penalty for (od - 30) days
    interestAccrued = Math.round(bal * DAILY_RATE * INTEREST_DAYS);
    const penaltyDays = od - INTEREST_DAYS;
    penaltyAccrued = Math.round(bal * DAILY_RATE * penaltyDays);
    phase = "penalty";
    status = "Overdue (Penalty phase)";
    isFrozen = false;
  } else {
    // Phase 3: frozen — interest capped at 30 days, penalty capped at 30 days
    interestAccrued = Math.round(bal * DAILY_RATE * INTEREST_DAYS);
    penaltyAccrued = Math.round(bal * DAILY_RATE * PENALTY_DAYS);
    phase = "frozen";
    status = "Frozen (No further accumulation)";
    isFrozen = true;
  }

  return {
    interestAccrued,
    penaltyAccrued,
    totalAmountDue: bal + interestAccrued + penaltyAccrued,
    overdueDays: od,
    phase,
    status,
    isFrozen,
  };
};

// Backward-compat shim — existing call sites use calcP(bal, daysOverdue).
// Returns the combined interest+penalty from the new engine.
// All new code should call calculateLoanStatus() directly.
export const calcP = (bal, d) => {
  const stub = {
    balance: bal,
    daysOverdue: d,
    status: d > 0 ? "Overdue" : "Active",
  };
  const { interestAccrued, penaltyAccrued } = calculateLoanStatus(stub);
  return interestAccrued + penaltyAccrued;
};
// HTML-escape for inserting values into JSX strings and HTML documents
export const escHtml = (v) =>
  String(v || "").replace(
    /[<>&"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c],
  );

// ── CSV / Download ────────────────────────────────────────────
export const toCSV = (hdr, rows) => {
  const DANGER = /^[=+\-@|]/;
  const q = (v) => {
    let s = String(v == null ? "" : v);
    if (DANGER.test(s)) s = "_" + s;
    s = s.replace(/"/g, "");
    return '"' + s + '"';
  };
  return [hdr.join(","), ...rows.map((r) => r.map(q).join(","))].join("\n");
};
export const dlCSV = (filename, csvContent) => {
  try {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: filename,
    });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 500);
    try {
      SFX.download();
    } catch (e) {}
  } catch (e) {
    window.open(
      "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent),
    );
  }
};

// ── Report Export Utilities ───────────────────────────────────

export const dlReportCSV = (rData) => {
  const headers = rData.cols.map(c => c.l);
  const rows = rData.rows.map(r => rData.cols.map(c => {
    const val = r[c.k];
    return typeof val === 'number' ? val : (val || '');
  }));
  dlCSV(`${rData.title.toLowerCase().replace(/\s+/g, '-')}-${now()}.csv`, toCSV(headers, rows));
};

export const dlReportPDF = (rData) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${rData.title}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111827; padding: 40px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; }
        .company { font-weight: 900; font-size: 20px; color: #3b82f6; }
        .title { font-size: 24px; font-weight: 800; margin-top: 5px; }
        .meta { color: #6b7280; font-size: 13px; text-align: right; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { text-align: left; background: #f3f4f6; padding: 12px 15px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #4b5563; border: 1px solid #e5e7eb; }
        td { padding: 10px 15px; font-size: 13px; border: 1px solid #e5e7eb; vertical-align: top; }
        tr:nth-child(even) { background: #f9fafb; }
        .summary { margin-top: 30px; padding: 20px; background: #f0f9ff; border-radius: 8px; border: 1px solid #bae6fd; display: flex; gap: 40px; }
        .stat { display: flex; flex-direction: column; }
        .stat-l { font-size: 10px; text-transform: uppercase; color: #0369a1; font-weight: 700; }
        .stat-v { font-size: 18px; font-weight: 800; color: #0c4a6e; }
        @media print { .no-print { display: none; } }
      </style>
    </head>
    <body class="fu">
      <div class="header">
        <div>
          <div class="company">ADEQUATE CAPITAL</div>
          <div class="title">${rData.title}</div>
        </div>
        <div class="meta">
          <div>Generated on ${new Date().toLocaleString('en-KE')}</div>
          <div>Total Records: ${rData.rows.length}</div>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>${rData.cols.map(c => `<th>${c.l}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rData.rows.map(r => `
            <tr>
              ${rData.cols.map(c => {
                let v = r[c.k];
                if (c.k === 'amount' || c.k === 'balance' || c.k === 'principal') return `<td>KES ${Number(v).toLocaleString()}</td>`;
                return `<td>${v || ''}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="summary">
        <div class="stat">
          <span class="stat-l">Report Date</span>
          <span class="stat-v">${now()}</span>
        </div>
        <div class="stat">
          <span class="stat-l">Record Count</span>
          <span class="stat-v">${rData.rows.length} Items</span>
        </div>
      </div>

      <script>
        window.onload = () => {
          setTimeout(() => {
            window.print();
          }, 500);
        };
      </script>
    </body>
    </html>
  `;
  const win = window.open('', '_blank');
  win.document.open();
  win.document.write(html);
  win.document.close();
};

export const dlReportWord = (rData) => {
  const tableHtml = `
    <table border="1" style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;">
      <tr style="background:#f3f4f6;">
        ${rData.cols.map(c => `<th style="padding:10px;text-align:left;">${c.l}</th>`).join('')}
      </tr>
      ${rData.rows.map(r => `
        <tr>
          ${rData.cols.map(c => `<td style="padding:8px;">${r[c.k] || ''}</td>`).join('')}
        </tr>
      `).join('')}
    </table>
  `;
  
  const content = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>${rData.title}</title>
    <style>
      body { font-family: Arial, sans-serif; }
      h1 { color: #3b82f6; font-size: 24pt; margin-bottom: 5pt; }
      p.meta { color: #666; font-size: 10pt; margin-bottom: 20pt; }
    </style>
    </head>
    <body>
      <h1>${rData.title}</h1>
      <p class="meta">Adequate Capital LMS · Generated ${new Date().toLocaleString()}</p>
      ${tableHtml}
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${rData.title.toLowerCase().replace(/\s+/g, '-')}-${now()}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const buildReportData = (id, { loans = [], customers = [], payments = [], workers = [], auditLog = [] }, { startDate = null, endDate = null } = {}) => {
  const commonCols = {
    loan: [
      {k:'id', l:'ID'},
      {k:'customer', l:'Customer'},
      {k:'amount', l:'Principal'},
      {k:'balance', l:'Balance'},
      {k:'status', l:'Status'},
      {k:'officer', l:'Officer'},
      {k:'disbursed', l:'Disbursed'}
    ],
    payment: [
      {k:'id', l:'ID'},
      {k:'customer', l:'Customer'},
      {k:'amount', l:'Amount'},
      {k:'mpesa', l:'M-Pesa'},
      {k:'date', l:'Date'},
      {k:'status', l:'Status'}
    ]
  };

  const isBetween = (d, s, e) => {
    if (!d) return false;
    let dr = String(d);
    if (dr.includes('T')) dr = dr.split('T')[0];
    else if (dr.includes(' ')) dr = dr.split(' ')[0];
    return (!s || dr >= s) && (!e || dr <= e);
  };
  const isUpTo = (d, e) => {
    if (!d) return false;
    const date = d.split('T')[0];
    return !e || date <= e;
  };

  if (id === 'loan-portfolio') return { title: 'Loan Portfolio', cols: commonCols.loan, rows: loans.filter(l => isUpTo(l.disbursed, endDate)) };
  if (id === 'active-loans') return { title: 'Active Loans', cols: commonCols.loan, rows: loans.filter(l => l.status === 'Active' && isUpTo(l.disbursed, endDate)) };
  if (id === 'overdue') return { title: 'Overdue Report', cols: [...commonCols.loan, {k:'daysOverdue', l:'Days Overdue'}], rows: loans.filter(l => l.status === 'Overdue' && isUpTo(l.disbursed, endDate)) };
  
  const pRows = payments.filter(p => isBetween(p.date, startDate, endDate));
  if (id === 'payments-today' || id === 'payments') return { title: 'Payment Records', cols: commonCols.payment, rows: pRows };
  
  if (id === 'customers') return { title: 'Customer List', cols: [{k:'id', l:'ID'}, {k:'name', l:'Name'}, {k:'phone', l:'Phone'}, {k:'business', l:'Business'}, {k:'location', l:'Location'}, {k:'risk', l:'Risk'}], rows: customers.filter(c => isUpTo(c.joined, endDate)) };
  if (id === 'staff') return { title: 'Staff Performance', cols: [{k:'name', l:'Name'}, {k:'role', l:'Role'}, {k:'status', l:'Status'}, {k:'phone', l:'Phone'}], rows: workers.filter(w => isUpTo(w.joined, endDate)) };
  if (id === 'audit') return { title: 'System Audit Log', cols: [{k:'ts', l:'Timestamp'}, {k:'user', l:'User'}, {k:'action', l:'Action'}, {k:'target', l:'Target'}, {k:'detail', l:'Details'}], rows: auditLog.filter(a => isBetween(a.ts, startDate, endDate)) };
  
  if (id === 'due-today') {
    const todayRows = loans.filter(l => {
      if (!l.disbursed || l.status === 'Settled' || l.status === 'Rejected') return false;
      const sched = computeLoanSchedule(l, payments);
      return sched.slots.some(s => isBetween(s.date, startDate, endDate) && s.status !== 'paid');
    });
    return { title: 'Due Within Period', cols: commonCols.loan, rows: todayRows };
  }

  if (id === 'missed-partial') {
    const missedRows = loans.filter(l => {
      if (!l.disbursed || l.status === 'Settled' || l.status === 'Rejected') return false;
      const sched = computeLoanSchedule(l, payments);
      return sched.slots.some(s => (s.status === 'missed' || s.status === 'partial') && isBetween(s.date, startDate, endDate));
    });
    return { title: 'Missed & Partial (Detailed)', cols: commonCols.loan, rows: missedRows };
  }

  return { title: 'Report', cols: [], rows: [] };
};


export const buildFullBackup = ({
  loans,
  customers,
  payments,
  workers,
  leads,
  interactions,
  auditLog,
}) => {
  const sections = [
    toCSV(
      ["=== ADEQUATE CAPITAL LMS BACKUP ==="],
      [[`Generated: ${new Date().toISOString()}`]],
    ),
    "\n\n--- CUSTOMERS ---\n",
    toCSV(
      [
        "ID",
        "Name",
        "Phone",
        "ID No",
        "Business",
        "Location",
        "Officer",
        "Loans",
        "Risk",
        "Joined",
        "Blacklisted",
      ],
      customers.map((c) => [
        c.id,
        c.name,
        c.phone,
        c.idNo,
        c.business || "",
        c.location || "",
        c.officer || "",
        c.loans,
        c.risk,
        c.joined,
        c.blacklisted ? "Yes" : "No",
      ]),
    ),
    "\n\n--- LOANS ---\n",
    toCSV(
      [
        "Loan ID",
        "Customer ID",
        "Customer",
        "Principal",
        "Balance",
        "Status",
        "Days Overdue",
        "Penalty",
        "Officer",
        "Disbursed",
        "Repayment Type",
      ],
      loans.map((l) => {
        const e = calculateLoanStatus(l);
        return [
          l.id,
          l.customerId || "",
          l.customer,
          l.amount,
          l.balance,
          l.status,
          l.daysOverdue,
          e.interestAccrued + e.penaltyAccrued,
          l.officer,
          l.disbursed || "N/A",
          l.repaymentType,
        ];
      }),
    ),
    "\n\n--- PAYMENTS ---\n",
    toCSV(
      [
        "ID",
        "Customer ID",
        "Customer",
        "Loan ID",
        "Amount",
        "M-Pesa",
        "Date",
        "Status",
      ],
      payments.map((p) => [
        p.id,
        p.customerId || "",
        p.customer,
        p.loanId || "N/A",
        p.amount,
        p.mpesa,
        p.date,
        p.status,
      ]),
    ),
    "\n\n--- LEADS ---\n",
    toCSV(
      [
        "ID",
        "Name",
        "Phone",
        "Business",
        "Source",
        "Status",
        "Officer",
        "Date",
      ],
      (leads || []).map((l) => [
        l.id,
        l.name,
        l.phone,
        l.business || "",
        l.source,
        l.status,
        l.officer || "",
        l.date,
      ]),
    ),
    "\n\n--- WORKERS ---\n",
    toCSV(
      ["ID", "Name", "Email", "Role", "Status", "Phone", "Joined"],
      workers.map((w) => [
        w.id,
        w.name,
        w.email,
        w.role,
        w.status,
        w.phone,
        w.joined,
      ]),
    ),
    "\n\n--- INTERACTIONS ---\n",
    toCSV(
      [
        "ID",
        "Customer ID",
        "Loan ID",
        "Type",
        "Date",
        "Officer",
        "Notes",
        "Promise Amount",
        "Promise Date",
        "Promise Status",
      ],
      (interactions || []).map((i) => [
        i.id,
        i.customerId,
        i.loanId,
        i.type,
        i.date,
        i.officer,
        i.notes,
        i.promiseAmount || "",
        i.promiseDate || "",
        i.promiseStatus || "",
      ]),
    ),
    "\n\n--- AUDIT LOG ---\n",
    toCSV(
      ["Timestamp", "User", "Action", "Target", "Detail"],
      (auditLog || []).map((e) => [
        e.ts,
        e.user,
        e.action,
        e.target,
        e.detail || "",
      ]),
    ),
  ];
  return sections.join("");
};

// ── Seed Data ─────────────────────────────────────────────────
// Password hashing — SHA-256 via SubtleCrypto (async, used when setting/checking passwords)
// NOTE: Replace with server-side bcrypt/argon2 before production deployment
const _sha256Hex = async (str) => {
  try {
    const buf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(str),
    );
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch (e) {
    return str;
  }
};
const HASH_SALT = "acl:2024:mfi";
export const DEFAULT_ADMIN_PW = "admin123";
export const hashPwAsync = (pw) => _sha256Hex((pw || "") + HASH_SALT);
export const checkPwAsync = async (raw, stored) => {
  try {
    return (await hashPwAsync(raw)) === stored;
  } catch (e) {
    return false;
  }
};

// _hashPw and _checkPw imported from @/data/seedData

// ═══════════════════════════════════════════
//  UI ATOMS
// ═══════════════════════════════════════════
export const Badge = ({ children, color = T.muted }) => (
  <span
    style={{
      background: color + "1E",
      color,
      border: `1px solid ${color}38`,
      padding: "2px 9px",
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 700,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </span>
);
export const Av = ({ ini, size = 36, color = T.accent }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: 99,
      background: color + "20",
      border: `2px solid ${color}50`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color,
      fontWeight: 900,
      fontSize: size * 0.35,
      fontFamily: T.head,
      flexShrink: 0,
    }}
  >
    {ini}
  </div>
);
export const Bar = ({ value, max = 100, color = T.accent }) => (
  <div
    style={{
      height: 6,
      background: T.border,
      borderRadius: 99,
      overflow: "hidden",
    }}
  >
    <div
      style={{
        height: "100%",
        width: `${Math.min(((value || 0) / max) * 100, 100)}%`,
        background: color,
        borderRadius: 99,
        transition: "width 1s",
      }}
    />
  </div>
);
export const KPI = ({ label, value, sub, color, delay = 0, onClick, icon }) => {
  const [hov, setHov] = useState(false);
  const c = color || T.accent;
  return (
    <div
      className={`fu fu${delay}`}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flex: 1,
        minWidth: 130,
        position: "relative",
        overflow: "hidden",
        background: hov ? T.card2 : T.card,
        borderRadius: 16,
        borderTop: `1px solid ${hov ? c + "55" : T.border}`,
        borderRight: `1px solid ${hov ? c + "55" : T.border}`,
        borderBottom: `1px solid ${hov ? c + "55" : T.border}`,
        borderLeft: `3px solid ${c}`,
        padding: "18px 16px 14px",
        cursor: onClick ? "pointer" : "default",
        transition:
          "border-color .2s,background .2s,transform .18s,box-shadow .2s",
        transform: hov && onClick ? "translateY(-3px)" : "translateY(0)",
        boxShadow:
          hov && onClick
            ? `0 8px 28px ${c}18,0 2px 8px rgba(0,0,0,0.3)`
            : "0 1px 4px rgba(0,0,0,0.2)",
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          top: -20,
          right: -20,
          width: 80,
          height: 80,
          borderRadius: 99,
          background: c + "0A",
          pointerEvents: "none",
          transition: "opacity .2s",
          opacity: hov ? 1 : 0,
        }}
      />
      {/* Header row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 10,
        }}
      >
        <div
          style={{
            color: T.muted,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.9,
            textTransform: "uppercase",
            lineHeight: 1.4,
          }}
        >
          {label}
        </div>
        {icon && <div style={{ fontSize: 16, opacity: 0.7 }}>{icon}</div>}
        {!icon && onClick && (
          <div
            style={{
              color: c,
              fontSize: 10,
              opacity: hov ? 1 : 0.4,
              transition: "opacity .2s",
              fontWeight: 700,
            }}
          >
            ↗
          </div>
        )}
      </div>
      {/* Value */}
      <div
        style={{
          color: c,
          fontSize: 22,
          fontWeight: 900,
          fontFamily: T.mono,
          lineHeight: 1,
          letterSpacing: -0.5,
          marginBottom: sub ? 6 : 0,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ color: T.muted, fontSize: 11, marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
};
export const Card = ({ children, style: sx, className }) => (
  <div
    className={className}
    style={{
      background: T.card,
      borderTop: `1px solid ${T.border}`,
      borderRight: `1px solid ${T.border}`,
      borderBottom: `1px solid ${T.border}`,
      borderLeft: `1px solid ${T.border}`,
      borderRadius: 13,
      ...sx,
    }}
  >
    {children}
  </div>
);
export const CH = ({ title, sub, right }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "14px 18px",
      borderBottom: `1px solid ${T.border}`,
      flexWrap: "wrap",
      gap: 8,
    }}
  >
    <div>
      <div
        style={{
          color: T.txt,
          fontWeight: 700,
          fontSize: 14,
          fontFamily: T.head,
        }}
      >
        {title}
      </div>
      {sub && (
        <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>{sub}</div>
      )}
    </div>
    {right}
  </div>
);
export const Btn = ({
  children,
  v = "primary",
  onClick,
  disabled,
  sm,
  full,
  style: sx = {},
}) => {
  const base = {
    border: "none",
    borderRadius: 9,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: T.body,
    fontWeight: 700,
    transition: "opacity .15s",
    padding: sm ? "6px 12px" : "10px 17px",
    fontSize: sm ? 12 : 14,
    opacity: disabled ? 0.45 : 1,
    width: full ? "100%" : "auto",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    ...sx,
  };
  const vs = {
    primary: { background: T.accent, color: "#060A10" },
    secondary: {
      background: T.card2,
      color: T.txt,
      border: `1px solid ${T.border}`,
    },
    danger: {
      background: T.dLo,
      color: T.danger,
      border: `1px solid ${T.danger}38`,
    },
    ghost: {
      background: "transparent",
      color: T.muted,
      border: `1px solid ${T.border}`,
    },
    ok: { background: T.oLo, color: T.ok, border: `1px solid ${T.ok}38` },
    gold: { background: T.gLo, color: T.gold, border: `1px solid ${T.gold}38` },
    warn: { background: T.wLo, color: T.warn, border: `1px solid ${T.warn}38` },
    blue: { background: T.bLo, color: T.blue, border: `1px solid ${T.blue}38` },
    purple: {
      background: T.pLo,
      color: T.purple,
      border: `1px solid ${T.purple}38`,
    },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ ...base, ...(vs[v] || vs.secondary) }}
    >
      {children}
    </button>
  );
};

// ── Back Button (apple-style) ──────────────────────────────
export const BackBtn = ({ onClick, label = "Back" }) => (
  <button className="back-btn" onClick={onClick}>
    <span style={{ fontSize: 14, lineHeight: 1 }}>‹</span>
    <span>{label}</span>
  </button>
);

// ── Refresh Button ─────────────────────────────────────────
// onRefresh: () => void  — called after spin animation; pass the actual
//            refresh action (reset filters, re-run status calc, etc.)
export const RefreshBtn = ({ onRefresh }) => {
  const [spinning, setSpinning] = useState(false);
  const [done, setDone] = useState(false);
  const doRefresh = () => {
    if (spinning) return;
    setSpinning(true);
    setDone(false);
    SFX.notify();
    // Execute the real refresh action immediately (data is local-state, instant)
    try {
      onRefresh();
    } catch (e) {}
    setTimeout(() => {
      setSpinning(false);
      setDone(true);
      setTimeout(() => setDone(false), 1200);
    }, 600);
  };
  return (
    <button
      className="refresh-btn"
      onClick={doRefresh}
      title="Refresh data"
      style={{
        color: done ? "#00D4AA" : undefined,
        borderColor: done ? "#00D4AA40" : undefined,
      }}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          transition: "transform .7s cubic-bezier(.22,1,.36,1)",
          transform: spinning ? "rotate(360deg)" : "rotate(0deg)",
          flexShrink: 0,
        }}
      >
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
      <span>{done ? "✓ Done" : "Refresh"}</span>
    </button>
  );
};

// ── Country dial-code data ───────────────────────────────────
const DIAL_CODES = [
  { code: "+254", flag: "🇰🇪", name: "Kenya" },
  { code: "+255", flag: "🇹🇿", name: "Tanzania" },
  { code: "+256", flag: "🇺🇬", name: "Uganda" },
  { code: "+250", flag: "🇷🇼", name: "Rwanda" },
  { code: "+251", flag: "🇪🇹", name: "Ethiopia" },
  { code: "+1", flag: "🇺🇸", name: "USA/Canada" },
  { code: "+44", flag: "🇬🇧", name: "UK" },
  { code: "+27", flag: "🇿🇦", name: "South Africa" },
  { code: "+234", flag: "🇳🇬", name: "Nigeria" },
  { code: "+233", flag: "🇬🇭", name: "Ghana" },
  { code: "+20", flag: "🇪🇬", name: "Egypt" },
  { code: "+971", flag: "🇦🇪", name: "UAE" },
  { code: "+91", flag: "🇮🇳", name: "India" },
  { code: "+86", flag: "🇨🇳", name: "China" },
  { code: "+49", flag: "🇩🇪", name: "Germany" },
  { code: "+33", flag: "🇫🇷", name: "France" },
  { code: "+61", flag: "🇦🇺", name: "Australia" },
];

// Normalise any phone to E.164 with the given dialCode
const normalisePhone = (raw, dialCode) => {
  if (!raw) return "";
  const stripped = raw.replace(/\s+/g, "");
  if (stripped.startsWith("+")) return stripped; // already has code
  if (stripped.startsWith("00")) return "+" + stripped.slice(2);
  if (stripped.startsWith("0")) return dialCode + stripped.slice(1);
  return dialCode + stripped;
};

// Validate a phone string — accepts: +254xxxxxxxxx, 07xxxxxxxx, 01xxxxxxxx, +254 7xxxxxxxx
const isValidPhone = (raw) => {
  if (!raw) return false;
  const s = raw.replace(/[\s\-()]/g, "");
  return /^(\+\d{7,15}|0[17]\d{8})$/.test(s);
};

// PhoneInput — country selector + digits-only field
export const PhoneInput = ({
  label,
  value,
  onChange,
  required,
  half,
  placeholder,
}) => {
  const [dialCode, setDialCode] = useState("+254");
  const [open, setOpen] = useState(false);
  const inputRef = useRef();
  const containerRef = useRef();

  // Keep only digits and leading + in the raw field
  const handleRaw = (e) => {
    let v = e.target.value.replace(/[^\d+\s]/g, "");
    onChange(v);
  };

  const selectCode = (code) => {
    setDialCode(code);
    setOpen(false);
    inputRef.current?.focus();
  };

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const normalised = normalisePhone(value, dialCode);
  const hasErr = required && !isValidPhone(value) && value;
  const isMissing = required && !value;
  const flagEntry =
    DIAL_CODES.find((d) => d.code === dialCode) || DIAL_CODES[0];

  const borderColor = hasErr ? T.danger : isMissing ? T.danger : T.border;

  return (
    <div
      ref={containerRef}
      style={{
        marginBottom: 12,
        gridColumn: half ? "span 1" : "span 2",
        position: "relative",
        minWidth: 0,
      }}
    >
      {label && (
        <label
          style={{
            display: "block",
            color: hasErr || isMissing ? T.danger : T.dim,
            fontSize: 11,
            fontWeight: 600,
            marginBottom: 5,
            letterSpacing: 0.7,
            textTransform: "uppercase",
          }}
        >
          {label}
          {required && <span style={{ color: T.danger }}> ★</span>}
        </label>
      )}
      <div
        style={{
          display: "flex",
          borderRadius: 8,
          border: `1px solid ${borderColor}`,
          overflow: "visible",
          background: T.surface,
          transition: "border-color .2s",
        }}
      >
        {/* Country code button */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "10px 10px",
            background: "transparent",
            border: "none",
            borderRight: `1px solid ${T.border}`,
            cursor: "pointer",
            flexShrink: 0,
            color: T.txt,
            fontSize: 13,
            fontWeight: 700,
            fontFamily: T.mono,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontSize: 16 }}>{flagEntry.flag}</span>
          <span>{dialCode}</span>
          <span style={{ color: T.muted, fontSize: 10 }}>▾</span>
        </button>
        {/* Number input — digits only */}
        <input
          ref={inputRef}
          inputMode="numeric"
          value={value}
          onChange={handleRaw}
          placeholder={
            placeholder ||
            (dialCode === "+254" ? "0712 345 678" : "Phone number")
          }
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            padding: "10px 12px",
            color: T.txt,
            fontSize: 14,
            outline: "none",
            fontFamily: T.body,
            minWidth: 0,
          }}
        />
      </div>
      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 9999,
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            boxShadow: "0 8px 30px #00000060",
            width: 220,
            maxHeight: 220,
            overflowY: "auto",
            marginTop: 4,
          }}
        >
          {DIAL_CODES.map((d) => (
            <div
              key={d.code}
              onClick={() => selectCode(d.code)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "9px 14px",
                cursor: "pointer",
                background: d.code === dialCode ? T.aLo : "transparent",
                transition: "background .1s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = T.card2)}
              onMouseLeave={(e) =>
                (e.currentTarget.style.background =
                  d.code === dialCode ? T.aLo : "transparent")
              }
            >
              <span style={{ fontSize: 18 }}>{d.flag}</span>
              <span style={{ color: T.txt, fontSize: 12, fontWeight: 600 }}>
                {d.name}
              </span>
              <span
                style={{
                  color: T.muted,
                  fontSize: 11,
                  marginLeft: "auto",
                  fontFamily: T.mono,
                }}
              >
                {d.code}
              </span>
            </div>
          ))}
        </div>
      )}
      {hasErr && (
        <div style={{ color: T.danger, fontSize: 11, marginTop: 3 }}>
          ⚠ Enter a valid phone number
        </div>
      )}
      {isMissing && (
        <div style={{ color: T.danger, fontSize: 11, marginTop: 3 }}>
          ⚠ Phone number is required
        </div>
      )}
      {!hasErr && !isMissing && normalised && normalised !== value && (
        <div style={{ color: T.muted, fontSize: 10, marginTop: 3 }}>
          Will be stored as {normalised}
        </div>
      )}
    </div>
  );
};

// NumericInput — accepts digits only (for National ID, amounts, etc.)
export const NumericInput = ({
  label,
  value,
  onChange,
  required,
  half,
  placeholder,
  hint,
}) => {
  const hasErr = required && !value;
  const handleChange = (e) => {
    const v = e.target.value.replace(/\D/g, "");
    if (v !== e.target.value) {
      try {
        SFX.error();
      } catch (x) {}
    }
    onChange(v);
  };
  const s = {
    width: "100%",
    background: T.surface,
    border: `1px solid ${hasErr ? T.danger : T.border}`,
    borderRadius: 8,
    padding: "10px 12px",
    color: T.txt,
    fontSize: 14,
    outline: "none",
    fontFamily: T.mono,
    transition: "border-color .2s",
    letterSpacing: 0.5,
  };
  return (
    <div
      style={{
        marginBottom: 12,
        gridColumn: half ? "span 1" : "span 2",
        minWidth: 0,
        overflow: "visible",
      }}
    >
      {label && (
        <label
          style={{
            display: "block",
            color: hasErr ? T.danger : T.dim,
            fontSize: 11,
            fontWeight: 600,
            marginBottom: 5,
            letterSpacing: 0.7,
            textTransform: "uppercase",
          }}
        >
          {label}
          {required && <span style={{ color: T.danger }}> ★</span>}
        </label>
      )}
      <input
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        placeholder={placeholder || "Numbers only"}
        style={s}
      />
      {hasErr && (
        <div style={{ color: T.danger, fontSize: 11, marginTop: 3 }}>
          ⚠ This field is required
        </div>
      )}
      {hint && !hasErr && (
        <div style={{ color: T.muted, fontSize: 11, marginTop: 3 }}>{hint}</div>
      )}
    </div>
  );
};

// Enhanced FI with red-star required validation
export const FI = ({
  label,
  value,
  onChange,
  type = "text",
  options,
  required,
  placeholder,
  hint,
  half,
  error,
}) => {
  const hasErr = error && required && !value;
  const s = {
    width: "100%",
    background: T.surface,
    border: `1px solid ${hasErr ? T.danger : T.border}`,
    borderRadius: 8,
    padding: "10px 12px",
    color: T.txt,
    fontSize: 14,
    outline: "none",
    fontFamily: T.body,
    transition: "border-color .2s",
  };
  const handleChange = (e) => {
    // fire error SFX if this is a number type and a non-numeric char was typed
    onChange(e.target.value);
  };
  return (
    <div
      style={{
        marginBottom: 12,
        gridColumn: half ? "span 1" : "span 2",
        minWidth: 0,
      }}
    >
      {label && (
        <label
          style={{
            display: "block",
            color: hasErr ? T.danger : T.dim,
            fontSize: 11,
            fontWeight: 600,
            marginBottom: 5,
            letterSpacing: 0.7,
            textTransform: "uppercase",
          }}
        >
          {label}
          {required && <span style={{ color: T.danger }}> ★</span>}
        </label>
      )}
      {type === "select" ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={s}
        >
          <option value="">— Select —</option>
          {(options || []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          rows={3}
          style={{ ...s, resize: "vertical" }}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          autoComplete={type === "password" ? "new-password" : undefined}
          style={{ ...s, WebkitTextFillColor: T.txt, caretColor: T.txt }}
        />
      )}
      {hasErr && (
        <div style={{ color: T.danger, fontSize: 11, marginTop: 3 }}>
          ⚠ This field is required
        </div>
      )}
      {hint && !hasErr && (
        <div style={{ color: T.muted, fontSize: 11, marginTop: 3 }}>{hint}</div>
      )}
    </div>
  );
};
// useToast defined in SOUND ENGINE above

export const ToastContainer = ({ toasts }) => (
  <div
    role="status"
    aria-live="polite"
    aria-atomic="false"
    aria-label="Notifications"
    style={{
      position: "fixed",
      bottom: 20,
      right: 20,
      zIndex: 99999,
      display: "flex",
      flexDirection: "column",
      gap: 8,
      pointerEvents: "none",
    }}
  >
    {toasts.map((t) => {
      const cols = {
        ok: [T.ok, T.oLo],
        danger: [T.danger, T.dLo],
        warn: [T.warn, T.wLo],
        info: [T.blue, T.bLo],
      };
      const [c, bg] = cols[t.type] || cols.ok;
      return (
        <div
          key={t.id}
          role="alert"
          aria-live={t.type === "danger" ? "assertive" : "polite"}
          className="toast-enter"
          style={{
            background: bg,
            border: `1px solid ${c}50`,
            borderRadius: 10,
            padding: "10px 16px",
            color: c,
            fontSize: 13,
            fontWeight: 600,
            boxShadow: `0 4px 20px ${c}20`,
            maxWidth: 320,
            pointerEvents: "auto",
          }}
        >
          {t.msg}
        </div>
      );
    })}
  </div>
);
export const Alert = ({ type = "warn", children }) => {
  const m = {
    warn: [T.warn, T.wLo],
    danger: [T.danger, T.dLo],
    ok: [T.ok, T.oLo],
    info: [T.blue, T.bLo],
  };
  const [c, bg] = m[type] || m.warn;
  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${c}38`,
        borderRadius: 9,
        padding: "10px 13px",
        color: c,
        fontSize: 13,
        marginBottom: 13,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
};

// ── Global modal scroll lock v1.7.1 — class-based, ref-counted ──
let _modalCount = 0;
export const useModalLock = () => {
  useEffect(() => {
    _modalCount++;
    if (_modalCount === 1) {
      // Capture current scroll so position:fixed doesn't jump
      const scrollY = window.scrollY;
      document.body.style.top = `-${scrollY}px`;
      document.body.classList.add("modal-open");
    }
    return () => {
      _modalCount--;
      if (_modalCount === 0) {
        const scrollY = -parseInt(document.body.style.top || "0");
        document.body.classList.remove("modal-open");
        document.body.style.top = "";
        window.scrollTo(0, scrollY);
      }
    };
  }, []);
};

// ── Safe top position — always 16px below topbar, never mid-page ─
export const MODAL_TOP_OFFSET = 16; // px gap from top of viewport
const MODAL_BOT_PAD = 24; // safe gap at bottom — prevents last form field being clipped
export const Dialog = ({
  title,
  children,
  onClose,
  width = 520,
  minHeight,
  zIndex = 9900,
}) => {
  useModalLock();
  const dialogRef = useRef(null);
  const titleId = useRef(
    "dlg-" + Math.random().toString(36).slice(2, 7),
  ).current;
  const vw = typeof window !== "undefined" ? window.innerWidth : 600;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const mw = Math.min(width, vw - 16);
  const maxH = Math.min(
    vh - MODAL_TOP_OFFSET - MODAL_BOT_PAD,
    Math.round(vh * 0.92),
  );

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
  useEffect(() => {
    onCloseRef.current = onClose;
  }); // keep ref current every render

  // Mount-only: auto-focus the first focusable element exactly once
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const first = el.querySelector(
      'button,input,select,textarea,[tabindex]:not([tabindex="-1"])',
    );
    if (first) first.focus();
  }, []); // ← empty deps: runs once on mount, NEVER re-runs on parent re-renders

  // Stable keydown handler: deps are empty so this never re-registers
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = [
        ...el.querySelectorAll(
          'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])',
        ),
      ];
      if (!focusable.length) return;
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []); // ← empty deps: registers once, reads latest onClose via ref

  return (
    <div
      className="dialog-backdrop"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: `${MODAL_TOP_OFFSET}px 8px ${MODAL_BOT_PAD}px`,
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        background: "rgba(4,8,16,0.72)",
        overflowY: "auto",
        overflowX: "hidden",
      }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="pop"
        style={{
          background: T.card,
          border: `1px solid ${T.hi}`,
          borderRadius: 18,
          width: "100%",
          maxWidth: mw,
          maxHeight: maxH,
          minHeight: minHeight || undefined,
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 40px 80px #000000D0",
          flexShrink: 0,
          overflowX: "hidden",
          overflowY: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 16px",
            borderBottom: `1px solid ${T.border}`,
            flexShrink: 0,
            background: T.card,
            borderRadius: "18px 18px 0 0",
          }}
        >
          <h3
            id={titleId}
            style={{
              color: T.txt,
              fontSize: 15,
              fontWeight: 800,
              fontFamily: T.head,
              margin: 0,
            }}
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: T.card2,
              border: `1px solid ${T.border}`,
              color: T.muted,
              borderRadius: 99,
              width: 28,
              height: 28,
              cursor: "pointer",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <div
          style={{
            overflowY: "auto",
            padding: "14px 16px 32px",
            flex: 1,
            WebkitOverflowScrolling: "touch",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

// Side panel — slides in from right, feels part of the page
const Panel = ({
  title,
  subtitle,
  onClose,
  children,
  width = 500,
  zIndex = 9900,
}) => {
  useModalLock();
  const panelRef = useRef(null);
  const titleId = useRef(
    "pnl-" + Math.random().toString(36).slice(2, 7),
  ).current;
  const vw = typeof window !== "undefined" ? window.innerWidth : 600;
  const w = Math.min(width, vw);

  // ROOT CAUSE FIX A (Panel) — same focus-theft pattern as Dialog.
  // useEffect([onClose]) re-fires on every inline-arrow onClose change → first.focus() steals focus.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const first = el.querySelector(
      'button,input,select,textarea,[tabindex]:not([tabindex="-1"])',
    );
    if (first) first.focus();
  }, []);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = [
        ...el.querySelectorAll(
          'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])',
        ),
      ];
      if (!focusable.length) return;
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex,
        display: "flex",
        justifyContent: "flex-end",
        overflow: "hidden",
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(4,8,16,0.45)",
          backdropFilter: "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="panel-in"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: w,
          background: T.card,
          borderLeft: `1px solid ${T.hi}`,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          boxShadow: "-24px 0 64px #00000080",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            padding: "20px 22px 16px",
            borderBottom: `1px solid ${T.border}`,
            flexShrink: 0,
            background: T.card,
            zIndex: 10,
          }}
        >
          <div>
            <h3
              id={titleId}
              style={{
                color: T.txt,
                fontSize: 16,
                fontWeight: 800,
                fontFamily: T.head,
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              {title}
            </h3>
            {subtitle && (
              <div style={{ color: T.muted, fontSize: 12, marginTop: 4 }}>
                {subtitle}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close panel"
            style={{
              background: T.card2,
              border: `1px solid ${T.border}`,
              color: T.muted,
              borderRadius: 99,
              width: 30,
              height: 30,
              cursor: "pointer",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginLeft: 12,
            }}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <div
          style={{
            flex: 1,
            padding: "20px 22px 48px",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
// ── DT v1.7.1: fixed-height shell + virtual scroll + pagination ──
const DT_ROW_H = 44; // px height per row — keep in sync with td padding
const DT_MAX_H_VH = 0.48; // default container max-height as % of viewport
const DT_PAGE_SIZE = 60; // rows per page before pagination activates
const DT_VIRT_THR = 120; // rows before virtual scroll activates

// Shared thead — used by all three DT variants
const DTHead = ({ cols }) => (
  <thead>
    <tr>
      {cols.map((c, i) => (
        <th
          key={`${c.k || c.l}-${i}`}
          style={{
            color: T.muted,
            fontWeight: 700,
            fontSize: 10,
            letterSpacing: 1,
            textTransform: "uppercase",
            padding: "10px 13px",
            textAlign: "left",
            borderBottom: `1px solid ${T.border}`,
            whiteSpace: "nowrap",
            position: "sticky",
            top: 0,
            background: T.card,
            zIndex: 2,
          }}
        >
          {c.l}
        </th>
      ))}
    </tr>
  </thead>
);

// Shared row renderer — used by all three DT variants
const DTRow = ({ cols, row, idx, onRow }) => (
  <tr
    className={onRow ? "row-hover" : ""}
    onClick={() => onRow && onRow(row)}
    style={{
      borderBottom: `1px solid ${T.border}18`,
      cursor: onRow ? "pointer" : "default",
    }}
  >
    {cols.map((c, j) => (
      <td
        key={j}
        style={{ padding: "10px 13px", color: T.txt, verticalAlign: "middle" }}
      >
        {c.r ? c.r(row[c.k], row) : (row[c.k] ?? "—")}
      </td>
    ))}
  </tr>
);

// ── DTSmall — for ≤DT_PAGE_SIZE rows: 40vh scroll container ──
const DTSmall = ({ cols, rows, onRow, emptyMsg }) => (
  <div style={{ maxHeight: "40vh", overflowY: "auto", overflowX: "auto" }}>
    <table
      style={{
        width: "100%",
        minWidth: 520,
        borderCollapse: "collapse",
        fontSize: 13,
      }}
    >
      <DTHead cols={cols} />
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={cols.length}>
              <div style={{ padding: "32px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.35 }}>
                  📋
                </div>
                <div style={{ color: T.muted, fontSize: 13, fontWeight: 500 }}>
                  {emptyMsg}
                </div>
                <div style={{ color: T.dim, fontSize: 11, marginTop: 4 }}>
                  Try adjusting your filters or search terms
                </div>
              </div>
            </td>
          </tr>
        ) : (
          rows.map((row, i) => (
            <DTRow
              key={row.id || row.key || i}
              cols={cols}
              row={row}
              idx={i}
              onRow={onRow}
            />
          ))
        )}
      </tbody>
    </table>
  </div>
);

// ── DTPaged — for >DT_PAGE_SIZE rows: paginated, 40vh scroll container ──
const DTPaged = ({ cols, rows, onRow, emptyMsg }) => {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [rows]);
  const totalPages = Math.ceil(rows.length / DT_PAGE_SIZE);
  const slice = rows.slice(page * DT_PAGE_SIZE, (page + 1) * DT_PAGE_SIZE);
  const from = page * DT_PAGE_SIZE + 1;
  const to = Math.min((page + 1) * DT_PAGE_SIZE, rows.length);
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ maxHeight: "40vh", overflowY: "auto", overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            minWidth: 520,
            borderCollapse: "collapse",
            fontSize: 13,
          }}
        >
          <DTHead cols={cols} />
          <tbody>
            {slice.length === 0 ? (
              <tr>
                <td colSpan={cols.length}>
                  <div style={{ padding: "32px 16px", textAlign: "center" }}>
                    <div
                      style={{ fontSize: 28, marginBottom: 8, opacity: 0.35 }}
                    >
                      📋
                    </div>
                    <div
                      style={{ color: T.muted, fontSize: 13, fontWeight: 500 }}
                    >
                      {emptyMsg}
                    </div>
                    <div style={{ color: T.dim, fontSize: 11, marginTop: 4 }}>
                      Try adjusting your filters or search terms
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              slice.map((row, i) => (
                <DTRow
                  key={row.id || row.key || page * DT_PAGE_SIZE + i}
                  cols={cols}
                  row={row}
                  idx={page * DT_PAGE_SIZE + i}
                  onRow={onRow}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* Pagination bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "7px 13px",
          borderTop: `1px solid ${T.border}`,
          background: T.surface,
          flexWrap: "wrap",
          gap: 6,
          flexShrink: 0,
        }}
      >
        <span style={{ color: T.muted, fontSize: 12 }}>
          {from.toLocaleString()}–{to.toLocaleString()} of{" "}
          {rows.length.toLocaleString()}
        </span>
        <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
          {[
            ["«", 0, page === 0],
            ["‹", page - 1, page === 0],
          ].map(([lbl, pg, dis]) => (
            <button
              key={lbl}
              onClick={() => setPage(pg)}
              disabled={dis}
              style={{
                background: T.card2,
                border: `1px solid ${T.border}`,
                color: T.muted,
                borderRadius: 5,
                padding: "3px 8px",
                cursor: dis ? "default" : "pointer",
                fontSize: 11,
                opacity: dis ? 0.35 : 1,
              }}
            >
              {lbl}
            </button>
          ))}
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const p =
              page < 2
                ? i
                : page > totalPages - 3
                  ? totalPages - 5 + i
                  : page - 2 + i;
            if (p < 0 || p >= totalPages) return null;
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                style={{
                  background: p === page ? T.accent : T.card2,
                  color: p === page ? "#060A10" : T.muted,
                  border: `1px solid ${p === page ? T.accent : T.border}`,
                  borderRadius: 5,
                  padding: "3px 8px",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: p === page ? 800 : 400,
                }}
              >
                {p + 1}
              </button>
            );
          })}
          {[
            ["›", page + 1, page >= totalPages - 1],
            ["»", totalPages - 1, page >= totalPages - 1],
          ].map(([lbl, pg, dis]) => (
            <button
              key={lbl}
              onClick={() => setPage(pg)}
              disabled={dis}
              style={{
                background: T.card2,
                border: `1px solid ${T.border}`,
                color: T.muted,
                borderRadius: 5,
                padding: "3px 8px",
                cursor: dis ? "default" : "pointer",
                fontSize: 11,
                opacity: dis ? 0.35 : 1,
              }}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── DTVirtual — for >DT_VIRT_THR rows: true O(1) DOM virtual scroll ──
const DTVirtual = ({ cols, rows, onRow, maxH }) => {
  const [startIdx, setStartIdx] = useState(0);
  const wrapRef = useRef(null);
  const rafRef = useRef(null);

  const visCount = Math.ceil(maxH / DT_ROW_H) + 16; // visible rows + generous overscan buffer

  useEffect(() => {
    setStartIdx(0);
    const wrap = wrapRef.current;
    if (!wrap) return;
    wrap.scrollTop = 0;
    const onScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        if (wrapRef.current) {
          // Overscan by 8 rows above visible area for smoother upward scrolling
          setStartIdx(
            Math.max(0, Math.floor(wrapRef.current.scrollTop / DT_ROW_H) - 8),
          );
        }
      });
    };
    wrap.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      wrap.removeEventListener("scroll", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [rows]);

  const start = startIdx;
  const end = Math.min(rows.length, start + visCount);
  const slice = rows.slice(start, end);
  const topPad = start * DT_ROW_H;
  const botPad = (rows.length - end) * DT_ROW_H;

  return (
    <div>
      <div
        style={{
          padding: "4px 13px 6px",
          color: T.muted,
          fontSize: 11,
          borderBottom: `1px solid ${T.border}18`,
        }}
      >
        {rows.length.toLocaleString()} records
      </div>
      <div
        ref={wrapRef}
        style={{
          overflowY: "auto",
          overflowX: "auto",
          height: maxH,
          WebkitOverflowScrolling: "touch",
        }}
      >
        <table
          style={{
            width: "100%",
            minWidth: 520,
            borderCollapse: "collapse",
            fontSize: 13,
          }}
        >
          <DTHead cols={cols} />
          <tbody>
            {topPad > 0 && (
              <tr style={{ height: topPad }}>
                <td colSpan={cols.length} style={{ padding: 0 }}></td>
              </tr>
            )}
            {slice.map((row, i) => (
              <DTRow
                key={row.id || row.key || start + i}
                cols={cols}
                row={row}
                idx={start + i}
                onRow={onRow}
              />
            ))}
            {botPad > 0 && (
              <tr style={{ height: botPad }}>
                <td colSpan={cols.length} style={{ padding: 0 }}></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── DT — smart router: picks Small / Virtual / Paged ──────────
export const DT = ({
  cols,
  rows,
  onRow,
  emptyMsg = "No records found.",
  maxHeightVh = DT_MAX_H_VH,
}) => {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [rows]);

  const useVirtual = rows.length > DT_VIRT_THR;
  const usePaging = rows.length > DT_PAGE_SIZE && !useVirtual;

  if (useVirtual) {
    const maxH =
      typeof window !== "undefined"
        ? Math.round(window.innerHeight * maxHeightVh)
        : 400;
    return <DTVirtual cols={cols} rows={rows} onRow={onRow} maxH={maxH} />;
  }
  if (usePaging)
    return (
      <DTPaged cols={cols} rows={rows} onRow={onRow} emptyMsg={emptyMsg} />
    );
  return <DTSmall cols={cols} rows={rows} onRow={onRow} emptyMsg={emptyMsg} />;
};
export const Search = ({ value, onChange, placeholder, debounceMs = 180 }) => {
  const [local, setLocal] = useState(value);
  // Sync external value → local (e.g. when parent resets)
  useEffect(() => {
    setLocal(value);
  }, [value]);
  // Debounce: only call onChange after user stops typing
  useEffect(() => {
    const t = setTimeout(() => {
      if (local !== value) onChange(local);
    }, debounceMs);
    return () => clearTimeout(t);
  }, [local, debounceMs]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div
      style={{ position: "relative", width: "100%", maxWidth: 280 }}
      role="search"
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 10,
          top: "50%",
          transform: "translateY(-50%)",
          color: T.muted,
          pointerEvents: "none",
        }}
      >
        ⌕
      </span>
      <label className="sr-only" htmlFor={`search-${placeholder || "q"}`}>
        {placeholder || "Search"}
      </label>
      <input
        id={`search-${placeholder || "q"}`}
        type="search"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder || "Search…"}
        aria-label={placeholder || "Search"}
        style={{
          background: T.card2,
          border: `1px solid ${T.border}`,
          borderRadius: 9,
          padding: "9px 12px 9px 28px",
          color: T.txt,
          fontSize: 13,
          outline: "none",
          width: "100%",
        }}
      />
    </div>
  );
};
export const Pills = ({ opts, val, onChange }) => (
  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
    {opts.map((o) => (
      <button
        key={o}
        onClick={() => onChange(o)}
        style={{
          background: val === o ? T.accent : T.card2,
          color: val === o ? "#060A10" : T.muted,
          border: `1px solid ${val === o ? T.accent : T.border}`,
          borderRadius: 99,
          padding: "5px 12px",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          transition: "all .15s",
        }}
      >
        {o}
      </button>
    ))}
  </div>
);

// ── Document lightbox viewer ──────────────────────────────────
export const DocViewer = ({ doc, onClose }) => {
  useModalLock();
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Document viewer — ${doc.name}`}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.94)",
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: MODAL_TOP_OFFSET,
        overflow: "hidden",
      }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label="Close document viewer"
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          background: "#ffffff20",
          border: "none",
          color: "#fff",
          borderRadius: 99,
          width: 36,
          height: 36,
          cursor: "pointer",
          fontSize: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span aria-hidden="true">✕</span>
      </button>
      <div
        style={{
          color: "#fff",
          fontSize: 13,
          fontWeight: 700,
          marginBottom: 12,
          opacity: 0.7,
        }}
      >
        {doc.name}
      </div>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "92vw",
          maxHeight: "80vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {doc.type?.startsWith("image/") ? (
          <img
            src={doc.dataUrl}
            alt={doc.name}
            style={{
              maxWidth: "92vw",
              maxHeight: "78vh",
              objectFit: "contain",
              borderRadius: 8,
              boxShadow: "0 8px 40px #000",
            }}
          />
        ) : (
          <div
            style={{
              background: "#1a2740",
              borderRadius: 12,
              padding: "40px 48px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 64, marginBottom: 16 }}>📄</div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>
              {doc.name}
            </div>
            <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 6 }}>
              PDF — cannot preview inline
            </div>
            <a
              href={doc.dataUrl}
              download={doc.name}
              style={{
                display: "inline-block",
                marginTop: 16,
                background: "#00D4AA",
                color: "#060A10",
                padding: "8px 20px",
                borderRadius: 8,
                fontWeight: 800,
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              ⬇ Download
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Structured Document Upload (4 fixed slots) ────────────────
const DOC_SLOTS = [
  {
    key: "id_front",
    label: "ID — Front",
    icon: "🪪",
    required: true,
    accept: "image/*",
    capture: "environment",
  },
  {
    key: "id_back",
    label: "ID — Back",
    icon: "🪪",
    required: true,
    accept: "image/*",
    capture: "environment",
  },
  {
    key: "passport",
    label: "Passport Photo",
    icon: "🖼️",
    required: true,
    accept: "image/*",
    capture: "user",
  },
  {
    key: "biz_doc",
    label: "Business Document",
    icon: "📋",
    required: false,
    accept: "image/*,application/pdf",
    capture: undefined,
  },
];

export const StructuredDocUpload = ({ docs, onAdd, onRemove }) => {
  const [uploading, setUploading] = useState({});
  const [viewing, setViewing] = useState(null);

  const handleFile = (e, slot) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading((u) => ({ ...u, [slot.key]: true }));
    const reader = new FileReader();
    reader.onload = (ev) => {
      const existing = docs.find((d) => d.key === slot.key);
      if (existing) onRemove(existing.id);
      onAdd({
        id: uid("DOC"),
        key: slot.key,
        name: slot.label,
        originalName: file.name,
        type: file.type,
        size: file.size,
        dataUrl: ev.target.result,
        uploaded: now(),
      });
      setUploading((u) => {
        const n = { ...u };
        delete n[slot.key];
        return n;
      });
      try {
        SFX.upload();
      } catch (e) {}
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {viewing && <DocViewer doc={viewing} onClose={() => setViewing(null)} />}
      {DOC_SLOTS.map((slot, idx) => {
        const doc = docs.find((d) => d.key === slot.key);
        const busy = uploading[slot.key];
        const isReady = !!doc;
        return (
          <div
            key={slot.key}
            style={{
              background: T.surface,
              border: `1.5px solid ${isReady ? T.ok : slot.required ? T.border : T.border}`,
              borderRadius: 12,
              padding: "12px 14px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              transition: "border-color .2s",
            }}
          >
            {/* Step number */}
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 99,
                background: isReady ? T.ok : T.border,
                color: isReady ? "#fff" : T.muted,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {isReady ? "✓" : idx + 1}
            </div>
            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 16 }}>{slot.icon}</span>
                <span style={{ color: T.txt, fontSize: 13, fontWeight: 700 }}>
                  {slot.label}
                </span>
                {slot.required && (
                  <span
                    style={{ color: T.danger, fontSize: 11, fontWeight: 700 }}
                  >
                    ★ Required
                  </span>
                )}
                {!slot.required && (
                  <span style={{ color: T.muted, fontSize: 11 }}>Optional</span>
                )}
              </div>
              {isReady ? (
                <div style={{ color: T.ok, fontSize: 11, marginTop: 2 }}>
                  ✓ Uploaded · {doc.uploaded}
                </div>
              ) : (
                <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>
                  {slot.required
                    ? "Must upload before proceeding"
                    : "Upload if available"}
                </div>
              )}
            </div>
            {/* Thumbnail / preview */}
            {isReady && (
              <div
                onClick={() => setViewing(doc)}
                style={{ cursor: "pointer", flexShrink: 0 }}
              >
                {doc.type?.startsWith("image/") ? (
                  <img
                    src={doc.dataUrl}
                    alt={slot.label}
                    style={{
                      width: 52,
                      height: 52,
                      objectFit: "cover",
                      borderRadius: 7,
                      border: `2px solid ${T.ok}`,
                      boxShadow: "0 2px 8px #00000040",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      background: T.card,
                      borderRadius: 7,
                      border: `2px solid ${T.ok}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                    }}
                  >
                    📄
                  </div>
                )}
              </div>
            )}
            {/* Actions */}
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              {isReady && (
                <>
                  <button
                    onClick={() => setViewing(doc)}
                    style={{
                      background: T.aLo,
                      border: `1px solid ${T.accent}38`,
                      color: T.accent,
                      borderRadius: 8,
                      padding: "6px 10px",
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    View
                  </button>
                  <button
                    onClick={() => onRemove(doc.id)}
                    style={{
                      background: T.dLo,
                      border: `1px solid ${T.danger}30`,
                      color: T.danger,
                      borderRadius: 8,
                      padding: "6px 10px",
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    Remove
                  </button>
                </>
              )}
              {!isReady && !busy && (
                <label
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    background: T.bLo,
                    border: `1px solid ${T.blue}38`,
                    borderRadius: 8,
                    padding: "7px 12px",
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: 14 }}>📎</span>
                  <span
                    style={{ color: T.blue, fontSize: 11, fontWeight: 700 }}
                  >
                    Upload
                  </span>
                  <input
                    type="file"
                    accept={slot.accept}
                    capture={slot.capture}
                    style={{ display: "none" }}
                    onChange={(e) => handleFile(e, slot)}
                  />
                </label>
              )}
              {busy && (
                <div
                  style={{ color: T.accent, fontSize: 11, padding: "7px 8px" }}
                >
                  Uploading…
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Document Upload Component (legacy freeform — kept for other uses) ─────────────────────────────────
const DocUpload = ({ docs, onAdd, onRemove, label }) => {
  const fileRef = useRef();
  const camRef = useRef();
  const [uploading, setUploading] = useState([]);
  const [toast, setToast] = useState("");

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  };

  const handleFile = (e, source) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const ids = files.map(() => uid("DOC"));
    setUploading(ids);
    files.forEach((file, fi) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const doc = {
          id: ids[fi],
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: ev.target.result,
          source,
          uploaded: now(),
        };
        onAdd(doc);
        setUploading((u) => u.filter((x) => x !== ids[fi]));
        if (fi === files.length - 1) {
          showToast(
            `✓ ${files.length} file${files.length > 1 ? "s" : ""} uploaded successfully`,
          );
          try {
            SFX.upload();
          } catch (e) {}
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <div
          style={{
            color: T.dim,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.7,
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          {label}
        </div>
      )}
      <div
        style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}
      >
        <label
          style={{
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: T.bLo,
            border: `1px solid ${T.blue}38`,
            color: T.blue,
            borderRadius: 8,
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          📎 Upload File
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            style={{ display: "none" }}
            onChange={(e) => handleFile(e, "storage")}
          />
        </label>
        <label
          style={{
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: T.aLo,
            border: `1px solid ${T.accent}38`,
            color: T.accent,
            borderRadius: 8,
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          📷 Use Camera
          <input
            ref={camRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={(e) => handleFile(e, "camera")}
          />
        </label>
      </div>
      {uploading.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <span style={{ color: T.dim, fontSize: 12 }}>
              Uploading {uploading.length} file{uploading.length > 1 ? "s" : ""}
              …
            </span>
          </div>
          <div
            style={{
              height: 5,
              background: T.border,
              borderRadius: 99,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: "60%",
                background: T.accent,
                borderRadius: 99,
                animation: "pulse 1s infinite",
              }}
            />
          </div>
        </div>
      )}
      {toast && (
        <div
          style={{
            background: T.oLo,
            border: `1px solid ${T.ok}38`,
            borderRadius: 8,
            padding: "8px 12px",
            color: T.ok,
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          {toast}
        </div>
      )}
      {docs && docs.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))",
            gap: 8,
          }}
        >
          {docs.map((doc) => (
            <div
              key={doc.id}
              style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: 9,
                padding: 8,
                position: "relative",
              }}
            >
              {doc.type?.startsWith("image/") ? (
                <img
                  src={doc.dataUrl}
                  alt={doc.name}
                  style={{
                    width: "100%",
                    height: 70,
                    objectFit: "cover",
                    borderRadius: 5,
                    marginBottom: 5,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: 70,
                    background: T.card,
                    borderRadius: 5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    marginBottom: 5,
                  }}
                >
                  📄
                </div>
              )}
              <div
                style={{
                  color: T.txt,
                  fontSize: 10,
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {doc.name}
              </div>
              <div style={{ color: T.muted, fontSize: 9 }}>
                {doc.source === "camera" ? "📷 Camera" : "📁 Upload"}
              </div>
              <button
                onClick={() => onRemove(doc.id)}
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  background: T.dLo,
                  border: "none",
                  color: T.danger,
                  borderRadius: 99,
                  width: 18,
                  height: 18,
                  cursor: "pointer",
                  fontSize: 9,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      {(!docs || docs.length === 0) && (
        <div
          style={{
            background: T.surface,
            border: `1px dashed ${T.border}`,
            borderRadius: 9,
            padding: "16px",
            textAlign: "center",
            color: T.muted,
            fontSize: 12,
          }}
        >
          No documents uploaded yet
        </div>
      )}
    </div>
  );
};

// ── Popup Validation Warning ──────────────────────────────────
export const ValidationPopup = ({ fields, onClose }) => {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);
  useEffect(() => {
    try {
      SFX.error();
    } catch (e) {}
  }, []);
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Validation errors — required fields missing"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(4,8,16,0.88)",
        zIndex: 9999,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: `${MODAL_TOP_OFFSET + 40}px 12px 12px`,
      }}
      onClick={onClose}
    >
      <div
        className="shake pop"
        style={{
          background: T.card,
          border: `2px solid ${T.danger}`,
          borderRadius: 18,
          padding: 28,
          maxWidth: 400,
          width: "100%",
          boxShadow: `0 0 40px ${T.danger}40`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>⚠️</div>
          <div
            style={{
              fontFamily: T.head,
              color: T.danger,
              fontSize: 17,
              fontWeight: 800,
            }}
          >
            Required Fields Missing
          </div>
          <div style={{ color: T.muted, fontSize: 13, marginTop: 4 }}>
            Please fill in all required fields before continuing.
          </div>
        </div>
        <div
          style={{
            background: T.dLo,
            borderRadius: 10,
            padding: "12px 14px",
            marginBottom: 16,
          }}
        >
          {fields.map((f) => (
            <div
              key={f}
              style={{
                color: T.danger,
                fontSize: 13,
                padding: "3px 0",
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <span style={{ color: T.danger }}>★</span> {f}
            </div>
          ))}
        </div>
        <Btn onClick={onClose} v="danger" full>
          OK, I'll fix it
        </Btn>
      </div>
    </div>
  );
};
// ═══════════════════════════════════════════
//  ONBOARD FORM (Lead → Customer)
// ═══════════════════════════════════════════
const ONBOARD_DRAFT_KEY = "acl_onboard_draft";
export const OnboardForm = ({ workers, onSave, onClose, prefill, leadId }) => {
  const [draftPrompt, setDraftPrompt] = useState(() => {
    try {
      const d = JSON.parse(localStorage.getItem(ONBOARD_DRAFT_KEY) || "null");
      return d && d.f?.name ? d : null;
    } catch (e) {
      return null;
    }
  });
  const blankF = {
    name: prefill?.name || "",
    dob: "",
    gender: "Female",
    idNo: "",
    phone: prefill?.phone || "",
    altPhone: "",
    businessName: prefill?.business || prefill?.businessName || "",
    businessType: prefill?.businessType || "Retail",
    businessLocation: prefill?.location || prefill?.businessLocation || "",
    residence: "",
    officer: prefill?.officer || "",
    n1n: "",
    n1p: "",
    n1r: "",
    n2n: "",
    n2p: "",
    n2r: "",
    n3n: "",
    n3p: "",
    n3r: "",
  };
  const [f, setF] = useState(blankF);
  const [docs, setDocs] = useState([]);
  const [step, setStep] = useState(1);
  const [valErr, setValErr] = useState(null);
  const [showVal, setShowVal] = useState(false);
  const s = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  // Autosave draft on every change
  useEffect(() => {
    try {
      localStorage.setItem(
        ONBOARD_DRAFT_KEY,
        JSON.stringify({
          f,
          step,
          savedAt: new Date().toLocaleTimeString("en-KE"),
        }),
      );
    } catch (e) {}
  }, [f, step]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(ONBOARD_DRAFT_KEY);
    } catch (e) {}
  };

  const continueDraft = () => {
    if (draftPrompt) {
      setF(draftPrompt.f);
      setStep(draftPrompt.step || 1);
    }
    setDraftPrompt(null);
  };
  const startFresh = () => {
    setF(blankF);
    setStep(1);
    setDocs([]);
    clearDraft();
    setDraftPrompt(null);
  };
  // FIX — Bug 8: SH was a component defined inside OnboardForm's render body, causing
  // remounting on every state change (every keystroke). Converted to a plain render fn.
  const renderSH = ({ title, icon }) => (
    <div
      style={{
        color: T.accent,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: "uppercase",
        margin: "4px 0 10px",
        gridColumn: "span 2",
        fontFamily: T.head,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span>{icon}</span>
      {title}
    </div>
  );

  const STEPS = [
    { n: 1, label: "Personal" },
    { n: 2, label: "Business" },
    { n: 3, label: "Next of Kin" },
    { n: 4, label: "Documents" },
    { n: 5, label: "Review" },
  ];

  const validateStep = () => {
    const missing = [];
    if (step === 1) {
      if (!f.name) missing.push("Full Name");
      if (!f.idNo) missing.push("National ID Number");
      if (!f.phone) missing.push("Primary Phone");
      if (!f.residence) missing.push("Residence");
    }
    if (step === 2) {
      if (!f.businessName) missing.push("Business Name");
      if (!f.businessLocation) missing.push("Business Location");
      if (!f.officer) missing.push("Assigned Officer");
    }
    if (step === 3) {
      if (!f.n1n) missing.push("Next of Kin 1 – Name");
      if (!f.n1p) missing.push("Next of Kin 1 – Phone");
      if (!f.n1r) missing.push("Next of Kin 1 – Relationship");
    }
    if (step === 4) {
      const mandatoryKeys = ["id_front", "id_back", "passport"];
      const uploadedKeys = docs.map((d) => d.key);
      if (!uploadedKeys.includes("id_front"))
        missing.push("National ID — Front (mandatory)");
      if (!uploadedKeys.includes("id_back"))
        missing.push("National ID — Back (mandatory)");
      if (!uploadedKeys.includes("passport"))
        missing.push("Passport Photo (mandatory)");
    }
    return missing;
  };

  const next = () => {
    const missing = validateStep();
    if (missing.length > 0) {
      setValErr(missing);
      setShowVal(true);
      try {
        SFX.error();
      } catch (e) {}
      return;
    }
    setStep((s) => Math.min(s + 1, 5));
  };

  const save = () => {
    onSave({
      id: uid("CUS"),
      ...f,
      loans: 0,
      risk: "Low",
      joined: now(),
      blacklisted: false,
      fromLead: leadId || null,
      docs,
    });
  };

  const handleSave = () => {
    clearDraft();
    save();
  };

  return (
    <div>
      {showVal && valErr && (
        <ValidationPopup fields={valErr} onClose={() => setShowVal(false)} />
      )}
      {/* Draft restore prompt */}
      {draftPrompt && (
        <div
          style={{
            background: T.gLo,
            border: `1px solid ${T.gold}38`,
            borderRadius: 12,
            padding: "14px 16px",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              color: T.gold,
              fontWeight: 800,
              fontSize: 14,
              marginBottom: 4,
            }}
          >
            📝 Unsaved Draft Found
          </div>
          <div style={{ color: T.muted, fontSize: 12, marginBottom: 10 }}>
            You have an unfinished registration for{" "}
            <b style={{ color: T.txt }}>{draftPrompt.f?.name || "unknown"}</b>{" "}
            saved at {draftPrompt.savedAt}. Continue where you left off?
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={continueDraft} sm>
              Continue Draft →
            </Btn>
            <Btn v="secondary" onClick={startFresh} sm>
              Start Fresh
            </Btn>
          </div>
        </div>
      )}
      {/* Step indicator */}
      <div
        style={{
          display: "flex",
          gap: 0,
          marginBottom: 20,
          borderRadius: 10,
          overflow: "hidden",
          border: `1px solid ${T.border}`,
        }}
      >
        {STEPS.map((st) => (
          <div
            key={st.n}
            style={{
              flex: 1,
              padding: "8px 4px",
              textAlign: "center",
              background: step >= st.n ? T.aMid : T.surface,
              borderRight: st.n < 5 ? `1px solid ${T.border}` : "none",
              transition: "background .2s",
            }}
          >
            <div
              style={{
                color: step > st.n ? T.accent : step === st.n ? T.txt : T.muted,
                fontSize: 10,
                fontWeight: 800,
              }}
            >
              {step > st.n ? "✓" : st.n}
            </div>
            <div
              style={{
                color: step >= st.n ? T.accent : T.muted,
                fontSize: 9,
                marginTop: 2,
              }}
            >
              {st.label}
            </div>
          </div>
        ))}
      </div>

      <div style={{ maxHeight: "55vh", overflowY: "auto", paddingRight: 4 }}>
        {step === 1 && (
          <div
            className="mob-grid1"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0 14px",
            }}
          >
            {renderSH({ title: "Personal Details", icon: "👤" })}
            <FI
              label="Full Name"
              value={f.name}
              onChange={s("name")}
              required
              error={true}
              half
            />
            <FI
              label="Date of Birth"
              value={f.dob}
              onChange={s("dob")}
              type="date"
              half
            />
            <FI
              label="Gender"
              value={f.gender}
              onChange={s("gender")}
              type="select"
              options={["Female", "Male", "Other"]}
              half
            />
            <NumericInput
              label="National ID No."
              value={f.idNo}
              onChange={s("idNo")}
              required
              half
              placeholder="e.g. 12345678"
            />
            <PhoneInput
              label="Primary Phone"
              value={f.phone}
              onChange={s("phone")}
              required
              half
            />
            <PhoneInput
              label="Alt Phone"
              value={f.altPhone}
              onChange={s("altPhone")}
              half
            />
            <FI
              label="Residence"
              value={f.residence}
              onChange={s("residence")}
              required
              error={true}
              half
            />
          </div>
        )}
        {step === 2 && (
          <div
            className="mob-grid1"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0 14px",
            }}
          >
            {renderSH({ title: "Business Details", icon: "🏪" })}
            <FI
              label="Business Name"
              value={f.businessName}
              onChange={s("businessName")}
              required
              error={true}
              half
            />
            <FI
              label="Business Type"
              value={f.businessType}
              onChange={s("businessType")}
              type="select"
              options={[
                "Butchery", "Carpentry", "Charcoal/firewood seller", "Clothes & Accessories", 
                "Food kiosk", "Fruits & Vegetables", "General shop", "Juakali artisan", 
                "Milk ATM", "Rentals/accommodation", "Agrovet", "Autospares", 
                "Animal feeds", "Bakery", "Boutique", "Salon/Kinyozi", 
                "Poultry", "Second hand items", "Photo studio", "DSTV/Video show", 
                "Health centre", "Electrical shop", "Bags", "Bookshop", 
                "Pharmacy", "Beauty & cosmetics", "Welding", "Wines & spirits", 
                "Money agent", "Fish seller", "Shoeshiner/repair", "Cereals", 
                "Malimali", "Movie shop", "Soaps & detergents", "Cyber cafe", 
                "Events & entertainment", "Gas cylinders", "Poshio mill", "Murtura base", 
                "Pond table", "School", "Ballar & sand", "Glass", 
                "Garage", "Computer college", "Dry cleaner", "Carpet seller", 
                "Car wash", "Timberyard", "Sugarcane", "Tailor", 
                "Bar & restaurant", "School uniforms", "Brick seller", "Bakery & weaving", 
                "Egg seller", "Gas shop", "Gym", "Shoe seller", 
                "Day care", "Security firm", "Curtains", "Ice cream", 
                "Maize", "Massage spa", "Chemicals", "Curios", 
                "Detergent supplier", "Electronics", "Loans on item", "Optician", 
                "Packaging material", "Potato seller", "Other", "Add option"
              ]}
              half
            />
            <FI
              label="Business Location"
              value={f.businessLocation}
              onChange={s("businessLocation")}
              required
              error={true}
              half
            />
            <FI
              label="Assigned Officer"
              value={f.officer}
              onChange={s("officer")}
              type="select"
              options={(workers || [])
                .filter((w) => w.status === "Active")
                .map((w) => w.name)}
              required
              error={true}
              half
            />
          </div>
        )}
        {step === 3 && (
          <div
            className="mob-grid1"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0 14px",
            }}
          >
            {renderSH({ title: "Next of Kin — 1 required", icon: "👨‍👩‍👧" })}
            {[
              [1, "n1n", "n1p", "n1r"],
              [2, "n2n", "n2p", "n2r"],
              [3, "n3n", "n3p", "n3r"],
            ].map(([n, nk, pk, rk]) => [
              <FI
                key={nk}
                label={`NOK ${n} Name`}
                value={f[nk]}
                onChange={s(nk)}
                required
                error={true}
                half
              />,
              <PhoneInput
                key={pk}
                label={`NOK ${n} Phone`}
                value={f[pk]}
                onChange={s(pk)}
                required
                half
              />,
              <FI
                key={rk}
                label={`NOK ${n} Relationship`}
                value={f[rk]}
                onChange={s(rk)}
                type="select"
                options={[
                  "",
                  "Spouse",
                  "Parent",
                  "Sibling",
                  "Child",
                  "Friend",
                  "Colleague",
                ]}
                required
                error={true}
                half
              />,
              <div
                key={`sep${n}`}
                style={{
                  gridColumn: "span 2",
                  height: 1,
                  background: T.border,
                  margin: "4px 0",
                }}
              />,
            ])}
          </div>
        )}
        {step === 4 && (
          <div>
            <div
              style={{
                color: T.accent,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: "uppercase",
                marginBottom: 10,
                fontFamily: T.head,
              }}
            >
              📎 KYC Documents
            </div>
            <Alert type="info" style={{ marginBottom: 12 }}>
              Upload the 3 mandatory documents in order. The business document
              is optional.
            </Alert>
            <StructuredDocUpload
              docs={docs}
              onAdd={(d) => setDocs((p) => [...p, d])}
              onRemove={(id) => setDocs((p) => p.filter((x) => x.id !== id))}
            />
          </div>
        )}
        {step === 5 && (
          <div>
            <Alert type="ok">
              ✓ Review all information before saving the customer profile.
            </Alert>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginBottom: 14,
              }}
            >
              {[
                ["Name", f.name],
                ["ID No.", f.idNo],
                ["Phone", f.phone],
                ["Residence", f.residence],
                ["Business", f.businessName],
                ["Business Type", f.businessType],
                ["Bus. Location", f.businessLocation],
                ["Officer", f.officer],
                ["NOK 1", `${f.n1n} · ${f.n1p}`],
                ["NOK 2", `${f.n2n} · ${f.n2p}`],
                ["NOK 3", `${f.n3n} · ${f.n3p}`],
                ["Documents", `${docs.length} uploaded`],
              ].map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    background: T.surface,
                    borderRadius: 8,
                    padding: "9px 12px",
                  }}
                >
                  <div
                    style={{
                      color: T.muted,
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: 0.6,
                      marginBottom: 2,
                    }}
                  >
                    {k}
                  </div>
                  <div style={{ color: T.txt, fontSize: 13, fontWeight: 600 }}>
                    {v || <span style={{ color: T.danger }}>Not filled</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 9,
          marginTop: 14,
          paddingTop: 12,
          borderTop: `1px solid ${T.border}`,
        }}
      >
        {step > 1 && (
          <Btn v="secondary" onClick={() => setStep((s) => s - 1)}>
            ← Back
          </Btn>
        )}
        {step < 5 && (
          <Btn onClick={next} full>
            Next →
          </Btn>
        )}
        {step === 5 && (
          <Btn onClick={handleSave} full>
            💾 Save Customer
          </Btn>
        )}
        <Btn v="ghost" onClick={onClose}>
          Cancel
        </Btn>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════
//  LOAN FORM
// ═══════════════════════════════════════════
export const LoanForm = ({
  customers,
  payments,
  loans,
  onSave,
  onClose,
  workerMode,
  workerName,
}) => {
  const [f, setF] = useState({ cid: "", repayType: "Monthly", amount: 5000 });
  const [showVal, setShowVal] = useState(false);
  const [custSearch, setCustSearch] = useState("");
  const [showCustDrop, setShowCustDrop] = useState(false);
  const s = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const cust = customers.find((c) => c.id === f.cid);
  const interest = Math.round(Number(f.amount || 0) * 0.3);
  const total = Number(f.amount || 0) + interest;
  const isNewCust = cust && cust.loans === 0;
  const fee = isNewCust ? 500 : 0;
  const hasRegFee =
    isNewCust &&
    payments &&
    payments.some((p) => p.customerId === cust.id && p.isRegFee);

  const REQUIRED_DOC_KEYS = ["id_front", "id_back", "passport"];
  const allLoansArr = loans || [];

  // Hard blocks: overdue/active loans. Soft warnings (worker only): missing docs
  const custEligibility = (cu, strict = false) => {
    const cl = allLoansArr.filter((l) => l.customerId === cu.id);
    const overdue = cl.filter((l) => l.status === "Overdue");
    const active = cl.filter((l) => l.status === "Active");
    const docs = cu.docs || [];
    const missing = REQUIRED_DOC_KEYS.filter(
      (k) => !docs.some((d) => d.key === k),
    );
    const hardReasons = [];
    const softReasons = [];
    if (overdue.length)
      hardReasons.push(
        `${overdue.length} overdue loan${overdue.length > 1 ? "s" : ""}`,
      );
    if (active.length)
      hardReasons.push(
        `${active.length} active loan${active.length > 1 ? "s" : ""}`,
      );
    if (missing.length)
      softReasons.push(
        `missing docs: ${missing.map((k) => k.replace("_", " ")).join(", ")}`,
      );
    const blocked = strict
      ? hardReasons.length > 0 || softReasons.length > 0
      : hardReasons.length > 0;
    return {
      eligible: !blocked,
      reasons: [...hardReasons, ...(strict ? softReasons : [])],
      warnings: softReasons,
    };
  };

  const selectedEligibility = cust
    ? custEligibility(cust, !!workerMode)
    : { eligible: true, reasons: [], warnings: [] };

  const filteredCusts = customers.filter(
    (c) =>
      !c.blacklisted &&
      (!custSearch ||
        c.name.toLowerCase().includes(custSearch.toLowerCase()) ||
        c.id.toLowerCase().includes(custSearch.toLowerCase()) ||
        c.phone.includes(custSearch)),
  );

  const calcSchedule = () => {
    const bal = total + fee;
    if (!bal) return [];
    const rt = f.repayType;
    if (rt === "Daily") {
      const d = 30;
      return [
        { p: "Per Day", a: Math.ceil(bal / d) },
        { p: "Per Week", a: Math.ceil(bal / d) * 7 },
        { p: "Per Month", a: bal },
      ];
    }
    if (rt === "Weekly") {
      return [
        { p: "Per Week", a: Math.ceil(bal / 4) },
        { p: "Per Month (4w)", a: bal },
      ];
    }
    if (rt === "Biweekly") {
      return [
        { p: "Per 2 Weeks", a: Math.ceil(bal / 2) },
        { p: "Per Month", a: bal },
      ];
    }
    if (rt === "Monthly") {
      return [{ p: "Per Month", a: bal }];
    }
    if (rt === "Lump Sum") {
      return [{ p: "One-time", a: bal }];
    }
    return [];
  };

  const save = () => {
    if (!f.cid || Number(f.amount) < 500) {
      setShowVal(true);
      return;
    }
    if (!selectedEligibility.eligible) {
      showToast(
        "⚠ This customer is not eligible for a new loan: " +
          selectedEligibility.reasons.join("; "),
        "danger",
      );
      return;
    }
    const status = workerMode ? "worker-pending" : "Application submitted";
    onSave({
      id: uid("LN"),
      customerId: f.cid,
      customer: cust.name,
      amount: Math.floor(Number(f.amount)),
      balance: total + fee,
      status,
      daysOverdue: 0,
      officer: workerName || cust.officer,
      risk: cust.risk,
      disbursed: null,
      mpesa: null,
      phone: cust.phone,
      repaymentType: f.repayType,
      payments: [],
    });
  };

  return (
    <div>
      {showVal && (
        <ValidationPopup
          fields={["Customer selection", "Loan amount (min KES 500)"]}
          onClose={() => setShowVal(false)}
        />
      )}
      {/* Searchable Customer Selector */}
      <div style={{ marginBottom: 12, position: "relative" }}>
        <label
          style={{
            display: "block",
            color: T.dim,
            fontSize: 11,
            fontWeight: 600,
            marginBottom: 5,
            letterSpacing: 0.7,
            textTransform: "uppercase",
          }}
        >
          Customer <span style={{ color: T.danger }}>★</span>
        </label>
        <div style={{ position: "relative" }}>
          <input
            value={cust ? `${cust.name} (${cust.id})` : custSearch}
            onChange={(e) => {
              setCustSearch(e.target.value);
              setF((p) => ({ ...p, cid: "" }));
              setShowCustDrop(true);
            }}
            onFocus={() => setShowCustDrop(true)}
            placeholder="Search by name, ID or phone…"
            style={{
              width: "100%",
              background: T.surface,
              border: `1px solid ${f.cid ? T.accent : T.border}`,
              borderRadius: 8,
              padding: "10px 12px",
              color: T.txt,
              fontSize: 14,
              outline: "none",
            }}
          />
          {cust && (
            <button
              onClick={() => {
                setF((p) => ({ ...p, cid: "" }));
                setCustSearch("");
                setShowCustDrop(true);
              }}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: T.muted,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              ✕
            </button>
          )}
        </div>
        {showCustDrop && !cust && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              background: T.card,
              border: `1px solid ${T.border}`,
              borderRadius: 10,
              zIndex: 500,
              maxHeight: 220,
              overflowY: "auto",
              boxShadow: "0 8px 24px #00000060",
              marginTop: 3,
            }}
          >
            {filteredCusts.length === 0 && (
              <div
                style={{
                  padding: "14px",
                  color: T.muted,
                  fontSize: 13,
                  textAlign: "center",
                }}
              >
                No customers found
              </div>
            )}
            {filteredCusts.map((c) => {
              const isNew = c.loans === 0;
              const elig = custEligibility(c, !!workerMode);
              return (
                <div
                  key={c.id}
                  onClick={() => {
                    setF((p) => ({ ...p, cid: c.id }));
                    setCustSearch("");
                    setShowCustDrop(false);
                  }}
                  style={{
                    padding: "10px 14px",
                    cursor: elig.eligible ? "pointer" : "not-allowed",
                    borderBottom: `1px solid ${T.border}20`,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: "transparent",
                    opacity: elig.eligible ? 1 : 0.6,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = T.surface)
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          color: elig.eligible ? T.txt : T.muted,
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        {c.name}
                      </span>
                      {isNew && (
                        <span
                          style={{
                            background: "#3B82F620",
                            color: T.blue,
                            border: `1px solid ${T.blue}38`,
                            borderRadius: 99,
                            padding: "1px 7px",
                            fontSize: 10,
                            fontWeight: 800,
                          }}
                        >
                          NEW
                        </span>
                      )}
                      {!elig.eligible && (
                        <span
                          style={{
                            background: T.dLo,
                            color: T.danger,
                            border: `1px solid ${T.danger}38`,
                            borderRadius: 99,
                            padding: "1px 7px",
                            fontSize: 10,
                            fontWeight: 800,
                          }}
                        >
                          INELIGIBLE
                        </span>
                      )}
                    </div>
                    <div style={{ color: T.muted, fontSize: 11, marginTop: 1 }}>
                      {c.id} · {c.phone} · {c.business || "—"}
                    </div>
                    {!elig.eligible && (
                      <div
                        style={{ color: T.danger, fontSize: 10, marginTop: 2 }}
                      >
                        {elig.reasons.join(" · ")}
                      </div>
                    )}
                  </div>
                  <Badge color={RC[c.risk]}>{c.risk}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {cust && (
        <>
          <Alert
            type={
              !selectedEligibility.eligible
                ? "danger"
                : isNewCust
                  ? "warn"
                  : "info"
            }
          >
            <b>{cust.name}</b> · {cust.loans} loan(s) · Risk: {cust.risk}
            {isNewCust && selectedEligibility.eligible && (
              <span style={{ color: T.gold }}>
                {" "}
                · 🆕 New client — KES 500 registration fee required
              </span>
            )}
            {!isNewCust && selectedEligibility.eligible && (
              <span style={{ color: T.ok }}> · Repeat client — no fee</span>
            )}
            {!selectedEligibility.eligible && (
              <div style={{ marginTop: 6 }}>
                <b style={{ color: T.danger }}>⛔ Not eligible:</b>
                <ul
                  style={{
                    margin: "4px 0 0 16px",
                    padding: 0,
                    color: T.danger,
                    fontSize: 12,
                  }}
                >
                  {selectedEligibility.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </Alert>
          {selectedEligibility.eligible &&
            (selectedEligibility.warnings || []).length > 0 && (
              <Alert type="warn" style={{ marginTop: 6 }}>
                ⚠ <b>Incomplete profile:</b>{" "}
                {(selectedEligibility.warnings || []).join(" · ")}. Loan can be
                submitted but disbursement should be withheld until documents
                are uploaded.
              </Alert>
            )}
        </>
      )}
      {isNewCust && !hasRegFee && selectedEligibility.eligible && (
        <Alert type="warn">
          ⚠ Registration fee not yet confirmed. Admin will need to verify before
          disbursement.
        </Alert>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0 14px",
        }}
      >
        <FI
          label="Amount (KES)"
          type="number"
          value={f.amount}
          onChange={s("amount")}
          hint="Min KES 500"
          required
          error={Number(f.amount) < 500}
          half
        />
        <FI
          label="Repayment Type"
          type="select"
          options={["Lump Sum", "Daily", "Weekly", "Biweekly", "Monthly"]}
          value={f.repayType}
          onChange={s("repayType")}
          half
        />
      </div>
      {Number(f.amount) >= 500 && (
        <div
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            padding: 13,
            marginBottom: 13,
          }}
        >
          <div
            style={{
              color: T.muted,
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.9,
              marginBottom: 9,
            }}
          >
            Loan Summary
          </div>
          {[
            ["Principal", fmt(f.amount)],
            ["Interest (30% flat)", fmt(interest)],
            ["Registration Fee", fmt(fee)],
            ["Total Repayable", fmt(total + fee)],
          ].map(([k, v]) => (
            <div
              key={k}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "5px 0",
                borderBottom: `1px solid ${T.border}18`,
                fontSize: 13,
              }}
            >
              <span style={{ color: T.muted }}>{k}</span>
              <span
                style={{
                  color: k.includes("Total") ? T.accent : T.txt,
                  fontWeight: k.includes("Total") ? 800 : 500,
                  fontFamily: T.mono,
                }}
              >
                {v}
              </span>
            </div>
          ))}
          {calcSchedule().length > 0 && (
            <div
              style={{
                marginTop: 10,
                paddingTop: 10,
                borderTop: `1px solid ${T.border}30`,
              }}
            >
              <div
                style={{
                  color: T.accent,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                  marginBottom: 7,
                }}
              >
                📅 Repayment Schedule
              </div>
              {calcSchedule().map(({ p, a }) => (
                <div
                  key={p}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "4px 0",
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: T.muted }}>{p}</span>
                  <span
                    style={{
                      color: T.accent,
                      fontFamily: T.mono,
                      fontWeight: 700,
                    }}
                  >
                    {fmt(a)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div style={{ display: "flex", gap: 9 }}>
        <Btn onClick={save} full disabled={!selectedEligibility.eligible}>
          {workerMode ? "Submit for Admin Approval →" : "Submit Application"}
        </Btn>
        <Btn v="secondary" onClick={onClose}>
          Cancel
        </Btn>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════
//  REMINDERS SYSTEM
// ═══════════════════════════════════════════
// Reminder seed uses relative future dates so they don't immediately fire as overdue
const _futureDate = (daysFromNow) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
};
const REMINDER_SEED = [
  {
    id: "REM-001",
    title: "Follow up with Peter Otieno",
    note: "Call him about the overdue payment of KES 13,420. He promised to pay by end of week. Check if M-Pesa payment came in.",
    dueDate: _futureDate(1),
    dueTime: "09:00",
    priority: "High",
    done: false,
    fired: false,
  },
  {
    id: "REM-002",
    title: "Board meeting prep",
    note: "Prepare the monthly portfolio report. Include PAR figures, collection rates, and disbursement totals.",
    dueDate: _futureDate(2),
    dueTime: "08:30",
    priority: "Medium",
    done: false,
    fired: false,
  },
  {
    id: "REM-003",
    title: "Disburse loan LN-2404",
    note: "David Kipchoge KES 50,000 loan approved and ready for disbursement. Confirm M-Pesa details before sending.",
    dueDate: _futureDate(3),
    dueTime: "14:00",
    priority: "High",
    done: false,
    fired: false,
  },
];

export const useReminders = () => {
  const [reminders, setReminders] = useState(REMINDER_SEED);
  const [firing, setFiring] = useState(null);

  // Check every 60s — no immediate call on mount to avoid cascade re-render
  useEffect(() => {
    const check = () => {
      const nowDT = new Date();
      setReminders((rs) => {
        let changed = false;
        const next = rs.map((r) => {
          if (r.done || r.fired) return r;
          const due = new Date(r.dueDate + "T" + r.dueTime + ":00");
          if (nowDT >= due) {
            changed = true;
            return { ...r, fired: true };
          }
          return r;
        });
        if (changed) {
          const fired = next.find(
            (r) => r.fired && !rs.find((x) => x.id === r.id && x.fired),
          );
          if (fired) {
            setTimeout(() => {
              try {
                SFX.reminder();
              } catch (e) {}
              setFiring(fired);
            }, 0);
          }
        }
        return changed ? next : rs;
      });
    };
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, []);

  const add = (rem) => setReminders((rs) => [rem, ...rs]);
  const done = (id) =>
    setReminders((rs) =>
      rs.map((r) => (r.id === id ? { ...r, done: true } : r)),
    );
  const remove = (id) => setReminders((rs) => rs.filter((r) => r.id !== id));
  const update = (rem) =>
    setReminders((rs) => rs.map((r) => (r.id === rem.id ? rem : r)));
  const dismissFiring = () => setFiring(null);

  return { reminders, add, done, remove, update, firing, dismissFiring };
};

export const ReminderAlertModal = ({ reminder, onDismiss, onDone }) => (
  <div
    className="dialog-backdrop"
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 99998,
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
      paddingTop: MODAL_TOP_OFFSET + 30,
      paddingLeft: 20,
      paddingRight: 20,
      background: "rgba(4,8,16,0.8)",
      backdropFilter: "blur(8px)",
      overflow: "hidden",
    }}
  >
    <div
      className="pop"
      style={{
        background: T.card,
        border: `2px solid ${T.gold}`,
        borderRadius: 22,
        padding: "28px 26px",
        width: "100%",
        maxWidth: 380,
        boxShadow: `0 0 60px ${T.gold}30,0 40px 80px #000000D0`,
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <div
          style={{
            fontSize: 44,
            marginBottom: 10,
            animation: "pulse 1s infinite",
          }}
        >
          ⏰
        </div>
        <div
          style={{
            fontFamily: T.head,
            color: T.gold,
            fontSize: 18,
            fontWeight: 900,
          }}
        >
          Reminder
        </div>
        <div
          style={{ color: T.txt, fontWeight: 700, fontSize: 15, marginTop: 6 }}
        >
          {reminder.title}
        </div>
        <div style={{ color: T.muted, fontSize: 12, marginTop: 4 }}>
          {reminder.dueDate} at {reminder.dueTime}
        </div>
      </div>
      <div
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          padding: "12px 14px",
          marginBottom: 18,
          color: T.dim,
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        {reminder.note || "No additional notes."}
      </div>
      <div style={{ display: "flex", gap: 9 }}>
        <Btn
          v="gold"
          full
          onClick={() => {
            onDone(reminder.id);
            onDismiss();
          }}
        >
          ✓ Mark Done
        </Btn>
        <Btn v="secondary" onClick={onDismiss}>
          Dismiss
        </Btn>
      </div>
    </div>
  </div>
);

// FIX C — ReminderCard hoisted to module scope.
// Previously defined INSIDE RemindersPanel's render body, meaning React saw a new
// component type on every render → unmount+remount of every card, destroying any
// interactions mid-gesture and causing consistent jank in the reminders list.
const PC_COLORS = { High: T.danger, Medium: T.gold, Low: T.ok };
const ReminderCard = ({ r, onClick, onDone, onRemove }) => {
  const due = new Date(`${r.dueDate}T${r.dueTime}:00`);
  const overdue = !r.done && due < new Date();
  return (
    <div
      onClick={onClick}
      style={{
        background: T.surface,
        border: `1px solid ${overdue ? T.danger : PC_COLORS[r.priority] + "30"}`,
        borderRadius: 12,
        padding: "13px 15px",
        cursor: "pointer",
        transition: "all .15s",
        marginBottom: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              color: r.done ? T.muted : T.txt,
              fontWeight: 700,
              fontSize: 13,
              marginBottom: 3,
              textDecoration: r.done ? "line-through" : "none",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {r.title}
          </div>
          <div style={{ color: T.muted, fontSize: 11 }}>
            {r.dueDate} · {r.dueTime}
          </div>
          {r.note && (
            <div
              style={{
                color: T.dim,
                fontSize: 12,
                marginTop: 4,
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {r.note}
            </div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 5,
            flexShrink: 0,
          }}
        >
          <Badge color={PC_COLORS[r.priority] || T.muted}>{r.priority}</Badge>
          {overdue && <Badge color={T.danger}>Overdue</Badge>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        {!r.done && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDone(r.id);
              SFX.save();
            }}
            style={{
              background: T.oLo,
              border: `1px solid ${T.ok}38`,
              color: T.ok,
              borderRadius: 7,
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ✓ Done
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(r.id);
          }}
          style={{
            background: T.dLo,
            border: `1px solid ${T.danger}38`,
            color: T.danger,
            borderRadius: 7,
            padding: "4px 10px",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export const RemindersPanel = ({
  reminders,
  onAdd,
  onDone,
  onRemove,
  onUpdate,
  onClose,
}) => {
  const [showNew, setShowNew] = useState(false);
  const [sel, setSel] = useState(null); // reading/editing a reminder
  const [f, setF] = useState({
    title: "",
    note: "",
    dueDate: now(),
    dueTime: "09:00",
    priority: "Medium",
  });
  const s = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  const save = () => {
    if (!f.title) return;
    const rem = { id: uid("REM"), ...f, done: false, fired: false };
    onAdd(rem);
    SFX.save();
    setShowNew(false);
    setF({
      title: "",
      note: "",
      dueDate: now(),
      dueTime: "09:00",
      priority: "Medium",
    });
  };

  const saveEdit = () => {
    if (!sel) return;
    onUpdate(sel);
    SFX.save();
    setSel(null);
  };

  const active = useMemo(
    () =>
      reminders
        .filter((r) => !r.done)
        .sort(
          (a, b) =>
            new Date(a.dueDate + "T" + a.dueTime) -
            new Date(b.dueDate + "T" + b.dueTime),
        ),
    [reminders],
  );
  const completed = useMemo(() => reminders.filter((r) => r.done), [reminders]);

  return (
    <Panel
      title="Reminders"
      subtitle={`${active.length} active · ${completed.length} completed`}
      onClose={onClose}
      width={480}
    >
      <div style={{ marginBottom: 14 }}>
        <Btn full onClick={() => setShowNew((s) => !s)}>
          + New Reminder
        </Btn>
      </div>

      {showNew && (
        <div
          style={{
            background: T.card2,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            padding: "16px 16px",
            marginBottom: 18,
          }}
        >
          <div
            style={{
              color: T.txt,
              fontWeight: 700,
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            New Reminder
          </div>
          <FI
            label="Title"
            value={f.title}
            onChange={s("title")}
            required
            placeholder="e.g. Call Peter about overdue loan"
          />
          <FI
            label="Notes"
            type="textarea"
            value={f.note}
            onChange={s("note")}
            placeholder="Add details, context, or instructions…"
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0 14px",
            }}
          >
            <FI
              label="Date"
              type="date"
              value={f.dueDate}
              onChange={s("dueDate")}
              half
            />
            <FI
              label="Time"
              type="time"
              value={f.dueTime}
              onChange={s("dueTime")}
              half
            />
          </div>
          <FI
            label="Priority"
            type="select"
            options={["High", "Medium", "Low"]}
            value={f.priority}
            onChange={s("priority")}
          />
          <div style={{ display: "flex", gap: 9 }}>
            <Btn full onClick={save}>
              Save Reminder
            </Btn>
            <Btn v="secondary" onClick={() => setShowNew(false)}>
              Cancel
            </Btn>
          </div>
        </div>
      )}

      {/* Read / Edit modal */}
      {sel && (
        <div
          className="dialog-backdrop"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: MODAL_TOP_OFFSET + 30,
            paddingLeft: 20,
            paddingRight: 20,
            background: "rgba(4,8,16,0.7)",
            backdropFilter: "blur(6px)",
            overflow: "hidden",
          }}
        >
          <div
            className="pop"
            style={{
              background: T.card,
              border: `1px solid ${T.hi}`,
              borderRadius: 20,
              width: "100%",
              maxWidth: 440,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 40px 80px #000000D0",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "18px 22px 14px",
                borderBottom: `1px solid ${T.border}`,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  color: T.txt,
                  fontWeight: 800,
                  fontSize: 15,
                  fontFamily: T.head,
                }}
              >
                Edit Reminder
              </div>
              <button
                onClick={() => {
                  setSel(null);
                }}
                style={{
                  background: T.card2,
                  border: `1px solid ${T.border}`,
                  color: T.muted,
                  borderRadius: 99,
                  width: 28,
                  height: 28,
                  cursor: "pointer",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
              <FI
                label="Title"
                value={sel.title}
                onChange={(v) => setSel((s) => ({ ...s, title: v }))}
                required
              />
              <FI
                label="Notes"
                type="textarea"
                value={sel.note || ""}
                onChange={(v) => setSel((s) => ({ ...s, note: v }))}
                placeholder="Notes…"
              />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0 14px",
                }}
              >
                <FI
                  label="Date"
                  type="date"
                  value={sel.dueDate}
                  onChange={(v) => setSel((s) => ({ ...s, dueDate: v }))}
                  half
                />
                <FI
                  label="Time"
                  type="time"
                  value={sel.dueTime}
                  onChange={(v) => setSel((s) => ({ ...s, dueTime: v }))}
                  half
                />
              </div>
              <FI
                label="Priority"
                type="select"
                options={["High", "Medium", "Low"]}
                value={sel.priority}
                onChange={(v) => setSel((s) => ({ ...s, priority: v }))}
              />
              <div style={{ display: "flex", gap: 9 }}>
                <Btn full onClick={saveEdit}>
                  Save Changes
                </Btn>
                <Btn v="secondary" onClick={() => setSel(null)}>
                  Cancel
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {active.length === 0 && (
        <div
          style={{
            color: T.muted,
            textAlign: "center",
            padding: "24px 0",
            fontSize: 13,
          }}
        >
          No active reminders
        </div>
      )}
      <div
        style={{ maxHeight: "40vh", overflowY: "auto", overflowX: "hidden" }}
      >
        {active.map((r) => (
          <ReminderCard
            key={r.id}
            r={r}
            onClick={() => setSel({ ...r })}
            onDone={onDone}
            onRemove={onRemove}
          />
        ))}
      </div>

      {completed.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              color: T.muted,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.8,
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            Completed ({completed.length})
          </div>
          <div
            style={{
              maxHeight: "40vh",
              overflowY: "auto",
              overflowX: "hidden",
            }}
          >
            {completed.map((r) => (
              <ReminderCard
                key={r.id}
                r={r}
                onClick={() => setSel({ ...r })}
                onDone={onDone}
                onRemove={onRemove}
              />
            ))}
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
const CustomerContactPopup = ({ name, phone, onClose, anchorX, anchorY }) => {
  if (!phone) return null;
  const popRef = useRef(null);
  const p = (phone || "").replace(/\s/g, "");
  const waPhone = p.startsWith("0") ? "254" + p.slice(1) : p;
  const smsText = encodeURIComponent(
    `Dear ${(name || "").split(" ")[0]}, this is a message from Adequate Capital Ltd regarding your account. Please contact us at your earliest convenience.`,
  );
  const waText = encodeURIComponent(
    `Hello ${(name || "").split(" ")[0]}, this is Adequate Capital Ltd. Please contact us regarding your account.`,
  );

  // Compute smart position — anchored to same line as the name
  const vw = typeof window !== "undefined" ? window.innerWidth : 800;
  const vh = typeof window !== "undefined" ? window.innerHeight : 600;
  const POPW = 260,
    POPH = 168;
  // Place to the right of the click point
  let left = anchorX != null ? anchorX + 16 : vw / 2 - POPW / 2;
  // Vertically center on the click point (same line as the name)
  let top = anchorY != null ? anchorY - POPH / 2 : vh / 2 - POPH / 2;
  // Flip left if too close to right edge
  if (left + POPW > vw - 12)
    left = Math.max(8, (anchorX ?? vw / 2) - POPW - 16);
  // Clamp vertically
  if (top + POPH > vh - 8) top = vh - POPH - 8;
  if (top < 8) top = 8;

  // Close on outside click
  useEffect(() => {
    const h = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", h, true);
    return () => document.removeEventListener("mousedown", h, true);
  }, [onClose]);

  return (
    <>
      {/* Transparent backdrop — just closes on click outside */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99998,
          pointerEvents: "all",
          overflow: "hidden",
        }}
        onClick={onClose}
      />
      <div
        ref={popRef}
        className="pop"
        style={{
          position: "fixed",
          left,
          top,
          zIndex: 99999,
          background: T.card,
          border: `1px solid ${T.hi}`,
          borderRadius: 16,
          padding: "16px 16px 14px",
          width: POPW,
          boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
          backdropFilter: "blur(8px)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                color: T.txt,
                fontWeight: 800,
                fontSize: 14,
                fontFamily: T.head,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {name}
            </div>
            <div
              style={{
                color: T.muted,
                fontSize: 11,
                marginTop: 2,
                fontFamily: T.mono,
              }}
            >
              {phone}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: T.card2,
              border: `1px solid ${T.border}`,
              color: T.muted,
              borderRadius: 99,
              width: 24,
              height: 24,
              cursor: "pointer",
              fontSize: 11,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginLeft: 8,
            }}
          >
            ✕
          </button>
        </div>
        {/* Action buttons — compact horizontal row */}
        <div style={{ display: "flex", gap: 7 }}>
          <a
            href={`tel:${p}`}
            onClick={() => {
              onClose();
              SFX.send();
            }}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 5,
              background: T.oLo,
              border: `1px solid ${T.ok}38`,
              borderRadius: 11,
              padding: "10px 6px",
              textDecoration: "none",
              color: T.ok,
              fontWeight: 700,
              fontSize: 11,
              transition: "background .15s",
            }}
          >
            <span style={{ fontSize: 20 }}>📞</span>
            <span>Call</span>
          </a>
          <a
            href={`sms:${p}?body=${smsText}`}
            onClick={() => {
              onClose();
              SFX.send();
            }}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 5,
              background: T.bLo,
              border: `1px solid ${T.blue}38`,
              borderRadius: 11,
              padding: "10px 6px",
              textDecoration: "none",
              color: T.blue,
              fontWeight: 700,
              fontSize: 11,
            }}
          >
            <span style={{ fontSize: 20 }}>💬</span>
            <span>SMS</span>
          </a>
          <a
            href={`https://wa.me/${waPhone}?text=${waText}`}
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              onClose();
              SFX.send();
            }}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 5,
              background: "#25D36618",
              border: "1px solid #25D36638",
              borderRadius: 11,
              padding: "10px 6px",
              textDecoration: "none",
              color: "#25D366",
              fontWeight: 700,
              fontSize: 11,
            }}
          >
            <span style={{ fontSize: 20 }}>📱</span>
            <span>WhatsApp</span>
          </a>
        </div>
      </div>
    </>
  );
};

// Hook for contact popup — stores mouse position for anchoring
export const useContactPopup = () => {
  const [contact, setContact] = useState(null); // {name, phone, x, y}
  const open = (name, phone, event) => {
    const x = event?.clientX ?? null;
    const y = event?.clientY ?? null;
    setContact({ name, phone, x, y });
    try {
      SFX.notify();
    } catch (e) {}
  };
  const close = () => setContact(null);
  const Popup = contact ? (
    <CustomerContactPopup
      name={contact.name}
      phone={contact.phone}
      onClose={close}
      anchorX={contact.x}
      anchorY={contact.y}
    />
  ) : null;
  return { open, close, Popup };
};

// ═══════════════════════════════════════════
//  DASHBOARD — Animated Pie Charts
// ═══════════════════════════════════════════
const DonutChart = ({
  segments,
  size = 160,
  thickness = 32,
  label,
  sub,
  centerValue,
  centerLabel,
  onClickSegment,
}) => {
  const [animated, setAnimated] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [clicked, setClicked] = useState(null);
  const hovRef = useRef(null);

  // FIX 2A — Animation: previously animated=false made animEnd===startA (zero-length arc)
  // so SVG rendered nothing until the 80ms timeout fired. Now segments always draw at full
  // size; the CSS 'pop' class on the SVG wrapper handles the visual entrance animation.
  // The animated state is kept only for the clip/scale entrance, not for arc geometry.
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 60);
    return () => clearTimeout(t);
  }, []);

  const setHovDebounced = useCallback((i) => {
    clearTimeout(hovRef.current);
    if (i === null) {
      hovRef.current = setTimeout(() => setHovered(null), 60);
    } else {
      setHovered(i);
    }
  }, []);

  const total = segments.reduce((s, sg) => s + sg.value, 0) || 1;
  const R = size / 2;
  const r = R - thickness;
  const cx = R,
    cy = R;

  const segAngles = useMemo(() => {
    let cum = -Math.PI / 2;
    return segments.map((sg) => {
      const angle = (sg.value / total) * (Math.PI * 2);
      const start = cum;
      cum += angle;
      return { start, end: cum, angle, mid: start + angle / 2 };
    });
  }, [segments, total]);

  const paths = segments.map((sg, i) => {
    const { start: startA, angle, mid: midA } = segAngles[i];
    if (sg.value === 0) return null;

    // FIX 2B — Always use the full angle for geometry. Previously (animated ? angle : 0)
    // produced zero-length arcs (invisible) before the 80ms timeout. Now segments are
    // always drawn at full size. The entrance animation is CSS-only (opacity on the SVG).
    const endA = startA + angle;
    const x1 = cx + R * Math.cos(startA),
      y1 = cy + R * Math.sin(startA);
    const x2 = cx + R * Math.cos(endA),
      y2 = cy + R * Math.sin(endA);
    const ix1 = cx + r * Math.cos(startA),
      iy1 = cy + r * Math.sin(startA);
    const ix2 = cx + r * Math.cos(endA),
      iy2 = cy + r * Math.sin(endA);
    const large = angle > Math.PI ? 1 : 0;
    const d = `M${x1},${y1} A${R},${R} 0 ${large},1 ${x2},${y2} L${ix2},${iy2} A${r},${r} 0 ${large},0 ${ix1},${iy1} Z`;
    const isHov = hovered === i;
    const isClick = clicked === i;
    const off = isHov ? 7 : isClick ? 5 : 0;
    const tx = off ? Math.cos(midA) * off : 0;
    const ty = off ? Math.sin(midA) * off : 0;
    const hR = R + 6,
      hr = Math.max(r - 6, 2);
    const hx1 = cx + hR * Math.cos(startA),
      hy1 = cy + hR * Math.sin(startA);
    const hx2 = cx + hR * Math.cos(endA),
      hy2 = cy + hR * Math.sin(endA);
    const hix1 = cx + hr * Math.cos(startA),
      hiy1 = cy + hr * Math.sin(startA);
    const hix2 = cx + hr * Math.cos(endA),
      hiy2 = cy + hr * Math.sin(endA);
    const hd = `M${hx1},${hy1} A${hR},${hR} 0 ${large},1 ${hx2},${hy2} L${hix2},${hiy2} A${hr},${hr} 0 ${large},0 ${hix1},${hiy1} Z`;
    return (
      <g
        key={i}
        onMouseEnter={() => setHovDebounced(i)}
        onMouseLeave={() => setHovDebounced(null)}
        onClick={() => {
          setClicked(i);
          setTimeout(() => setClicked(null), 600);
          if (onClickSegment) onClickSegment(sg, i);
        }}
      >
        <path d={hd} fill="transparent" style={{ cursor: "pointer" }} />
        <path
          d={d}
          fill={sg.color}
          opacity={
            clicked !== null
              ? isClick
                ? 1
                : 0.35
              : hovered === null
                ? 1
                : isHov
                  ? 1
                  : 0.5
          }
          transform={`translate(${tx},${ty})`}
          filter={isClick ? `drop-shadow(0 0 8px ${sg.color})` : "none"}
          style={{
            transition:
              "opacity .15s, transform .18s cubic-bezier(.22,1,.36,1)",
            cursor: "pointer",
            pointerEvents: "none",
          }}
        />
      </g>
    );
  });

  const hovSeg =
    hovered !== null
      ? segments[hovered]
      : clicked !== null
        ? segments[clicked]
        : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      {label && (
        <div
          style={{
            color: T.txt,
            fontWeight: 700,
            fontSize: 13,
            textAlign: "center",
          }}
        >
          {label}
        </div>
      )}
      <div
        style={{
          position: "relative",
          width: size,
          height: size,
          overflow: "visible",
        }}
      >
        <svg
          width={size}
          height={size}
          style={{
            overflow: "visible",
            opacity: animated ? 1 : 0,
            transition: "opacity .3s ease",
          }}
        >
          <circle
            cx={cx}
            cy={cy}
            r={(R + r) / 2}
            fill="none"
            stroke={T.border}
            strokeWidth={thickness}
            opacity={0.4}
          />
          {paths}
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          {hovSeg ? (
            <>
              <div
                style={{
                  color: hovSeg.color,
                  fontWeight: 900,
                  fontSize: 14,
                  fontFamily: T.mono,
                  lineHeight: 1,
                }}
              >
                {((hovSeg.value / total) * 100).toFixed(1)}%
              </div>
              <div
                style={{
                  color: T.muted,
                  fontSize: 10,
                  marginTop: 2,
                  textAlign: "center",
                  maxWidth: r * 1.4,
                }}
              >
                {hovSeg.label}
              </div>
            </>
          ) : (
            <>
              {centerValue && (
                <div
                  style={{
                    color: T.txt,
                    fontWeight: 900,
                    fontSize: 16,
                    fontFamily: T.mono,
                    lineHeight: 1,
                  }}
                >
                  {centerValue}
                </div>
              )}
              {centerLabel && (
                <div
                  style={{
                    color: T.muted,
                    fontSize: 10,
                    marginTop: 2,
                    textAlign: "center",
                  }}
                >
                  {centerLabel}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 5,
          width: "100%",
        }}
      >
        {segments
          .filter((s) => s.value > 0)
          .map((s, i) => (
            <div
              key={s.label || s.color || i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "4px 6px",
                borderRadius: 7,
                background:
                  hovered === i
                    ? s.color + "14"
                    : clicked === i
                      ? s.color + "22"
                      : "transparent",
                transition: "background .15s",
                cursor: onClickSegment ? "pointer" : "default",
              }}
              onMouseEnter={() => setHovDebounced(i)}
              onMouseLeave={() => setHovDebounced(null)}
              onClick={() => {
                if (onClickSegment) onClickSegment(s, i);
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 99,
                  background: s.color,
                  flexShrink: 0,
                  boxShadow: `0 0 4px ${s.color}88`,
                }}
              />
              <span style={{ color: T.muted, fontSize: 11, flex: 1 }}>
                {s.label}
              </span>
              <span
                style={{
                  color: s.color,
                  fontFamily: T.mono,
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                {s.value >= 1e6
                  ? (s.value / 1e6).toFixed(2) + "M"
                  : s.value >= 1e3
                    ? (s.value / 1e3).toFixed(1) + "K"
                    : s.value.toLocaleString()}
              </span>
            </div>
          ))}
      </div>
      {sub && (
        <div
          style={{
            color: T.muted,
            fontSize: 10,
            textAlign: "center",
            marginTop: 2,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
};

export const LivePortfolioChart = ({
  loans,
  payments,
  customers,
  onNav,
  setDrill,
  openContact,
  custPhone,
  scrollTop,
}) => {
  // FIX — memoize all expensive filter/reduce derivations so they only recalculate
  // when the underlying data arrays actually change.
  const derived = useMemo(() => {
    const paidMap = payments.reduce((acc, p) => {
      if (p.loanId && p.status === "Allocated")
        acc[p.loanId] = (acc[p.loanId] || 0) + p.amount;
      return acc;
    }, {});

    const calcDue = (l) => {
      const paid = paidMap[l.id] || 0;
      const baseInt = Math.round((l.amount || 0) * 0.3);
      const eng = calculateLoanStatus(l);
      return Math.max(0, (l.amount || 0) + baseInt + eng.interestAccrued + eng.penaltyAccrued - paid);
    };

    const activeList = loans.filter((l) => l.status === "Active");
    const overdueList = loans.filter((l) => l.status === "Overdue");
    const settledList = loans.filter((l) => l.status === "Settled");
    const writtenList = loans.filter((l) => l.status === "Written off");

    const active = activeList.reduce((s, l) => s + calcDue(l), 0);
    const overdue = overdueList.reduce((s, l) => s + calcDue(l), 0);
    const book = active + overdue;
    
    const approved = loans
      .filter((l) => l.status === "Approved")
      .reduce((s, l) => s + l.amount * 1.3, 0);

    const settledVolume = settledList.reduce((s, l) => s + l.amount * 1.3, 0);
    const writtenVolume = writtenList.reduce((s, l) => s + calcDue(l), 0);

    const coll = payments
      .filter((p) => p.status === "Allocated")
      .reduce((s, p) => s + p.amount, 0);
    const unalloc = payments
      .filter((p) => p.status === "Unallocated")
      .reduce((s, p) => s + p.amount, 0);

    const totalDisb = loans.filter(l => !['Rejected', 'Application submitted'].includes(l.status)).reduce((s, l) => s + l.amount, 0);
    const totalExpectedVolume = totalDisb * 1.3;

    const par1 = loans.filter((l) => l.daysOverdue >= 1).length;
    const parTotal = loans.filter((l) => !["Settled", "Written off", "Rejected", "Application submitted"].includes(l.status)).length || 1;
    
    const paidLoanIds = new Set(
      payments
        .filter((p) => p.status === "Allocated" && p.loanId)
        .map((p) => p.loanId),
    );
    const healthyCount = loans.filter(
      (l) => l.status === "Active" && paidLoanIds.has(l.id),
    ).length;
    
    return {
      book,
      overdue,
      active,
      approved,
      settledVolume,
      writtenVolume,
      coll,
      unalloc,
      totalDisb,
      totalExpectedVolume,
      par1,
      parTotal,
      healthyCount,
    };
  }, [loans, payments, customers]);
  const {
    book,
    overdue,
    active,
    approved,
    settledVolume,
    writtenVolume,
    coll,
    unalloc,
    totalDisb,
    totalExpectedVolume,
    par1,
    parTotal,
    healthyCount,
  } = derived;

  const fmtK = (v) =>
    v >= 1e6
      ? (v / 1e6).toFixed(2) + "M"
      : v >= 1e3
        ? (v / 1e3).toFixed(1) + "K"
        : v.toLocaleString("en-KE");

  const charts = [
    {
      label: "Loan Portfolio",
      sub: `Total book: KES ${fmtK(book)}`,
      centerValue: `KES ${fmtK(book)}`,
      centerLabel: "Total",
      segments: [
        {
          label: "Active Loans",
          value: active,
          color: T.ok,
          nav: "loans",
          navFilter: "Active",
        },
        {
          label: "Overdue",
          value: overdue,
          color: T.danger,
          nav: "collections",
          navFilter: "Overdue",
        },
        {
          label: "Approved (pending)",
          value: approved,
          color: T.gold,
          nav: "loans",
          navFilter: "Approved",
        },
      ],
    },
    {
      label: "Collections",
      sub: `Disbursed: KES ${fmtK(totalDisb)}`,
      centerValue:
        totalExpectedVolume > 0 ? ((coll / totalExpectedVolume) * 100).toFixed(0) + "%" : "—",
      centerLabel: "Rate",
      segments: [
        {
          label: "Collected",
          value: coll,
          color: T.accent,
          nav: "payments",
          navFilter: "Allocated",
        },
        {
          label: "Outstanding",
          value: book,
          color: T.warn,
          nav: "loans",
          navFilter: "Active",
        },
        {
          label: "Unallocated payments",
          value: unalloc,
          color: T.blue,
          nav: "payments",
          navFilter: "Unallocated",
        },
        {
          label: "Written off/Settled",
          value: settledVolume + writtenVolume,
          color: T.muted,
          nav: "loans",
          navFilter: "Settled",
        },
      ],
    },
    {
      label: "Portfolio at Risk",
      sub: `${par1} loans overdue`,
      centerValue: `${((par1 / parTotal) * 100).toFixed(1)}%`,
      centerLabel: "PAR",
      segments: [
        {
          label: "Healthy (paying)",
          value: healthyCount,
          color: T.ok,
          nav: "loans",
          navFilter: "Active",
        },
        {
          label: "PAR 1–6 days",
          value: loans.filter((l) => l.daysOverdue >= 1 && l.daysOverdue < 7)
            .length,
          color: T.warn,
          nav: "collections",
          navFilter: "Overdue",
        },
        {
          label: "PAR 7–29 days",
          value: loans.filter((l) => l.daysOverdue >= 7 && l.daysOverdue < 30)
            .length,
          color: T.danger,
          nav: "collections",
          navFilter: "Overdue",
        },
        {
          label: "PAR 30+ days",
          value: loans.filter((l) => l.daysOverdue >= 30).length,
          color: T.purple,
          nav: "collections",
          navFilter: "Overdue",
        },
      ],
    },
    {
      label: "Customer Risk",
      sub: `${customers.length} total customers`,
      centerValue: customers.length,
      centerLabel: "Customers",
      segments: [
        {
          label: "Low risk",
          value: customers.filter((c) => c.risk === "Low").length,
          color: T.ok,
          nav: "customers",
          navFilter: "Low",
        },
        {
          label: "Medium risk",
          value: customers.filter((c) => c.risk === "Medium").length,
          color: T.warn,
          nav: "customers",
          navFilter: "Medium",
        },
        {
          label: "High risk",
          value: customers.filter((c) => c.risk === "High").length,
          color: T.danger,
          nav: "customers",
          navFilter: "High",
        },
        {
          label: "Very High risk",
          value: customers.filter((c) => c.risk === "Very High").length,
          color: T.purple,
          nav: "customers",
          navFilter: "Very High",
        },
      ],
    },
  ];

  return (
    <Card style={{ marginBottom: 16 }}>
      <div
        style={{
          padding: "14px 18px 10px",
          borderBottom: `1px solid ${T.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div>
          <div
            style={{
              color: T.txt,
              fontWeight: 800,
              fontSize: 14,
              fontFamily: T.head,
            }}
          >
            📊 Portfolio Performance
          </div>
          <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>
            Click any segment to navigate · hover for details
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: 99,
              background: T.ok,
              boxShadow: `0 0 6px ${T.ok}88`,
            }}
          />
          <span style={{ color: T.muted, fontSize: 11 }}>Interactive</span>
        </div>
      </div>
      <div style={{ padding: "20px 18px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))",
            gap: 28,
          }}
        >
          {charts.map((c, i) => (
            <DonutChart
              key={c.label}
              {...c}
              size={164}
              thickness={28}
              onClickSegment={(seg) => {
                try {
                  SFX.notify();
                } catch (e) {}
                // Build drill data based on segment label/navFilter
                const nf = seg.navFilter;
                let rows = [],
                  title = seg.label,
                  cols = [];
                const fmtV = (v) => (
                  <span style={{ fontFamily: "monospace", color: T.accent }}>
                    {v >= 1e6
                      ? (v / 1e6).toFixed(2) + "M"
                      : v >= 1e3
                        ? (v / 1e3).toFixed(1) + "K"
                        : (v?.toLocaleString?.() ?? v)}
                  </span>
                );
                if (seg.nav === "loans" || seg.nav === "collections") {
                  rows = loans.filter((l) => (nf ? l.status === nf : true));
                  cols = [
                    {
                      k: "id",
                      l: "Loan ID",
                      r: (v) => (
                        <span
                          style={{
                            color: T.accent,
                            fontFamily: "monospace",
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          {v}
                        </span>
                      ),
                    },
                    {
                      k: "customer",
                      l: "Customer",
                      r: (v) => {
                        const ph = custPhone?.(v) || "";
                        return (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              openContact?.(v, ph, e);
                            }}
                            style={{
                              color: T.accent,
                              cursor: "pointer",
                              fontWeight: 600,
                              borderBottom: `1px dashed ${T.accent}50`,
                            }}
                          >
                            {v}
                          </span>
                        );
                      },
                    },
                    { k: "balance", l: "Balance", r: (v) => fmt(v) },
                    {
                      k: "status",
                      l: "Status",
                      r: (v) => <Badge color={SC[v] || T.muted}>{v}</Badge>,
                    },
                    {
                      k: "daysOverdue",
                      l: "Days",
                      r: (v) =>
                        v > 0 ? (
                          <span
                            style={{
                              color: T.danger,
                              fontWeight: 800,
                              fontFamily: "monospace",
                            }}
                          >
                            {v}d
                          </span>
                        ) : (
                          <span style={{ color: T.muted }}>—</span>
                        ),
                    },
                    { k: "officer", l: "Officer" },
                  ];
                } else if (seg.nav === "payments") {
                  rows = payments.filter((p) => (nf ? p.status === nf : true));
                  cols = [
                    {
                      k: "id",
                      l: "Pay ID",
                      r: (v) => (
                        <span
                          style={{
                            color: T.accent,
                            fontFamily: "monospace",
                            fontSize: 12,
                          }}
                        >
                          {v}
                        </span>
                      ),
                    },
                    {
                      k: "customer",
                      l: "Customer",
                      r: (v) => {
                        const ph = custPhone?.(v) || "";
                        return (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              openContact?.(v, ph, e);
                            }}
                            style={{
                              color: T.accent,
                              cursor: "pointer",
                              fontWeight: 600,
                              borderBottom: `1px dashed ${T.accent}50`,
                            }}
                          >
                            {v}
                          </span>
                        );
                      },
                    },
                    {
                      k: "amount",
                      l: "Amount",
                      r: (v) => (
                        <span
                          style={{
                            color: T.ok,
                            fontFamily: "monospace",
                            fontWeight: 700,
                          }}
                        >
                          {fmt(v)}
                        </span>
                      ),
                    },
                    { k: "mpesa", l: "M-Pesa" },
                    { k: "date", l: "Date" },
                    {
                      k: "status",
                      l: "Status",
                      r: (v) => <Badge color={SC[v] || T.muted}>{v}</Badge>,
                    },
                  ];
                } else if (seg.nav === "customers") {
                  rows = customers.filter((c) => (nf ? c.risk === nf : true));
                  cols = [
                    {
                      k: "id",
                      l: "ID",
                      r: (v) => (
                        <span
                          style={{
                            color: T.accent,
                            fontFamily: "monospace",
                            fontSize: 12,
                          }}
                        >
                          {v}
                        </span>
                      ),
                    },
                    {
                      k: "name",
                      l: "Name",
                      r: (v, r) => (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            openContact?.(v, r.phone, e);
                          }}
                          style={{
                            color: T.accent,
                            cursor: "pointer",
                            fontWeight: 600,
                            borderBottom: `1px dashed ${T.accent}50`,
                          }}
                        >
                          {v}
                        </span>
                      ),
                    },
                    { k: "phone", l: "Phone" },
                    { k: "business", l: "Business" },
                    {
                      k: "risk",
                      l: "Risk",
                      r: (v) => <Badge color={RC[v]}>{v}</Badge>,
                    },
                  ];
                }
                if (setDrill && rows.length > 0)
                  setDrill({
                    title: `${seg.label} — ${rows.length} records`,
                    rows,
                    cols,
                    color: seg.color,
                  });
                else if (onNav && seg.nav) {
                  onNav(seg.nav);
                }
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
export const WeeklyCollectionsChart = ({ payments }) => {
  const [selDay, setSelDay] = useState(null);
  // FIX — memoize the days array. Previously it called new Date(), filter, and reduce
  // for every day on every render. Now it only recalculates when payments change.
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const iso = d.toISOString().split("T")[0];
        const label = d.toLocaleDateString("en-KE", {
          weekday: "short",
          day: "numeric",
        });
        const dayPays = payments.filter((p) => p.date === iso);
        const total = dayPays.reduce((s, p) => s + p.amount, 0);
        const isToday = iso === new Date().toISOString().split("T")[0];
        return {
          iso,
          label,
          total,
          count: dayPays.length,
          pays: dayPays,
          isToday,
        };
      }),
    [payments],
  );
  const maxVal = Math.max(...days.map((d) => d.total), 1);
  const COLORS = [T.accent, T.blue, T.purple, T.ok, T.gold, T.warn, T.danger];
  const fmtK = (v) =>
    v >= 1e6
      ? (v / 1e6).toFixed(2) + "M"
      : v >= 1e3
        ? (v / 1e3).toFixed(1) + "K"
        : v.toLocaleString("en-KE");
  const totalWeek = days.reduce((s, d) => s + d.total, 0);
  const totalCount = days.reduce((s, d) => s + d.count, 0);
  return (
    <Card style={{ marginBottom: 12 }}>
      <CH
        title="💳 7-Day Collections"
        sub={`${totalCount} payments · KES ${fmtK(totalWeek)} total this week`}
      />
      <div style={{ padding: "16px 18px" }}>
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "flex-end",
            height: 120,
            marginBottom: 12,
          }}
        >
          {days.map((d, i) => {
            const pct = maxVal > 0 ? (d.total / maxVal) * 100 : 0;
            const color = COLORS[i];
            const isSel = selDay && selDay.iso === d.iso;
            return (
              <div
                key={d.iso}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  cursor: d.count > 0 ? "pointer" : "default",
                }}
                onClick={() => {
                  if (d.count > 0) {
                    try {
                      SFX.notify();
                    } catch (e) {}
                    setSelDay(isSel ? null : d);
                  }
                }}
              >
                <div
                  style={{
                    color: color,
                    fontSize: 9,
                    fontWeight: 800,
                    fontFamily: "monospace",
                    opacity: d.total > 0 ? 1 : 0,
                  }}
                >
                  {fmtK(d.total)}
                </div>
                <div
                  style={{
                    width: "100%",
                    height: `${Math.max(pct, 2)}%`,
                    background: isSel
                      ? color
                      : d.total > 0
                        ? color + "CC"
                        : T.border,
                    borderRadius: "6px 6px 3px 3px",
                    transition:
                      "height .4s cubic-bezier(.22,1,.36,1), background .2s",
                    boxShadow: isSel ? `0 0 14px ${color}55` : "none",
                    border: isSel
                      ? `1px solid ${color}`
                      : "1px solid transparent",
                    minHeight: 4,
                  }}
                />
                <div
                  style={{
                    color: d.isToday ? color : T.muted,
                    fontSize: 9,
                    fontWeight: d.isToday ? 800 : 500,
                    textAlign: "center",
                    lineHeight: 1.3,
                    whiteSpace: "nowrap",
                  }}
                >
                  {d.label.split(" ")[0]}
                  <br />
                  {d.label.split(" ")[1] || ""}
                </div>
              </div>
            );
          })}
        </div>
        {selDay && (
          <div
            className="expand-in"
            style={{
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              padding: "14px 16px",
              marginTop: 4,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <div>
                <div style={{ color: T.txt, fontWeight: 800, fontSize: 13 }}>
                  {selDay.isToday ? "Today" : selDay.label}
                </div>
                <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>
                  {selDay.count} payment{selDay.count !== 1 ? "s" : ""} · KES{" "}
                  {fmtK(selDay.total)}
                </div>
              </div>
              <button
                onClick={() => setSelDay(null)}
                style={{
                  background: "none",
                  border: `1px solid ${T.border}`,
                  color: T.muted,
                  borderRadius: 99,
                  width: 24,
                  height: 24,
                  cursor: "pointer",
                  fontSize: 11,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>
            {selDay.pays.length === 0 ? (
              <div
                style={{
                  color: T.muted,
                  fontSize: 12,
                  textAlign: "center",
                  padding: "8px 0",
                }}
              >
                No payments on this day
              </div>
            ) : (
              <div
                style={{
                  maxHeight: "40vh",
                  overflowY: "auto",
                  overflowX: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {selDay.pays.map((p, i) => (
                  <div
                    key={p.id || i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "7px 10px",
                      background: T.card,
                      borderRadius: 8,
                      border: `1px solid ${T.border}`,
                    }}
                  >
                    <div>
                      <div
                        style={{ color: T.txt, fontWeight: 600, fontSize: 12 }}
                      >
                        {p.customer || "Unknown"}
                      </div>
                      <div style={{ color: T.muted, fontSize: 11 }}>
                        {p.mpesa || "—"} · {p.loanId || "Unallocated"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          color: p.status === "Allocated" ? T.ok : T.warn,
                          fontWeight: 800,
                          fontSize: 13,
                          fontFamily: "monospace",
                        }}
                      >
                        KES {(p.amount || 0).toLocaleString("en-KE")}
                      </div>
                      <div
                        style={{ color: T.muted, fontSize: 10, marginTop: 1 }}
                      >
                        {p.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
//  PAYMENT ENGINE v3 — strictly conforms to Issue 2 requirements
// ═══════════════════════════════════════════════════════════════════════════════

export var computeLoanSchedule = function (loan, allPayments) {
  if (!loan || !loan.disbursed)
    return { slots: [], ledger: [], runningBalance: 0, summary: {} };

  var todayStr = new Date().toISOString().split("T")[0];
  var rt = loan.repaymentType || "Monthly";
  var principal = Number(loan.amount) || 0;
  var interest = Math.round(principal * 0.3); // Flat 30% interest rule
  var totalOwed = principal + interest;

  // ── Frequency-aware slot configuration ─────────────────────────────────────
  // Each repayment type divides the 30-day window into equal installments.
  // Daily  → 30 slots, 1-day apart
  // Weekly → 4 slots, 7 days apart
  // Biweekly → 2 slots, 14 days apart
  // Monthly / Lump Sum → 1 slot on day 30
  var intervalDays, numSlots;
  if (rt === "Daily") {
    intervalDays = 1; numSlots = 30;
  } else if (rt === "Weekly") {
    intervalDays = 7; numSlots = 4;
  } else if (rt === "Biweekly") {
    intervalDays = 14; numSlots = 2;
  } else {
    intervalDays = 30; numSlots = 1;
  }

  var perSlot = Math.round(totalOwed / numSlots);
  // Last slot absorbs rounding remainder so totals stay exact
  var lastSlot = totalOwed - perSlot * (numSlots - 1);

  // ── Build slot schedule ────────────────────────────────────────────────────
  var startDate = new Date(loan.disbursed);
  var slots = [];
  for (var i = 0; i < numSlots; i++) {
    var slotDate = new Date(startDate);
    slotDate.setDate(startDate.getDate() + intervalDays * (i + 1));
    slots.push({
      index: i,
      due: slotDate.toISOString().slice(0, 10),
      perSlot: i === numSlots - 1 ? lastSlot : perSlot,
      status: "upcoming",
      payment: null,
      negBalance: 0,
    });
  }

  // 2. Map global payments safely

  // IMPORTANT: this engine currently uses a single "maturity" slot equal to totalOwed.
  // Allocation must therefore only mark the slot paid when the full total is covered.
  // (Previously, the allocator used repayment-type instalment perSlot, which could
  // incorrectly "clear" the single slot on partial payments.)
  var allocPerSlot = Number(slots[0] && slots[0].perSlot) || 0;

  // 2. Map global payments safely
  var loanPays = (allPayments || [])
    .filter(function (p) {
      return (
        (p.loanId === loan.id || p.loan_id === loan.id) &&
        (p.status === "Allocated" || p.status === "allocated")
      );
    })
    .slice()
    .sort(function (a, b) {
      return (a.date || "").localeCompare(b.date || "");
    });

  // 3. Compute explicit Total Paid correctly
  var totalPaid = loanPays.reduce(function (acc, p) {
    return acc + Number(p.amount || 0);
  }, 0);

  // 4. Calculate strict Progress Percentage
  var calcPct = 0;
  if (totalOwed > 0) {
    calcPct = (totalPaid / totalOwed) * 100;
  }
  if (calcPct > 100 || Number(loan.balance) <= 0) calcPct = 100;
  else if (calcPct < 1 && totalPaid > 0) calcPct = 1; // Never show 0% if money paid
  var pctPaid = Math.round(calcPct);

  // 5. Fill Slots Chronologically via Ledger (Issue 2 specific states)
  // 5. Fill Slots Chronologically with Fractional Support
  var ledger = [];
  slots.forEach(function (s) {
    s.paidAmount = 0;
    s.payments = [];
  });

  var remainingAmount = 0;
  var isLoanSettled = loan.status === "Settled" || loan.status === "Written off" || Number(loan.balance) <= 0 || pctPaid >= 100;

  loanPays.forEach(function (pay) {
    var amt = Number(pay.amount || 0);
    remainingAmount += amt;
    var paidSlots = [];

    slots.forEach(function (s, idx) {
      if (remainingAmount <= 0) return;
      var shortfall = s.perSlot - s.paidAmount;
      if (shortfall <= 0) return;

      var apply = Math.min(remainingAmount, shortfall);
      s.paidAmount += apply;
      remainingAmount -= apply;
      s.payments.push(pay);
      if (!s.payment) s.payment = pay; // primary payment reference
      
      if (s.paidAmount >= s.perSlot) {
         paidSlots.push(idx);
      }
    });

    ledger.push({
      payId: pay.id,
      date: pay.date,
      amount: amt,
      paidSlots: paidSlots,
      surplusSlots: 0,
      negativeBalance: remainingAmount, // surplus amount
      mpesa: pay.mpesa || pay.mpesa_code || null,
      allocatedBy: pay.allocatedBy || null,
    });
  });

  // 6. Resolve Statuses and Due Amounts
  slots.forEach(function (s, idx) {
    s.negBalance = 0; // Clear the old semantic
    s.carriedForward = 0;
    s.isCombined = false;
    
    // Calculate what is ACTUALLY remaining to pay for this specific slot
    s.totalDue = Math.max(0, s.perSlot - s.paidAmount);

    if (isLoanSettled || s.paidAmount >= s.perSlot) {
      // Slot is fully paid
      if (s.due < todayStr && s.payment && s.payment.date > s.due) {
        s.status = "paid_late";
      } else {
        s.status = "paid";
      }
    } else {
      // Slot is NOT fully paid
      if (s.due < todayStr) {
        s.status = "overdue";
      } else if (s.due === todayStr) {
        s.status = "due_today";
      } else {
        s.status = "upcoming";
      }
    }
  });

  // 7. Summaries
  var paidCt = slots.filter(function (s) {
    return s.status === "paid";
  }).length;
  var lateCt = slots.filter(function (s) {
    return s.status === "paid_late";
  }).length;
  var missedCt = slots.filter(function (s) {
    return s.status === "missed";
  }).length;
  var overdueCt = slots.filter(function (s) {
    return s.status === "overdue";
  }).length;
  var upcomingCt = slots.filter(function (s) {
    return s.status === "upcoming" || s.status === "due_today";
  }).length;

  return {
    slots: slots,
    ledger: ledger,
    runningBalance: 0, // Obsoleted: fractional accounting natively handles part-payments now
    perSlot: perSlot,
    total: totalOwed,
    totalPaid: totalPaid,
    pctPaid: pctPaid,
    summary: {
      paid: paidCt,
      late: lateCt,
      missed: missedCt,
      overdue: overdueCt,
      upcoming: upcomingCt,
    },
  };
};

const REPAY_STATUS = {
  paid: {
    col: "#10B981",
    bg: "#10B98114",
    border: "#10B981",
    icon: "✓",
    label: "ON TIME",
  },
  paid_late: {
    col: "#F59E0B",
    bg: "#F59E0B14",
    border: "#F59E0B",
    icon: "✓",
    label: "LATE PAID",
  },
  missed: {
    col: "#EF4444",
    bg: "#EF444414",
    border: "#EF4444",
    icon: "✕",
    label: "MISSED (SKIPPED)",
  },
  overdue: {
    col: "#EF4444",
    bg: "#EF444414",
    border: "#EF4444",
    icon: "!",
    label: "OVERDUE",
  },
  due_today: {
    col: "#F59E0B",
    bg: "#F59E0B18",
    border: "#F59E0B",
    icon: "!",
    label: "DUE TODAY",
  },
  upcoming: {
    col: "#475569",
    bg: "transparent",
    border: "#1E2D45",
    icon: "",
    label: "UPCOMING",
  },
};

const LoanDetail = ({
  loan,
  payments,
  selSlot,
  setSelSlot,
  setSelLoan,
  renderSlotPopup,
}) => {
  const sched = computeLoanSchedule(loan, payments);
  const {
    slots,
    ledger,
    runningBalance,
    perSlot,
    total,
    totalPaid,
    pctPaid,
    summary,
  } = sched;
  const [slotFilter, setSlotFilter] = useState(null);
  const filteredSlots = slotFilter
    ? slots.filter((s) => s.status === slotFilter)
    : slots;
  const phone = (loan.phone || "").replace(/\s/g, "");
  const waPhone = phone.startsWith("0") ? "254" + phone.slice(1) : phone;
  const smsBody = encodeURIComponent(
    "Dear " +
      loan.customer.split(" ")[0] +
      ", your loan " +
      loan.id +
      " has a balance of KES " +
      loan.balance.toLocaleString("en-KE") +
      ". Please make your next installment payment via Paybill 4166191, Account: " +
      loan.customerId +
      ". Thank you.",
  );
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        background: "rgba(4,8,16,0.92)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "56px",
        paddingLeft: 12,
        paddingRight: 12,
        paddingBottom: 40,
        backdropFilter: "blur(10px)",
        overflow: "hidden",
      }}
    >
      {selSlot &&
        renderSlotPopup({
          slot: selSlot,
          loan,
          totalSlots: slots.length,
          ledgerEntry:
            ledger.find((e) => e.paidSlots.includes(selSlot.index)) || null,
        })}
      <div
        style={{
          background: "#0A1628",
          border: "1px solid #1A3050",
          borderRadius: 16,
          width: "100%",
          maxWidth: 520,
          height: "100%",
          maxHeight: "calc(100vh - 96px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 0 0 1px #00D4AA10,0 40px 80px rgba(0,0,0,.95)",
        }}
      >
        <div
          style={{
            padding: "14px 18px 12px",
            borderBottom: "1px solid #1A3050",
            flexShrink: 0,
            background: "#0A1628",
            borderRadius: "16px 16px 0 0",
            zIndex: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 10,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "monospace",
                  color: "#00D4AA",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 2.5,
                  marginBottom: 3,
                }}
              >
                {loan.id}
              </div>
              <div style={{ color: "#E2E8F0", fontWeight: 700, fontSize: 15 }}>
                {loan.customer}
              </div>
              <div style={{ color: "#475569", fontSize: 11, marginTop: 2 }}>
                {loan.repaymentType} · KES {perSlot.toLocaleString("en-KE")}
                /instalment · {loan.officer}
              </div>
              <div style={{ color: "#475569", fontSize: 10, marginTop: 1 }}>
                Disbursed {loan.disbursed}
              </div>
            </div>
            <button
              onClick={() => {
                setSelLoan(null);
                setSelSlot(null);
              }}
              style={{
                background: "#1A2740",
                border: "1px solid #1A3050",
                color: "#475569",
                borderRadius: 99,
                width: 28,
                height: 28,
                cursor: "pointer",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginLeft: 12,
              }}
            >
              ✕
            </button>
          </div>
          {phone && (
            <div style={{ display: "flex", gap: 7 }}>
              <a
                href={`tel:${phone}`}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  background: "#00D4AA14",
                  border: "1px solid #00D4AA30",
                  color: "#00D4AA",
                  borderRadius: 8,
                  padding: "7px 10px",
                  textDecoration: "none",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                📞 Call
              </a>
              <a
                href={`sms:${phone}?body=${smsBody}`}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  background: "#3B82F614",
                  border: "1px solid #3B82F630",
                  color: "#60A5FA",
                  borderRadius: 8,
                  padding: "7px 10px",
                  textDecoration: "none",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                💬 SMS
              </a>
              <a
                href={`https://wa.me/${waPhone}?text=${smsBody}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  background: "#25D36614",
                  border: "1px solid #25D36630",
                  color: "#25D366",
                  borderRadius: 8,
                  padding: "7px 10px",
                  textDecoration: "none",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                WhatsApp
              </a>
            </div>
          )}
        </div>
        <div
          style={{
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            flex: 1,
          }}
        >
          <div style={{ padding: "14px 18px 48px" }}>
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 5,
                }}
              >
                <span
                  style={{
                    color: "#475569",
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Repayment Progress
                </span>
                <span
                  style={{
                    color: "#00D4AA",
                    fontFamily: "monospace",
                    fontWeight: 800,
                    fontSize: 12,
                  }}
                >
                  {pctPaid}%
                </span>
              </div>
              <div
                style={{
                  height: 5,
                  background: "#1A2740",
                  borderRadius: 99,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: pctPaid + "%",
                    background: "linear-gradient(90deg,#00D4AA,#00FFD1)",
                    borderRadius: 99,
                    transition: "width .5s",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 4,
                }}
              >
                <span style={{ color: "#64748B", fontSize: 10 }}>
                  Paid: KES {totalPaid.toLocaleString("en-KE")}
                </span>
                <span style={{ color: "#64748B", fontSize: 10 }}>
                  Total: KES {total.toLocaleString("en-KE")}
                </span>
              </div>
              {runningBalance < 0 && (
                <div
                  style={{
                    marginTop: 6,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#F59E0B10",
                    border: "1px solid #F59E0B30",
                    borderRadius: 7,
                    padding: "5px 10px",
                  }}
                >
                  <span style={{ fontSize: 11 }}>⚠</span>
                  <span
                    style={{ color: "#F59E0B", fontSize: 11, fontWeight: 600 }}
                  >
                    Partial balance on file: KES{" "}
                    {runningBalance.toLocaleString("en-KE")}
                  </span>
                </div>
              )}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 5,
                marginBottom: 12,
              }}
            >
              {[
                [
                  "Principal",
                  "KES " + loan.amount.toLocaleString("en-KE"),
                  "#64748B",
                  null,
                ],
                [
                  "Interest",
                  "KES " +
                    Math.round(loan.amount * 0.3).toLocaleString("en-KE"),
                  "#64748B",
                  null,
                ],
                ["On Time", summary.paid, "#10B981", "paid"],
                [
                  "Late",
                  summary.late,
                  summary.late > 0 ? "#F59E0B" : "#475569",
                  "paid_late",
                ],
                [
                  "Missed/Overdue",
                  summary.missed + summary.overdue,
                  summary.missed + summary.overdue > 0 ? "#EF4444" : "#475569",
                  "missed",
                ],
                ["Upcoming", summary.upcoming, "#475569", "upcoming"],
              ].map((item) => {
                const isActive = slotFilter === item[3] && item[3] !== null;
                return (
                  <div
                    key={item[0]}
                    onClick={() => {
                      if (item[3])
                        setSlotFilter((f) => (f === item[3] ? null : item[3]));
                    }}
                    style={{
                      background: isActive ? item[2] + "22" : "#0D1F35",
                      border: "1px solid " + (isActive ? item[2] : "#1A3050"),
                      borderRadius: 8,
                      padding: "8px 5px",
                      textAlign: "center",
                      cursor: item[3] ? "pointer" : "default",
                      transition: "all .15s",
                    }}
                  >
                    <div
                      style={{
                        color: "#475569",
                        fontSize: 8,
                        textTransform: "uppercase",
                        letterSpacing: 0.3,
                        marginBottom: 3,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                      }}
                    >
                      {item[0]}
                    </div>
                    <div
                      style={{
                        color: item[2],
                        fontWeight: 800,
                        fontSize: 11,
                        fontFamily: "monospace",
                      }}
                    >
                      {item[1]}
                    </div>
                    {isActive && (
                      <div
                        style={{
                          color: item[2],
                          fontSize: 7,
                          marginTop: 1,
                          fontWeight: 700,
                        }}
                      >
                        ▼ filtered
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div
              style={{
                display: "flex",
                gap: 12,
                marginBottom: 10,
                flexWrap: "wrap",
              }}
            >
              {[
                ["#10B981", "✅ On time"],
                ["#F59E0B", "⚠ Late"],
                ["#EF4444", "❌ Missed/Overdue"],
                ["#475569", "· Upcoming"],
              ].map((item) => (
                <div
                  key={item[1]}
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 2,
                      background: item[0],
                    }}
                  />
                  <span style={{ color: "#475569", fontSize: 9 }}>
                    {item[1]}
                  </span>
                </div>
              ))}
            </div>
            <div
              style={{
                color: "#475569",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 6,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>
                Schedule — click any instalment
                {slots.length > 0 && (
                  <span style={{ color: "#1A3050", marginLeft: 6 }}>
                    ({slots.length} total)
                  </span>
                )}
              </span>
              {slotFilter && (
                <button
                  onClick={() => setSlotFilter(null)}
                  style={{
                    background: "#1A2740",
                    border: "1px solid #1A3050",
                    color: "#64748B",
                    borderRadius: 6,
                    padding: "2px 8px",
                    cursor: "pointer",
                    fontSize: 9,
                    fontWeight: 700,
                  }}
                >
                  ✕ Clear filter ({filteredSlots.length} shown)
                </button>
              )}
            </div>
            <div
              style={{
                marginBottom: 16,
                paddingRight: 2,
                borderRadius: 8,
                border: "1px solid #1A3050",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {filteredSlots.length === 0 ? (
                  <div
                    style={{
                      color: "#475569",
                      textAlign: "center",
                      padding: 16,
                      fontSize: 12,
                    }}
                  >
                    No installments match this filter
                  </div>
                ) : (
                  filteredSlots.map((slot) => {
                    const sty =
                      REPAY_STATUS[slot.status] || REPAY_STATUS.upcoming;
                    const filled = ["paid", "paid_late"].includes(slot.status);
                    return (
                      <div
                        key={slot.index}
                        onClick={() => setSelSlot(slot)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          background: sty.bg,
                          border: "1px solid " + sty.border + "40",
                          borderRadius: 9,
                          padding: "9px 13px",
                          cursor: "pointer",
                          transition: "all .1s",
                        }}
                      >
                        <div
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 6,
                            border: "1px solid " + sty.border,
                            background: filled ? sty.border : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <span
                            style={{
                              color: filled ? "#060A10" : sty.col,
                              fontSize: 11,
                              fontWeight: 900,
                            }}
                          >
                            {sty.icon || slot.index + 1}
                          </span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              style={{
                                color: "#E2E8F0",
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              {slot.synthetic
                                ? "Next Payment Due"
                                : "Instalment " + (slot.index + 1)}
                            </span>
                            {slot.synthetic && (
                              <span
                                style={{
                                  background: "#10B98118",
                                  color: "#10B981",
                                  fontSize: 9,
                                  fontWeight: 700,
                                  padding: "1px 6px",
                                  borderRadius: 3,
                                  letterSpacing: 0.5,
                                }}
                              >
                                UPCOMING
                              </span>
                            )}
                            {slot.status === "due_today" && (
                              <span
                                style={{
                                  background: "#F59E0B18",
                                  color: "#F59E0B",
                                  fontSize: 9,
                                  fontWeight: 700,
                                  padding: "1px 6px",
                                  borderRadius: 3,
                                }}
                              >
                                TODAY
                              </span>
                            )}
                            {slot.payment && (
                              <span
                                style={{
                                  color: "#475569",
                                  fontSize: 9,
                                  fontFamily: "monospace",
                                }}
                              >
                                {slot.payment.mpesa || slot.payment.id}
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              color: "#475569",
                              fontSize: 10,
                              marginTop: 1,
                            }}
                          >
                            Due {slot.due}
                          </div>
                          {slot.negBalance < 0 && (
                            <div
                              style={{
                                color: "#F59E0B",
                                fontSize: 10,
                                marginTop: 1,
                              }}
                            >
                              ⚠ Partial: KES{" "}
                              {slot.negBalance.toLocaleString("en-KE")}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div
                            style={{
                              color: sty.col,
                              fontFamily: "monospace",
                              fontWeight: 700,
                              fontSize: 12,
                            }}
                          >
                            KES {(["paid", "paid_late"].includes(slot.status) ? slot.perSlot : (slot.totalDue !== undefined ? slot.totalDue : slot.perSlot)).toLocaleString("en-KE")}
                          </div>
                          {sty.label && (
                            <div
                              style={{
                                color: sty.col,
                                fontSize: 9,
                                fontWeight: 800,
                                marginTop: 1,
                                letterSpacing: 0.6,
                              }}
                            >
                              {sty.label}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            {ledger.length > 0 && (
              <div>
                <div
                  style={{
                    color: "#475569",
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    marginBottom: 8,
                  }}
                >
                  Payment ledger
                </div>
                <div>
                  {ledger.map((entry) => (
                    <div
                      key={entry.payId}
                      style={{
                        background: "#0D1F35",
                        border: "1px solid #1A3050",
                        borderRadius: 8,
                        padding: "10px 12px",
                        marginBottom: 5,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: 5,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              color: "#00D4AA",
                              fontFamily: "monospace",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {entry.payId}
                          </div>
                          <div
                            style={{
                              color: "#475569",
                              fontSize: 10,
                              marginTop: 1,
                            }}
                          >
                            {entry.mpesa || "Manual"} · {entry.date}
                          </div>
                        </div>
                        <div
                          style={{
                            color: "#00D4AA",
                            fontFamily: "monospace",
                            fontWeight: 800,
                            fontSize: 13,
                          }}
                        >
                          KES {entry.amount.toLocaleString("en-KE")}
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          borderTop: "1px solid #1A3050",
                          paddingTop: 6,
                        }}
                      >
                        <span style={{ color: "#475569", fontSize: 9 }}>
                          Covered:{" "}
                          {entry.paidSlots
                            .map((i) => "I" + (i + 1))
                            .join(", ") || "none"}
                        </span>
                        {entry.surplusSlots > 0 && (
                          <span style={{ color: "#F59E0B", fontSize: 9 }}>
                            {entry.surplusSlots} surplus slots
                          </span>
                        )}
                        {entry.negativeBalance < 0 && (
                          <span style={{ color: "#F59E0B", fontSize: 9 }}>
                            Remainder: KES{" "}
                            {entry.negativeBalance.toLocaleString("en-KE")}
                          </span>
                        )}
                        {entry.allocatedBy && (
                          <span style={{ color: "#374151", fontSize: 9 }}>
                            by {entry.allocatedBy}
                          </span>
                        )}
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

export const RepayTracker = ({ loans, payments }) => {
  const [activeType, setActiveType] = useState("Daily");
  const [selLoan, setSelLoan] = useState(null);
  const [selSlot, setSelSlot] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Lock the page scroll container synchronously before paint so the modal
  // and the lock appear in the same frame — no visible jump on first open.
  useLayoutEffect(() => {
    const el = document.querySelector(".main-scroll");
    if (!el) return;
    if (selLoan) {
      el.style.overflow = "hidden";
    } else {
      el.style.overflow = "";
    }
    return () => {
      el.style.overflow = "";
    };
  }, [selLoan]);

  const TYPES = ["Daily", "Weekly", "Biweekly", "Monthly"];
  const STATUS = REPAY_STATUS;

  // Memoize active loans for the selected type — only recomputes when loans or activeType changes
  const activeLoans = useMemo(
    () =>
      loans.filter(function (l) {
        return (
          l.repaymentType === activeType &&
          l.disbursed &&
          !["Rejected", "Written off"].includes(l.status)
        );
      }),
    [loans, activeType],
  );

  // Memoize per-type counts for the filter buttons — prevents 4× loans.filter on every render
  const typeCounts = useMemo(() => {
    const eligible = loans.filter(
      (l) =>
        l.disbursed &&
        !["Settled", "Rejected", "Written off"].includes(l.status),
    );
    return Object.fromEntries(
      TYPES.map((t) => [
        t,
        eligible.filter((l) => l.repaymentType === t).length,
      ]),
    );
  }, [loans]);

  // Memoize total active count shown in the subtitle — was an inline loans.filter in JSX
  const totalActive = useMemo(
    () =>
      loans.filter(
        (l) =>
          l.disbursed &&
          !["Settled", "Rejected", "Written off"].includes(l.status),
      ).length,
    [loans],
  );

  // KEY FIX — computeLoanSchedule runs the full payment allocation engine.
  // Memoize the full schedules array so it only recomputes when loans or payments change.
  const schedules = useMemo(() => {
    const result = {};
    activeLoans.forEach((loan) => {
      result[loan.id] = computeLoanSchedule(loan, payments);
    });
    return result;
  }, [activeLoans, payments]);

  // Search filter — matches customer name or loan ID (case-insensitive)
  const filteredLoans = useMemo(() => {
    if (!searchQuery.trim()) return activeLoans;
    const q = searchQuery.trim().toLowerCase();
    return activeLoans.filter(
      (l) =>
        (l.customer || "").toLowerCase().includes(q) ||
        (l.id || "").toLowerCase().includes(q),
    );
  }, [activeLoans, searchQuery]);

  // ── Slot detail popup ──────────────────────────────────────────────────────
  // FIX — Bug 3: SlotPopup was a component defined inside RepayTracker's render body.
  // Every re-render produced a new function identity → React treated it as a different
  // component type → full unmount+remount of the popup (and any inputs inside it).
  // Converted to a plain render function called as slotPopupContent(...) below so React
  // reconciles the returned JSX in-place without remounting.
  const renderSlotPopup = function (props) {
    const slot = props.slot;
    const loan = props.loan;
    const sty = STATUS[slot.status] || STATUS.upcoming;
    const pay = slot.payment;
    const ledgerEntry = props.ledgerEntry;
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10002,
          background: "rgba(4,8,16,0.8)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: MODAL_TOP_OFFSET + 16,
          paddingLeft: 16,
          paddingRight: 16,
          backdropFilter: "blur(6px)",
          overflow: "hidden",
        }}
        onClick={function () {
          setSelSlot(null);
        }}
      >
        <div
          onClick={function (e) {
            e.stopPropagation();
          }}
          style={{
            background: "#0A1628",
            border: "1px solid " + sty.border + "50",
            borderRadius: 14,
            padding: 20,
            width: "100%",
            maxWidth: 380,
            boxShadow:
              "0 0 0 1px " + sty.border + "15,0 32px 64px rgba(0,0,0,.9)",
          }}
        >
          {/* Slot header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 16,
            }}
          >
            <div>
              <div
                style={{
                  color: "#475569",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  marginBottom: 3,
                }}
              >
                {loan.repaymentType} · Instalment {slot.index + 1} of{" "}
                {props.totalSlots}
              </div>
              <div
                style={{
                  color: sty.col,
                  fontFamily: "monospace",
                  fontWeight: 800,
                  fontSize: 18,
                }}
              >
                KES {(slot.totalDue || slot.perSlot).toLocaleString("en-KE")}
              </div>
              {slot.isCombined && (
                <div style={{ color: "#EF4444", fontSize: 10, fontWeight: 700, marginTop: 2, background: "#EF444415", padding: "2px 6px", borderRadius: 4, display: "inline-block" }}>
                  Incl. KES {slot.carriedForward.toLocaleString("en-KE")} missed
                </div>
              )}
              <div style={{ color: "#475569", fontSize: 11, marginTop: 3 }}>
                Due {slot.due}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 6,
              }}
            >
              <span
                style={{
                  background: sty.bg,
                  border: "1px solid " + sty.border + "50",
                  color: sty.col,
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "3px 10px",
                  borderRadius: 6,
                  letterSpacing: 0.8,
                }}
              >
                {sty.label || "UPCOMING"}
              </span>
              <button
                onClick={function () {
                  setSelSlot(null);
                }}
                style={{
                  background: "#1A2740",
                  border: "1px solid #1A3050",
                  color: "#475569",
                  borderRadius: 99,
                  width: 24,
                  height: 24,
                  cursor: "pointer",
                  fontSize: 11,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Allocation detail */}
          <div
            style={{
              background: "#0D1F35",
              border: "1px solid #1A3050",
              borderRadius: 10,
              padding: "12px 14px",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: slot.negBalance < 0 ? 10 : 0,
              }}
            >
              <div>
                <div
                  style={{
                    color: "#475569",
                    fontSize: 9,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    marginBottom: 3,
                  }}
                >
                  Required this slot
                </div>
                <div
                  style={{
                    color: "#E2E8F0",
                    fontFamily: "monospace",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  KES {slot.perSlot.toLocaleString("en-KE")}
                </div>
              </div>
              <div>
                <div
                  style={{
                    color: "#475569",
                    fontSize: 9,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    marginBottom: 3,
                  }}
                >
                  {pay ? "Payment received" : "Amount received"}
                </div>
                <div
                  style={{
                    color: pay ? "#00D4AA" : "#EF4444",
                    fontFamily: "monospace",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {pay ? "KES " + pay.amount.toLocaleString("en-KE") : "KES 0"}
                </div>
              </div>
            </div>
            {slot.negBalance < 0 && (
              <div
                style={{
                  borderTop: "1px solid #1A3050",
                  paddingTop: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div
                    style={{ color: "#F59E0B", fontSize: 10, fontWeight: 700 }}
                  >
                    ⚠ Partial remainder
                  </div>
                  <div style={{ color: "#475569", fontSize: 10, marginTop: 1 }}>
                    Not applied — less than 1 instalment
                  </div>
                </div>
                <div
                  style={{
                    color: "#F59E0B",
                    fontFamily: "monospace",
                    fontWeight: 800,
                    fontSize: 13,
                  }}
                >
                  {slot.negBalance.toLocaleString("en-KE")}
                </div>
              </div>
            )}
          </div>

          {/* Linked payment */}
          {!pay ? (
            <div
              style={{
                background: "#0D1F35",
                border: "1px dashed #1A3050",
                borderRadius: 8,
                padding: 12,
                textAlign: "center",
                color: "#475569",
                fontSize: 11,
              }}
            >
              {slot.status === "missed"
                ? "No payment received by " + slot.due
                : slot.status === "duetoday"
                  ? "Payment due today — not yet received"
                  : "Instalment not yet due"}
            </div>
          ) : (
            <div>
              <div
                style={{
                  color: "#475569",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginBottom: 7,
                }}
              >
                Payment record
              </div>
              <div
                style={{
                  background: "#0D1F35",
                  border: "1px solid #1A3050",
                  borderRadius: 9,
                  padding: "12px 14px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 8,
                  }}
                >
                  <div>
                    <div
                      style={{
                        color: "#00D4AA",
                        fontFamily: "monospace",
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      {pay.id}
                    </div>
                    <div
                      style={{ color: "#475569", fontSize: 10, marginTop: 2 }}
                    >
                      {pay.mpesa || "Manual entry"}
                    </div>
                  </div>
                  <div
                    style={{
                      color: "#00D4AA",
                      fontFamily: "monospace",
                      fontWeight: 800,
                      fontSize: 15,
                    }}
                  >
                    KES {pay.amount.toLocaleString("en-KE")}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: 8,
                    borderTop: "1px solid #1A3050",
                  }}
                >
                  <span style={{ color: "#475569", fontSize: 10 }}>
                    Received: {pay.date}
                  </span>
                  <span
                    style={{
                      background:
                        pay.date <= slot.due ? "#00D4AA15" : "#F59E0B15",
                      color: pay.date <= slot.due ? "#00D4AA" : "#F59E0B",
                      fontSize: 9,
                      fontWeight: 800,
                      padding: "2px 7px",
                      borderRadius: 4,
                      letterSpacing: 0.5,
                    }}
                  >
                    {pay.date <= slot.due ? "ON TIME" : "LATE"}
                  </span>
                </div>
                {ledgerEntry && ledgerEntry.paidSlots.length > 1 && (
                  <div
                    style={{
                      marginTop: 8,
                      color: "#475569",
                      fontSize: 10,
                      borderTop: "1px solid #1A3050",
                      paddingTop: 8,
                    }}
                  >
                    This payment also covers {ledgerEntry.paidSlots.length - 1}{" "}
                    other instalment
                    {ledgerEntry.paidSlots.length > 2 ? "s" : ""}
                  </div>
                )}
                {pay.allocatedBy && (
                  <div style={{ marginTop: 4, color: "#374151", fontSize: 9 }}>
                    Allocated by: {pay.allocatedBy}
                  </div>
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
    <div
      style={{
        background: "#080F1E",
        border: "1px solid #0F2040",
        borderRadius: 16,
        padding: "18px 20px",
        marginBottom: 20,
        boxShadow: "inset 0 1px 0 #0F2040",
      }}
    >
      {selLoan && (
        <LoanDetail
          loan={selLoan}
          payments={payments}
          selSlot={selSlot}
          setSelSlot={setSelSlot}
          setSelLoan={setSelLoan}
          renderSlotPopup={renderSlotPopup}
        />
      )}

      {/* Title row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div>
          <div
            style={{
              color: "#00D4AA",
              fontFamily: "monospace",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 3,
              marginBottom: 3,
            }}
          >
            LOAN MONITOR ENGINE
          </div>
          <div style={{ color: "#E2E8F0", fontWeight: 800, fontSize: 15 }}>
            Schedule Monitor
          </div>
          <div style={{ color: "#475569", fontSize: 11, marginTop: 2 }}>
            Central allocation engine · {totalActive} active loans
          </div>
        </div>
        {/* Type filter */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {TYPES.map(function (t) {
            var ct = typeCounts[t] || 0;
            return (
              <button
                key={t}
                onClick={function () {
                  setActiveType(t);
                  setSearchQuery("");
                }}
                style={{
                  background: activeType === t ? "#00D4AA" : "transparent",
                  color: activeType === t ? "#060A10" : "#475569",
                  border:
                    "1px solid " + (activeType === t ? "#00D4AA" : "#1A3050"),
                  borderRadius: 8,
                  padding: "5px 11px",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  transition: "all .15s",
                }}
              >
                {t}
                {ct > 0 && (
                  <span
                    style={{
                      background:
                        activeType === t ? "rgba(6,10,16,.25)" : "#1A2740",
                      color: activeType === t ? "#060A10" : "#64748B",
                      borderRadius: 99,
                      padding: "0 5px",
                      fontSize: 9,
                      fontWeight: 900,
                      minWidth: 14,
                      textAlign: "center",
                    }}
                  >
                    {ct}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search bar */}
      <div style={{ marginBottom: 10, position: "relative" }}>
        <input
          type="text"
          value={searchQuery}
          onChange={function (e) { setSearchQuery(e.target.value); }}
          placeholder="Search by customer name or loan ID…"
          style={{
            width: "100%",
            background: "#0D1F35",
            border: "1px solid " + (searchQuery ? "#00D4AA60" : "#1A3050"),
            borderRadius: 8,
            padding: "7px 12px 7px 32px",
            color: "#E2E8F0",
            fontSize: 12,
            outline: "none",
            boxSizing: "border-box",
            transition: "border-color .15s",
          }}
        />
        <span style={{
          position: "absolute",
          left: 10,
          top: "50%",
          transform: "translateY(-50%)",
          color: searchQuery ? "#00D4AA" : "#475569",
          fontSize: 12,
          pointerEvents: "none",
        }}>🔍</span>
        {searchQuery && (
          <button
            onClick={function () { setSearchQuery(""); }}
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              background: "transparent",
              border: "none",
              color: "#475569",
              cursor: "pointer",
              fontSize: 12,
              padding: 0,
              lineHeight: 1,
            }}
          >✕</button>
        )}
      </div>

      {/* Loan cards — scrollable container, max 3 cards visible */}
      {activeLoans.length === 0 ? (
        <div
          style={{
            color: "#475569",
            textAlign: "center",
            padding: "24px",
            fontSize: 12,
            border: "1px dashed #0F2040",
            borderRadius: 10,
          }}
        >
          No active {activeType.toLowerCase()} repayment loans
        </div>
      ) : (
        <div
          style={{
            maxHeight: "40vh",
            overflowY: "auto",
            overflowX: "hidden",
            paddingRight: 2,
          }}
        >
          {filteredLoans.length === 0 && (
            <div style={{
              color: "#475569",
              textAlign: "center",
              padding: "20px",
              fontSize: 12,
              border: "1px dashed #0F2040",
              borderRadius: 10,
            }}>
              No loans match &ldquo;{searchQuery}&rdquo;
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {filteredLoans.map(function (loan) {
              const sched =
                schedules[loan.id] || computeLoanSchedule(loan, payments);
              const {
                slots,
                runningBalance,
                pctPaid,
                summary,
                perSlot,
                total,
                totalPaid,
              } = sched;
              return (
                <div
                  key={loan.id}
                  style={{
                    background: "#0D1F35",
                    border:
                      "1px solid " +
                      (summary.missed > 0
                        ? "#EF444428"
                        : loan.status === "Overdue"
                          ? "#EF444418"
                          : "#0F2040"),
                    borderRadius: 12,
                    padding: "13px 15px",
                    cursor: "pointer",
                    transition: "border-color .15s",
                  }}
                  onClick={function () {
                    setSelLoan(loan);
                    setSelSlot(null);
                  }}
                >
                  {/* Top row */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 6,
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 7 }}
                    >
                      <span
                        style={{
                          fontFamily: "monospace",
                          color: "#00D4AA",
                          fontWeight: 800,
                          fontSize: 12,
                          letterSpacing: 0.5,
                        }}
                      >
                        {loan.id}
                      </span>
                      {loan.status === "Overdue" && (
                        <span
                          style={{
                            background: "#EF444412",
                            color: "#EF4444",
                            fontSize: 9,
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: 4,
                            border: "1px solid #EF444428",
                          }}
                        >
                          OVERDUE
                        </span>
                      )}
                      {summary.missed > 0 && (
                        <span
                          style={{
                            background: "#EF444412",
                            color: "#EF4444",
                            fontSize: 9,
                            fontWeight: 700,
                            padding: "2px 5px",
                            borderRadius: 4,
                          }}
                        >
                          {summary.missed} missed
                        </span>
                      )}
                      {runningBalance < 0 && (
                        <span
                          style={{
                            background: "#F59E0B12",
                            color: "#F59E0B",
                            fontSize: 9,
                            fontWeight: 700,
                            padding: "2px 5px",
                            borderRadius: 4,
                          }}
                        >
                          ⚠ partial
                        </span>
                      )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          color: "#E2E8F0",
                          fontFamily: "monospace",
                          fontWeight: 700,
                          fontSize: 11,
                        }}
                      >
                        KES {loan.balance.toLocaleString("en-KE")}
                      </div>
                      <div style={{ color: "#475569", fontSize: 9 }}>
                        balance
                      </div>
                    </div>
                  </div>
                  <div
                    style={{ color: "#64748B", fontSize: 11, marginBottom: 8 }}
                  >
                    {loan.customer} ·{" "}
                    <span
                      style={{
                        color: "#475569",
                        fontFamily: "monospace",
                        fontSize: 10,
                      }}
                    >
                      KES {perSlot.toLocaleString("en-KE")}/slot
                    </span>
                  </div>
                  {/* Progress */}
                  <div
                    style={{
                      height: 3,
                      background: "#1A2740",
                      borderRadius: 99,
                      overflow: "hidden",
                      marginBottom: 4,
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: pctPaid + "%",
                        background: "linear-gradient(90deg,#00D4AA,#00FFD1)",
                        borderRadius: 99,
                        boxShadow: pctPaid > 0 ? "0 0 5px #00D4AA40" : "",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 9,
                    }}
                  >
                    <span style={{ color: "#475569", fontSize: 9 }}>
                      {summary.paid + summary.late}/{slots.length} paid ·{" "}
                      {pctPaid}%
                      {runningBalance < 0 && (
                        <span style={{ color: "#F59E0B" }}>
                          {" "}
                          · {runningBalance.toLocaleString("en-KE")} balance
                        </span>
                      )}
                    </span>
                    {loan.daysOverdue > 0 && loan.status !== "Settled" && loan.status !== "Written off" && (
                      <span
                        style={{
                          color: "#EF4444",
                          fontSize: 9,
                          fontWeight: 700,
                        }}
                      >
                        {loan.daysOverdue}d overdue
                      </span>
                    )}
                  </div>
                  {/* Mini dot track — horizontal scroll, no wrap */}
                  <div
                    style={{
                      overflowX: "auto",
                      WebkitOverflowScrolling: "touch",
                      paddingBottom: 2,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 3,
                        flexWrap: "nowrap",
                        minWidth: "min-content",
                      }}
                    >
                      {slots.map(function (slot) {
                        var sty = STATUS[slot.status] || STATUS.upcoming;
                        var filled = ["paid", "paid_late"].includes(
                          slot.status,
                        );
                        var w =
                          activeType === "Daily"
                            ? 10
                            : activeType === "Weekly"
                              ? 24
                              : activeType === "Biweekly"
                                ? 36
                                : 72;
                        return (
                          <div
                            key={slot.index}
                            title={
                              "I" +
                              (slot.index + 1) +
                              " · " +
                              slot.due +
                              " · " +
                              (sty.label || "upcoming")
                            }
                            style={{
                              width: w,
                              height: 9,
                              borderRadius: 2,
                              flexShrink: 0,
                              background: filled
                                ? sty.border
                                : slot.status === "missed"
                                  ? sty.border + "25"
                                  : slot.status === "due_today"
                                    ? sty.border + "45"
                                    : "#1A2740",
                              border:
                                "1px solid " +
                                sty.border +
                                (filled ? "" : "50"),
                              boxShadow: filled
                                ? "0 0 4px " + sty.border + "30"
                                : "",
                            }}
                          />
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

// ═══════════════════════════════════════════
//  CUSTOMER EDIT FORM
// ═══════════════════════════════════════════
export const CustomerEditForm = ({ customer, workers, onSave, onClose }) => {
  const [f, setF] = useState({
    name: customer.name || "",
    dob: customer.dob || "",
    gender: customer.gender || "Female",
    idNo: customer.idNo || "",
    phone: customer.phone || "",
    altPhone: customer.altPhone || "",
    residence: customer.residence || "",
    businessName: customer.businessName || customer.business || "",
    businessType: customer.businessType || "Retail",
    businessLocation:
      customer.businessLocation ||
      customer.location ||
      customer.businessLoc ||
      "",
    officer: customer.officer || "",
    risk: customer.risk || "Low",
    n1n: customer.n1n || "",
    n1p: customer.n1p || "",
    n1r: customer.n1r || "",
    n2n: customer.n2n || "",
    n2p: customer.n2p || "",
    n2r: customer.n2r || "",
    n3n: customer.n3n || "",
    n3p: customer.n3p || "",
    n3r: customer.n3r || "",
  });
  const [docs, setDocs] = useState(customer.docs || []);
  const [tab, setTab] = useState("personal");
  const [err, setErr] = useState([]);
  const s = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  const validate = () => {
    const m = [];
    if (!f.name) m.push("Full Name");
    if (!f.idNo) m.push("National ID");
    if (!f.phone) m.push("Primary Phone");
    if (!f.residence) m.push("Residence");
    if (!f.businessName) m.push("Business Name");
    if (!f.businessLocation) m.push("Business Location");
    if (!f.officer) m.push("Assigned Officer");
    if (!f.n1n || !f.n1p || !f.n1r)
      m.push("Next of Kin 1 (Name, Phone & Relationship)");
    if (!f.n2n || !f.n2p || !f.n2r)
      m.push("Next of Kin 2 (Name, Phone & Relationship)");
    if (!f.n3n || !f.n3p || !f.n3r)
      m.push("Next of Kin 3 (Name, Phone & Relationship)");
    return m;
  };

  const save = () => {
    const m = validate();
    if (m.length > 0) {
      setErr(m);
      return;
    }
    onSave({ ...customer, ...f });
  };

  const TABS = [
    { k: "personal", l: "Personal" },
    { k: "business", l: "Business" },
    { k: "nok", l: "Next of Kin" },
    { k: "documents", l: "Documents" },
  ];

  return (
    <Dialog title={`Edit — ${customer.name}`} onClose={onClose} width={580} minHeight="80vh">
      {err.length > 0 && (
        <div
          style={{
            background: T.dLo,
            border: `1px solid ${T.danger}38`,
            borderRadius: 9,
            padding: "10px 14px",
            marginBottom: 12,
          }}
        >
          {err.map((e) => (
            <div
              key={e}
              style={{ color: T.danger, fontSize: 12, padding: "2px 0" }}
            >
              ★ {e}
            </div>
          ))}
        </div>
      )}
      <div
        style={{
          display: "flex",
          gap: 5,
          marginBottom: 16,
          overflowX: "auto",
          paddingBottom: 2,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            style={{
              background: tab === t.k ? T.accent : T.surface,
              color: tab === t.k ? "#060A10" : T.muted,
              border: `1px solid ${tab === t.k ? T.accent : T.border}`,
              borderRadius: 99,
              padding: "5px 14px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {t.l}
          </button>
        ))}
      </div>

      {tab === "personal" && (
        <div
          className="mob-grid1"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0 14px",
          }}
        >
          <FI
            label="Full Name"
            value={f.name}
            onChange={s("name")}
            required
            half
          />
          <FI
            label="Date of Birth"
            value={f.dob}
            onChange={s("dob")}
            type="date"
            half
          />
          <FI
            label="Gender"
            value={f.gender}
            onChange={s("gender")}
            type="select"
            options={["Female", "Male", "Other"]}
            half
          />
          <NumericInput
            label="National ID"
            value={f.idNo}
            onChange={s("idNo")}
            required
            half
          />
          <PhoneInput
            label="Primary Phone"
            value={f.phone}
            onChange={s("phone")}
            required
            half
          />
          <PhoneInput
            label="Alt Phone"
            value={f.altPhone}
            onChange={s("altPhone")}
            half
          />
          <FI
            label="Residence"
            value={f.residence}
            onChange={s("residence")}
            required
            half
          />
          <FI
            label="Risk Level"
            value={f.risk}
            onChange={s("risk")}
            type="select"
            options={["Low", "Medium", "High", "Very High"]}
            half
          />
        </div>
      )}
      {tab === "business" && (
        <div
          className="mob-grid1"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0 14px",
          }}
        >
          <FI
            label="Business Name"
            value={f.businessName}
            onChange={s("businessName")}
            required
            half
          />
          <FI
            label="Business Type"
            value={f.businessType}
            onChange={s("businessType")}
            type="select"
            options={[
              "Butchery", "Carpentry", "Charcoal/firewood seller", "Clothes & Accessories", 
              "Food kiosk", "Fruits & Vegetables", "General shop", "Juakali artisan", 
              "Milk ATM", "Rentals/accommodation", "Agrovet", "Autospares", 
              "Animal feeds", "Bakery", "Boutique", "Salon/Kinyozi", 
              "Poultry", "Second hand items", "Photo studio", "DSTV/Video show", 
              "Health centre", "Electrical shop", "Bags", "Bookshop", 
              "Pharmacy", "Beauty & cosmetics", "Welding", "Wines & spirits", 
              "Money agent", "Fish seller", "Shoeshiner/repair", "Cereals", 
              "Malimali", "Movie shop", "Soaps & detergents", "Cyber cafe", 
              "Events & entertainment", "Gas cylinders", "Poshio mill", "Murtura base", 
              "Pond table", "School", "Ballar & sand", "Glass", 
              "Garage", "Computer college", "Dry cleaner", "Carpet seller", 
              "Car wash", "Timberyard", "Sugarcane", "Tailor", 
              "Bar & restaurant", "School uniforms", "Brick seller", "Bakery & weaving", 
              "Egg seller", "Gas shop", "Gym", "Shoe seller", 
              "Day care", "Security firm", "Curtains", "Ice cream", 
              "Maize", "Massage spa", "Chemicals", "Curios", 
              "Detergent supplier", "Electronics", "Loans on item", "Optician", 
              "Packaging material", "Potato seller", "Other", "Add option"
            ]}
            half
          />
          <FI
            label="Business Location"
            value={f.businessLocation}
            onChange={s("businessLocation")}
            required
            half
          />
          <FI
            label="Assigned Officer"
            value={f.officer}
            onChange={s("officer")}
            type="select"
            options={(workers || [])
              .filter((w) => w.status === "Active")
              .map((w) => w.name)}
            required
            half
          />
        </div>
      )}
      {tab === "nok" && (
        <div
          className="mob-grid1"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0 14px",
          }}
        >
          {[
            [1, "n1n", "n1p", "n1r"],
            [2, "n2n", "n2p", "n2r"],
            [3, "n3n", "n3p", "n3r"],
          ].map(([n, nk, pk, rk]) => [
            <FI
              key={nk}
              label={`NOK ${n} Name`}
              value={f[nk]}
              onChange={s(nk)}
              required
              half
            />,
            <PhoneInput
              key={pk}
              label={`NOK ${n} Phone`}
              value={f[pk]}
              onChange={s(pk)}
              required
              half
            />,
            <FI
              key={rk}
              label={`NOK ${n} Relationship`}
              value={f[rk]}
              onChange={s(rk)}
              type="select"
              options={[
                "",
                "Spouse",
                "Parent",
                "Sibling",
                "Child",
                "Friend",
                "Colleague",
              ]}
              required
              half
            />,
            <div
              key={`sep${n}`}
              style={{
                gridColumn: "span 2",
                height: 1,
                background: T.border,
                margin: "4px 0",
              }}
            />,
          ])}
        </div>
      )}
      {tab === "documents" && (
        <div>
          <Alert type="info" style={{ marginBottom: 12 }}>
            Replace or add documents. Existing uploads are preserved unless
            removed.
          </Alert>
          <StructuredDocUpload
            docs={docs}
            onAdd={(d) =>
              setDocs((p) => [...p.filter((x) => x.key !== d.key), d])
            }
            onRemove={(id) => setDocs((p) => p.filter((x) => x.id !== id))}
          />
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 9,
          marginTop: 16,
          paddingTop: 12,
          borderTop: `1px solid ${T.border}`,
        }}
      >
        <Btn onClick={save} full>
          ✓ Save Changes
        </Btn>
        <Btn v="secondary" onClick={onClose}>
          Cancel
        </Btn>
      </div>
    </Dialog>
  );
};

// ═══════════════════════════════════════════
//  CUSTOMER DETAIL — full profile on click
// ═══════════════════════════════════════════

// ── Docs tab as proper component (no hook-in-render) ──────────
export const CustDocsTab = ({ customer }) => {
  const [viewDoc, setViewDoc] = useState(null);
  const slots = DOC_SLOTS.map((sl) => ({
    ...sl,
    doc: (customer.docs || []).find((d) => d.key === sl.key),
  }));
  const loose = (customer.docs || []).filter(
    (d) => !DOC_SLOTS.some((sl) => sl.key === d.key),
  );
  return (
    <div>
      {viewDoc && <DocViewer doc={viewDoc} onClose={() => setViewDoc(null)} />}
      {(!customer.docs || customer.docs.length === 0) && (
        <div
          style={{
            color: T.muted,
            textAlign: "center",
            padding: 20,
            background: T.surface,
            borderRadius: 10,
          }}
        >
          No documents on file
        </div>
      )}
      {slots.some((s) => s.doc) && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginBottom: 12,
          }}
        >
          {slots
            .filter((s) => s.doc)
            .map((sl) => (
              <div
                key={sl.key}
                style={{
                  background: T.surface,
                  border: `1px solid ${T.ok}38`,
                  borderRadius: 10,
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 18 }}>{sl.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: T.txt, fontSize: 13, fontWeight: 700 }}>
                    {sl.label}
                  </div>
                  <div style={{ color: T.ok, fontSize: 11 }}>
                    On file · {sl.doc.uploaded}
                  </div>
                </div>
                {sl.doc.type?.startsWith("image/") ? (
                  <img
                    src={sl.doc.dataUrl}
                    alt={sl.label}
                    onClick={() => setViewDoc(sl.doc)}
                    style={{
                      width: 48,
                      height: 48,
                      objectFit: "cover",
                      borderRadius: 6,
                      cursor: "pointer",
                      border: `2px solid ${T.ok}`,
                    }}
                  />
                ) : (
                  <div
                    onClick={() => setViewDoc(sl.doc)}
                    style={{
                      width: 48,
                      height: 48,
                      background: T.card,
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 22,
                      cursor: "pointer",
                      border: `1px solid ${T.border}`,
                    }}
                  >
                    📄
                  </div>
                )}
                <button
                  onClick={() => setViewDoc(sl.doc)}
                  style={{
                    background: T.aLo,
                    border: `1px solid ${T.accent}30`,
                    color: T.accent,
                    borderRadius: 7,
                    padding: "5px 10px",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  View
                </button>
              </div>
            ))}
        </div>
      )}
      {loose.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))",
            gap: 8,
          }}
        >
          {loose.map((doc) => (
            <div
              key={doc.id}
              style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: 9,
                padding: 8,
                textAlign: "center",
                cursor: "pointer",
              }}
              onClick={() => setViewDoc(doc)}
            >
              {doc.type?.startsWith("image/") ? (
                <img
                  src={doc.dataUrl}
                  alt={doc.name}
                  style={{
                    width: "100%",
                    height: 80,
                    objectFit: "cover",
                    borderRadius: 6,
                    marginBottom: 6,
                  }}
                />
              ) : (
                <div
                  style={{
                    height: 80,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 28,
                    marginBottom: 6,
                  }}
                >
                  📄
                </div>
              )}
              <div style={{ color: T.txt, fontSize: 11, fontWeight: 600 }}>
                {doc.name}
              </div>
              <div style={{ color: T.accent, fontSize: 10, marginTop: 3 }}>
                Tap to view
              </div>
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
  if (!loan.disbursed) return { timeline: [], latePayments: [] };

  const disbDate = new Date(loan.disbursed);
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const rt = loan.repaymentType;
  const principal = loan.amount;
  const total = principal + Math.round(principal * 0.3); // 30% flat interest

  const intervalDays =
    rt === "Daily"
      ? 1
      : rt === "Weekly"
        ? 7
        : rt === "Biweekly"
          ? 14
          : rt === "Monthly"
            ? 30
            : null;
  const installAmt = intervalDays
    ? rt === "Daily"
      ? Math.ceil(total / 30)
      : rt === "Weekly"
        ? Math.ceil(total / 4)
        : rt === "Biweekly"
          ? Math.ceil(total / 2)
          : /* Monthly */ total
    : total;

  // Build ALL expected slots (past + future up to loan end)
  // Business Rule: A loan is strictly DUE only on the 30th day from disbursement.
  // Repayment frequency (Daily, Weekly, etc.) does NOT influence due status.
  const slots = [];
  const dueD = new Date(disbDate);
  dueD.setDate(dueD.getDate() + 30);
  slots.push({
    dueDate: dueD.toISOString().split("T")[0],
    expectedAmt: total,
  });

  // Sort actual payments chronologically
  const sortedPays = [...payments].sort((a, b) => a.date.localeCompare(b.date));

  // PASS 1: match each payment to slots whose window it falls in (on-time)
  const usedPayIds = new Set();
  const timeline = slots.map((slot, slotIdx) => {
    // For the first (and only) slot, use a far-past sentinel so that
    // pre-disbursement payments (advances, demo data, out-of-order entries)
    // are caught here as on-time rather than falling to PASS 2 as "Late".
    const prevDue = slotIdx > 0 ? slots[slotIdx - 1].dueDate : '2000-01-01';
    const onTimePays = sortedPays.filter(
      (p) =>
        p.date >= prevDue && p.date <= slot.dueDate && !usedPayIds.has(p.id),
    );
    const windowAmt = onTimePays.reduce((s, p) => s + p.amount, 0);
    onTimePays.forEach((p) => usedPayIds.add(p.id));

    let status = "missed";
    if (windowAmt > 0) {
      // Only mark as "paid" when the full expected amount is covered
      status = windowAmt >= slot.expectedAmt ? "paid" : "partial";
    } else if (slot.dueDate > todayStr) {
      status = "upcoming";
    }
    return {
      ...slot,
      payments: onTimePays,
      windowAmt,
      status,
      latePayments: [],
    };
  });

  // PASS 2: remaining payments are late — slot them into the earliest still-missed slot
  const remainingPays = sortedPays.filter((p) => !usedPayIds.has(p.id));
  let carryover = 0;
  for (const pay of remainingPays) {
    let remaining = pay.amount;
    // Find missed/partial slots in order and fill them
    for (const slot of timeline) {
      if (remaining <= 0) break;
      if (slot.status === "paid") continue;
      const shortfall = slot.expectedAmt - slot.windowAmt;
      if (shortfall <= 0) continue;
      const applying = Math.min(remaining, shortfall);
      slot.latePayments.push({
        ...pay,
        appliedAmt: applying,
        lateApplied: true,
      });
      slot.windowAmt += applying;
      remaining -= applying;
      // Only promote to paid/paid-late when the FULL amount is covered
      if (slot.windowAmt >= slot.expectedAmt) {
        slot.status = pay.date <= slot.dueDate ? "paid" : "paid-late";
      } else {
        slot.status = "partial";
      }
    }
    // Any residual is surplus (overpayment)
    if (remaining > 0) carryover += remaining;
  }

  return { timeline, latePayments: [] }; // latePayments is now always empty — all matched into slots
};

const PaymentTimeline = ({ loan, payments, compact = false }) => {
  const [expanded, setExpanded] = useState(false);
  const [drillFilter, setDrillFilter] = useState(null); // 'paid'|'paid-late'|'missed'|'partial'|'upcoming'|null
  const pays = payments.filter((p) => p.loanId === loan.id);
  const result = buildPaymentTimeline(loan, pays);
  if (!result || !result.timeline) return null;
  const { timeline } = result;
  if (!timeline.length)
    return (
      <div
        style={{
          color: T.muted,
          fontSize: 12,
          textAlign: "center",
          padding: 16,
        }}
      >
        No payment schedule available
      </div>
    );

  const totalExpected = timeline.reduce((s, t) => s + t.expectedAmt, 0);
  const totalPaid = timeline.reduce(
    (s, t) =>
      s +
      t.windowAmt +
      t.latePayments.reduce((a, p) => a + (p.appliedAmt || 0), 0),
    0,
  );
  const onTime = timeline.filter((t) => t.status === "paid").length;
  const late = timeline.filter((t) => t.status === "paid-late").length;
  const missed = timeline.filter((t) => t.status === "missed").length;
  const partial = timeline.filter((t) => t.status === "partial").length;
  const upcoming = timeline.filter((t) => t.status === "upcoming").length;
  const pct =
    totalExpected > 0
      ? Math.min(100, Math.round((totalPaid / totalExpected) * 100))
      : 0;

  // Count actual payment RECEIPTS (not slots)
  const totalPayCount = pays.length;
  // Count receipts that sit in partial-status slots
  const partialPayCount = timeline
    .filter(t => t.status === 'partial')
    .reduce((s, t) => s + t.payments.length + t.latePayments.length, 0);

  const statusColor = (s) =>
    s === "paid"
      ? T.ok
      : s === "paid-late"
        ? T.gold
        : s === "partial"
          ? T.gold
          : s === "upcoming"
            ? T.muted
            : T.danger;
  const statusIcon = (s) =>
    s === "paid"
      ? "✓"
      : s === "paid-late"
        ? "✓"
        : s === "partial"
          ? "~"
          : s === "upcoming"
            ? "·"
            : "✕";
  const statusLabel = (s) =>
    s === "paid"
      ? "On Time"
      : s === "paid-late"
        ? "Late"
        : s === "partial"
          ? "Partial"
          : s === "upcoming"
            ? "Upcoming"
            : "Missed";

  // Which slots to show based on drill filter + expand
  const PREVIEW = compact ? 4 : 6;
  const filtered = drillFilter
    ? timeline.filter((t) => t.status === drillFilter)
    : timeline;
  const shown = expanded || drillFilter ? filtered : filtered.slice(0, PREVIEW);

  const statBox = (label, value, color, filter) => (
    <div
      key={label}
      onClick={() => {
        setDrillFilter(drillFilter === filter ? null : filter);
        setExpanded(true);
      }}
      style={{
        background: drillFilter === filter ? color + "22" : T.surface,
        border: `1px solid ${drillFilter === filter ? color : T.border}`,
        borderRadius: 9,
        padding: "8px 10px",
        textAlign: "center",
        cursor: "pointer",
        transition: "all .15s",
      }}
    >
      <div style={{ color, fontFamily: T.mono, fontWeight: 900, fontSize: 16 }}>
        {value}
      </div>
      <div
        style={{
          color: T.muted,
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily: T.body }}>
      {/* ── Summary stat boxes — all clickable ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 6,
          marginBottom: 6,
        }}
      >
        {statBox("On Time", onTime, T.ok, "paid")}
        {statBox("Late", late, T.gold, "paid-late")}
        {statBox("Missed", missed, T.danger, "missed")}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 6,
          marginBottom: 12,
        }}
      >
        {statBox("Partial", partial, T.gold, "partial")}
        {statBox("Upcoming", upcoming, T.muted, "upcoming")}
        {statBox("Payments", totalPayCount, T.accent, null)}
      </div>

      {/* ── Active filter banner ── */}
      {drillFilter && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: statusColor(drillFilter) + "18",
            border: `1px solid ${statusColor(drillFilter)}30`,
            borderRadius: 8,
            padding: "6px 12px",
            marginBottom: 10,
          }}
        >
          <span
            style={{
              color: statusColor(drillFilter),
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Showing: {statusLabel(drillFilter)} installments ({filtered.length})
          </span>
          <button
            onClick={() => {
              setDrillFilter(null);
              setExpanded(false);
            }}
            style={{
              background: "none",
              border: "none",
              color: T.muted,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            ✕ Clear
          </button>
        </div>
      )}

      {/* ── Progress bar ── */}
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 5,
          }}
        >
          <span style={{ color: T.muted, fontSize: 11 }}>
            Collection progress
          </span>
          <span
            style={{
              color: pct >= 80 ? T.ok : pct >= 50 ? T.gold : T.danger,
              fontFamily: T.mono,
              fontWeight: 800,
              fontSize: 12,
            }}
          >
            {pct}%
          </span>
        </div>
        <div
          style={{
            height: 6,
            background: T.border,
            borderRadius: 99,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background:
                pct >= 80
                  ? `linear-gradient(90deg,${T.ok},#00FF7F)`
                  : pct >= 50
                    ? `linear-gradient(90deg,${T.gold},#FFD700)`
                    : `linear-gradient(90deg,${T.danger},#FF6B6B)`,
              borderRadius: 99,
              transition: "width .5s",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 3,
          }}
        >
          <span style={{ color: T.dim, fontSize: 10 }}>
            Paid: {fmt(totalPaid)}
          </span>
          <span style={{ color: T.dim, fontSize: 10 }}>
            Expected: {fmt(totalExpected)}
          </span>
        </div>
      </div>

      {/* ── Timeline rows ── */}
      <div
        style={{
          maxHeight: "40vh",
          overflowY: "auto",
          overflowX: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {shown.map((slot, idx) => {
          const col = statusColor(slot.status);
          const allPays = [...slot.payments, ...slot.latePayments];
          const hasLate = slot.latePayments.length > 0;
          return (
            <div
              key={idx}
              style={{
                borderRadius: 10,
                overflow: "hidden",
                border: `1px solid ${col}${slot.status === "missed" && !hasLate ? "50" : "30"}`,
                background:
                  slot.status === "paid"
                    ? T.surface
                    : slot.status === "paid-late"
                      ? T.gLo
                      : slot.status === "partial"
                        ? T.gLo
                        : slot.status === "upcoming"
                          ? "transparent"
                          : hasLate
                            ? T.gLo // missed but later paid
                            : T.dLo,
              }}
            >
              <div style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
                {/* Left accent strip */}
                <div style={{ width: 4, background: col, flexShrink: 0 }} />
                {/* Main content */}
                <div style={{ flex: 1, padding: "8px 10px", minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        background: col + "20",
                        color: col,
                        borderRadius: 99,
                        padding: "2px 8px",
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: 0.5,
                        flexShrink: 0,
                      }}
                    >
                      {statusIcon(slot.status)} {statusLabel(slot.status)}
                    </span>
                    <span
                      style={{ color: T.muted, fontSize: 11, flexShrink: 0 }}
                    >
                      Due {slot.dueDate}
                    </span>
                    {hasLate && (
                      <span
                        style={{
                          background: T.gold + "20",
                          color: T.gold,
                          borderRadius: 99,
                          padding: "2px 6px",
                          fontSize: 9,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        💡 Recovered
                      </span>
                    )}
                    <span
                      style={{
                        color: T.dim,
                        fontSize: 10,
                        marginLeft: "auto",
                        flexShrink: 0,
                      }}
                    >
                      #{timeline.indexOf(slot) + 1}
                    </span>
                  </div>

                  {/* Amounts row */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginTop: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          color: T.muted,
                          fontSize: 9,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        Expected
                      </div>
                      <div
                        style={{
                          color: T.txt,
                          fontFamily: T.mono,
                          fontWeight: 700,
                          fontSize: 12,
                        }}
                      >
                        {fmt(slot.expectedAmt)}
                      </div>
                    </div>
                    <div
                      style={{
                        color: T.border,
                        fontSize: 14,
                        alignSelf: "center",
                      }}
                    >
                      →
                    </div>
                    <div>
                      <div
                        style={{
                          color: T.muted,
                          fontSize: 9,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        Received
                      </div>
                      <div
                        style={{
                          color: col,
                          fontFamily: T.mono,
                          fontWeight: 800,
                          fontSize: 13,
                        }}
                      >
                        {fmt(slot.windowAmt)}
                      </div>
                    </div>
                    {slot.status !== "paid" &&
                      slot.status !== "paid-late" &&
                      slot.expectedAmt > slot.windowAmt && (
                        <>
                          <div
                            style={{
                              color: T.border,
                              fontSize: 14,
                              alignSelf: "center",
                            }}
                          >
                            →
                          </div>
                          <div>
                            <div
                              style={{
                                color: T.muted,
                                fontSize: 9,
                                textTransform: "uppercase",
                                letterSpacing: 0.5,
                              }}
                            >
                              Shortfall
                            </div>
                            <div
                              style={{
                                color: T.danger,
                                fontFamily: T.mono,
                                fontWeight: 800,
                                fontSize: 13,
                              }}
                            >
                              {fmt(slot.expectedAmt - slot.windowAmt)}
                            </div>
                          </div>
                        </>
                      )}
                  </div>

                  {/* Payment receipts — on-time + late, all embedded here */}
                  {allPays.length > 0 && (
                    <div
                      style={{
                        marginTop: 7,
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      {allPays.map((p, pi) => (
                        <div
                          key={p.id || pi}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            background: p.lateApplied
                              ? T.gold + "12"
                              : T.ok + "10",
                            border: `1px solid ${p.lateApplied ? T.gold : T.ok}25`,
                            borderRadius: 7,
                            padding: "5px 9px",
                          }}
                        >
                          <div>
                            <span
                              style={{
                                color: p.lateApplied ? T.gold : T.ok,
                                fontFamily: T.mono,
                                fontWeight: 700,
                                fontSize: 11,
                              }}
                            >
                              {fmt(p.lateApplied ? p.appliedAmt : p.amount)}
                            </span>
                            <span
                              style={{
                                color: T.muted,
                                fontSize: 10,
                                marginLeft: 8,
                              }}
                            >
                              {p.date}
                            </span>
                            {p.mpesa && (
                              <span
                                style={{
                                  color: T.dim,
                                  fontSize: 9,
                                  marginLeft: 6,
                                  fontFamily: T.mono,
                                }}
                              >
                                {p.mpesa}
                              </span>
                            )}
                          </div>
                          <span
                            style={{
                              background: p.lateApplied
                                ? T.gold + "20"
                                : T.ok + "15",
                              color: p.lateApplied ? T.gold : T.ok,
                              borderRadius: 5,
                              padding: "2px 6px",
                              fontSize: 9,
                              fontWeight: 700,
                            }}
                          >
                            {p.lateApplied ? "Late Payment" : "On Time"}
                          </span>
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
        <button
          onClick={() => setExpanded((e) => !e)}
          style={{
            display: "block",
            width: "100%",
            marginTop: 8,
            background: T.surface,
            border: `1px solid ${T.border}`,
            color: T.muted,
            borderRadius: 8,
            padding: "8px",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {expanded
            ? "▲ Show less"
            : `▼ Show ${filtered.length - PREVIEW} more installments`}
        </button>
      )}
    </div>
  );
};

// ── Confirmation dialog for destructive actions ───────────────
export const ConfirmDialog = ({
  title,
  message,
  confirmLabel = "Confirm",
  confirmVariant = "danger",
  onConfirm,
  onCancel,
}) => (
  <Dialog title={title} onClose={onCancel} width={400}>
    <p
      style={{ color: T.txt, fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}
    >
      {message}
    </p>
    <div style={{ display: "flex", gap: 8 }}>
      <Btn v={confirmVariant} onClick={onConfirm} full>
        {confirmLabel}
      </Btn>
      <Btn v="secondary" onClick={onCancel} full>
        Cancel
      </Btn>
    </div>
  </Dialog>
);

export const LoanModal = ({
  loan,
  customers,
  payments,
  interactions,
  onClose,
  onViewCustomer,
  actions,
}) => {
  useModalLock();
  const [tab, setTab] = useState("details");
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);
  const loanDerived = useMemo(() => {
    const cust = customers.find(
      (c) => c.id === loan.customerId || c.name === loan.customer,
    ) || { name: loan.customer };
    const pays = payments.filter((p) => p.loanId === loan.id);
    const ints = (interactions || []).filter((i) =>
      i.loanId === loan.id ||
      i.customerId === loan.customerId ||
      i.customer_id === loan.customerId
    );
    const lastPay =
      [...pays].sort((a, b) => b.date.localeCompare(a.date))[0] || null;
    const paid = pays.reduce((s, p) => s + p.amount, 0);
    const engine = calculateLoanStatus(loan);
    const penalty = engine.interestAccrued + engine.penaltyAccrued; // total charges (backward compat)
    // Total due = principal + flat 30% base interest + any overdue charges
    const baseInterest = Math.round((loan.amount || 0) * 0.3);
    const totalDue = (loan.amount || 0) + baseInterest + engine.interestAccrued + engine.penaltyAccrued;
    // Remaining balance = what is still owed after all payments
    const remainingBalance = Math.max(0, totalDue - paid);
    const owed = totalDue;
    return { cust, pays, ints, lastPay, paid, penalty, owed, engine, totalDue, remainingBalance, baseInterest };
  }, [loan, customers, payments, interactions]);
  const { cust, pays, ints, lastPay, paid, penalty, owed, engine, totalDue, remainingBalance, baseInterest } =
    loanDerived;

  const schedule = () => {
    const bal = loan.balance;
    const rt = loan.repaymentType;
    if (!bal || bal <= 0) return [];
    if (rt === "Daily")
      return [
        { p: "Per Day", a: Math.ceil(bal / 30) },
        { p: "Per Week", a: Math.ceil(bal / 30) * 7 },
      ];
    if (rt === "Weekly")
      return [
        { p: "Per Week", a: Math.ceil(bal / 4) },
        { p: "Per Month", a: bal },
      ];
    if (rt === "Biweekly")
      return [
        { p: "Per 2 Weeks", a: Math.ceil(bal / 2) },
        { p: "Per Month", a: bal },
      ];
    if (rt === "Monthly") return [{ p: "Per Month", a: bal }];
    return [{ p: "Lump Sum", a: bal }];
  };

  const TABS = [
    { k: "details", l: "Details" },
    { k: "timeline", l: "📅 Payment Timeline" },
    { k: "schedule", l: "Schedule" },
    { k: "interactions", l: `Interactions (${ints.length})` },
  ];

  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Loan ${loan.id} — ${loan.customer}`}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9900,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-end",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        background: "rgba(4,8,16,0.55)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          background: T.card,
          borderLeft: `1px solid ${T.hi}`,
          width: "100%",
          maxWidth: 520,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          boxShadow: "-20px 0 60px #00000080",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            padding: "18px 20px 14px",
            borderBottom: `1px solid ${T.border}`,
            flexShrink: 0,
            background: T.card,
            zIndex: 10,
          }}
        >
          <div>
            <div
              style={{
                color: T.txt,
                fontSize: 15,
                fontWeight: 800,
                fontFamily: T.head,
              }}
            >
              {loan.id}
            </div>
            <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>
              {loan.customer} · {loan.status}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: T.card2,
              border: `1px solid ${T.border}`,
              color: T.muted,
              borderRadius: 99,
              width: 30,
              height: 30,
              cursor: "pointer",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginLeft: 12,
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ flex: 1, padding: "18px 20px 32px", overflowY: "auto" }}>
          {/* Status + customer link */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Badge color={SC[loan.status] || T.muted}>{loan.status}</Badge>
              {cust.id && onViewCustomer && (
                <button
                  onClick={() => {
                    onClose();
                    onViewCustomer(cust);
                  }}
                  style={{
                    background: T.aLo,
                    border: `1px solid ${T.aMid}`,
                    color: T.accent,
                    borderRadius: 7,
                    padding: "4px 10px",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  View Customer Profile →
                </button>
              )}
              {cust.phone && (
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <a
                    href={`tel:${cust.phone}`}
                    style={{
                      background: T.surface, border: `1px solid ${T.border}`,
                      color: T.txt, borderRadius: 7, width: 28, height: 28,
                      display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none",
                      fontSize: 14
                    }}
                    title="Call Customer"
                  >📞</a>
                  <a
                    href={`sms:${cust.phone}`}
                    style={{
                      background: T.surface, border: `1px solid ${T.border}`,
                      color: T.txt, borderRadius: 7, width: 28, height: 28,
                      display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none",
                      fontSize: 14
                    }}
                    title="Text Customer"
                  >💬</a>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 12, fontSize: 11, background: T.surface, border: `1px solid ${T.border}`, padding: '4px 10px', borderRadius: 7 }}>
              <div><span style={{ color: T.dim }}>Disbursed:</span> <span style={{ color: T.txt, fontWeight: 700 }}>{loan.disbursed || "—"}</span></div>
              <div style={{ width: 1, background: T.border }} />
              <div><span style={{ color: T.dim }}>Due:</span> <span style={{ color: loan.daysOverdue > 0 ? T.danger : T.txt, fontWeight: 700 }}>{(() => {
                if (!loan.disbursed) return "—";
                const d = new Date(loan.disbursed);
                d.setDate(d.getDate() + 30);
                return d.toISOString().split("T")[0];
              })()}</span></div>
            </div>
          </div>

          {/* Key figures — driven entirely by calculateLoanStatus engine */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 7,
              marginBottom: 12,
            }}
          >
            {[
              ["Principal", fmt(loan.amount), T.txt],
              ["Rate", "30%", T.txt],
              ["Base Int.", fmt(baseInterest), T.txt],
              [
                "Paid",
                fmt(paid),
                paid > 0 ? T.ok : T.txt,
              ],
              [
                "Balance",
                fmt(remainingBalance),
                remainingBalance > 0 ? (loan.status === "Overdue" ? T.danger : T.warn) : T.ok,
              ],
              [
                "Overdue",
                loan.daysOverdue > 0 ? `${loan.daysOverdue}d` : "None",
                loan.daysOverdue > 0 ? T.danger : T.ok,
              ],
              [
                "Late Int.",
                fmt(engine.interestAccrued),
                engine.interestAccrued > 0 ? T.warn : T.muted,
              ],
              [
                "Penalty",
                fmt(engine.penaltyAccrued),
                engine.penaltyAccrued > 0 ? T.danger : T.muted,
              ],
              ["Total Due", fmt(remainingBalance), T.accent],
            ].map(([k, v, col]) => (
              <div
                key={k}
                style={{
                  background: T.surface,
                  borderRadius: 8,
                  padding: "8px 10px",
                }}
              >
                <div
                  style={{
                    color: T.muted,
                    fontSize: 9,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 2,
                  }}
                >
                  {k}
                </div>
                <div
                  style={{
                    color: col,
                    fontWeight: 800,
                    fontSize: 13,
                    fontFamily: "monospace",
                  }}
                >
                  {v}
                </div>
              </div>
            ))}
          </div>

          {/* Phase banner — shows only when overdue, driven by engine */}
          {engine.phase !== "none" && loan.daysOverdue > 0 && (
            <div
              style={{
                background: engine.isFrozen
                  ? T.card2
                  : engine.phase === "penalty"
                    ? T.dLo
                    : T.wLo,
                border: `1px solid ${engine.isFrozen ? T.border : engine.phase === "penalty" ? T.danger + "40" : T.warn + "40"}`,
                borderRadius: 8,
                padding: "8px 12px",
                marginBottom: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    color: engine.isFrozen
                      ? T.muted
                      : engine.phase === "penalty"
                        ? T.danger
                        : T.warn,
                    fontWeight: 800,
                    fontSize: 12,
                  }}
                >
                  {engine.isFrozen ? "❄ Frozen" : "⚠ " + engine.status}
                </div>
                <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>
                  {engine.isFrozen
                    ? "No further interest or penalty — total is locked at " +
                      fmt(engine.totalAmountDue)
                    : engine.phase === "penalty"
                      ? `Interest locked at ${fmt(engine.interestAccrued)} (day 1–30) · Penalty: 1.2%/day`
                      : `Interest: 1.2%/day · Penalty starts at day 31`}
                </div>
              </div>
              <div
                style={{
                  color: engine.isFrozen ? T.muted : T.danger,
                  fontFamily: "monospace",
                  fontWeight: 900,
                  fontSize: 14,
                  flexShrink: 0,
                  marginLeft: 8,
                }}
              >
                {loan.daysOverdue}d
              </div>
            </div>
          )}

          {/* Last payment banner */}
          {lastPay && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: T.oLo,
                border: `1px solid ${T.ok}30`,
                borderRadius: 8,
                padding: "9px 13px",
                marginBottom: 12,
              }}
            >
              <div>
                <div style={{ color: T.ok, fontWeight: 700, fontSize: 12 }}>
                  Last Payment
                </div>
                <div style={{ color: T.muted, fontSize: 11 }}>
                  {lastPay.date} · {lastPay.mpesa || "Manual"}
                </div>
              </div>
              <div
                style={{
                  color: T.ok,
                  fontFamily: "monospace",
                  fontWeight: 900,
                  fontSize: 15,
                }}
              >
                {fmt(lastPay.amount)}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div
            style={{
              display: "flex",
              gap: 5,
              marginBottom: 12,
              overflowX: "auto",
            }}
          >
            {TABS.map((t) => (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                style={{
                  background: tab === t.k ? T.accent : T.surface,
                  color: tab === t.k ? "#060A10" : T.muted,
                  border: `1px solid ${tab === t.k ? T.accent : T.border}`,
                  borderRadius: 99,
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {t.l}
              </button>
            ))}
          </div>

          {tab === "details" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 7,
              }}
            >
              {[
                ["Disbursed", loan.disbursed || "Not yet"],
                ["Due / Repayment", loan.repaymentType],
                ["M-Pesa Code", loan.mpesa || "—"],
                ["Officer", loan.officer || "—"],
                ["Risk", loan.risk || "—"],
                ["Customer ID", loan.customerId || "—"],
                ["Phase", engine.status],
              ].map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    background: T.surface,
                    borderRadius: 8,
                    padding: "8px 10px",
                  }}
                >
                  <div
                    style={{
                      color: T.muted,
                      fontSize: 9,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      marginBottom: 2,
                    }}
                  >
                    {k}
                  </div>
                  <div style={{ color: T.txt, fontSize: 13, fontWeight: 600 }}>
                    {v}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "timeline" && (
            <div>
              <PaymentTimeline loan={loan} payments={payments} />
            </div>
          )}

          {tab === "schedule" && (
            <div>
              {loan.balance <= 0 ? (
                <Alert type="ok">
                  Loan fully settled — no further payments due.
                </Alert>
              ) : (
                <div>
                  {schedule().map(({ p, a }) => (
                    <div
                      key={p}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "9px 12px",
                        background: T.surface,
                        borderRadius: 8,
                        marginBottom: 6,
                        border: `1px solid ${T.border}`,
                      }}
                    >
                      <span style={{ color: T.muted, fontSize: 13 }}>{p}</span>
                      <span
                        style={{
                          color: T.accent,
                          fontFamily: "monospace",
                          fontWeight: 800,
                        }}
                      >
                        {fmt(a)}
                      </span>
                    </div>
                  ))}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 7,
                      marginTop: 8,
                    }}
                  >
                    {[
                      ["Remaining Balance", fmt(Math.max(0, (loan.amount * 1.3) - paid))],
                      ["Late Int.", fmt(engine.interestAccrued)],
                      ["Penalty", fmt(engine.penaltyAccrued)],
                      ["Total Due", fmt(Math.max(0, (loan.amount * 1.3) + engine.interestAccrued + engine.penaltyAccrued - paid))],
                      ["Phase", engine.status],
                      [
                        "Progress",
                        `${loan.amount > 0 ? Math.min(100, Math.round((paid / (loan.amount * 1.3)) * 100)) : 0}%`,
                      ],
                    ].map(([k, v]) => (
                      <div
                        key={k}
                        style={{
                          background: T.surface,
                          borderRadius: 8,
                          padding: "8px 10px",
                        }}
                      >
                        <div
                          style={{
                            color: T.muted,
                            fontSize: 9,
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                            marginBottom: 2,
                          }}
                        >
                          {k}
                        </div>
                        <div
                          style={{
                            color: T.txt,
                            fontSize: 13,
                            fontWeight: 700,
                            fontFamily: "monospace",
                          }}
                        >
                          {v}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "interactions" && (
            <div>
              {ints.length === 0 && (
                <div
                  style={{
                    color: T.muted,
                    textAlign: "center",
                    padding: 20,
                    background: T.surface,
                    borderRadius: 9,
                  }}
                >
                  No interactions recorded for this customer.
                </div>
              )}
              {[...ints]
                .sort((a, b) => {
                  const da = a.created_at || a.createdAt || a.date || '';
                  const db = b.created_at || b.createdAt || b.date || '';
                  return db.localeCompare(da);
                })
                .map((i) => {
                  const isLoanLevel = i.loanId === loan.id;
                  return (
                    <div
                      key={i.id}
                      style={{
                        background: T.surface,
                        border: `1px solid ${isLoanLevel ? T.accent + '50' : T.border}`,
                        borderRadius: 9,
                        padding: "10px 12px",
                        marginBottom: 7,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: 4,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Badge color={T.accent}>{i.type}</Badge>
                          <span style={{
                            fontSize: 10, fontWeight: 700,
                            color: isLoanLevel ? T.accent : T.muted,
                            background: isLoanLevel ? T.aLo : T.surface,
                            border: `1px solid ${isLoanLevel ? T.aMid : T.border}`,
                            borderRadius: 4, padding: '1px 6px',
                          }}>
                            {isLoanLevel ? '📎 Loan' : '👤 Customer'}
                          </span>
                        </div>
                        <span style={{ color: T.muted, fontSize: 11, flexShrink: 0, marginLeft: 6 }}>
                          {(i.created_at || i.createdAt || i.date || '').slice(0, 10)}
                        </span>
                      </div>
                      <div style={{ color: T.txt, fontSize: 13, lineHeight: 1.5 }}>{i.notes}</div>
                      {i.officer && (
                        <div style={{ color: T.muted, fontSize: 11, marginTop: 5 }}>By: {i.officer}</div>
                      )}
                      {i.promiseAmount && (
                        <div
                          style={{ color: T.gold, fontSize: 12, marginTop: 4 }}
                        >
                          Promise: {fmt(i.promiseAmount)} by {i.promiseDate}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
          {actions && (
            <div
              style={{
                paddingTop: 16,
                borderTop: `1px solid ${T.border}`,
                marginTop: 4,
              }}
            >
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const CustomerDetail = ({
  customer,
  loans,
  payments,
  interactions,
  workers,
  onClose,
  onSave,
  onSelectLoan,
  onBlacklist,
}) => {
  useModalLock();
  const [tab, setTab] = useState("info");
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);
  const [editing, setEditing] = useState(false);
  const custDerived = useMemo(() => {
    const myLoans = loans.filter((l) => l.customerId === customer.id);
    const myPays = payments.filter((p) => p.customerId === customer.id);
    const myInts = interactions.filter((i) => i.customerId === customer.id);
    const overdueLoans = myLoans.filter((l) => l.status === "Overdue");
    const activeLoans = myLoans.filter((l) => l.status === "Active");
    const settledLoans = myLoans.filter((l) => l.status === "Settled");
    const totalOwed = overdueLoans.reduce((s, l) => {
      const lPays = myPays.filter(p => p.loanId === l.id);
      const paid = lPays.reduce((acc, p) => acc + p.amount, 0);
      const baseInterest = Math.round((l.amount || 0) * 0.3);
      const engine = calculateLoanStatus(l);
      const trueDue = Math.max(0, (l.amount || 0) + baseInterest + engine.interestAccrued + engine.penaltyAccrued - paid);
      return s + trueDue;
    }, 0);
    const totalPaid = myPays.reduce((s, p) => s + p.amount, 0);
    const totalPrincipal = myLoans.reduce((s, l) => s + l.amount, 0);
    const lastPay =
      [...myPays].sort((a, b) => b.date.localeCompare(a.date))[0] || null;
    return {
      myLoans,
      myPays,
      myInts,
      overdueLoans,
      activeLoans,
      settledLoans,
      totalOwed,
      totalPaid,
      totalPrincipal,
      lastPay,
    };
  }, [loans, payments, interactions, customer]);
  const {
    myLoans,
    myPays,
    myInts,
    overdueLoans,
    activeLoans,
    settledLoans,
    totalOwed,
    totalPaid,
    totalPrincipal,
    lastPay,
  } = custDerived;
  const hasDefault = overdueLoans.length > 0;
  const phone = (customer.phone || "").replace(/\s/g, "");
  const waPhone = phone.startsWith("0") ? "254" + phone.slice(1) : phone;
  const smsText = encodeURIComponent(
    `Dear ${customer.name.split(" ")[0]}, your loan balance of KES ${totalOwed.toLocaleString("en-KE")} is overdue. Please pay via Paybill 4166191, Account: ${customer.id}. Contact us for assistance.`,
  );
  const waText = encodeURIComponent(
    `Hello ${customer.name.split(" ")[0]}, this is a reminder that your loan balance of *KES ${totalOwed.toLocaleString("en-KE")}* is overdue.\n\nPlease pay via:\n• Paybill: *4166191*\n• Account No: *${customer.id}*\n\nContact us if you need assistance.`,
  );
  const tabs = [
    { k: "info", l: "Profile" },
    { k: "loans", l: `Loans (${myLoans.length})` },
    { k: "payments", l: `📅 Payment Track (${myPays.length})` },
    { k: "interactions", l: `Timeline (${myInts.length})` },
    { k: "docs", l: `Documents (${(customer.docs || []).length})` },
  ];
  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Customer profile — ${customer.name}`}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9900,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-end",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        background: "rgba(4,8,16,0.55)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          background: T.card,
          borderLeft: `1px solid ${T.hi}`,
          width: "100%",
          maxWidth: 520,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          boxShadow: "-20px 0 60px #00000080",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            padding: "18px 20px 14px",
            borderBottom: `1px solid ${T.border}`,
            position: "sticky",
            top: 0,
            background: T.card,
            zIndex: 10,
          }}
        >
          <div>
            <div
              style={{
                color: T.txt,
                fontSize: 15,
                fontWeight: 800,
                fontFamily: T.head,
              }}
            >
              {customer.name}
            </div>
            <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>
              {escHtml(customer.id)} · {escHtml(customer.business) || "—"} ·{" "}
              {escHtml(customer.location) || "—"}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close customer profile"
            style={{
              background: T.card2,
              border: `1px solid ${T.border}`,
              color: T.muted,
              borderRadius: 99,
              width: 30,
              height: 30,
              cursor: "pointer",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginLeft: 12,
            }}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch",
            padding: "18px 20px 40px",
          }}
        >
          {editing && onSave && (
            <CustomerEditForm
              customer={customer}
              workers={workers || []}
              onSave={(updated) => {
                onSave(updated);
                setEditing(false);
              }}
              onClose={() => setEditing(false)}
            />
          )}
          {!editing && (
            <>
              {customer.blacklisted && (
                <Alert type="danger">⛔ This customer is blacklisted</Alert>
              )}

              {/* Edit button */}
              {(onSave || onBlacklist) && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 6,
                    marginBottom: 12,
                  }}
                >
                  {onBlacklist && !customer.blacklisted && (
                    <Btn sm v="danger" onClick={() => onBlacklist(customer)}>
                      ⛔ Blacklist
                    </Btn>
                  )}
                  {onSave && (
                    <Btn sm onClick={() => setEditing(true)}>
                      ✏ Edit Customer
                    </Btn>
                  )}
                </div>
              )}

              {/* Quick contact bar — only shown when defaulted */}
              {hasDefault && (
                <div
                  style={{
                    background: T.dLo,
                    border: `1px solid ${T.danger}30`,
                    borderRadius: 12,
                    padding: "14px 16px",
                    marginBottom: 18,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 10,
                      flexWrap: "wrap",
                      gap: 6,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          color: T.danger,
                          fontWeight: 800,
                          fontSize: 13,
                        }}
                      >
                        ⚠ {overdueLoans.length} Overdue Loan
                        {overdueLoans.length > 1 ? "s" : ""}
                      </div>
                      <div
                        style={{ color: T.muted, fontSize: 12, marginTop: 2 }}
                      >
                        Total owed:{" "}
                        <span
                          style={{
                            color: T.danger,
                            fontWeight: 700,
                            fontFamily: T.mono,
                          }}
                        >
                          {fmt(totalOwed)}
                        </span>{" "}
                        · Max overdue:{" "}
                        <span style={{ color: T.danger, fontWeight: 700 }}>
                          {Math.max(...overdueLoans.map((l) => l.daysOverdue))}d
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <a
                      href={`tel:${phone}`}
                      style={{
                        flex: 1,
                        minWidth: 90,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 7,
                        background: T.ok,
                        color: "#fff",
                        borderRadius: 9,
                        padding: "10px 14px",
                        fontWeight: 800,
                        fontSize: 13,
                        textDecoration: "none",
                        fontFamily: T.body,
                      }}
                    >
                      📞 Call
                    </a>
                    <a
                      href={`sms:${phone}?body=${smsText}`}
                      style={{
                        flex: 1,
                        minWidth: 90,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 7,
                        background: T.bLo,
                        color: T.blue,
                        border: `1px solid ${T.blue}38`,
                        borderRadius: 9,
                        padding: "10px 14px",
                        fontWeight: 800,
                        fontSize: 13,
                        textDecoration: "none",
                        fontFamily: T.body,
                      }}
                    >
                      💬 SMS
                    </a>
                    <a
                      href={`https://wa.me/${waPhone}?text=${waText}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        flex: 1,
                        minWidth: 90,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 7,
                        background: "#25D36618",
                        color: "#25D366",
                        border: "1px solid #25D36638",
                        borderRadius: 9,
                        padding: "10px 14px",
                        fontWeight: 800,
                        fontSize: 13,
                        textDecoration: "none",
                        fontFamily: T.body,
                      }}
                    >
                      WhatsApp
                    </a>
                  </div>
                  {/* NOK quick-dial if available */}
                  {(customer.n1n || customer.n2n) && (
                    <div
                      style={{
                        marginTop: 10,
                        paddingTop: 10,
                        borderTop: `1px solid ${T.danger}20`,
                      }}
                    >
                      <div
                        style={{
                          color: T.muted,
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: 0.7,
                          marginBottom: 7,
                        }}
                      >
                        Next of Kin — Quick Dial
                      </div>
                      <div
                        style={{ display: "flex", gap: 7, flexWrap: "wrap" }}
                      >
                        {[
                          [customer.n1n, customer.n1p, customer.n1r],
                          [customer.n2n, customer.n2p, customer.n2r],
                          [customer.n3n, customer.n3p, customer.n3r],
                        ]
                          .filter(([n]) => n)
                          .map(([name, ph, rel]) => (
                            <a
                              key={ph}
                              href={`tel:${(ph || "").replace(/\s/g, "")}`}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                background: T.surface,
                                border: `1px solid ${T.border}`,
                                borderRadius: 8,
                                padding: "7px 11px",
                                textDecoration: "none",
                                fontSize: 12,
                                color: T.txt,
                                fontWeight: 600,
                              }}
                            >
                              <span style={{ fontSize: 14 }}>📞</span>
                              <span>
                                {name} {rel ? `(${rel})` : ""}
                              </span>
                            </a>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tabs */}
              <div
                style={{
                  display: "flex",
                  gap: 5,
                  marginBottom: 16,
                  overflowX: "auto",
                  paddingBottom: 4,
                }}
              >
                {tabs.map((t) => (
                  <button
                    key={t.k}
                    onClick={() => setTab(t.k)}
                    style={{
                      background: tab === t.k ? T.accent : T.surface,
                      color: tab === t.k ? "#060A10" : T.muted,
                      border: `1px solid ${tab === t.k ? T.accent : T.border}`,
                      borderRadius: 99,
                      padding: "5px 14px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.l}
                  </button>
                ))}
              </div>

              {tab === "info" && (
                <div>
                  {/* Account summary */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3,1fr)",
                      gap: 7,
                      marginBottom: 12,
                    }}
                  >
                    {[
                      ["Borrowed", fmt(totalPrincipal), T.accent],
                      ["Paid", fmt(totalPaid), T.ok],
                      [
                        "Active",
                        activeLoans.length,
                        activeLoans.length > 0 ? T.ok : T.muted,
                      ],
                      [
                        "Overdue",
                        overdueLoans.length,
                        overdueLoans.length > 0 ? T.danger : T.ok,
                      ],
                      ["Settled", settledLoans.length, T.accent],
                      ["Joined", customer.joined, T.txt],
                    ].map(([k, v, col]) => (
                      <div
                        key={k}
                        style={{
                          background: T.surface,
                          borderRadius: 8,
                          padding: "9px 10px",
                          border: `1px solid ${T.border}`,
                        }}
                      >
                        <div
                          style={{
                            color: T.muted,
                            fontSize: 9,
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                            marginBottom: 2,
                          }}
                        >
                          {k}
                        </div>
                        <div
                          style={{
                            color: col,
                            fontWeight: 800,
                            fontSize: 13,
                            fontFamily: "monospace",
                          }}
                        >
                          {v}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Last payment */}
                  {lastPay && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: T.oLo,
                        border: `1px solid ${T.ok}30`,
                        borderRadius: 8,
                        padding: "9px 13px",
                        marginBottom: 12,
                      }}
                    >
                      <div>
                        <div
                          style={{ color: T.ok, fontWeight: 700, fontSize: 12 }}
                        >
                          Last Payment
                        </div>
                        <div style={{ color: T.muted, fontSize: 11 }}>
                          {lastPay.date} · {lastPay.mpesa || "Manual"} ·{" "}
                          {lastPay.loanId || "—"}
                        </div>
                      </div>
                      <div
                        style={{
                          color: T.ok,
                          fontFamily: "monospace",
                          fontWeight: 900,
                          fontSize: 15,
                        }}
                      >
                        {fmt(lastPay.amount)}
                      </div>
                    </div>
                  )}
                  {/* Personal + business fields */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 7,
                      marginBottom: 12,
                    }}
                  >
                    {[
                      ["Customer ID", customer.id],
                      ["Phone", customer.phone],
                      ["Alt Phone", customer.altPhone || "—"],
                      ["National ID", customer.idNo],
                      ["Date of Birth", customer.dob || "—"],
                      ["Gender", customer.gender || "—"],
                      ["Residence", customer.residence || "—"],
                      ["Business", customer.business || "—"],
                      ["Location", customer.location || "—"],
                      ["Officer", customer.officer || "—"],
                      [
                        "Risk",
                        <Badge color={RC[customer.risk]}>
                          {customer.risk}
                        </Badge>,
                      ],
                      [
                        "Status",
                        customer.blacklisted ? (
                          <Badge color={T.danger}>Blacklisted</Badge>
                        ) : (
                          <Badge color={T.ok}>Active</Badge>
                        ),
                      ],
                    ].map(([k, v]) => (
                      <div
                        key={k}
                        style={{
                          background: T.surface,
                          borderRadius: 8,
                          padding: "8px 10px",
                        }}
                      >
                        <div
                          style={{
                            color: T.muted,
                            fontSize: 9,
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                            marginBottom: 2,
                          }}
                        >
                          {k}
                        </div>
                        <div
                          style={{
                            color: T.txt,
                            fontSize: 13,
                            fontWeight: 600,
                          }}
                        >
                          {v}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Next of kin */}
                  <div
                    style={{
                      background: T.surface,
                      borderRadius: 10,
                      padding: "12px 14px",
                    }}
                  >
                    <div
                      style={{
                        color: T.accent,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: 1,
                        textTransform: "uppercase",
                        marginBottom: 8,
                      }}
                    >
                      Next of Kin
                    </div>
                    {[
                      ["1", customer.n1n, customer.n1p, customer.n1r],
                      ["2", customer.n2n, customer.n2p, customer.n2r],
                      ["3", customer.n3n, customer.n3p, customer.n3r],
                    ].map(([n, name, ph, rel]) => (
                      <div
                        key={n}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "7px 0",
                          borderBottom: `1px solid ${T.border}30`,
                          fontSize: 13,
                        }}
                      >
                        <span style={{ color: T.muted }}>
                          NOK {n}:{" "}
                          <span style={{ color: T.txt, fontWeight: 600 }}>
                            {name || "—"}
                          </span>{" "}
                          {rel ? (
                            <span style={{ color: T.muted }}> · {rel}</span>
                          ) : (
                            ""
                          )}
                        </span>
                        {ph && (
                          <a
                            href={`tel:${ph.replace(/\s/g, "")}`}
                            style={{
                              color: T.accent,
                              textDecoration: "none",
                              fontSize: 12,
                              fontWeight: 700,
                              background: T.aLo,
                              padding: "3px 9px",
                              borderRadius: 99,
                              border: `1px solid ${T.aMid}`,
                            }}
                          >
                            📞 {ph}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {tab === "loans" && (
                <div>
                  {myLoans.length === 0 && (
                    <div
                      style={{
                        color: T.muted,
                        textAlign: "center",
                        padding: 20,
                        background: T.surface,
                        borderRadius: 9,
                      }}
                    >
                      No loans on record
                    </div>
                  )}
                  <div
                    style={{
                      maxHeight: "40vh",
                      overflowY: "auto",
                      overflowX: "hidden",
                    }}
                  >
                    {myLoans.map((loan) => {
                      const lPays = myPays.filter((p) => p.loanId === loan.id);
                      const lLast =
                        [...lPays].sort((a, b) =>
                          b.date.localeCompare(a.date),
                        )[0] || null;
                      const lPaid = lPays.reduce((s, p) => s + p.amount, 0);
                      const eng = calculateLoanStatus(loan);
                      return (
                        <div
                          key={loan.id}
                          style={{
                            background: T.surface,
                            border: `1.5px solid ${loan.status === "Overdue" ? T.danger + "40" : loan.status === "Settled" ? T.accent + "30" : T.border}`,
                            borderRadius: 11,
                            padding: "13px 14px",
                            marginBottom: 10,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              marginBottom: 9,
                              flexWrap: "wrap",
                              gap: 5,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 7,
                              }}
                            >
                              <span
                                onClick={() =>
                                  onSelectLoan && onSelectLoan(loan)
                                }
                                style={{
                                  color: T.accent,
                                  fontFamily: "monospace",
                                  fontWeight: 800,
                                  fontSize: 13,
                                  cursor: onSelectLoan ? "pointer" : "default",
                                  borderBottom: onSelectLoan
                                    ? `1px dashed ${T.accent}50`
                                    : "none",
                                }}
                              >
                                {loan.id}
                              </span>
                              <Badge color={SC[loan.status] || T.muted}>
                                {loan.status}
                              </Badge>
                              {eng.isFrozen && (
                                <Badge color={T.muted}>❄ Frozen</Badge>
                              )}
                            </div>
                            <span
                              style={{
                                color: T.txt,
                                fontFamily: "monospace",
                                fontWeight: 800,
                              }}
                            >
                              {fmt(loan.amount)}
                            </span>
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(3,1fr)",
                              gap: 5,
                              marginBottom: 8,
                            }}
                          >
                            {[
                              [
                                "Remaining",
                                fmt(Math.max(0, (loan.amount || 0) + Math.round((loan.amount || 0) * 0.3) - lPaid)),
                                loan.status === "Overdue" ? T.danger : T.txt,
                              ],
                              [
                                "Interest+",
                                fmt(eng.interestAccrued),
                                eng.interestAccrued > 0 ? T.warn : T.muted,
                              ],
                              [
                                "Penalty",
                                fmt(eng.penaltyAccrued),
                                eng.penaltyAccrued > 0 ? T.danger : T.muted,
                              ],
                              [
                                "Total Due", 
                                fmt(Math.max(0, (loan.amount || 0) + Math.round((loan.amount || 0) * 0.3) + eng.interestAccrued + eng.penaltyAccrued - lPaid)), 
                                T.accent
                              ],
                              [
                                "Overdue",
                                loan.daysOverdue > 0
                                  ? `${loan.daysOverdue}d`
                                  : "None",
                                loan.daysOverdue > 0 ? T.danger : T.ok,
                              ],
                              ["Officer", loan.officer || "—", T.txt],
                            ].map(([k, v, col]) => (
                              <div
                                key={k}
                                style={{
                                  background: T.card,
                                  borderRadius: 6,
                                  padding: "6px 8px",
                                }}
                              >
                                <div
                                  style={{
                                    color: T.muted,
                                    fontSize: 9,
                                    textTransform: "uppercase",
                                    letterSpacing: 0.4,
                                    marginBottom: 1,
                                  }}
                                >
                                  {k}
                                </div>
                                <div
                                  style={{
                                    color: col,
                                    fontSize: 12,
                                    fontWeight: 700,
                                  }}
                                >
                                  {v}
                                </div>
                              </div>
                            ))}
                          </div>
                          {lLast && (
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                background: T.oLo,
                                border: `1px solid ${T.ok}20`,
                                borderRadius: 6,
                                padding: "6px 9px",
                                fontSize: 12,
                              }}
                            >
                              <span style={{ color: T.muted }}>
                                Last payment{" "}
                                <b style={{ color: T.txt }}>{lLast.date}</b> ·{" "}
                                {lLast.mpesa || "manual"}
                              </span>
                              <span
                                style={{
                                  color: T.ok,
                                  fontFamily: "monospace",
                                  fontWeight: 800,
                                }}
                              >
                                {fmt(lLast.amount)}
                              </span>
                            </div>
                          )}
                          {lPaid > 0 && (
                            <div
                              style={{
                                color: T.muted,
                                fontSize: 11,
                                marginTop: 5,
                              }}
                            >
                              {lPays.length} payment
                              {lPays.length !== 1 ? "s" : ""} · total paid{" "}
                              <b style={{ color: T.ok }}>{fmt(lPaid)}</b>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {tab === "payments" && (
                <div>
                  {/* Per-loan payment timelines */}
                  {myLoans.filter((l) => l.disbursed).length === 0 && (
                    <div
                      style={{
                        color: T.muted,
                        textAlign: "center",
                        padding: 24,
                        background: T.surface,
                        borderRadius: 10,
                      }}
                    >
                      No loan history with payments
                    </div>
                  )}
                  <div
                    style={{
                      maxHeight: "40vh",
                      overflowY: "auto",
                      overflowX: "hidden",
                    }}
                  >
                    {myLoans
                      .filter((l) => l.disbursed)
                      .map((l) => (
                        <div key={l.id} style={{ marginBottom: 20 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              marginBottom: 8,
                              flexWrap: "wrap",
                              padding: "8px 10px",
                              background: T.surface,
                              borderRadius: 9,
                              border: `1px solid ${T.border}`,
                            }}
                          >
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onSelectLoan) onSelectLoan(l);
                              }}
                              style={{
                                color: T.accent,
                                fontFamily: "monospace",
                                fontWeight: 700,
                                fontSize: 12,
                                cursor: onSelectLoan ? "pointer" : "default",
                                borderBottom: onSelectLoan
                                  ? `1px dashed ${T.accent}50`
                                  : "none",
                              }}
                            >
                              {l.id}
                            </span>
                            <Badge color={SC[l.status] || T.muted}>
                              {l.status}
                            </Badge>
                            <span style={{ color: T.muted, fontSize: 11 }}>
                              {l.repaymentType} · {fmt(l.amount)}
                            </span>
                            <span
                              style={{
                                color: T.muted,
                                fontSize: 11,
                                marginLeft: "auto",
                              }}
                            >
                              Disbursed {l.disbursed}
                            </span>
                          </div>
                          <PaymentTimeline
                            loan={l}
                            payments={payments}
                            compact={true}
                          />
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {tab === "interactions" &&
                (myInts.length === 0 ? (
                  <div
                    style={{ color: T.muted, textAlign: "center", padding: 20 }}
                  >
                    No interactions recorded
                  </div>
                ) : (
                  <div
                    style={{
                      maxHeight: "40vh",
                      overflowY: "auto",
                      overflowX: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {myInts.map((i) => (
                      <div
                        key={i.id}
                        style={{
                          background: T.surface,
                          border: `1px solid ${T.border}`,
                          borderRadius: 10,
                          padding: "12px 14px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 6,
                          }}
                        >
                          <Badge color={T.accent}>{i.type}</Badge>
                          <span style={{ color: T.muted, fontSize: 12 }}>
                            {i.date} · {i.officer}
                          </span>
                        </div>
                        <div style={{ color: T.txt, fontSize: 13 }}>
                          {i.notes}
                        </div>
                        {i.promiseAmount && (
                          <div
                            style={{
                              color: T.gold,
                              fontSize: 12,
                              marginTop: 4,
                            }}
                          >
                            Promise: {fmt(i.promiseAmount)} by {i.promiseDate} ·{" "}
                            <Badge
                              color={
                                i.promiseStatus === "Pending"
                                  ? T.warn
                                  : i.promiseStatus === "Kept"
                                    ? T.ok
                                    : T.danger
                              }
                            >
                              {i.promiseStatus}
                            </Badge>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              {tab === "docs" && <CustDocsTab customer={customer} />}
            </>
          )}
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
const safeStr = (v) =>
  String(v || "").replace(
    /[<>&"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c],
  );

export const generateLoanAgreementHTML = (loan, customer, officer) => {
  const today = new Date().toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const disbDate = safeStr(
    loan.disbursed
      ? new Date(loan.disbursed).toLocaleDateString("en-KE", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : today,
  );
  const totalRepay = loan.balance || Math.round((loan.amount || 0) * 1.3);
  const fmtAmt = (v) => "KES " + Number(v || 0).toLocaleString("en-KE");
  const repSched = () => {
    const t = totalRepay,
      rt = loan.repaymentType;
    if (rt === "Daily")
      return (
        "KES " +
        Math.ceil(t / 30).toLocaleString("en-KE") +
        " per day for 30 days"
      );
    if (rt === "Weekly")
      return "KES " + Math.ceil(t / 4).toLocaleString("en-KE") + " per week";
    if (rt === "Biweekly")
      return (
        "KES " + Math.ceil(t / 2).toLocaleString("en-KE") + " every 2 weeks"
      );
    if (rt === "Monthly") return fmtAmt(t) + " per month";
    return fmtAmt(t) + " lump sum";
  };
  const n = safeStr; // alias
  const parts = [
    "<!DOCTYPE html><html><head><meta charset=UTF-8><title>Loan Agreement " +
      n(loan.id) +
      "</title>",
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
    "<p style='text-align:center;font-size:9.5pt;color:#555;margin-bottom:14px'>Ref: <b>" +
      n(loan.id) +
      "</b> &nbsp;|&nbsp; Date: <b>" +
      disbDate +
      "</b></p>",
    "<p style='margin-bottom:12px'>This Agreement is entered on <b>" +
      disbDate +
      "</b> between <b>Adequate Capital Ltd</b> (Lender) and the borrower below.</p>",
    "<div class=sec>1. Borrower Information</div><div class=grid>",
    "<table><tr><td>Full Name</td><td>" + n(customer.name) + "</td></tr>",
    "<tr><td>National ID</td><td>" + n(customer.idNo) + "</td></tr>",
    "<tr><td>Date of Birth</td><td>" + n(customer.dob) + "</td></tr>",
    "<tr><td>Gender</td><td>" + n(customer.gender) + "</td></tr>",
    "<tr><td>Phone</td><td>" + n(customer.phone) + "</td></tr>",
    "<tr><td>Alt Phone</td><td>" + n(customer.altPhone) + "</td></tr></table>",
    "<table><tr><td>Residence</td><td>" +
      n(customer.residence || customer.location) +
      "</td></tr>",
    "<tr><td>Customer ID</td><td>" + n(customer.id) + "</td></tr>",
    "<tr><td>Risk</td><td>" + n(customer.risk) + "</td></tr>",
    "<tr><td>Date Joined</td><td>" +
      n(customer.joined) +
      "</td></tr></table></div>",
    "<div class=sec>2. Business Information</div><div class=grid>",
    "<table><tr><td>Business</td><td>" +
      n(customer.business) +
      "</td></tr><tr><td>Type</td><td>" +
      n(customer.businessType) +
      "</td></tr></table>",
    "<table><tr><td>Location</td><td>" +
      n(customer.location) +
      "</td></tr></table></div>",
    "<div class=sec>3. Loan Details</div>",
    "<div class=box><div class=lbl>Total Disbursed</div><div class=big>" +
      fmtAmt(loan.amount) +
      "</div>",
    "<div class=lbl style='margin-top:4px'>Total Repayable: " +
      fmtAmt(totalRepay) +
      " &nbsp;|&nbsp; " +
      repSched() +
      "</div></div>",
    "<div class=grid><table>",
    "<tr><td>Loan Ref</td><td>" + n(loan.id) + "</td></tr>",
    "<tr><td>Principal</td><td>" + fmtAmt(loan.amount) + "</td></tr>",
    "<tr><td>Interest (30%)</td><td>" +
      fmtAmt(Math.round((loan.amount || 0) * 0.3)) +
      "</td></tr>",
    "<tr><td>Total Repayable</td><td><b>" +
      fmtAmt(totalRepay) +
      "</b></td></tr></table>",
    "<table><tr><td>Disbursed</td><td>" + disbDate + "</td></tr>",
    "<tr><td>M-Pesa Code</td><td>" + n(loan.mpesa) + "</td></tr>",
    "<tr><td>Repayment</td><td>" + n(loan.repaymentType) + "</td></tr>",
    "<tr><td>Officer</td><td>" +
      n(loan.officer || officer) +
      "</td></tr></table></div>",
    "<div class=sec>4. Next of Kin</div><table>",
    "<tr style='background:#f0f0f0'><td><b>NOK</b></td><td><b>Name</b></td><td><b>Phone</b></td><td><b>Relationship</b></td></tr>",
    customer.n1n
      ? "<tr><td>1st</td><td>" +
        n(customer.n1n) +
        "</td><td>" +
        n(customer.n1p) +
        "</td><td>" +
        n(customer.n1r) +
        "</td></tr>"
      : "",
    customer.n2n
      ? "<tr><td>2nd</td><td>" +
        n(customer.n2n) +
        "</td><td>" +
        n(customer.n2p) +
        "</td><td>" +
        n(customer.n2r) +
        "</td></tr>"
      : "",
    customer.n3n
      ? "<tr><td>3rd</td><td>" +
        n(customer.n3n) +
        "</td><td>" +
        n(customer.n3p) +
        "</td><td>" +
        n(customer.n3r) +
        "</td></tr>"
      : "",
    "</table>",
    "<div class=sec>5. Terms</div>",
    "<p class=clause><b>5.1</b> Borrower agrees to repay " +
      fmtAmt(totalRepay) +
      " per the schedule above.</p>",
    "<p class=clause><b>5.2</b> Interest is 30% flat on principal, baked into the repayable amount. For overdue loans: Days 1–30 overdue: interest at 1.2%/day on outstanding balance. Days 31–60 overdue: penalty at 1.2%/day replaces interest (interest stops at day 30). After day 60: no further interest or penalty accrues — total amount due is frozen.</p>",
    "<p class=clause><b>5.3</b> Lender may contact Next of Kin upon default or non-communication.</p>",
    "<p class=clause><b>5.4</b> In default, Lender may recover via listed assets and legal means under Kenyan law.</p>",
    "<p class=clause><b>5.5</b> All information provided is true. False information is grounds for immediate loan recall.</p>",
    "<div class=sec>6. Signatures</div>",
    "<div class=sig>",
    "<div><div class=sline></div><div class=slbl>Borrower Signature</div><div class=sname>" +
      n(customer.name) +
      "</div><div class=slbl>ID: " +
      n(customer.idNo) +
      "</div><div class=dateline></div><div class=slbl>Date</div></div>",
    "<div><div class=sline></div><div class=slbl>Loan Officer Signature</div><div class=sname>" +
      n(loan.officer || officer || "Loan Officer") +
      "</div><div class=slbl>Adequate Capital Ltd</div><div class=dateline></div><div class=slbl>Date</div></div>",
    "</div>",
    "<hr class=thin style='margin-top:32px'><p style='font-size:9pt;color:#666;text-align:center'>Adequate Capital Ltd &middot; Micro-Finance &middot; Paybill: 4166191</p>",
    "</body></html>",
  ];
  return parts.join("\n");
};

export const generateAssetListHTML = (loan, customer, officer) => {
  const today = new Date().toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const fmtAmt = (v) => "KES " + Number(v || 0).toLocaleString("en-KE");
  const n = safeStr;
  const rowsHtml = Array.from(
    { length: 12 },
    (_, i) =>
      "<tr><td style='padding:8px 10px;border:1px solid #ccc'>" +
      (i + 1) +
      "</td>" +
      "<td style='padding:8px 10px;border:1px solid #ccc'></td>" +
      "<td style='padding:8px 10px;border:1px solid #ccc'></td>" +
      "<td style='padding:8px 10px;border:1px solid #ccc'></td>" +
      "<td style='padding:8px 10px;border:1px solid #ccc'></td></tr>",
  ).join("");
  const parts = [
    "<!DOCTYPE html><html><head><meta charset=UTF-8><title>Asset Declaration " +
      n(loan.id) +
      "</title>",
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
    "<p style='text-align:center;font-size:9.5pt;color:#555;margin-bottom:14px'>Loan Ref: <b>" +
      n(loan.id) +
      "</b> &nbsp;|&nbsp; Date: <b>" +
      today +
      "</b></p>",
    "<p style='margin-bottom:12px'>This form lists all assets that may be used for loan recovery in the event of default on Loan <b>" +
      n(loan.id) +
      "</b>.</p>",
    "<div class=sec>Borrower Details</div><div class=grid>",
    "<div class=row><span class=lbl>Full Name:</span><span>" +
      n(customer.name) +
      "</span></div>",
    "<div class=row><span class=lbl>National ID:</span><span>" +
      n(customer.idNo) +
      "</span></div>",
    "<div class=row><span class=lbl>Business:</span><span>" +
      n(customer.business) +
      "</span></div>",
    "<div class=row><span class=lbl>Location:</span><span>" +
      n(customer.location) +
      "</span></div>",
    "<div class=row><span class=lbl>Phone:</span><span>" +
      n(customer.phone) +
      "</span></div>",
    "<div class=row><span class=lbl>Loan Amount:</span><span><b>" +
      fmtAmt(loan.amount) +
      "</b></span></div>",
    "<div class=row><span class=lbl>Loan Officer:</span><span>" +
      n(loan.officer || officer) +
      "</span></div>",
    "<div class=row><span class=lbl>Date:</span><span>" +
      today +
      "</span></div></div>",
    "<div class=sec>Asset List</div>",
    "<p style='font-size:10pt;color:#555;margin-bottom:8px'>List all assets including household items, business stock, land, vehicles, electronics.</p>",
    "<table><thead><tr><th style='width:5%'>#</th><th style='width:30%'>Description</th><th style='width:20%'>Location</th><th style='width:20%'>Est. Value (KES)</th><th style='width:25%'>Ownership Proof</th></tr></thead><tbody>",
    rowsHtml,
    "</tbody></table>",
    "<div class=sec>Additional Notes</div><div class=note><p style='color:#aaa;font-size:9.5pt'>Write additional assets here...</p></div>",
    "<div class=sec>Declaration</div>",
    "<p style='font-size:10.5pt'>I, <b>" +
      n(customer.name || "___________________") +
      "</b>, declare the assets above are true and accurate. I understand they may be used for recovery of Loan <b>" +
      n(loan.id) +
      "</b> upon default.</p>",
    "<div class=sig>",
    "<div><div class=sline></div><div class=slbl>Borrower Signature</div><div class=sname>" +
      n(customer.name) +
      "</div><div class=slbl>ID: " +
      n(customer.idNo) +
      "</div><div class=dateline></div><div class=slbl>Date</div></div>",
    "<div><div class=sline></div><div class=slbl>Loan Officer Signature &amp; Stamp</div><div class=sname>" +
      n(loan.officer || officer || "Loan Officer") +
      "</div><div class=slbl>Adequate Capital Ltd</div><div class=dateline></div><div class=slbl>Date</div></div>",
    "</div>",
    "<hr style='border-top:1px solid #ccc;margin-top:32px'><p style='font-size:9pt;color:#666;text-align:center'>Adequate Capital Ltd &middot; Micro-Finance &middot; Paybill: 4166191</p>",
    "</body></html>",
  ];
  return parts.join("\n");
};

export const downloadLoanDoc = (html, filename) => {
  try {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: filename,
    });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 500);
    try {
      SFX.download();
    } catch (e) {}
  } catch (e) {
    console.error("Download failed", e);
  }
};

// -- Supabase mapping helpers -----------------------------------------
export const toSupabaseLoan = (l) => ({
  id: l.id,
  customer_id: l.customerId,
  customer_name: l.customer,
  amount: l.amount,
  balance: l.balance,
  status: l.status,
  repayment_type: l.repaymentType,
  officer: l.officer,
  risk: l.risk,
  disbursed: l.disbursed || null,
  mpesa: l.mpesa || null,
  phone: l.phone || null,
  days_overdue: l.daysOverdue || 0,
});
export const fromSupabaseLoan = (r) => ({
  id: r.id,
  customerId: r.customer_id,
  customer: r.customer_name,
  amount: Number(r.amount),
  balance: Number(r.balance),
  status: r.status,
  repaymentType: r.repayment_type,
  officer: r.officer,
  risk: r.risk,
  disbursed: r.disbursed,
  mpesa: r.mpesa,
  phone: r.phone,
  daysOverdue: r.days_overdue || 0,
  payments: [],
});
export const toSupabaseCustomer = (c) => ({
  id: c.id,
  name: c.name,
  phone: c.phone,
  alt_phone: c.altPhone || null,
  id_no: c.idNo,
  business_name: c.businessName || c.business || null,
  business_type: c.businessType || null,
  business_location: c.businessLocation || c.location || null,
  residence: c.residence || null,
  officer: c.officer || null,
  loans: c.loans || 0,
  risk: c.risk || "Medium",
  gender: c.gender || null,
  dob: c.dob || null,
  blacklisted: c.blacklisted || false,
  bl_reason: c.blReason || null,
  from_lead: c.fromLead || null,
  n1_name: c.n1n || null,
  n1_phone: c.n1p || null,
  n1_relation: c.n1r || null,
  n2_name: c.n2n || null,
  n2_phone: c.n2p || null,
  n2_relation: c.n2r || null,
  n3_name: c.n3n || null,
  n3_phone: c.n3p || null,
  n3_relation: c.n3r || null,
  documents: c.docs || [],
  created_at: c.joined || c.createdAt || null,
});
export const fromSupabaseCustomer = (r) => ({
  id: r.id,
  name: r.name,
  phone: r.phone,
  altPhone: r.alt_phone,
  idNo: r.id_no,
  businessName: r.business_name || r.business,
  business: r.business_name || r.business,
  businessType: r.business_type,
  businessLocation: r.business_location || r.location,
  location: r.business_location || r.location,
  residence: r.residence || r.address,
  officer: r.officer,
  loans: r.loans || 0,
  risk: r.risk || r.risk || "Medium",
  gender: r.gender,
  dob: r.dob || r.dob,
  blacklisted: r.blacklisted || r.status === "Blacklisted",
  blReason: r.bl_reason,
  fromLead: r.from_lead,
  status: r.status,
  n1n: r.n1_name,
  n1p: r.n1_phone,
  n1r: r.n1_relation,
  n2n: r.n2_name,
  n2p: r.n2_phone,
  n2r: r.n2_relation,
  n3n: r.n3_name,
  n3p: r.n3_phone,
  n3r: r.n3_relation,
  joined: r.created_at || r.joined,
  createdAt: r.created_at,
  docs: r.documents || [],
});
export const toSupabasePayment = (p) => ({
  id: p.id,
  loan_id: p.loanId || null,
  customer_id: p.customerId || null,
  customer_name: p.customer || null,
  amount: p.amount,
  mpesa: p.mpesa || null,
  date: p.date || null,
  status: p.status || "Unallocated",
  allocated_by: p.allocatedBy || null,
  note: p.note || null,
  is_reg_fee: p.isRegFee || false,
});
export const fromSupabasePayment = (r) => ({
  id: r.id,
  loanId: r.loan_id,
  customerId: r.customer_id,
  customer: r.customer_name,
  amount: Number(r.amount),
  mpesa: r.mpesa,
  date: r.date,
  status: r.status,
  allocatedBy: r.allocated_by,
  note: r.note,
  isRegFee: r.is_reg_fee || false,
});
export const toSupabaseLead = (l) => ({
  id: l.id,
  name: l.name,
  phone: l.phone,
  business: l.business || null,
  location: l.location || null,
  source: l.source || "Referral",
  officer: l.officer || null,
  status: l.status || "New",
  notes: l.notes || null,
  date: l.date || null,
});
export const fromSupabaseLead = (r) => ({ ...r });
export const toSupabaseInteraction = (i) => ({
  id: i.id,
  customer_id: i.customerId || null,
  loan_id: i.loanId || null,
  type: i.type,
  date: i.date || null,
  created_at: i.created_at || null,
  officer: i.officer || null,
  notes: i.notes,
  promise_amount: i.promiseAmount || null,
  promise_date: i.promiseDate || null,
  promise_status: i.promiseStatus || null,
});
export const fromSupabaseInteraction = (r) => ({
  id: r.id,
  customerId: r.customer_id,
  loanId: r.loan_id,
  type: r.type,
  date: r.date || r.created_at,
  officer: r.officer,
  notes: r.notes,
  promiseAmount: r.promise_amount,
  promiseDate: r.promise_date,
  promiseStatus: r.promise_status,
  createdAt: r.created_at,
});
export const toSupabaseWorker = (w) => ({ ...w });
export const fromSupabaseWorker = (r) => ({ ...r });

if (typeof window !== "undefined") window._sbErrors = window._sbErrors || [];
const _sbErr = (op, table, msg) => {
  const entry = `[${op}] ${table}: ${msg}`;
  console.error(entry);
  if (typeof window !== "undefined")
    window._sbErrors.push({ ts: new Date().toISOString(), entry });
};
export const sbWrite = (table, row) => {
  import("@/config/supabaseClient")
    .then(({ supabase, DEMO_MODE }) => {
      if (DEMO_MODE || !supabase) return;
      supabase
        .from(table)
        .upsert([row], { onConflict: "id" })
        .then(({ error }) => {
          if (error) _sbErr("upsert", table, error.message);
        });
    })
    .catch((e) => _sbErr("import", "sbWrite", e.message));
};
export const sbDelete = (table, id) => {
  import("@/config/supabaseClient")
    .then(({ supabase, DEMO_MODE }) => {
      if (DEMO_MODE || !supabase) return;
      supabase
        .from(table)
        .delete()
        .eq("id", id)
        .then(({ error }) => {
          if (error) _sbErr("delete", table, error.message);
        });
    })
    .catch((e) => _sbErr("import", "sbDelete", e.message));
};
export const sbInsert = (table, row) => {
  import("@/config/supabaseClient")
    .then(({ supabase, DEMO_MODE }) => {
      if (DEMO_MODE || !supabase) return;
      supabase
        .from(table)
        .insert([row])
        .then(({ error }) => {
          if (error) _sbErr("insert", table, error.message);
        });
    })
    .catch((e) => _sbErr("import", "sbInsert", e.message));
};

// -- Security Configuration ------------------------------------------
export const getSecConfig = () => {
  const defaults = {
    passwordEnabled: true,
    biometricEnabled: false,
    otpEnabled: false,
    adminEmail: "admin@adequatecapital.co.ke",
    adminPhone: "0711 222 333",
    adminRecoveryPhone: "0711 222 333",
  };
  try {
    if (typeof window === "undefined") return defaults;
    const saved = JSON.parse(localStorage.getItem("_acl_security") || "{}");
    return { ...defaults, ...saved };
  } catch (e) {
    return defaults;
  }
};

export const saveSecConfig = (cfg) => {
  try {
    localStorage.setItem("_acl_security", JSON.stringify(cfg));
  } catch (e) {}
};

// -- Navigation Constants ------------------------------------------
export const ADMIN_NAV = [
  { id: "dashboard", l: "Dashboard", i: "🏠" },
  { id: "calendar", l: "Calendar", i: "📅" },
  { id: "loans", l: "Loans", i: "💰" },
  { id: "customers", l: "Customers", i: "👤" },
  { id: "leads", l: "Leads", i: "🎯" },
  { id: "collections", l: "Collections", i: "📞" },
  { id: "payments", l: "Payments", i: "💳" },
  { id: "workers", l: "Team", i: "👷" },
  { id: "securitysettings", l: "Security Settings", i: "🛡️" },
  { id: "database", l: "Database", i: "🗄️" },
  { id: "reports", l: "Reports", i: "📊" },
  { id: "audit", l: "Audit Trail", i: "🔐" },
];


export const WORKER_NAV = [
  { id: "overview", l: "Overview", i: "??" },
  { id: "loans", l: "Loans", i: "??" },
  { id: "customers", l: "Customers", i: "??" },
  { id: "leads", l: "Leads", i: "??" },
  { id: "documents", l: "Documents", i: "??" },
];

export const dataUrlToBlob = (dataUrl) => {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], { type: mime });
};
export const sbUploadDoc = async (customerId, doc) => {
  const { supabase, DEMO_MODE } = await import("@/config/supabaseClient");
  if (DEMO_MODE || !supabase) return;
  try {
    const blob = dataUrlToBlob(doc.dataUrl);
    let filename = (doc.key + "_" + (doc.name || "file")).replace(
      /[^\w.-]+/g,
      "_",
    );

    // Auto-append extension if missing
    if (!filename.includes(".")) {
      const mime = blob.type.split("/")[1] || "bin";
      const ext = mime === "jpeg" ? "jpg" : mime;
      filename += "." + ext;
    }

    const path = customerId + "/" + filename;
    const { error } = await supabase.storage
      .from("documents")
      .upload(path, blob, { upsert: true });
    if (error) throw error;
    return path;
  } catch (e) {
    console.error("[sbUploadDoc]", e.message);
    throw e;
  }
};

// ── Export Menu Dropdown ────────────────────────────────────
export const ExportMenu = ({ onExport }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef();

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const items = [
    { id: "CSV", label: "Spreadsheet (CSV/Excel)", icon: "📊", color: T.ok },
    { id: "PDF", label: "Document (PDF)", icon: "📄", color: T.danger },
    { id: "WORD", label: "Word Document (DOCX)", icon: "📝", color: T.blue },
  ];

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <Btn v="secondary" onClick={() => setOpen(!open)} style={{ gap: 8 }}>
        <span>📤 Export</span>
        <span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
      </Btn>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 6,
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            boxShadow: "0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)",
            zIndex: 9999,
            minWidth: 220,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              borderBottom: `1px solid ${T.border}`,
              fontSize: 10,
              fontWeight: 800,
              color: T.muted,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Select Format
          </div>
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                onExport(item.id);
                setOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                cursor: "pointer",
                transition: "background .2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = T.surface;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "none";
              }}
            >
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span style={{ color: T.txt, fontSize: 13, fontWeight: 600 }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Date Range Picker ─────────────────────────────────────
export const DateRangePicker = ({
  start,
  end,
  onStartChange,
  onEndChange,
  onSearch,
}) => (
  <div
    style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}
  >
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "center",
        background: T.card,
        padding: "6px 12px",
        borderRadius: 12,
        border: `1px solid ${T.border}`,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <label
          style={{
            fontSize: 9,
            fontWeight: 800,
            color: T.muted,
            textTransform: "uppercase",
          }}
        >
          From
        </label>
        <input
          type="date"
          value={start}
          onChange={(e) => onStartChange(e.target.value)}
          style={{
            background: "transparent",
            border: "none",
            color: T.txt,
            fontSize: 12,
            outline: "none",
            maxWidth: 115,
          }}
        />
      </div>
      <div style={{ color: T.border, fontSize: 16 }}>→</div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <label
          style={{
            fontSize: 9,
            fontWeight: 800,
            color: T.muted,
            textTransform: "uppercase",
          }}
        >
          To
        </label>
        <input
          type="date"
          value={end}
          onChange={(e) => onEndChange(e.target.value)}
          style={{
            background: "transparent",
            border: "none",
            color: T.txt,
            fontSize: 12,
            outline: "none",
            maxWidth: 115,
          }}
        />
      </div>
    </div>
    <Btn onClick={onSearch} v="primary" sm style={{ height: 38, padding: "0 16px" }}>
      Search
    </Btn>
  </div>
);

// ── Module Header (Combined Title + Search + Date + Export) ──
export const ModuleHeader = ({
  title,
  sub,
  stats,
  search,
  dateRange,
  exportProps,
  refreshProps,
  pillsProps,
}) => (
  <div className="fu" style={{ marginBottom: 20 }}>
    <div
      className="mob-stack"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: 16,
        marginBottom: 18,
        position: "relative",
        zIndex: 10,
        overflow: "visible",
      }}
    >
      <div>
        <div
          style={{
            fontFamily: T.head,
            color: T.txt,
            fontSize: 22,
            fontWeight: 900,
          }}
        >
          {title}
        </div>
        {sub && (
          <div style={{ color: T.muted, fontSize: 13, marginTop: 3 }}>{sub}</div>
        )}
        {stats && (
          <div style={{ color: T.muted, fontSize: 12, marginTop: 4 }}>
            {stats}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {refreshProps && <RefreshBtn {...refreshProps} />}
        {exportProps && <ExportMenu {...exportProps} />}
      </div>
    </div>

    <div
      className="mob-stack"
      style={{
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        alignItems: "center",
        background: T.surface,
        padding: "12px 14px",
        borderRadius: 16,
        border: `1px solid ${T.border}`,
      }}
    >
      {search && (
        <div style={{ flex: 1, minWidth: 200 }}>
          <Search {...search} />
        </div>
      )}
      {dateRange && <DateRangePicker {...dateRange} />}
      {pillsProps && (
        <div style={{ borderLeft: `1px solid ${T.border}`, paddingLeft: 12 }}>
          <Pills {...pillsProps} />
        </div>
      )}
    </div>
  </div>
);

/**
 * Generates official collection letters (Reminder, Demand, Final Notice)
 * with appropriate tones and customer details.
 */
export const generateCollectionLetterHTML = (type, loan, customer, officer, trueDue) => {
  const today = new Date().toLocaleDateString("en-KE", { day: "2-digit", month: "long", year: "numeric" });
  const n = (v) => v || "—";
  const fmtAmt = (v) => "KES " + Number(v || 0).toLocaleString("en-KE");

  let title = "";
  let body = "";
  let deadline = "";

  if (type === "Reminder") {
    title = "LOAN REPAYMENT REMINDER";
    body = `<p>We are writing to bring to your attention that your loan account <b>${n(loan.id)}</b> is currently <b>${n(loan.daysOverdue)}</b> days overdue. As of today, the total outstanding amount is <b>${fmtAmt(trueDue)}</b>.</p>
            <p>At Adequate Capital Ltd, we value your business and understand that sometimes temporary challenges arise. We kindly request that you make arrangements to settle this balance as soon as possible to avoid further accrual of interest and potential impact on your credit rating.</p>
            <p>If you have already made this payment, please disregard this notice and provide us with the transaction details for reconciliation.</p>`;
  } else if (type === "Demand Letter") {
    title = "FORMAL DEMAND FOR PAYMENT";
    deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-KE", { day: "2-digit", month: "long", year: "numeric" });
    body = `<p>Despite our previous communications, our records indicate that your loan <b>${n(loan.id)}</b> remains unpaid. This is a <b>FORMAL DEMAND</b> for the immediate payment of the total outstanding sum of <b>${fmtAmt(trueDue)}</b>.</p>
            <p>Please note that your account is now <b>${n(loan.daysOverdue)}</b> days past due. You are hereby required to settle this amount in full by <b>${deadline}</b>.</p>
            <p>Failure to comply with this demand within the stipulated time will leave us with no choice but to escalate this matter to the next stage of recovery, which may include engaging debt collection agencies and listing your details with the Credit Reference Bureau (CRB).</p>`;
  } else if (type === "Final Notice") {
    title = "FINAL NOTICE BEFORE LEGAL ACTION";
    body = `<p>This is the <b>FINAL NOTICE</b> regarding your overdue loan <b>${n(loan.id)}</b>. Our records show an outstanding balance of <b>${fmtAmt(trueDue)}</b> which has remained unpaid for <b>${n(loan.daysOverdue)}</b> days.</p>
            <p>Take note that unless the full amount is received by close of business tomorrow, we will immediately initiate the following actions without further notice to you:</p>
            <ul>
              <li>Physical recovery of listed assets and collateral.</li>
              <li>Handing over the matter to our legal counsel for court proceedings.</li>
              <li>Permanent blacklisting on all Credit Reference Bureaus.</li>
            </ul>
            <p>This is your last opportunity to settle this matter amicably and avoid the additional costs and public embarrassment associated with legal recovery.</p>`;
  }

  const parts = [
    "<!DOCTYPE html><html><head><meta charset=UTF-8><title>" + title + "</title>",
    "<style>body{font-family:Arial,sans-serif;font-size:11pt;padding:28mm 22mm;color:#111;line-height:1.6}",
    "h1{font-size:16pt;text-align:left;color:#2a3a50;margin-bottom:2px}h2{font-size:12pt;font-weight:bold;margin-bottom:20px;border-bottom:2px solid #2a3a50;padding-bottom:10px}",
    ".letterhead{display:flex;justify-content:space-between;margin-bottom:40px;border-bottom:3px solid #2a3a50;padding-bottom:15px}",
    ".company-info{text-align:right;font-size:9.5pt;color:#555}",
    ".recipient{margin-bottom:30px}.recipient div{margin-bottom:2px}",
    ".subject{font-weight:bold;text-decoration:underline;margin-bottom:20px;text-transform:uppercase;color:#2a3a50}",
    ".closing{margin-top:40px}.sig-box{margin-top:50px;font-weight:bold}",
    "@media print{body{padding:20mm 18mm}}</style></head><body>",
    "<div class=letterhead><div><h1>Adequate Capital Ltd</h1><p style='margin:0;font-size:10pt;color:#2a3a50;font-weight:bold'>Empowering Your Progress</p></div>",
    "<div class=company-info>P.O. Box 12345-00100<br>Nairobi, Kenya<br>Tel: +254 700 000 000<br>Email: info@adequatecapital.co.ke</div></div>",
    "<div style='margin-bottom:20px'>Date: <b>" + today + "</b></div>",
    "<div class=recipient><div>To: <b>" + n(customer.name) + "</b></div>",
    "<div>Phone: " + n(customer.phone) + "</div>",
    "<div>ID No: " + n(customer.idNo) + "</div>",
    "<div>Residence: " + n(customer.residence) + "</div></div>",
    "<div class=subject>REF: " + title + " — LOAN ID: " + n(loan.id) + "</div>",
    "<p>Dear " + n(customer.name) + ",</p>",
    body,
    "<p>Please make your payment via our <b>M-Pesa Paybill: 4166191</b> using your National ID or Loan ID as the account number.</p>",
    "<div class=closing><p>Yours Sincerely,</p><div class=sig-box><div style='border-bottom:1.5px solid #2a3a50;width:200px;margin-bottom:5px'></div>",
    "<div>" + n(officer || "Collections Manager") + "</div><div>Adequate Capital Ltd</div></div></div>",
    "</body></html>",
  ];
  return parts.join("\n");
};
