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
const DatabaseTab = ({allState,setLoans,setCustomers,setPayments,setWorkers,setLeads,setInteractions,setAuditLog,addAudit,showToast=()=>{}, onGlobalReset}) => {
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
    // Clear LOCAL cache so it doesn't persist ghost data after reload
    localStorage.removeItem('acl_cache_v3');

    setLoans([]);setCustomers([]);setPayments([]);setLeads([]);setInteractions([]);
    setAuditLog(l=>[{ts:ts(),user:'admin',action:'DATABASE CLEARED',target:'ALL',detail:'All data wiped after 3FA verification'}]);
    addAudit('DATABASE CLEARED','ALL','Performed after full 3FA verification');
    setShowClear(false);setStep(0);
    showToast('🗑️ Database cleared — all data wiped','warn',5000);
    setRestoreStatus('');setUploadProgress(0);
    if (onGlobalReset) onGlobalReset();

    import('@/config/supabaseClient').then(({supabase,DEMO_MODE})=>{
      if(DEMO_MODE||!supabase) return;
      
      // Use the server-side RPC for a clean, atomic wipe
      supabase.rpc('global_wipe', { include_workers: true })
        .then(({ error }) => {
          if (error) {
            console.error('[Global Wipe RPC Error]', error.message);
            // Fallback to parallel deletes if RPC doesn't exist yet
            const tablesToWipe = ['loans','customers','payments','leads','interactions','audit_log', 'workers', 'monthly_targets', 'salary_payments', 'worker_deductions', 'repossessed_assets', 'mpesa_transactions', 'stk_requests', 'b2c_disbursements'];
            const NIL_UUID = '00000000-0000-0000-0000-000000000000';
            tablesToWipe.forEach(table => {
              let query = supabase.from(table).delete().neq('id', NIL_UUID);
              if (table === 'workers') query = supabase.from(table).delete().neq('role', 'Super Admin').neq('role', 'Admin');
              query.then(({error:e2}) => { if(e2) _sbErr('wipe-fallback', table, e2.message); });
            });
          }
        });
    }).catch(e=>_sbErr('import','doClear',e.message));
  };

  // ── SEED LOGIC ──────────────────────────────────────────────────────────────
  const doRestoreSeed=()=>{
    setLoans([]);setCustomers([]);setPayments([]);setLeads([]);setInteractions([]);setWorkers(SEED_WORKERS);
    setAuditLog([{ts:ts(),user:'admin',action:'SEED RESTORED',target:'ALL',detail:'Default seed data applied to production instance'}]);
    
    // Clear LOCAL cache so it doesn't conflict with fresh seed
    localStorage.removeItem('acl_cache_v3');
    
    import('@/config/supabaseClient').then(({supabase,DEMO_MODE})=>{
      if(DEMO_MODE||!supabase) return;
      const upsertBatch = (table,rows) => {
        if(!rows||rows.length===0) return;
        supabase.from(table).upsert(rows,{onConflict:'id'})
          .then(({error})=>{ if(error) _sbErr('seed-upsert',table,error.message); });
      };
      const tables = ['loans','customers','payments','leads','interactions','audit_log'];
      const NIL_UUID = '00000000-0000-0000-0000-000000000000';
      tables.forEach(t => {
        supabase.from(t).delete().neq('id', NIL_UUID).then(({ error }) => {
          if (error && error.code === '22P02') {
             return supabase.from(t).delete().neq('id', 'NON_EXISTENT_ID');
          }
          return { error };
        }).then(() => {
          if(t==='customers') upsertBatch('customers', SEED_CUSTOMERS.map(toSupabaseCustomer));
          if(t==='loans')     upsertBatch('loans',     SEED_LOANS.map(toSupabaseLoan));
          if(t==='payments')  upsertBatch('payments',  SEED_PAYMENTS.map(toSupabasePayment));
          if(t==='leads')     upsertBatch('leads',     SEED_LEADS.map(toSupabaseLead));
          if(t==='interactions') upsertBatch('interactions', SEED_INTERACTIONS.map(toSupabaseInteraction));
          if(t==='audit_log') upsertBatch('audit_log', SEED_AUDIT.map(a=>({ts:a.ts,user_name:a.user,action:a.action,target_id:a.target||'',detail:a.detail||''})));
        });
      });
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
    const end=after.search(/\n--- [A-Z ]+ ---/);
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
  const doConfirmRestore = async () => {
    if(!restorePreview) return;
    const {
      restoredCustomers = [],
      restoredLoans = [],
      restoredPayments = [],
      restoredLeads = [],
      restoredInteractions = [],
      restoredWorkers = [],
      restoredAudit = [],
      restoredTargets = [],
      restoredSalaries = [],
      restoredDeductions = [],
      restoredAssets = [],
      fileName
    } = restorePreview;

    setRestoreStatus('warn:⏳ Preparing system for restoration...');
    setUploadProgress(5);

    try {
      const { supabase, DEMO_MODE } = await import('@/config/supabaseClient');
      
      // 1. Linking logic
      const custById   = Object.fromEntries(restoredCustomers.map(c=>[c.id,c]));
      const custByName = Object.fromEntries(restoredCustomers.map(c=>[c.name.trim().toLowerCase(),c]));
      const linkedLoans = restoredLoans.map(l=>{
        if(l.customerId && custById[l.customerId]) return {...l, phone:custById[l.customerId].phone||l.phone};
        const match = custByName[l.customer?.trim().toLowerCase()]
                   || restoredCustomers.find(c=>c.phone&&c.phone===l.phone);
        return match ? {...l, customerId:match.id, phone:match.phone||l.phone} : l;
      });
      const linkedPayments = restoredPayments.map(p=>{
        if(p.customerId && custById[p.customerId]) return p;
        const loanMatch = linkedLoans.find(l=>l.id===p.loanId);
        if(loanMatch) return {...p, customerId:loanMatch.customerId};
        const nameMatch = custByName[p.customer?.trim().toLowerCase()];
        return nameMatch ? {...p, customerId:nameMatch.id} : p;
      });

      if (DEMO_MODE || !supabase) {
        // Just update local state for demo mode (handled below)
      } else {
        // 1. Clear phase
        setRestoreStatus('warn:🗑️ Overwriting current database state...');
        const tablesToDelete = ['audit_log', 'interactions', 'payments', 'loans', 'customers', 'leads', 'monthly_targets', 'salary_payments', 'worker_deductions', 'repossessed_assets', 'workers', 'mpesa_transactions', 'stk_requests', 'b2c_disbursements'];
        const NIL_UUID = '00000000-0000-0000-0000-000000000000';
        for(const t of tablesToDelete) {
          let query;
          if (t === 'workers') {
             query = supabase.from(t).delete().neq('role', 'Super Admin').neq('role', 'Admin');
          } else {
             query = supabase.from(t).delete().neq('id', NIL_UUID);
          }

          const { error } = await query;
          if(error) {
            console.warn(`[Restore Clear ${t}]`, error);
            // Some tables might use string IDs instead of UUIDs
            if (error.code === '22P02') {
              let fallbackQuery = supabase.from(t).delete().neq('id', 'NON_EXISTENT_ID');
              if (t === 'workers') fallbackQuery = supabase.from(t).delete().neq('role', 'Super Admin').neq('role', 'Admin');
              await fallbackQuery;
            }
          }
        }

        // 2. Restore phase
        const chunk = (arr,size) => Array.from({length:Math.ceil(arr.length/size)},(_,i)=>arr.slice(i*size,(i+1)*size));
        const upsertAll = async (table, rows, mapper) => {
          if (!rows || rows.length === 0) return;
          const mapped = mapper ? rows.map(mapper) : rows;
          const batches = chunk(mapped, 50); // Smaller batches for reliability
          for (let i = 0; i < batches.length; i++) {
            const { error } = await supabase.from(table).upsert(batches[i], { onConflict: 'id' });
            if (error) {
              console.error(`[RESTORE ERROR] ${table} batch ${i+1}:`, error);
              throw new Error(`[${table} upload] ${error.message} - Please run the SQL security fix.`);
            }
          }
        };

        // Helper to fix DD/MM/YYYY dates for Postgres
        const fixDate = (d) => {
          if (!d || typeof d !== 'string' || d.trim() === '' || d === 'N/A') return null;
          if (d.includes('/')) {
            const [datePart, timePart] = d.split(' ');
            const [dd, mm, yyyy] = datePart.split('/');
            if (dd && mm && yyyy) return `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}${timePart ? ' ' + timePart : ''}`;
          }
          return d;
        };

        setRestoreStatus('warn:📤 Restoring Customers...');
        await upsertAll('customers', restoredCustomers, c => ({
          ...toSupabaseCustomer(c),
          joined: fixDate(c.joined)
        }));
        setUploadProgress(40);

        setRestoreStatus('warn:📤 Restoring Loans...');
        await upsertAll('loans', linkedLoans, l => ({
          ...toSupabaseLoan(l),
          disbursed: fixDate(l.disbursed)
        }));
        setUploadProgress(60);

        setRestoreStatus('warn:📤 Restoring Payments...');
        await upsertAll('payments', linkedPayments, p => ({
          ...toSupabasePayment(p),
          date: fixDate(p.date)
        }));
        setUploadProgress(75);

        setRestoreStatus('warn:📤 Restoring Communications...');
        if(restoredLeads.length > 0) {
          await upsertAll('leads', restoredLeads, l => ({
            ...toSupabaseLead(l),
            date: fixDate(l.date)
          }));
        }
        if(restoredInteractions?.length > 0) {
          await upsertAll('interactions', restoredInteractions, i => ({
            ...toSupabaseInteraction(i),
            date: fixDate(i.date),
            promise_date: fixDate(i.promiseDate)
          }));
        }
        setUploadProgress(85);

        setRestoreStatus('warn:📤 Synchronizing Audit Ledger...');
        if(restoredAudit.length > 0) {
          await upsertAll('audit_log', restoredAudit, a => {
            const entry = { ...a, ts: fixDate(a.ts) };
            if (entry.id === undefined) delete entry.id;
            return entry;
          });
        }

        setRestoreStatus('warn:📤 Updating Team Credentials...');
        if(restoredWorkers.length > 0) {
          await upsertAll('workers', restoredWorkers, w => ({
            id: w.id,
            name: w.name,
            email: w.email,
            role: w.role,
            status: w.status,
            phone: w.phone || null,
            id_no: w.idNo || null,
            base_salary: w.baseSalary || 20000,
            onboarding_target: w.onboardingTarget || 60,
            collection_target: w.collectionTarget || 500000,
            joined: fixDate(w.joined)
          }));
        }

        setRestoreStatus('warn:📤 Reinstating Asset Registry...');
        if(restoredAssets.length > 0) {
          await upsertAll('repossessed_assets', restoredAssets, a => ({
            ...toSupabaseAsset(a),
            possession_date: fixDate(a.possessionDate)
          }));
        }

        setRestoreStatus('warn:📤 Restoring Performance Targets...');
        if(restoredTargets.length > 0) {
          await upsertAll('monthly_targets', restoredTargets);
        }

        setRestoreStatus('warn:📤 Rebuilding Salary History...');
        if(restoredSalaries.length > 0) {
          await upsertAll('salary_payments', restoredSalaries, s => ({
            ...s,
            created_at: fixDate(s.created_at)
          }));
        }

        if(restoredDeductions.length > 0) {
          await upsertAll('worker_deductions', restoredDeductions, d => ({
            ...d,
            created_at: fixDate(d.created_at)
          }));
        }
      }

      // 4. Update UI state only after successful sync
      if(restoredCustomers.length>0) setCustomers(restoredCustomers);
      if(linkedLoans.length>0)       setLoans(linkedLoans);
      if(linkedPayments.length>0)    setPayments(linkedPayments);
      if(restoredLeads.length>0)     setLeads(restoredLeads);
      if(restoredWorkers.length>0)   setWorkers(restoredWorkers);
      if(restoredInteractions?.length>0) setInteractions(restoredInteractions);
      
      const newAuditEntry = {ts:ts(),user:'admin',action:'Database Restored',target:fileName,detail:`C:${restoredCustomers.length} L:${restoredLoans.length}`};
      setAuditLog(la=>[newAuditEntry, ...(restoredAudit.length?restoredAudit:la)]);
      addAudit('Database Restored',fileName,`C:${restoredCustomers.length} L:${restoredLoans.length}`);

      setRestoreStatus(`ok:✅ Successfully restored and synchronized.`);
      setUploadProgress(100);
      showToast('✅ Database restored from backup','ok',4000); SFX.upload();
      setRestorePreview(null);
    } catch (err) {
      _sbErr('restore', 'FATAL', err.message);
      setRestoreStatus(`error:❌ Restoration failed: ${err.message}`);
      showToast('Restoration failed: ' + err.message, 'danger');
    }
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
          const rawInter=parseCSVSection(text,'INTERACTIONS');
          const rawWorkers=parseCSVSection(text,'WORKERS');
          const rawAudit=parseCSVSection(text,'AUDIT LOG');
          const rawTargets=parseCSVSection(text,'TARGETS');
          const rawSalaries=parseCSVSection(text,'SALARY PAYMENTS');
          const rawDeductions=parseCSVSection(text,'WORKER DEDUCTIONS');
          const rawAssets=parseCSVSection(text,'REPOSSESSED ASSETS');

          const restoredCustomers=rawCusts.map(r=>{
            const f = (keys) => {
              for (const k of keys) {
                const foundKey = Object.keys(r).find(rk => rk.trim().toLowerCase() === k.trim().toLowerCase());
                if (foundKey) return r[foundKey];
              }
              return '';
            };

            return {
              id: f(['ID', 'Customer ID']), 
              name: f(['Name', 'Full Name']), 
              phone: f(['Phone', 'Mobile']), 
              altPhone: f(['Alt Phone', 'Phone 2']),
              idNo: f(['ID No', 'National ID']), 
              dob: f(['DOB', 'Date of Birth']),
              gender: f(['Gender']),
              business: f(['Business', 'Business Name']), 
              businessType: f(['Business Type']), 
              location: f(['Location', 'Address']), 
              officer: f(['Officer', 'Agent']), 
              loans: Number(f(['Loans'])) || 0, 
              risk: f(['Risk']) || 'Low', 
              joined: f(['Joined', 'Registration Date', 'Created At']), 
              blacklisted: f(['Blacklisted']).toLowerCase() === 'yes',
              n1n: f(['NOK1 Name', 'Next of Kin Name']), 
              n1p: f(['NOK1 Phone', 'Next of Kin Phone', 'NOK Phone']), 
              n1r: f(['NOK1 Relation', 'Next of Kin Relation']),
              n2n: f(['NOK2 Name']), n2p: f(['NOK2 Phone']), n2r: r['NOK2 Relation']||'',
              n3n: f(['NOK3 Name']), n3p: f(['NOK3 Phone']), n3r: r['NOK3 Relation']||'',
              documents: []
            };
          });
          const restoredLoans=rawLoans.map(r=>({
            id:r['Loan ID'],
            customerId:r['Customer ID']||'',
            customer:r['Customer'],
            amount:Number(r['Principal'])||0,
            balance:Number(r['Balance']||r['Remaining'])||0,
            status:r['Status'],
            daysOverdue:Number(r['Days Overdue'])||0,
            officer:r['Officer'],
            disbursed:r['Disbursed']==='N/A'?null:r['Disbursed'],
            repaymentType:r['Repayment Type']||'Monthly',
            payments:[]
          }));
          const restoredPayments=rawPayments.map(r=>({
            id:r['ID'],
            customerId:r['Customer ID']||null,
            customer:r['Customer'],
            loanId:r['Loan ID']==='N/A'?null:r['Loan ID'],
            amount:Number(r['Amount'])||0,
            mpesa:r['M-Pesa'],
            date:r['Date'],
            status:r['Status']
          }));
          const restoredLeads=rawLeads.map(r=>({
            id:r['ID'],
            name:r['Name'],
            phone:r['Phone'],
            business:r['Business'],
            source:r['Source'],
            status:r['Status']||'New',
            officer:r['Officer'],
            date:r['Date']
          }));
          const restoredInteractions=rawInter.map(r=>({
            id:r['ID'],
            customerId:r['Customer ID'],
            loanId:r['Loan ID'],
            type:r['Type'],
            date:r['Date'],
            officer:r['Officer'],
            notes:r['Notes']||'',
            promiseAmount:r['Promise Amount']||null,
            promiseDate:r['Promise Date']||null,
            promiseStatus:r['Promise Status']||'Pending'
          }));
          const restoredWorkers=rawWorkers.map(r=>{
            const f = (keys) => {
              for (const k of keys) {
                const foundKey = Object.keys(r).find(rk => rk.trim().toLowerCase() === k.trim().toLowerCase());
                if (foundKey) return r[foundKey];
              }
              return '';
            };
            return {
              id: f(['ID', 'Worker ID']),
              name: f(['Name']),
              email: f(['Email']),
              role: f(['Role']),
              status: f(['Status']),
              phone: f(['Phone', 'Mobile']),
              idNo: f(['ID No', 'National ID']),
              baseSalary: Number(f(['Salary', 'Base Salary'])) || 20000,
              onboardingTarget: Number(f(['Onboarding Target', 'Target'])) || 60,
              collectionTarget: Number(f(['Collection Target', 'Collection'])) || 500000,
              joined: f(['Joined'])
            };
          });
          const restoredAudit=rawAudit.map(r=>({
            id: r['ID'] || undefined,
            ts:r['Timestamp'],
            user_name:r['User'],
            action:r['Action'],
            target_id:r['Target'],
            detail:r['Detail']||r['Details']||''
          }));
          const restoredTargets=rawTargets.map(r=>({
            id: r['ID'],
            worker_id: r['Worker ID'],
            month: r['Month'],
            onboarding_target: Number(r['Onboarding Target'])||0,
            collection_target: Number(r['Collection Target'])||0
          }));
          const restoredSalaries=rawSalaries.map(r=>({
            id: r['ID'],
            worker_id: r['Worker ID'],
            amount: Number(r['Amount'])||0,
            month: r['Month'],
            created_at: r['Date'],
            status: r['Status'],
            mpesa_receipt: r['Receipt'],
            recipient_phone: r['Recipient Phone']
          }));
          const restoredDeductions=rawDeductions.map(r=>({
            id: r['ID'],
            worker_id: r['Worker ID'],
            amount: Number(r['Amount'])||0,
            month: r['Month'],
            reason: r['Reason'],
            created_at: r['Date']
          }));
          const restoredAssets=rawAssets.map(r=>({
            id: r['ID'],
            loanId: r['Loan ID'],
            name: r['Asset Name'],
            serial: r['Serial'],
            possessionDate: r['Possession Date'],
            status: r['Status'],
            estimatedValue: Number(r['Estimated Value'])||0,
            actualSalePrice: Number(r['Actual Sale Price'])||0,
            officer: r['Officer']
          }));

          setUploadProgress(100);
          setRestoreStatus('');
          setRestorePreview({restoredCustomers,restoredLoans,restoredPayments,restoredLeads,restoredInteractions,restoredWorkers,restoredAudit,restoredTargets,restoredSalaries,restoredDeductions,restoredAssets,fileName:file.name});
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
      {/* Loading Overlay for Restoration */}
      {(uploadProgress > 0 && uploadProgress < 100 && restoreStatus.includes('warn:')) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 12, 0.8)', backdropFilter: 'blur(12px)', zIndex: 100000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
          <div style={{ position: 'relative', width: 140, height: 140 }}>
            <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="70" cy="70" r="64" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
              <circle cx="70" cy="70" r="64" fill="none" stroke={T.accent} strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 64}`}
                strokeDashoffset={`${2 * Math.PI * 64 * (1 - uploadProgress / 100)}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, fontWeight: 900, fontFamily: T.mono }}>
              {Math.round(uploadProgress)}%
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#fff', fontSize: 20, fontWeight: 800, marginBottom: 8, fontFamily: T.head }}>Restoring Production Integrity</div>
            <div style={{ color: T.accent, fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.5 }}>
              {restoreStatus.split(':')[1] || 'Synchronizing Data...'}
            </div>
          </div>
        </div>
      )}

      {/* Main UI */}
      <div style={{ padding: '32px 24px', maxWidth: 1200, margin: '0 auto', animation: 'fadeIn 0.6s ease-out' }}>
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
    </div>
  );
};

export default DatabaseTab;
