import CustomerProfile from "@/modules/customers/CustomerProfile";
import React, { useState, useMemo, useRef } from 'react';
import { Smartphone, Car, FileText, Scale, XCircle, AlertOctagon, AlertTriangle, HeartCrack, PhoneCall, Check } from 'lucide-react';
import { T, RC, Card, CH, DT, KPI, Btn, Badge, FI, Alert, Dialog, Search, RefreshBtn,
  LoanModal, fmt, fmtM, uid, now, sbInsert, toSupabaseInteraction,
  useContactPopup, calculateLoanStatus, SFX, 
  ModuleHeader, generateCollectionLetterHTML, downloadLoanDoc } from '@/lms-common';
import { useModuleFilter } from '@/hooks/useModuleFilter';
import { initiateStkPush } from '@/utils/mpesa';

const PIPELINE_STAGES = [
  {id:'Reminder',label:'Reminder',color:T.warn,icon:<Smartphone size={24}/>,desc:'First contact — SMS and phone reminders',actions:['Generate Letter','Send SMS Reminder','Make Phone Call','Send WhatsApp Message'],template:'Dear [Customer], your loan of [Amount] is now overdue. Please make payment immediately.'},
  {id:'Field Visit',label:'Field Visit',color:T.blue,icon:<Car size={24}/>,desc:'Officer physically visits borrower',actions:['Schedule Visit','Mark Visit Complete','Escalate to Supervisor'],template:'Field visit report: Customer [Name] at [Location].'},
  {id:'Demand Letter',label:'Demand Letter',color:T.danger,icon:<FileText size={24}/>,desc:'Formal written demand with 7-day deadline',actions:['Generate Letter','Send via Registered Mail','Mark Delivered'],template:'FORMAL DEMAND: Your loan of [Amount] is immediately due.'},
  {id:'Final Notice',label:'Final Notice',color:T.danger,icon:<AlertTriangle size={24}/>,desc:'Final warning before legal action',actions:['Generate Letter','Issue Final Notice','Engage Guarantor','Contact Next of Kin'],template:'FINAL NOTICE: Last opportunity to settle [Amount] before legal action.'},
  {id:'Legal',label:'Legal',color:T.purple,icon:<Scale size={24}/>,desc:'Matter referred to legal team',actions:['File in Court','Engage Debt Collector','Attach Assets'],template:'Legal proceedings initiated.'},
  {id:'Written Off',label:'Write Off',color:T.muted,icon:<XCircle size={24}/>,desc:'Loan written off as unrecoverable',actions:['Approve Write-Off','Update Books','Blacklist Customer'],template:'Loan written off after all recovery attempts exhausted.'},
];

