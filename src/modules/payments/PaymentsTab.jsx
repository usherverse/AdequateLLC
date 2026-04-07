import CustomerProfile from "@/modules/customers/CustomerProfile";
import React, { useState, useMemo } from 'react';
import { CreditCard, Check } from 'lucide-react';
import { T, SC, Card, CH, DT, KPI, Btn, Badge, Search, Pills, FI, Alert, Dialog, RefreshBtn,
  LoanModal, fmt, sbWrite, sbInsert, toSupabasePayment, useContactPopup,
  ModuleHeader } from '@/lms-common';
import { useModuleFilter } from '@/hooks/useModuleFilter';

const PaymentsTab = ({payments,setPayments,loans,setLoans,customers,setCustomers,interactions,setInteractions,workers,addAudit,showToast=()=>{}}) => {
  const {open:openContact, Popup:ContactPopup} = useContactPopup();
  const [selLoan,setSelLoan]=useState(null);
  const [selCust,setSelCust]=useState(null);
  const [showA,setShowA]=useState(null);
  const [af,setAf]=useState({loanId:'',note:''});

  const STATUS_OPTS = ['All', 'Allocated', 'Unallocated', 'Reversal'];

  const {
    q: payQ, setQ: setPayQ, tab: flt, setTab: setFlt,
    startDate, setStartDate, endDate, setEndDate, applyFilter,
    filtered, handleExport
  } = useModuleFilter({
    data: payments,
    initialTab: 'All',
    dateKey: 'date',
    searchFields: ['id', 'customer', 'mpesa', 'loanId', 'status', 'allocatedBy'],
    reportId: 'payments',
    showToast,
    addAudit,
    initialStartDate: '2024-01-01'
  });

  const unalloc = useMemo(() => filtered.filter(p => p.status === 'Unallocated'), [filtered]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const sum = filtered.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const uCount = filtered.filter(p => p.status === 'Unallocated').length;
    return `${total} payments · KES ${fmt(sum)} · ${uCount} unallocated`;
  }, [filtered]);

  const doAlloc=()=>{
    if(!af.loanId)return;
    const loan=loans.find(l=>l.id===af.loanId);
    if(!loan){showToast('⚠ Loan not found. Please select a valid loan.','warn');return;}
    const allocTs=new Date().toLocaleString('en-KE',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
    const allocBy=(af.allocatedBy||'').trim()||'Admin';
    const allocUpd={...showA,status:'Allocated',loanId:af.loanId,customerId:loan.customerId,customer:loan.customer,allocatedBy:allocBy,allocatedAt:allocTs,note:af.note};
    setPayments(ps=>ps.map(p=>p.id===showA.id?allocUpd:p));
    sbWrite('payments',toSupabasePayment(allocUpd));
    const totalPaid = payments.filter(p => p.loanId === af.loanId).reduce((s, p) => s + p.amount, 0) + amt;
    const e = calculateLoanStatus(loan, null, totalPaid);
    
    setLoans(ls => ls.map(l => {
      if (l.id !== af.loanId) return l;
      const newBal = Math.max(l.balance - amt, 0); // Still update balance field for legacy purposes
      const newStatus = e.isSettled ? 'Settled' : l.status;
      return { ...l, balance: newBal, status: newStatus };
    }));
    addAudit('Payment Allocated',showA.id,`${fmt(amt)} → ${af.loanId}`);
    showToast(`✅ Payment of ${fmt(amt)} allocated to ${af.loanId}`,'ok');
    setShowA(null);setAf({loanId:'',note:''});
  };

  const exportCols = [
    { k: 'id', l: 'ID' },
    { k: 'date', l: 'Date' },
    { k: 'amount', l: 'Amount' },
    { k: 'mpesa', l: 'M-Pesa' },
    { k: 'customer', l: 'Customer' },
    { k: 'loanId', l: 'Loan ID' },
    { k: 'status', l: 'Status' },
    { k: 'allocatedBy', l: 'By' }
  ];

  return (
    <div className='fu'>
      {ContactPopup}
      
      <ModuleHeader
        title={<div style={{display:'flex', alignItems:'center', gap:8}}><CreditCard size={20}/> Payments</div>}
        stats={stats}
        refreshProps={{ onRefresh: () => { setPayQ(''); setFlt('All'); setShowA(null); } }}
        search={{ value: payQ, onChange: setPayQ, placeholder: 'Search by customer, M-Pesa or loan ID…' }}
        dateRange={{ start: startDate, end: endDate, onStartChange: setStartDate, onEndChange: setEndDate, onSearch: applyFilter }}
        exportProps={{ onExport: (fmt) => handleExport(fmt, 'Payment Report', exportCols) }}
        pillsProps={{ opts: STATUS_OPTS, val: flt, onChange: setFlt }}
      />

      <div style={{marginBottom:4}}/>
      {unalloc.length>0 && (flt === 'All' || flt === 'Unallocated') && (
        <Card style={{marginBottom:13,border:`1px solid ${T.danger}38`}}>
          <CH title='Unallocated Payments' sub='Match these to a loan'/>
          <DT cols={[{k:'id',l:'ID'},{k:'amount',l:'Amount',r:v=><span style={{color:T.ok,fontFamily:T.mono,fontWeight:700}}>{fmt(v)}</span>},{k:'mpesa',l:'M-Pesa Code'},{k:'date',l:'Date'},{k:'status',l:'Status',r:v=><Badge color={T.danger}>{v}</Badge>}]}
            rows={unalloc} onRow={r=>{setShowA(r);setAf({loanId:'',note:''});}}/>
        </Card>
      )}
      <Card>
        <CH title='All Transactions' sub='Reflecting current filters'/>
        <DT cols={[{k:'id',l:'ID'},{k:'customer',l:'Customer',r:(v,r)=>{const c=customers.find(x=>x.name===v);return v&&v!=='Unknown'?<span onClick={e=>{e.stopPropagation();if(c)setSelCust(c);else openContact(v,r.phone,e);}} style={{color:T.accent,cursor:'pointer',fontWeight:600,borderBottom:`1px dashed ${T.accent}50`}}>{v}</span>:<span style={{color:T.muted}}>{v||'—'}</span>;}},{k:'amount',l:'Amount',r:v=><span style={{color:T.ok,fontFamily:T.mono,fontWeight:700}}>{fmt(v)}</span>},{k:'mpesa',l:'M-Pesa Code'},{k:'loanId',l:'Loan ID'},{k:'date',l:'Date'},{k:'status',l:'Status',r:v=><Badge color={SC[v]||T.muted}>{v}</Badge>},{k:'allocatedBy',l:'By'}]}
          rows={filtered}/>
      </Card>
      {selLoan&&<LoanModal loan={selLoan} customers={customers} payments={payments} interactions={[]} onClose={()=>setSelLoan(null)} onViewCustomer={cust=>{setSelLoan(null);setSelCust(cust);}}/>}
      {selCust&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1000,overflowY:'auto',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'24px 16px'}} onClick={e=>{if(e.target===e.currentTarget)setSelCust(null);}}><div style={{width:'100%',maxWidth:960,borderRadius:16,overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.3)'}}><CustomerProfile customerId={selCust.id} workerContext={{role: "admin", name: "Admin"}} onClose={() => setSelCust(null)} loans={loans} setLoans={setLoans} payments={payments} setPayments={setPayments} interactions={interactions} setInteractions={setInteractions} customers={customers} setCustomers={setCustomers} addAudit={addAudit} onSelectLoan={setSelLoan} /></div></div>}
      {showA&&(
        <Dialog title={`Allocate Payment · ${showA.id}`} onClose={()=>setShowA(null)}>
          <Alert type='info'><b>{fmt(showA.amount)}</b> via M-Pesa {showA.mpesa}</Alert>
          <FI label='Assign to Loan' type='select'
            options={loans.filter(l=>!['Settled','Written off'].includes(l.status)).map(l=>`${l.id} — ${l.customer} (${fmt(l.balance)})`)}
            value={af.loanId?`${af.loanId} — ${loans.find(l=>l.id===af.loanId)?.customer} (${fmt(loans.find(l=>l.id===af.loanId)?.balance)})`:''} required
            onChange={v=>setAf(f=>({...f,loanId:v.split(' — ')[0]}))}/>
          <FI label='Allocated By' value={af.allocatedBy||''} onChange={v=>setAf(f=>({...f,allocatedBy:v}))} placeholder='Officer or name (defaults to Admin)'/>
          <FI label='Note' value={af.note} onChange={v=>setAf(f=>({...f,note:v}))} placeholder='Optional note'/>
          <div style={{display:'flex',gap:9}}><Btn onClick={doAlloc} full><span style={{display:'flex', alignItems:'center', justifyContent:'center', gap:6}}><Check size={16}/> Allocate</span></Btn><Btn v='secondary' onClick={()=>setShowA(null)}>Cancel</Btn></div>
        </Dialog>
      )}
    </div>
  );
};

export default PaymentsTab;
