import React, { useState, useMemo } from 'react';
import { computeLoanSchedule } from '@/lms-common'; // Use the newly fixed engine

// --- Core Theme Settings based strictly on user prompt
const TH = {
  bg: '#080C14',
  card: '#111827',
  surface: '#1A2740',
  border: '#1E2D45',
  txt: '#E2E8F0',
  muted: '#64748B',
  accent: '#00D4AA',
  danger: '#EF4444',
  warn: '#F59E0B',
  gold: '#D4A017',
  success: '#10B981',
  blue: '#3B82F6',
  mono: 'monospace',
  sys: 'system-ui, -apple-system, sans-serif'
};

const SEV = {
  overdue:   { color: TH.danger, bg: `${TH.danger}15`, label: 'Overdue',  border: `3px solid ${TH.danger}` },
  today:     { color: TH.warn,   bg: `${TH.warn}15`,   label: 'Today',    border: `3px solid ${TH.warn}` },
  urgent:    { color: TH.gold,   bg: `${TH.gold}15`,   label: '1-3 Days', border: `3px solid ${TH.gold}` },
  upcoming:  { color: TH.blue,   bg: `${TH.blue}15`,   label: '4-7 Days', border: `3px solid ${TH.blue}` },
  future:    { color: TH.success,bg: `${TH.success}15`,label: '8-30 Days',border: `3px solid ${TH.success}` },
  cleared:   { color: TH.success,bg: `${TH.success}00`,label: 'Cleared',  border: `none` },
  none:      { color: 'transparent', bg: 'transparent', label: '', border: 'none' }
};

