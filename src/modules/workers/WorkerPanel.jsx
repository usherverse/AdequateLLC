import React, { useState } from 'react';
import { IdCard, FileImage, FileText, CheckCircle, AlertTriangle, User, Target, TrendingUp, Lock, Paperclip, ClipboardList, Check, Square, Hourglass } from 'lucide-react';
import { 
  T, SC, RC, SFX, Card, CH, KPI, DT, Btn, Badge, Av, 
  Dialog, Alert, LoanForm, DocViewer,
  fmt, fmtM, now, uid, ts 
} from '@/lms-common';
import ALeads from '@/modules/leads/LeadsTab';

const WorkerPanel = ({
  worker,
  workers,
  setWorkers,
  loans,
  payments,
  customers,
  leads,
  allWorkers,
  setCustomers,
  onSubmitLoan,
  setLeads,
  interactions,
  setInteractions,
  addAudit,
  showToast = () => {}
}) => {
  const [tab, setTab] = useState('overview');
  const [showLoanApp, setShowLoanApp] = useState(false);
  const [viewDoc, setViewDoc] = useState(null);

  // Local copy of this worker's docs — synced back to global workers state on change
  const [myDocs, setMyDocs] = useState(() => (workers || []).find(w => w.id === worker.id)?.docs || worker.docs || []);
  
  const myL = loans.filter(l => l.officer === worker.name);
  const myC = customers.filter(c => c.officer === worker.name);
  const myLeads = (leads || []).filter(l => l.officer === worker.name);
  const ov = myL.filter(l => l.status === 'Overdue');
  const act = myL.filter(l => l.status === 'Active');
  const book = myL.filter(l => l.status !== 'Settled').reduce((s, l) => s + l.balance, 0);
  const pendingMine = myL.filter(l => l.status === 'worker-pending');

  const WORKER_SELF_DOC_SLOTS = [
    { key: 'id_front', label: 'National ID — Front', icon: <IdCard size={16} />, required: true, accept: 'image/*', capture: 'environment' },
    { key: 'id_back', label: 'National ID — Back', icon: <IdCard size={16} />, required: true, accept: 'image/*', capture: 'environment' },
    { key: 'passport', label: 'Passport Photo', icon: <FileImage size={16} />, required: true, accept: 'image/*', capture: 'user' },
    { key: 'extra_1', label: 'Additional Document', icon: <FileText size={16} />, required: false, accept: 'image/*,application/pdf', capture: undefined },
    { key: 'extra_2', label: 'Additional Document 2', icon: <FileText size={16} />, required: false, accept: 'image/*,application/pdf', capture: undefined },
  ];

  const handleDocAdd = (doc) => {
    const next = [...myDocs.filter(d => d.key !== doc.key), doc];
    setMyDocs(next);
    if (setWorkers) setWorkers(ws => ws.map(w => w.id === worker.id ? { ...w, docs: next } : w));
    addAudit('Worker Doc Uploaded', worker.id, doc.name);
    showToast(`✅ ${doc.name} uploaded`, 'ok');
    try { SFX.upload(); } catch (e) { }
  };

  const handleDocRemove = (docId) => {
    const next = myDocs.filter(d => d.id !== docId);
    setMyDocs(next);
    if (setWorkers) setWorkers(ws => ws.map(w => w.id === worker.id ? { ...w, docs: next } : w));
    showToast('Document removed', 'info');
  };

  const uploadedCount = WORKER_SELF_DOC_SLOTS.filter(s => myDocs.some(d => d.key === s.key)).length;
  const requiredCount = WORKER_SELF_DOC_SLOTS.filter(s => s.required).length;
  const requiredDone = WORKER_SELF_DOC_SLOTS.filter(s => s.required && myDocs.some(d => d.key === s.key)).length;
  const docsComplete = requiredDone >= requiredCount;

  const TABS = [
    { k: 'overview', l: 'Overview' },
    { k: 'loans', l: `Loans (${myL.length})` },
    { k: 'customers', l: `Customers (${myC.length})` },
    { k: 'leads', l: `Leads (${myLeads.length})` },
    { k: 'documents', l: `My Documents${requiredDone < requiredCount ? ' ⚠' : ''}`, alert: requiredDone < requiredCount },
  ];

  const switchTab = (k) => { setTab(k); addAudit('Worker View', k, `${worker.name} viewed ${k}`); };


  return (
    <div style={{ padding: '16px 18px', background: T.bg, minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Av ini={worker.avatar || worker.name[0]} size={42} color={T.accent} />
          <div>
            <div style={{ fontFamily: T.head, color: T.txt, fontSize: 18, fontWeight: 800 }}>{worker.name}</div>
            <div style={{ color: T.muted, fontSize: 13 }}>{worker.role}</div>
          </div>
        </div>
        <Btn onClick={() => {
          if (!docsComplete) { showToast('⚠ Upload all required documents before applying for a loan.', 'warn'); setTab('documents'); return; }
          setShowLoanApp(true);
        }} v={docsComplete ? 'primary' : 'secondary'}>
          <span style={{display:'flex', alignItems:'center', gap:6}}><FileText size={16} /> Apply Loan for Client{!docsComplete && <Lock size={14} />}</span>
        </Btn>
      </div>

      {!docsComplete && (
        <div style={{ background: T.dLo, border: `1px solid ${T.danger}38`, borderRadius: 11, padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20, display: 'flex' }}><Lock size={20} color={T.danger} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ color: T.danger, fontWeight: 800, fontSize: 13 }}>Documents Incomplete</div>
            <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>
              Upload your required ID documents before adding leads or applying for loans.
              {' '}<button onClick={() => setTab('documents')} style={{ background: 'none', border: 'none', color: T.accent, cursor: 'pointer', fontWeight: 700, fontSize: 12, padding: 0, textDecoration: 'underline' }}>Go to Documents →</button>
            </div>
          </div>
          <Badge color={T.danger}>{requiredCount - requiredDone} missing</Badge>
        </div>
      )}
      {pendingMine.length > 0 && (
        <div style={{ background: T.gLo, border: `1px solid ${T.gold}38`, borderRadius: 11, padding: '11px 14px', marginBottom: 16 }}>
          <div style={{ color: T.gold, fontWeight: 700, fontSize: 13, display:'flex', alignItems:'center', gap:6 }}><Hourglass size={14} /> {pendingMine.length} application{pendingMine.length > 1 ? 's' : ''} pending admin approval</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 5, marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => switchTab(t.k)} style={{ background: tab === t.k ? T.accent : T.card, color: tab === t.k ? '#060A10' : t.alert ? T.warn : T.muted, border: `1px solid ${tab === t.k ? T.accent : t.alert ? T.warn + '50' : T.border}`, borderRadius: 99, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{t.l}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div>
          <div className='kpi-row' style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <KPI label='My Loan Book' icon={TrendingUp} value={fmtM(book)} color={T.accent} delay={1} />
            <KPI label='Active Loans' icon={CheckCircle} value={act.length} color={T.ok} delay={2} />
            <KPI label='Overdue' icon={AlertTriangle} value={ov.length} color={T.danger} delay={3} />
            <KPI label='My Customers' icon={User} value={myC.length} delay={4} />
          </div>

          {(() => {
            const todayStr = now();
            const convertedToday = myLeads.filter(l => l.status === 'Onboarded' && l.date === todayStr).length;
            const newCustsToday = myC.filter(c => c.joined === todayStr).length;
            const totalToday = Math.max(convertedToday, newCustsToday);
            const TARGET = 3;
            const pct = Math.min((totalToday / TARGET) * 100, 100);
            const met = totalToday >= TARGET;
            return (
              <Card style={{ marginBottom: 12, border: `1px solid ${met ? T.ok : T.gold}38` }}>
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <div style={{ color: met ? T.ok : T.gold, fontWeight: 800, fontSize: 13, fontFamily: T.head, display:'flex', alignItems:'center', gap:6 }}><Target size={16}/> Daily Conversion Target</div>
                      <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>Goal: convert at least 3 customers today</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: met ? T.ok : T.gold, fontFamily: T.mono, fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{totalToday}<span style={{ color: T.muted, fontSize: 13 }}>/{TARGET}</span></div>
                      <div style={{ color: met ? T.ok : T.muted, fontSize: 11, marginTop: 1, display:'flex', alignItems:'center', gap:4, justifyContent:'flex-end' }}>{met ? <><Check size={12}/> Target met!</> : 'Keep going!'}</div>
                    </div>
                  </div>
                  <div style={{ height: 8, background: T.border, borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: met ? T.ok : T.gold, borderRadius: 99, transition: 'width .6s ease' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    {[1, 2, 3].map(i => (
                      <div key={i} style={{ flex: 1, minWidth: 60, background: totalToday >= i ? met ? T.oLo : T.gLo : T.surface, border: `1px solid ${totalToday >= i ? met ? T.ok : T.gold : T.border}`, borderRadius: 8, padding: '6px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 16, display:'flex', justifyContent:'center' }}>{totalToday >= i ? <CheckCircle size={16} color={met ? T.ok : T.gold}/> : <Square size={16} color={T.muted}/>}</div>
                        <div style={{ color: T.muted, fontSize: 10, marginTop: 2 }}>Customer {i}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })()}

          {ov.length > 0 && <Card>
            <CH title='My Overdue Loans' />
            <DT cols={[{ k: 'id', l: 'Loan ID', r: v => <span style={{ color: T.accent, fontFamily: T.mono, fontSize: 12 }}>{v}</span> }, { k: 'customer', l: 'Customer' }, { k: 'balance', l: 'Balance', r: v => fmt(v) }, { k: 'daysOverdue', l: 'Days', r: v => <span style={{ color: T.danger, fontWeight: 800 }}>{v}d</span> }]} rows={ov} />
          </Card>}
        </div>
      )}
      {tab === 'loans' && <Card><CH title='My Loans' /><DT cols={[{ k: 'id', l: 'ID', r: v => <span style={{ color: T.accent, fontFamily: T.mono, fontSize: 12 }}>{v}</span> }, { k: 'customer', l: 'Customer' }, { k: 'amount', l: 'Principal', r: v => fmt(v) }, { k: 'balance', l: 'Balance', r: v => fmt(v) }, { k: 'status', l: 'Status', r: v => <Badge color={SC[v] || T.muted}>{v}</Badge> }, { k: 'repaymentType', l: 'Type' }]} rows={myL} maxHeightVh={0.35} /></Card>}
      {tab === 'customers' && <Card><CH title='My Customers' /><DT cols={[{ k: 'id', l: 'ID', r: v => <span style={{ color: T.accent, fontFamily: T.mono, fontSize: 12 }}>{v}</span> }, { k: 'name', l: 'Name' }, { k: 'phone', l: 'Phone' }, { k: 'business', l: 'Business' }, { k: 'risk', l: 'Risk', r: v => <Badge color={RC[v]}>{v}</Badge> }]} rows={myC} maxHeightVh={0.35} /></Card>}
      {tab === 'leads' && (
        <div>
          {!docsComplete && (
            <div style={{ background: T.dLo, border: `1px solid ${T.danger}38`, borderRadius: 10, padding: '11px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16, display: 'flex' }}><Lock size={16} color={T.danger} /></span>
              <div style={{ color: T.danger, fontSize: 13, fontWeight: 600 }}>Upload required documents to add leads.{' '}
                <button onClick={() => setTab('documents')} style={{ background: 'none', border: 'none', color: T.accent, cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: 0, textDecoration: 'underline' }}>Go to Documents →</button>
              </div>
            </div>
          )}
          <ALeads 
            leads={myLeads} 
            setLeads={setLeads} 
            workers={allWorkers} 
            customers={customers} 
            setCustomers={setCustomers} 
            loans={loans} 
            addAudit={addAudit} 
            isWorker={true} 
            currentWorker={worker} 
            showToast={showToast}/>
        </div>
      )}

      {tab === 'documents' && (
        <div className='fu'>
          {viewDoc && <DocViewer doc={viewDoc} onClose={() => setViewDoc(null)} />}
          <Card style={{ marginBottom: 14 }}>
            <CH title={<div style={{display:'flex', alignItems:'center', gap:8}}><FileText size={18} /> My Documents</div>} sub='Upload your National ID (front & back), passport photo, and any additional documents' />
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: requiredDone < requiredCount ? T.dLo : T.oLo, border: `1px solid ${requiredDone < requiredCount ? T.danger : T.ok}38`, borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
                <span style={{ fontSize: 20, display: 'flex' }}>{requiredDone < requiredCount ? <AlertTriangle size={20} color={T.danger} /> : <CheckCircle size={20} color={T.ok}/>}</span>
                <div>
                  <div style={{ color: requiredDone < requiredCount ? T.danger : T.ok, fontWeight: 700, fontSize: 13 }}>
                    {requiredDone < requiredCount
                      ? `${requiredCount - requiredDone} required document${requiredCount - requiredDone > 1 ? 's' : ''} missing`
                      : 'All required documents uploaded'}
                  </div>
                  <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>{uploadedCount} of {WORKER_SELF_DOC_SLOTS.length} documents uploaded</div>
                </div>
                <div style={{ marginLeft: 'auto', background: T.border, borderRadius: 99, width: 44, height: 44, flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width='44' height='44' style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
                    <circle cx='22' cy='22' r='18' fill='none' stroke={T.border} strokeWidth='4' />
                    <circle cx='22' cy='22' r='18' fill='none' stroke={requiredDone < requiredCount ? T.danger : T.ok} strokeWidth='4'
                      strokeDasharray={`${2 * Math.PI * 18}`}
                      strokeDashoffset={`${2 * Math.PI * 18 * (1 - uploadedCount / WORKER_SELF_DOC_SLOTS.length)}`}
                      strokeLinecap='round'
                      style={{ transition: 'stroke-dashoffset .6s ease' }} />
                  </svg>
                  <span style={{ color: T.txt, fontSize: 10, fontWeight: 900, fontFamily: T.mono, zIndex: 1 }}>{uploadedCount}/{WORKER_SELF_DOC_SLOTS.length}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {WORKER_SELF_DOC_SLOTS.map((slot, idx) => {
                  const doc = myDocs.find(d => d.key === slot.key);
                  return (
                    <div key={slot.key} style={{ background: T.surface, border: `1.5px solid ${doc ? T.ok : slot.required ? T.danger + '40' : T.border}`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, transition: 'border-color .2s' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 99, background: doc ? T.ok : slot.required ? T.dLo : T.border, color: doc ? '#fff' : slot.required ? T.danger : T.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, flexShrink: 0 }}>
                        {doc ? <Check size={12} strokeWidth={4} /> : idx + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 16 }}>{slot.icon}</span>
                          <span style={{ color: T.txt, fontSize: 13, fontWeight: 700 }}>{slot.label}</span>
                          {slot.required
                            ? <span style={{ color: T.danger, fontSize: 11, fontWeight: 700 }}>★ Required</span>
                            : <span style={{ color: T.muted, fontSize: 11 }}>Optional</span>}
                        </div>
                        <div style={{ color: doc ? T.ok : T.muted, fontSize: 11, marginTop: 3, display:'flex', alignItems:'center', gap:4 }}>
                          {doc ? <><Check size={11} strokeWidth={3}/> Uploaded {doc.uploaded}</> : (slot.required ? 'Please upload this document' : 'Upload if available')}
                        </div>
                      </div>
                      {doc && (
                        <div onClick={() => setViewDoc(doc)} style={{ cursor: 'pointer', flexShrink: 0 }}>
                          {doc.type?.startsWith('image/')
                            ? <img src={doc.dataUrl} alt={slot.label} style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 7, border: `2px solid ${T.ok}`, boxShadow: '0 2px 8px #00000040' }} />
                            : <div style={{ width: 52, height: 52, background: T.card, borderRadius: 7, border: `2px solid ${T.ok}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}><FileText size={24} color={T.ok}/></div>
                          }
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {doc && (
                          <>
                            <button onClick={() => setViewDoc(doc)} style={{ background: T.aLo, border: `1px solid ${T.accent}38`, color: T.accent, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>View</button>
                            <button onClick={() => handleDocRemove(doc.id)} style={{ background: T.dLo, border: `1px solid ${T.danger}30`, color: T.danger, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Remove</button>
                          </>
                        )}
                        {!doc && (
                          <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, background: T.bLo, border: `1px solid ${T.blue}38`, borderRadius: 8, padding: '7px 12px', flexShrink: 0 }}>
                            <span style={{ fontSize: 14, display:'flex' }}><Paperclip size={14} color={T.blue}/></span>
                            <span style={{ color: T.blue, fontSize: 11, fontWeight: 700 }}>Upload</span>
                            <input type='file' accept={slot.accept} capture={slot.capture} style={{ display: 'none' }} onChange={e => {
                              const file = e.target.files?.[0]; if (!file) return; e.target.value = '';
                              const reader = new FileReader();
                              reader.onload = ev => handleDocAdd({ id: uid('DOC'), key: slot.key, name: slot.label, originalName: file.name, type: file.type, size: file.size, dataUrl: ev.target.result, uploaded: now() });
                              reader.readAsDataURL(file);
                            }} />
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ color: T.muted, fontSize: 11, marginTop: 14, lineHeight: 1.6, display:'flex', gap:6, alignItems:'flex-start' }}>
                <ClipboardList size={14} style={{marginTop:2, flexShrink:0}}/> 
                <div>Your documents will be reviewed by the admin. Ensure photos are clear and legible. Accepted formats: JPG, PNG, PDF.</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {showLoanApp && (
        <Dialog title={`Apply Loan — ${worker.name}`} onClose={() => setShowLoanApp(false)} width={580}>
          <Alert type='info'>You are submitting a loan application on behalf of a registered client. It will be sent to admin for approval.</Alert>
          <LoanForm
            customers={customers.filter(c => c.officer === worker.name)}
            payments={payments}
            loans={loans}
            workerMode={true}
            workerName={worker.name}
            onSave={l => {
              onSubmitLoan(l);
              setCustomers(cs => cs.map(c => c.id === l.customerId ? { ...c, loans: c.loans + 1 } : c));
              addAudit('Worker Loan Application', l.id, `${fmt(l.amount)} for ${l.customer} — pending admin approval`);
              addAudit('Loan Application Submitted', l.id, `Worker: ${worker.name} · Amount: ${fmt(l.amount)}`);
              setShowLoanApp(false);
            }}
            onClose={() => setShowLoanApp(false)}
          />
        </Dialog>
      )}
    </div>
  );
};

export default WorkerPanel;
