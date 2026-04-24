import CustomerProfile from "@/modules/customers/CustomerProfile";
import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { T, SC, RC, SFX, Card, CH, KPI, DT, Btn, Badge, Av, Bar, BackBtn, RefreshBtn,
  FI, PhoneInput, NumericInput, Search, Pills, Alert, Dialog, ConfirmDialog, ToastContainer,
  LoanModal, LoanForm, RepayTracker, DocViewer, hashPwAsync, ModuleHeader,
  fmt, fmtM, now, uid, ts, escHtml, toCSV, dlCSV, buildFullBackup,
  calculateLoanStatus,
  sbWrite, sbInsert, toSupabaseWorker,
  toSupabaseLoan, toSupabaseCustomer, toSupabasePayment, toSupabaseInteraction,
  generateLoanAgreementHTML, generateAssetListHTML, downloadLoanDoc,
  useContactPopup, useToast, useReminders, useModalLock, compressImage } from '@/lms-common';
import WorkerPanel from './WorkerPanel';
import { 
  Users, UserPlus, Target, TrendingUp, ShieldCheck, Briefcase, Phone, Mail, Calendar, Info, X, ExternalLink, 
  Image as ImageIcon, FileText, Gavel, Landmark, ShieldAlert, Activity, ShieldOff, Eye,
  CheckCircle, ArrowUpRight, FileSpreadsheet, MapPin, Hammer, AlertTriangle, RefreshCw, Check, Search as SearchIcon, User as UserIcon, Shield as ShieldIcon,
  Plus, CreditCard, Zap, Download
} from 'lucide-react';

function WorkerDocPreview({ doc, onClose, T }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="dialog-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column', padding: 'clamp(12px, 4vw, 40px)', alignItems: 'center' }}>
      <div className="pop" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, width: '100%', maxWidth: 1100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
           <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
             {doc.type?.startsWith('image/') ? <ImageIcon size={22} /> : <FileText size={22} />}
           </div>
           <div>
              <div style={{ color: '#fff', fontSize: 16, fontWeight: 800 }}>{doc.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{doc.type?.toUpperCase()}</div>
           </div>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          Close <X size={18} />
        </button>
      </div>
      <div className="pop" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderRadius: 28, boxShadow: '0 40px 100px rgba(0,0,0,0.8)', width: '100%', maxWidth: 1100, background: '#000', position: 'relative', border: '1px solid rgba(255,255,255,0.1)' }}>
         {!loaded && <div className="spin" style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: T.accent, borderRadius: '50%' }} />}
         {doc.type?.startsWith('image/') ? (
           <img src={doc.dataUrl} alt={doc.name} onLoad={() => setLoaded(true)} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', opacity: loaded ? 1 : 0, transition: 'opacity 0.4s' }} />
         ) : (
           <iframe src={doc.dataUrl} title={doc.name} onLoad={() => setLoaded(true)} style={{ width: '100%', height: '100%', border: 'none', background: '#fff', opacity: loaded ? 1 : 0 }} />
         )}
      </div>
    </div>
  );
}

