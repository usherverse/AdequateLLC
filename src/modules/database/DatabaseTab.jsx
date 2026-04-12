import CustomerProfile from "@/modules/customers/CustomerProfile";
import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { Database, Download, Upload, Trash2, Lock, Check, ShieldCheck, Zap, RotateCcw } from 'lucide-react';
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

/**
 * DatabaseTab — Premium iOS-Inspired Admin Data Management
 * Handles Backups, Restores, Database Wipes, and Integrity Audits.
 */
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
  const [restorePreview,setRestorePreview]=useState(null); 
  const fileRef=useRef();

  const allStateRef=useRef(allState);
  allStateRef.current=allState; 
  const addAuditRef=useRef(addAudit);
  addAuditRef.current=addAudit;

  // ── BACKUP LOGIC ───────────────────────────────────────────────────────────
  const doBackup=useCallback(()=>{
    const csv=buildFullBackup(allStateRef.current);
    dlCSV(`acl-backup-${now()}.csv`,csv);
    setLastBackup(new Date().toLocaleTimeString('en-KE'));
    addAuditRef.current('Database Backup Downloaded','ALL',`Full backup at ${ts()}`);
    showToast('✅ Backup CSV downloaded','ok');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // ── CLEAR / WIPE LOGIC ─────────────────────────────────────────────────────
  const startClear=()=>{setShowClear(true);setStep(1);setPw('');setTotp('');setErr('');};
  const stepPw=()=>{if(pw.length<4){setErr('Invalid password.');return;}setErr('');setStep(2);};
  const stepBio=()=>setStep(3);
  const stepTotp=()=>{if(totp!=='123456'){setErr('Invalid TOTP code.');try{SFX.error();}catch(e){};return;}setStep(4);setErr('');};

  const doClear=()=>{
    setLoans([]);setCustomers([]);setPayments([]);setLeads([]);setInteractions([]);
    setAuditLog(l=>[{ts:ts(),user:'admin',action:'DATABASE CLEARED',target:'ALL',detail:'All data wiped after 3FA verification'}]);
    addAudit('DATABASE CLEARED','ALL','Performed after full 3FA verification');
    setShowClear(false);setStep(0);
    showToast('🗑️ Database cleared — all data wiped','warn',5000);
    setRestoreStatus('');setUploadProgress(0);

    import('@/config/supabaseClient').then(({supabase,DEMO_MODE})=>{
      if(DEMO_MODE||!supabase) return;
      ['loans','customers','payments','leads','interactions','audit_log'].forEach(table=>
        supabase.from(table).delete().neq('id','__none__')
          .then(({error})=>{ if(error) _sbErr('clear',table,error.message); })
      );
    }).catch(e=>_sbErr('import','doClear',e.message));
  };

  // ── SEED LOGIC ──────────────────────────────────────────────────────────────
  const doRestoreSeed=()=>{
    setLoans([]);setCustomers([]);setPayments([]);setLeads([]);setInteractions([]);setWorkers(SEED_WORKERS);
    setAuditLog([{ts:ts(),user:'admin',action:'SEED RESTORED',target:'ALL',detail:'Default seed data applied to production instance'}]);
    
    import('@/config/supabaseClient').then(({supabase,DEMO_MODE})=>{
      if(DEMO_MODE||!supabase) return;
      const upsertBatch = (table,rows) => {
        if(!rows||rows.length===0) return;
        supabase.from(table).upsert(rows,{onConflict:'id'})
          .then(({error})=>{ if(error) _sbErr('seed-upsert',table,error.message); });
      };
      const tables = ['loans','customers','payments','leads','interactions','audit_log'];
      tables.forEach(t=>supabase.from(t).delete().neq('id','__none__').then(()=>{
        if(t==='customers') upsertBatch('customers', SEED_CUSTOMERS.map(toSupabaseCustomer));
        if(t==='loans')     upsertBatch('loans',     SEED_LOANS.map(toSupabaseLoan));
        if(t==='payments')  upsertBatch('payments',  SEED_PAYMENTS.map(toSupabasePayment));
        if(t==='leads')     upsertBatch('leads',     SEED_LEADS.map(toSupabaseLead));
        if(t==='interactions') upsertBatch('interactions', SEED_INTERACTIONS.map(toSupabaseInteraction));
        if(t==='audit_log') upsertBatch('audit_log', SEED_AUDIT.map(a=>({ts:a.ts,user_name:a.user,action:a.action,target_id:a.target||'',detail:a.detail||''})));
      }));
    }).catch(e=>_sbErr('import','doRestoreSeed',e.message));

    setRestoreStatus('ok:✅ Seed data restored!');
    showToast('🌱 Default seed data restored','ok');
    setStep(0);setShowClear(false);
  };

  // ── PARSER ─────────────────────────────────────────────────────────────────
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

  // ── INTEGRITY SYNC ─────────────────────────────────────────────────────────
  const doSyncStatuses = async () => {
    const { loans, payments } = allStateRef.current;
    if (!loans.length) return;
    
    setRestoreStatus('warn:⏳ Auditing loan statuses...');
    setUploadProgress(10);
    
    const paidMap = payments.reduce((acc, p) => {
      if (p.loanId) acc[p.loanId] = (acc[p.loanId] || 0) + p.amount;
      return acc;
    }, {});
    
    const updates = [];
    loans.forEach(l => {
      const e = calculateLoanStatus(l, null, paidMap[l.id] || 0);
      const officialStatus = e.isSettled ? 'Settled' : e.isWrittenOff ? 'Written off' : (e.overdueDays > 0 ? 'Overdue' : 'Active');
      if (l.status !== officialStatus || l.daysOverdue !== e.overdueDays) {
        updates.push({ ...l, status: officialStatus, daysOverdue: e.overdueDays });
      }
    });

    if (updates.length === 0) {
      setRestoreStatus('ok:✅ All loan statuses are already synchronized.');
      setUploadProgress(100);
      showToast('All statuses synchronized', 'ok');
      return;
    }

    setRestoreStatus(`warn:🔄 Updating ${updates.length} loans in database...`);
    setUploadProgress(40);

    try {
      const { supabase, DEMO_MODE } = await import('@/config/supabaseClient');
      if (DEMO_MODE || !supabase) {
        setLoans(ls => ls.map(l => {
          const up = updates.find(u => u.id === l.id);
          return up ? { ...l, status: up.status, daysOverdue: up.daysOverdue } : l;
        }));
      } else {
        const chunkSize = 100;
        for (let i = 0; i < updates.length; i += chunkSize) {
          const batch = updates.slice(i, i + chunkSize);
          const { error } = await supabase.from('loans').upsert(batch.map(toSupabaseLoan), { onConflict: 'id' });
          if (error) throw error;
          setUploadProgress(40 + Math.round((i / updates.length) * 50));
        }
        setLoans(ls => ls.map(l => {
          const up = updates.find(u => u.id === l.id);
          return up ? { ...l, status: up.status, daysOverdue: up.daysOverdue } : l;
        }));
      }

      setRestoreStatus(`ok:✅ Successfully synchronized ${updates.length} loan statuses.`);
      setUploadProgress(100);
      addAuditRef.current('FINANCIAL SYNC', 'ALL', `Updated ${updates.length} loan statuses (Settled/Written off)`);
      showToast(`Updated ${updates.length} loans`, 'ok');
      SFX.upload();
    } catch (e) {
      _sbErr('sync', 'loans', e.message);
      setRestoreStatus(`error:❌ Synchronization failed: ${e.message}`);
      setUploadProgress(0);
    }
  };

  // ── RESTORE LOGIC ──────────────────────────────────────────────────────────
  const doConfirmRestore = () => {
    if(!restorePreview) return;
    const {restoredCustomers,restoredLoans,restoredPayments,restoredLeads,restoredWorkers,restoredAudit,fileName}=restorePreview;

    if(restoredCustomers.length>0) setCustomers(restoredCustomers);
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

    import('@/config/supabaseClient').then(({supabase,DEMO_MODE})=>{
      if(DEMO_MODE||!supabase) return;
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

    setRestoreStatus(`ok:✅ Restored from snapshot.`);
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
            setRestoreStatus('error:⚠️ Invalid backup file.');return;
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
          setRestorePreview({restoredCustomers,restoredLoans,restoredPayments,restoredLeads,restoredWorkers,restoredAudit,fileName:file.name});
          setRestoreStatus('');
        }catch(err){
          setUploadProgress(0);
          setRestoreStatus('error:❌ Error parsing file: '+err.message);
        }
      },200);
    };
    reader.readAsText(file);
    e.target.value='';
  };

  return (
    <div className='fu' style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ background: T.aLo, padding: 12, borderRadius: 18, border: `1px solid ${T.accent}33` }}>
            <Database size={28} color={T.accent} />
          </div>
          <div>
            <h1 style={{fontFamily:T.head,color:T.txt,fontSize:24,fontWeight:900,margin:0,letterSpacing:'-0.5px'}}>Database Engine</h1>
            <p style={{ color: T.muted, fontSize: 13, margin: 0 }}>Advanced System Control</p>
          </div>
        </div>
      </div>

      {/* Main Integrity Card */}
      <Card style={{ marginBottom: 20, border: `1px solid ${T.accent}40`, background: `linear-gradient(135deg, ${T.aLo}15 0%, ${T.bg} 100%)`, borderRadius: 24, padding: '24px 30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: T.txt, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <ShieldCheck size={22} color={T.accent} /> Integrity Audit
            </div>
            <p style={{ color: T.muted, fontSize: 14, margin: 0 }}>Reconcile statuses and policies for {allState.loans.length} active records.</p>
          </div>
          <Btn onClick={doSyncStatuses} icon={Zap} v="accent" shadow sm>Run Global Audit</Btn>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 20 }}>
        {/* Export Card */}
        <Card style={{ padding: '28px', borderRadius: 24 }}>
          <CH title="Data Export" icon={Download} />
          <p style={{ color: T.muted, fontSize: 13, marginBottom: 24 }}>Generate snapshots of system state.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Btn onClick={doBackup} icon={ShieldCheck} sm v="surface">Full Instance CSV</Btn>
            <Btn v='secondary' sm icon={Database} onClick={()=>{const csv=toCSV(['Timestamp','User','Action','Target','Details'],allState.auditLog.map(e=>[e.ts,e.user,e.action,e.target,e.detail||'']));dlCSV(`audit-log-${now()}.csv`,csv);}}>Logs</Btn>
          </div>
          {lastBackup && <div style={{ marginTop: 20, fontSize: 11, color: T.ok, fontWeight: 800 }}>Snapshot exported at {lastBackup}</div>}
        </Card>

        {/* Restore Card */}
        <Card style={{ padding: '28px', borderRadius: 24 }}>
          <CH title="Restore Engine" icon={Upload} />
          <p style={{ color: T.muted, fontSize: 13, marginBottom: 24 }}>Import from status snapshot.</p>
          {!restorePreview && (
            <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 12, background: T.surface, border: `1px solid ${T.border}`, color: T.txt, borderRadius: 16, padding: '12px 24px', fontSize: 13, fontWeight: 700 }}>
              <Upload size={18} color={T.accent} /> Select Backup File
              <input key={uploadKey} ref={fileRef} type='file' accept='.csv,.CSV' style={{ display: 'none' }} onChange={handleRestore} />
            </label>
          )}
          {restorePreview && (
            <div style={{ background: T.surface, borderRadius: 20, padding: '20px' }}>
              <div style={{ color: T.accent, fontWeight: 900, fontSize: 12, marginBottom: 14 }}>Snapshot Validated</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Btn v='accent' full sm onClick={doConfirmRestore}>Execute Restore</Btn>
                <Btn v='surface' sm onClick={() => { setRestorePreview(null); setUploadProgress(0); setUploadKey(k => k + 1); }}>Abort</Btn>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Danger Zone */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        <Card style={{ border: `1px dashed ${T.danger}40`, padding: '24px 28px', borderRadius: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.danger, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Trash2 size={18} /> Global Wipe
          </div>
          <Btn v='danger' sm onClick={() => { startClear(); setRestorePreview({ flavor: 'clear' }); }}>Authorize Global Wipe</Btn>
        </Card>
        <Card style={{ border: `1px dashed ${T.accent}40`, padding: '24px 28px', borderRadius: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.accent, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <RotateCcw size={18} /> Revert to Seed
          </div>
          <Btn v='secondary' sm onClick={() => { startClear(); setRestorePreview({ flavor: 'seed' }); }}>Restore Baseline</Btn>
        </Card>
      </div>

      {showClear && (
        <Dialog title={<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><ShieldCheck size={24} color={T.danger} /> Security Authorization</div>} onClose={() => setShowClear(false)} width={440}>
          <div style={{ minHeight: 180 }}>
            {step === 1 && (
              <div>
                <FI label='Admin Password' type='password' value={pw} onChange={setPw} placeholder='••••••••' />
                <Btn onClick={stepPw} full style={{ marginTop: 16 }}>Authorize</Btn>
              </div>
            )}
            {step === 2 && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 60, height: 60, borderRadius: 30, background: T.aLo, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}><Lock size={30} color={T.accent} /></div>
                <Btn onClick={stepBio} full v="accent">Continue Biometric</Btn>
              </div>
            )}
            {step === 3 && (
              <div>
                <input value={totp} onChange={e => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder='000 000' maxLength={6}
                    style={{ width: '100%', background: T.bg, border: `1px solid ${T.border}`, borderRadius: 20, padding: '20px 0', fontSize: 32, textAlign: 'center' }} />
                <Btn onClick={stepTotp} full icon={Check} style={{ marginTop: 16 }}>Final Validation</Btn>
              </div>
            )}
            {step === 4 && (
              <div>
                <Alert type="danger" style={{ marginBottom: 20 }}>Irreversible Action required.</Alert>
                <div style={{ display: 'flex', gap: 12 }}>
                  <Btn v={restorePreview?.flavor==='seed'?'accent':'danger'} full onClick={restorePreview?.flavor==='seed'?doRestoreSeed:doClear}>Confirm</Btn>
                  <Btn v='secondary' onClick={() => setShowClear(false)}>Abort</Btn>
                </div>
              </div>
            )}
          </div>
        </Dialog>
      )}
      <ToastContainer toasts={[]} />
    </div>
  );
};

export default DatabaseTab;
