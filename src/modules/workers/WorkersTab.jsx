import CustomerProfile from "@/modules/customers/CustomerProfile";
import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { T, SC, RC, SFX, Card, CH, KPI, DT, Btn, Badge, Av, Bar, BackBtn, RefreshBtn,
  FI, PhoneInput, NumericInput, Search, Pills, Alert, Dialog, ConfirmDialog, ToastContainer,
  LoanModal, LoanForm, RepayTracker, DocViewer, hashPwAsync,
  fmt, fmtM, now, uid, ts, escHtml, toCSV, dlCSV, buildFullBackup,
  calculateLoanStatus,
  sbWrite, sbInsert,
  toSupabaseLoan, toSupabaseCustomer, toSupabasePayment, toSupabaseInteraction,
  generateLoanAgreementHTML, generateAssetListHTML, downloadLoanDoc,
  useContactPopup, useToast, useReminders, useModalLock } from '@/lms-common';
import WorkerPanel from './WorkerPanel';

const WorkersTab = ({workers,setWorkers,loans,setLoans,payments,customers,setCustomers,leads,setLeads,interactions,setInteractions,allState,addAudit,showToast=()=>{}}) => {
  const {open:openContact, Popup:ContactPopup} = useContactPopup();
  const [sel, setSel]           = useState(null);
  const [workQ, setWorkQ]       = useState('');
  const [showNew, setShowNew]   = useState(false);
  const [detailTab, setDetailTab] = useState('overview');
  const [viewDoc, setViewDoc]   = useState(null);
  const blankF = {name:'',email:'',role:'Loan Officer',phone:'',pw:'',idNo:''};
  const [f, setF] = useState(blankF);

  const ROLES = ['Loan Officer','Collections Officer','Finance','Viewer / Auditor','Asset Recovery'];
  const DOC_SLOTS = [
    {key:'id_front', label:'National ID - Front', icon:'ID', required:true,  accept:'image/*'},
    {key:'id_back',  label:'National ID - Back',  icon:'ID', required:true,  accept:'image/*'},
    {key:'passport', label:'Passport Photo',       icon:'PP', required:true,  accept:'image/*'},
    {key:'extra_1',  label:'Additional Document',  icon:'DOC',required:false, accept:'image/*,application/pdf'},
    {key:'extra_2',  label:'Additional Document 2',icon:'DOC',required:false, accept:'image/*,application/pdf'},
  ];

  const addW = () => {
    const missing = [];
    if(!f.name)           missing.push('Full Name');
    if(!f.email)          missing.push('Email');
    if(!f.phone)          missing.push('Phone');
    if(!f.idNo)           missing.push('National ID No.');
    if(!f.pw||f.pw.length<6) missing.push('Password (min 6 chars)');
    if(!f.role)           missing.push('Role');
    if(missing.length){ showToast('Please fill in: '+missing.join(', '),'warn'); try{SFX.error();}catch(e){} return; }
    const emailTaken = workers.some(w=>w.email.trim().toLowerCase()===f.email.trim().toLowerCase());
    if(emailTaken){ showToast('A worker with this email already exists','danger'); try{SFX.error();}catch(e){} return; }
    const idTaken = workers.some(w=>w.idNo&&w.idNo.trim()===f.idNo.trim());
    if(idTaken){ showToast('A worker with this National ID already exists','danger'); try{SFX.error();}catch(e){} return; }
    import('@/config/supabaseClient').then(({supabase,DEMO_MODE})=>{
      if(!DEMO_MODE&&supabase){
        const avatar = f.name.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();
        const email  = f.email.trim();

        // Step 1: create the Supabase auth account for the worker.
        // signUp with the anon key is the only option without the service_role key.
        // If the user was already created (e.g. previous failed attempt), signUp
        // returns a dummy session — we handle that by checking if a user session exists.
        supabase.auth.signUp({email, password:f.pw})
          .then(({data:signUpData, error:signUpErr})=>{
            // "User already registered" is not a hard error — the auth user exists,
            // we just need to get their UUID. We do that by checking auth.users
            // via the workers table lookup (we can't query auth.users with anon key).
            // So we proceed and use null for auth_user_id — admin can link it later
            // via SQL, or the worker's id will be linked on first login.
            const authUserId = signUpData?.user?.id || null;

            // Step 2: use the SECURITY DEFINER RPC function to insert the worker row.
            // This bypasses RLS because the function runs with elevated privileges
            // but still enforces that the caller is an Admin.
            return supabase.rpc('create_worker', {
              p_name:         f.name,
              p_email:        email,
              p_role:         f.role,
              p_phone:        f.phone,
              p_avatar:       avatar,
              p_auth_user_id: authUserId,
            });
          })
          .then(({data:wRow, error:wErr})=>{
            if(wErr){
              // If RPC not yet created, fall back to direct insert
              if(wErr.code==='42883'){
                return supabase.from('workers').insert([{
                  name:f.name, email, role:f.role,
                  phone:f.phone, status:'Active', joined:now(),
                  avatar, auth_user_id:null,
                }]).select().single();
              }
              throw wErr;
            }
            return {data:wRow, error:null};
          })
          .then(({data:wRow, error:wErr})=>{
            if(wErr) throw wErr;
            const w = {...wRow, docs:[], idNo:f.idNo||''};
            setWorkers(ws=>[...ws,w]);
            addAudit('Worker Added',w.id||email, w.name||f.name);
            showToast(f.name+' added. They can log in with their email and password.','ok');
            try{SFX.save();}catch(e){}
            setShowNew(false); setF(blankF);
          })
          .catch(err=>{
            const msg = err.message||'';
            if(msg.toLowerCase().includes('already registered')||msg.toLowerCase().includes('already exists')){
              showToast('Auth account already exists for this email. The worker row was not created — run the SQL fix below or contact support.','warn',6000);
            } else {
              showToast('Error adding worker: '+msg,'danger');
            }
            try{SFX.error();}catch(e){}
          });
        return;
      }
      // Demo mode — local only
      hashPwAsync(f.pw).then(pwHash=>{
        const w = {id:uid('W'),avatar:f.name.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase(),status:'Active',joined:now(),docs:[],...f,pwHash,pw:undefined};
        setWorkers(ws=>[...ws,w]);
        addAudit('Worker Added',w.id,w.name+(w.idNo?' ID:'+w.idNo:''));
        showToast(w.name+' added to team (demo mode — not saved to database)','ok');
        try{SFX.save();}catch(e){}
        setShowNew(false); setF(blankF);
      }).catch(()=>showToast('Failed to hash password','danger'));
    }).catch(()=>showToast('Import error — could not add worker','danger'));
  };

  const toggleStatus = w => {
    const next = w.status==='Active'?'Inactive':'Active';
    const wUpd={...w,status:next};
    setWorkers(ws=>ws.map(x=>x.id===w.id?wUpd:x));
    import('@/config/supabaseClient').then(({supabase,DEMO_MODE})=>{if(!DEMO_MODE&&supabase)supabase.from('workers').update({status:next}).eq('id',w.id).then(({error})=>{if(error)console.error('[worker status]',error.message);});}).catch(()=>{});
    addAudit('Worker Status Changed',w.id,next);
    showToast(w.name+' -> '+next,'info');
    setSel(prev=>prev&&prev.id===w.id?{...prev,status:next}:prev);
  };

  const changeRole = (w, role) => {
    setWorkers(ws=>ws.map(x=>x.id===w.id?{...x,role}:x));
    import('@/config/supabaseClient').then(({supabase,DEMO_MODE})=>{if(!DEMO_MODE&&supabase)supabase.from('workers').update({role}).eq('id',w.id).then(({error})=>{if(error)console.error('[worker role]',error.message);});}).catch(()=>{});
    addAudit('Worker Role Changed',w.id,w.name+': '+w.role+' -> '+role);
    showToast(w.name+' role updated to '+role,'ok');
    setSel(prev=>prev&&prev.id===w.id?{...prev,role}:prev);
  };

  const uploadDoc = (wid, slot, file) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const doc = {id:uid('DOC'),key:slot.key,name:slot.label,originalName:file.name,type:file.type,size:file.size,dataUrl:ev.target.result,uploaded:now()};
      setWorkers(ws=>ws.map(x=>{
        if(x.id!==wid) return x;
        const docs = [...(x.docs||[]).filter(d=>d.key!==slot.key), doc];
        return {...x,docs};
      }));
      setSel(prev=>{
        if(!prev||prev.id!==wid) return prev;
        const docs = [...(prev.docs||[]).filter(d=>d.key!==slot.key), doc];
        return {...prev,docs};
      });
      showToast(slot.label+' uploaded','ok');
    };
    reader.readAsDataURL(file);
  };

  const removeDoc = (wid, docId) => {
    setWorkers(ws=>ws.map(x=>{
      if(x.id!==wid) return x;
      return {...x,docs:(x.docs||[]).filter(d=>d.id!==docId)};
    }));
    setSel(prev=>{
      if(!prev||prev.id!==wid) return prev;
      return {...prev,docs:(prev.docs||[]).filter(d=>d.id!==docId)};
    });
    showToast('Document removed','info');
  };

  // ── WORKER DETAIL VIEW ─────────────────────────────────────────
  if(sel) {
    const w       = workers.find(x=>x.id===sel.id)||sel;
    const wLoans  = loans.filter(l=>l.officer===w.name);
    const wCusts  = customers.filter(c=>c.officer===w.name);
    const wLeads  = (leads||[]).filter(l=>l.officer===w.name);
    const wInts   = (interactions||[]).filter(i=>wLoans.some(l=>l.id===i.loanId));
    const wDocs   = w.docs||[];
    const book    = wLoans.filter(l=>l.status!=='Settled').reduce((s,l)=>s+l.balance,0);
    const coll    = payments.filter(p=>wLoans.some(l=>l.id===p.loanId)).reduce((s,p)=>s+p.amount,0);
    const ovLoans = wLoans.filter(l=>l.status==='Overdue');
    const actLoans= wLoans.filter(l=>l.status==='Active');
    const reqSlots= DOC_SLOTS.filter(s=>s.required);
    const reqDone = reqSlots.filter(s=>wDocs.some(d=>d.key===s.key)).length;
    const docsOk  = reqDone>=reqSlots.length;
    const ph      = (w.phone||'').replace(/\s/g,'');

    const TABS = ['overview','profile','loans','customers','leads','timeline','documents','portal'];

    return (
      <div className="fu">
        {ContactPopup}
        {viewDoc&&<DocViewer doc={viewDoc} onClose={()=>setViewDoc(null)}/>}

        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16,paddingBottom:14,borderBottom:'1px solid '+T.border}}>
          <button onClick={()=>{setSel(null);setDetailTab('overview');setViewDoc(null);}}
            style={{background:T.surface,border:'1px solid '+T.border,borderRadius:8,padding:'7px 14px',cursor:'pointer',color:T.txt,fontSize:13,fontWeight:700}}>
            {'<- Team'}
          </button>
          <Av ini={w.avatar||w.name[0]} size={32} color={w.status==='Active'?T.accent:T.muted}/>
          <div style={{flex:1}}>
            <span style={{color:T.txt,fontWeight:800,fontSize:15}}>{w.name}</span>
            <span style={{color:T.muted,fontSize:12,marginLeft:10}}>{w.role}</span>
          </div>
          <Badge color={w.status==='Active'?T.ok:T.danger}>{w.status}</Badge>
          <Btn v={w.status==='Active'?'danger':'ok'} sm onClick={()=>toggleStatus(w)}>
            {w.status==='Active'?'Deactivate':'Activate'}
          </Btn>
        </div>

        <div style={{display:'flex',gap:5,marginBottom:16,overflowX:'auto',paddingBottom:2}}>
          {TABS.map(t=>(
            <button key={t} onClick={()=>setDetailTab(t)}
              style={{background:detailTab===t?T.accent:T.surface,
                      color:detailTab===t?'#060A10':t==='documents'&&!docsOk?T.warn:T.muted,
                      border:'1px solid '+(detailTab===t?T.accent:t==='documents'&&!docsOk?T.warn+'60':T.border),
                      borderRadius:99,padding:'6px 14px',fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>
              {t==='overview'?'Overview'
               :t==='profile'?'Profile'
               :t==='loans'?('Loans ('+wLoans.length+')')
               :t==='customers'?('Customers ('+wCusts.length+')')
               :t==='leads'?('Leads ('+wLeads.length+')')
               :t==='timeline'?('Timeline ('+wInts.length+')')
               :t==='documents'?('Documents ('+wDocs.length+')'+(!docsOk?' !':''))
               :'Worker Portal'}
            </button>
          ))}
        </div>

        {detailTab==='overview'&&(
          <div>

            {/* ── Hero card ───────────────────────── */}
            <div style={{background:T.card2,border:'1px solid '+T.border,borderRadius:14,padding:'16px 18px',marginBottom:14,display:'flex',alignItems:'center',gap:14}}>
              <Av ini={w.avatar||w.name[0]} size={56} color={w.status==='Active'?T.accent:T.muted}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:T.txt,fontWeight:900,fontSize:17,fontFamily:T.head}}>{w.name}</div>
                <div style={{color:T.muted,fontSize:12,marginTop:1}}>{w.role}</div>
                <div style={{color:T.muted,fontSize:11,marginTop:2}}>{w.email}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <Badge color={w.status==='Active'?T.ok:T.danger}>{w.status}</Badge>
                {!docsOk&&<div style={{color:T.warn,fontSize:10,fontWeight:700,marginTop:4}}>Docs incomplete</div>}
                <div style={{color:T.muted,fontSize:10,marginTop:4}}>Joined {w.joined||'-'}</div>
              </div>
            </div>

            {/* ── KPI grid ───────────────────────── */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:14}}>
              {[
                ['Loan Book',    fmt(book),     T.accent],
                ['Active Loans', actLoans.length, T.ok],
                ['Overdue',      ovLoans.length,  ovLoans.length>0?T.danger:T.ok],
                ['Collected',    fmt(coll),      T.ok],
                ['Customers',    wCusts.length,  T.txt],
                ['Leads',        wLeads.length,  T.txt],
              ].map(function(item){return(
                <div key={item[0]} style={{background:T.surface,borderRadius:9,padding:'10px 11px'}}>
                  <div style={{color:T.muted,fontSize:9,textTransform:'uppercase',letterSpacing:.5,marginBottom:3}}>{item[0]}</div>
                  <div style={{color:item[2],fontWeight:800,fontSize:15,fontFamily:T.mono}}>{item[1]}</div>
                </div>
              );})}
            </div>

            {/* ── Performance bars ───────────────── */}
            <Card style={{marginBottom:12}}>
              <CH title="Performance"/>
              <div style={{padding:'10px 14px 14px'}}>
                {(function(){
                  var collRate = book>0 ? Math.min(Math.round((coll/book)*100),100) : 0;
                  var ovRate   = wLoans.length>0 ? Math.round((ovLoans.length/wLoans.length)*100) : 0;
                  var custConv = (wLeads.length+wCusts.length)>0 ? Math.round((wCusts.length/(wLeads.length+wCusts.length))*100) : 0;
                  return (
                    <div>
                      {[
                        ['Collection Rate', collRate, T.ok,     collRate+'%'],
                        ['Overdue Rate',    ovRate,   ovRate>20?T.danger:T.warn, ovRate+'%'],
                        ['Conversion Rate', custConv, T.accent, custConv+'%'],
                      ].map(function(item){return(
                        <div key={item[0]} style={{marginBottom:10}}>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                            <span style={{color:T.muted,fontSize:11}}>{item[0]}</span>
                            <span style={{color:item[2],fontWeight:700,fontSize:11}}>{item[3]}</span>
                          </div>
                          <div style={{height:6,background:T.border,borderRadius:99,overflow:'hidden'}}>
                            <div style={{height:'100%',width:item[1]+'%',background:item[2],borderRadius:99,transition:'width .5s ease'}}/>
                          </div>
                        </div>
                      );})}
                    </div>
                  );
                })()}
              </div>
            </Card>

            {/* ── Contact ───────────────────────── */}
            <Card style={{marginBottom:12}}>
              <div style={{padding:'12px 14px',display:'flex',gap:8,flexWrap:'wrap'}}>
                <a href={'tel:'+ph} style={{flex:1,minWidth:80,display:'flex',alignItems:'center',justifyContent:'center',gap:5,background:T.oLo,border:'1px solid '+T.ok+'38',color:T.ok,borderRadius:9,padding:'9px',fontWeight:800,fontSize:12,textDecoration:'none'}}>📞 Call</a>
                <a href={'sms:'+ph} style={{flex:1,minWidth:80,display:'flex',alignItems:'center',justifyContent:'center',gap:5,background:T.bLo,border:'1px solid '+T.blue+'38',color:T.blue,borderRadius:9,padding:'9px',fontWeight:800,fontSize:12,textDecoration:'none'}}>💬 SMS</a>
                <a href={'https://wa.me/'+(ph.startsWith('0')?'254'+ph.slice(1):ph)} target="_blank" rel="noreferrer" style={{flex:1,minWidth:80,display:'flex',alignItems:'center',justifyContent:'center',gap:5,background:'#25D36618',border:'1px solid #25D36638',color:'#25D366',borderRadius:9,padding:'9px',fontWeight:800,fontSize:12,textDecoration:'none'}}>WhatsApp</a>
              </div>
            </Card>

            {/* ── Alerts ───────────────────────── */}
            {!docsOk&&(
              <div style={{background:T.dLo,border:'1px solid '+T.danger+'38',borderRadius:10,padding:'11px 14px',display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                <span style={{color:T.danger,fontWeight:700,fontSize:13}}>Documents incomplete —</span>
                <span style={{color:T.muted,fontSize:12}}>{reqSlots.length-reqDone} required not uploaded</span>
                <button onClick={function(){setDetailTab('documents');}} style={{marginLeft:'auto',background:'none',border:'1px solid '+T.accent,color:T.accent,borderRadius:7,padding:'4px 10px',cursor:'pointer',fontSize:11,fontWeight:700}}>View Docs</button>
              </div>
            )}
            {ovLoans.length>0&&(
              <Card>
                <CH title="Overdue Loans"/>
                <DT cols={[{k:'id',l:'ID',r:function(v){return <span style={{color:T.accent,fontFamily:T.mono,fontSize:12}}>{v}</span>;}},{k:'customer',l:'Customer'},{k:'balance',l:'Balance',r:function(v){return fmt(v);}},{k:'daysOverdue',l:'Days',r:function(v){return <span style={{color:T.danger,fontWeight:800}}>{v}d</span>;}}]} rows={ovLoans} maxHeightVh={0.35}/>
              </Card>
            )}
          </div>
        )}

        {detailTab==='profile'&&(
          <div>

            {/* ── Personal details ─────────────── */}
            <Card style={{marginBottom:12}}>
              <CH title="Personal Information"/>
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
                      <div style={{color:T.muted,fontSize:10,textTransform:'uppercase',letterSpacing:.5,marginBottom:2}}>{pair[0]}</div>
                      <div style={{color:T.txt,fontWeight:600,fontSize:13}}>{pair[1]}</div>
                    </div>
                  );})}
                </div>
              </div>
            </Card>

            {/* ── Role management ──────────────── */}
            <Card style={{marginBottom:12}}>
              <CH title="Change Role"/>
              <div style={{padding:'10px 14px 14px'}}>
                <div style={{color:T.muted,fontSize:12,marginBottom:10}}>Current: <b style={{color:T.accent}}>{w.role}</b></div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {ROLES.map(function(role){return(
                    <button key={role} onClick={function(){changeRole(w,role);}}
                      style={{background:w.role===role?T.accent:T.surface,
                              color:w.role===role?'#060A10':T.muted,
                              border:'1px solid '+(w.role===role?T.accent:T.border),
                              borderRadius:8,padding:'7px 12px',cursor:'pointer',fontSize:12,fontWeight:700}}>
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
              payments={payments}
              customers={customers}
              leads={leads||[]}
              allWorkers={workers||[]}
              setCustomers={setCustomers||(function(){})}
              onSubmitLoan={function(l){if(setLoans)setLoans(function(ls){return [l].concat(ls);});}}
              setLeads={setLeads||(function(){})}
              interactions={interactions||[]}
              setInteractions={setInteractions||(function(){})}
              addAudit={addAudit||(function(){})}
              showToast={showToast||(function(){})}
            />
          </div>
        )}
      </div>
    );
  }

  // ── TEAM GRID ────────────────────────────────────────────────
  return (
    <div className="fu">
      {ContactPopup}
      <div className="mob-stack" style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18,gap:10}}>
        <div>
          <div style={{fontFamily:T.head,color:T.txt,fontSize:20,fontWeight:800}}>Team</div>
          <div style={{color:T.muted,fontSize:13}}>{workers.filter(function(w){return w.status==='Active';}).length} active / {workers.length} total</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <RefreshBtn onRefresh={function(){ setWorkQ(''); setSel(null); }}/>
          <Btn onClick={function(){setShowNew(true);}}>+ Add Worker</Btn>
        </div>
      </div>
      <div style={{marginBottom:12}}>
        <Search value={workQ} onChange={setWorkQ} placeholder="Search by name or role..."/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
        {workers.filter(function(w){return !workQ||w.name.toLowerCase().includes(workQ.toLowerCase())||w.role.toLowerCase().includes(workQ.toLowerCase());}).map(function(w){
          var wl = loans.filter(function(l){return l.officer===w.name;});
          var bk = wl.filter(function(l){return l.status!=='Settled';}).reduce(function(s,l){return s+l.balance;},0);
          var ov = wl.filter(function(l){return l.status==='Overdue';}).length;
          var wp = payments.filter(function(p){return wl.some(function(l){return l.id===p.loanId;});}).reduce(function(s,p){return s+p.amount;},0);
          var docsOk = DOC_SLOTS.filter(function(s){return s.required;}).every(function(s){return (w.docs||[]).some(function(d){return d.key===s.key;});});
          return (
            <Card key={w.id} style={{padding:'16px 18px',cursor:'pointer',border:'1px solid '+(w.status==='Active'?T.border:T.danger+'30')}}
              onClick={function(){setSel(w);setDetailTab('overview');setViewDoc(null);}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                <Av ini={w.avatar||w.name[0]} size={38} color={w.status==='Active'?T.accent:T.muted}/>
                <div style={{flex:1,minWidth:0}}>
                  <div onClick={function(e){e.stopPropagation();setSel(w);setDetailTab('profile');setViewDoc(null);}} style={{color:T.accent,fontWeight:700,fontSize:14,cursor:'pointer',textDecoration:'underline',textDecorationStyle:'dotted',textUnderlineOffset:'2px'}}>{w.name}</div>
                  <div style={{color:T.muted,fontSize:12}}>{w.role}</div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end'}}>
                  <Badge color={w.status==='Active'?T.ok:T.danger}>{w.status}</Badge>
                  {!docsOk&&<span style={{color:T.warn,fontSize:10,fontWeight:700}}>Docs incomplete</span>}
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                {[['Loans',wl.length],['Overdue',ov],['Book',fmt(bk)],['Collected',fmt(wp)]].map(function(pair){return(
                  <div key={pair[0]} style={{background:T.surface,borderRadius:7,padding:'7px 9px'}}>
                    <div style={{color:T.muted,fontSize:10,textTransform:'uppercase',letterSpacing:.6}}>{pair[0]}</div>
                    <div style={{color:T.txt,fontWeight:700,fontSize:13,fontFamily:T.mono}}>{pair[1]}</div>
                  </div>
                );})}
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


// ═══════════════════════════════════════════
//  REPORT HELPERS — buildReportData, dlBlob, dlReportCSV/PDF/Word
// ═══════════════════════════════════════════
const dlBlob = (content, filename, mime) => {
  try {
    const blob = new Blob([content], {type: mime});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  } catch(e) { console.error('Download failed', e); }
};

const buildReportData = (type, {loans, customers, payments, workers, auditLog}) => {
  if(type==='loan-portfolio') {
    const hdr = ['Loan ID','Customer','Principal','Base Remaining','Status','Days Overdue','Penalty','Remaining','Total Due','Officer','Disbursed','Repay Type'];
    const rows = loans.map(l=>{const e=calculateLoanStatus(l);return [l.id,l.customer,l.amount,e.baseBalance,l.status,l.daysOverdue,e.penalty,e.totalAmountDue,e.totalPayable,l.officer,l.disbursed||'N/A',l.repaymentType];});
    return {name:'loan-portfolio', title:'Loan Portfolio Report', hdr, rows};
  }
  if(type==='financial') {
    const tb  = loans.reduce((s,l)=>s+l.amount,0);
    const out = loans.filter(l => !calculateLoanStatus(l).isSettled).reduce((s,l)=>s+l.balance,0);
    const col = payments.filter(p=>p.status==='Allocated').reduce((s,p)=>s+p.amount,0);
    const ov  = loans.filter(l => {
      const e = calculateLoanStatus(l);
      return e.overdueDays > 0 && !e.isSettled;
    }).reduce((s,l)=>s+l.balance,0);
    return {name:'financial-summary', title:'Financial Summary Report', hdr:['Metric','KES'],
      rows:[['Total Disbursed',tb],['Total Outstanding',out],['Total Collected',col],['Total Overdue',ov],
            ['Collection Rate %', tb>0?((col/tb)*100).toFixed(2):0]]};
  }
  if(type==='customers') {
    return {name:'customers', title:'Customer Report',
      hdr:['ID','Name','Phone','Business','Location','Officer','Loans','Risk','Joined','Blacklisted'],
      rows:customers.map(c=>[c.id,c.name,c.phone,c.business||'',c.location||'',c.officer||'',c.loans,c.risk,c.joined,c.blacklisted?'Yes':'No'])};
  }
  if(type==='audit') {
    return {name:'audit-log', title:'Audit Log Report',
      hdr:['Timestamp','User','Action','Target','Details'],
      rows:(auditLog||[]).map(e=>[e.ts,e.user,e.action,e.target,e.detail||''])};
  }
  if(type==='overdue') {
    const ov = loans.filter(l => {
      const e = calculateLoanStatus(l);
      return e.overdueDays > 0 && !e.isSettled;
    });
    return {name:'overdue-report', title:'Overdue Loans Report',
      hdr:['Loan ID','Customer','Base Remaining','Days Overdue','Penalty','Remaining','Total Due','Risk','Officer'],
      rows:ov.map(l=>{const e=calculateLoanStatus(l);return [l.id,l.customer,e.baseBalance,l.overdueDays,e.penalty,e.totalAmountDue,e.totalPayable,l.risk,l.officer];})};
  }
  if(type==='payments') {
    return {name:'payments', title:'Payments Report',
      hdr:['ID','Customer','Loan ID','Amount','M-Pesa Code','Date','Status','Allocated By'],
      rows:payments.map(p=>[p.id,p.customer,p.loanId||'N/A',p.amount,p.mpesa||'',p.date,p.status,p.allocatedBy||''])};
  }
  if(type==='staff') {
    return {name:'staff-performance', title:'Staff Performance Report',
      hdr:['ID','Name','Role','Status','Loans','Book KES','Overdue %'],
      rows:workers.map(w=>{
        const wl=loans.filter(l => l.officer===w.name);
        const bk=wl.reduce((s,l)=>s+l.balance,0);
        const od=wl.filter(l => {
          const e = calculateLoanStatus(l);
          return e.overdueDays > 0 && !e.isSettled;
        }).length;
        return [w.id,w.name,w.role,w.status,wl.length,bk,wl.length?((od/wl.length)*100).toFixed(1):0];
      })};
  }
  return {name:'report', title:'Report', hdr:[], rows:[]};
};

const dlReportCSV = ({name, hdr, rows}) => {
  dlBlob(toCSV(hdr, rows), `${name}-${now()}.csv`, 'text/csv;charset=utf-8;');
};

const dlReportPDF = ({title, hdr, rows}) => {
  const esc = s => String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:Arial,sans-serif;font-size:11px;padding:20px}h1{font-size:15px;margin:0 0 4px}p{color:#666;font-size:10px;margin:0 0 14px}table{width:100%;border-collapse:collapse}th{background:#1a2740;color:#fff;padding:6px 10px;text-align:left;font-size:10px}td{padding:5px 10px;border-bottom:1px solid #e2e8f0;font-size:10px}tr:nth-child(even)td{background:#f8fafc}@media print{body{padding:8px}}</style>
</head><body><h1>${esc(title)}</h1><p>Generated: ${new Date().toLocaleString('en-KE')} · Adequate Capital Ltd</p>
<table><thead><tr>${hdr.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead>
<tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
</body></html>`;
  dlBlob(html, `${title.replace(/\s+/g,'-')}-${now()}.html`, 'text/html;charset=utf-8;');
};

const dlReportWord = ({title, hdr, rows}) => {
  const esc = s => String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const headerRow = `<w:tr>${hdr.map(h=>`<w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${esc(h)}</w:t></w:r></w:p></w:tc>`).join('')}</w:tr>`;
  const tableRows = rows.map(r=>`<w:tr>${r.map(c=>`<w:tc><w:p><w:r><w:t>${esc(c)}</w:t></w:r></w:p></w:tc>`).join('')}</w:tr>`).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><?mso-application progid="Word.Document"?>
<w:wordDocument xmlns:w="http://schemas.microsoft.com/office/word/2003/wordml">
<w:body>
<w:p><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>${esc(title)}</w:t></w:r></w:p>
<w:p><w:r><w:t>Generated: ${new Date().toLocaleString('en-KE')} · Adequate Capital Ltd</w:t></w:r></w:p>
<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr>${headerRow}${tableRows}</w:tbl>
</w:body></w:wordDocument>`;
  dlBlob(xml, `${title.replace(/\s+/g,'-')}-${now()}.doc`, 'application/msword');
};

export default WorkersTab;