const WorkersTab = ({workers,setWorkers,loans,setLoans,payments,customers,setCustomers,leads,setLeads,interactions,setInteractions,allState,targets=[],setTargets,addAudit,showToast=()=>{}, isMobile, onNav }) => {
  const {open:openContact, Popup:ContactPopup} = useContactPopup();
  const [sel, setSel] = useState(null);
  const [deductions, setDeductions] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [showAddDeduction, setShowAddDeduction] = useState(false);
  const [newDeduction, setNewDeduction] = useState({ amount: '', reason: '', month: now().slice(0, 7) });

  useEffect(() => {
    if (sel) {
      import('@/config/supabaseClient').then(({ supabase }) => {
        if(supabase) {
          // Deductions
          supabase.from('worker_deductions').select('*').eq('worker_id', sel.id).order('created_at', { ascending: false })
            .then(({ data }) => setDeductions(data || []));
          
          // Salary Payments / Transactions
          supabase.from('salary_payments').select('*').eq('worker_id', sel.id).order('created_at', { ascending: false })
            .then(({ data }) => setPayslips(data || []));
        }
      });
    }
  }, [sel]);

  const addDeduction = async () => {
    if(!newDeduction.amount || !newDeduction.reason) return;
    try {
      const { supabase } = await import('@/config/supabaseClient');
      if (!supabase) throw new Error('Supabase not initialized');
      const payload = {
        worker_id: sel.id,
        amount: parseFloat(newDeduction.amount),
        reason: newDeduction.reason,
        month: newDeduction.month
      };
      const { error } = await supabase.from('worker_deductions').insert(payload);
      if (error) throw error;
      
      setDeductions(p => [payload, ...p]);
      setShowAddDeduction(false);
      setNewDeduction({ amount: '', reason: '', month: now().slice(0, 7) });
      showToast('Deduction added', 'ok');
      addAudit('Deduction added', sel.id, `Amount: ${payload.amount}, Reason: ${payload.reason}`);
    } catch (err) {
      showToast('Failed to add deduction: ' + err.message, 'danger');
    }
  };
                  </div>
              </div>
            </Card>

            <Card style={{marginBottom:18}}>
               <CH title="M-Pesa B2C Transaction History" icon={Landmark}/>
               <div style={{padding:'0 4px 4px'}}>
                  <DT 
                    cols={[
                      {k:'month', l:'Period'},
                      {k:'amount', l:'Net Paid', r: v => <strong>{fmt(v)}</strong>},
                      {k:'mpesa_receipt', l:'M-Pesa Receipt', r: v => <span style={{fontFamily:T.mono, fontSize:11, color:T.accent}}>{v}</span>},
                      {k:'created_at', l:'Time', r: v => ts(v)},
                      {k:'id', l:'Receipt', r: (v, row) => <Btn sm v="secondary" icon={Download} onClick={() => {
                        const content = `TRANSACTION RECEIPT\n\nRecipient: ${w.name}\nPeriod: ${row.month}\nAmount: KES ${row.amount}\nReceipt: ${row.mpesa_receipt}\nPhone: ${row.recipient_phone}\nDate: ${ts(row.created_at)}\n\nThank you for your service.\nAdequate Capital LTD`;
                        const blob = new Blob([content], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `Receipt_${row.mpesa_receipt}.txt`;
                        a.click();
                      }}>Download</Btn>}
                    ]}
                    rows={payslips}
                    emptyMsg="No B2C transactions for this worker."
                  />
               </div>
            </Card>

            <Card>
               <CH title="Deductions & Adjustments" icon={ShieldOff} right={<Btn sm v="secondary" icon={Plus} onClick={() => setShowAddDeduction(true)}>Add Deduction</Btn>}/>
               <div style={{padding:'0 4px 4px'}}>
                  <DT 
                    cols={[
                      {k:'month', l:'Month'},
                      {k:'reason', l:'Description'},
                      {k:'amount', l:'Amount', r:v=>fmt(v)},
                      {k:'created_at', l:'Date', r:v=>ts(v)}
                    ]}
                    rows={deductions}
                    emptyMsg="No deductions recorded for this worker."
                  />
               </div>
            </Card>

            {showAddDeduction && (
              <Dialog title="Add Salary Deduction" onClose={() => setShowAddDeduction(false)} width={400}>
                 <div style={{padding: '0 4px'}}>
                    <div style={{marginBottom:14}}>
                       <FI label="Amount (KES)" type="number" value={newDeduction.amount} onChange={e => setNewDeduction(p => ({...p, amount: e.target.value}))} placeholder="0.00"/>
                    </div>
                    <div style={{marginBottom:14}}>
                       <FI label="Reason" value={newDeduction.reason} onChange={e => setNewDeduction(p => ({...p, reason: e.target.value}))} placeholder="e.g. Lost hardware, Cash discrepancy"/>
                    </div>
                    <div style={{marginBottom:20}}>
                       <FI label="Applicable Month" type="month" value={newDeduction.month} onChange={e => setNewDeduction(p => ({...p, month: e.target.value}))}/>
                    </div>
                    <Btn full onClick={addDeduction} disabled={!newDeduction.amount || !newDeduction.reason}>Save Deduction</Btn>
                 </div>
              </Dialog>
            )}
          </div>
        )}

        {detailTab==='compensation'&&(
          <div className="fu">
            <Card style={{marginBottom:18, borderLeft: `4px solid ${T.ok}`}}>
              <div style={{padding:20, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <div style={{display:'flex', gap:15, alignItems:'center'}}>
                    <div style={{width:50, height:50, borderRadius:12, background:T.oLo, color:T.ok, display:'flex', alignItems:'center', justifyContent:'center'}}>
                      <TrendingUp size={24}/>
                    </div>
                    <div>
                      <div style={{fontSize:18, fontWeight:800, color:T.txt}}>Salary & Performance</div>
                      <div style={{fontSize:12, color:T.muted}}>Current Month: {now().slice(0, 7)}</div>
                    </div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    {(function(){
                       const base = w.baseSalary || 0;
                       const deds = deductions.filter(d => d.month === now().slice(0, 7)).reduce((a, b) => a + (b.amount || 0), 0);
                       const net = base - deds;
                       return (
                         <>
                           <div style={{fontSize:22, fontWeight:900, color:T.ok}}>{fmt(net)}</div>
                           <div style={{fontSize:11, color:T.muted, fontWeight:700}}>ESTIMATED NET PAYOUT</div>
                         </>
                       );
                    })()}
                  </div>
              </div>
              <div style={{padding:'0 20px 20px'}}>
                  <div style={{background:T.surface, borderRadius:12, padding:15, border:`1px solid ${T.border}`}}>
                    {(function(){
                       const label = w.role === 'Collections Officer' ? 'Recovery Rate' : 'Onboarding Performance';
                       const targetsForWorker = (targets || []).filter(t => t.worker_id === w.id && t.month === now().slice(0, 7));
                       const targetVal = targetsForWorker[0]?.target || (w.onboardingTarget || 60);
                       const actual = w.role === 'Collections Officer' ? 0 : wLeads.filter(l => l.status === 'Active' && l.date?.startsWith(now().slice(0, 7))).length;
                       const rate = targetVal > 0 ? (actual / targetVal) * 100 : 0;
                       
                       const base = w.baseSalary || 0;
                       const deds = deductions.filter(d => d.month === now().slice(0, 7)).reduce((a, b) => a + (b.amount || 0), 0);
                       const net = base - deds;

                       return (
                    <>
                       <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                          <div style={{color:T.txt, fontSize:14, fontWeight:700}}>{label}</div>
                          <Btn v="primary" icon={Zap} style={{background:T.ok, color:'#000'}} onClick={async () => {
                               try {
                                 if (!w.phone) { showToast('Worker has no phone number on profile.', 'danger'); return; }
                                 const { initiateWorkerPayout } = await import('@/utils/mpesa');
                                 await initiateWorkerPayout({ worker_id: w.id, amount: Math.round(net), phone: w.phone });
                                 showToast(`🚀 B2C Payout Initiated for ${w.name}`, 'ok');
                                 setTimeout(() => {
                                   import('@/config/supabaseClient').then(({ supabase }) => {
                                      if(supabase) {
                                         supabase.from('salary_payments').select('*').eq('worker_id', w.id).order('created_at', { ascending: false })
                                           .then(({ data }) => { if(data) setPayslips(data); });
                                      }
                                   });
                                 }, 1000);
                                 if (onNav) { setTimeout(() => { onNav('paymentshub'); }, 2000); }
                               } catch (err) {
                                 showToast('Payout failed: ' + err.message, 'danger');
                               }
                             }}>Initiate B2C Payout</Btn>
                       </div>
                       <div style={{height:8, background:T.border, borderRadius:99, marginTop:12, overflow:'hidden'}}>
                          <div style={{height:'100%', background:T.accent, width: `${Math.min(rate, 100)}%`}}/>
                       </div>
                       <div style={{display:'flex', justifyContent:'space-between', marginTop:8, fontSize:11, fontWeight:700, color:T.dim}}>
                          <span>{label}: {Math.round(rate)}%</span>
                          <span>{w.role === 'Collections Officer' ? 'Step-Incentive Basis' : `Target: ${targetVal}`}</span>
                       </div>
                    </>
                       );
                    })()}
                  </div>
              </div>
            </Card>

            <Card style={{marginBottom:18}}>
               <CH title="M-Pesa B2C Transaction History" icon={Landmark}/>
               <div style={{padding:'0 4px 4px'}}>
                  <DT 
                    cols={[
                      {k:'month', l:'Period'},
                      {k:'amount', l:'Net Paid', r: v => <strong>{fmt(v)}</strong>},
                      {k:'mpesa_receipt', l:'M-Pesa Receipt', r: v => <span style={{fontFamily:T.mono, fontSize:11, color:T.accent}}>{v}</span>},
                      {k:'created_at', l:'Time', r: v => ts(v)},
                      {k:'id', l:'Receipt', r: (v, row) => <Btn sm v="secondary" icon={Download} onClick={() => {
                        const content = `TRANSACTION RECEIPT\n\nRecipient: ${w.name}\nPeriod: ${row.month}\nAmount: KES ${row.amount}\nReceipt: ${row.mpesa_receipt}\nPhone: ${row.recipient_phone}\nDate: ${ts(row.created_at)}\n\nThank you for your service.\nAdequate Capital LTD`;
                        const blob = new Blob([content], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `Receipt_${row.mpesa_receipt}.txt`;
                        a.click();
                        a.remove();
                      }}>Download</Btn>}
                    ]}
                    rows={payslips}
                    emptyMsg="No B2C transactions for this worker."
                  />
               </div>
            </Card>

            <Card>
               <CH title="Deductions & Adjustments" icon={ShieldOff} right={<Btn sm v="secondary" icon={Plus} onClick={() => setShowAddDeduction(true)}>Add Deduction</Btn>}/>
               <div style={{padding:'0 4px 4px'}}>
                  <DT 
                    cols={[
                      {k:'month', l:'Month'},
                      {k:'reason', l:'Description'},
                      {k:'amount', l:'Amount', r:v=>fmt(v)},
                      {k:'created_at', l:'Date', r:v=>ts(v)}
                    ]}
                    rows={deductions}
                    emptyMsg="No deductions recorded for this worker."
                  />
               </div>
            </Card>

            {showAddDeduction && (
              <Dialog title="Add Salary Deduction" onClose={() => setShowAddDeduction(false)} width={400}>
                 <div style={{padding: '0 4px'}}>
                    <div style={{marginBottom:14}}>
                       <FI label="Amount (KES)" type="number" value={newDeduction.amount} onChange={e => setNewDeduction(p => ({...p, amount: e.target.value}))} placeholder="0.00"/>
                    </div>
                    <div style={{marginBottom:14}}>
                       <FI label="Reason" value={newDeduction.reason} onChange={e => setNewDeduction(p => ({...p, reason: e.target.value}))} placeholder="e.g. Lost hardware, Cash discrepancy"/>
                    </div>
                    <div style={{display:'flex', gap:10, marginTop:10}}>
                       <Btn full onClick={addDeduction}>Save Deduction</Btn>
                       <Btn full v="secondary" onClick={() => setShowAddDeduction(false)}>Cancel</Btn>
                    </div>
                 </div>
              </Dialog>
            )}
          </div>
        )}


        {detailTab==='profile'&&(
          <div className="fu">

            {/* ── Personal details ─────────────── */}
            <Card style={{marginBottom:12}}>
              <CH title="Personal Information" icon={UserIcon}/>
              <div style={{padding:'10px 14px 14px'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {[
                    ['Full Name',    w.name],
                    ['Role',         w.role],
                    ['Email',        w.email||'-'],
                    ['Phone',        w.phone||'-'],
                    ['National ID',  w.idNo||'-'],
                    ['Worker ID',    w.id],
                    ['Status',       w.status],
                    ['Date Joined',  w.joined||'-'],
                  ].map(function(pair){return(
                    <div key={pair[0]} style={{background:T.surface,borderRadius:9,padding:'9px 12px'}}>
                      <div style={{color:T.muted,fontSize:10,textTransform:'uppercase',letterSpacing:.5,marginBottom:2,fontWeight:700}}>{pair[0]}</div>
                      <div style={{color:T.txt,fontWeight:600,fontSize:13}}>{pair[1]}</div>
                    </div>
                  );})}
                </div>

                <div style={{marginTop: 20, paddingTop: 20, borderTop: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', gap: 12}}>
                   <div style={{color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', marginBottom: 4}}>Administrative Controls</div>
                   <div style={{display: 'flex', gap: 10}}>
                      <Btn full v="secondary" icon={Eye} onClick={() => setDetailTab('portal')}>Inspect Worker Panel</Btn>
                      <Btn full v={w.status === 'Active' ? 'danger' : 'success'} icon={w.status === 'Active' ? ShieldOff : ShieldCheck} 
                        onClick={() => {
                          const nextStatus = w.status === 'Active' ? 'Inactive' : 'Active';
                          const next = workers.map(x => x.id === w.id ? {...x, status: nextStatus} : x);
                          setWorkers(next);
                          setSel({...w, status: nextStatus});
                          addAudit(`Worker ${nextStatus}`, w.id, `Status updated by Admin`);
                          sbWrite('workers', toSupabaseWorker({...w, status: nextStatus})).catch(console.error);
                          showToast(`Worker ${nextStatus}`, 'info');
                        }}
                      >
                        {w.status === 'Active' ? 'Deactivate Account' : 'Reactivate Account'}
                      </Btn>
                   </div>
                </div>
              </div>
            </Card>

            <Card style={{marginBottom:12}}>
               <CH title="Activity Feed" icon={Activity} sub="Recent system interactions and logs"/>
               <div style={{padding: '0 14px 14px'}}>
                  {(function(){
                     const logs = (allState?.auditLog || []).filter(l => (l.user === w.email || l.target === w.id)).slice(0, 10);
                     if(logs.length === 0) return <div style={{padding: 20, textAlign: 'center', color: T.dim, fontSize: 12}}>No recent activity found.</div>;
                     return logs.map((l, i) => (
                        <div key={i} style={{padding: '10px 0', borderBottom: i < logs.length-1 ? `1px solid ${T.border}` : 'none', display: 'flex', gap: 10}}>
                           <div style={{width: 32, height: 32, borderRadius: 8, background: T.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.accent}}>
                              <Activity size={14} />
                           </div>
                           <div style={{flex: 1}}>
                              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 2}}>
                                 <span style={{fontSize: 12, fontWeight: 800, color: T.txt}}>{l.action}</span>
                                 <span style={{fontSize: 10, color: T.dim}}>{ts(l.ts)}</span>
                              </div>
                              <div style={{fontSize: 11, color: T.muted}}>{l.detail}</div>
                           </div>
                        </div>
                     ));
                  })()}
               </div>
            </Card>

            {/* ── Role Scope & Responsibilities ──────────────── */}
            <Card style={{marginBottom:12, borderLeft: `4px solid ${T.accent}`}}>
              <CH title="Role Scope & Responsibilities" icon={Briefcase}/>
              <div style={{padding:'0 14px 14px'}}>
                {(function(){
                  const role = w.role;
                  let scope = {
                    title: "General Staff",
                    desc: "Standard operational access to the LMS platform.",
                    deliverables: ["Maintain data integrity", "Follow compliance guidelines"]
                  };

                  if (role === 'Loan Officer') {
                    scope = {
                      title: "Portfolio Growth & Onboarding",
                      desc: "Responsible for sourcing leads, processing loan applications, and managing client relationships.",
                      deliverables: ["Lead conversion", "Customer KYC verification", "Portfolio health monitoring"]
                    };
                  } else if (role === 'Collections Officer') {
                    scope = {
                      title: "Arrears Management",
                      desc: "Focused on recovering overdue payments and maintaining low delinquency rates.",
                      deliverables: ["PTP (Promise to Pay) tracking", "Field visits", "Reminder scheduling"]
                    };
                  } else if (role === 'Finance') {
                    scope = {
                      title: "Treasury & Disbursement",
                      desc: "Oversees bank transfers, statement reconciliation, and system-wide liquidity.",
                      deliverables: ["Bank transfer approvals", "Payment allocation", "Financial reporting"]
                    };
                  } else if (role === 'Asset Recovery') {
                    scope = {
                      title: "Hard Enforcement",
                      desc: "Handles litigation cases, repossessions, and auction notice issuance for non-performing loans.",
                      deliverables: ["Legal filing", "Asset attachment", "Auction coordination"]
                    }
                  } else if (role.includes('Viewer')) {
                    scope = {
                      title: "Audit & Oversight",
                      desc: "Zero-write access for independent verification of portfolio and system logs.",
                      deliverables: ["Log verification", "Anomaly detection", "Compliance auditing"]
                    }
                  }

                  return (
                    <div>
                      <div style={{fontSize: 14, fontWeight: 800, color: T.accent, marginBottom: 4}}>{scope.title}</div>
                      <div style={{fontSize: 12, color: T.muted, marginBottom: 16}}>{scope.desc}</div>
                      <div style={{display: 'flex', flexWrap: 'wrap', gap: 6}}>
                        {scope.deliverables.map(d => (
                          <div key={d} style={{background: T.aLo, color: T.accent, padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, border: `1px solid ${T.accent}30`}}>
                            ✓ {d.toUpperCase()}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </Card>

            {/* ── Role management ──────────────── */}
            <Card style={{marginBottom:12}}>
              <CH title="Modify Authority" icon={ShieldCheck}/>
              <div style={{padding:'10px 14px 14px'}}>
                <div style={{color:T.muted,fontSize:12,marginBottom:10}}>Setting a new role updates all system permissions for <b style={{color:T.accent}}>{w.name}</b> immediately.</div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {ROLES.map(function(role){return(
                    <button key={role} onClick={function(){changeRole(w,role);}}
                      style={{background:w.role===role?T.accent:T.surface,
                              color:w.role===role?'#060A10':T.muted,
                              border:'1px solid '+(w.role===role?T.accent:T.border),
                              borderRadius:8,padding:'7px 12px',cursor:'pointer',fontSize:12,fontWeight:700, transition: '0.2s'}}>
                      {role}
                    </button>
                  );})}
                </div>
              </div>
            </Card>

            {/* ── Document photos ──────────────── */}
            <Card>
              <CH title="Identity Documents"/>
              <div style={{padding:'10px 14px 14px'}}>
                {DOC_SLOTS.filter(function(s){return s.required;}).map(function(slot){
                  var doc = wDocs.find(function(d){return d.key===slot.key;});
                  return (
                    <div key={slot.key} style={{marginBottom:14}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                        <span style={{color:T.muted,fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:.5}}>{slot.label}</span>
                        {!doc&&<span style={{color:T.danger,fontSize:10,fontWeight:700}}>Not uploaded</span>}
                        {doc&&<span style={{color:T.ok,fontSize:10,fontWeight:700}}>Uploaded {doc.uploaded}</span>}
                      </div>
                      {doc?(
                        <div onClick={function(){setViewDoc(doc);}}
                          style={{cursor:'pointer',borderRadius:10,overflow:'hidden',border:'2px solid '+T.ok,display:'inline-block',maxWidth:'100%'}}>
                          {doc.type&&doc.type.startsWith('image/')
                            ?<img src={doc.dataUrl} alt={slot.label} style={{display:'block',maxWidth:'100%',maxHeight:180,objectFit:'cover'}}/>
                            :<div style={{background:T.surface,padding:'20px 30px',color:T.muted,fontSize:12}}>PDF — tap to view</div>
                          }
                        </div>
                      ):(
                        <div style={{background:T.surface,borderRadius:10,border:'2px dashed '+T.danger+'40',padding:'20px',textAlign:'center'}}>
                          <div style={{color:T.danger,fontSize:12,marginBottom:8}}>No document uploaded</div>
                          <label style={{cursor:'pointer',display:'inline-flex',alignItems:'center',gap:5,background:T.bLo,border:'1px solid '+T.blue+'38',borderRadius:7,padding:'6px 12px'}}>
                            <span style={{color:T.blue,fontSize:12,fontWeight:700}}>Upload</span>
                            <input type="file" accept={slot.accept} style={{display:'none'}} onChange={function(e){var file=e.target.files&&e.target.files[0];if(!file)return;e.target.value='';uploadDoc(w.id,slot,file);}}/>
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {detailTab==='loans'&&(
          <DT cols={[{k:'id',l:'ID',r:function(v){return <span style={{color:T.accent,fontFamily:T.mono,fontSize:12}}>{v}</span>;}},{k:'customer',l:'Customer'},{k:'amount',l:'Principal',r:function(v){return fmt(v);}},{k:'balance',l:'Balance',r:function(v){return fmt(v);}},{k:'status',l:'Status',r:function(v){return <Badge color={SC[v]||T.muted}>{v}</Badge>;}},{k:'repaymentType',l:'Type'}]}
            rows={wLoans} emptyMsg="No loans assigned"/>
        )}

        {detailTab==='customers'&&(
          <DT cols={[{k:'id',l:'ID',r:function(v){return <span style={{color:T.accent,fontFamily:T.mono,fontSize:12}}>{v}</span>;}},{k:'name',l:'Name'},{k:'phone',l:'Phone'},{k:'business',l:'Business'},{k:'risk',l:'Risk',r:function(v){return <Badge color={RC[v]}>{v}</Badge>;}}]}
            rows={wCusts} emptyMsg="No customers assigned"/>
        )}

        {detailTab==='leads'&&(
          <DT cols={[{k:'id',l:'ID',r:function(v){return <span style={{color:T.accent,fontFamily:T.mono,fontSize:12}}>{v}</span>;}},{k:'name',l:'Name'},{k:'phone',l:'Phone'},{k:'business',l:'Business'},{k:'status',l:'Status',r:function(v){return <Badge color={SC[v]||T.muted}>{v}</Badge>;}},{k:'date',l:'Date'}]}
            rows={wLeads} emptyMsg="No leads"/>
        )}

        {detailTab==='timeline'&&(
          <div>
            {wInts.length===0&&<div style={{color:T.muted,textAlign:'center',padding:24,background:T.surface,borderRadius:10}}>No interactions recorded</div>}
            <div style={{maxHeight:'40vh',overflowY:'auto',overflowX:'hidden'}}>
            {[...wInts].sort(function(a,b){return b.date.localeCompare(a.date);}).map(function(item){return(
              <div key={item.id} style={{background:T.surface,border:'1px solid '+T.border,borderRadius:10,padding:'11px 13px',marginBottom:8}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                  <Badge color={T.accent}>{item.type}</Badge>
                  <span style={{color:T.muted,fontSize:11}}>{item.date}</span>
                </div>
                <div style={{color:T.txt,fontSize:13}}>{item.notes}</div>
              </div>
            );})}
            </div>
          </div>
        )}

        {detailTab==='documents'&&(
          <div>
            <div style={{display:'flex',alignItems:'center',gap:10,background:docsOk?T.oLo:T.dLo,border:'1px solid '+(docsOk?T.ok:T.danger)+'38',borderRadius:10,padding:'11px 14px',marginBottom:14}}>
              <span style={{fontSize:18}}>{docsOk?'OK':'!'}</span>
              <div style={{flex:1}}>
                <div style={{color:docsOk?T.ok:T.danger,fontWeight:700,fontSize:13}}>
                  {docsOk?'All required documents on file':reqSlots.length-reqDone+' required document(s) missing'}
                </div>
                <div style={{color:T.muted,fontSize:11,marginTop:2}}>{wDocs.length} of {DOC_SLOTS.length} uploaded</div>
              </div>
              <Badge color={docsOk?T.ok:T.danger}>{reqDone+'/'+reqSlots.length}</Badge>
            </div>
            {DOC_SLOTS.map(function(slot,idx){
              const doc = wDocs.find(function(d){return d.key===slot.key;});
              return (
                <div key={slot.key} style={{background:T.surface,border:'1.5px solid '+(doc?T.ok:slot.required?T.danger+'40':T.border),borderRadius:11,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
                  <div style={{width:28,height:28,borderRadius:99,background:doc?T.ok:slot.required?T.dLo:T.border,color:doc?'#fff':slot.required?T.danger:T.muted,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:800,flexShrink:0}}>{doc?'V':idx+1}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:T.txt,fontSize:13,fontWeight:700}}>{slot.label} {slot.required&&<span style={{color:T.danger,fontSize:10}}>Required</span>}</div>
                    <div style={{color:doc?T.ok:T.muted,fontSize:11,marginTop:2}}>{doc?'Uploaded '+doc.uploaded:(slot.required?'Not uploaded':'Optional')}</div>
                  </div>
                  {doc&&(
                    <div onClick={()=>setViewDoc(doc)} style={{cursor:'pointer',flexShrink:0}}>
                      {doc.type&&doc.type.startsWith('image/')
                        ?<img src={doc.dataUrl} alt={slot.label} style={{width:52,height:52,objectFit:'cover',borderRadius:7,border:'2px solid '+T.ok}}/>
                        :<div style={{width:52,height:52,background:T.card,borderRadius:7,border:'2px solid '+T.ok,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>D</div>
                      }
                    </div>
                  )}
                  <div style={{display:'flex',gap:6,flexShrink:0}}>
                    {doc&&<button onClick={()=>setViewDoc(doc)} style={{background:T.aLo,border:'1px solid '+T.accent+'38',color:T.accent,borderRadius:7,padding:'5px 9px',cursor:'pointer',fontSize:11,fontWeight:700}}>View</button>}
                    {doc&&<button onClick={()=>removeDoc(w.id,doc.id)} style={{background:T.dLo,border:'1px solid '+T.danger+'30',color:T.danger,borderRadius:7,padding:'5px 9px',cursor:'pointer',fontSize:11,fontWeight:700}}>Remove</button>}
                    {!doc&&(
                      <label style={{cursor:'pointer',display:'flex',alignItems:'center',gap:5,background:T.bLo,border:'1px solid '+T.blue+'38',borderRadius:7,padding:'6px 10px'}}>
                        <span style={{color:T.blue,fontSize:11,fontWeight:700}}>Upload</span>
                        <input type="file" accept={slot.accept} style={{display:'none'}} onChange={function(e){var file=e.target.files&&e.target.files[0];if(!file)return;e.target.value='';uploadDoc(w.id,slot,file);}}/>
                      </label>
                    )}
                  </div>
                </div>
              );
            })}
            <div style={{color:T.muted,fontSize:11,marginTop:8}}>Admin can upload or remove documents on behalf of this worker.</div>
          </div>
        )}

        {detailTab==='portal'&&(
          <div>
            <Alert type="info" style={{marginBottom:12}}>Viewing {w.name} portal as admin</Alert>
            <WorkerPanel
              worker={w}
              workers={workers||[]}
              setWorkers={setWorkers}
              loans={loans}
              setLoans={setLoans}
              payments={payments}
              customers={customers}
              leads={leads||[]}
              allWorkers={workers||[]}
              setCustomers={setCustomers||(function(){})}
              onSubmitLoan={function(l){if(setLoans)setLoans(function(ls){return [l].concat(ls);});}}
              setLeads={setLeads||(function(){})}
              interactions={interactions||[]}
              setInteractions={setInteractions||(function(){})}
              repossessedAssets={allState?.repossessedAssets || []}
              setRepossessedAssets={allState?.setRepossessedAssets || (()=>{})}
              addAudit={addAudit||(function(){})}
              showToast={showToast||(function(){})}
              onLogout={() => setSel(null)}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fu">
      {ContactPopup}
      <ModuleHeader 
        title="Team Management"
        sub="Overview of all registered field officers and administrators"
        right={
          <div style={{display:'flex', gap:8}}>
            <Btn onClick={()=>setShowTargets(true)} v="secondary" icon={Target}>Set Monthly Targets</Btn>
            <Btn onClick={()=>setShowNew(true)} icon={UserPlus}>Add New Team Member</Btn>
          </div>
        }
      />

      {showTargets && (
        <Dialog title="Monthly Target Configuration" onClose={()=>setShowTargets(false)} width={500}>
          <div style={{padding: '0 4px'}}>
             <div style={{marginBottom: 20}}>
                <FI label="Target Month" type="month" value={targetMonth} onChange={v => setTargetMonth(v)} />
             </div>
             <div style={{marginBottom: 20}}>
                <FI label="Total Distribution Target (KES)" type="number" value={totalTarget} onChange={v => setTotalTarget(v)} placeholder="e.g. 5,000,000" />
             </div>
             
             {activeOfficers.length > 0 ? (
               <div style={{background: T.surface, padding: 16, borderRadius: 16, marginBottom: 20}}>
                  <div style={{fontSize: 12, color: T.muted, fontWeight: 800, textTransform: 'uppercase', marginBottom: 12}}>Automatic Split</div>
                  <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
                     {activeOfficers.map(w => (
                        <div key={w.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                           <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                              <Av ini={w.avatar||w.name[0]} size={24} color={T.accent} />
                              <span style={{fontSize: 13, fontWeight: 600}}>{w.name}</span>
                           </div>
                           <span style={{fontSize: 13, fontWeight: 900, color: T.accent}}>{fmtM(Number(totalTarget || 0) / activeOfficers.length)}</span>
                        </div>
                     ))}
                  </div>
                  <div style={{marginTop: 16, paddingTop: 12, borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: T.dim}}>
                     <span>Available Officers: {activeOfficers.length}</span>
                     <span>Per Head: {fmtM(Number(totalTarget || 0) / activeOfficers.length)}</span>
                  </div>
               </div>
             ) : (
               <Alert type="warn" style={{marginBottom: 20}}>No active Loan Officers available to assign targets.</Alert>
             )}

             <Btn full onClick={handleSaveTarget} v="primary" icon={ShieldCheck} disabled={!totalTarget || activeOfficers.length === 0}>
               Confirm & Propagate Target
             </Btn>
          </div>
        </Dialog>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <KPI label="Deployment" value={teamStats.active} sub={`${teamStats.total} Total Staff`} icon={Users} color={T.accent} />
          <KPI label="Collective Portfolio" value={fmtM(teamStats.book)} icon={TrendingUp} />
          <KPI label="Active Capacity" value={teamStats.capacity + '%'} sub="Team Availability" icon={Target} color={T.ok} />
          <KPI label="Pending Onboarding" value={workers.filter(w => (w.docs||[]).length < 3).length} icon={ShieldCheck} color={T.warn} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
          <Search value={workQ} onChange={setWorkQ} placeholder="Search team by name or role..." style={{ flex: 1, maxWidth: 400 }} />
          <RefreshBtn onRefresh={() => { setWorkQ(''); setSel(null); }} />
      </div>
      {/* Compliance & Identity Status Hub */}
      {workers.some(w => !w.docs || (w.docs||[]).length < 3) && (
        <Card style={{ 
          background: `linear-gradient(135deg, ${T.danger}15 0%, ${T.surface} 100%)`, 
          border: `1.5px solid ${T.danger}30`,
          marginBottom: 24,
          padding: '20px 24px',
          borderRadius: 24
        }}>
           <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: T.danger, color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                 <ShieldCheck size={24} />
              </div>
              <div style={{ flex: 1 }}>
                 <div style={{ fontSize: 16, fontWeight: 900, color: T.txt }}>Compliance Action Required</div>
                 <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>
                    {workers.filter(w => !w.docs || (w.docs||[]).length < 3).map(w => w.name).join(', ')} 
                    {workers.filter(w => !w.docs || (w.docs||[]).length < 3).length > 1 ? ' have ' : ' has '} 
                    incomplete identity verification records. 
                    {workers.some(w => w.name === 'Jennifer Wanjiku') && " [High Priority: Document Loss Reported]"}
                 </div>
              </div>
              <Btn sm v="danger" onClick={() => {
                const jennifer = workers.find(w => w.name === 'Jennifer Wanjiku');
                if(jennifer) {
                   setSel(jennifer);
                   setDetailTab('docs');
                } else {
                   // If not jennifer, just select the first one
                   const first = workers.find(w => !w.docs || (w.docs||[]).length < 3);
                   if(first) { setSel(first); setDetailTab('docs'); }
                }
              }}>Resolve Gaps</Btn>
           </div>
        </Card>
      )}

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:16}}>
        {workers.filter(w => !workQ || w.name.toLowerCase().includes(workQ.toLowerCase()) || w.role.toLowerCase().includes(workQ.toLowerCase())).map(w => {
          const wl = loans.filter(l => l.officer === w.name);
          const bk = wl.filter(l => l.status !== 'Settled').reduce((s, l) => s + l.balance, 0);
          const ov = wl.filter(l => l.status === 'Overdue').length;
          const wp = payments.filter(p => wl.some(l => l.id === p.loanId)).reduce((s, p) => s + p.amount, 0);
          const docsOk = DOC_SLOTS.filter(s => s.required).every(s => (w.docs || []).some(d => d.key === s.key));
          const collRate = bk > 0 ? Math.min(Math.round((wp / bk) * 100), 100) : 0;
          
          return (
            <Card key={w.id} style={{ padding: 0, cursor: 'pointer', border: `1px solid ${w.status === 'Active' ? T.border : T.danger + '30'}`, overflow: 'hidden' }}
              onClick={() => { setSel(w); setDetailTab('overview'); setViewDoc(null); }}>
              {/* Target Progress Bar for Loan Officers */}
              {w.role === 'Loan Officer' && activeTarget && (
                <div style={{ height: 4, background: T.surface, width: '100%' }}>
                  {(function(){
                     const myTgt = activeTarget.total_target_amount / activeOfficers.length;
                     const currentDisb = wl.filter(l => l.disbursed?.startsWith(targetMonth)).reduce((s,l) => s + Number(l.amount), 0);
                     const progress = Math.min((currentDisb / myTgt) * 100, 100);
                     return <div style={{ height: '100%', width: `${progress}%`, background: progress >= 100 ? T.success : T.accent, transition: '0.4s' }} />;
                  })()}
                </div>
              )}
              <div style={{ padding: '16px 18px', borderBottom: `1px solid ${T.border}`, background: T.card2, display: 'flex', alignItems: 'center', gap: 12 }}>
                <Av ini={w.avatar || w.name[0]} size={42} color={w.status === 'Active' ? T.accent : T.muted} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: T.txt, fontWeight: 800, fontSize: 15, fontFamily: T.head }}>{w.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {(function(){
                        const r = w.role;
                        const iconProps = { size: 12, color: T.muted };
                        if(r === 'Loan Officer') return <Target {...iconProps} />;
                        if(r === 'Collections Officer') return <ShieldAlert {...iconProps} />;
                        if(r === 'Finance') return <Landmark {...iconProps} />;
                        if(r === 'Asset Recovery') return <Gavel {...iconProps} />;
                        return <Users {...iconProps} />;
                      })()}
                      <div style={{ color: T.muted, fontSize: 11, fontWeight: 600 }}>{w.role.toUpperCase()}</div>
                   </div>
                </div>
                <Badge color={w.status === 'Active' ? T.ok : T.danger}>{w.status}</Badge>
              </div>
              
              <div style={{ padding: '14px 18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <div style={{ background: T.surface, borderRadius: 10, padding: '8px 10px', border: `1px solid ${T.border}` }}>
                    <div style={{ color: T.muted, fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>Book</div>
                    <div style={{ color: T.accent, fontWeight: 800, fontSize: 14 }}>{fmtM(bk)}</div>
                  </div>
                  <div style={{ background: T.surface, borderRadius: 10, padding: '8px 10px', border: `1px solid ${T.border}` }}>
                    <div style={{ color: T.muted, fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>Arrears</div>
                    <div style={{ color: ov > 0 ? T.danger : T.ok, fontWeight: 800, fontSize: 14 }}>{ov}</div>
                  </div>
                </div>

                <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, color: T.muted, fontWeight: 700 }}>COLLECTION EFFICIENCY</span>
                    <span style={{ fontSize: 10, color: T.ok, fontWeight: 800 }}>{collRate}%</span>
                </div>
                <div style={{ height: 4, background: T.border, borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${collRate}%`, background: T.ok, borderRadius: 99 }} />
                </div>
                
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  {!docsOk ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.warn, fontSize: 11, fontWeight: 700 }}>
                      <ShieldCheck size={14} /> Docs Incomplete
                    </div>
                  ) : <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.ok, fontSize: 11, fontWeight: 700 }}>
                      <ShieldCheck size={14} /> Fully Verified
                    </div>}
                  
                  <button onClick={(e) => { e.stopPropagation(); setSel(w); setDetailTab('portal'); }}
                    style={{ background: T.accent + '15', color: T.accent, border: `1px solid ${T.accent}30`, borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Eye size={12}/> Inspect Account
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      {showNew&&(
        <Dialog title="Add New Worker" onClose={function(){setShowNew(false);setF(blankF);}} width={520}>
          <div className="mob-grid1" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
            <FI label="Full Name"           value={f.name}  onChange={function(v){setF(function(p){return {...p,name:v};});}  }  required half/>
            <FI label="Email" type="email"  value={f.email} onChange={function(v){setF(function(p){return {...p,email:v};});}  } required half/>
            <PhoneInput label="Phone"       value={f.phone} onChange={function(v){setF(function(p){return {...p,phone:v};});}  } half required/>
            <NumericInput label="National ID No." value={f.idNo} onChange={function(v){setF(function(p){return {...p,idNo:v};});}} half placeholder="e.g. 12345678" required error={!f.idNo}/>
            <FI label="Role" type="select" options={ROLES} value={f.role} onChange={function(v){setF(function(p){return {...p,role:v};});}} half/>
            <FI label="Temporary Password" type="password" value={f.pw} onChange={function(v){setF(function(p){return {...p,pw:v};});}} required half placeholder="Min 6 chars"/>
          </div>
          <Alert type="info" style={{marginTop:4}}>All fields required.</Alert>
          <div style={{display:'flex',gap:9,marginTop:8}}>
            <Btn onClick={addW} full>Add Worker</Btn>
            <Btn v="secondary" onClick={function(){setShowNew(false);setF(blankF);}}>Cancel</Btn>
          </div>
        </Dialog>
      )}
    </div>
  );
};


export default WorkersTab;
