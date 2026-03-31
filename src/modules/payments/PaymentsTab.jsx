import CustomerProfile from "@/modules/customers/CustomerProfile";
import React, { useState, useMemo } from 'react';
import { T, SC, Card, CH, DT, Btn, Badge, Search, FI, Alert, Dialog, RefreshBtn,
  LoanModal, fmt, sbWrite, sbInsert, toSupabasePayment, useContactPopup } from '@/lms-common';

const PaymentsTab = ({payments,setPayments,loans,setLoans,customers,setCustomers,interactions,setInteractions,workers,addAudit,showToast=()=>{}}) => {
  const {open:openContact, Popup:ContactPopup} = useContactPopup();
  const [payQ,setPayQ]=useState('');
  const [selLoan,setSelLoan]=useState(null);
  const [selCust,setSelCust]=useState(null);
  const unalloc=useMemo(()=>payments.filter(p=>p.status==='Unallocated'),[payments]);
  const filteredPayments=useMemo(()=>{
    const lq=payQ.trim().toLowerCase();
    if(!lq) return payments;
    return payments.filter(p=>
      (p.id||'').toLowerCase().includes(lq)||
      (p.customer||'').toLowerCase().includes(lq)||
      (p.mpesa||'').toLowerCase().includes(lq)||
      (p.loanId||'').toLowerCase().includes(lq)||
      (p.status||'').toLowerCase().includes(lq)||
      (p.allocatedBy||'').toLowerCase().includes(lq)||
      String(p.amount||'').includes(lq)
    );
  },[payments,payQ]);
  const [showA,setShowA]=useState(null);
  const [af,setAf]=useState({loanId:'',note:''});
  const doAlloc=()=>{
    if(!af.loanId)return;
    const loan=loans.find(l=>l.id===af.loanId);
    if(!loan){showToast('⚠ Loan not found. Please select a valid loan.','warn');return;}
    const allocTs=new Date().toLocaleString('en-KE',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
    const allocBy=(af.allocatedBy||'').trim()||'Admin';
    const allocUpd={...showA,status:'Allocated',loanId:af.loanId,customerId:loan.customerId,customer:loan.customer,allocatedBy:allocBy,allocatedAt:allocTs,note:af.note};
    setPayments(ps=>ps.map(p=>p.id===showA.id?allocUpd:p));
    sbWrite('payments',toSupabasePayment(allocUpd));
    const amt=showA.amount;
    setLoans(ls=>ls.map(l=>{
      if(l.id!==af.loanId) return l;
      const newBal = Math.max(l.balance - amt, 0);
      const newStatus = newBal <= 0 ? 'Settled' : (l.status==='Settled' ? 'Settled' : l.status);
      return {...l, balance:newBal, status:newStatus};
    }));
    addAudit('Payment Allocated',showA.id,`${fmt(amt)} → ${af.loanId}`);
    showToast(`✅ Payment of ${fmt(amt)} allocated to ${af.loanId}`,'ok');
    setShowA(null);setAf({loanId:'',note:''});
  };
  return (
    <div className='fu'>
      {ContactPopup}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4,flexWrap:'wrap',gap:8}}>
        <div>
          <div style={{fontFamily:T.head,color:T.txt,fontSize:20,fontWeight:800}}>💳 Payments</div>
          <div style={{color:T.muted,fontSize:13,marginTop:2}}>{payments.length} total · <span style={{color:T.danger}}>{unalloc.length} unallocated</span></div>
        </div>
        <RefreshBtn onRefresh={()=>{ setPayQ(''); setShowA(null); }}/>
      </div>
      <div style={{marginBottom:10}}><Search value={payQ} onChange={setPayQ} placeholder='Search by customer, M-Pesa or loan ID…'/></div>
      <div style={{marginBottom:4}}/>
      {unalloc.length>0&&(
        <Card style={{marginBottom:13,border:`1px solid ${T.danger}38`}}>
          <CH title='Unallocated Payments' sub='Match these to a loan'/>
          <DT cols={[{k:'id',l:'ID'},{k:'amount',l:'Amount',r:v=><span style={{color:T.ok,fontFamily:T.mono,fontWeight:700}}>{fmt(v)}</span>},{k:'mpesa',l:'M-Pesa Code'},{k:'date',l:'Date'},{k:'status',l:'Status',r:v=><Badge color={T.danger}>{v}</Badge>}]}
            rows={unalloc} onRow={r=>{setShowA(r);setAf({loanId:'',note:''});}}/>
        </Card>
      )}
      <Card>
        <CH title='All Payments'/>
        <DT cols={[{k:'id',l:'ID'},{k:'customer',l:'Customer',r:(v,r)=>{const c=customers.find(x=>x.name===v);return v&&v!=='Unknown'?<span onClick={e=>{e.stopPropagation();if(c)setSelCust(c);else openContact(v,r.phone,e);}} style={{color:T.accent,cursor:'pointer',fontWeight:600,borderBottom:`1px dashed ${T.accent}50`}}>{v}</span>:<span style={{color:T.muted}}>{v||'—'}</span>;}},{k:'amount',l:'Amount',r:v=><span style={{color:T.ok,fontFamily:T.mono,fontWeight:700}}>{fmt(v)}</span>},{k:'mpesa',l:'M-Pesa Code'},{k:'loanId',l:'Loan ID'},{k:'date',l:'Date'},{k:'status',l:'Status',r:v=><Badge color={SC[v]||T.muted}>{v}</Badge>},{k:'allocatedBy',l:'By'}]}
          rows={filteredPayments}/>
      </Card>
      {selLoan&&<LoanModal loan={selLoan} customers={customers} payments={payments} interactions={[]} onClose={()=>setSelLoan(null)} onViewCustomer={cust=>{setSelLoan(null);setSelCust(cust);}}/>}
      {selCust&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1000,overflowY:'auto',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'24px 16px'}} onClick={e=>{if(e.target===e.currentTarget)setSelCust(null);}}><div style={{width:'100%',maxWidth:960,borderRadius:16,overflow:'hidden',boxShadow:'0 25px 50px rgba(0,0,0,0.3)'}}><CustomerProfile customerId={selCust.id} workerContext={{role: "admin", name: "Admin"}} onClose={()=>setSelCust(null)} loans={loans} setLoans={setLoans} payments={payments} setPayments={setPayments} interactions={interactions} setInteractions={setInteractions} customers={customers} setCustomers={setCustomers} addAudit={addAudit} onSelectLoan={setSelLoan} /></div></div>}
      {showA&&(
        <Dialog title={`Allocate Payment · ${showA.id}`} onClose={()=>setShowA(null)}>
          <Alert type='info'><b>{fmt(showA.amount)}</b> via M-Pesa {showA.mpesa}</Alert>
          <FI label='Assign to Loan' type='select'
            options={loans.filter(l=>!['Settled','Written off'].includes(l.status)).map(l=>`${l.id} — ${l.customer} (${fmt(l.balance)})`)}
            value={af.loanId?`${af.loanId} — ${loans.find(l=>l.id===af.loanId)?.customer} (${fmt(loans.find(l=>l.id===af.loanId)?.balance)})`:''} required
            onChange={v=>setAf(f=>({...f,loanId:v.split(' — ')[0]}))}/>
          <FI label='Allocated By' value={af.allocatedBy||''} onChange={v=>setAf(f=>({...f,allocatedBy:v}))} placeholder='Officer or name (defaults to Admin)'/>
          <FI label='Note' value={af.note} onChange={v=>setAf(f=>({...f,note:v}))} placeholder='Optional note'/>
          <div style={{display:'flex',gap:9}}><Btn onClick={doAlloc} full>✓ Allocate</Btn><Btn v='secondary' onClick={()=>setShowA(null)}>Cancel</Btn></div>
        </Dialog>
      )}
    </div>
  );
};

export default PaymentsTab;
