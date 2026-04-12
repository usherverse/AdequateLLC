import React, { useState, useMemo, useEffect } from 'react';
import { calculateLoanStatus, T, Card, Badge, Btn, fmtM } from '@/lms-common';
import { ChevronLeft, ChevronRight, Search, Calendar as CalendarIcon, Phone, MessageSquare, User, CheckCircle2, AlertCircle } from 'lucide-react';
import { useTheme } from "@/context/ThemeContext";

// ─── Modern Styles ────────────────────────────────────────────────────────────
const Styles = `
  .glass-card {
    background: var(--surface-glass);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--border-subtle);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.15);
  }
  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 8px;
  }
  .day-cell {
    aspect-ratio: 1 / 1;
    min-height: 85px;
    border-radius: 12px;
    padding: 8px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
  }
  .day-cell:hover {
    background: var(--surface);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }
  .day-cell.active {
    background: var(--a-lo) !important;
    border: 1.5px solid var(--accent) !important;
  }
  .indicator-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    display: inline-block;
  }
  .ios-sheet {
    width: 100%;
    max-width: 500px;
    max-height: 85vh;
    border-radius: 32px;
    padding: 0;
    overflow: hidden;
    background: var(--card-glass);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--border-subtle);
    box-shadow: 0 40px 100px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    animation: ios-pop 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  @keyframes ios-pop {
    from { opacity: 0; transform: scale(0.95) translateY(20px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
  @media (max-width: 768px) {
    .calendar-grid { gap: 4px; }
    .day-cell { min-height: 50px; padding: 4px; border-radius: 6px; }
    .day-header { font-size: 10px !important; }
    .indicator-container { gap: 2px !important; }
    .indicator-dot { width: 4px; height: 4px; }
    .ios-sheet-overlay {
       align-items: flex-end !important;
       padding: 0 !important;
    }
    .ios-sheet {
       max-width: 100% !important;
       border-radius: 24px 24px 0 0 !important;
       animation: ios-slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1) !important;
    }
    @keyframes ios-slide-up {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }
  }
`;

