import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/config/supabaseClient';
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
    
    // If the required data is already properly passed via global context,
    // skip the blocking network fetch entirely to render instantly!
    if (customer && customers?.length > 0 && globalLoans && globalPayments) {
        setLoading(false);
        return;
    }

    if (!customer) setLoading(true);

    async function fetchAll() {
      try {
        setErrorMsg(null);
        
        // 1. Fetch Profile/Sync
        const { data: cData, error: cErr } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .single();

        if (cErr) throw cErr;
        if (!cData) throw new Error("Customer not found");

        const [lRes, pRes, iRes] = await Promise.allSettled([
          supabase.from('loans').select('*').eq('customer_id', customerId),
          supabase.from('payments').select('*').eq('customer_id', customerId).order('date', { ascending: false }),
          supabase.from('interactions').select('*').eq('customer_id', customerId).order('created_at', { ascending: false }),
        ]);

        if (!active) return;
        
        const customerMapped = fromSupabaseCustomer(cData);
        // Link to already available workers from props first, then update local list if search fails
        const currentWorkers = globalWorkers || workers || [];
        customerMapped.onboarded_by_worker = currentWorkers.find(w => w.id === cData.onboarded_by);
        customerMapped.assigned_officer_worker = currentWorkers.find(w => w.id === cData.assigned_officer);

        setCustomer(customerMapped);
        
        // Use fetched data if possible, data might have changed since global fetch
        if (lRes.status === 'fulfilled' && lRes.value.data) setLoans(lRes.value.data.map(fromSupabaseLoan));
        if (pRes.status === 'fulfilled' && pRes.value.data) setPayments(pRes.value.data.map(fromSupabasePayment));
        if (iRes.status === 'fulfilled' && iRes.value.data) setInters(iRes.value.data.map(fromSupabaseInteraction));

      } catch (err) {
        if(active) setErrorMsg(err.message || 'Unknown database fetch error');
      } finally {
        if(active) setLoading(false);
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
      const { error } = await supabase.from('customers').update(toSupabaseCustomer(updated)).eq('id', customerId);
      if (error) throw error;
      
      setCustomer(updated);
      if (setCustomers) {
        setCustomers(prev => prev.map(c => c.id === customerId ? updated : c));
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
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99000, background: T.bg, padding: 0, overflowY: 'auto' }}>
      <div style={{ width: '100%', minHeight: '100%', padding: '24px 40px', display: 'flex', flexDirection: 'column' }}>
        
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Btn onClick={onClose} v='secondary' sm>❮ Back</Btn>
          <div>
            <h1 style={{ color: T.txt, margin: 0, fontSize: 24, fontFamily: T.head, display: 'flex', alignItems: 'center', gap: 12 }}>
              {customer.name}
              {isBlacklisted ? <Badge color={T.danger}>BLACKLISTED</Badge> : <Badge color={T.ok}>ACTIVE</Badge>}
            </h1>
            <div style={{ color: T.muted, fontSize: 13, marginTop: 4, fontFamily: T.mono }}>ID: {customer.id} · NID: {customer.idNo || 'N/A'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {isBlacklisted && <div style={{ color: T.danger, fontWeight: 700, fontSize: 13, padding: 12 }}>Lending Prohibited</div>}
          <Btn v='gold' onClick={() => setShowEdit(true)}>Edit Profile</Btn>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <Pills opts={tabs} val={tabs.find(t=>tabId(t)===activeTab)} onChange={v=>setActiveTab(tabId(v))} />
      </div>

      <div style={{ flex: '1 1 auto' }}>
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, paddingBottom: 64 }}>
            <Card style={{ padding: 24 }}>
              <h3 style={{ color: T.txt, fontSize: 15, margin: '0 0 16px', borderBottom: `1px solid ${T.border}`, paddingBottom: 12 }}>Customer Details</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, auto) 1fr', gap: '12px 24px', fontSize: 13 }}>
                <span style={{ color: T.muted }}>Phone</span><span style={{ color: T.txt, fontWeight: 600 }}>{customer.phone || '—'}</span>
                <span style={{ color: T.muted }}>Alt. Phone</span><span style={{ color: T.txt, fontWeight: 600 }}>{customer.altPhone || '—'}</span>
                <span style={{ color: T.muted }}>Gender</span><span style={{ color: T.txt }}>{customer.gender || '—'}</span>
                <span style={{ color: T.muted }}>Joined</span><span style={{ color: T.txt }}>{customer.joined ? new Date(customer.joined).toLocaleDateString() : '—'}</span>
                <span style={{ color: T.muted }}>Risk Segment</span>
                <span>
                   <Badge color={customer.risk === 'High' ? T.danger : customer.risk === 'Medium' ? T.warn : T.ok}>{customer.risk || 'Low'}</Badge>
                </span>
                <span style={{ color: T.muted }}>Assigned Officer</span><span style={{ color: T.txt }}>{customer.assigned_officer_worker?.name || 'Unassigned'}</span>
              </div>
            </Card>

            <Card style={{ padding: 24 }}>
              <h3 style={{ color: T.txt, fontSize: 15, margin: '0 0 16px', borderBottom: `1px solid ${T.border}`, paddingBottom: 12 }}>Business Information</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, auto) 1fr', gap: '12px 24px', fontSize: 13 }}>
                <span style={{ color: T.muted }}>Business Name</span><span style={{ color: T.txt, fontWeight: 600 }}>{customer.businessName || '—'}</span>
                <span style={{ color: T.muted }}>Business Type</span><span style={{ color: T.txt }}>{customer.businessType || '—'}</span>
                <span style={{ color: T.muted }}>Location</span><span style={{ color: T.txt }}>{customer.location || '—'}</span>
              </div>
            </Card>

            <Card style={{ padding: 24 }}>
              <h3 style={{ color: T.txt, fontSize: 15, margin: '0 0 16px', borderBottom: `1px solid ${T.border}`, paddingBottom: 12 }}>Primary Next of Kin</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, auto) 1fr', gap: '12px 24px', fontSize: 13 }}>
                <span style={{ color: T.muted }}>Name</span><span style={{ color: T.txt, fontWeight: 600 }}>{customer.n1n || '—'}</span>
                <span style={{ color: T.muted }}>Relationship</span><span style={{ color: T.txt }}>{customer.n1r || '—'}</span>
                <span style={{ color: T.muted }}>Phone</span><span style={{ color: T.txt }}>{customer.n1p || '—'}</span>
              </div>
            </Card>
            
            <div style={{ gridColumn: 'span 2' }}>
              <h3 style={{ color: T.txt, fontSize: 15, margin: '0 0 16px' }}>Active Lifetime Loans</h3>
              {activeLoans.length === 0 ? (
                <Alert type='ok'>No active loans. Customer is clean.</Alert>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                  {activeLoans.map(l => (
                    <Card key={l.id} style={{ padding: 20, borderLeft: `4px solid ${SC[l.phase === 'frozen' ? 'Written off' : l.phase === 'none' ? 'Active' : 'Overdue'] || T.accent}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ fontWeight: 700, color: T.txt }}>{l.id}</div>
                        <Badge color={l.isFrozen ? T.danger : T.ok}>{l.status}</Badge>
                      </div>
                      <div style={{ fontSize: 12, color: T.dim, marginBottom: 12 }}>Disbursed: {l.disbursed || 'Pending'} · {l.repaymentType || 'Monthly'}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                          <div style={{ fontSize: 11, color: T.muted }}>Principal</div>
                          <div style={{ fontSize: 14, color: T.txt, fontFamily: T.mono }}>{fmt(l.amount)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, color: T.muted }}>Live Balance</div>
                          <div style={{ fontSize: 18, color: l.actualBalance > 0 ? T.warn : T.ok, fontFamily: T.mono, fontWeight: 700 }}>{fmt(l.actualBalance)}</div>
                        </div>
                      </div>
                      {l.overdueDays > 0 && <div style={{ fontSize: 11, color: T.danger, marginTop: 8, textAlign: 'right' }}>⚠ {l.overdueDays} days overdue</div>}
                    </Card>
                  ))}
                </div>
              )}
            </div>
            
            <Card style={{ gridColumn: 'span 2', padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 12, color: T.muted, textTransform: 'uppercase' }}>Total Borrowed (Lifetime)</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: T.txt, fontFamily: T.mono }}>{fmt(totalBorrowed)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: T.muted, textTransform: 'uppercase' }}>Total Paid</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: T.ok, fontFamily: T.mono }}>{fmt(payments.reduce((a, p) => a + Number(p.amount||0), 0))}</div>
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

      {showEdit && (
        <CustomerEditForm customer={customer} workers={workers} onSave={handleUpdate} onClose={() => setShowEdit(false)} />
      )}
      </div>
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
    try {
      show('Opening document...', 'info');
      const { data, error } = await supabase.storage.from('documents').download(`${customerId}/${filename}`);
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      window.open(url, '_blank');
    } catch(e) {
      show('Failed to open', 'danger');
    }
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
              <Card key={doc.id} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, background: T.cardHi }}>
                <div style={{ height: 120, background: T.bg, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, overflow: 'hidden' }}>
                   {isImg ? "🖼️" : isPdf ? "📄" : "📁"}
                </div>
                <div>
                  <div style={{ color: T.txt, fontWeight: 600, fontSize: 13, wordBreak: 'break-all', marginBottom: 4 }}>{doc.name}</div>
                  <div style={{ color: T.muted, fontSize: 11 }}>{(doc.metadata?.size / 1024).toFixed(1)} KB</div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                   {(isImg || isPdf) && <Btn onClick={() => handlePreview(doc.name)} sm v='gold' style={{ flex: '1 1 60px' }}>View</Btn>}
                   <Btn onClick={() => handleOpen(doc.name)} sm v='secondary' style={{ flex: '1 1 60px' }}>Open</Btn>
                   <Btn onClick={() => handleDownload(doc.name)} sm v='secondary' style={{ flex: '1 1 60px' }}>⤓ Save</Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {preview && (
        <div className="dialog-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)', display: 'flex', flexDirection: 'column', padding: 24, alignItems: 'center' }}>
          <div className="pop" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, width: '100%', maxWidth: 1000 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
               <div style={{ width: 40, height: 40, borderRadius: 10, background: T.hi, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                 {preview.type.startsWith('image/') ? '🖼️' : '📄'}
               </div>
               <div>
                  <div style={{ color: '#fff', fontSize: 16, fontWeight: 800 }}>{preview.name}</div>
                  <div style={{ color: T.muted, fontSize: 12 }}>{preview.type}</div>
               </div>
            </div>
            <Btn onClick={closePreview} v='secondary' style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none' }}>Close Preview ×</Btn>
          </div>
          <div className="pop" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderRadius: 24, boxShadow: '0 30px 60px rgba(0,0,0,0.7)', width: '100%', maxWidth: 1000, background: T.bg }}>
             {preview.type.startsWith('image/') ? (
               <img src={preview.url} alt={preview.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
             ) : (
               <iframe src={preview.url} title={preview.name} style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} />
             )}
          </div>
        </div>
      )}
    </div>
  );
}