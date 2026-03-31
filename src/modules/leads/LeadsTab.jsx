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
  useContactPopup, useToast, useReminders, useModalLock } from '@/lms-common';


const LeadsTab = ({leads,setLeads,workers,customers,setCustomers,addAudit,isWorker,currentWorker,showToast=()=>{}}) => {
  const [showNew,setShowNew]=useState(false);
  const [leadQ,setLeadQ]=useState('');
  const [conv,setConv]=useState(null);
  const [f,setF]=useState({name:'',phone:'',business:'',location:'',source:'Referral',officer:currentWorker?.name||''});
  const [showVal,setShowVal]=useState(false);
  const stages=['New','Contacted','Interested','Onboarded','Not Interested'];
  const stageC={New:T.muted,Contacted:T.warn,Interested:T.accent,Onboarded:T.ok,'Not Interested':T.danger};

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
  const VALID_TRANSITIONS={New:['Contacted','Not Interested'],Contacted:['Interested','Not Interested'],Interested:['Onboarded','Not Interested']};
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
    // ── Duplicate guard ──────────────────────────────────────
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

    // -- Upload Sync --
    if(cust.docs && cust.docs.length > 0){
      showToast(`📤 Syncing ${cust.docs.length} documents...`,'info');
      for(const d of cust.docs){
        try { await sbUploadDoc(cust.id, d); }
        catch(e) { console.error('[reg-doc-sync]', e.message); }
      }
    }

    const convUpd={...conv,status:'Onboarded'};
    setLeads(ls=>ls.map(l=>l.id===conv.id?convUpd:l));
    sbWrite('leads',toSupabaseLead(convUpd));
    addAudit('Lead Converted',conv.id,`→ Customer ${cust.id}`);
    showToast(`🎉 Lead converted to customer: ${cust.name}`,'ok',4000);SFX.save();
    setConv(null);
  };

  return (
    <div className='fu'>
      {showVal&&<ValidationPopup fields={showVal} onClose={()=>setShowVal(false)}/>}
      <div className='mob-stack' style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18,gap:10}}>
        <div><div style={{fontFamily:T.head,color:T.txt,fontSize:20,fontWeight:800}}>🎯 Lead Pipeline</div><div style={{color:T.muted,fontSize:13,marginTop:3}}>{leads.length} leads · {leads.filter(l=>l.status==='Interested').length} hot</div></div>
        <div style={{display:'flex',gap:8}}><RefreshBtn onRefresh={()=>{ setLeadQ(''); setConv(null); }}/><Btn onClick={()=>setShowNew(true)}>+ Add Lead</Btn></div>
      </div>
      <div style={{marginBottom:10}}><Search value={leadQ} onChange={setLeadQ} placeholder='Search leads…'/></div>
      <div style={{display:'flex',gap:9,overflowX:'auto',overflowY:'hidden',paddingBottom:6,marginBottom:18,flexWrap:'nowrap'}}
        className='lead-pipeline'>
        {stages.map(stage=>{
          const sl=leads.filter(l=>l.status===stage&&(!leadQ||l.name.toLowerCase().includes(leadQ.toLowerCase())||l.phone.includes(leadQ)));
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
