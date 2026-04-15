import CustomerProfile from "@/modules/customers/CustomerProfile";
import React, { useState, useEffect, useMemo } from 'react';
import { CreditCard, Check, TrendingUp, Wallet, AlertCircle, Clock, ArrowUpRight, Search as SearchIcon, Download, RefreshCw, FileText } from 'lucide-react';
import { T, SC, Card, CH, DT, KPI, Btn, Badge, Search, Pills, FI, Alert, Dialog, RefreshBtn,
  LoanModal, fmt, sbWrite, sbInsert, toSupabasePayment, useContactPopup,
  ModuleHeader, now, calculateLoanStatus } from '@/lms-common';
import { useModuleFilter } from '@/hooks/useModuleFilter';

const PaymentsTab = ({payments,setPayments,loans,setLoans,customers,setCustomers,interactions,setInteractions,workers,addAudit,showToast=()=>{},onRefresh,onOpenCustomerProfile}) => {
  const {open:openContact, Popup:ContactPopup} = useContactPopup();
  const [selLoan,setSelLoan]=useState(null);
  const [showA,setShowA]=useState(null);
  const [af,setAf]=useState({loanId:'',note:''});
  const [showUnalloc, setShowUnalloc] = useState(false);

  const STATUS_OPTS = ['Allocated', 'Unallocated'];

  const {
    q: payQ, setQ: setPayQ, tab: flt, setTab: setFlt,
    startDate, setStartDate, endDate, setEndDate, applyFilter,
    filtered, handleExport
  } = useModuleFilter({
    data: payments,
    initialTab: 'Allocated',
    dateKey: 'date',
    searchFields: ['id', 'customer', 'mpesa', 'loanId', 'status', 'allocatedBy'],
    reportId: 'payments',
    showToast,
    addAudit,
    initialStartDate: '2024-01-01'
  });

  const unalloc = useMemo(() => filtered.filter(p => p.status === 'Unallocated'), [filtered]);

  const kpis = useMemo(() => {
    const today = now().split('T')[0];
    const totalColl = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const todayColl = payments.filter(p => p.date && p.date.includes(today)).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const unallocCount = payments.filter(p => p.status === 'Unallocated').length;
    const peakPay = Math.max(...payments.map(p => Number(p.amount) || 0), 0);

    return [
      { label: 'Total Revenue', val: `KES ${fmt(totalColl)}`, icon: Wallet, color: T.accent, desc: 'Lifetime allocation' },
      { label: 'Today\'s Yield', val: `KES ${fmt(todayColl)}`, icon: TrendingUp, color: T.ok, desc: 'Real-time intake' },
      { label: 'Unallocated', val: unallocCount, icon: AlertCircle, color: T.danger, desc: 'Action required' },
      { label: 'Largest Entry', val: `KES ${fmt(peakPay)}`, icon: ArrowUpRight, color: T.gold, desc: 'High-value single' },
    ];
  }, [payments]);

  const doAlloc=()=>{
    if(!af.loanId)return;
    const loan=loans.find(l=>l.id===af.loanId);
    if(!loan){showToast('⚠ Loan not found. Please select a valid loan.','warn');return;}
    const allocTs=new Date().toLocaleString('en-KE',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
    const allocBy=(af.allocatedBy||'').trim()||'Admin';
    const amt = Number(showA.amount || 0);
    const allocUpd={...showA,status:'Allocated',loanId:af.loanId,customerId:loan.customerId,customer:loan.customer,allocatedBy:allocBy,allocatedAt:allocTs,note:af.note};
    setPayments(ps=>ps.map(p=>p.id===showA.id?allocUpd:p));
    sbWrite('payments',toSupabasePayment(allocUpd));
    const totalPaid = payments.filter(p => p.loanId === af.loanId).reduce((s, p) => s + (Number(p.amount) || 0), 0) + amt;
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
        title={<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ background: `${T.accent}15`, padding: 8, borderRadius: 12 }}><CreditCard size={24} color={T.accent} /></div> Payments Hub</div>}
        refreshProps={{ onRefresh: () => { onRefresh?.(); setPayQ(''); setFlt('All'); setShowA(null); } }}
        search={{ value: payQ, onChange: setPayQ, placeholder: 'Search by customer, M-Pesa or loan ID…' }}
        dateRange={{ start: startDate, end: endDate, onStartChange: setStartDate, onEndChange: setEndDate, onSearch: applyFilter }}
        exportProps={{ onExport: (fmt) => handleExport(fmt, 'Payment Report', exportCols) }}
        pillsProps={{ opts: STATUS_OPTS, val: flt, onChange: setFlt }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
        {kpis.map((k, i) => (
          <Card key={i} style={{ padding: '20px 24px', position: 'relative', overflow: 'hidden' }}>
             <div style={{ position: 'absolute', top: -10, right: -10, opacity: 0.03 }}><k.icon size={80} color={k.color} /></div>
             <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ background: `${k.color}15`, color: k.color, padding: 8, borderRadius: 10 }}>
                   <k.icon size={20} />
                </div>
                <div style={{ color: T.dim, fontSize: 13, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase' }}>{k.label}</div>
             </div>
             <div style={{ color: T.txt, fontSize: 22, fontWeight: 950, letterSpacing: '-0.02em' }}>{k.val}</div>
             <div style={{ color: T.dim, fontSize: 11, marginTop: 4, fontWeight: 600 }}>{k.desc}</div>
          </Card>
        ))}
      </div>

      <div style={{marginBottom:4}}/>
      {unalloc.length > 0 && (
        <Card style={{marginBottom:13, border: `1px solid ${showUnalloc ? T.danger : T.border}38`, transition: 'all .2s'}}>
          <div 
            onClick={() => setShowUnalloc(!showUnalloc)}
            style={{
              padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: showUnalloc ? `${T.danger}08` : 'transparent',
              borderBottom: showUnalloc ? `1px solid ${T.border}` : 'none'
            }}
          >
            <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
              <div style={{width: 38, height: 38, borderRadius: 8, background: `${T.danger}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.danger}}>
                📂
              </div>
              <div>
                <div style={{fontWeight: 800, color: T.txt, fontSize: 14}}>Unallocated Payments</div>
                <div style={{fontSize: 11, color: T.muted}}>Click to {showUnalloc ? 'collapse' : 'expand'} list</div>
              </div>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
               <Badge color={T.danger}>{unalloc.length} Pending</Badge>
               <span style={{color: T.muted, transform: showUnalloc ? 'rotate(180deg)' : 'none', transition: 'transform .2s'}}>▼</span>
            </div>
          </div>
          {showUnalloc && (
            <div style={{padding: '0 4px 4px 4px'}}>
              <DT cols={[{k:'id',l:'ID'},{k:'amount',l:'Amount',r:v=><span style={{color:T.ok,fontFamily:T.mono,fontWeight:700}}>{fmt(v)}</span>},{k:'mpesa',l:'M-Pesa Code'},{k:'date',l:'Date'},{k:'status',l:'Status',r:v=><Badge color={T.danger}>{v}</Badge>}]}
                rows={unalloc} onRow={r=>{setShowA(r);setAf({loanId:'',note:''});}}/>
            </div>
          )}
        </Card>
      )}
      <Card style={{ padding: 0, borderRadius: 24, overflow: 'hidden' }}>
        <CH 
          title='Financial Ledger' 
          sub={`Total of KES ${fmt(filtered.reduce((s, p) => s + (Number(p.amount) || 0), 0))} across visible transactions`}
          style={{ padding: '24px 24px 16px' }}
        />
        <div style={{ padding: '0 12px 12px' }}>
          <DT 
            cols={[
              { k: 'id', l: 'TRX ID', r: v => <span style={{ fontFamily: T.mono, fontSize: 11, opacity: 0.7 }}>{v}</span> },
              { 
                k: 'customer', l: 'Borrower', 
                r: (v, r) => {
                  const c = customers.find(x => x.name === v);
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${T.accent}15`, color: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900 }}>
                        {v?.charAt(0) || '?'}
                      </div>
                      <div>
                        <div 
                          onClick={e => { e.stopPropagation(); if (c) onOpenCustomerProfile?.(c.id); else openContact(v, r.phone, e); }} 
                          style={{ color: T.txt, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}
                        >
                          {v || 'Unknown'}
                        </div>
                        <div style={{ fontSize: 11, color: T.dim }}>{r.mpesa || 'Direct Cash'}</div>
                      </div>
                    </div>
                  );
                } 
              },
              { k: 'amount', l: 'Amount', r: v => <span style={{ color: T.ok, fontFamily: T.mono, fontWeight: 800, fontSize: 15 }}>KES {fmt(v)}</span> },
              { k: 'loanId', l: 'Allocation', r: v => v ? <Badge color={T.accent} alpha={0.1}><Clock size={10} style={{marginRight:4}}/> {v}</Badge> : <span style={{color:T.dim, fontSize:12}}>—</span> },
              { k: 'date', l: 'Timestamp', r: v => <div style={{ fontSize: 12, fontWeight: 600 }}>{v}</div> },
              { k: 'status', l: 'Status', r: v => <Badge color={SC[v] || T.muted} variant="capsule">{v}</Badge> },
              { k: 'allocatedBy', l: 'By', r: v => <span style={{ fontSize: 12, opacity: 0.8 }}>{v || 'System'}</span> }
            ]}
            rows={filtered}
          />
        </div>
      </Card>
      {selLoan&&<LoanModal loan={selLoan} customers={customers} payments={payments} interactions={[]} onClose={()=>setSelLoan(null)} onViewCustomer={cust=>{setSelLoan(null);onOpenCustomerProfile?.(cust.id);}}/>}
      {/* Global Customer Profile now handled via onOpenCustomerProfile */}
      {showA && (
        <Dialog title="Payment Allocation" onClose={() => setShowA(null)}>
          <div style={{ marginBottom: 24, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, background: `${T.ok}15`, color: T.ok, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Wallet size={32} />
            </div>
            <div style={{ color: T.txt, fontWeight: 900, fontSize: 24, letterSpacing: '-0.02em' }}>KES {fmt(showA.amount)}</div>
            <div style={{ color: T.dim, fontSize: 13, marginTop: 4 }}>Ref: {showA.mpesa} · {showA.date}</div>
          </div>

          <div style={{ display: 'grid', gap: 20 }}>
            <FI 
              label='Destination Loan' 
              type='select'
              variant="modern"
              options={loans.filter(l => !['Settled', 'Written off'].includes(l.status)).map(l => `${l.id} — ${l.customer} (Bal: ${fmt(l.balance)})`)}
              value={af.loanId ? `${af.loanId} — ${loans.find(l => l.id === af.loanId)?.customer} (Bal: ${fmt(loans.find(l => l.id === af.loanId)?.balance)})` : ''} 
              required
              onChange={v => setAf(f => ({ ...f, loanId: v.split(' — ')[0] }))}
            />
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <FI label='Allocated By' value={af.allocatedBy || ''} onChange={v => setAf(f => ({ ...f, allocatedBy: v }))} placeholder='Officer name' />
              <FI label='Reference Note' value={af.note} onChange={v => setAf(f => ({ ...f, note: v }))} placeholder='Allocation context' />
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <Btn onClick={doAlloc} full style={{ height: 48, borderRadius: 14 }}>
                 <Check size={18} style={{ marginRight: 8 }} /> Confirm Allocation
              </Btn>
              <Btn v='secondary' onClick={() => setShowA(null)} style={{ height: 48, borderRadius: 14 }}>Cancel</Btn>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};

export default PaymentsTab;
