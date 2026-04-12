import CustomerProfile from "@/modules/customers/CustomerProfile";
import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { T, SC, RC, SFX, Card, CH, KPI, DT, Btn, Badge, Av, Bar, BackBtn, RefreshBtn,
  FI, PhoneInput, NumericInput, Search, Pills, Alert, Dialog, ConfirmDialog, ToastContainer,
  LoanModal, LoanForm, RepayTracker, DocViewer, hashPwAsync, ModuleHeader,
  fmt, fmtM, now, uid, ts, escHtml, toCSV, dlCSV, buildFullBackup,
  calculateLoanStatus,
  sbWrite, sbInsert,
  toSupabaseLoan, toSupabaseCustomer, toSupabasePayment, toSupabaseInteraction,
  generateLoanAgreementHTML, generateAssetListHTML, downloadLoanDoc,
  useContactPopup, useToast, useReminders, useModalLock } from '@/lms-common';
import WorkerPanel from './WorkerPanel';
import { Users, UserPlus, Target, TrendingUp, ShieldCheck, Briefcase, Phone, Mail, Calendar, Info, X, ExternalLink, Image as ImageIcon, FileText } from 'lucide-react';

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
        {viewDoc && <WorkerDocPreview doc={viewDoc} onClose={() => setViewDoc(null)} T={T} />}

        <ModuleHeader 
            title={<><Av ini={w.avatar||w.name[0]} size={28} color={w.status==='Active'?T.accent:T.muted} style={{display:'inline-flex', marginRight:10, verticalAlign:'middle'}}/> {w.name}</>}
            sub={`${w.role} • Managing ${wLoans.length} Loans`}
            right={
                <div style={{display:'flex', gap:8}}>
                  <Btn onClick={()=>{setSel(null);setDetailTab('overview');setViewDoc(null);}} v="secondary" sm>Back to Team</Btn>
                  <Btn v={w.status==='Active'?'danger':'ok'} sm onClick={()=>toggleStatus(w)}>
                    {w.status==='Active'?'Deactivate Access':'Enable Access'}
                  </Btn>
                </div>
            }
        />

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
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))',gap:12,marginBottom:20}}>
                <KPI label="Managed Portfolio" value={fmtM(book)} icon={TrendingUp} color={T.accent} />
                <KPI label="Recuperation" value={fmtM(coll)} icon={Target} color={T.ok} />
                <KPI label="Active Book" value={actLoans.length} icon={ShieldCheck} color={T.ok} />
                <KPI label="Arrears Count" value={ovLoans.length} icon={AlertTriangle} color={ovLoans.length > 0 ? T.danger : T.ok} />
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
  const teamStats = useMemo(() => {
    const active = workers.filter(w => w.status === 'Active');
    const totalBook = loans.filter(l => l.status !== 'Settled').reduce((s, l) => s + l.balance, 0);
    return { 
        active: active.length, 
        total: workers.length,
        book: totalBook,
        capacity: Math.round((active.length / workers.length) * 100) || 0
    };
  }, [workers, loans]);

  return (
    <div className="fu">
      {ContactPopup}
      
      <ModuleHeader 
        title={<><Users size={22} style={{marginRight:10, verticalAlign:'middle', marginTop:-4}}/> Team Management</>}
        sub="Organize your workforce, monitor performance, and manage administrative permissions."
        right={<Btn onClick={()=>setShowNew(true)} icon={UserPlus}>Add New Team Member</Btn>}
      />

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
              <div style={{ padding: '16px 18px', borderBottom: `1px solid ${T.border}`, background: T.card2, display: 'flex', alignItems: 'center', gap: 12 }}>
                <Av ini={w.avatar || w.name[0]} size={42} color={w.status === 'Active' ? T.accent : T.muted} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: T.txt, fontWeight: 800, fontSize: 15, fontFamily: T.head }}>{w.name}</div>
                  <div style={{ color: T.muted, fontSize: 12 }}>{w.role}</div>
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
                
                {!docsOk && (
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, color: T.warn, fontSize: 11, fontWeight: 700 }}>
                    <ShieldCheck size={14} /> Documentation Incomplete
                  </div>
                )}
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
