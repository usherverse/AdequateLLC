import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Smartphone, Tablet, Monitor, Lock, Hourglass, RefreshCw, Globe, ShieldCheck, UserCheck, AlertTriangle, Database, Edit3, Trash2, Key, Info, User } from 'lucide-react';
import { T, Card, CH, DT, Badge, Search, Pills, RefreshBtn, useToast, ModuleHeader, KPI, Av, fmtM, now } from '@/lms-common';

const DeviceIcon = ({ type }) => {
  if (type === 'mobile') return <Smartphone size={16}/>;
  if (type === 'tablet') return <Tablet size={16}/>;
  if (type === 'desktop') return <Monitor size={16}/>;
  return <Monitor size={16} style={{opacity: 0.5}}/>;
};

const ActionIcon = ({ action }) => {
    const act = (action || '').toLowerCase();
    const style = { size: 18, strokeWidth: 2.5 };
    if (act.includes('login') || act.includes('auth')) return <Key {...style} color={T.ok} />;
    if (act.includes('delete') || act.includes('remove')) return <Trash2 {...style} color={T.danger} />;
    if (act.includes('update') || act.includes('edit')) return <Edit3 {...style} color={T.warn} />;
    if (act.includes('insert') || act.includes('create')) return <Database {...style} color={T.accent} />;
    if (act.includes('error') || act.includes('fail')) return <AlertTriangle {...style} color={T.danger} />;
    return <Info {...style} color={T.muted} />;
};

