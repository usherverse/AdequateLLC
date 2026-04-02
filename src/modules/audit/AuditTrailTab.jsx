import React, { useState, useMemo } from 'react';
import { T, Card, CH, DT, Badge, Search, Pills, RefreshBtn } from '@/lms-common';

const AuditTrailTab = ({ allState }) => {
  const { auditLog = [] } = allState;
  
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('All');

  const filteredAudit = useMemo(() => {
    return auditLog.filter(a => {
      const q = search.toLowerCase();
      const matchesSearch = !search || 
        a.action?.toLowerCase().includes(q) || 
        a.user?.toLowerCase().includes(q) || 
        a.target?.toLowerCase().includes(q) || 
        a.detail?.toLowerCase().includes(q);
      const matchesUser = userFilter === 'All' || a.user === userFilter;
      const matchesAction = actionFilter === 'All' || a.action === actionFilter;
      return matchesSearch && matchesUser && matchesAction;
    });
  }, [auditLog, search, userFilter, actionFilter]);

  const users = useMemo(() => [...new Set(auditLog.map(a => a.user))].sort(), [auditLog]);
  const actions = useMemo(() => [...new Set(auditLog.map(a => a.action))].sort(), [auditLog]);

  return (
    <div className='fu'>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4,flexWrap:'wrap',gap:8}}>
        <div>
          <div style={{fontFamily:T.head,color:T.txt,fontSize:20,fontWeight:800}}>🔐 System Audit Trail</div>
          <div style={{color:T.muted,fontSize:13,marginTop:2}}>Comprehensive log of all user activities and system events</div>
        </div>
      </div>
      <div style={{marginBottom:16}}/>
      
      <Card>
        <CH title='Activity Log' sub='Real-time surveillance of system modifications' 
            right={<div style={{display:'flex',gap:8}}><RefreshBtn onRefresh={()=>{setSearch(''); setUserFilter('All'); setActionFilter('All');}}/></div>}/>
        
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
        </div>

        <div style={{minHeight:400}}>
          <DT 
            cols={[
              {k:'ts', l:'Time', r: v => <span style={{fontSize:11, color:T.muted}}>{v}</span>},
              {k:'user', l:'User', r: v => <Badge color={v==='admin'?T.accent:T.blue}>{v}</Badge>},
              {k:'action', l:'Action', r: v => <span style={{fontWeight:700, fontSize:13, color:T.txt}}>{v}</span>},
              {k:'target', l:'Target Entity', r: v => <span style={{fontFamily:T.mono, fontSize:12, color:T.muted}}>{v}</span>},
              {k:'detail', l:'Details', r: v => <div style={{fontSize:12, color:T.dim, maxWidth:400, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}} title={v}>{v}</div>}
            ]}
            rows={filteredAudit}
            emptyMsg="No matches found for the current activity filters."
          />
        </div>
      </Card>
    </div>
  );
};

export default AuditTrailTab;
