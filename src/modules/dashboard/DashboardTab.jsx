import { useState, useMemo, useEffect } from 'react';
import { Home, TrendingUp, AlertTriangle, CheckCircle, BarChart, HardHat, User, UserPlus, Clock } from 'lucide-react';
import { T, SC, RC, SFX, Card, CH, KPI, DT, Btn, Badge, Av, Bar, BackBtn, RefreshBtn,
  FI, PhoneInput, NumericInput, Search, Pills, Alert, Dialog, ConfirmDialog, ToastContainer,
  LoanModal, LoanForm, RepayTracker, LivePortfolioChart, WeeklyCollectionsChart,
  fmt, fmtM, now, uid, escHtml, toCSV, dlCSV, buildFullBackup,
  calculateLoanStatus, deriveDashboardMetrics,
  sbWrite, sbInsert,
  toSupabaseLoan, toSupabaseCustomer, toSupabasePayment, toSupabaseInteraction,
  generateLoanAgreementHTML, generateAssetListHTML, downloadLoanDoc,
  useContactPopup, useToast, useReminders, useModalLock } from '@/lms-common';


const LiveClock = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${T.accent}30`,
      borderRadius: 16,
      padding: '10px 18px',
      minWidth: 160,
      backdropFilter: 'blur(10px)',
      boxShadow: `0 8px 32px ${T.accent}10`,
      transition: 'all 0.3s ease'
    }}>
      <Clock size={16} color={T.accent} />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ color: T.txt, fontSize: 18, fontWeight: 900, fontFamily: T.mono, letterSpacing: -0.5, lineHeight: 1 }}>
          {time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        <div style={{ color: T.accent, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 4, opacity: 0.8 }}>
          Real-time System
        </div>
      </div>
    </div>
  );
};

const DashboardTab = ({adminUser,loans,setLoans,customers,setCustomers,payments,setPayments,workers,interactions,setInteractions,onNav,scrollTop,addAudit,onOpenCustomerProfile,onRefresh}) => {
  const {open:openContact, Popup:ContactPopup} = useContactPopup();
  const [drill,setDrillRaw]=useState(null);
  const setDrill = (d) => { setDrillRaw(d); if(d) setTimeout(()=>{ try{scrollTop?.();}catch(e){} },20); };
  const [selOverdue,setSelOverdue]=useState(null);
  const [selLoan,setSelLoanRaw]=useState(null);
  const setSelLoan = (l) => { setSelLoanRaw(l); if(l) setTimeout(()=>{ try{scrollTop?.();}catch(e){} },10); };
  const setSelCust = (c) => onOpenCustomerProfile?.(c.id);

  const dashDerived = useMemo(() => {
    const d = deriveDashboardMetrics(loans, payments, customers);

    // Context-specific chart drills (Location, Type) still need local logic but
    // should use the base calculated metrics for consistency.
    const par = (days) => {
      if (d.parTotal === 0) return "0.0";
      const count = loans.filter((l) => {
        const stats = calculateLoanStatus(l, null, d.paidMap[l.id] || 0);
        return stats.overdueDays >= days && !stats.isSettled && !stats.isWrittenOff;
      }).length;
      return ((count / d.parTotal) * 100).toFixed(1);
    };

    const locs = [...new Set(customers.map((c) => c.location).filter(Boolean))]
      .map((loc) => {
        const lc = loans.filter((l) =>
          customers.find((c) => c.name === l.customer && c.location === loc),
        );
        const od = lc.filter((l) => {
          const e = calculateLoanStatus(l, null, d.paidMap[l.id] || 0);
          return e.overdueDays > 0 && !e.isSettled && !e.isWrittenOff;
        }).length;
        return {
          loc,
          rate: lc.length ? +((od / lc.length) * 100).toFixed(1) : 0,
          n: lc.length,
        };
      })
      .sort((a, b) => b.rate - a.rate);

    const byType = ["Daily", "Weekly", "Biweekly", "Monthly", "Lump Sum"]
      .map((rt) => {
        const ls = loans.filter((l) => {
          if (l.repaymentType !== rt) return false;
          const e = calculateLoanStatus(l, null, d.paidMap[l.id] || 0);
          return !e.isSettled && !e.isWrittenOff;
        });
        const paid = payments
          .filter((p) => ls.some((l) => l.id === p.loanId))
          .reduce((s, p) => s + p.amount, 0);
        const balance = ls.reduce(
          (s, l) =>
            s + calculateLoanStatus(l, null, d.paidMap[l.id] || 0).totalAmountDue,
          0,
        );
        return { type: rt, count: ls.length, paid, balance };
      })
      .filter((x) => x.count > 0);

    const todayStr = new Date().toLocaleDateString("en-KE", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return {
      ...d,
      par,
      locs,
      byType,
      todayStr,
    };
  }, [loans, payments, customers, workers]);
  const {
    activeList,
    book,
    ovList,
    ovAmt,
    coll,
    parTotal,
    par,
    collRate,
    locs,
    byType,
    todayStr,
    paidMap,
    activeBorrowersCount,
    pendingApprovals
  } = dashDerived;
  // todayP is UI-specific — computed locally rather than cluttering the shared engine
  const todayP = payments.filter((p) => p.date === now() && p.status === 'Allocated').reduce((s, p) => s + p.amount, 0);

  // FIX — ClickName was a component defined inside ADashboard's render body.
  // Converted to a plain render function to avoid new-type-on-every-render remounting.
  const renderClickName = ({ name, phone }) => (
    <span
      onClick={(e) => {
        e.stopPropagation();
        openContact(name, phone, e);
      }}
      style={{
        color: T.accent,
        cursor: "pointer",
        fontWeight: 600,
        borderBottom: `1px dashed ${T.accent}50`,
      }}
      title="Click to call/message"
    >
      {name}
    </span>
  );

  const custPhone = (name) => customers.find((c) => c.name === name)?.phone || "";

  return (
    <div className="fu">
      {ContactPopup}
      {drill && (
        <div
          className="dialog-backdrop"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9900,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: 0,
            backdropFilter: "var(--glass-blur)",
            WebkitBackdropFilter: "var(--glass-blur)",
            background: "rgba(4,8,16,0.75)",
            overflow: "hidden",
          }}
        >
          <div
            className="pop"
            style={{
              background: T.card,
              borderTop: `1px solid ${T.hi}`,
              borderRight: `1px solid ${T.hi}`,
              borderLeft: `1px solid ${T.hi}`,
              borderBottom: `1px solid ${T.border}`,
              borderRadius: "0 0 20px 20px",
              width: "100%",
              maxWidth: "100%",
              maxHeight: "82vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 24px 64px #000000E0",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 18px",
                borderBottom: `1px solid ${T.border}`,
                flexShrink: 0,
                background: T.card,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {drill.color && (
                  <div
                    style={{
                      width: 4,
                      height: 20,
                      borderRadius: 99,
                      background: drill.color,
                    }}
                  />
                )}
                <h3
                  style={{
                    color: T.txt,
                    fontSize: 15,
                    fontWeight: 800,
                    fontFamily: T.head,
                    margin: 0,
                  }}
                >
                  {drill.title}
                </h3>
                <span
                  style={{
                    background: T.hi,
                    color: T.muted,
                    borderRadius: 99,
                    padding: "2px 8px",
                    fontSize: 11,
                    fontFamily: T.mono,
                  }}
                >
                  {drill.rows?.length ?? 0}
                </span>
              </div>
              <button
                onClick={() => setDrill(null)}
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
                ✕
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", overflowX: "auto" }}>
              <DT cols={drill.cols} rows={drill.rows} />
            </div>
          </div>
        </div>
      )}
      <div
        className="glass pop"
        style={{
          padding: '32px 40px',
          borderRadius: 32,
          marginBottom: 32,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: `linear-gradient(135deg, ${T.accent}10 0%, transparent 100%)`,
          border: `1px solid ${T.accent}20`,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ position: 'absolute', top: -40, right: -40, opacity: 0.05 }}><Home size={200} color={T.accent} /></div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            fontFamily: T.head,
            color: T.accent,
            fontSize: 14,
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: 2,
            marginBottom: 8
          }}>
            {todayStr}
          </div>
          <div 
            className="hero-txt"
            style={{
              fontFamily: T.head,
              color: T.txt,
              fontSize: 36,
              fontWeight: 950,
              letterSpacing: '-0.04em',
              lineHeight: 1.1
            }}>
            {(() => {
              const hr = new Date().getHours();
              let greeting = "Good afternoon";
              if (hr >= 5 && hr < 12) greeting = "Good morning";
              else if (hr >= 12 && hr < 14) greeting = "Bon appétit";
              else if (hr >= 14 && hr < 18) greeting = "I hope you had a scrumptious lunch";
              else if (hr >= 18 && hr < 22) greeting = "Good evening";
              else greeting = "Burning the midnight oil? Good night";
              return `${greeting}, ${adminUser?.name || 'Don'}!`;
            })()}
          </div>
          <div style={{ color: T.dim, fontSize: 15, marginTop: 10, fontWeight: 500, maxWidth: 450, lineHeight: 1.5 }}>
            Welcome back to your command center. You have <b>{pendingApprovals}</b> loans awaiting your approval today.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 16 }}>
          <LiveClock />
          <div className="hide-sm">
            <RefreshBtn onRefresh={() => { onRefresh?.(); setDrill(null); }} style={{ padding: '12px 20px', borderRadius: 16, background: T.accent, color: '#000', border: 'none' }} />
          </div>
        </div>
      </div>

      {/* KPI Row 1 */}
      <div
        className="kpi-row"
        style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}
      >
        <KPI
          label="Loan Book"
          icon={TrendingUp}
          value={fmtM(book)}
          color={T.accent}
          delay={1}
          onClick={() =>
            setDrill({
              title: "All Active Loans",
              cols: [
                {
                  k: "id",
                  l: "ID",
                  r: (v) => (
                    <span
                      style={{ color: T.accent, fontFamily: T.mono, fontSize: 12 }}
                    >
                      {v}
                    </span>
                  ),
                },
                {
                  k: "customer",
                  l: "Customer",
                  r: (v, r) => renderClickName({ name: v, phone: custPhone(v) }),
                },
                { k: "amount", l: "Principal", r: (v) => fmt(v) },
                {
                  k: "id",
                  l: "Remaining",
                  r: (v, r) => (
                    <span
                      style={{
                        color: T.txt,
                        fontWeight: 700,
                        fontFamily: T.mono,
                      }}
                    >
                      {fmt(
                        calculateLoanStatus(r, null, paidMap[r.id] || 0)
                          .totalAmountDue,
                      )}
                    </span>
                  ),
                },
                {
                  k: "status",
                  l: "Status",
                  r: (v, row) => {
                    const e = calculateLoanStatus(
                      row,
                      null,
                      paidMap[row.id] || 0,
                    );
                    return (
                      <Badge color={SC[e.badgeStatus] || T.muted}>
                        {e.status}
                      </Badge>
                    );
                  },
                },
                {
                  k: "totalDays",
                  l: "Days",
                  r: (v, row) => {
                    const e = calculateLoanStatus(row, null, paidMap[row.id] || 0);
                    return (
                      <span
                        style={{
                          color: e.totalDays > 120 ? T.danger : T.txt,
                          fontWeight: 800,
                          fontFamily: "monospace",
                        }}
                      >
                        {e.totalDays}d
                      </span>
                    );
                  },
                },
              ],
              rows: activeList,
            })
          }
        />
        <KPI
          label="Overdue"
          icon={AlertTriangle}
          value={fmtM(ovAmt)}
          color={T.danger}
          delay={2}
          onClick={() =>
            setDrill({
              title: "Overdue Loans",
              cols: [
                {
                  k: "id",
                  l: "ID",
                  r: (v) => (
                    <span
                      style={{ color: T.accent, fontFamily: T.mono, fontSize: 12 }}
                    >
                      {v}
                    </span>
                  ),
                },
                {
                  k: "customer",
                  l: "Customer",
                  r: (v, r) => renderClickName({ name: v, phone: custPhone(v) }),
                },
                {
                  k: "id",
                  l: "Remaining",
                  r: (v, r) => (
                    <span
                      style={{
                        color: T.danger,
                        fontWeight: 700,
                        fontFamily: T.mono,
                      }}
                    >
                      {fmt(
                        calculateLoanStatus(r, null, paidMap[r.id] || 0)
                          .totalAmountDue,
                      )}
                    </span>
                  ),
                },
                {
                  k: "days",
                  l: "Days",
                  r: (v, row) => {
                    const e = calculateLoanStatus(row, null, paidMap[row.id] || 0);
                    return (
                      <span
                        style={{
                          color: e.totalDays > 120 ? T.danger : T.txt,
                          fontWeight: 800,
                          fontFamily: "monospace",
                        }}
                      >
                        {e.totalDays}d
                      </span>
                    );
                  },
                },
                {
                  k: "status",
                  l: "Status",
                  r: (v, row) => {
                    const e = calculateLoanStatus(
                      row,
                      null,
                      paidMap[row.id] || 0,
                    );
                    return (
                      <Badge color={SC[e.badgeStatus] || T.muted}>
                        {e.status}
                      </Badge>
                    );
                  },
                },
              ],
              rows: ovList,
            })
          }
        />
        <KPI
          label="Collected Today"
          icon={CheckCircle}
          value={fmtM(todayP)}
          color={T.ok}
          delay={3}
          onClick={() =>
            setDrill({
              title: "Today's Payments",
              cols: [
                { k: "id", l: "Pay ID" },
                {
                  k: "customer",
                  l: "Customer",
                  r: (v, r) => renderClickName({ name: v, phone: custPhone(v) }),
                },
                {
                  k: "amount",
                  l: "Amount",
                  r: (v) => (
                    <span
                      style={{
                        color: T.ok,
                        fontFamily: T.mono,
                        fontWeight: 700,
                      }}
                    >
                      {fmt(v)}
                    </span>
                  ),
                },
                { k: "mpesa", l: "M-Pesa" },
                {
                  k: "status",
                  l: "Status",
                  r: (v) => <Badge color={SC[v] || T.muted}>{v}</Badge>,
                },
              ],
              rows: payments.filter((p) => p.date === now()),
            })
          }
        />
        <KPI
          label="Collection Rate"
          icon={BarChart}
          value={`${collRate}%`}
          color={T.ok}
          delay={4}
          onClick={() =>
            setDrill({
              title: "Collection by Officer",
              cols: [
                { k: "name", l: "Officer" },
                { k: "book", l: "Book", r: (v) => fmt(v) },
                {
                  k: "collected",
                  l: "Collected",
                  r: (v) => (
                    <span style={{ color: T.ok, fontFamily: T.mono }}>
                      {fmt(v)}
                    </span>
                  ),
                },
                {
                  k: "rate",
                  l: "Rate",
                  r: (v) => (
                    <span
                      style={{
                        color: +v > 80 ? T.ok : T.warn,
                        fontWeight: 800,
                      }}
                    >
                      {v}%
                    </span>
                  ),
                },
              ],
              rows: workers
                .map((w) => {
                  const wl = loans.filter((l) => l.officer === w.name);
                  let bk = 0,
                    wp = 0;
                  wl.forEach((l) => {
                    const p = paidMap[l.id] || 0;
                    const e = calculateLoanStatus(l, null, p);
                    if (!e.isSettled && !e.isWrittenOff) {
                      bk += e.totalAmountDue;
                    }
                    wp += p;
                  });
                  return {
                    name: w.name,
                    book: bk,
                    collected: wp,
                    rate:
                      wp > 0 && bk > 0
                        ? ((wp / (wp + bk)) * 100).toFixed(1)
                        : "0.0",
                  };
                })
                .filter((x) => x.book > 0),
            })
          }
        />
      </div>

      {/* KPI Row 2 */}
      <div
        className="kpi-row"
        style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}
      >
        <KPI
          label="Active Workers"
          icon={HardHat}
          value={workers.filter((w) => w.status === "Active").length}
          delay={1}
          onClick={() =>
            setDrill({
              title: "Active Staff",
              cols: [
                { k: "name", l: "Name" },
                { k: "role", l: "Role" },
                { k: "phone", l: "Phone" },
              ],
              rows: workers.filter((w) => w.status === "Active"),
            })
          }
        />
        <KPI
          label="Customers"
          icon={User}
          value={customers.length}
          delay={2}
          onClick={() =>
            setDrill({
              title: "All Customers",
              cols: [
                {
                  k: "id",
                  l: "ID",
                  r: (v) => (
                    <span
                      style={{ color: T.accent, fontFamily: T.mono, fontSize: 12 }}
                    >
                      {v}
                    </span>
                  ),
                },
                {
                  k: "name",
                  l: "Name",
                  r: (v, r) => renderClickName({ name: v, phone: r.phone }),
                },
                { k: "business", l: "Business" },
                { k: "location", l: "Location" },
                { k: "risk", l: "Risk", r: (v) => <Badge color={RC[v]}>{v}</Badge> },
              ],
              rows: customers,
            })
          }
        />
        <KPI
          label="Active Borrowers"
          icon={UserPlus}
          value={activeBorrowersCount}
          color={T.accent}
          delay={2.5}
          onClick={() =>
            setDrill({
              title: "Active Borrowers",
              cols: [
                {
                  k: "id",
                  l: "ID",
                  r: (v) => (
                    <span
                      style={{ color: T.accent, fontFamily: T.mono, fontSize: 12 }}
                    >
                      {v}
                    </span>
                  ),
                },
                {
                  k: "name",
                  l: "Name",
                  r: (v, r) => renderClickName({ name: v, phone: r.phone }),
                },
                { k: "business", l: "Business" },
                { k: "location", l: "Location" },
                { k: "risk", l: "Risk", r: (v) => <Badge color={RC[v]}>{v}</Badge> },
              ],
              rows: customers.filter(c => {
                const cLoans = loans.filter(l => l.customerId === c.id);
                return cLoans.some(l => {
                  const e = calculateLoanStatus(l, null, paidMap[l.id] || 0);
                  return !['Settled', 'Written off', 'Approved', 'Application submitted', 'worker-pending'].includes(e.badgeStatus);
                });
              }),
            })
          }
        />
        <KPI
          label="PAR 7"
          icon={AlertTriangle}
          value={`${par(7)}%`}
          color={+par(7) > 10 ? T.danger : T.warn}
          delay={3}
          onClick={() =>
            setDrill({
              title: "Loans Overdue 7+ Days",
              cols: [
                {
                  k: "id",
                  l: "ID",
                  r: (v) => (
                    <span
                      style={{ color: T.accent, fontFamily: T.mono, fontSize: 12 }}
                    >
                      {v}
                    </span>
                  ),
                },
                {
                  k: "customer",
                  l: "Customer",
                  r: (v, r) => renderClickName({ name: v, phone: custPhone(v) }),
                },
                {
                  k: "id",
                  l: "Remaining",
                  r: (v, r) =>
                    fmt(
                      calculateLoanStatus(r, null, paidMap[r.id] || 0)
                        .totalAmountDue,
                    ),
                },
                {
                  k: "days",
                  l: "Days",
                  r: (v, row) => {
                    const e = calculateLoanStatus(row, null, paidMap[row.id] || 0);
                    return (
                      <span style={{ color: T.danger, fontWeight: 800 }}>
                        {e.overdueDays}d
                      </span>
                    );
                  },
                },
              ],
              rows: loans.filter((l) => {
                const e = calculateLoanStatus(l, null, paidMap[l.id] || 0);
                return e.overdueDays >= 7 && !e.isSettled && !e.isWrittenOff;
              }),
            })
          }
        />
        <KPI
          label="PAR 30"
          icon={AlertTriangle}
          value={`${par(30)}%`}
          color={+par(30) > 5 ? T.danger : T.ok}
          delay={4}
          onClick={() =>
            setDrill({
              title: "Loans Overdue 30+ Days",
              cols: [
                {
                  k: "id",
                  l: "ID",
                  r: (v) => (
                    <span
                      style={{ color: T.accent, fontFamily: T.mono, fontSize: 12 }}
                    >
                      {v}
                    </span>
                  ),
                },
                {
                  k: "customer",
                  l: "Customer",
                  r: (v, r) => renderClickName({ name: v, phone: custPhone(v) }),
                },
                {
                  k: "id",
                  l: "Remaining",
                  r: (v, r) =>
                    fmt(
                      calculateLoanStatus(r, null, paidMap[r.id] || 0)
                        .totalAmountDue,
                    ),
                },
                {
                  k: "days",
                  l: "Days",
                  r: (v, row) => {
                    const e = calculateLoanStatus(row, null, paidMap[row.id] || 0);
                    return (
                      <span
                        style={{
                          color: T.danger,
                          fontWeight: 800,
                          fontFamily: T.mono,
                        }}
                      >
                        {e.overdueDays}d
                      </span>
                    );
                  },
                },
                {
                  k: "status",
                  l: "Phase",
                  r: (_, r) => {
                    const e = calculateLoanStatus(r, null, paidMap[r.id] || 0);
                    return (
                      <span
                        style={{
                          color: e.isFrozen ? T.purple : T.danger,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {e.phase === "frozen"
                          ? "❄ Frozen"
                          : e.phase === "penalty"
                            ? "⚠ Penalty"
                            : "Interest"}
                      </span>
                    );
                  },
                },
              ],
              rows: loans.filter((l) => {
                const e = calculateLoanStatus(l, null, paidMap[l.id] || 0);
                return e.overdueDays >= 30 && !e.isSettled && !e.isWrittenOff;
              }),
            })
          }
        />
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
    </div>
  );
};

export default DashboardTab;