// Returns severity object based on diff days and payment status
const getSlotSeverity = (slot, currDayStr) => {
  if (slot.status === 'paid' || slot.status === 'paid_late') return SEV.cleared;
  const sDate = new Date(slot.due);
  const cDate = new Date(currDayStr);
  const diffDays = Math.ceil((sDate - cDate) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return SEV.overdue;
  if (diffDays === 0) return SEV.today;
  if (diffDays >= 1 && diffDays <= 3) return SEV.urgent;
  if (diffDays >= 4 && diffDays <= 7) return SEV.upcoming;
  if (diffDays >= 8 && diffDays <= 30) return SEV.future;
  return SEV.none;
};

// Generates the calendar grid (fill in empty days)
const getDaysInMonth = (year, month) => {
  const d = new Date(year, month, 1);
  const days = [];
  while (d.getMonth() === month) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
};

// --- Main component
export default function DueLoansCalendar({ loans = [], payments = [], workers = [], workerContext = {}, onOpenCustomerProfile }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('Month'); // Month, Week
  const [activeTab, setActiveTab] = useState('Calendar'); // Calendar, Overdue, Upcoming
  const [selectedDay, setSelectedDay] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const todayStr = new Date().toISOString().slice(0, 10);
  const yr = currentDate.getFullYear();
  const mo = currentDate.getMonth();

  // Role based filtering
  const filteredLoans = useMemo(() => {
    let base = loans.filter(l => l.status === 'Active' || l.status === 'Overdue' || l.status === 'Settled');
    if (workerContext.role === 'Loan Officer' && workerContext.name) {
      base = base.filter(l => l.officer === workerContext.name);
    }
    return base;
  }, [loans, workerContext]);

  // Expand all active loans into explicit slots using computeLoanSchedule
  const allUnpaidSlots = useMemo(() => {
    const arr = [];
    const todayNum = new Date(todayStr).getTime();
    
    filteredLoans.forEach(loan => {
      const { slots, pctPaid, runningBalance, summary, perSlot } = computeLoanSchedule(loan, payments);
      slots.forEach(s => {
        if (s.status !== 'paid' && s.status !== 'paid_late') {
            const diffDays = Math.ceil((new Date(s.due).getTime() - todayNum) / 86400000);
            arr.push({ ...s, loan, pctPaid, summary, runningBalance, perSlot, diffDays });
        }
      });
    });
    return arr;
  }, [filteredLoans, payments, todayStr]);

  // Aggregate by Date for parsing Calendar Map
  const slotsByDate = useMemo(() => {
    const map = {};
    allUnpaidSlots.forEach(s => {
      if (!map[s.due]) map[s.due] = [];
      map[s.due].push(s);
    });
    return map;
  }, [allUnpaidSlots]);
  
  // Advanced Search Filter
  const searchResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q && !startDate && !endDate) return [];
    
    // Filter the full loans array
    const matchedLoans = filteredLoans.filter(l => {
      const textMatch = !q || (
        l.id.toLowerCase().includes(q) ||
        l.customer.toLowerCase().includes(q) ||
        (l.officer || '').toLowerCase().includes(q)
      );
      const startMatch = !startDate || (l.disbursed && l.disbursed >= startDate);
      const endMatch = !endDate || (l.disbursed && l.disbursed <= endDate);
      return textMatch && startMatch && endMatch;
    });

    const todayNum = new Date(todayStr).getTime();

    // Reconstruct loanGroup objects so they match the rendering expected format
    return matchedLoans.map(l => {
       const { slots, pctPaid, runningBalance, summary, perSlot } = computeLoanSchedule(l, payments);
       const fullSlots = slots.map(s => ({
         ...s, loan: l, pctPaid, summary, runningBalance, perSlot,
         diffDays: Math.ceil((new Date(s.due).getTime() - todayNum) / 86400000)
       }));
       
       return {
          loan: l,
          slots: fullSlots,
          totalDue: l.balance
       };
    });
  }, [filteredLoans, payments, searchQuery, startDate, endDate, todayStr]);

  // Summary Bar Math
  const summaryBox = useMemo(() => {
    const sb = { 
      overdueCt: 0, overdueKES: 0, 
      todayCt: 0, todayKES: 0, 
      weekCt: 0, weekKES: 0, 
      monthCt: 0, monthKES: 0 
    };
    allUnpaidSlots.forEach(s => {
      const diff = s.diffDays;
      if (diff < 0) { sb.overdueCt++; sb.overdueKES += s.perSlot; }
      if (diff === 0) { sb.todayCt++; sb.todayKES += s.perSlot; }
      if (diff >= 0 && diff <= 7) { sb.weekCt++; sb.weekKES += s.perSlot; }
      if (diff >= 0 && diff <= 30) { sb.monthCt++; sb.monthKES += s.perSlot; }
    });
    return sb;
  }, [allUnpaidSlots]);

  // Collection Rate mapping math (Paid / Total Expected this month)
  const collectionRate = useMemo(() => {
    const moStart = new Date(yr, mo, 1).toISOString().slice(0,10);
    const moEnd = new Date(yr, mo+1, 0).toISOString().slice(0,10);
    let expected = 0;
    let actualPaid = 0;
    
    filteredLoans.forEach(loan => {
      const { slots, ledger } = computeLoanSchedule(loan, payments);
      slots.forEach(s => {
        if (s.due >= moStart && s.due <= moEnd) {
          expected += s.perSlot;
          if (s.status === 'paid' || s.status === 'paid_late') actualPaid += s.perSlot;
        }
      });
    });
    return expected > 0 ? Math.round((actualPaid / expected) * 100) : 100;
  }, [filteredLoans, payments, yr, mo]);

  // UI Helpers
  const formatMoney = (val) => `KES ${Number(val).toLocaleString('en-KE')}`;
  
  const handleDayClick = (dateStr) => {
    setSelectedDay(slotsByDate[dateStr] ? { date: dateStr, slots: slotsByDate[dateStr] } : null);
  };

  const getDayUI = (dateObj) => {
    const dStr = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const daySlots = slotsByDate[dStr] || [];
    
    // Pick the most urgent severity logic
    let highestSev = SEV.none;
    const countMap = { overdue: 0, today: 0, urgent: 0, upcoming: 0, future: 0 };
    let sumKESMap = { overdue: 0, today: 0, urgent: 0, upcoming: 0, future: 0 };

    daySlots.forEach(s => {
      const sv = getSlotSeverity(s, todayStr);
      if (sv === SEV.overdue) { countMap.overdue++; sumKESMap.overdue += s.perSlot; }
      else if (sv === SEV.today) { countMap.today++; sumKESMap.today += s.perSlot; }
      else if (sv === SEV.urgent) { countMap.urgent++; sumKESMap.urgent += s.perSlot; }
      else if (sv === SEV.upcoming) { countMap.upcoming++; sumKESMap.upcoming += s.perSlot; }
      else if (sv === SEV.future) { countMap.future++; sumKESMap.future += s.perSlot; }
    });

    if (countMap.overdue > 0) highestSev = SEV.overdue;
    else if (countMap.today > 0) highestSev = SEV.today;
    else if (countMap.urgent > 0) highestSev = SEV.urgent;
    else if (countMap.upcoming > 0) highestSev = SEV.upcoming;
    else if (countMap.future > 0) highestSev = SEV.future;

    const isToday = dStr === todayStr;
    const isSel = selectedDay?.date === dStr;

    return (
      <div 
        key={dStr} 
        onClick={() => handleDayClick(dStr)}
        style={{
          background: isToday ? `${TH.accent}10` : TH.surface,
          borderTop: `1px solid ${isSel ? TH.accent : TH.border}`,
          borderRight: `1px solid ${isSel ? TH.accent : TH.border}`,
          borderBottom: `1px solid ${isSel ? TH.accent : TH.border}`,
          borderLeft: highestSev !== SEV.none ? highestSev.border : `1px solid ${TH.border}`,
          minHeight: 110,
          padding: 8,
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.2s ease',
          opacity: dateObj.getMonth() !== mo ? 0.4 : 1
        }}
        onMouseOver={e => e.currentTarget.style.background = TH.border}
        onMouseOut={e => e.currentTarget.style.background = isToday ? `${TH.accent}10` : TH.surface}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ color: isToday ? TH.accent : TH.txt, fontWeight: isToday ? 800 : 500, fontFamily: TH.sys, fontSize: 13 }}>
            {dateObj.getDate()}
          </span>
        </div>
        
        {/* Render Badges inside day cell */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {countMap.overdue > 0 && (
            <div style={{ background: SEV.overdue.bg, color: SEV.overdue.color, padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
              <span>{countMap.overdue} due</span> <span style={{fontFamily: TH.mono}}>{formatMoney(sumKESMap.overdue)}</span>
            </div>
          )}
          {countMap.today > 0 && (
            <div style={{ background: SEV.today.bg, color: SEV.today.color, padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
              <span>{countMap.today} due</span> <span style={{fontFamily: TH.mono}}>{formatMoney(sumKESMap.today)}</span>
            </div>
          )}
          {countMap.urgent > 0 && (
            <div style={{ background: SEV.urgent.bg, color: SEV.urgent.color, padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
              {countMap.urgent} urgent
            </div>
          )}
          {countMap.upcoming > 0 && (
            <div style={{ background: SEV.upcoming.bg, color: SEV.upcoming.color, padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
              {countMap.upcoming} upcoming
            </div>
          )}
          {countMap.future > 0 && (
            <div style={{ background: SEV.future.bg, color: SEV.future.color, padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
              {countMap.future} future
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCalendarTab = () => {
    // Generate grid padding
    const days = getDaysInMonth(yr, mo);
    const firstDay = days[0].getDay();
    const blanks = Array.from({ length: firstDay === 0 ? 6 : firstDay - 1 }).map((_, i) => {
      const d = new Date(yr, mo, 0 - i);
      return getDayUI(d);
    }).reverse();
    
    const trailingBlanks = Array.from({ length: (7 - ((blanks.length + days.length) % 7)) % 7 }).map((_, i) => {
      const d = new Date(yr, mo + 1, i + 1);
      return getDayUI(d);
    });

    const headers = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
      <div style={{ background: TH.card, borderRadius: 12, padding: 20, border: `1px solid ${TH.border}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 8 }}>
          {headers.map(h => (
            <div key={h} style={{ color: TH.muted, fontSize: 12, fontWeight: 700, textAlign: 'center', textTransform: 'uppercase' }}>{h}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, background: TH.card }}>
          {blanks}
          {days.map(d => getDayUI(d))}
          {trailingBlanks}
        </div>
      </div>
    );
  };

  const renderLoanCard = (slot) => {
    const l = slot.loan;
    const diff = slot.diffDays;
    const isPaid = slot.status === 'paid' || slot.status === 'paid_late';
    
    // Determine status badge color and text
    let statusLabel = 'Upcoming';
    let statusColor = TH.blue;
    let statusBg = `${TH.blue}15`;

    if (isPaid) {
      statusLabel = 'Settled';
      statusColor = TH.success;
      statusBg = `${TH.success}15`;
    } else if (diff < 0) {
      statusLabel = 'Overdue';
      statusColor = TH.danger;
      statusBg = `${TH.danger}15`;
    } else if (diff === 0) {
      statusLabel = 'Due Today';
      statusColor = TH.warn;
      statusBg = `${TH.warn}15`;
    }

    return (
      <div key={`${l.id}-${slot.index}`} style={{ background: TH.surface, border: `1px solid ${TH.border}`, borderRadius: 10, padding: 14, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
               <div style={{ background: statusBg, color: statusColor, padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, border: `1px solid ${statusColor}30` }}>
                 {statusLabel}
               </div>
               <div style={{ color: TH.muted, fontSize: 11, fontWeight: 700 }}>Due: {slot.due}</div>
            </div>
            <div onClick={() => onOpenCustomerProfile?.(l.customerId)} style={{ color: TH.txt, fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'inline-block', textDecoration: 'underline decoration-transparent', transition: 'text-decoration 0.2s', ':hover': { textDecoration: `underline ${TH.txt}` } }}>
              {l.customer}
            </div>
            <div style={{ fontFamily: TH.mono, color: TH.accent, fontSize: 12, fontWeight: 800, marginTop: 4 }}>{l.id}</div>
            <div style={{ color: TH.muted, fontSize: 11, marginTop: 2 }}>Payment {slot.index + 1} of {slot.summary.paid + slot.summary.missed + slot.summary.upcoming + slot.summary.overdue}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: TH.txt, fontWeight: 700, fontSize: 15, fontFamily: TH.mono }}>{formatMoney(slot.perSlot)} Due</div>
            <div style={{ color: TH.muted, fontSize: 11, fontFamily: TH.mono, marginTop: 4 }}>Balance: {formatMoney(l.balance)}</div>
            <div style={{ color: isPaid ? TH.success : l.daysOverdue > 0 ? TH.danger : TH.success, fontSize: 11, fontWeight: 700, marginTop: 2 }}>
               {isPaid ? '✓ Paid' : l.daysOverdue > 0 ? `${l.daysOverdue}d Overdue` : 'Current'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: `1px dashed ${TH.border}`, paddingTop: 10 }}>
          <a href={`tel:${l.phone}`} style={{ textDecoration: 'none', background: `${TH.accent}15`, color: TH.accent, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>📞 Call</a>
          <a href={`sms:${l.phone}`} style={{ textDecoration: 'none', background: `${TH.blue}15`, color: TH.blue, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>💬 SMS</a>
          <button onClick={() => onOpenCustomerProfile?.(l.customerId)} style={{ background: `${TH.muted}20`, color: TH.txt, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer' }}>👤 Profile</button>
        </div>
      </div>
    );
  };

  const renderListTab = (mode) => {
    // Mode is 'Overdue' or 'Upcoming'
    const grouped = {
      // Overdue Groups
      crt: { lbl: 'Critical (90+ Days)', col: '#991B1B', bg: '#450A0A', slots: [] },
      lte: { lbl: 'Late Stage (31-90 Days)', col: TH.danger, bg: `${TH.danger}15`, slots: [] },
      mid: { lbl: 'Mid Stage (8-30 Days)', col: TH.warn, bg: `${TH.warn}15`, slots: [] },
      erl: { lbl: 'Early (1-7 Days)', col: TH.gold, bg: `${TH.gold}15`, slots: [] },
      // Upcoming Groups
      tdy: { lbl: 'Due Today', col: TH.warn, bg: `${TH.warn}15`, slots: [] },
      tmr: { lbl: 'Due Tomorrow', col: TH.gold, bg: `${TH.gold}15`, slots: [] },
      u3d: { lbl: 'Due in 2-3 Days (Urgent)', col: TH.accent, bg: `${TH.accent}15`, slots: [] },
      uwk: { lbl: 'Due This Week', col: TH.blue, bg: `${TH.blue}15`, slots: [] },
      umn: { lbl: 'Due Later This Month', col: TH.success, bg: `${TH.success}15`, slots: [] },
    };

    allUnpaidSlots.forEach(s => {
      const diff = s.diffDays;
      if (mode === 'Overdue' && diff < 0) {
        const ag = Math.abs(diff);
        if (ag >= 90) grouped.crt.slots.push(s);
        else if (ag >= 31) grouped.lte.slots.push(s);
        else if (ag >= 8) grouped.mid.slots.push(s);
        else grouped.erl.slots.push(s);
      } else if (mode === 'Upcoming' && diff >= 0) {
        if (diff === 0) grouped.tdy.slots.push(s);
        else if (diff === 1) grouped.tmr.slots.push(s);
        else if (diff <= 3) grouped.u3d.slots.push(s);
        else if (diff <= 7) grouped.uwk.slots.push(s);
        else if (diff <= 30) grouped.umn.slots.push(s);
      }
    });

    const activeGroups = mode === 'Overdue' ? [grouped.crt, grouped.lte, grouped.mid, grouped.erl] : [grouped.tdy, grouped.tmr, grouped.u3d, grouped.uwk, grouped.umn];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {activeGroups.filter(g => g.slots.length > 0).map(g => (
          <div key={g.lbl} style={{ background: TH.card, borderRadius: 12, border: `1px solid ${TH.border}`, overflow: 'hidden' }}>
            <div style={{ background: g.bg, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${TH.border}` }}>
              <div style={{ color: g.col, fontWeight: 800, fontSize: 15 }}>{g.lbl}</div>
              <div style={{ display: 'flex', gap: 14 }}>
                 <div style={{ color: TH.txt, fontSize: 13, fontWeight: 700 }}>{g.slots.length} Loans</div>
                 <div style={{ color: g.col, fontSize: 13, fontWeight: 800, fontFamily: TH.mono }}>{formatMoney(g.slots.reduce((acc, s) => acc + s.perSlot, 0))}</div>
              </div>
            </div>
            <div style={{ padding: 20 }}>
              {(() => {
                const slotsByLoan = {};
                g.slots.forEach(s => {
                  if (!slotsByLoan[s.loan.id]) {
                    slotsByLoan[s.loan.id] = { loan: s.loan, slots: [], totalDue: 0 };
                  }
                  slotsByLoan[s.loan.id].slots.push(s);
                  slotsByLoan[s.loan.id].totalDue += s.perSlot;
                });
                
                const loanGroups = Object.values(slotsByLoan);
                
                return (
                  <>
                    {loanGroups.slice(0, 50).map(lg => {
                      const key = `${g.lbl}-${lg.loan.id}`;
                      const isExp = expandedGroups[key];
                      
                      return (
                        <div key={lg.loan.id} style={{ marginBottom: 12, background: TH.surface, border: `1px solid ${TH.border}`, borderRadius: 10, overflow: 'hidden' }}>
                          <div 
                            onClick={() => setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }))}
                            style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: isExp ? `${TH.accent}10` : 'transparent', transition: 'background 0.2s' }}
                          >
                             <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${TH.muted}30`, color: TH.txt, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                                  {lg.slots.length}
                                </div>
                                <div>
                                   <div onClick={(e) => { e.stopPropagation(); onOpenCustomerProfile?.(lg.loan.customerId); }} style={{ color: TH.txt, fontWeight: 700, fontSize: 15, cursor: 'pointer', textDecoration: 'underline decoration-transparent', transition: 'text-decoration 0.2s', ':hover': { textDecoration: `underline ${TH.txt}` } }}>
                                     {lg.loan.customer}
                                   </div>
                                   <div style={{ color: TH.accent, fontFamily: TH.mono, fontWeight: 800, fontSize: 11 }}>{lg.loan.id}</div>
                                </div>
                             </div>
                             <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <div style={{ textAlign: 'right' }}>
                                   <div style={{ color: TH.txt, fontWeight: 700, fontFamily: TH.mono }}>{formatMoney(lg.totalDue)} Due</div>
                                </div>
                                <div style={{ color: TH.muted, fontSize: 12, transform: isExp ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</div>
                             </div>
                          </div>
                          
                          {isExp && (
                            <div style={{ padding: '12px 16px', background: TH.bg, borderTop: `1px dashed ${TH.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                               {lg.slots.map(renderLoanCard)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {loanGroups.length > 50 && (
                      <div style={{ color: TH.muted, fontSize: 13, textAlign: 'center', marginTop: 10, padding: 10, border: `1px dashed ${TH.border}`, borderRadius: 8 }}>
                         + {loanGroups.length - 50} more loans available. Use search for specific matches.
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        ))}
        {activeGroups.filter(g => g.slots.length > 0).length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: TH.muted, background: TH.card, borderRadius: 12, border: `1px dashed ${TH.border}` }}>
            No {mode.toLowerCase()} loans found matching this criteria.
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ background: TH.bg, minHeight: '100vh', padding: 20, fontFamily: TH.sys, overflowY: 'auto' }}>
      
      {/* HEADER TABS & ACTIONS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ color: TH.txt, fontSize: 24, margin: '0 0 4px 0', fontWeight: 800 }}>Repayments Command Center</h1>
          <p style={{ color: TH.muted, fontSize: 13, margin: 0 }}>Auto-synced scheduler based on live ledger analytics.</p>
        </div>
        <div style={{ display: 'flex', gap: 6, background: TH.card, padding: 6, borderRadius: 10, border: `1px solid ${TH.border}` }}>
          {['Calendar', 'Overdue', 'Upcoming', 'Search'].map(t => (
            <button 
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                background: activeTab === t ? TH.surface : 'transparent',
                color: activeTab === t ? TH.accent : TH.muted,
                border: `1px solid ${activeTab === t ? TH.border : 'transparent'}`,
                borderRadius: 6,
                padding: '6px 14px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      
      {/* SEARCH BAR */}
      <div style={{ background: TH.card, border: `1px solid ${TH.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 2, minWidth: 200 }}>
          <div style={{ color: TH.muted, fontSize: 11, textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>Search Loan or Customer</div>
          <input 
            type="text" 
            placeholder="Type ID or client name..." 
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); if(e.target.value && activeTab !== 'Search') setActiveTab('Search'); }}
            style={{ width: '100%', background: TH.surface, border: `1px solid ${TH.border}`, borderRadius: 8, padding: '10px 14px', color: TH.txt, fontSize: 13, outline: 'none' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ color: TH.muted, fontSize: 11, textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>Start Date</div>
          <input 
            type="date" 
            value={startDate}
            onChange={e => { setStartDate(e.target.value); if(e.target.value && activeTab !== 'Search') setActiveTab('Search'); }}
            style={{ width: '100%', background: TH.surface, border: `1px solid ${TH.border}`, borderRadius: 8, padding: '9px 12px', color: TH.txt, fontSize: 13, outline: 'none' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ color: TH.muted, fontSize: 11, textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>End Date</div>
          <input 
            type="date" 
            value={endDate}
            onChange={e => { setEndDate(e.target.value); if(e.target.value && activeTab !== 'Search') setActiveTab('Search'); }}
            style={{ width: '100%', background: TH.surface, border: `1px solid ${TH.border}`, borderRadius: 8, padding: '9px 12px', color: TH.txt, fontSize: 13, outline: 'none' }}
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

      {/* SUMMARY BAR */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { l: 'Total Overdue', c: TH.danger, u: summaryBox.overdueCt, v: summaryBox.overdueKES, t: 'Overdue' },
          { l: 'Due Today', c: TH.warn, u: summaryBox.todayCt, v: summaryBox.todayKES, t: 'Upcoming' },
          { l: 'Due This Week', c: TH.gold, u: summaryBox.weekCt, v: summaryBox.weekKES, t: 'Upcoming' },
          { l: 'Due This Month', c: TH.blue, u: summaryBox.monthCt, v: summaryBox.monthKES, t: 'Upcoming' },
          { l: 'Month Recovery %', c: TH.success, u: null, v: null, override: `${collectionRate}%`, t: 'Calendar' },
        ].map(b => (
          <div 
            key={b.l} 
            onClick={() => { if(b.t) setActiveTab(b.t); }}
            style={{ 
              background: TH.card, 
              border: `1px solid ${b.c}30`, 
              borderRadius: 12, 
              padding: 16, 
              cursor: b.t ? 'pointer' : 'default',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={e => { if(b.t) e.currentTarget.style.background = TH.surface; }}
            onMouseOut={e => { if(b.t) e.currentTarget.style.background = TH.card; }}
          >
             <div style={{ color: TH.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{b.l}</div>
             <div style={{ color: b.c, fontSize: 18, fontWeight: 800, fontFamily: TH.mono }}>
               {b.override ? b.override : formatMoney(b.v)}
             </div>
             {b.u !== null && <div style={{ color: TH.txt, fontSize: 12, marginTop: 4 }}>{b.u} Loans</div>}
          </div>
        ))}
      </div>

      {/* RENDER ACTIVE TAB */}
      {activeTab === 'Calendar' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <button 
                onClick={() => setCurrentDate(new Date(yr, mo - 1, 1))}
                style={{ background: TH.card, color: TH.txt, border: `1px solid ${TH.border}`, padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                &larr; Prev
              </button>
              <button 
                onClick={() => setCurrentDate(new Date())}
                style={{ background: TH.surface, color: TH.accent, border: `1px solid ${TH.border}`, padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                Today
              </button>
              <button 
                onClick={() => setCurrentDate(new Date(yr, mo + 1, 1))}
                style={{ background: TH.card, color: TH.txt, border: `1px solid ${TH.border}`, padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                Next &rarr;
              </button>
            </div>
            <div style={{ color: TH.txt, fontSize: 18, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2 }}>
              {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 20, position: 'relative' }}>
            {/* Main Grid */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {renderCalendarTab()}
            </div>

            {/* Slide-in Side Panel equivalent (Right Sidebar) */}
            {selectedDay && (
              <div style={{ width: 360, background: TH.card, border: `1px solid ${TH.accent}`, borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: `-10px 0 30px ${TH.bg}` }}>
                 <div style={{ padding: '16px 20px', background: TH.surface, borderBottom: `1px solid ${TH.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ color: TH.txt, fontSize: 16, fontWeight: 800 }}>Date Schedule</div>
                    <button onClick={() => setSelectedDay(null)} style={{ background: 'transparent', border: 'none', color: TH.muted, cursor: 'pointer', fontSize: 18 }}>✕</button>
                 </div>
                 <div style={{ padding: '12px 20px', background: `${TH.accent}15`, color: TH.accent, fontWeight: 800, fontSize: 13, borderBottom: `1px solid ${TH.accent}50` }}>
                    {new Date(selectedDay.date).toDateString()}
                 </div>
                 <div style={{ padding: 20, flex: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
                    {selectedDay.slots.length === 0 ? (
                      <p style={{ color: TH.muted, fontSize: 13, textAlign: 'center' }}>No installments due on this day.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {selectedDay.slots.map(renderLoanCard)}
                      </div>
                    )}
                 </div>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'Overdue' && renderListTab('Overdue')}
      {activeTab === 'Upcoming' && renderListTab('Upcoming')}
      
      {activeTab === 'Search' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: TH.card, borderRadius: 12, border: `1px solid ${TH.accent}50`, overflow: 'hidden' }}>
            <div style={{ background: `${TH.accent}10`, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${TH.border}` }}>
              <div style={{ color: TH.accent, fontWeight: 800, fontSize: 15 }}>Search Results</div>
              <div style={{ display: 'flex', gap: 14 }}>
                 <div style={{ color: TH.txt, fontSize: 13, fontWeight: 700 }}>{searchResults.length} Loans Found</div>
                 <div style={{ color: TH.accent, fontSize: 13, fontWeight: 800, fontFamily: TH.mono }}>{formatMoney(searchResults.reduce((acc, lg) => acc + lg.totalDue, 0))}</div>
              </div>
            </div>
            <div style={{ padding: 20 }}>
               {searchResults.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 40, color: TH.muted }}>
                    No loans found matching your criteria. Try adjusting the dates or searching for a different name.
                  </div>
               )}
               {searchResults.slice(0, 50).map(lg => {
                  const key = `search-${lg.loan.id}`;
                  const isExp = expandedGroups[key];
                  
                  return (
                    <div key={lg.loan.id} style={{ marginBottom: 12, background: TH.surface, border: `1px solid ${TH.border}`, borderRadius: 10, overflow: 'hidden' }}>
                      <div 
                        onClick={() => setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }))}
                        style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: isExp ? `${TH.accent}10` : 'transparent', transition: 'background 0.2s' }}
                      >
                         <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${TH.muted}30`, color: TH.txt, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                              {lg.slots.length}
                            </div>
                            <div>
                               <div onClick={(e) => { e.stopPropagation(); onOpenCustomerProfile?.(lg.loan.customerId); }} style={{ color: TH.txt, fontWeight: 700, fontSize: 15, cursor: 'pointer', textDecoration: 'underline decoration-transparent', transition: 'text-decoration 0.2s', ':hover': { textDecoration: `underline ${TH.txt}` } }}>
                                 {lg.loan.customer}
                               </div>
                               <div style={{ color: TH.accent, fontFamily: TH.mono, fontWeight: 800, fontSize: 11 }}>{lg.loan.id}</div>
                            </div>
                         </div>
                         <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{ textAlign: 'right' }}>
                               <div style={{ color: TH.txt, fontWeight: 700, fontFamily: TH.mono }}>{formatMoney(lg.totalDue)} Bal</div>
                            </div>
                            <div style={{ color: TH.muted, fontSize: 12, transform: isExp ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</div>
                         </div>
                      </div>
                      
                      {isExp && (
                        <div style={{ padding: '12px 16px', background: TH.bg, borderTop: `1px dashed ${TH.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                           {lg.slots.map(renderLoanCard)}
                        </div>
                      )}
                    </div>
                  );
                })}
               {searchResults.length > 50 && (
                  <div style={{ color: TH.muted, fontSize: 13, textAlign: 'center', padding: 8, marginTop: 10, border: `1px dashed ${TH.border}`, borderRadius: 8 }}>
                    Showing top 50 matches for this search. Refine search criteria for more specific results.
                  </div>
               )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