const CollectionsTab = ({loans,customers,payments,setPayments,interactions,setInteractions,workers,setLoans,setCustomers,addAudit,scrollTop,currentUser='Admin', showToast = () => {}}) => {
  const {open:openContact, Popup:ContactPopup} = useContactPopup();
  
  const {
    q: collQ, setQ: setCollQ, startDate, setStartDate, endDate, setEndDate, applyFilter,
    filtered: ov, handleExport
  } = useModuleFilter({
    data: useMemo(() => {
      const paidMap = payments.reduce((acc, p) => {
        if (p.loanId && p.status === "Allocated")
          acc[p.loanId] = (acc[p.loanId] || 0) + p.amount;
        return acc;
      }, {});
      return loans.filter(l => {
        const p = paidMap[l.id] || 0;
        const e = calculateLoanStatus(l, null, p);
        return e.overdueDays > 0 && !e.isSettled && !e.isWrittenOff;
      }).map(l => {
        const p = paidMap[l.id] || 0;
        const e = calculateLoanStatus(l, null, p);
        return { ...l, balance: e.totalAmountDue, daysOverdue: e.overdueDays, totalDays: e.totalDays };
      });
    }, [loans, payments]),
    initialTab: 'All',
    dateKey: (l) => {
      if (!l.disbursed) return null;
      const d = new Date(l.disbursed);
      d.setDate(d.getDate() + 30);
      return d.toISOString().split('T')[0];
    },
    searchFields: ['id', 'customer', 'phone', 'officer'],
    reportId: 'collections',
    showToast,
    addAudit
  });

  const filteredInteractions = useMemo(() => {
    return interactions.filter(i => {
      const d = (i.date || '').split('T')[0];
      const matchDate = (!startDate || d >= startDate) && (!endDate || d <= endDate);
      const lq = collQ.toLowerCase().trim();
      const matchSearch = !lq || i.loanId.toLowerCase().includes(lq) || (i.notes && i.notes.toLowerCase().includes(lq));
      return matchDate && matchSearch;
    });
  }, [interactions, startDate, endDate, collQ]);

  const ovTotal = useMemo(() => {
    return ov.reduce((s, l) => s + l.balance, 0);
  }, [ov]);

  const [showInt,setShowInt]=useState(null);
  const [iF,setIF]=useState({type:'Phone Call',notes:'',pAmt:'',pDate:'',officer:currentUser});
  const [pipeStage,setPipeStage]=useState(null);
  const [pipeAction,setPipeAction]=useState(null);
  const [selLoan,setSelLoanRaw]=useState(null);
  const [modalLoan,setModalLoan]=useState(null);
  const [modalCust,setModalCust]=useState(null);
  const [kpiDrill,setKpiDrillRaw]=useState(null);
  const [loading,setLoading]=useState(false);
  const setKpiDrill = (d) => { setKpiDrillRaw(d); if(d) setTimeout(()=>{ try{scrollTop?.();}catch(e){} },20); };

  const addInt=(loan)=>{
    if(!iF.notes)return;
    const l=loan||showInt;
    const cust=customers.find(c=>c.name===l.customer);
    const entry={id:uid('INT'),customerId:cust?.id||'',loanId:l.id,type:iF.type,date:now(),officer:iF.officer||'Admin',notes:iF.notes,promiseAmount:iF.pAmt||null,promiseDate:iF.pDate||null,promiseStatus:iF.pAmt?'Pending':null};
    setInteractions(is=>[entry,...is]);
    sbInsert('interactions',toSupabaseInteraction(entry));
    addAudit('Interaction Logged',l.id,`${iF.type}: ${iF.notes.slice(0,40)}`);
    setShowInt(null);setIF({type:'Phone Call',notes:'',pAmt:'',pDate:'',officer:currentUser});
  };
  const doAction=(stage,action)=>{
    if(!selLoan)return;
    const cust=customers.find(c=>c.name===selLoan.customer);
    
    if (action === 'Generate Letter') {
      const paid = payments.filter(p => p.loanId === selLoan.id).reduce((a, p) => a + p.amount, 0);
      const e = calculateLoanStatus(selLoan, null, paid);
      
      const html = generateCollectionLetterHTML(stage.id, selLoan, cust, iF.officer || currentUser, e.totalAmountDue);
      downloadLoanDoc(html, `${stage.id.toLowerCase().replace(/\s+/g,'-')}-${selLoan.id}.html`);
      showToast(`✅ ${stage.id} generated for ${selLoan.customer}`, 'ok');
      setPipeAction(null);
      return;
    }

    const notes=`${stage.label}: ${action}. ${stage.template.replace('[Customer]',selLoan.customer).replace('[Amount]',fmt(selLoan.balance)).replace('[Name]',selLoan.customer).replace('[Location]','(location)')}`;
    setInteractions(is=>[{id:uid('INT'),customerId:cust?.id||'',loanId:selLoan.id,type:stage.label,date:now(),officer:iF.officer||'Admin',notes,promiseAmount:null,promiseDate:null,promiseStatus:null},...is]);
    addAudit(`Recovery: ${action}`,selLoan.id,`Stage: ${stage.label}`);
    if(stage.id==='Written Off'&&action.includes('Write-Off'))setLoans(ls=>ls.map(l=>l.id===selLoan.id?{...l,status:'Written off'}:l));
    if(stage.id==='Written Off'&&action.includes('Blacklist'))setCustomers(cs=>cs.map(c=>c.id===cust?.id?{...c,blacklisted:true,blReason:'Non-cooperation / Write-off'}:c));
    setPipeAction(null);setSelLoanRaw(null);setPipeStage(null);
  };

  const doStkPush = async (loan) => {
    if (!loan) return;
    const cust = customers.find(c => c.name === loan.customer);
    if (!cust) return;

    setLoading(true);
    try {
      const amount = iF.pAmt || loan.balance;
      const res = await initiateStkPush({
        amount: Number(amount),
        phone_number: cust.phone || loan.phone,
        customer_id: cust.id
      });
      if (res.success) {
        showToast('📲 STK Push request sent to customer phone.', 'ok');
        addAudit('M-Pesa STK Push Requested', loan.id, `KES ${amount} requested`);
      } else {
        throw new Error(res.error || 'Failed to initiate push');
      }
    } catch (err) {
      showToast('❌ M-Pesa Error: ' + err.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='fu'>
      {ContactPopup}
      
      <ModuleHeader
        title="📞 Collections & Recovery"
        stats={`${ov.length} overdue · ${fmt(ovTotal)} outstanding`}
        refreshProps={{ onRefresh: () => { setCollQ(''); setShowInt(null); setPipeStage(null); setKpiDrill(null); } }}
        search={{ value: collQ, onChange: setCollQ, placeholder: 'Search overdue by customer or loan ID…' }}
        dateRange={{ start: startDate, end: endDate, onStartChange: setStartDate, onEndChange: setEndDate, onSearch: applyFilter }}
        exportProps={{ 
          onExport: (fmt) => {
            const cols = [
              { k: 'id', l: 'Loan ID' },
              { k: 'customer', l: 'Customer' },
              { k: 'balance', l: 'Balance' },
              { k: 'daysOverdue', l: 'Days' },
              { k: 'officer', l: 'Officer' }
            ];
            handleExport(fmt, 'Overdue Registry', cols);
          }
        }}
      />
      
      {kpiDrill&&(
        <div className='dialog-backdrop' style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:9900,display:'flex',alignItems:'flex-start',justifyContent:'center',background:'rgba(4,8,16,0.72)',backdropFilter:'var(--glass-blur)',WebkitBackdropFilter:'var(--glass-blur)',overflow:'hidden'}}>
          <div className='pop' style={{background:T.card,border:`1px solid ${kpiDrill.color}40`,borderBottom:`1px solid ${T.border}`,borderRadius:'0 0 18px 18px',width:'100%',maxWidth:'100%',maxHeight:'75vh',display:'flex',flexDirection:'column',boxShadow:`0 12px 48px rgba(0,0,0,0.7),0 0 0 1px ${kpiDrill.color}20`}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 18px',borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:4,height:20,borderRadius:99,background:kpiDrill.color,flexShrink:0}}/>
                <h3 style={{color:T.txt,fontSize:15,fontWeight:800,fontFamily:T.head,margin:0}}>{kpiDrill.title}</h3>
                <span style={{color:kpiDrill.color,fontFamily:T.mono,fontSize:12,fontWeight:700,background:kpiDrill.color+'18',padding:'2px 8px',borderRadius:99}}>{kpiDrill.rows.length}</span>
              </div>
              <button onClick={()=>setKpiDrill(null)} style={{background:T.card2,border:`1px solid ${T.border}`,color:T.muted,borderRadius:99,width:28,height:28,cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:'auto',overflowX:'auto'}}>
              {kpiDrill.type==='loans'
                ?<DT
                    cols={[
                      {k:'id',l:'Loan ID',r:v=><span style={{color:T.accent,fontFamily:T.mono,fontWeight:700,fontSize:12}}>{v}</span>},
                      {k:'customer',l:'Customer',r:(v,r)=>{const c=customers.find(x=>x.name===v);return <span onClick={e=>{e.stopPropagation();openContact(v,c?.phone,e);}} style={{color:T.accent,cursor:'pointer',fontWeight:600,borderBottom:`1px dashed ${T.accent}50`}}>{v}</span>;}},
                      {k:'balance',l:'Remaining',r:(v,r)=>{
                        const paid = payments.filter(p => p.loanId === r.id).reduce((a, p) => a + p.amount, 0);
                        const e = calculateLoanStatus(r, null, paid);
                        return fmt(e.totalAmountDue);
                      }},
                      {k:'totalDays',l:'Days',r:v=><span style={{color:v>120?T.danger:T.warn,fontWeight:800,fontFamily:T.mono}}>{v}d</span>},
                      {k:'daysOverdue',l:'Total Due',r:(_,r)=>{
                        const paid = payments.filter(p => p.loanId === r.id).reduce((a, p) => a + p.amount, 0);
                        const e=calculateLoanStatus(r, null, paid);
                        return <span style={{color:T.accent,fontFamily:T.mono}}>{fmt(e.totalPayable)}</span>;
                      }},
                      {k:'risk',l:'Risk',r:v=><Badge color={RC[v]}>{v}</Badge>},
                      {k:'officer',l:'Officer'},
                    ]}
                    rows={kpiDrill.rows}
                    onRow={r=>setShowInt(r)}
                  />
                :<DT
                    cols={[
                      {k:'date',l:'Date'},
                      {k:'loanId',l:'Loan'},
                      {k:'type',l:'Type',r:v=><Badge color={T.accent}>{v}</Badge>},
                      {k:'officer',l:'Officer'},
                      {k:'notes',l:'Notes',r:v=><span style={{color:T.dim,fontSize:12}}>{v?.slice(0,60)}{v?.length>60?'…':''}</span>},
                      {k:'promiseAmount',l:'Promise',r:v=>v?<span style={{color:T.gold,fontFamily:T.mono}}>{fmt(v)}</span>:'—'},
                      {k:'promiseStatus',l:'Status',r:v=>v?<Badge color={v==='Pending'?T.warn:v==='Kept'?T.ok:T.danger}>{v}</Badge>:'—'},
                    ]}
                    rows={kpiDrill.rows}
                  />
              }
            </div>
          </div>
        </div>
      )}
      <div style={{marginBottom:6}}/>
      <div className='kpi-row' style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
        <KPI label='Newly Overdue' icon={AlertOctagon}
          value={ov.filter(l=>l.daysOverdue >= 1 && l.daysOverdue < 2).length} color={T.danger} delay={1}
          onClick={()=>{
            const rows=ov.filter(l=>l.daysOverdue >= 1 && l.daysOverdue < 2).sort((a,b)=>b.daysOverdue-a.daysOverdue);
            setKpiDrill({title:'Newly Overdue Loans (1 day)',color:T.danger,rows,type:'loans'});
            try{SFX.notify();}catch(e){}
          }}/>
        <KPI label='Total Overdue' icon={AlertTriangle}
          value={fmtM(ovTotal)} color={T.danger} delay={2}
          onClick={()=>{
            const rows=[...ov].sort((a,b)=>b.daysOverdue-a.daysOverdue);
            setKpiDrill({title:'All Overdue Loans',color:T.danger,rows,type:'loans'});
            try{SFX.notify();}catch(e){}
          }}/>
        <KPI label='Broken Promises' icon={HeartCrack}
          value={interactions.filter(i=>i.promiseStatus==='Broken').length} color={T.warn} delay={3}
          onClick={()=>{
            const rows=interactions.filter(i=>i.promiseStatus==='Broken');
            setKpiDrill({title:'Broken Promise Interactions',color:T.warn,rows,type:'interactions'});
            try{SFX.notify();}catch(e){}
          }}/>
        <KPI label='Interactions' icon={PhoneCall}
          value={interactions.length} color={T.accent} delay={4}
          onClick={()=>{
            setKpiDrill({title:'All Interactions',color:T.accent,rows:interactions,type:'interactions'});
            try{SFX.notify();}catch(e){}
          }}/>
      </div>
      <Card style={{marginBottom:13}}>
        <CH title='Recovery Pipeline'/>
        <div style={{padding:'13px 13px 6px'}}>
          <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:7}}>
            {PIPELINE_STAGES.map(stage=>(
              <div key={stage.id} onClick={()=>{setPipeStage(stage);setSelLoanRaw(null);}}
                style={{flex:'0 0 auto',width:110,background:T.surface,border:`1px solid ${pipeStage?.id===stage.id?stage.color:T.border}`,borderRadius:10,padding:'10px 8px',textAlign:'center',cursor:'pointer',transition:'all .2s'}}>
                <div style={{fontSize:20,marginBottom:5}}>{stage.icon}</div>
                <div style={{color:stage.color,fontWeight:800,fontSize:18,fontFamily:T.mono}}>
                  {stage.id==='Reminder'?ov.length:stage.id==='Written Off'?loans.filter(l=>{
                    const paid = payments.filter(p => p.loanId === l.id && p.status === "Allocated").reduce((s, p) => s + p.amount, 0);
                    return calculateLoanStatus(l, null, paid).isWrittenOff;
                  }).length:0}
                </div>
                <div style={{color:T.dim,fontSize:10,marginTop:3,fontWeight:600}}>{stage.label}</div>
              </div>
            ))}
          </div>
          {pipeStage&&(
            <div style={{background:T.bg,border:`1px solid ${pipeStage.color}30`,borderRadius:10,padding:14,marginTop:7}}>
              <div style={{color:pipeStage.color,fontWeight:800,fontSize:14,fontFamily:T.head,marginBottom:4}}>{pipeStage.icon} {pipeStage.label}</div>
              <div style={{color:T.muted,fontSize:12,marginBottom:10}}>{pipeStage.desc}</div>
              <select value={selLoan?.id||''} onChange={e=>setSelLoanRaw(ov.find(l=>l.id===e.target.value)||null)}
                style={{width:'100%',background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:'9px 12px',color:T.txt,fontSize:13,outline:'none',marginBottom:10}}>
                <option value=''>— Select overdue loan —</option>
                {ov.map(l=><option key={l.id} value={l.id}>{l.id} · {l.customer} · {fmt(l.balance)} · {l.daysOverdue}d</option>)}
              </select>
              {selLoan&&<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {pipeStage.actions.map(action=>(
                  <Btn key={action} sm v={pipeStage.id==='Written Off'?'danger':'blue'} onClick={()=>setPipeAction({stage:pipeStage,action,loan:selLoan})}>{action}</Btn>
                ))}
              </div>}
            </div>
          )}
        </div>
      </Card>
      <Card style={{marginBottom:13}}>
        <CH title='Overdue Accounts'/>
        <DT cols={[{k:'id',l:'Loan ID',r:(v,row)=><span onClick={e=>{e.stopPropagation();setModalLoan(row);}} style={{color:T.accent,fontFamily:T.mono,fontWeight:700,fontSize:12,cursor:'pointer',borderBottom:`1px dashed ${T.accent}50`}}>{v}</span>},{k:'customer',l:'Customer',r:(v,r)=>{const c=customers.find(x=>x.name===v);return <span onClick={e=>{e.stopPropagation();if(c)setModalCust(c);else openContact(v,r.phone,e);}} style={{color:T.accent,cursor:'pointer',fontWeight:600,borderBottom:`1px dashed ${T.accent}50`}}>{v}</span>;}},{k:'balance',l:'Remaining',r:(v,r)=>{
            const paid = payments.filter(p => p.loanId === r.id).reduce((a, p) => a + p.amount, 0);
            const e = calculateLoanStatus(r, null, paid);
            return <span style={{color:e.totalAmountDue > 0 ? (e.isFrozen?T.muted:T.danger) : T.ok,fontFamily:T.mono,fontWeight:700}}>{fmt(e.totalAmountDue)}</span>;
          }},{k:'totalDays',l:'Days',r:v=><span style={{color:v>120?T.danger:T.txt,fontWeight:800,fontFamily:T.mono}}>{v}d</span>},{k:'daysOverdue',l:'Total Due',r:(_,r)=>{
            const paid = payments.filter(p => p.loanId === r.id).reduce((a, p) => a + p.amount, 0);
            const e=calculateLoanStatus(r, null, paid);
            return <span style={{color:T.accent,fontFamily:T.mono}}>{fmt(e.totalPayable)}</span>;
          }},{k:'status',l:'Phase',r:(_,r)=>{
            const paid = payments.filter(p => p.loanId === r.id).reduce((a, p) => a + p.amount, 0);
            const e=calculateLoanStatus(r, null, paid);
            return <span style={{fontSize:11,fontWeight:700,color:e.isFrozen?T.muted:e.phase==='penalty'?T.danger:T.warn}}>{e.isFrozen?'❄ Frozen':e.phase==='penalty'?'Penalty':'Interest'}</span>;
          }},{k:'risk',l:'Risk',r:v=><Badge color={RC[v]}>{v}</Badge>},{k:'officer',l:'Officer'}]}
          rows={[...ov].sort((a,b)=>b.daysOverdue-a.daysOverdue)} onRow={r=>{setShowInt(r);setIF(f=>({...f,officer:f.officer||currentUser}));}}/>
      </Card>
      {interactions.length>0&&<Card>
        <CH title='Interaction History' sub='Reflecting applied date filter'/>
        <DT cols={[{k:'date',l:'Date'},{k:'loanId',l:'Loan'},{k:'type',l:'Type',r:v=><Badge color={T.accent}>{v}</Badge>},{k:'officer',l:'Officer'},{k:'notes',l:'Notes',r:v=><span style={{color:T.dim,fontSize:12}}>{v?.slice(0,60)}{v?.length>60?'…':''}</span>},{k:'promiseAmount',l:'Promise',r:v=>v?<span style={{color:T.gold,fontFamily:T.mono}}>{fmt(v)}</span>:'—'},{k:'promiseStatus',l:'Status',r:v=>v?<Badge color={v==='Pending'?T.warn:v==='Kept'?T.ok:T.danger}>{v}</Badge>:'—'}]}
          rows={filteredInteractions}/>
      </Card>}
      {showInt&&(
        <Dialog title={`Log Interaction — ${showInt.customer}`} onClose={()=>{setShowInt(null);setIF({type:'Phone Call',notes:'',pAmt:'',pDate:'',officer:currentUser});}}>
          <Alert type='info'>Loan {showInt.id} · {fmt(showInt.balance)} · {showInt.daysOverdue}d overdue</Alert>
          <FI label='Interaction Type' type='select' options={['Phone Call','Field Visit','SMS Sent','Promise to Pay','Demand Notice','Recovery Action']} value={iF.type} onChange={v=>setIF(f=>({...f,type:v}))}/>
          <FI label='Notes' type='textarea' value={iF.notes} onChange={v=>setIF(f=>({...f,notes:v}))} required placeholder='Describe the interaction…'/>
          {iF.type==='Promise to Pay'&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
            <FI label='Promised Amount' type='number' value={iF.pAmt} onChange={v=>setIF(f=>({...f,pAmt:v}))} half/>
            <FI label='Promised Date' type='date' value={iF.pDate} onChange={v=>setIF(f=>({...f,pDate:v}))} half/>
          </div>}
          <FI label='Logged By' type='select'
            options={['Admin',...workers.filter(w=>w.status==='Active').map(w=>w.name)]}
            value={iF.officer||'Admin'}
            onChange={v=>setIF(f=>({...f,officer:v==='Admin'?'':v}))}/>
          <div style={{display:'flex',gap:9,marginBottom:12}}><Btn onClick={()=>addInt(showInt)} full disabled={loading}>Save Interaction</Btn><Btn v='secondary' onClick={()=>setShowInt(null)} disabled={loading}>Cancel</Btn></div>
          <div style={{borderTop:`1px dashed ${T.border}`,paddingTop:12}}><Btn v='gold' onClick={()=>{doStkPush(showInt);}} full disabled={loading}>📲 Request Payment (STK Push)</Btn></div>
        </Dialog>
      )}
      {pipeAction&&(
        <Dialog title={`Confirm: ${pipeAction.action}`} onClose={()=>setPipeAction(null)}>
          <Alert type='warn'><b>{pipeAction.action}</b> on loan <b>{pipeAction.loan.id}</b> for <b>{pipeAction.loan.customer}</b></Alert>
          <div style={{display:'flex',gap:9}}><Btn onClick={()=>doAction(pipeAction.stage,pipeAction.action)} full><span style={{display:'flex',alignItems:'center',gap:4}}><Check size={16}/> Confirm & Log</span></Btn><Btn v='secondary' onClick={()=>setPipeAction(null)}>Cancel</Btn></div>
        </Dialog>
      )}
      {modalLoan&&<LoanModal loan={modalLoan} customers={customers} payments={payments} interactions={interactions||[]} onClose={()=>setModalLoan(null)} onViewCustomer={cust=>{setModalLoan(null);setModalCust(cust);}}/>}
      {modalCust&&<CustomerProfile customerId={modalCust.id} workerContext={{role: "admin", name: "Admin"}} onClose={()=>setModalCust(null)} loans={loans} setLoans={setLoans} payments={payments} setPayments={setPayments} interactions={interactions} setInteractions={setInteractions} customers={customers} setCustomers={setCustomers} addAudit={addAudit} onSelectLoan={setModalLoan} />}
    </div>
  );
};

export default CollectionsTab;
