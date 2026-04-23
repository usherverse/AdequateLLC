import React, { useMemo } from 'react';
import { 
  Card, CH, KPI, DT, Badge, Btn, 
  fmt, fmtM, now, T, SC, RC, calculateLoanStatus 
} from '@/lms-common';
import { 
  ShieldAlert, Clock, Phone, MessageSquare, 
  TrendingDown, CheckCircle, AlertCircle, History 
} from 'lucide-react';

export default function CollectionsDashboard({ 
  worker, loans = [], customers = [], payments = [], interactions = [], setInteractions, addAudit, showToast = () => {}, onOpenCustomerProfile 
}) {
  
  const myPortfolio = useMemo(() => {
    return loans.filter(l => l.officer === worker.name || l.collectionsOfficer === worker.name);
  }, [loans, worker.name]);

  const stats = useMemo(() => {
    const overdue = myPortfolio.filter(l => l.status === 'Overdue');
    const totalArrears = overdue.reduce((s, l) => s + l.balance, 0);
    const ptps = interactions.filter(i => i.type === 'Promise to Pay' && i.promiseDate >= now()).length;

    return { totalArrears, overdueCount: overdue.length, ptps };
  }, [myPortfolio, interactions]);

  const highRiskCustomers = useMemo(() => {
    return customers.filter(c => {
      const isMyCustomer = myPortfolio.some(l => l.customerId === c.id);
      return isMyCustomer && (c.risk === 'High' || c.risk === 'Medium');
    });
  }, [customers, myPortfolio]);

  const efficiency = useMemo(() => {
    const currentMonth = now().slice(0, 7);
    const myMonthlyPayments = payments.filter(p => {
      if (!p.date?.startsWith(currentMonth) || (p.status !== 'Allocated' && p.status !== 'allocated')) return false;
      return myPortfolio.some(l => l.id === p.loanId);
    });
    
    const collected = myMonthlyPayments.reduce((s, p) => s + Number(p.amount), 0);
    
    const remaining = myPortfolio.reduce((total, l) => {
      const paid = payments.filter(p => p.loanId === l.id && (p.status === 'Allocated' || p.status === 'allocated')).reduce((s, p) => s + p.amount, 0);
      const e = calculateLoanStatus(l, null, paid);
      return total + (e.totalAmountDue > 0 ? e.totalAmountDue : 0);
    }, 0);

    const totalCollectible = collected + remaining;
    const rate = totalCollectible > 0 ? (collected / totalCollectible) : 0;
    
    return { collected, remaining, rate, totalCollectible };
  }, [myPortfolio, payments]);


  return (
    <div className="fu" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* ── KPI Grid ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginBottom: 32 }}>
        <Card style={{ background: `linear-gradient(135deg, #F59E0B20 0%, transparent 100%)`, borderLeft: `4px solid #F59E0B` }}>
          <div style={{ padding: 20 }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                   <div style={{ fontSize: 12, color: T.muted, fontWeight: 700, textTransform: 'uppercase' }}>Portfolio at Risk</div>
                   <div style={{ fontSize: 28, fontWeight: 900, color: T.txt, marginTop: 4 }}>{fmtM(stats.totalArrears)}</div>
                </div>
                <div style={{ background: '#F59E0B20', padding: 10, borderRadius: 12 }}>
                   <ShieldAlert color="#F59E0B" size={24} />
                </div>
             </div>
             <div style={{ marginTop: 16, fontSize: 11, color: T.muted }}>{stats.overdueCount} accounts in active arrears</div>
          </div>
        </Card>

        <Card style={{ background: `linear-gradient(135deg, ${T.ok}20 0%, transparent 100%)`, borderLeft: `4px solid ${T.ok}` }}>
          <div style={{ padding: 20 }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                   <div style={{ fontSize: 12, color: T.muted, fontWeight: 700, textTransform: 'uppercase' }}>Active Promises (PTP)</div>
                   <div style={{ fontSize: 28, fontWeight: 900, color: T.txt, marginTop: 4 }}>{stats.ptps}</div>
                </div>
                <div style={{ background: `${T.ok}20`, padding: 10, borderRadius: 12 }}>
                   <Clock color={T.ok} size={24} />
                </div>
             </div>
             <div style={{ marginTop: 16, fontSize: 11, color: T.muted }}>Commitments tracked for this week</div>
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 24 }}>
        <section>
          <Card>
            <CH title="High-Priority Call List" sub="Focused view of high-risk arrears under your assignment" icon={Phone} />
            <DT 
              cols={[
                { k: 'id', l: 'ID', r: v => <span style={{ color: '#F59E0B', fontFamily: T.mono, fontWeight: 700 }}>{v}</span> },
                { k: 'name', l: 'Customer', r: (v, row) => <span onClick={() => onOpenCustomerProfile?.(row.id)} style={{ color: T.accent, fontWeight: 700, cursor: 'pointer', borderBottom: `1px dashed ${T.accent}40` }}>{v}</span> },
                { k: 'phone', l: 'Phone' },
                { k: 'business', l: 'Business' },
                { k: 'risk', l: 'Risk', r: v => <Badge color={RC[v]}>{v}</Badge> }
              ]}
              rows={highRiskCustomers}
            />
          </Card>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Card>
            <CH title="Recent Engagements" icon={MessageSquare} />
            <div style={{ padding: '0 16px 16px' }}>
              {interactions.filter(i => i.officer === worker.name).slice(0, 5).map((item, i) => (
                <div key={item.id} style={{ padding: '12px 0', borderBottom: i < 4 ? `1px solid ${T.border}` : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Badge sm color={T.accent}>{item.type}</Badge>
                    <span style={{ fontSize: 10, color: T.muted }}>{item.date}</span>
                  </div>
                  <div style={{ fontSize: 12, color: T.txt, fontWeight: 600 }}>{item.notes}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card style={{ background: `linear-gradient(135deg, ${T.accent}10, transparent)` }}>
            <CH title="Collection Target" icon={TrendingDown} />
            <div style={{ padding: '0 20px 20px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
                 <div style={{ fontSize: 28, fontWeight: 900 }}>{(efficiency.rate * 100).toFixed(1)}%</div>
                 <div style={{ fontSize: 11, color: T.muted, paddingBottom: 4 }}>Goal: 100% Efficiency</div>
               </div>
               <div style={{ height: 8, background: T.border, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, efficiency.rate * 100)}%`, height: '100%', background: T.accent, transition: 'width 1s ease-out' }} />
               </div>
               <div style={{ marginTop: 12, fontSize: 11, color: T.muted, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{fmt(efficiency.collected)} collected</span>
                  <span>{fmt(efficiency.remaining)} remaining</span>
               </div>
            </div>
          </Card>

        </section>
      </div>
    </div>
  );
}
