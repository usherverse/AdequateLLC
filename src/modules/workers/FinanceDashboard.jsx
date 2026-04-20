import React, { useMemo } from 'react';
import { 
  Card, CH, KPI, DT, Badge, Btn, 
  fmt, fmtM, now, T, SC, RC 
} from '@/lms-common';
import { 
  Landmark, CreditCard, ArrowUpRight, ArrowDownRight, 
  Activity, ClipboardList, ShieldCheck, Database 
} from 'lucide-react';

export default function FinanceDashboard({ 
  worker, loans = [], customers = [], payments = [], addAudit, showToast = () => {}, onOpenCustomerProfile 
}) {
  
  const stats = useMemo(() => {
    const disbursementsPending = loans.filter(l => l.status === 'Approved').reduce((s, l) => s + l.amount, 0);
    const collectionsToday = payments.filter(p => p.date === now() && (p.status === 'Allocated' || p.status === 'allocated')).reduce((s, p) => s + p.amount, 0);
    const pendingReview = loans.filter(l => l.status === 'Application submitted' || l.status === 'Pending').length;

    return { disbursementsPending, collectionsToday, pendingReview };
  }, [loans, payments]);

  return (
    <div className="fu" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* ── KPI Grid ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginBottom: 32 }}>
        <Card style={{ background: `linear-gradient(135deg, #10B98120 0%, transparent 100%)`, borderLeft: `4px solid #10B981` }}>
          <div style={{ padding: 20 }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                   <div style={{ fontSize: 12, color: T.muted, fontWeight: 700, textTransform: 'uppercase' }}>Daily Liquidity Flow</div>
                   <div style={{ fontSize: 28, fontWeight: 900, color: T.txt, marginTop: 4 }}>{fmtM(stats.collectionsToday)}</div>
                </div>
                <div style={{ background: '#10B98120', padding: 10, borderRadius: 12 }}>
                   <ArrowUpRight color="#10B981" size={24} />
                </div>
             </div>
             <div style={{ marginTop: 16, fontSize: 11, color: T.muted }}>Total allocated collections for {now()}</div>
          </div>
        </Card>

        <Card style={{ background: `linear-gradient(135deg, ${T.accent}20 0%, transparent 100%)`, borderLeft: `4px solid ${T.accent}` }}>
          <div style={{ padding: 20 }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                   <div style={{ fontSize: 12, color: T.muted, fontWeight: 700, textTransform: 'uppercase' }}>Pending Disbursements</div>
                   <div style={{ fontSize: 28, fontWeight: 900, color: T.txt, marginTop: 4 }}>{fmtM(stats.disbursementsPending)}</div>
                </div>
                <div style={{ background: `${T.accent}20`, padding: 10, borderRadius: 12 }}>
                   <CreditCard color={T.accent} size={24} />
                </div>
             </div>
             <div style={{ marginTop: 16, fontSize: 11, color: T.muted }}>Approved loans awaiting treasury release</div>
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 24 }}>
        <section>
          <Card>
            <CH title="Disbursement Queue" sub="Verification and release of approved loan funds" icon={Landmark} />
            <DT 
              cols={[
                { k: 'id', l: 'ID', r: v => <span style={{ color: '#10B981', fontFamily: T.mono, fontWeight: 700 }}>{v}</span> },
                { k: 'customer', l: 'Customer', r: (v, row) => <span onClick={() => onOpenCustomerProfile?.(row.customerId)} style={{ fontWeight: 700, color: T.accent, cursor: 'pointer' }}>{v}</span> },
                { k: 'amount', l: 'Principal', r: v => fmt(v) },
                { k: 'officer', l: 'L.O' },
                { k: 'status', l: 'Verification', r: v => <Badge color={SC[v] || T.ok}>READY</Badge> }
              ]}
              rows={loans.filter(l => l.status === 'Approved')}
            />
          </Card>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Card>
            <CH title="Treasury Controls" icon={ShieldCheck} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 12px 12px' }}>
               <Btn full v="secondary" style={{ textAlign: 'left', justifyContent: 'flex-start' }}><Database size={16} /> Reconcile Statements</Btn>
               <Btn full v="secondary" style={{ textAlign: 'left', justifyContent: 'flex-start' }}><ClipboardList size={16} /> Audit Trail</Btn>
               <Btn full v="secondary" style={{ textAlign: 'left', justifyContent: 'flex-start' }}><Activity size={16} /> Batch Payments</Btn>
            </div>
          </Card>

          <Card style={{ background: `linear-gradient(135deg, ${T.warn}10, transparent)` }}>
            <CH title="Compliance Watch" icon={ClipboardList} />
            <div style={{ padding: '0 20px 20px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{stats.pendingReview}</div>
                  <div style={{ fontSize: 12, color: T.muted }}>Applications Pending Audit</div>
               </div>
               <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5 }}>
                  Finance review is required for all applications exceeding KES 50,000 before disbursement.
               </div>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
