import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/config/supabaseClient';
import { Image as ImageIcon, FileText, File, Download, Maximize2, Eye, X, Loader2, FolderIcon, HardDrive } from 'lucide-react';
import { T, SC, Card, DT, Btn, Pills, Badge, FI, Alert, Dialog, CustomerEditForm, fmt, now, calculateLoanStatus, uid, useToast, fromSupabaseLoan, fromSupabaseCustomer, fromSupabasePayment, fromSupabaseInteraction, toSupabaseCustomer, toSupabaseInteraction } from '@/lms-common';

export default function CustomerProfile({ 
  customerId, workerContext, onClose, onSelectLoan, 
  loans: globalLoans, setLoans: setGlobalLoans, 
  payments: globalPayments, setPayments: setGlobalPayments, 
  interactions: globalInteractions, setInteractions: setGlobalInteractions, 
  customers, setCustomers, 
  workers: globalWorkers,
  addAudit 
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading]     = useState(false);
  const [errorMsg, setErrorMsg]   = useState(null);
  const [showEdit, setShowEdit]   = useState(false);

  // Initial populate from provided props
  const [customer, setCustomer]   = useState(() => customers?.find(x => x.id === customerId) || null);
  const [loans, setLoans]         = useState(() => globalLoans?.filter(l => l.customerId === customerId) || []);
  const [payments, setPayments]   = useState(() => globalPayments?.filter(p => p.customerId === customerId) || []);
  const [interactions, setInters] = useState(() => globalInteractions?.filter(i => i.customerId === customerId) || []);
  const [workers, setWorkers]     = useState(globalWorkers || []);



  useEffect(() => {
    let active = true;

    // ALWAYS fetch the full record from Supabase when a profile is opened.
    // The partial/cached global state (set via useState above) renders the name+phone
    // instantly while the network call runs. This fixes the bug where synthesized or
    // fast-page-loaded customer records were missing gender, location, n2/n3 NOK etc.
    // because the old early-exit guard (`customer.gender`) was preventing the fetch.
    if (!customer) setLoading(true);

    async function fetchAll() {
      try {
        setErrorMsg(null);

        // Fetch the complete customer row (SELECT * to guarantee all columns)
        const { data: cData, error: cErr } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .single();

        if (cErr) throw cErr;
        if (!cData) throw new Error('Customer not found');

        const [lRes, pRes, iRes] = await Promise.allSettled([
          supabase.from('loans').select('*').eq('customer_id', customerId),
          supabase.from('payments').select('*').eq('customer_id', customerId).order('date', { ascending: false }),
          supabase.from('interactions').select('*').eq('customer_id', customerId).order('created_at', { ascending: false }),
        ]);

        if (!active) return;

        const customerMapped = fromSupabaseCustomer(cData);
        // Keep the raw Supabase row on the mapped object so handleUpdate can
        // safely merge form changes on top of the ground-truth DB state.
        customerMapped._raw = cData;
        const currentWorkers = globalWorkers || workers || [];
        customerMapped.onboarded_by_worker = currentWorkers.find(w => w.id === cData.onboarded_by);
        customerMapped.assigned_officer_worker = currentWorkers.find(w => w.id === cData.assigned_officer);

        setCustomer(customerMapped);

        if (lRes.status === 'fulfilled' && lRes.value.data) setLoans(lRes.value.data.map(fromSupabaseLoan));
        if (pRes.status === 'fulfilled' && pRes.value.data) setPayments(pRes.value.data.map(fromSupabasePayment));
        if (iRes.status === 'fulfilled' && iRes.value.data) setInters(iRes.value.data.map(fromSupabaseInteraction));

      } catch (err) {
        if (active) setErrorMsg(err.message || 'Unknown database fetch error');
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchAll();
    return () => { active = false; };
  }, [customerId]);

  const { show: showToast } = useToast();
  const workerMap = useMemo(() => {
    const map = {};
    workers.forEach(w => map[w.id] = w.name);
    return map;
  }, [workers]);

  const handleUpdate = async (updated) => {
    try {
      // Build the DB payload from the form data.
      // We explicitly EXCLUDE created_at (server-managed) and server-only flags
      // (mpesa_registered, status) so they are never accidentally nulled out.
      const dbPayload = toSupabaseCustomer(updated);
      delete dbPayload.created_at; // server-managed — never overwrite

      const { error } = await supabase.from('customers').update(dbPayload).eq('id', customerId);
      if (error) throw error;

      // Merge the updated form data back onto the in-memory customer, preserving
      // any server-side fields (mpesaRegistered, _raw, worker references, etc.)
      // that the edit form does not touch.
      const merged = { ...customer, ...updated, _raw: customer._raw };
      setCustomer(merged);
      if (setCustomers) {
        setCustomers(prev => prev.map(c => c.id === customerId ? merged : c));
      }
      addAudit('Profile Updated', customerId, `KYC details modified`);
      showToast('Profile updated successfully', 'ok');
      setShowEdit(false);
    } catch (err) {
      showToast('Failed to update: ' + err.message, 'danger');
    }
  };

  const tabs = ['Overview', 'Loan History', 'Payment History', 'Interactions', 'Documents', 'Next of Kin'];
  // Map label to internal ID for switching
  const tabId = v => v.toLowerCase().replace(/ /g, '');


  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9900, background: 'rgba(4,8,16,0.85)', backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className='pop' style={{ background: T.card, border: `1px solid ${T.hi}`, borderRadius: 24, padding: '40px 60px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
          <div style={{ fontSize: 44, marginBottom: 20, animation: 'pulse 1s infinite' }}>👤</div>
          <div style={{ color: T.txt, fontWeight: 900, fontSize: 16, fontFamily: T.head, letterSpacing: 1 }}>ANALYZING PROFILE</div>
          <div style={{ color: T.muted, fontSize: 12, marginTop: 8, fontFamily: T.mono }}>Standardizing KYC & Financial Data...</div>
          <div style={{ width: 140, height: 4, background: T.border, borderRadius: 99, margin: '20px auto 0', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '50%', background: T.accent, borderRadius: 99, animation: 'progress 1.5s infinite ease-in-out' }} />
          </div>
        </div>
        <style>{`
          @keyframes progress { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }
        `}</style>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9900, background: T.bg, padding: 32 }}>
        <Alert type='danger'><b>Profile Fetch Error:</b> {errorMsg}</Alert>
        <Btn onClick={onClose} v='secondary'>Go Back</Btn>
      </div>
    );
  }

  // Derived Info
  const isBlacklisted = customer.blacklisted === true || customer.blacklisted === 'true';
  const totalBorrowed = loans.reduce((acc, l) => acc + Number(l.amount || 0), 0);
  
  // Calculate Live Loan Statuses using identical logic to lms-core
  const processedLoans = loans.map(l => {
    // Supabase sometimes stores mapped items differently natively
    const stub = { 
      balance: Number(l.balance || 0), 
      daysOverdue: Number(l.daysOverdue || 0), 
      status: l.status, 
      amount: Number(l.amount || 0) 
    };
    const snap = calculateLoanStatus(stub);
    return { ...l, ...snap, actualBalance: snap.totalAmountDue, totalPayable: snap.totalPayable };
  });

  const activeLoans = processedLoans.filter(l => l.status !== 'Settled' && l.status !== 'Written off');

  return (
    <div 
      className="fade ios-sheet-overlay" 
      style={{ 
        position: 'fixed', 
        inset: 0, 
        zIndex: 99000, 
        background: 'rgba(0,0,0,0.7)', 
        backdropFilter: 'blur(12px)', 
        display: 'flex', 
        alignItems: 'flex-end', // Pin to bottom like a real iOS sheet
        justifyContent: 'center' 
      }}
      onClick={onClose}
    >
      <style>{`
        .profile-container { display: flex; flex-direction: column; height: 100%; padding: 0 24px 24px; }
        .profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding-bottom: 24px; }
        .row-grouped { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--border-subtle); }
        .row-grouped:last-child { border-bottom: none; }
        @media (max-width: 800px) {
          .profile-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
        }
      `}</style>
      
      <div 
        className="ios-sheet" 
        style={{ 
          width: '100%', 
          maxWidth: 1000, 
          height: '96vh', // Increased for a 'fuller' feel
          borderBottomLeftRadius: 0, 
          borderBottomRightRadius: 0, 
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Visual Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
           <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 10 }} />
        </div>

        <div className="profile-container">
          
          {/* HEADER AREA */}
          <div style={{ padding: '8px 0 20px', borderBottom: `1px solid ${T.border}`, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <h1 style={{ color: T.txt, margin: 0, fontSize: 26, fontWeight: 900, fontFamily: T.head, letterSpacing: '-0.02em' }}>
                    {customer.name}
                  </h1>
                  {isBlacklisted ? <Badge color={T.danger}>BLACKLISTED</Badge> : <Badge color={T.ok}>ACTIVE</Badge>}
                </div>
                <div style={{ color: T.muted, fontSize: 13, marginTop: 4, fontWeight: 600 }}>
                  <span style={{ color: T.accent }}>{customer.id}</span> · {customer.idNo || 'N/A'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Btn v='gold' sm onClick={() => setShowEdit(true)}>Edit Profile</Btn>
                <div onClick={onClose} style={{ background: T.surface, color: T.txt, borderRadius: 99, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 900, border: `1px solid ${T.border}` }}>✕</div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <Pills opts={tabs} val={tabs.find(t=>tabId(t)===activeTab)} onChange={v=>setActiveTab(tabId(v))} />
          </div>

          <div style={{ 
            flex: 1, 
            overflowY: 'auto', 
            paddingRight: 4,
            minHeight: 0, // CRITICAL: allows flex child to be smaller than content and thus scroll
            WebkitOverflowScrolling: 'touch' 
          }}>
        {activeTab === 'overview' && (
          <div className="profile-grid">
            <Card style={{ padding: 24, borderRadius: 20 }}>
              <h3 style={{ color: T.accent, fontSize: 12, fontWeight: 800, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 1 }}>Identification & Origin</h3>
              <div className="grouped-list">
                <div className="row-grouped"><span style={{ color: T.dim, fontSize: 13 }}>Phone</span><span style={{ color: T.txt, fontWeight: 700 }}>{customer.phone || '—'}</span></div>
                <div className="row-grouped"><span style={{ color: T.dim, fontSize: 13 }}>Alt. Phone</span><span style={{ color: T.txt }}>{customer.altPhone || '—'}</span></div>
                <div className="row-grouped"><span style={{ color: T.dim, fontSize: 13 }}>Gender</span><span style={{ color: T.txt }}>{customer.gender || '—'}</span></div>
                <div className="row-grouped"><span style={{ color: T.dim, fontSize: 13 }}>Date Joined</span><span style={{ color: T.txt }}>{customer.joined ? new Date(customer.joined).toLocaleDateString() : '—'}</span></div>
                <div className="row-grouped"><span style={{ color: T.dim, fontSize: 13 }}>Assigned Officer</span><span style={{ color: T.txt }}>{customer.assigned_officer_worker?.name || 'Unassigned'}</span></div>
                <div className="row-grouped" style={{ border: 'none' }}>
                  <span style={{ color: T.dim, fontSize: 13 }}>Risk Scoring</span>
                  <Badge color={customer.risk === 'High' ? T.danger : customer.risk === 'Medium' ? T.warn : T.ok}>{customer.risk || 'Low'}</Badge>
                </div>
              </div>
            </Card>

            <Card style={{ padding: 24, borderRadius: 20 }}>
              <h3 style={{ color: T.accent, fontSize: 12, fontWeight: 800, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 1 }}>Business Profile</h3>
              <div className="grouped-list">
                <div className="row-grouped"><span style={{ color: T.dim, fontSize: 13 }}>Trading Name</span><span style={{ color: T.txt, fontWeight: 700 }}>{customer.businessName || '—'}</span></div>
                <div className="row-grouped"><span style={{ color: T.dim, fontSize: 13 }}>Business Category</span><span style={{ color: T.txt }}>{customer.businessType || '—'}</span></div>
                <div className="row-grouped" style={{ border: 'none' }}><span style={{ color: T.dim, fontSize: 13 }}>Premises / Location</span><span style={{ color: T.txt }}>{customer.location || '—'}</span></div>
              </div>
            </Card>

            <div style={{ gridColumn: 'span 1' }}>
              <h3 style={{ color: T.txt, fontSize: 16, fontWeight: 900, margin: '0 0 16px' }}>Active Lifetime Loans</h3>
              {activeLoans.length === 0 ? (
                <div style={{ background: T.aLo, padding: 20, borderRadius: 16, border: `1px solid ${T.accent}30`, color: T.accent, fontWeight: 700, textAlign: 'center' }}>
                   No active loans. Account is clean.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                  {activeLoans.map(l => (
                    <Card key={l.id} style={{ padding: 20, borderRadius: 24, borderLeft: `6px solid ${SC[l.phase === 'frozen' ? 'Written off' : l.phase === 'none' ? 'Active' : 'Overdue'] || T.accent}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ fontWeight: 900, color: T.txt, fontSize: 16 }}>{l.id}</div>
                        <Badge color={l.isFrozen ? T.danger : T.ok}>{l.status}</Badge>
                      </div>
                      <div style={{ fontSize: 12, color: T.dim, marginBottom: 16 }}>Disbursed: {l.disbursed || 'Pending'} · {l.repaymentType || 'Monthly'}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                          <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase' }}>Principal</div>
                          <div style={{ fontSize: 15, color: T.txt, fontWeight: 800 }}>{fmt(l.amount)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase' }}>Live Balance</div>
                          <div style={{ fontSize: 20, color: l.actualBalance > 0 ? T.warn : T.ok, fontWeight: 900 }}>{fmt(l.actualBalance)}</div>
                        </div>
                      </div>
                      {l.overdueDays > 0 && <div style={{ fontSize: 11, color: T.danger, marginTop: 12, textAlign: 'right', fontWeight: 800 }}>⚠ {l.overdueDays} DAYS OVERDUE</div>}
                    </Card>
                  ))}
                </div>
              )}
            </div>
            
            <Card style={{ padding: 24, borderRadius: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Lifetime Borrowed</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: T.txt }}>{fmt(totalBorrowed)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Total Repaid</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: T.ok }}>{fmt(payments.reduce((a, p) => a + Number(p.amount||0), 0))}</div>
                </div>
              </div>
            </Card>
          </div>
        )}


        {activeTab === 'loanhistory' && (
          <div className='dt-shell' style={{ maxHeight: '100%' }}>
            <DT cols={[
              { k: 'id', l: 'Loan ID', r: (v, row) => <span onClick={() => onSelectLoan && onSelectLoan(row)} style={{color:T.accent,fontFamily:T.mono,fontWeight:700,cursor:'pointer',borderBottom:`1px dashed ${T.accent}50`}}>{v}</span> },
              { k: 'amount', l: 'Principal', r: v => <span style={{fontFamily:T.mono}}>{fmt(v)}</span> },
              { k: 'totalPayable', l: 'Total Due', r: v => <span style={{fontFamily:T.mono,color:T.accent}}>{fmt(v)}</span> },
              { k: 'actualBalance', l: 'Remaining', r: v => <span style={{fontFamily:T.mono,color:v>0?T.warn:v<0?T.ok:T.muted,fontWeight:700}}>{fmt(v)}</span> },
              { k: 'disbursed', l: 'Disbursed', r: v => v || '—' },
              { k: 'status', l: 'Status', r: v => <Badge color={SC[v]||T.muted}>{v}</Badge> }
            ]} rows={processedLoans} />
            {processedLoans.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: T.muted }}>No loans found for this customer.</div>}
          </div>
        )}

        {activeTab === 'paymenthistory' && (
          <div className='dt-shell' style={{ maxHeight: '100%' }}>
            <DT cols={[
              { k: 'id', l: 'Receipt ID', r: v => <span style={{color:T.muted,fontFamily:T.mono,fontSize:11}}>{v}</span> },
              { k: 'amount', l: 'Amount', r: v => <span style={{color:T.ok,fontFamily:T.mono,fontWeight:700}}>{fmt(v)}</span> },
              { k: 'date', l: 'Date' },
              { k: 'mpesa', l: 'Transaction', r: v => <span style={{fontFamily:T.mono}}>{v||'Manual'}</span> },
              { k: 'loanId', l: 'Allocation Map', r: v => v ? <span style={{color:T.accent,fontFamily:T.mono,fontSize:11}}>{v}</span> : 'Unallocated' }
            ]} rows={payments} />
            {payments.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: T.muted }}>No payments recorded.</div>}
          </div>
        )}

        {activeTab === 'interactions' && (
          <InteractionsTab customerId={customerId} initialRecords={interactions} workerContext={workerContext} setGlobalInteractions={setGlobalInteractions} addAudit={addAudit} workerMap={workerMap} />
        )}

        {activeTab === 'documents' && (
          <DocumentsTab customerId={customerId} />
        )}

        {activeTab === 'nextofkin' && (
          <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
             {[
               { n: 1, name: customer.n1n, phone: customer.n1p, rel: customer.n1r },
               { n: 2, name: customer.n2n, phone: customer.n2p, rel: customer.n2r },
               { n: 3, name: customer.n3n, phone: customer.n3p, rel: customer.n3r }
             ].map(nok => nok.name && (
               <Card key={nok.n} style={{ padding: 24 }}>
                  <h3 style={{ color: T.accent, fontSize: 13, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: 1 }}>{nok.n === 1 ? 'Primary' : nok.n === 2 ? 'Secondary' : 'Tertiary'} Next of Kin</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(100px, auto) 1fr', gap: '12px 24px', fontSize: 13 }}>
                    <span style={{ color: T.muted }}>Name</span><span style={{ color: T.txt, fontWeight: 600 }}>{nok.name}</span>
                    <span style={{ color: T.muted }}>Relation</span><span style={{ color: T.txt }}>{nok.rel}</span>
                    <span style={{ color: T.muted }}>Phone</span><span style={{ color: T.txt }}>{nok.phone || '—'}</span>
                  </div>
               </Card>
             ))}
             {!customer.n1n && <Alert type='warn'>No Next of Kin registered on file.</Alert>}
          </div>
        )}
          </div>
        </div>
      </div>

      {showEdit && (
        <CustomerEditForm customer={customer} workers={workers} allCustomers={customers} onSave={handleUpdate} onClose={() => setShowEdit(false)} />
      )}
    </div>
  );
}

// =========================================================
// INTERACTIONS SUB-COMPONENT
// =========================================================
function InteractionsTab({ customerId, initialRecords, workerContext, setGlobalInteractions, addAudit, workerMap }) {
  const [logs, setLogs] = useState(initialRecords);
  const [f, setF] = useState({ type: 'Phone Call', notes: '', date: now() });
  const [saving, setSaving] = useState(false);
  const { show } = useToast();

  const handleSave = async () => {
    if (!f.notes) { show('Notes required', 'warn'); return; }
    try {
      setSaving(true);
      const interactionId = uid('LOG');
      const nowTs = new Date().toISOString();
      const interactionObj = {
        id: interactionId,
        customerId: customerId,
        type: f.type,
        notes: f.notes,
        date: f.date || now(),
        created_at: nowTs,
        officer: workerContext?.name || 'Self',
      };

      const entry = toSupabaseInteraction(interactionObj);
      const { error } = await supabase.from('interactions').insert([entry]);
      if (error) throw error;
      
      show('Interaction logged!', 'ok');
      const interactionFull = fromSupabaseInteraction({...entry, created_at: nowTs});
      if (!interactionFull.officer) interactionFull.officer = interactionObj.officer;
      
      setLogs([interactionFull, ...logs]);
      if (setGlobalInteractions) setGlobalInteractions(prev => [interactionFull, ...prev]);
      if (addAudit) addAudit('Interaction Logged', customerId, `Logged ${f.type}`);
      setF({ type: 'Phone Call', notes: '', date: now() });
    } catch (e) {
      show('Failed to log interaction', 'danger');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 340px) 1fr', gap: 32, paddingBottom: 64 }}>
      <div style={{ position: 'sticky', top: 0, height: 'fit-content' }}>
        <Card style={{ padding: 24, background: T.card, border: `1px solid ${T.hi}`, borderRadius: 20 }}>
          <h3 style={{ color: T.txt, fontSize: 16, fontWeight: 800, margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>✍️</span> Record Interaction
          </h3>
          <FI label="Communication Type" type="select" options={['Phone Call', 'SMS', 'WhatsApp', 'Field Visit', 'System Note', 'Demand Letter']} 
             value={f.type} onChange={v=>setF({...f, type: v})} />
          <FI label="Log Date" type="date" value={f.date} onChange={v=>setF({...f, date: v})} />
          <FI label="Notes & Outcome" type="textarea" value={f.notes} onChange={v=>setF({...f, notes: v})} placeholder="Summarize the discussion..." />
          <Btn onClick={handleSave} disabled={saving} full v='gold' style={{ height: 48, marginTop: 8 }}>+ Save to Timeline</Btn>
        </Card>
      </div>

      <div style={{ borderLeft: `2px solid ${T.border}`, paddingLeft: 32, marginLeft: 16 }}>
        {logs.length === 0 ? <Alert type='info'>No prior interactions recorded on this file.</Alert> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
             {logs.map((log, idx) => {
               const dtStr = log.created_at || log.createdAt || log.date;
               const dt = new Date(dtStr);
               // Handle the "3.00" bug by checking if the date string lacks time precision
               const day = dt.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' });
               const time = dt.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: false });
               
               return (
                 <div key={log.id} style={{ position: 'relative' }}>
                   {/* Timeline Marker */}
                   <div style={{ 
                     position: 'absolute', left: -41, top: 4, width: 16, height: 16, borderRadius: 99, 
                     background: SC[log.type] || T.blue, border: `4px solid ${T.bg}`,
                     boxShadow: `0 0 10px ${SC[log.type] || T.blue}50`, zIndex: 2 
                   }} />
                   
                   <div className="pop" style={{ animationDelay: `${idx * 0.05}s` }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: T.txt, fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>{log.type}</span>
                          <span style={{ width: 4, height: 4, borderRadius: 2, background: T.muted }} />
                          <span style={{ color: T.accent, fontSize: 11, fontWeight: 700, fontFamily: T.mono }}>{day} • {time}</span>
                        </div>
                        <div style={{ color: T.muted, fontSize: 11, background: T.surface, padding: '2px 8px', borderRadius: 99, border: `1px solid ${T.border}` }}>
                          {log.officer || 'System'}
                        </div>
                     </div>
                     <Card style={{ padding: 18, background: T.cardHi || T.surface, border: `1px solid ${T.border}` }}>
                       <div style={{ color: T.txt, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{log.notes}</div>
                     </Card>
                   </div>
                 </div>
               );
             })}
          </div>
        )}
      </div>
    </div>
  );
}

// =========================================================
// DOCUMENTS SUB-COMPONENT
// =========================================================
function DocPreviewModal({ preview, onClose, T }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  
  return (
    <div className="dialog-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column', padding: 'clamp(12px, 4vw, 40px)', alignItems: 'center' }}>
      <div className="pop" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, width: '100%', maxWidth: 1100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
           <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
             {preview.type.startsWith('image/') ? <ImageIcon size={22} /> : <FileText size={22} />}
           </div>
           <div>
              <div style={{ color: '#fff', fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em' }}>{preview.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600 }}>{preview.type.toUpperCase()}</div>
           </div>
        </div>
        <button 
          onClick={onClose} 
          className="hover-pop"
          style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          Close <X size={18} />
        </button>
      </div>
      
      <div className="pop" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderRadius: 28, boxShadow: '0 40px 100px rgba(0,0,0,0.8)', width: '100%', maxWidth: 1100, background: '#000', position: 'relative', border: '1px solid rgba(255,255,255,0.1)' }}>
         {!imgLoaded && (
           <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', gap: 16 }}>
              <div className="spin" style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: T.accent, borderRadius: '50%' }} />
              <div style={{ color: T.dim, fontSize: 11, fontWeight: 800, letterSpacing: 1.5 }}>LOADING ASSET</div>
           </div>
         )}
         {preview.type.startsWith('image/') ? (
           <img 
              src={preview.url} 
              alt={preview.name} 
              onLoad={() => setImgLoaded(true)}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.4s ease' }} 
           />
         ) : (
           <iframe 
              src={preview.url} 
              title={preview.name} 
              onLoad={() => setImgLoaded(true)}
              style={{ width: '100%', height: '100%', border: 'none', background: '#fff', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.4s ease' }} 
           />
         )}
      </div>
    </div>
  );
}

function DocumentsTab({ customerId }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null); // { url, name, type }
  const { show } = useToast();

  const loadDocs = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.storage.from('documents').list(customerId);
      if (error) { 
        if(error.message.includes('Bucket not found')) throw new Error('Storage bucket "documents" does not exist yet.');
        throw error; 
      }
      setDocs(data || []);
    } catch(e) {
      console.error(e);
      show(e.message, 'danger');
    } finally {
      setLoading(false);
    }
  }, [customerId, show]);

  useEffect(() => { loadDocs(); }, [customerId, loadDocs]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      show('Uploading...', 'info');
      const ext = file.name.split('.').pop();
      const filename = `${Date.now()}_doc.${ext}`;
      const path = `${customerId}/${filename}`;

      const { error } = await supabase.storage.from('documents').upload(path, file);
      if (error) throw error;
      
      show('Uploaded successfully!', 'ok');
      await loadDocs();
    } catch (err) {
      show(err.message, 'danger');
    }
  };

  const handleDownload = async (filename) => {
    try {
      const { data, error } = await supabase.storage.from('documents').download(`${customerId}/${filename}`);
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
    } catch(e) {
      show('Download failed', 'danger');
    }
  };

  const handlePreview = async (filename) => {
    try {
      show('Fetching preview...', 'info');
      const { data, error } = await supabase.storage.from('documents').download(`${customerId}/${filename}`);
      if (error) throw error;
      
      const type = data.type; // MIME type from blob
      const url = URL.createObjectURL(data);
      setPreview({ url, name: filename, type });
    } catch(e) {
      show('Preview failed', 'danger');
    }
  };

  const handleOpen = async (filename) => {
    // Consolidated 'Open' into the in-app preview modal per user request
    handlePreview(filename);
  };

  const closePreview = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ color: T.txt, fontSize: 15, margin: 0 }}>Customer KYC Documents</h3>
        <label style={{ background: T.accent, color: '#000', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
          + Upload File
          <input type="file" style={{ display: 'none' }} onChange={handleUpload} accept="image/*,.pdf" />
        </label>
      </div>

      {loading ? <div style={{ color: T.muted }}>Loading documents...</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {docs.length === 0 && <span style={{ color: T.muted }}>No documents uploaded.</span>}
          {docs.map(doc => {
            const isImg = doc.name.match(/\.(jpg|jpeg|png|gif|webp)$/i);
            const isPdf = doc.name.match(/\.(pdf)$/i);
            
            return (
              <Card key={doc.id} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, background: T.card, border: `1px solid ${T.border}`, transition: 'transform 0.2s, border-color 0.2s' }}>
                <div style={{ height: 130, background: T.surface, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: `1px solid ${T.border}`, color: T.muted }}>
                   {isImg ? <ImageIcon size={32} opacity={0.6} /> : isPdf ? <FileText size={32} opacity={0.6} /> : <File size={32} opacity={0.6} />}
                </div>
                <div style={{ padding: '0 4px' }}>
                  <div style={{ color: T.txt, fontWeight: 700, fontSize: 13, wordBreak: 'break-all', marginBottom: 2 }}>{doc.name}</div>
                  <div style={{ color: T.dim, fontSize: 11, fontWeight: 600 }}>{(doc.metadata?.size / 1024).toFixed(1)} KB</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                   {(isImg || isPdf) && <Btn onClick={() => handlePreview(doc.name)} sm v='gold' icon={Eye}>View</Btn>}
                   <Btn onClick={() => handleOpen(doc.name)} sm v='secondary' icon={Maximize2}>Open</Btn>
                   <Btn onClick={() => handleDownload(doc.name)} sm v='secondary' icon={Download}>Save</Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {preview && <DocPreviewModal preview={preview} onClose={closePreview} T={T} />}
    </div>
  );
}