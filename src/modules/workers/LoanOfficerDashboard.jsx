import { 
  Card, CH, KPI, Btn, T, Badge, Av, fmtM, fmt, now 
} from '@/lms-common';
import { getWorkingDaysInMonth } from "@/utils/calendarUtils";
import { 
  Target, TrendingUp, Users, Zap, FilePlus, ChevronRight, 
  ArrowUpRight, Clock, AlertCircle, PieChart, Activity, 
  Briefcase, UserPlus, FileSearch, MessageSquare, ShieldCheck
} from 'lucide-react';

export default function LoanOfficerDashboard({ worker, loans, customers, leads, interactions, setTab, isMobile }) {
  const wLoans = (loans || []).filter(l => l.officerId === worker.id || l.officer === worker.name);
  const wCustomers = (customers || []).filter(c => c.officerId === worker.id || c.assignedOfficerId === worker.id || c.officer === worker.name);
  const wLeads = (leads || []).filter(l => l.officerId === worker.id || l.officer === worker.name);
  
  const activeLoans = wLoans.filter(l => l.status === 'Active' || l.status === 'Overdue');
  const portfolio = activeLoans.reduce((s, l) => s + (l.balance || 0), 0);
  
  const myCustomers = (customers || []).filter(c => c.officerId === worker.id || c.officer === worker.name);
  const myLeads = (leads || []).filter(l => l.officerId === worker.id || l.officer === worker.name);
  
  const inArrears = wLoans.filter(l => l.status === 'Overdue');
  const arrearsRatio = wLoans.length ? (inArrears.length / wLoans.length * 100).toFixed(1) : 0;

  const companyTarget = Number(localStorage.getItem('_lms_company_target') || 2000000);
  const activeWorkers = (loans || []).map(l => l.officer).filter((v, i, a) => a.indexOf(v) === i).length || 1;
  const autoTarget = Math.round(companyTarget / activeWorkers);
  const finalTarget = worker.target || autoTarget;
  
  const workingDays = useMemo(() => {
    const d = new Date();
    return getWorkingDaysInMonth(d.getFullYear(), d.getMonth());
  }, []);
  
  const dailyTarget = Math.round(finalTarget / (workingDays.length || 1));
  const collectedThisMonth = (payments || []).filter(p => (p.status === 'Allocated' || p.status === 'allocated') && (wLoans.some(wl => wl.id === p.loanId || wl.id === p.loan_id))).reduce((s, p) => s + Number(p.amount || 0), 0);
  const targetPct = Math.round((collectedThisMonth / finalTarget) * 100) || 0;

  const GATEWAY_CARDS = [
    { id: 'loans', label: 'Loan Apps', desc: 'Process new requests', icon: FilePlus, color: T.accent, count: wLoans.filter(l => l.status === 'Pending').length },
    { id: 'leads', label: 'Lead Pipeline', desc: 'Convert prospects', icon: Briefcase, color: T.warn, count: myLeads.filter(l => l.status === 'New').length },
    { id: 'customers', label: 'Client CRM', desc: 'Manage assignment', icon: Users, color: T.ok, count: myCustomers.length },
    { id: 'interactions', label: 'Interactions', desc: 'Recent discussions', icon: MessageSquare, color: T.secondary, count: (interactions || []).length },
  ];

  const actions = useMemo(() => {
    const list = [];
    
    // 1. Pending Loans (Immediate priority)
    const pendingCount = wLoans.filter(l => l.status === 'Pending').length;
    if (pendingCount > 0) {
      list.push({
        id: 'pending-loans',
        tab: 'loans',
        title: 'Loan Apps Pending',
        desc: `${pendingCount} new request${pendingCount > 1 ? 's' : ''} awaiting review`,
        color: T.accent,
        icon: FilePlus
      });
    }

    // 2. Overdue Portfolio (Action required)
    const overdueCount = inArrears.length;
    if (overdueCount > 0) {
      list.push({
        id: 'overdue-loans',
        tab: 'customers',
        title: 'Collection Required',
        desc: `${overdueCount} account${overdueCount > 1 ? 's' : ''} in default`,
        color: T.warn,
        icon: AlertCircle
      });
    }

    // 3. Document Completion (Compliance) / Verification Status
    const mdc = wCustomers.filter(c => !c.id_no || c.id_no.startsWith('PENDING') || !c.documents || c.documents.length === 0).length;
    if (mdc > 0) {
      list.push({
        id: 'missing-docs',
        tab: 'customers',
        title: 'KYC: Document Gaps',
        desc: `${mdc} client${mdc > 1 ? 's' : ''} require uploads`,
        color: T.accent,
        icon: ShieldCheck
      });
    } else if (wCustomers.length > 0) {
      list.push({
        id: 'docs-ok',
        tab: 'customers',
        title: 'Compliance: Verified',
        desc: '100% of portfolio is fully verified',
        color: T.ok,
        icon: ShieldCheck
      });
    }

    // 4. Leads to follow up
    const nlc = wLeads.filter(l => l.status === 'New').length;
    if (nlc > 0) {
      list.push({
        id: 'new-leads',
        tab: 'leads',
        title: 'Lead Follow-up',
        desc: `Connect with ${nlc} new prospect${nlc > 1 ? 's' : ''}`,
        color: T.warn,
        icon: MessageSquare
      });
    }

    if (list.length === 0) {
       list.push({ id: 'done', tab: 'dashboard', title: 'All Caught Up', desc: 'No urgent actions required.', color: T.ok, icon: ShieldCheck });
    }
    return list;
  }, [wLoans, inArrears, wCustomers, wLeads]);

  return (
    <div className="fu" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* ── PORTFOLIO OVERVIEW ────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))', gap: isMobile ? 12 : 20, marginBottom: 32 }}>
        <Card style={{ background: `linear-gradient(135deg, ${T.accent}15 0%, transparent 100%)`, borderLeft: `4px solid ${T.accent}` }}>
          <div style={{ padding: 20 }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                   <div style={{ fontSize: isMobile ? 11 : 13, color: T.muted, fontWeight: 600, letterSpacing: '0.05em' }}>MONTHLY TARGET</div>
                   <div style={{ fontSize: isMobile ? 24 : 32, fontWeight: 900, color: T.txt, marginTop: 4 }}>{fmtM(finalTarget)}</div>
                </div>
                <div style={{ background: `${T.accent}20`, padding: 10, borderRadius: 12 }}>
                   <Target color={T.accent} size={24} />
                </div>
             </div>
             <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Badge v="accent" sm>{fmtM(dailyTarget)}/day</Badge>
                <div style={{ fontSize: 11, color: T.muted }}>Daily Requirement</div>
             </div>
          </div>
        </Card>

        <Card style={{ background: `linear-gradient(135deg, ${T.ok}15 0%, transparent 100%)`, borderLeft: `4px solid ${T.ok}` }}>
          <div style={{ padding: 20 }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                   <div style={{ fontSize: isMobile ? 11 : 13, color: T.muted, fontWeight: 600, letterSpacing: '0.05em' }}>TARGET PROGRESS</div>
                   <div style={{ fontSize: isMobile ? 24 : 32, fontWeight: 900, color: T.txt, marginTop: 4 }}>{targetPct}%</div>
                </div>
                <div style={{ background: `${T.ok}20`, padding: 10, borderRadius: 12 }}>
                   <Activity color={T.ok} size={24} />
                </div>
             </div>
             <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: '100%', height: 6, background: `${T.ok}10`, borderRadius: 3, overflow: 'hidden' }}>
                   <div style={{ width: `${Math.min(100, targetPct)}%`, height: '100%', background: T.ok }} />
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.ok }}>{fmtM(collectedThisMonth)}</div>
             </div>
          </div>
        </Card>

        <Card style={{ background: `linear-gradient(135deg, ${T.warn}15 0%, transparent 100%)`, borderLeft: `4px solid ${T.warn}` }}>
          <div style={{ padding: 20 }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                   <div style={{ fontSize: isMobile ? 11 : 13, color: T.muted, fontWeight: 600, letterSpacing: '0.05em' }}>PORTFOLIO AT RISK</div>
                   <div style={{ fontSize: isMobile ? 24 : 32, fontWeight: 900, color: T.txt, marginTop: 4 }}>{arrearsRatio}%</div>
                </div>
                <div style={{ background: `${T.warn}20`, padding: 10, borderRadius: 12 }}>
                   <AlertCircle color={T.warn} size={24} />
                </div>
             </div>
             <div style={{ marginTop: 16, fontSize: 11, color: T.muted }}>
                {inArrears.length} accounts currently in arrears
             </div>
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.6fr 1fr', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* ── GATEWAY GRID ──────────────────────────────────────────────────── */}
          <section>
             <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Operation Gateway</h3>
             </div>
             <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr', gap: isMobile ? 10 : 16 }}>
                {GATEWAY_CARDS.map(g => (
                   <Card 
                      key={g.id} 
                      onClick={() => setTab(g.id)} 
                      noPadding
                      style={{ cursor: 'pointer', border: `1px solid ${T.border}` }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)'; e.currentTarget.style.borderColor = g.color; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.borderColor = T.border; }}
                   >
                      <div style={{ padding: isMobile ? 12 : 16, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 10 : 16, alignItems: isMobile ? 'flex-start' : 'center' }}>
                         <div style={{ width: isMobile ? 40 : 48, height: isMobile ? 40 : 48, borderRadius: 12, background: `${g.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <g.icon color={g.color} size={isMobile ? 18 : 22} />
                         </div>
                         <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                               <span style={{ fontWeight: 800, color: T.txt, fontSize: isMobile ? 13 : 15 }}>{g.label}</span>
                               {g.count > 0 && <Badge sm v={g.id === 'leads' ? 'warn' : 'accent'}>{g.count}</Badge>}
                            </div>
                            {!isMobile && <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{g.desc}</div>}
                         </div>
                         {!isMobile && <ChevronRight size={16} color={T.muted} />}
                      </div>
                   </Card>
                ))}
             </div>
          </section>

          {/* ── PERFORMANCE TREND ─────────────────────────────────────────────── */}
          <Card noPadding={isMobile}>
             <CH title="Monthly Target Progress" icon={Users} />
             <div style={{ padding: isMobile ? '0 16px 16px' : '0 20px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 16 }}>
                   <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 900 }}>{fmtM(collectedThisMonth)} / {fmtM(finalTarget)}</div>
                   <div style={{ fontSize: 12, color: T.muted, paddingBottom: 2 }}>Monthly Goal</div>
                </div>
                <div style={{ height: 10, background: `${T.accent}10`, borderRadius: 6, position: 'relative', overflow: 'hidden', border: `1px solid ${T.border}` }}>
                   <div style={{ 
                      position: 'absolute', top: 0, left: 0, height: '100%', 
                      width: `${Math.min(100, targetPct)}%`, 
                      background: `linear-gradient(90deg, ${T.accent}, ${T.ok})`, 
                      borderRadius: 6, transition: 'width 1s ease-out' 
                   }} />
                </div>
             </div>
          </Card>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* ── RECENT PULSE ──────────────────────────────────────────────────── */}
          <Card>
             <CH title="Recent Activity Pulse" icon={Zap} />
             <div style={{ padding: '0 16px 16px' }}>
                {wLoans.slice(0, 4).length > 0 ? wLoans.slice(0, 4).map((l, i) => (
                   <div key={l.id} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: i < 3 ? `1px solid ${T.border}` : 'none' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: T.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <Clock size={14} color={T.muted} />
                      </div>
                      <div style={{ flex: 1 }}>
                         <div style={{ fontSize: 13, fontWeight: 700 }}>{l.customer}</div>
                         <div style={{ fontSize: 11, color: T.muted }}>Loan {l.id} • {l.status}</div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 800 }}>
                        {l.amount >= 1e6 ? `${(l.amount / 1e6).toFixed(1)}M` : l.amount >= 1e3 ? `${(l.amount / 1e3).toFixed(1)}K` : l.amount.toLocaleString()}
                      </div>
                   </div>
                )) : (
                   <div style={{ padding: '24px 0', textAlign: 'center' }}>
                      <Clock size={32} color={T.muted} style={{ opacity: 0.3 }} />
                      <div style={{ color: T.muted, fontSize: 13, marginTop: 12 }}>No recent approvals found.</div>
                   </div>
                )}
             </div>
          </Card>

          {/* ── NOTIFICATION HUB ───────────────────────────────────────────── */}
          <Card style={{ 
            background: `linear-gradient(135deg, ${T.accent}20 0%, ${T.surface} 100%)`,
            border: `1.5px solid ${T.accent}40`,
            boxShadow: `0 8px 32px ${T.accent}15`
          }}>
             <CH title="Workplace Notifications" icon={Zap} action={<Btn sm v="secondary" onClick={() => setTab('interactions')}>Archive</Btn>} />
             <div style={{ padding: '0 16px 16px' }}>
                {actions.map(a => (
                   <div 
                      key={a.id}
                      onClick={() => setTab(a.tab)}
                      onMouseEnter={(e) => { if(!isMobile) { e.currentTarget.style.borderColor = a.color; e.currentTarget.style.transform = 'translateX(4px)'; } }}
                      onMouseLeave={(e) => { if(!isMobile) { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.transform = 'translateX(0)'; } }}
                      style={{ 
                        background: T.main, padding: '14px 16px', borderRadius: 14, 
                        border: `1px solid ${T.border}`, marginBottom: 12, cursor: 'pointer', 
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex', gap: 12, alignItems: 'center'
                      }}
                   >
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${a.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {a.icon ? <a.icon size={18} color={a.color} /> : <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.color }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: T.txt }}>{a.title}</div>
                        <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{a.desc}</div>
                      </div>
                      <ChevronRight size={14} color={T.muted} />
                   </div>
                ))}
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

