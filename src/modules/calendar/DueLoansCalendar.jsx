import React, { useState, useMemo } from 'react';

// ─── Theme ────────────────────────────────────────────────────────────────────
const TH = {
  bg: '#080C14', card: '#111827', surface: '#1A2740', border: '#1E2D45',
  txt: '#E2E8F0', muted: '#64748B', accent: '#00D4AA', danger: '#EF4444',
  warn: '#F59E0B', gold: '#D4A017', success: '#10B981', blue: '#3B82F6',
  mono: 'monospace', sys: 'system-ui, -apple-system, sans-serif',
};

const SEV = {
  overdue:  { color: TH.danger,  bg: `${TH.danger}15`,  label: 'Overdue',   border: `3px solid ${TH.danger}` },
  today:    { color: TH.warn,    bg: `${TH.warn}15`,    label: 'Today',     border: `3px solid ${TH.warn}` },
  urgent:   { color: TH.gold,    bg: `${TH.gold}15`,    label: '1-3 Days',  border: `3px solid ${TH.gold}` },
  upcoming: { color: TH.blue,    bg: `${TH.blue}15`,    label: '4-7 Days',  border: `3px solid ${TH.blue}` },
  future:   { color: TH.success, bg: `${TH.success}15`, label: '8-30 Days', border: `3px solid ${TH.success}` },
  settled:  { color: TH.success, bg: `${TH.success}00`, label: 'Settled',   border: 'none' },
  none:     { color: 'transparent', bg: 'transparent',  label: '',          border: 'none' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the ISO-date string for the loan's strict 30-day maturity. */
const getLoanMaturityDate = (loan) => {
  if (!loan.disbursed) return null;
  const d = new Date(loan.disbursed);
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
};

/** True when the loan has been fully settled (Settled status or zero balance). */
const isLoanSettled = (loan) =>
  loan.status === 'Settled' || Number(loan.balance) <= 0;

/** Diff in whole days between maturityDate and todayStr (negative = overdue). */
const diffFromToday = (maturityDate, todayStr) => {
  const ms = new Date(maturityDate).getTime() - new Date(todayStr).getTime();
  return Math.ceil(ms / 86400000);
};

const getSeverity = (diff, settled) => {
  if (settled) return SEV.settled;
  if (diff < 0) return SEV.overdue;
  if (diff === 0) return SEV.today;
  if (diff <= 3) return SEV.urgent;
  if (diff <= 7) return SEV.upcoming;
  if (diff <= 30) return SEV.future;
  return SEV.none;
};

const getDaysInMonth = (year, month) => {
  const d = new Date(year, month, 1);
  const days = [];
  while (d.getMonth() === month) { days.push(new Date(d)); d.setDate(d.getDate() + 1); }
  return days;
};

const fmtMoney = (v) => `KES ${Number(v || 0).toLocaleString('en-KE')}`;

// ─── Component ────────────────────────────────────────────────────────────────
export default function DueLoansCalendar({
  loans = [], payments = [], workers = [], workerContext = {}, onOpenCustomerProfile,
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab]     = useState('Calendar');
  const [selectedDay, setSelectedDay] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate]     = useState('');
  const [endDate, setEndDate]         = useState('');

  // Reset scroll on tab/day change
  React.useEffect(() => {
    try {
      document.querySelector('.main-scroll')?.scrollTo({ top: 0, behavior: 'instant' });
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (e) {}
  }, [activeTab, selectedDay]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const yr = currentDate.getFullYear();
  const mo = currentDate.getMonth();

  // ── Base loan list (role-filtered, exclude rejected/written-off) ────────────
  const baseLoanList = useMemo(() => {
    let base = loans.filter(l =>
      ['Active', 'Overdue', 'Settled'].includes(l.status) && l.disbursed
    );
    if (workerContext.role === 'Loan Officer' && workerContext.name) {
      base = base.filter(l => l.officer === workerContext.name);
    }
    return base;
  }, [loans, workerContext]);

  // ── Build one maturity record per loan ─────────────────────────────────────
  // Each record carries accurate payment-derived figures so cards never show
  // the original principal instead of the real remaining balance.
  const maturityRecords = useMemo(() => {
    return baseLoanList.map(loan => {
      const maturity = getLoanMaturityDate(loan);
      if (!maturity) return null;
      const diff    = diffFromToday(maturity, todayStr);

      // Total originally owed = principal + flat 30% interest
      const totalOwed = Number(loan.amount) + Math.round(Number(loan.amount) * 0.3);

      // Sum all allocated payments recorded against this loan
      const totalPaid = (payments || [])
        .filter(p =>
          (p.loanId === loan.id || p.loan_id === loan.id) &&
          (p.status === 'Allocated' || p.status === 'allocated')
        )
        .reduce((s, p) => s + Number(p.amount || 0), 0);

      // Actual remaining balance after all payments
      const remainingBalance = Math.max(0, totalOwed - totalPaid);

      // Mark settled if the overarching status says so, or if math proves it's 100% paid
      const settled = isLoanSettled(loan) || remainingBalance <= 0;
      const sev     = getSeverity(diff, settled);

      return { loan, maturity, diff, settled, sev, totalOwed, totalPaid, remainingBalance };
    }).filter(Boolean);
  }, [baseLoanList, payments, todayStr]);

  // ── Index maturity records by date for calendar grid ───────────────────────
  const recordsByDate = useMemo(() => {
    const map = {};
    maturityRecords.forEach(r => {
      if (!map[r.maturity]) map[r.maturity] = [];
      map[r.maturity].push(r);
    });
    return map;
  }, [maturityRecords]);

  // ── Summary bar ────────────────────────────────────────────────────────────
  // Only unsettled loans count for overdue / today / week / month buckets.
  // Use remainingBalance (computed from actual payments) — not loan.balance.
  const summaryBox = useMemo(() => {
    const sb = { overdueCt: 0, overdueKES: 0, todayCt: 0, todayKES: 0, weekCt: 0, weekKES: 0, monthCt: 0, monthKES: 0 };
    maturityRecords.forEach(({ diff, settled, remainingBalance }) => {
      if (settled) return;
      if (diff < 0)                { sb.overdueCt++; sb.overdueKES += remainingBalance; }
      if (diff === 0)              { sb.todayCt++;   sb.todayKES   += remainingBalance; }
      if (diff >= 0 && diff <= 7)  { sb.weekCt++;    sb.weekKES    += remainingBalance; }
      if (diff >= 0 && diff <= 30) { sb.monthCt++;   sb.monthKES   += remainingBalance; }
    });
    return sb;
  }, [maturityRecords]);

  // ── Collection rate for the current calendar month ─────────────────────────
  // Uses actual totalPaid vs totalOwed from payment records.
  const collectionRate = useMemo(() => {
    const moStart = new Date(yr, mo, 1).toISOString().slice(0, 10);
    const moEnd   = new Date(yr, mo + 1, 0).toISOString().slice(0, 10);
    let expected = 0, actualPaid = 0;
    maturityRecords.forEach(({ maturity, totalOwed, totalPaid }) => {
      if (maturity >= moStart && maturity <= moEnd) {
        expected  += totalOwed;
        actualPaid += totalPaid;
      }
    });
    return expected > 0 ? Math.min(Math.round((actualPaid / expected) * 100), 100) : 100;
  }, [maturityRecords, yr, mo]);

  // ── Search results ─────────────────────────────────────────────────────────
  const searchResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q && !startDate && !endDate) return [];
    return maturityRecords.filter(({ loan, maturity }) => {
      const textMatch  = !q || loan.id.toLowerCase().includes(q) || loan.customer.toLowerCase().includes(q) || (loan.officer || '').toLowerCase().includes(q);
      const startMatch = !startDate || maturity >= startDate;
      const endMatch   = !endDate   || maturity <= endDate;
      return textMatch && startMatch && endMatch;
    });
  }, [maturityRecords, searchQuery, startDate, endDate]);

  // ── Calendar cell renderer ─────────────────────────────────────────────────
  const getDayUI = (dateObj) => {
    const dStr = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000)
      .toISOString().slice(0, 10);
    const dayRecords = recordsByDate[dStr] || [];

    // Count by severity
    const cnt = { overdue: 0, today: 0, urgent: 0, upcoming: 0, future: 0, settled: 0 };
    let highest = SEV.none;
    dayRecords.forEach(r => {
      if (r.sev === SEV.overdue)  { cnt.overdue++;  if (highest === SEV.none) highest = SEV.overdue; }
      else if (r.sev === SEV.today)    { cnt.today++;    if (![SEV.overdue].includes(highest)) highest = SEV.today; }
      else if (r.sev === SEV.urgent)   { cnt.urgent++;   if (![SEV.overdue, SEV.today].includes(highest)) highest = SEV.urgent; }
      else if (r.sev === SEV.upcoming) { cnt.upcoming++; if (![SEV.overdue, SEV.today, SEV.urgent].includes(highest)) highest = SEV.upcoming; }
      else if (r.sev === SEV.future)   { cnt.future++;   if (highest === SEV.none) highest = SEV.future; }
      else if (r.sev === SEV.settled)  { cnt.settled++; }
    });

    const isToday = dStr === todayStr;
    const isSel   = selectedDay?.date === dStr;
    const outMonth = dateObj.getMonth() !== mo;

    return (
      <div
        key={dStr}
        onClick={() => setSelectedDay({ date: dStr, records: dayRecords })}
        style={{
          background: isToday ? `${TH.accent}10` : TH.surface,
          borderTop:    `1px solid ${isSel ? TH.accent : TH.border}`,
          borderRight:  `1px solid ${isSel ? TH.accent : TH.border}`,
          borderBottom: `1px solid ${isSel ? TH.accent : TH.border}`,
          borderLeft:   highest !== SEV.none ? highest.border : `1px solid ${TH.border}`,
          minHeight: 80,
          padding: 8,
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.2s ease',
          opacity: outMonth ? 0.4 : 1,
        }}
        onMouseOver={e => e.currentTarget.style.background = TH.border}
        onMouseOut={e  => e.currentTarget.style.background = isToday ? `${TH.accent}10` : TH.surface}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ color: isToday ? TH.accent : TH.txt, fontWeight: isToday ? 800 : 500, fontSize: 13 }}>
            {dateObj.getDate()}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {cnt.overdue  > 0 && <div style={{ background: SEV.overdue.bg,  color: SEV.overdue.color,  padding: '2px 5px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{cnt.overdue} overdue</div>}
          {cnt.today    > 0 && <div style={{ background: SEV.today.bg,    color: SEV.today.color,    padding: '2px 5px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{cnt.today} due today</div>}
          {cnt.urgent   > 0 && <div style={{ background: SEV.urgent.bg,   color: SEV.urgent.color,   padding: '2px 5px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{cnt.urgent} urgent</div>}
          {cnt.upcoming > 0 && <div style={{ background: SEV.upcoming.bg, color: SEV.upcoming.color, padding: '2px 5px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{cnt.upcoming} upcoming</div>}
          {cnt.future   > 0 && <div style={{ background: SEV.future.bg,   color: SEV.future.color,   padding: '2px 5px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{cnt.future} future</div>}
          {cnt.settled  > 0 && <div style={{ color: TH.muted, fontSize: 9 }}>✓ {cnt.settled} settled</div>}
        </div>
      </div>
    );
  };

  // ── Loan card for side panel / list views ──────────────────────────────────
  const renderLoanCard = (r) => {
    const { loan, maturity, diff, settled, totalOwed, totalPaid, remainingBalance } = r;
    const statusLabel = settled ? 'Settled' : diff < 0 ? 'Overdue' : diff === 0 ? 'Due Today' : `Due in ${diff}d`;
    const statusColor = settled ? TH.success : diff < 0 ? TH.danger : diff === 0 ? TH.warn : TH.blue;
    const pctPaid     = totalOwed > 0 ? Math.min(Math.round((totalPaid / totalOwed) * 100), 100) : 0;

    return (
      <div key={loan.id} style={{ background: TH.surface, border: `1px solid ${TH.border}`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ background: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}30`, padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {statusLabel}
              </div>
            </div>
            <div style={{ color: TH.txt, fontWeight: 700, fontSize: 14 }}>{loan.customer}</div>
            <div style={{ color: TH.accent, fontFamily: TH.mono, fontSize: 11, fontWeight: 800, marginTop: 1 }}>{loan.id}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: settled ? TH.success : TH.danger, fontWeight: 800, fontSize: 15 }}>{fmtMoney(remainingBalance)}</div>
            <div style={{ color: TH.muted, fontSize: 10, marginTop: 2 }}>Outstanding Balance</div>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: TH.muted, fontSize: 10 }}>Repayment progress</span>
            <span style={{ color: TH.accent, fontFamily: TH.mono, fontSize: 10, fontWeight: 700 }}>{pctPaid}%</span>
          </div>
          <div style={{ height: 5, background: TH.bg, borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pctPaid}%`, background: pctPaid >= 100 ? TH.success : 'linear-gradient(90deg,#00D4AA,#00FFD1)', borderRadius: 99, transition: 'width .4s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
            <span style={{ color: TH.success, fontSize: 9 }}>Paid: {fmtMoney(totalPaid)}</span>
            <span style={{ color: TH.muted, fontSize: 9 }}>Total: {fmtMoney(totalOwed)}</span>
          </div>
        </div>
        {/* Meta row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <div style={{ background: TH.bg, borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ color: TH.muted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>Maturity Date</div>
            <div style={{ color: TH.txt, fontSize: 12, fontWeight: 700 }}>{maturity}</div>
          </div>
          <div style={{ background: TH.bg, borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ color: TH.muted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>Disbursed</div>
            <div style={{ color: TH.txt, fontSize: 12, fontWeight: 700 }}>{loan.disbursed}</div>
          </div>
          <div style={{ background: TH.bg, borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ color: TH.muted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>Remaining Balance</div>
            <div style={{ color: settled ? TH.success : remainingBalance === 0 ? TH.success : TH.danger, fontSize: 12, fontWeight: 700 }}>{fmtMoney(remainingBalance)}</div>
          </div>
          <div style={{ background: TH.bg, borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ color: TH.muted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>Officer</div>
            <div style={{ color: TH.txt, fontSize: 12, fontWeight: 700 }}>{loan.officer || '—'}</div>
          </div>
        </div>
        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: `1px dashed ${TH.border}`, paddingTop: 10 }}>
          <a href={`tel:${loan.phone}`} style={{ textDecoration: 'none', background: `${TH.accent}15`, color: TH.accent, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>📞 Call</a>
          <a href={`sms:${loan.phone}`} style={{ textDecoration: 'none', background: `${TH.blue}15`,   color: TH.blue,   padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>💬 SMS</a>
          <button onClick={() => onOpenCustomerProfile?.(loan.customerId)} style={{ background: `${TH.muted}20`, color: TH.txt, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer' }}>👤 Profile</button>
        </div>
      </div>
    );
  };

  // ── Calendar grid ──────────────────────────────────────────────────────────
  const renderCalendarTab = () => {
    const days = getDaysInMonth(yr, mo);
    const firstDay = days[0].getDay();
    const blanks = Array.from({ length: firstDay === 0 ? 6 : firstDay - 1 }).map((_, i) => {
      const d = new Date(yr, mo, 0 - i); return getDayUI(d);
    }).reverse();
    const trailing = Array.from({ length: (7 - ((blanks.length + days.length) % 7)) % 7 }).map((_, i) => {
      const d = new Date(yr, mo + 1, i + 1); return getDayUI(d);
    });
    const headers = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return (
      <div style={{ background: TH.card, borderRadius: 12, padding: '16px 8px', border: `1px solid ${TH.border}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 8 }}>
          {headers.map(h => <div key={h} style={{ color: TH.muted, fontSize: 12, fontWeight: 700, textAlign: 'center', textTransform: 'uppercase' }}>{h}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {blanks}
          {days.map(d => getDayUI(d))}
          {trailing}
        </div>
      </div>
    );
  };

  // ── Overdue / Upcoming list ────────────────────────────────────────────────
  const renderListTab = (mode) => {
    const groups = mode === 'Overdue' ? {
      crt: { lbl: 'Critical (90+ days)',      col: '#991B1B', bg: '#450A0A',           records: [] },
      lte: { lbl: 'Late Stage (31-90 days)',  col: TH.danger, bg: `${TH.danger}15`,    records: [] },
      mid: { lbl: 'Mid Stage (8-30 days)',    col: TH.warn,   bg: `${TH.warn}15`,      records: [] },
      erl: { lbl: 'Early (1-7 days)',         col: TH.gold,   bg: `${TH.gold}15`,      records: [] },
    } : {
      tdy: { lbl: 'Due Today',                col: TH.warn,    bg: `${TH.warn}15`,    records: [] },
      tmr: { lbl: 'Due Tomorrow',             col: TH.gold,    bg: `${TH.gold}15`,    records: [] },
      u3d: { lbl: 'Due in 2-3 Days (Urgent)', col: TH.accent,  bg: `${TH.accent}15`,  records: [] },
      uwk: { lbl: 'Due This Week',            col: TH.blue,    bg: `${TH.blue}15`,    records: [] },
      umn: { lbl: 'Due Later This Month',     col: TH.success, bg: `${TH.success}15`, records: [] },
    };

    maturityRecords.forEach(r => {
      if (r.settled) return; // settled loans excluded from both lists
      const d = r.diff;
      if (mode === 'Overdue') {
        if (d < 0) {
          const ag = Math.abs(d);
          if (ag >= 90) groups.crt.records.push(r);
          else if (ag >= 31) groups.lte.records.push(r);
          else if (ag >= 8)  groups.mid.records.push(r);
          else               groups.erl.records.push(r);
        }
      } else {
        if (d === 0)      groups.tdy.records.push(r);
        else if (d === 1) groups.tmr.records.push(r);
        else if (d <= 3)  groups.u3d.records.push(r);
        else if (d <= 7)  groups.uwk.records.push(r);
        else if (d <= 30) groups.umn.records.push(r);
      }
    });

    const activeGroups = Object.values(groups).filter(g => g.records.length > 0);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {activeGroups.map(g => {
          const key = g.lbl;
          const isExp = expandedGroups[key];
          return (
            <div key={key} style={{ background: TH.card, borderRadius: 12, border: `1px solid ${TH.border}`, overflow: 'hidden' }}>
              <div
                onClick={() => setExpandedGroups(p => ({ ...p, [key]: !p[key] }))}
                style={{ background: g.bg, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${TH.border}`, cursor: 'pointer' }}
              >
                <div style={{ color: g.col, fontWeight: 800, fontSize: 15 }}>{g.lbl}</div>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div style={{ color: TH.txt, fontSize: 13, fontWeight: 700 }}>{g.records.length} Loans</div>
                  <div style={{ color: TH.muted, fontSize: 12, transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</div>
                </div>
              </div>
              {isExp && (
                <div style={{ padding: 20 }}>
                  {g.records.slice(0, 50).map(renderLoanCard)}
                  {g.records.length > 50 && (
                    <div style={{ color: TH.muted, fontSize: 13, textAlign: 'center', marginTop: 10 }}>
                      + {g.records.length - 50} more. Use search to refine.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {activeGroups.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: TH.muted, background: TH.card, borderRadius: 12, border: `1px dashed ${TH.border}` }}>
            No {mode.toLowerCase()} loans found.
          </div>
        )}
      </div>
    );
  };

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div style={{ background: TH.bg, padding: 20, fontFamily: TH.sys }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: TH.txt, fontSize: 24, margin: '0 0 4px 0', fontWeight: 800 }}>Repayments Command Center</h1>
          <p style={{ color: TH.muted, fontSize: 13, margin: 0 }}>
            Showing <strong style={{ color: TH.accent }}>30-day maturity dates</strong> — one due date per loan.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, background: TH.card, padding: 6, borderRadius: 10, border: `1px solid ${TH.border}` }}>
          {['Calendar', 'Overdue', 'Upcoming', 'Search'].map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                background: activeTab === t ? TH.surface : 'transparent',
                color:      activeTab === t ? TH.accent  : TH.muted,
                border: `1px solid ${activeTab === t ? TH.border : 'transparent'}`,
                borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Search / date-range bar */}
      <div style={{ background: TH.card, border: `1px solid ${TH.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 2, minWidth: 200 }}>
          <div style={{ color: TH.muted, fontSize: 11, textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>Search Loan or Customer</div>
          <input
            type="text"
            placeholder="Type ID or client name..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); if (e.target.value && activeTab !== 'Search') setActiveTab('Search'); }}
            style={{ width: '100%', background: TH.surface, border: `1px solid ${TH.border}`, borderRadius: 8, padding: '10px 14px', color: TH.txt, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ color: TH.muted, fontSize: 11, textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>Maturity From</div>
          <input
            type="date"
            value={startDate}
            onChange={e => { setStartDate(e.target.value); if (e.target.value && activeTab !== 'Search') setActiveTab('Search'); }}
            style={{ width: '100%', background: TH.surface, border: `1px solid ${TH.border}`, borderRadius: 8, padding: '9px 12px', color: TH.txt, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ color: TH.muted, fontSize: 11, textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>Maturity To</div>
          <input
            type="date"
            value={endDate}
            onChange={e => { setEndDate(e.target.value); if (e.target.value && activeTab !== 'Search') setActiveTab('Search'); }}
            style={{ width: '100%', background: TH.surface, border: `1px solid ${TH.border}`, borderRadius: 8, padding: '9px 12px', color: TH.txt, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        {(searchQuery || startDate || endDate) && (
          <button
            onClick={() => { setSearchQuery(''); setStartDate(''); setEndDate(''); setActiveTab('Calendar'); }}
            style={{ padding: '10px 16px', background: `${TH.danger}15`, color: TH.danger, border: `1px solid ${TH.danger}50`, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Summary bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { l: 'Total Overdue',     c: TH.danger,  val: summaryBox.overdueCt, sub: fmtMoney(summaryBox.overdueKES), t: 'Overdue' },
          { l: 'Due Today',         c: TH.warn,    val: summaryBox.todayCt,   sub: fmtMoney(summaryBox.todayKES),   t: 'Upcoming' },
          { l: 'Due This Week',     c: TH.gold,    val: summaryBox.weekCt,    sub: fmtMoney(summaryBox.weekKES),    t: 'Upcoming' },
          { l: 'Due This Month',    c: TH.blue,    val: summaryBox.monthCt,   sub: fmtMoney(summaryBox.monthKES),   t: 'Upcoming' },
          { l: 'Month Recovery %',  c: TH.success, val: `${collectionRate}%`, sub: 'Settled vs Expected',           t: 'Calendar' },
        ].map(b => (
          <div
            key={b.l}
            onClick={() => b.t && setActiveTab(b.t)}
            style={{ background: TH.card, border: `1px solid ${b.c}30`, borderRadius: 12, padding: 16, cursor: b.t ? 'pointer' : 'default', transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
            onMouseOver={e => { if (b.t) e.currentTarget.style.background = TH.surface; }}
            onMouseOut={e  => { if (b.t) e.currentTarget.style.background = TH.card; }}
          >
            <div style={{ color: TH.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{b.l}</div>
            <div style={{ color: b.c, fontSize: 24, fontWeight: 900, fontFamily: TH.mono }}>{b.val}</div>
            <div style={{ color: TH.muted, fontSize: 10, marginTop: 4 }}>{b.sub}</div>
          </div>
        ))}
      </div>

      {/* Calendar tab */}
      {activeTab === 'Calendar' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setCurrentDate(new Date(yr, mo - 1, 1))} style={{ background: TH.card, color: TH.txt, border: `1px solid ${TH.border}`, padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>&larr; Prev</button>
              <button onClick={() => setCurrentDate(new Date())}              style={{ background: TH.surface, color: TH.accent, border: `1px solid ${TH.border}`, padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Today</button>
              <button onClick={() => setCurrentDate(new Date(yr, mo + 1, 1))} style={{ background: TH.card, color: TH.txt, border: `1px solid ${TH.border}`, padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Next &rarr;</button>
            </div>
            <div style={{ color: TH.txt, fontSize: 18, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2 }}>
              {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'hidden' }}>
              {renderCalendarTab()}
            </div>

            {/* Full-screen overlay modal — opens whenever any day is clicked */}
            {selectedDay && (
              <div
                onClick={() => setSelectedDay(null)}
                style={{
                  position: 'fixed', inset: 0, zIndex: 9999,
                  background: 'rgba(4,8,16,0.82)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                  padding: '24px 16px 40px',
                  overflowY: 'auto',
                }}
              >
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    width: '100%', maxWidth: 860,
                    background: TH.card,
                    border: `1px solid ${TH.accent}60`,
                    borderRadius: 16,
                    display: 'flex', flexDirection: 'column',
                    boxShadow: '0 40px 80px #000000D0',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  {/* Modal header */}
                  <div style={{ padding: '18px 24px', background: TH.surface, borderBottom: `1px solid ${TH.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                    <div>
                      <div style={{ color: TH.txt, fontSize: 18, fontWeight: 800 }}>Loans Due — {selectedDay.date}</div>
                      <div style={{ color: TH.muted, fontSize: 12, marginTop: 3 }}>
                        {selectedDay.records.length === 0
                          ? 'No loans are scheduled to mature on this date'
                          : `${selectedDay.records.length} loan${selectedDay.records.length > 1 ? 's' : ''} maturing on this date`}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedDay(null)}
                      style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${TH.border}`, color: TH.muted, borderRadius: 99, width: 32, height: 32, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    >✕</button>
                  </div>

                  {/* Modal body */}
                  <div style={{ padding: 24, overflowY: 'auto' }}>
                    {selectedDay.records.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '60px 20px', color: TH.muted }}
                      >
                        <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: TH.txt, marginBottom: 8 }}>No Loans Due</div>
                        <div style={{ fontSize: 13 }}>There are no loans scheduled to mature on <strong style={{ color: TH.accent }}>{selectedDay.date}</strong>.</div>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
                        {selectedDay.records.map(renderLoanCard)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
        </>
      )}

      {/* Overdue / Upcoming tabs */}
      {activeTab === 'Overdue'  && renderListTab('Overdue')}
      {activeTab === 'Upcoming' && renderListTab('Upcoming')}

      {/* Search tab */}
      {activeTab === 'Search' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: TH.card, borderRadius: 12, border: `1px solid ${TH.accent}50`, overflow: 'hidden' }}>
            <div style={{ background: `${TH.accent}10`, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${TH.border}` }}>
              <div style={{ color: TH.accent, fontWeight: 800, fontSize: 15 }}>Search Results</div>
              <div style={{ color: TH.txt, fontSize: 13, fontWeight: 700 }}>{searchResults.length} Loans Found</div>
            </div>
            <div style={{ padding: 20 }}>
              {searchResults.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: TH.muted }}>
                  No loans found matching your criteria.
                </div>
              )}
              {searchResults.slice(0, 50).map(renderLoanCard)}
              {searchResults.length > 50 && (
                <div style={{ color: TH.muted, fontSize: 13, textAlign: 'center', padding: 8, marginTop: 10, border: `1px dashed ${TH.border}`, borderRadius: 8 }}>
                  Showing top 50 matches. Refine search for more specific results.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
