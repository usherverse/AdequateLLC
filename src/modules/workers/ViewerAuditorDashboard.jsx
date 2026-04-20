import React from 'react';
import { Card, CH, KPI, T, Badge, Btn } from '@/lms-common';
import { ShieldCheck, Eye, Search, FileText, Download } from 'lucide-react';

export default function ViewerAuditorDashboard({ worker, loans, auditLog }) {
  return (
    <div className="fu">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 28 }}>
        <KPI label="Portfolio Health" value="Stable" icon={ShieldCheck} color={T.ok} 
             style={{ background: `linear-gradient(145deg, ${T.surface}, #0C1A14)`, border: `1px solid ${T.ok}20` }} />
        <KPI label="Audit Coverage" value="100%" icon={Eye} color={T.accent}
             style={{ background: `linear-gradient(145deg, ${T.surface}, #1A121A)`, border: `1px solid ${T.accent}20` }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        <Card style={{ background: T.surface }}>
          <CH title="Recent Audit Flags" icon={Search} />
          <div style={{ padding: 40, color: T.muted, textAlign: 'center', fontSize: 13 }}>No critical compliance violations detected in recent cycles.</div>
        </Card>
        
        <Card style={{ background: T.surface }}>
          <CH title="Audit Controls" />
          <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Btn block v="secondary" icon={FileText}>Generate Audit Report</Btn>
            <Btn block v="secondary" icon={Download}>Export Raw Logs</Btn>
          </div>
        </Card>
      </div>
    </div>
  );
}
