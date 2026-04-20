import React from 'react';
import { Card, CH, KPI, T, Badge, Btn, fmtM, fmt } from '@/lms-common';
import { 
  AlertCircle, DollarSign, Target, Calendar, Phone, 
  MessageSquare, UserX, Clock, ArrowUpRight, ShieldAlert,
  Activity, TrendingDown
} from 'lucide-react';

export default function CollectionsOfficerDashboard({ worker, loans, setTab }) {
  const wLoans = (loans || []).filter(l => l.officerId === worker.id || l.officer === worker.name);
  const overdue = wLoans.filter(l => l.status === 'Overdue');
  const totalArrears = overdue.reduce((s, l) => s + (l.balance || 0), 0);
  
  const recoveryRate = 82.4; // Sample data

  return (
    <div className="fu" style={{ animation: 'fadeIn 0.5s ease' }}>
      {/* ── ARREARS PULSE ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 32 }}>
        <Card style={{ background: `linear-gradient(135deg, ${T.danger}15 0%, transparent 100%)`, borderLeft: `4px solid ${T.danger}` }}>
          <div style={{ padding: 20 }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                   <div style={{ fontSize: 13, color: T.muted, fontWeight: 600, letterSpacing: '0.05em' }}>TOTAL EXPOSURE</div>
                   <div style={{ fontSize: 32, fontWeight: 900, color: T.txt, marginTop: 4 }}>KES {(totalArrears/1e3).toFixed(1)}K</div>
                </div>
                <div style={{ background: `${T.danger}20`, padding: 10, borderRadius: 12 }}>
                   <ShieldAlert color={T.danger} size={24} />
                </div>
             </div>
             <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Badge v="danger" sm>{overdue.length} ACCOUNTS</Badge>
                <div style={{ fontSize: 11, color: T.muted }}>in active arrears</div>
             </div>
          </div>
        </Card>

        <Card style={{ background: `linear-gradient(135deg, ${T.ok}15 0%, transparent 100%)`, borderLeft: `4px solid ${T.ok}` }}>
          <div style={{ padding: 20 }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                   <div style={{ fontSize: 13, color: T.muted, fontWeight: 600, letterSpacing: '0.05em' }}>RECOVERY RATE</div>
                   <div style={{ fontSize: 32, fontWeight: 900, color: T.txt, marginTop: 4 }}>{recoveryRate}%</div>
                </div>
                <div style={{ background: `${T.ok}20`, padding: 10, borderRadius: 12 }}>
                   <Target color={T.ok} size={24} />
                </div>
             </div>
             <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: '100%', height: 6, background: `${T.ok}10`, borderRadius: 3, overflow: 'hidden' }}>
                   <div style={{ width: `${recoveryRate}%`, height: '100%', background: T.ok }} />
                </div>
             </div>
          </div>
        </Card>

        <Card style={{ background: `linear-gradient(135deg, ${T.accent}15 0%, transparent 100%)`, borderLeft: `4px solid ${T.accent}` }}>
          <div style={{ padding: 20 }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                   <div style={{ fontSize: 13, color: T.muted, fontWeight: 600, letterSpacing: '0.05em' }}>PROMISED TODAY</div>
                   <div style={{ fontSize: 32, fontWeight: 900, color: T.txt, marginTop: 4 }}>KES 42.5K</div>
                </div>
                <div style={{ background: `${T.accent}20`, padding: 10, borderRadius: 12 }}>
                   <Clock color={T.accent} size={24} />
                </div>
             </div>
             <div style={{ marginTop: 16, fontSize: 11, color: T.muted }}>
                14 call-backs scheduled for today
             </div>
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* ── PRIORITY ARREARS ────────────────────────────────────────────── */}
          <Card style={{ border: `1px solid ${T.border}` }}>
             <CH title="Critical Collection Cases" icon={AlertCircle} action={<Btn sm v="danger">Action All</Btn>} />
             <div style={{ padding: '0 16px 16px' }}>
                {overdue.length > 0 ? (
                   <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {overdue.slice(0, 5).map(l => (
                         <div key={l.id} style={{ 
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '16px', background: T.main, borderRadius: 16, border: `1px solid ${T.border}`
                         }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                               <div style={{ width: 44, height: 44, borderRadius: 12, background: `${T.danger}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.danger }}>
                                  <Phone size={20} />
                               </div>
                               <div>
                                  <div style={{ fontWeight: 800, fontSize: 15 }}>{l.customer}</div>
                                  <div style={{ fontSize: 11, color: T.muted }}>{l.daysOverdue} days late • Loan {l.id}</div>
                               </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                               <div style={{ color: T.danger, fontWeight: 900, fontSize: 16 }}>KES {(l.balance || 0).toLocaleString()}</div>
                               <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginTop: 4 }}>
                                  <Badge v="danger" sm>CRITICAL</Badge>
                               </div>
                            </div>
                         </div>
                      ))}
                   </div>
                ) : (
                   <div style={{ padding: 60, textAlign: 'center' }}>
                      <Activity color={T.ok} size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                      <div style={{ fontWeight: 800, fontSize: 18 }}>Clean Sheet</div>
                      <div style={{ color: T.muted, fontSize: 13, marginTop: 8 }}>All collections are currently up to date!</div>
                   </div>
                )}
             </div>
          </Card>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* ── COLLECTIONS GATEWAY ─────────────────────────────────────────── */}
          <Card style={{ background: T.surface }}>
             <CH title="Recovery Gateway" icon={Zap} />
             <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Btn block v="secondary" icon={ArrowUpRight} onClick={() => setTab('loans')} style={{ justifyContent: 'flex-start', padding: 16 }}>Arrears Ledger</Btn>
                <Btn block v="secondary" icon={MessageSquare} style={{ justifyContent: 'flex-start', padding: 16 }}>Communication Hub</Btn>
                <Btn block v="secondary" icon={UserX} style={{ justifyContent: 'flex-start', padding: 16 }}>Blacklist Management</Btn>
             </div>
          </Card>

          {/* ── DAILY SUMMARY ───────────────────────────────────────────────── */}
          <Card>
             <CH title="Team Performance" icon={TrendingDown} />
             <div style={{ padding: '0 20px 20px' }}>
                <div style={{ fontSize: 12, color: T.muted, marginBottom: 16 }}>Monthly Collection Efficiency</div>
                <div style={{ height: 160, display: 'flex', alignItems: 'flex-end', gap: 8, paddingBottom: 8 }}>
                   {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                      <div key={i} style={{ flex: 1, height: `${h}%`, background: i === 5 ? T.ok : `${T.ok}30`, borderRadius: '4px 4px 0 0', position: 'relative' }} />
                   ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.muted, marginTop: 8 }}>
                   <span>Mon</span>
                   <span>Wed</span>
                   <span>Fri</span>
                   <span>Sun</span>
                </div>
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