const AuditTrailTab = ({ allState, setAuditLog }) => {
  const { auditLog = [] } = allState;
  const { show: showToast } = useToast();
  
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('All');
  const [deviceFilter, setDeviceFilter] = useState('All');
  const [loading, setLoading] = useState(false);
  const hasFetched = useRef(false);

  const refreshAudit = useCallback(async () => {
    setLoading(true);
    try {
      const { supabase, DEMO_MODE } = await import('@/config/supabaseClient');
      if (DEMO_MODE || !supabase) { setLoading(false); return; }
      const { data, error } = await supabase.from('audit_log').select('*').order('ts', { ascending: false }).limit(10);
      if (error) throw error;
      if (data) {
        setAuditLog(data.map(r => ({
          ts: r.ts,
          user: r.user_name || 'system',
          action: r.action,
          target: r.target_id,
          detail: r.detail,
          device_type: r.device_type,
          browser: r.browser,
          os: r.os,
          ip_address: r.ip_address,
          country: r.country,
          city: r.city
        })));
        hasFetched.current = true;
      }
    } catch (e) {
      showToast('Sync Failed: ' + e.message, 'danger');
    }
    setLoading(false);
  }, [setAuditLog, showToast]);

  const handleExport = useCallback(async (format) => {
    setLoading(true);
    try {
      const { supabase, DEMO_MODE } = await import('@/config/supabaseClient');
      if (DEMO_MODE || !supabase) {
        showToast('Demo mode: Export unavailable.', 'warn');
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.from('audit_log').select('*').order('ts', { ascending: false });
      if (error) throw error;
      
      const { dlReportCSV, dlReportPDF, dlReportWord } = await import('@/lms-common');
      
      const cols = [
          { k: 'Timestamp', l: 'Timestamp' },
          { k: 'Operator', l: 'Operator' },
          { k: 'Action', l: 'Action Event' },
          { k: 'Target', l: 'Target' },
          { k: 'Detail', l: 'Detail' },
          { k: 'Device', l: 'Telemetry' },
          { k: 'Location', l: 'Location' }
      ];

      const rData = {
          name: 'audit_trail',
          title: 'Full Security Audit Trail',
          hdr: cols.map(c => c.l),
          rows: data.map(r => [
              new Date(r.ts).toLocaleString(),
              r.user_name || 'system',
              r.action,
              r.target_id,
              r.detail,
              `${r.device_type} • ${r.browser} • ${r.os}`,
              `${r.city || 'Unknown'}, ${r.country || 'Unknown'}`
          ])
      };

      if (format === 'CSV') dlReportCSV(rData);
      else if (format === 'PDF') dlReportPDF(rData);
      else if (format === 'WORD') dlReportWord(rData);

      showToast(`Audit log exported successfully in ${format} format.`, 'ok');
    } catch (e) {
      showToast('Export Failed: ' + e.message, 'danger');
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { 
    if (!hasFetched.current) {
      refreshAudit(); 
    }
  }, [refreshAudit]);

  const filtered = useMemo(() => {
    return auditLog.filter(a => {
      const q = search.toLowerCase();
      const mSearch = !search || [a.action, a.user, a.target, a.detail, a.city].some(f => f?.toLowerCase().includes(q));
      const mUser = userFilter === 'All' || a.user === userFilter;
      const mAction = actionFilter === 'All' || a.action === actionFilter;
      const mDevice = deviceFilter === 'All' || (a.device_type || 'unknown') === deviceFilter.toLowerCase();
      return mSearch && mUser && mAction && mDevice;
    });
  }, [auditLog, search, userFilter, actionFilter, deviceFilter]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
        today: auditLog.filter(a => a.ts.startsWith(today)).length,
        users: new Set(auditLog.map(a => a.user)).size,
        risk: auditLog.filter(a => a.action?.toLowerCase().includes('delete') || a.action?.toLowerCase().includes('fail')).length
    };
  }, [auditLog]);

  const users = useMemo(() => ['All', ...[...new Set(auditLog.map(a => a.user))].sort()], [auditLog]);
  const actionTypes = useMemo(() => ['All', ...[...new Set(auditLog.map(a => a.action))].sort()], [auditLog]);

  return (
    <div className='fu'>
        <ModuleHeader 
            title={<><ShieldCheck size={22} style={{verticalAlign:'middle', marginRight:10, marginTop:-4}}/> Security Audit Trail</>}
            sub="Immutable ledger of all system modifications. Showing last 10 logs initially. Download for full ledger."
            exportProps={{ onExport: handleExport }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            <KPI label="Today's Activity" value={stats.today} icon={RefreshCw} sub="+ Active" color={T.ok} />
            <KPI label="Distinct Operators" value={stats.users} icon={UserCheck} />
            <KPI label="Critical Events" value={stats.risk} icon={AlertTriangle} sub={stats.risk > 0 ? "Review Required" : "Secure"} color={stats.risk > 0 ? T.danger : T.ok} />
            <KPI label="Sync Status" value="Live" icon={Globe} sub="v4.2 Stable" />
        </div>

        <Card>
            <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap', gap: 12 }}>
                <Search value={search} onChange={setSearch} placeholder="Filter audit ledger..." style={{ maxWidth: 300 }} />
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ color: T.dim, fontSize: 11, fontWeight: 800 }}>FILTERS:</div>
                    <Pills opts={users} val={userFilter} onChange={setUserFilter} sm />
                    <RefreshBtn onClick={refreshAudit} loading={loading} sm />
                </div>
            </div>

            <div style={{ minHeight: 500 }}>
                <DT 
                    cols={[
                        { k: 'ts', l: 'Timestamp', r: v => (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: T.txt }}>{new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <span style={{ fontSize: 10, color: T.dim }}>{new Date(v).toLocaleDateString()}</span>
                            </div>
                        )},
                        { k: 'user', l: 'Operator', r: v => (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Av ini={v?.substring(0, 2).toUpperCase()} size={28} />
                                <span style={{ fontWeight: 800, color: T.txt, fontSize: 13 }}>{v}</span>
                            </div>
                        )},
                        { k: 'action', l: 'Action Event', r: (v, row) => (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 34, height: 34, borderRadius: 10, background: T.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${T.border}` }}>
                                    <ActionIcon action={v} />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 750, fontSize: 13, color: T.txt }}>{v}</div>
                                    <div style={{ fontSize: 11, color: T.dim, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.detail}</div>
                                </div>
                            </div>
                        )},
                        { k: 'device', l: 'Telemetry', r: (_, row) => (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ color: T.muted }}><DeviceIcon type={row.device_type} /></div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: 11, color: T.txt, fontWeight: 600 }}>{row.browser || 'System'} • {row.os}</span>
                                    <span style={{ fontSize: 9, color: T.dim, fontFamily: T.mono }}>{row.ip_address}</span>
                                </div>
                            </div>
                        )},
                        { k: 'loc', l: 'Location', r: (_, row) => (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.dim }}>
                                <Globe size={14} opacity={0.5} />
                                <span style={{ fontSize: 11, fontWeight: 600 }}>{row.city || 'Local'}{row.country ? `, ${row.country}` : ''}</span>
                            </div>
                        )}
                    ]}
                    rows={filtered}
                    emptyMsg="No surveillance records match your filter criteria."
                />
            </div>
        </Card>
    </div>
  );
};

export default AuditTrailTab;
