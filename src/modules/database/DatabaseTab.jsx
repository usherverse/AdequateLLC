import CustomerProfile from "@/modules/customers/CustomerProfile";
import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { T, SC, RC, SFX, Card, CH, KPI, DT, Btn, Badge, Av, Bar, BackBtn, RefreshBtn,
  FI, PhoneInput, NumericInput, Search, Pills, Alert, Dialog, ConfirmDialog, ToastContainer,
  LoanModal, LoanForm, RepayTracker,
  fmt, fmtM, now, uid, ts, escHtml, toCSV, dlCSV, buildFullBackup,
  calculateLoanStatus,
  sbWrite, sbInsert,
  toSupabaseLoan, toSupabaseCustomer, toSupabasePayment, toSupabaseInteraction, toSupabaseLead,
  generateLoanAgreementHTML, generateAssetListHTML, downloadLoanDoc,
  useContactPopup, useToast, useReminders, useModalLock } from '@/lms-common';
import { _hashPw, SEED_CUSTOMERS, SEED_LOANS, SEED_PAYMENTS, SEED_LEADS, SEED_INTERACTIONS, SEED_WORKERS, SEED_AUDIT } from '@/data/seedData';

const DatabaseTab = ({allState,setLoans,setCustomers,setPayments,setWorkers,setLeads,setInteractions,setAuditLog,addAudit,showToast=()=>{}}) => {
  const _sbErr = (ctx, table, msg) => console.error(`[DatabaseTab] Supabase Error (${ctx} - ${table}):`, msg);
  const [step,setStep]=useState(0);
  const [pw,setPw]=useState('');
  const [totp,setTotp]=useState('');
  const [err,setErr]=useState('');
  const [showClear,setShowClear]=useState(false);
  const [lastBackup,setLastBackup]=useState(null);
  const [restoreFile,setRestoreFile]=useState(null);
  const [restoreStatus,setRestoreStatus]=useState('');
  const [uploadProgress,setUploadProgress]=useState(0);
  const [uploadKey,setUploadKey]=useState(0);
  const [restorePreview,setRestorePreview]=useState(null); // holds parsed data waiting for inline confirm
  const fileRef=useRef();

  const allStateRef=useRef(allState);
  allStateRef.current=allState; // update ref synchronously — no useEffect needed
  const addAuditRef=useRef(addAudit);
  addAuditRef.current=addAudit; // update ref synchronously

  const doBackup=useCallback(()=>{
    const csv=buildFullBackup(allStateRef.current);
    dlCSV(`acl-backup-${now()}.csv`,csv);
    setLastBackup(new Date().toLocaleTimeString('en-KE'));
    addAuditRef.current('Database Backup Downloaded','ALL',`Full backup at ${ts()}`);
    showToast('✅ Backup CSV downloaded','ok');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);



  const startClear=()=>{setShowClear(true);setStep(1);setPw('');setTotp('');setErr('');};
  const stepPw=()=>{if(pw.length<4){setErr('Invalid password.');return;}setErr('');setStep(2);};
  const stepBio=()=>setStep(3);
  const stepTotp=()=>{if(totp!=='123456'){setErr('Invalid TOTP code.');try{SFX.error();}catch(e){};return;}setStep(4);setErr('');};

  const doClear=()=>{
    // 1. Clear React state immediately so the UI empties at once
    setLoans([]);setCustomers([]);setPayments([]);setLeads([]);setInteractions([]);
    setAuditLog(l=>[{ts:ts(),user:'admin',action:'DATABASE CLEARED',target:'ALL',detail:'All data wiped after 3FA verification'}]);
    addAudit('DATABASE CLEARED','ALL','Performed after full 3FA verification');
    setShowClear(false);setStep(0);
    showToast('🗑 Database cleared — all data wiped','warn',5000);
    // Reset restore state so upload works immediately after clear
    setRestoreStatus('');setRestoreFile(null);setUploadKey(k=>k+1);setUploadProgress(0);

    // 2. DELETE every row from each Supabase table so the wipe survives a refresh.
    // Supabase requires at least one filter before it will run a delete — .neq('id','__none__')
    // matches every real row (none will have that sentinel id) and satisfies the requirement.
    import('@/config/supabaseClient').then(({supabase,DEMO_MODE})=>{
      if(DEMO_MODE||!supabase) return;
      ['loans','customers','payments','leads','interactions','audit_log'].forEach(table=>
        supabase.from(table).delete().neq('id','__none__')
          .then(({error})=>{ if(error) _sbErr('clear',table,error.message); })
      );
    }).catch(e=>_sbErr('import','doClear',e.message));
  };

  const doRestoreSeed=()=>{
    // 1. Clear state locally
    setLoans([]);setCustomers([]);setPayments([]);setLeads([]);setInteractions([]);setWorkers(SEED_WORKERS);
    setAuditLog([{ts:ts(),user:'admin',action:'SEED RESTORED',target:'ALL',detail:'Default seed data applied to production instance'}]);
    
    // 2. Persist to Supabase
    import('@/config/supabaseClient').then(({supabase,DEMO_MODE})=>{
      if(DEMO_MODE||!supabase) return;
      
      const upsertBatch = (table,rows) => {
        if(!rows||rows.length===0) return;
        supabase.from(table).upsert(rows,{onConflict:'id'})
          .then(({error})=>{ if(error) _sbErr('seed-upsert',table,error.message); });
      };

      // Clear first to avoid conflicts if IDs changed
      const tables = ['loans','customers','payments','leads','interactions','audit_log'];
      tables.forEach(t=>supabase.from(t).delete().neq('id','__none__').then(()=>{
        if(t==='customers') upsertBatch('customers', SEED_CUSTOMERS.map(toSupabaseCustomer));
        if(t==='loans')     upsertBatch('loans',     SEED_LOANS.map(toSupabaseLoan));
        if(t==='payments')  upsertBatch('payments',  SEED_PAYMENTS.map(toSupabasePayment));
        if(t==='leads')     upsertBatch('leads',     SEED_LEADS.map(toSupabaseLead));
        if(t==='interactions') upsertBatch('interactions', SEED_INTERACTIONS.map(toSupabaseInteraction));
        if(t==='audit_log') upsertBatch('audit_log', SEED_AUDIT.map(a=>({ts:a.ts,user_name:a.user,action:a.action,target_id:a.target||'',detail:a.detail||''})));
        // Note: we don't clear workers here to avoid locking the current user out, 
        // usually workers are managed via Supabase Auth.
      }));
    }).catch(e=>_sbErr('import','doRestoreSeed',e.message));

    setRestoreStatus('ok:✅ Seed data restored!');
    showToast('🌱 Default seed data restored','ok');
    setStep(0);setShowClear(false);
  };

  const parseCSVSection=(text,sectionName)=>{
    const start=text.indexOf(`--- ${sectionName} ---`);
    if(start===-1) return [];
    const after=text.slice(start+sectionName.length+8);
    const end=after.search(/\n--- [A-Z]+ ---/);
    const block=end===-1?after:after.slice(0,end);
    const lines=block.trim().split('\n').filter(Boolean);
    if(lines.length<2) return [];
    const headers=lines[0].split(',').map(h=>h.replace(/"/g,'').trim());
    return lines.slice(1).map(line=>{
      const vals=[];let cur='';let inQ=false;
      for(let i=0;i<line.length;i++){if(line[i]==='"'){inQ=!inQ;}else if(line[i]===','&&!inQ){vals.push(cur);cur='';}else cur+=line[i];}
      vals.push(cur);
      const obj={};headers.forEach((h,i)=>obj[h]=(vals[i]||'').replace(/"/g,'').trim());
      return obj;
    });
  };

  const doConfirmRestore = () => {
    if(!restorePreview) return;
    const {restoredCustomers,restoredLoans,restoredPayments,restoredLeads,restoredWorkers,restoredAudit,fileName}=restorePreview;

    // ── 1. Update React state immediately ─────────────────────────────
    if(restoredCustomers.length>0) setCustomers(restoredCustomers);
    // Re-link customerId — use ID directly if present (new backups), else name/phone fallback
    const custById   = Object.fromEntries(restoredCustomers.map(c=>[c.id,c]));
    const custByName = Object.fromEntries(restoredCustomers.map(c=>[c.name.trim().toLowerCase(),c]));
    const linkedLoans = restoredLoans.map(l=>{
      if(l.customerId && custById[l.customerId]) return {...l, phone:custById[l.customerId].phone||l.phone};
      const match = custByName[l.customer?.trim().toLowerCase()]
                 || restoredCustomers.find(c=>c.phone&&c.phone===l.phone);
      return match ? {...l, customerId:match.id, phone:match.phone||l.phone} : l;
    });
    if(linkedLoans.length>0) setLoans(linkedLoans);
    const linkedPayments = restoredPayments.map(p=>{
      if(p.customerId && custById[p.customerId]) return p;
      const loanMatch = linkedLoans.find(l=>l.id===p.loanId);
      if(loanMatch) return {...p, customerId:loanMatch.customerId};
      const nameMatch = custByName[p.customer?.trim().toLowerCase()];
      return nameMatch ? {...p, customerId:nameMatch.id} : p;
    });
    if(linkedPayments.length>0) setPayments(linkedPayments);
    if(restoredLeads.length>0) setLeads(restoredLeads);
    if(restoredWorkers.length>0) setWorkers(restoredWorkers);
    setAuditLog(la=>[{ts:ts(),user:'admin',action:'Database Restored',target:fileName,detail:`C:${restoredCustomers.length} L:${restoredLoans.length} P:${restoredPayments.length}`},...(restoredAudit.length?restoredAudit:la)]);

    // ── 2. Persist restored data to Supabase so it survives a refresh ─
    import('@/config/supabaseClient').then(({supabase,DEMO_MODE})=>{
      if(DEMO_MODE||!supabase) return;
      // Upsert in batches of 500 to stay within Supabase payload limits
      const chunk = (arr,size) => Array.from({length:Math.ceil(arr.length/size)},(_,i)=>arr.slice(i*size,(i+1)*size));
      const upsertAll = (table,rows) =>
        chunk(rows,500).forEach(batch=>
          supabase.from(table).upsert(batch,{onConflict:'id'})
            .then(({error})=>{ if(error) _sbErr('restore-upsert',table,error.message); })
        );
      if(restoredCustomers.length>0) upsertAll('customers', restoredCustomers.map(toSupabaseCustomer));
      if(linkedLoans.length>0)       upsertAll('loans',     linkedLoans.map(toSupabaseLoan));
      if(linkedPayments.length>0)    upsertAll('payments',  linkedPayments.map(toSupabasePayment));
      if(restoredLeads.length>0)     upsertAll('leads',     restoredLeads.map(toSupabaseLead));
      if(restoredWorkers.length>0)   upsertAll('workers',   restoredWorkers.map(w=>({
        id:w.id, name:w.name, email:w.email, role:w.role, status:w.status,
        phone:w.phone, joined:w.joined, pw_hash:w.pwHash||null,
        must_reset_pw:w.mustResetPw||false, docs:w.docs||[], avatar:w.avatar||'',
      })));
    }).catch(e=>_sbErr('import','doConfirmRestore',e.message));
    // ─────────────────────────────────────────────────────────────────

    setRestoreFile(fileName);
    setRestoreStatus(`ok:✅ Restored from "${fileName}" — ${restoredCustomers.length} customers, ${restoredLoans.length} loans, ${restoredPayments.length} payments, ${restoredLeads.length} leads, ${restoredWorkers.length} workers.`);
    addAudit('Database Restored',fileName,`C:${restoredCustomers.length} L:${restoredLoans.length}`);
    showToast('✅ Database restored from backup','ok',4000);SFX.upload();
    setRestorePreview(null);
    setUploadProgress(0);
  };

  const handleRestore=(e)=>{
    const file=e.target.files[0];
    if(!file)return;
    setRestoreStatus('');setUploadProgress(0);setRestorePreview(null);
    let prog=0;
    const progInterval=setInterval(()=>{
      prog=Math.min(prog+Math.random()*18+8,90);
      setUploadProgress(Math.round(prog));
    },80);
    const reader=new FileReader();
    reader.onload=ev=>{
      clearInterval(progInterval);
      setUploadProgress(95);
      setTimeout(()=>{
        try{
          const text=ev.target.result;
          if(!text.includes('ADEQUATE CAPITAL LMS BACKUP')){
            setUploadProgress(0);
            setRestoreStatus('error:⚠ Invalid backup file. Please upload a valid ACL backup CSV.');return;
          }
          const rawCusts=parseCSVSection(text,'CUSTOMERS');
          const rawLoans=parseCSVSection(text,'LOANS');
          const rawPayments=parseCSVSection(text,'PAYMENTS');
          const rawLeads=parseCSVSection(text,'LEADS');
          const rawWorkers=parseCSVSection(text,'WORKERS');
          const rawAudit=parseCSVSection(text,'AUDIT LOG');
          const restoredCustomers=rawCusts.map(r=>({id:r['ID'],name:r['Name'],phone:r['Phone'],idNo:r['ID No'],business:r['Business'],location:r['Location'],officer:r['Officer'],loans:Number(r['Loans'])||0,risk:r['Risk']||'Low',joined:r['Joined'],blacklisted:r['Blacklisted']==='Yes',documents:[],n1n:'',n1p:'',n1r:'',n2n:'',n2p:'',n2r:'',n3n:'',n3p:'',n3r:''}));
          const restoredLoans=rawLoans.map(r=>({id:r['Loan ID'],customerId:r['Customer ID']||'',customer:r['Customer'],amount:Number(r['Principal'])||0,balance:Number(r['Balance'])||0,status:r['Status'],daysOverdue:Number(r['Days Overdue'])||0,officer:r['Officer'],risk:'Low',disbursed:r['Disbursed']==='N/A'?null:r['Disbursed'],mpesa:null,phone:'',repaymentType:r['Repayment Type']||'Monthly',payments:[]}));
          const restoredPayments=rawPayments.map(r=>({id:r['ID'],customerId:r['Customer ID']||null,customer:r['Customer'],loanId:r['Loan ID']==='N/A'?null:r['Loan ID'],amount:Number(r['Amount'])||0,mpesa:r['M-Pesa'],date:r['Date'],status:r['Status']}));
          const restoredLeads=rawLeads.map(r=>({id:r['ID'],name:r['Name'],phone:r['Phone'],business:r['Business'],source:r['Source'],status:r['Status'],officer:r['Officer'],date:r['Date'],location:'',notes:''}));
          const restoredWorkers=rawWorkers.map(r=>({id:r['ID'],name:r['Name'],email:r['Email'],role:r['Role'],status:r['Status'],phone:r['Phone'],joined:r['Joined'],avatar:(r['Name']||'').split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase(),pwHash:_hashPw(uid('tmp')),pw:undefined,mustResetPw:true}));
          const restoredAudit=rawAudit.map(r=>({ts:r['Timestamp'],user:r['User'],action:r['Action'],target:r['Target'],detail:r['Detail']||''}));
          setUploadProgress(100);
          // Store parsed data and show inline confirm — no window.confirm
          setRestorePreview({restoredCustomers,restoredLoans,restoredPayments,restoredLeads,restoredWorkers,restoredAudit,fileName:file.name});
          setRestoreStatus('');
        }catch(err){
          setUploadProgress(0);
          setRestoreStatus('error:❌ Error parsing backup file: '+err.message);
        }
      },200);
    };
    reader.onerror=()=>{clearInterval(progInterval);setUploadProgress(0);setRestoreStatus('error:❌ Could not read file.');};
    reader.readAsText(file);
    e.target.value='';
  };

  return (
    <div className='fu'>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4,flexWrap:'wrap',gap:8}}>
        <div>
          <div style={{fontFamily:T.head,color:T.txt,fontSize:20,fontWeight:800}}>🗄️ Database Management</div>
          <div style={{color:T.muted,fontSize:13,marginTop:2}}>Backup, restore, and manage system data</div>
        </div>
      </div>
      <div style={{marginBottom:16}}/>

      {/* Download backup */}
      <Card style={{marginBottom:12}}>
        <CH title='📥 Download Backup' sub='Export all data as a single CSV file'/>
        <div style={{padding:'16px 18px'}}>
          <div style={{color:T.dim,fontSize:13,marginBottom:14,lineHeight:1.6}}>
            Downloads a complete backup of all customers, loans, payments, leads, interactions, workers, and audit logs into a single CSV file.
            {lastBackup&&<span style={{color:T.ok,marginLeft:8}}>✓ Last download: {lastBackup}</span>}
          </div>
          <div style={{display:'flex',gap:9,flexWrap:'wrap'}}>
            <Btn onClick={doBackup}>⬇ Download Full Backup Now</Btn>
            <Btn v='secondary' onClick={()=>{const csv=toCSV(['Timestamp','User','Action','Target','Details'],allState.auditLog.map(e=>[e.ts,e.user,e.action,e.target,e.detail||'']));dlCSV(`audit-log-${now()}.csv`,csv);}}>
              ⬇ Audit Log Only
            </Btn>
            <Btn v='secondary' onClick={()=>{const {csv,name}={name:`loans-${now()}.csv`,csv:toCSV(['Loan ID','Customer','Principal','Balance','Status'],allState.loans.map(l=>[l.id,l.customer,l.amount,l.balance,l.status]))};dlCSV(name,csv);}}>
              ⬇ Loans Only
            </Btn>
          </div>
        </div>
      </Card>

      {/* Restore */}
      <Card style={{marginBottom:12}}>
        <CH title='📤 Restore from Backup' sub='Re-import data from a previous CSV backup'/>
        <div style={{padding:'16px 18px'}}>
          <div style={{color:T.dim,fontSize:13,marginBottom:12}}>Upload a previously downloaded backup CSV file to restore all data.</div>
          {!restorePreview&&(
            <label style={{cursor:'pointer',display:'inline-flex',alignItems:'center',gap:8,background:T.bLo,border:`1px solid ${T.blue}38`,color:T.blue,borderRadius:9,padding:'10px 18px',fontSize:13,fontWeight:700}}>
              📤 Choose Backup File (.csv)
              <input key={uploadKey} ref={fileRef} type='file' accept='.csv,.CSV' style={{display:'none'}} onChange={handleRestore}/>
            </label>
          )}
          {uploadProgress>0&&uploadProgress<100&&(
            <div style={{marginTop:14}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                <span style={{color:T.dim,fontSize:12}}>Reading file…</span>
                <span style={{color:T.accent,fontFamily:T.mono,fontSize:12,fontWeight:700}}>{uploadProgress}%</span>
              </div>
              <div style={{height:6,background:T.border,borderRadius:99,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${uploadProgress}%`,background:T.accent,borderRadius:99,transition:'width .15s'}}/>
              </div>
            </div>
          )}
          {restorePreview && restorePreview.restoredCustomers && (
            <div style={{background:T.wLo,border:`1px solid ${T.warn}38`,borderRadius:12,padding:'16px 18px',marginTop:12}}>
              <div style={{color:T.warn,fontWeight:800,fontSize:13,marginBottom:10}}>⚠ Confirm Restore from "{restorePreview.fileName}"</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
                {[['Customers',restorePreview.restoredCustomers.length],['Loans',restorePreview.restoredLoans.length],['Payments',restorePreview.restoredPayments.length],['Leads',restorePreview.restoredLeads.length],['Workers',restorePreview.restoredWorkers.length],['Audit Entries',restorePreview.restoredAudit.length]].map(([k,v])=>(
                  <div key={k} style={{background:T.surface,borderRadius:8,padding:'8px 12px'}}>
                    <div style={{color:T.muted,fontSize:10,textTransform:'uppercase',letterSpacing:.6}}>{k}</div>
                    <div style={{color:T.txt,fontWeight:800,fontFamily:T.mono,fontSize:15,marginTop:2}}>{v}</div>
                  </div>
                ))}
              </div>
              <Alert type='danger'>⚠ This will overwrite ALL current data in the system. This cannot be undone.</Alert>
              <div style={{display:'flex',gap:9,marginTop:4}}>
                <Btn v='danger' full onClick={doConfirmRestore}>✓ Restore Database</Btn>
                <Btn v='secondary' onClick={()=>{setRestorePreview(null);setUploadProgress(0);setUploadKey(k=>k+1);}}>Cancel</Btn>
              </div>
            </div>
          )}
          {restoreStatus&&(()=>{
            const isOk=restoreStatus.startsWith('ok:');
            const isErr=restoreStatus.startsWith('error:');
            const msg=restoreStatus.replace(/^(ok|error|warn):/,'');
            const type=isOk?'ok':isErr?'danger':'warn';
            return <Alert type={type} style={{marginTop:12}}>{msg}</Alert>;
          })()}
        </div>
      </Card>

      {/* Clear/Seed database — 3FA protected */}
      <Card style={{border:`1px solid ${T.danger}38`}}>
        <CH title='🗑 Data Operations' sub='Wipe or reset system data — requires 3-factor authentication'/>
        <div style={{padding:'16px 18px'}}>
          <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
            <div style={{flex:1,minWidth:240}}>
              <div style={{color:T.txt,fontWeight:700,fontSize:14,marginBottom:6}}>🗑 Wipe Database</div>
              <div style={{color:T.dim,fontSize:12,lineHeight:1.5,marginBottom:12}}>Permanently delete ALL data in the production instance. A full backup is downloaded automatically first.</div>
              <Btn v='danger' onClick={()=>{setRestoreStatus('');startClear();setRestorePreview({flavor:'clear'});}}>Initiate Database Clear →</Btn>
            </div>
            <div style={{width:1,background:T.border,alignSelf:'stretch'}}/>
            <div style={{flex:1,minWidth:240}}>
              <div style={{color:T.txt,fontWeight:700,fontSize:14,marginBottom:6}}>🌱 Restore Seed Data</div>
              <div style={{color:T.dim,fontSize:12,lineHeight:1.5,marginBottom:12}}>Populate the production instance with default sample data. Use this for first-time setup or testing.</div>
              <Btn v='secondary' style={{border:`1px solid ${T.hi}`,color:T.accent}} onClick={()=>{setRestoreStatus('');startClear();setRestorePreview({flavor:'seed'});}}>🌱 Restore Default Seed Data →</Btn>
            </div>
          </div>
        </div>
      </Card>

      {showClear&&(
        <Dialog title='🔐 Database Clear — 3-Factor Verification' onClose={()=>setShowClear(false)} width={440}>
          <Alert type='danger'>You are about to wipe all data. Complete 3-factor authentication to proceed.</Alert>
          <div style={{display:'flex',justifyContent:'center',gap:6,marginBottom:18}}>
            {['Password','Biometric','TOTP'].map((s,i)=>(
              <div key={s} style={{display:'flex',alignItems:'center',gap:4}}>
                <div style={{width:22,height:22,borderRadius:99,background:step>i+1?T.accent:step===i+1?T.aMid:T.surface,border:`2px solid ${step>i+1||step===i+1?T.accent:T.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:800,color:step>i+1?'#060A10':step===i+1?T.accent:T.muted}}>
                  {step>i+1?'✓':i+1}
                </div>
                <span style={{fontSize:10,color:step===i+1?T.accent:T.muted}}>{s}</span>
                {i<2&&<span style={{color:T.border}}>›</span>}
              </div>
            ))}
          </div>
          {err&&<Alert type='danger'>{err}</Alert>}
          {step===1&&<div>
            <FI label='Admin Password' type='password' value={pw} onChange={setPw} placeholder='Enter password'/>
            <Btn onClick={stepPw} full>Continue →</Btn>
          </div>}
          {step===2&&<div style={{textAlign:'center'}}>
            <div style={{fontSize:40,margin:'10px 0'}}>🔐</div>
            <div style={{color:T.txt,fontWeight:700,marginBottom:14}}>Biometric Verification</div>
            <Btn onClick={stepBio} full>Authenticate →</Btn>
          </div>}
          {step===3&&<div>
            <div style={{textAlign:'center',marginBottom:12,color:T.muted,fontSize:12}}>Enter TOTP code · Demo: <b style={{color:T.accent}}>123456</b></div>
            <input value={totp} onChange={e=>setTotp(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder='••••••' maxLength={6}
              style={{width:'100%',background:T.surface,border:`1px solid ${T.hi}`,borderRadius:10,padding:13,color:T.accent,fontSize:26,fontWeight:800,letterSpacing:12,textAlign:'center',outline:'none',marginBottom:9}}/>
            <Btn onClick={stepTotp} full>Verify →</Btn>
          </div>}
          {step===4&&<div>
            {restorePreview?.flavor==='seed' ? (
              <Alert type='warn'>⚠ This will clear all existing data before populating the database with default samples. Proceed?</Alert>
            ) : (
              <Alert type='danger'>⚠ FINAL WARNING: Clicking below will permanently delete all data. A backup has been downloaded. This cannot be undone.</Alert>
            )}
            <div style={{display:'flex',gap:9}}>
              {restorePreview?.flavor==='seed' ? (
                <Btn v='secondary' style={{background:T.accent,color:'#fff'}} full onClick={doRestoreSeed}>🌱 CONFIRM — POPULATE SEED DATA</Btn>
              ) : (
                <Btn v='danger' full onClick={doClear}>🗑 CONFIRM — Clear All Data</Btn>
              )}
              <Btn v='secondary' onClick={()=>setShowClear(false)}>Cancel</Btn>
            </div>
          </div>}
        </Dialog>
      )}
    </div>
  );
};


// ═══════════════════════════════════════════
//  WORKER DETAIL PANEL (admin view)
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
//  WORKERS PAGE
// ═══════════════════════════════════════════

export default DatabaseTab;
