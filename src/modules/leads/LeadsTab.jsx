import CustomerProfile from "@/modules/customers/CustomerProfile";
import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
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
  const [f,setF]=useState({name:'',phone:'',business:'',location:'',source:'Referral',officer:currentWorker?.name||''});
  const [showVal,setShowVal]=useState(false);
  const stages=['New','Contacted','Interested','New Customer','Not Interested'];
  const stageC={New:T.muted,Contacted:T.warn,Interested:T.accent,'New Customer':T.ok,'Not Interested':T.danger};

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
    const lead={id:uid('LD'),...f,status:'New',date:now(),notes:''};
    setLeads(ls=>[lead,...ls]);
    sbInsert('leads',toSupabaseLead(lead));
    addAudit('Lead Added',lead.id,f.name);
    showToast(`✅ Lead "${f.name}" added`,'ok');SFX.save();
    setShowNew(false);
    setF({name:'',phone:'',business:'',location:'',source:'Referral',officer:currentWorker?.name||''});
  };
  const VALID_TRANSITIONS={New:['Contacted','Not Interested'],Contacted:['Interested','Not Interested'],Interested:['New Customer','Not Interested']};
  const mv=(lead,status)=>{
    const allowed=VALID_TRANSITIONS[lead.status]||[];
    if(!allowed.includes(status)){showToast('⚠ Invalid lead stage transition','warn');return;}
    const leadUpd={...lead,status};
    setLeads(ls=>ls.map(l=>l.id===lead.id?leadUpd:l));
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

    const convUpd={...conv,status:'New Customer'};
    setLeads(ls=>ls.map(l=>l.id===conv.id?convUpd:l));
    sbWrite('leads',toSupabaseLead(convUpd));
    addAudit('Lead Converted',conv.id,`→ Customer ${cust.id}`);
    showToast(`🎉 Lead converted to customer: ${cust.name}`,'ok',4000);SFX.save();
    setConv(null);
    if(onNav) onNav('paymentshub', { tab: 'registration-fee', customerId: cust.id }); // MODIFIED: Context-aware redirect
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
        title="🎯 Lead Pipeline"
        stats={stats}
        refreshProps={{ onRefresh: () => { setQ(''); setConv(null); } }}
        search={{ value: q, onChange: setQ, placeholder: 'Search leads…' }}
        dateRange={{ start: startDate, end: endDate, onStartChange: setStartDate, onEndChange: setEndDate, onSearch: applyFilter }}
        exportProps={{ onExport: (fmt) => handleExport(fmt, 'Lead Report', exportCols) }}
      />
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Btn onClick={() => setShowNew(true)}>+ Add Lead</Btn>
      </div>

      <div style={{display:'flex',gap:9,overflowX:'auto',overflowY:'hidden',paddingBottom:6,marginBottom:18,flexWrap:'nowrap'}}
        className='lead-pipeline'>
        {stages.map(stage=>{
          let sl = filtered.filter(l => l.status === stage);
          
          return (
            <div key={stage} style={{minWidth:175,background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:11,flexShrink:0}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:9}}>
                <span style={{color:stageC[stage],fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:.8}}>{stage}</span>
                <span style={{background:stageC[stage]+'1E',color:stageC[stage],borderRadius:99,padding:'2px 7px',fontSize:11,fontWeight:800}}>{sl.length}</span>
              </div>
              <div style={{maxHeight:'40vh',overflowY:'auto',overflowX:'hidden'}}>
              {sl.map(l=>(
                <div key={l.id} style={{background:T.surface,borderRadius:9,padding:10,marginBottom:7,border:`1px solid ${T.border}`}}>
                  <div style={{color:T.txt,fontWeight:700,fontSize:13}}>{l.name}</div>
                  <div style={{color:T.muted,fontSize:12,marginTop:2}}>{l.business||'—'} · {l.location||'—'}</div>
                  <div style={{color:T.muted,fontSize:11,marginTop:2}}>{l.source} · {l.officer&&<span style={{color:T.accent}}>{l.officer}</span>}</div>
                  {stage==='New'&&<button onClick={()=>mv(l,'Contacted')} style={{marginTop:7,background:T.wLo,color:T.warn,border:`1px solid ${T.warn}38`,borderRadius:7,padding:'4px 9px',fontSize:11,fontWeight:700,cursor:'pointer',width:'100%'}}>Mark Contacted</button>}
                  {stage==='Contacted'&&<button onClick={()=>mv(l,'Interested')} style={{marginTop:7,background:T.oLo,color:T.ok,border:`1px solid ${T.ok}38`,borderRadius:7,padding:'4px 9px',fontSize:11,fontWeight:700,cursor:'pointer',width:'100%'}}>Mark Interested ✓</button>}
                  {stage==='Interested'&&<button onClick={()=>setConv(l)} style={{marginTop:7,background:T.accent,color:'#060A10',border:'none',borderRadius:7,padding:'5px 9px',fontSize:11,fontWeight:800,cursor:'pointer',width:'100%'}}>Convert to Customer →</button>}
                </div>
              ))}
              </div>
            </div>
          );
        })}
      </div>
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