const SEV = {
  overdue:  { color: '#EF4444', label: 'Overdue' },
  today:    { color: '#F59E0B', label: 'Today' },
  urgent:   { color: '#D4A017', label: 'Urgent' },
  upcoming: { color: '#3B82F6', label: 'Upcoming' },
  future:   { color: '#10B981', label: 'Future' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getLoanMaturityDate = (loan) => {
  if (!loan.disbursed) return null;
  const d = new Date(loan.disbursed);
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
};

const diffFromToday = (maturityDate, todayStr) => {
  const ms = new Date(maturityDate).getTime() - new Date(todayStr).getTime();
  return Math.ceil(ms / 86400000);
};

const getSeverity = (diff, settled) => {
  if (settled) return null;
  if (diff < 0) return SEV.overdue;
  if (diff === 0) return SEV.today;
  if (diff <= 3) return SEV.urgent;
  if (diff <= 7) return SEV.upcoming;
  if (diff <= 30) return SEV.future;
  return null;
};

const getDaysInMonth = (year, month) => {
  const d = new Date(year, month, 1);
  const days = [];
  while (d.getMonth() === month) { days.push(new Date(d)); d.setDate(d.getDate() + 1); }
  return days;
};

export default function DueLoansCalendar({
  loans = [], payments = [], workers = [], workerContext = {}, onOpenCustomerProfile,
}) {
  const { theme } = useTheme();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab]     = useState('Calendar');
  const [selectedDay, setSelectedDay] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const todayStr = new Date().toISOString().slice(0, 10);
  const yr = currentDate.getFullYear();
  const mo = currentDate.getMonth();

  // ── Logic ───────────────────────────────────────────────────────────────────
  const maturityRecords = useMemo(() => {
    let list = loans.filter(l => ['Active', 'Overdue', 'Settled'].includes(l.status) && l.disbursed);
    if (workerContext.role === 'Loan Officer' && workerContext.name) {
      list = list.filter(l => l.officer === workerContext.name);
    }

    return list.map(loan => {
      const maturity = getLoanMaturityDate(loan);
      if (!maturity) return null;
      const diff = diffFromToday(maturity, todayStr);
      const paid = (payments || []).filter(p => (p.loanId === loan.id || p.loan_id === loan.id) && (p.status === 'Allocated' || p.status === 'allocated')).reduce((s, p) => s + Number(p.amount || 0), 0);
      const engine = calculateLoanStatus(loan, null, paid);
      const remainingBalance = engine.totalAmountDue;
      const settled = loan.status === 'Settled' || remainingBalance <= 0;
      const sev = getSeverity(diff, settled);
      return { loan, maturity, diff, settled, sev, remainingBalance, totalOwed: engine.totalPayable, totalPaid: paid };
    }).filter(Boolean);
  }, [loans, payments, todayStr, workerContext]);

  const recordsByDate = useMemo(() => {
    const map = {};
    maturityRecords.forEach(r => {
      if (!map[r.maturity]) map[r.maturity] = [];
      map[r.maturity].push(r);
    });
    return map;
  }, [maturityRecords]);

  // ── Render Helpers ──────────────────────────────────────────────────────────
  const getDayUI = (dateObj) => {
    const dStr = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const dayRecords = recordsByDate[dStr] || [];
    const isToday = dStr === todayStr;
    const isSel = selectedDay?.date === dStr;
    const outMonth = dateObj.getMonth() !== mo;

    // Severity mapping for dots
    const dots = [];
    if (dayRecords.some(r => r.sev === SEV.overdue)) dots.push(SEV.overdue.color);
    if (dayRecords.some(r => r.sev === SEV.today)) dots.push(SEV.today.color);
    if (dayRecords.some(r => r.sev === SEV.urgent)) dots.push(SEV.urgent.color);
    if (dayRecords.some(r => r.sev === SEV.upcoming)) dots.push(SEV.upcoming.color);
    if (dayRecords.some(r => r.sev === SEV.future)) dots.push(SEV.future.color);

    return (
      <div
        key={dStr}
        className={`day-cell ${isSel ? 'active' : ''}`}
        onClick={() => setSelectedDay({ date: dStr, records: dayRecords })}
        style={{
          background: isToday ? T.aLo : 'transparent',
          border: `1px solid ${isToday ? T.aMid : T.border}`,
          opacity: outMonth ? 0.3 : 1,
          cursor: 'pointer'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span style={{ 
            color: isToday ? T.accent : T.txt, 
            fontWeight: isToday || dayRecords.length > 0 ? 800 : 400, 
            fontSize: 14 
          }}>
            {dateObj.getDate()}
          </span>
          {dayRecords.length > 0 && (
            <span style={{ fontSize: 10, color: T.dim, fontWeight: 700 }}>{dayRecords.length}</span>
          )}
        </div>
        
        <div className="indicator-container" style={{ display: 'flex', gap: 4, marginTop: 'auto', paddingBottom: 2, flexWrap: 'wrap' }}>
          {dots.map((color, i) => (
            <div key={i} className="indicator-dot" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}80` }} />
          ))}
        </div>
      </div>
    );
  };

  const renderLoanCard = (r) => {
    const { loan, diff, settled, remainingBalance, totalOwed, totalPaid } = r;
    const color = settled ? '#10B981' : diff < 0 ? '#EF4444' : diff === 0 ? '#F59E0B' : '#3B82F6';
    const pct = totalOwed > 0 ? Math.min(Math.round((totalPaid / totalOwed) * 100), 100) : 0;

    return (
      <Card key={loan.id} style={{ padding: 16, marginBottom: 12, borderLeft: `4px solid ${color}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ color: T.txt, fontWeight: 800, fontSize: 16 }}>{loan.customer}</div>
            <div style={{ color: T.accent, fontSize: 11, fontWeight: 700, marginTop: 2, fontFamily: 'monospace' }}>{loan.id}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: remainingBalance > 0 ? T.danger : T.success, fontWeight: 900, fontSize: 18 }}>{fmtM(remainingBalance)}</div>
            <div style={{ color: T.dim, fontSize: 10, textTransform: 'uppercase' }}>Remaining</div>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ height: 6, background: T.surface, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 0.5s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 10, color: T.dim }}>Progress: {pct}%</span>
            <span style={{ fontSize: 10, color: T.dim }}>Total: {fmtM(totalOwed)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Btn sm v="ghost" style={{ flex: 1 }} onClick={() => onOpenCustomerProfile?.(loan.customerId)}><User size={14}/> Profile</Btn>
          <a href={`tel:${loan.phone}`} style={{ flex: 1, textDecoration: 'none' }}><Btn sm full><Phone size={14}/> Call</Btn></a>
          <a href={`sms:${loan.phone}`} style={{ flex: 1, textDecoration: 'none' }}><Btn sm v="secondary" full><MessageSquare size={14}/> SMS</Btn></a>
        </div>
      </Card>
    );
  };

  return (
    <div style={{ minHeight: '100%', background: T.bg, color: T.txt, padding: '2px' }}>
      <style>{Styles}</style>

      {/* Header Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
             <div style={{ background: T.aLo, color: T.accent, padding: 10, borderRadius: 12 }}>
                <CalendarIcon size={24} />
             </div>
             <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0, letterSpacing: '-0.02em', color: T.txt }}>Repayment Calendar</h1>
          </div>
          <p style={{ color: T.dim, margin: 0 }}>Strategic view of all loan maturity dates for {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
        </div>

        <div className="glass-card" style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12 }}>
          {['Calendar', 'Search'].map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                background: activeTab === t ? T.accent : 'transparent',
                color: activeTab === t ? '#FFF' : T.dim,
                border: 'none',
                borderRadius: 9,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Ribbon */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
          <div className="glass-card" style={{ padding: 16, borderRadius: 16 }}>
             <div style={{ color: T.dim, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Overdue Loans</div>
             <div style={{ color: T.danger, fontSize: 24, fontWeight: 900, marginTop: 4 }}>{maturityRecords.filter(r => r.diff < 0 && !r.settled).length}</div>
          </div>
          <div className="glass-card" style={{ padding: 16, borderRadius: 16 }}>
             <div style={{ color: T.dim, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Due Today</div>
             <div style={{ color: T.warn, fontSize: 24, fontWeight: 900, marginTop: 4 }}>{maturityRecords.filter(r => r.diff === 0 && !r.settled).length}</div>
          </div>
          <div className="glass-card" style={{ padding: 16, borderRadius: 16 }}>
             <div style={{ color: T.dim, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Next 7 Days</div>
             <div style={{ color: T.accent, fontSize: 24, fontWeight: 900, marginTop: 4 }}>{maturityRecords.filter(r => r.diff > 0 && r.diff <= 7 && !r.settled).length}</div>
          </div>
          <div className="glass-card" style={{ padding: 16, borderRadius: 16 }}>
             <div style={{ color: T.dim, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Monthly Target</div>
             <div style={{ color: T.success, fontSize: 24, fontWeight: 900, marginTop: 4 }}>{fmtM(maturityRecords.reduce((s, r) => s + (r.maturity.startsWith(todayStr.slice(0, 7)) ? r.remainingBalance : 0), 0))}</div>
          </div>
      </div>

      {activeTab === 'Calendar' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Main Calendar - Full Width */}
          <div className="glass-card" style={{ padding: '20px', borderRadius: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
               <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
               <div style={{ display: 'flex', gap: 8 }}>
                  <Btn sm onClick={() => setCurrentDate(new Date(yr, mo - 1, 1))}><ChevronLeft size={18}/></Btn>
                  <Btn sm v="secondary" onClick={() => setCurrentDate(new Date())}>Today</Btn>
                  <Btn sm onClick={() => setCurrentDate(new Date(yr, mo + 1, 1))}><ChevronRight size={18}/></Btn>
               </div>
            </div>

            <div className="calendar-grid">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(h => (
                <div key={h} className="day-header" style={{ textAlign: 'center', paddingBottom: 10, color: '#64748B', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>{h}</div>
              ))}
              {(() => {
                const days = getDaysInMonth(yr, mo);
                const firstDay = days[0].getDay();
                const blanksCount = firstDay === 0 ? 6 : firstDay - 1;
                const cells = [];
                for(let i=blanksCount; i>0; i--) cells.push(getDayUI(new Date(yr, mo, 1 - i)));
                days.forEach(d => cells.push(getDayUI(d)));
                const remaining = (7 - (cells.length % 7)) % 7;
                for(let i=1; i<=remaining; i++) cells.push(getDayUI(new Date(yr, mo + 1, i)));
                return cells;
              })()}
            </div>
          </div>

          {/* iOS Style Floating Sheet Component */}
          {selectedDay && (
            <div 
              className="fade ios-sheet-overlay"
              onClick={() => setSelectedDay(null)}
              style={{
                position: 'fixed', inset: 0, zIndex: 1000, 
                background: 'rgba(0,0,0,0.6)', 
                backdropFilter: 'blur(12px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 16
              }}
            >
              <div 
                className="ios-sheet"
                onClick={e => e.stopPropagation()}
              >
                {/* Visual Handle */}
                <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
                   <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 10 }} />
                </div>

                <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${T.border}`, paddingBottom: 16, marginBottom: 20, flexShrink: 0 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: T.accent, textTransform: 'uppercase', letterSpacing: 1 }}>Loans Due</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: T.txt }}>{new Date(selectedDay.date).toLocaleDateString('en-KE', { day: 'numeric', month: 'long' })}</div>
                      </div>
                      <button onClick={() => setSelectedDay(null)} style={{ background: T.surface, border: 'none', color: T.txt, borderRadius: 99, width: 32, height: 32, cursor: 'pointer', fontWeight: 900 }}>✕</button>
                   </div>

                   <div style={{ overflowY: 'auto', flex: 1, padding: '2px' }}>
                      {selectedDay.records.length > 0 ? (
                        selectedDay.records.map(renderLoanCard)
                      ) : (
                        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748B' }}>
                           <CalendarIcon size={48} style={{ opacity: 0.1, marginBottom: 16 }} />
                           <p style={{ fontWeight: 600 }}>Zero repayments on this date.</p>
                        </div>
                      )}
                   </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Search Tab */
        <div className="glass-card" style={{ padding: 32, borderRadius: 24 }}>
           <div style={{ maxWidth: 600, margin: '0 auto' }}>
              <div style={{ position: 'relative', marginBottom: 32 }}>
                 <div style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }}><Search size={20}/></div>
                 <input 
                   autoFocus
                   placeholder="Search borrower name, ID or phone..." 
                   value={searchQuery}
                   onChange={e => setSearchQuery(e.target.value)}
                   style={{ 
                     width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', 
                     borderRadius: 16, padding: '16px 16px 16px 50px', color: '#FFF', fontSize: 16, outline: 'none' 
                   }} 
                 />
              </div>

              {searchQuery.length > 1 ? (
                <div>
                   {maturityRecords.filter(r => r.loan.customer.toLowerCase().includes(searchQuery.toLowerCase()) || r.loan.id.toLowerCase().includes(searchQuery.toLowerCase())).map(renderLoanCard)}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 40, color: '#64748B' }}>
                   <p>Start typing to search for specific maturity records.</p>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
}
