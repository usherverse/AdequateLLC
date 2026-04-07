import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Smartphone, Tablet, Monitor, Lock, Hourglass, RefreshCw, Globe } from 'lucide-react';
import { T, Card, CH, DT, Badge, Search, Pills, RefreshBtn, useToast } from '@/lms-common';

const DeviceIcon = ({ type }) => {
  if (type === 'mobile') return <span title="Mobile" style={{display:'flex'}}><Smartphone size={16}/></span>;
  if (type === 'tablet') return <span title="Tablet" style={{display:'flex'}}><Tablet size={16}/></span>;
  if (type === 'desktop') return <span title="Desktop" style={{display:'flex'}}><Monitor size={16}/></span>;
  return <span title="Unknown Device" style={{display:'flex', opacity: 0.5}}><Monitor size={16}/></span>;
};

// Pastel colors based on session/user IP to make rows distinct
const getRowColor = (ip) => {
  if (!ip) return 'transparent';
  let hash = 0;
  for (let i = 0; i < ip.length; i++) hash = ip.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 97%)`; // Very light pastel
};

const AuditTrailTab = ({ allState, setAuditLog }) => {
  const { auditLog = [] } = allState;
  const { show: showToast } = useToast();
  
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('All');
  const [deviceFilter, setDeviceFilter] = useState('All');
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  const refreshAudit = useCallback(async () => {
    setLoading(true);
    try {
      const { supabase, DEMO_MODE } = await import('@/config/supabaseClient');
      if (DEMO_MODE || !supabase) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('ts', { ascending: false })
        .limit(500);

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
        setLastSync(new Date());
        showToast(`Audit trail synced — ${data.length} records loaded`, 'ok');
      }
    } catch (e) {
      showToast('Failed to refresh audit trail: ' + e.message, 'error');
    }
    setLoading(false);
  }, [setAuditLog, showToast]);

  // Auto-fetch from Supabase on mount so cross-device logs are always visible
  // even if React state was empty when the session was first restored.
  useEffect(() => {
    refreshAudit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredAudit = useMemo(() => {
    return auditLog.filter(a => {
      const q = search.toLowerCase();
      const matchesSearch = !search || 
        a.action?.toLowerCase().includes(q) || 
        a.user?.toLowerCase().includes(q) || 
        a.target?.toLowerCase().includes(q) || 
        a.detail?.toLowerCase().includes(q) ||
        a.browser?.toLowerCase().includes(q) ||
        a.city?.toLowerCase().includes(q);
      const matchesUser = userFilter === 'All' || a.user === userFilter;
      const matchesAction = actionFilter === 'All' || a.action === actionFilter;
      const matchesDevice = deviceFilter === 'All' || (a.device_type || 'unknown') === deviceFilter.toLowerCase();
      return matchesSearch && matchesUser && matchesAction && matchesDevice;
    });
  }, [auditLog, search, userFilter, actionFilter, deviceFilter]);

  const users = useMemo(() => [...new Set(auditLog.map(a => a.user))].sort(), [auditLog]);
  const actions = useMemo(() => [...new Set(auditLog.map(a => a.action))].sort(), [auditLog]);
  const devices = ['All', 'Desktop', 'Mobile', 'Tablet'];

  return (
    <div className='fu'>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4,flexWrap:'wrap',gap:8}}>
        <div>
          <div style={{fontFamily:T.head,color:T.txt,fontSize:20,fontWeight:800,display:'flex',alignItems:'center',gap:8}}><Lock size={20}/> System Audit Trail</div>
          <div style={{color:T.muted,fontSize:13,marginTop:2}}>Comprehensive log of all user activities and system events</div>
        </div>
      </div>
      <div style={{marginBottom:16}}/>
      
      <Card>
        <CH title='Activity Log' sub='Real-time surveillance of system modifications' 
            right={
              <div style={{display:'flex',gap:8}}>
                <button 
                  onClick={refreshAudit} 
                  disabled={loading}
                  style={{
                    background: T.surface, 
                    border: `1px solid ${T.border}`, 
                    borderRadius: 8, 
                    padding: '6px 12px',
                    fontSize: 12, 
                    fontWeight: 600, 
                    color: T.accent, 
                    cursor: loading ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                  {loading ? <><Hourglass size={14}/> Refreshing...</> : <><RefreshCw size={14}/> Live Fetch</>}
                </button>
              </div>
            }/>
        
        <div style={{padding:'16px 18px', borderBottom:`1px solid ${T.border}`, background:T.card2, display:'flex', gap:10, flexWrap:'wrap', alignItems:'center'}}>
          <Search value={search} onChange={setSearch} placeholder='Search activity...' />
          
          <div style={{display:'flex', alignItems:'center', gap:6}}>
            <span style={{fontSize:11, color:T.muted, fontWeight:700, textTransform:'uppercase'}}>User:</span>
            <Pills opts={['All', ...users]} val={userFilter} onChange={setUserFilter} />
          </div>
          
          <div style={{display:'flex', alignItems:'center', gap:6}}>
            <span style={{fontSize:11, color:T.muted, fontWeight:700, textTransform:'uppercase'}}>Action:</span>
            <Pills opts={['All', ...actions]} val={actionFilter} onChange={setActionFilter} />
          </div>

          <div style={{display:'flex', alignItems:'center', gap:6}}>
            <span style={{fontSize:11, color:T.muted, fontWeight:700, textTransform:'uppercase'}}>Device:</span>
            <Pills opts={devices} val={deviceFilter} onChange={setDeviceFilter} />
          </div>
        </div>

        <div style={{minHeight:400}}>
          <DT 
            cols={[
              {k:'ts', l:'Time', r: v => <span style={{fontSize:11, color:T.muted, whiteSpace: 'nowrap'}}>{new Date(v).toLocaleString()}</span>},
              {k:'user', l:'User', r: v => <Badge color={v==='admin'?T.accent:T.blue}>{v}</Badge>},
              {k:'device', l:'Device', r: (_, row) => (
                <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                   <DeviceIcon type={row.device_type} />
                   <div style={{display: 'flex', flexDirection: 'column'}}>
                     <span style={{fontSize: 11, fontWeight: 700, color: T.txt}}>{row.browser || 'System'}</span>
                     <span style={{fontSize: 10, color: T.dim}}>{row.os || 'Background'}</span>
                   </div>
                </div>
              )},
              {k:'location', l:'Location', r: (_, row) => (
                <div style={{display: 'flex', flexDirection: 'column'}}>
                  <span style={{fontSize: 11, color: T.txt, fontWeight: 600}}>
                    {row.city ? `${row.city}, ` : ''}{row.country ? <span style={{display:'inline-flex',alignItems:'center',gap:4}}><Globe size={12}/> {row.country}</span> : '—'}
                  </span>
                  <span style={{fontSize: 9, color: T.muted, fontFamily: T.mono}} title="IP Address">{row.ip_address || ''}</span>
                </div>
              )},
              {k:'action', l:'Action', r: v => <span style={{fontWeight:700, fontSize:12, color:T.txt}}>{v}</span>},
              {k:'target', l:'Target', r: v => <span style={{fontFamily:T.mono, fontSize:11, color:T.muted}}>{v}</span>},
              {k:'detail', l:'Details', r: v => <div style={{fontSize:11, color:T.dim, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}} title={v}>{v}</div>}
            ]}
            rows={filteredAudit.map((r) => ({...r, _rowStyle: { background: getRowColor(r.ip_address) }}))}
            emptyMsg="No matches found for the current activity filters."
          />
        </div>
      </Card>
    </div>
  );
};

export default AuditTrailTab;
