import CustomerProfile from "@/modules/customers/CustomerProfile";
import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { Target, Check, Phone, Briefcase, MapPin, FastForward, UserCheck, AlertCircle, Sparkles, MessageSquare, Plus, Filter, LayoutGrid, ChevronLeft, ChevronRight } from 'lucide-react';
import { T, SC, RC, SFX, Card, CH, KPI, DT, Btn, Badge, Av, Bar, BackBtn, RefreshBtn,
  FI, PhoneInput, NumericInput, Search, Pills, Alert, Dialog, ConfirmDialog, ToastContainer,
  LoanModal, LoanForm, RepayTracker, ValidationPopup, OnboardForm,
  fmt, fmtM, now, uid, ts, escHtml, toCSV, dlCSV, buildFullBackup,
  calculateLoanStatus,
  sbWrite, sbInsert,
  toSupabaseLoan, toSupabaseCustomer, toSupabasePayment, toSupabaseInteraction, toSupabaseLead,
  sbUploadDoc,
  generateLoanAgreementHTML, generateAssetListHTML, downloadLoanDoc,
  useContactPopup, useToast, useReminders, useModalLock,
  ModuleHeader
} from '@/lms-common';
import { useModuleFilter } from '@/hooks/useModuleFilter';


const LeadsTab = ({leads,setLeads,workers,customers,setCustomers,loans,addAudit,isWorker,currentWorker,showToast=()=>{},onNav}) => {
  const [showNew,setShowNew]=useState(false);
  const [conv,setConv]=useState(null);
  const LEAD_DRAFT_KEY = "acl_lead_draft";
  const [draftPrompt, setDraftPrompt] = useState(() => {
    try {
      const d = JSON.parse(localStorage.getItem(LEAD_DRAFT_KEY) || "null");
      return d && d.name ? d : null;
    } catch (e) {
      return null;
    }
  });
  
  const initialF = {name:'',phone:'',business:'',location:'',source:'Referral',officer:currentWorker?.name||''};
  const [f,setF]=useState(initialF);
  
  useEffect(() => {
    try {
      if (f.name || f.phone || f.business || f.location) {
        localStorage.setItem(LEAD_DRAFT_KEY, JSON.stringify(f));
      }
    } catch (e) {}
  }, [f]);
  
  const clearDraft = () => {
    try {
      localStorage.removeItem(LEAD_DRAFT_KEY);
    } catch (e) {}
  };

  const continueDraft = () => {
    if (draftPrompt) {
      setF({...draftPrompt, officer: f.officer || draftPrompt.officer});
      setShowNew(true);
    }
    setDraftPrompt(null);
  };
  
  const startFresh = () => {
    setF(initialF);
    setDraftPrompt(null);
    clearDraft();
  };
  const [showVal,setShowVal]=useState(false);
  const stages=['New','Contacted','Interested','New Customer','Not Interested'];
  const [collapsed, setCollapsed] = useState(['New','Contacted','Interested','New Customer','Not Interested']); 
  const stageC={New:T.muted,Contacted:T.warn,Interested:T.blue,'New Customer':T.ok,'Not Interested':T.danger};
  const stageI={
    'New': <Sparkles size={16}/>,
    'Contacted': <MessageSquare size={16}/>,
    'Interested': <Target size={16}/>,
    'New Customer': <UserCheck size={16}/>,
    'Not Interested': <AlertCircle size={16}/>
  };
  const [loading, setLoading] = useState(false);

  // Lazy load leads if not already provided by the parent cache
  useEffect(() => {
    if (leads.length > 0) return;
    
    setLoading(true);
    import('@/config/supabaseClient').then(({ supabase }) => {
      if (!supabase) return;
      supabase.from('leads')
        .select('*')
        .order('date', { ascending: false })
        .then(({ data, error }) => {
          if (error) {
            console.error('[LeadsTab] Fetch error:', error.message);
            showToast('Failed to load leads', 'danger');
          } else {
            setLeads(data.map(l => ({ ...l, date: l.date || (l.created_at ? l.created_at.split('T')[0] : now()) })));
          }
          setLoading(false);
        });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      // 1. Direct match with a customer record using fromLead link
      const linkedCust = customers.find(c => c.fromLead === l.id);
      if (linkedCust && loans.some(loan => loan.customerId === linkedCust.id)) return false;

      // 2. Direct match by loanId/customerId on the lead itself (if present)
      if (l.loanId || l.loan_id || l.customerId || l.customer_id) return false;

      // 3. Phone match (robust matching: last 9 digits safely)
      const lp = String(l.phone || '').replace(/\D/g, '').slice(-9);
      if (lp && lp.length >= 7) {
        const custByPhone = customers.find(c => String(c.phone || '').replace(/\D/g, '').slice(-9) === lp);
        if (custByPhone && loans.some(loan => loan.customerId === custByPhone.id)) return false;
      }

      // 4. Name match (fallback for missing phones/fromLead)
      const lnName = (l.name || '').trim().toLowerCase();
      if (lnName) {
        const custByName = customers.find(c => (c.name || '').trim().toLowerCase() === lnName);
        if (custByName && loans.some(loan => loan.customerId === custByName.id)) return false;
      }
      
      return true;
    });
  }, [leads, customers, loans]);

  const {
    q, setQ, startDate, setStartDate, endDate, setEndDate, applyFilter,
    filtered, handleExport
  } = useModuleFilter({
    data: filteredLeads,
    initialTab: 'All',
    dateKey: 'date',
    searchFields: ['id', 'name', 'phone', 'business', 'location', 'source', 'officer'],
    reportId: 'leads',
    showToast,
    addAudit,
    initialStartDate: '2024-01-01'
  });

  const stats = useMemo(() => {
    const total = filteredLeads.length;
    const hot = filteredLeads.filter(l => l.status === 'Interested').length;
    return `${total} leads · ${hot} hot`;
  }, [filteredLeads]);

  const addLead=()=>{
    const missing=[];
    if(!f.name) missing.push('Lead Name');
    if(!f.phone) missing.push('Phone Number');
    if(missing.length){setShowVal(missing);try{SFX.error();}catch(e){};return;}
    
    // Robust phone validation (match last 9 digits)
    const p = f.phone.replace(/\D/g, '').slice(-9);
    if (p) {
      const existingCust = customers.find(c => (c.phone || '').replace(/\D/g, '').slice(-9) === p);
      if (existingCust) {
        showToast(`❌ Conflict: "${existingCust.name}" is already a registered customer.`, 'danger', 6000);
        try { SFX.error(); } catch(e) {}
        return;
      }
      const existingLead = leads.find(l => (l.phone || '').replace(/\D/g, '').slice(-9) === p);
      if (existingLead) {
        showToast(`⚠ A lead already exists with this phone number (${existingLead.name}).`, 'warn');
        return;
      }
    }
    const lead={id:uid('LD'),...f,status:'New',date:now(),notes:''};
    setLeads(ls=>[lead,...ls]);
    sbInsert('leads',toSupabaseLead(lead));
    addAudit('Lead Added',lead.id,f.name);
    showToast(`✅ Lead "${f.name}" added`,'ok');SFX.save();
    setShowNew(false);
    clearDraft();
    setDraftPrompt(null);
    setF(initialF);
  };
  const VALID_TRANSITIONS={New:['Contacted','Not Interested'],Contacted:['Interested','Not Interested'],Interested:['New Customer','Not Interested']};
  const mv=(lead,status)=>{
    const allowed=VALID_TRANSITIONS[lead.status]||[];
    if(!allowed.includes(status)){showToast('⚠ Invalid lead stage transition','warn');return;}
    const leadUpd={...lead,status, _movedAt: Date.now()};
    setLeads(ls => {
      const rest = ls.filter(x => x.id !== lead.id);
      return [leadUpd, ...rest];
    });
    
    // Automatically expand target shelf to show the animation
    setCollapsed(prev => prev.filter(s => s !== status));
    
    // Scroll the target shelf to 0 smoothly
    setTimeout(() => {
      const el = document.getElementById(`shelf-${status}`);
      if (el) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      }
    }, 100);

    sbWrite('leads',toSupabaseLead(leadUpd));
    addAudit('Lead Stage Changed',lead.id,`${lead.status} → ${status}`);
    showToast(`Lead moved to ${status}`,'info');
  };
  const doConvert = async cust => {
    const phoneTaken = customers && customers.some(c=>c.phone&&cust.phone&&c.phone.replace(/\s/g,'')===cust.phone.replace(/\s/g,''));
    const idTaken    = customers && cust.idNo && customers.some(c=>c.idNo&&c.idNo.trim()===cust.idNo.trim());
    if(phoneTaken){
      showToast(`⚠ A customer with phone number "${cust.phone}" already exists in the system.`,'danger',5000);
      try{SFX.error();}catch(e){}
      return;
    }
    if(idTaken){
      showToast(`⚠ A customer with National ID "${cust.idNo}" already exists in the system.`,'danger',5000);
      try{SFX.error();}catch(e){}
      return;
    }
    setCustomers(cs=>[cust,...cs]);
    sbInsert('customers',toSupabaseCustomer(cust));

    if(cust.docs && cust.docs.length > 0){
      showToast(`📤 Syncing ${cust.docs.length} documents...`,'info');
      for(const d of cust.docs){
        try { await sbUploadDoc(cust.id, d); }
        catch(e) { console.error('[reg-doc-sync]', e.message); }
      }
    }

    const convUpd={...conv,status:'New Customer', _movedAt: Date.now()};
    setLeads(ls => {
      const rest = ls.filter(x => x.id !== conv.id);
      return [convUpd, ...rest];
    });
    setCollapsed(prev => prev.filter(s => s !== 'New Customer'));
    setTimeout(() => {
      const el = document.getElementById(`shelf-New Customer`);
      if (el) el.scrollTo({ left: 0, behavior: 'smooth' });
    }, 100);

    sbWrite('leads',toSupabaseLead(convUpd));
    addAudit('Lead Converted',conv.id,`→ Customer ${cust.id}`);
    showToast(`🎉 Registration Complete! Lead converted to customer: ${cust.name}`,'ok',4000);
    try { SFX.save(); } catch(e) {}
    setConv(null);
  };

  const exportCols = [
    { k: 'id', l: 'ID' },
    { k: 'name', l: 'Name' },
    { k: 'phone', l: 'Phone' },
    { k: 'business', l: 'Business' },
    { k: 'location', l: 'Location' },
    { k: 'source', l: 'Source' },
    { k: 'status', l: 'Status' },
    { k: 'officer', l: 'Officer' },
    { k: 'date', l: 'Date' }
  ];

  return (
    <div className='fu'>
      {showVal&&<ValidationPopup fields={showVal} onClose={()=>setShowVal(false)}/>}
      
      <ModuleHeader
        title={<div style={{display:'flex', alignItems:'center', gap:8}}><Target size={20}/> Lead Pipeline</div>}
        stats={stats}
        refreshProps={{ onRefresh: () => { setQ(''); setConv(null); } }}
        search={{ value: q, onChange: setQ, placeholder: 'Search leads…' }}
        dateRange={{ start: startDate, end: endDate, onStartChange: setStartDate, onEndChange: setEndDate, onSearch: applyFilter }}
        exportProps={{ onExport: (fmt) => handleExport(fmt, 'Lead Report', exportCols) }}
      />
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <Btn onClick={() => setShowNew(true)} icon={Plus} v="accent">Add New Lead</Btn>
      </div>

      {draftPrompt && (
        <div
          style={{
            background: `${T.gold}10`,
            border: `1px solid ${T.gold}25`,
            borderRadius: 16,
            padding: "16px 18px",
            marginBottom: 20,
            backdropFilter: 'blur(10px)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                color: T.gold,
                fontWeight: 900,
                fontSize: 12,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                marginBottom: 2,
              }}
            >
              📝 Recovery Available
            </div>
            <div style={{ color: T.muted, fontSize: 13 }}>
              Continue draft lead for <b style={{ color: T.txt }}>{draftPrompt.name || "unknown"}</b>?
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={continueDraft} sm v="accent" style={{ background: T.gold, color: '#000' }}>
              Resume
            </Btn>
            <Btn v="ghost" onClick={startFresh} sm style={{ color: T.muted }}>
              Discard
            </Btn>
          </div>
        </div>
      )}

      <div style={{
        display: 'flex', 
        flexDirection: 'column',
        gap: 16, 
        paddingBottom: 20, 
        marginBottom: 20,
        WebkitOverflowScrolling: 'touch'
      }} className='lead-pipeline'>
        {stages.map((stage, idx) => {
          const sl = filtered.filter(l => l.status === stage);
          const color = stageC[stage];
          const isCollapsed = collapsed.includes(stage);
          const toggle = () => setCollapsed(prev => isCollapsed ? prev.filter(s => s !== stage) : [...prev, stage]);
          
          return (
            <div key={stage} style={{
              background: isCollapsed ? 'transparent' : `${T.surface}40`,
              backdropFilter: isCollapsed ? 'none' : 'blur(10px)',
              border: `1px solid ${isCollapsed ? T.border + '40' : T.border}`,
              borderRadius: 24,
              display: 'flex',
              flexDirection: 'column',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              overflow: 'hidden',
              animation: `fadeUp .4s ease both ${idx * 0.05}s`,
            }}>
              {/* Shelf Header */}
              <div style={{
                padding: '14px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: isCollapsed ? 'transparent' : `linear-gradient(to right, ${color}15, transparent)`,
                cursor: 'pointer',
                userSelect: 'none'
              }} onClick={toggle}>
                <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 12, background: `${color}20`, 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: color,
                    flexShrink: 0
                  }}>
                    {stageI[stage]}
                  </div>
                  <div>
                    <div style={{fontSize: 15, fontWeight: 800, color: T.txt}}>{stage}</div>
                    <div style={{fontSize: 11, color: T.muted, fontWeight: 600}}>{sl.length} Profiles in queue</div>
                  </div>
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
                   <Badge color={color}>{sl.length}</Badge>
                   <div style={{
                     color: T.muted, fontSize: 12, transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
                     transition: 'transform 0.4s'
                   }}>▼</div>
                </div>
              </div>

              {/* Shelf Content (Horizontal scrolling cards) */}
              {!isCollapsed && (
                <div style={{ position: 'relative' }}>
                  {sl.length > 0 && (
                    <button
                      onClick={() => {
                        const el = document.getElementById(`shelf-${stage}`);
                        if (el) el.scrollBy({ left: -320, behavior: 'smooth' });
                      }}
                      style={{
                        position: 'absolute',
                        left: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        zIndex: 10,
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: `${T.surface}D0`,
                        backdropFilter: 'blur(4px)',
                        border: `1px solid ${T.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: T.txt,
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                    >
                      <ChevronLeft size={20} />
                    </button>
                  )}
                  
                  <div id={`shelf-${stage}`} style={{
                    padding: '4px 24px 24px 24px',
                    display: 'flex',
                    gap: 16,
                    overflowX: 'auto',
                    scrollSnapType: 'x proximity',
                    animation: 'fadeIn 0.35s ease',
                    scrollBehavior: 'smooth'
                  }} className='main-scroll'>
                  {sl.length === 0 ? (
                    <div style={{
                      flex: 1, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: T.muted, fontSize: 13, border: `1px dashed ${T.border}`, borderRadius: 16,
                    }}>No leads found in this stage</div>
                  ) : sl.map(l => {
                    const isJustMoved = l._movedAt && (Date.now() - l._movedAt < 2500);
                    const matchedCust = stage === 'New Customer' 
                      ? customers?.find(c => c.phone && l.phone && c.phone.replace(/\s/g,'') === l.phone.replace(/\s/g,'')) 
                      : null;
                      
                    return (
                    <div key={l.id} className={`lead-card ${isJustMoved ? 'just-moved' : ''}`} style={{
                      flex: '0 0 300px',
                      background: T.card,
                      borderRadius: 20,
                      padding: 20,
                      border: `1px solid ${T.border}`,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                      transition: 'all .3s cubic-bezier(0.2, 0.8, 0.2, 1)',
                      position: 'relative',
                      scrollSnapAlign: 'start'
                    }}>
                      {/* Card Header */}
                      <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 14}}>
                        <div style={{color: T.txt, fontWeight: 800, fontSize: 15}}>{l.name}</div>
                        <Badge color={color} sm>{l.id}</Badge>
                      </div>

                      {/* Card Details */}
                      <div style={{display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: 10, color: T.muted, fontSize: 12.5}}>
                          <Phone size={14}/> <span>{l.phone}</span>
                        </div>
                        {l.business && (
                          <div style={{display: 'flex', alignItems: 'center', gap: 10, color: T.muted, fontSize: 12.5}}>
                            <Briefcase size={14}/> <span>{l.business}</span>
                          </div>
                        )}
                        {l.location && (
                          <div style={{display: 'flex', alignItems: 'center', gap: 10, color: T.muted, fontSize: 12.5}}>
                            <MapPin size={14}/> <span>{l.location}</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{display: 'flex', gap: 8}}>
                        {stage === 'New' && (
                          <Btn sm full onClick={() => mv(l, 'Contacted')} style={{background: `${T.warn}15`, color: T.warn, border: `1px solid ${T.warn}40`}}>
                             Log Contact
                          </Btn>
                        )}
                        {stage === 'Contacted' && (
                          <Btn sm full icon={MessageSquare} onClick={() => mv(l, 'Interested')} v="ok">
                             Interested
                          </Btn>
                        )}
                        {stage === 'Interested' && (
                          <Btn sm full icon={FastForward} onClick={() => setConv(l)} v="accent">
                             Convert
                          </Btn>
                        )}
                        {stage === 'New Customer' && matchedCust && (
                          matchedCust.mpesaRegistered ? (
                            <div style={{ width: '100%', padding: '8px', borderRadius: 10, background: `${T.ok}15`, color: T.ok, fontSize: 13, fontWeight: 800, textAlign: 'center', border: `1px solid ${T.ok}40` }}>
                              ✓ Fee Paid
                            </div>
                          ) : (
                            <Btn sm full onClick={() => onNav && onNav('paymentshub', { tab: 'registration-fee', customerId: matchedCust.id })} style={{ background: `${T.gold}15`, color: T.gold, border: `1px solid ${T.gold}40` }}>
                               💳 Pay Reg Fee
                            </Btn>
                          )
                        )}
                        {stage === 'New Customer' && !matchedCust && (
                             <div style={{ width: '100%', padding: '8px', borderRadius: 10, background: `${T.surface}`, color: T.muted, fontSize: 13, fontWeight: 800, textAlign: 'center', border: `1px dashed ${T.border}` }}>
                               ⏳ Linked Profile missing
                             </div>
                        )}
                      </div>
                    </div>
                    );
                  })}
                  </div>
                  
                  {sl.length > 0 && (
                    <button
                      onClick={() => {
                        const el = document.getElementById(`shelf-${stage}`);
                        if (el) el.scrollBy({ left: 320, behavior: 'smooth' });
                      }}
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        zIndex: 10,
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: `${T.surface}D0`,
                        backdropFilter: 'blur(4px)',
                        border: `1px solid ${T.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: T.txt,
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                    >
                      <ChevronRight size={20} />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        .lead-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px -8px rgba(0,0,0,0.15); border-color: ${T.accent}40; }
        .lead-pipeline::-webkit-scrollbar { height: 8px; }
        .lead-pipeline::-webkit-scrollbar-track { background: transparent; }
        .lead-pipeline::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 10px; }
        
        @keyframes rippleGlow {
          0% { box-shadow: 0 0 0 0px ${T.accent}80; background: ${T.accent}15; border-color: ${T.accent}; transform: scale(0.98); }
          40% { box-shadow: 0 0 0 10px ${T.accent}00; background: ${T.card}; transform: scale(1.02); }
          100% { box-shadow: 0 0 0 20px rgba(0,0,0,0); border-color: ${T.border}; transform: scale(1); }
        }
        .just-moved {
          animation: rippleGlow 1.2s cubic-bezier(0.2, 0.8, 0.4, 1) forwards !important;
          border-color: ${T.accent} !important;
        }
      `}</style>
      {showNew&&(
        <Dialog title='Add New Lead' onClose={()=>setShowNew(false)}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
            <FI label='Name' value={f.name} onChange={v=>setF(p=>({...p,name:v}))} required error={!f.name} half/>
            <PhoneInput label='Phone' value={f.phone} onChange={v=>setF(p=>({...p,phone:v}))} required half/>
            <FI label='Business' value={f.business} onChange={v=>setF(p=>({...p,business:v}))} half/>
            <FI label='Location' value={f.location} onChange={v=>setF(p=>({...p,location:v}))} half/>
            <FI label='Source' type='select' options={['Referral','Field Visit','WhatsApp','Walk-in','Social Media']} value={f.source} onChange={v=>setF(p=>({...p,source:v}))} half/>
            {!isWorker&&<FI label='Assign To' type='select' options={workers.filter(w=>w.status==='Active').map(w=>w.name)} value={f.officer} onChange={v=>setF(p=>({...p,officer:v}))} half/>}
          </div>
          <Btn onClick={addLead} full>Save Lead</Btn>
        </Dialog>
      )}
      {conv&&(
        <Dialog title={`Convert Lead: ${conv.name}`} onClose={()=>setConv(null)} width={680}>
          <Alert type='ok'>Converting <b>{conv.name}</b> from a lead into a registered customer. Complete all sections below.</Alert>
          <OnboardForm workers={workers} onSave={doConvert} onClose={()=>setConv(null)} prefill={conv} leadId={conv.id}/>
        </Dialog>
      )}
    </div>
  );
};

export default LeadsTab;
