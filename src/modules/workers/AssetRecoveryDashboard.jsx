import React, { useState, useMemo } from 'react';
import { 
  Card, CH, KPI, DT, Badge, Btn, FI, Alert, Dialog,
  fmt, fmtM, uid, now, sbWrite, toSupabaseInteraction, toSupabaseCustomer, toSupabaseLoan,
  calculateLoanStatus, T, RC, SC, generateCollectionLetterHTML, dlBlob, toSupabaseAsset, fromSupabaseAsset
} from '@/lms-common';
import { 
  ShieldAlert, Gavel, MapPin, Truck, Smartphone, Car, 
  FileText, Scale, XCircle, AlertTriangle, Phone, 
  MessageSquare, Check, History, Clock, Hammer, ExternalLink
} from 'lucide-react';

const RECOVERY_STAGES = [
  { id: 'Field Visit',  label: 'Field Enforcement', color: '#FB923C', icon: <Truck />, desc: 'Physical asset verification and face-to-face enforcement.', actions: ['Schedule Repossession', 'Mark Visit Complete', 'Issue Final Warning'] },
  { id: 'Demand Letter', label: 'Demand Phase',      color: '#F97316', icon: <FileText />, desc: 'Final formal demands before legal attachment.', actions: ['Issue Final Demand', 'Contact Guarantors'] },
  { id: 'Legal',         label: 'Litigation',        color: '#EA580C', icon: <Gavel />, desc: 'Cases handed over to legal for court attachment.', actions: ['File Court Order', 'Attach Assets', 'Auction Notice'] },
  { id: 'Written Off',   label: 'Asset Disposal',    color: T.muted,   icon: <Hammer />, desc: 'Disposal of recovered assets or account write-off.', actions: ['Approve Disposal', 'Update Valuation', 'Final Write-Off'] },
];

export default function AssetRecoveryDashboard({ 
  worker, loans = [], customers = [], payments = [], 
  interactions = [], setInteractions, setLoans, setCustomers,
  repossessedAssets = [], setRepossessedAssets,
  addAudit, showToast = () => {}, onOpenCustomerProfile 
}) {
  const [pipeStage, setPipeStage] = useState(null);
  const [selLoan, setSelLoan]     = useState(null);
  const [pipeAction, setPipeAction] = useState(null);

  // ── Recovery Portfolio Logic ───────────────────────────────────────────────
  const recoveryLoans = useMemo(() => {
    const paidMap = payments.reduce((acc, p) => {
      if (p.loanId && (p.status === "Allocated" || p.status === "allocated"))
        acc[p.loanId] = (acc[p.loanId] || 0) + p.amount;
      return acc;
    }, {});

    return loans.filter(l => {
      const paid = l.disbursed ? (paidMap[l.id] || 0) : 0;
      const e = calculateLoanStatus(l, null, paid);
      const isHardArrears = e.overdueDays > 30 && !e.isSettled;
      const isLegal = l.status === 'Legal' || l.status === 'Written off';
      return isHardArrears || isLegal;
    }).map(l => {
      const paid = l.disbursed ? (paidMap[l.id] || 0) : 0;
      const e = calculateLoanStatus(l, null, paid);
      return { ...l, balance: e.totalAmountDue, daysOverdue: e.overdueDays };
    });
  }, [loans, payments]);

  const stats = useMemo(() => {
    return {
      totalVal: recoveryLoans.reduce((s, l) => s + l.balance, 0),
      count: recoveryLoans.length,
      legalCount: recoveryLoans.filter(l => l.status === 'Legal').length,
      possessedCount: repossessedAssets.filter(a => a.status === 'Possessed').length,
    };
  }, [recoveryLoans, repossessedAssets]);

  const doAction = (stage, action) => {
    if (!selLoan) return;
    const cust = customers.find(c => c.name === selLoan.customer);
    
    const notes = `[RECOVERY] ${stage.label} - ${action}: Initiative taken on loan ${selLoan.id}. Outcome pending verification.`;
    const entry = {
      id: uid('INT'),
      customerId: cust?.id || '',
      loanId: selLoan.id,
      type: 'Recovery Action',
      date: now(),
      officer: worker?.name || 'Asset Recovery Officer',
      notes,
      promiseAmount: null,
      promiseDate: null,
      promiseStatus: null
    };

    setInteractions(is => [entry, ...is]);
    sbWrite('interactions', toSupabaseInteraction(entry)).catch(console.error);
    
    if (addAudit) addAudit(`Asset Recovery: ${action}`, selLoan.id, `Officer: ${worker?.name}`);
    
    // ── Functional Realization ───────────────────────────────────────────
    
    // 1. Blacklisting
    if (action.includes('Blacklist') && cust) {
       const uCust = { ...cust, blacklisted: true, status: 'Blacklisted', blReason: 'High Arrears recovery escalation' };
       if (setCustomers) setCustomers(prev => prev.map(c => c.id === cust.id ? uCust : c));
       sbWrite('customers', toSupabaseCustomer(uCust)).catch(console.error);
       showToast(selLoan.customer + ' permanently blacklisted', 'danger');
    }
    
    // 2. Status Transitions
    if (action.includes('Court Order') || action.includes('Legal')) {
       const uLoan = { ...selLoan, status: 'Legal' };
       setLoans(prev => prev.map(l => l.id === selLoan.id ? uLoan : l));
       sbWrite('loans', toSupabaseLoan(uLoan)).catch(console.error);
       showToast('Loan ' + selLoan.id + ' moved to LEGAL status', 'warn');
    }

    if (action.includes('Write-Off') || (action.includes('Disposal') && action.includes('Final'))) {
       const uLoan = { ...selLoan, status: 'Written off' };
       setLoans(prev => prev.map(l => l.id === selLoan.id ? uLoan : l));
       sbWrite('loans', toSupabaseLoan(uLoan)).catch(console.error);
       showToast('Loan ' + selLoan.id + ' officially WRITTEN OFF', 'danger');
    }

    // 3. Document Generation & Print
    if (action.includes('Warning') || action.includes('Demand')) {
       const type = action.includes('Warning') ? 'Final Notice' : 'Demand Letter';
       const html = generateCollectionLetterHTML(type, selLoan, cust || { name: selLoan.customer }, worker?.name, selLoan.balance);
       const pWindow = window.open('', '_blank');
       pWindow.document.write(html);
       pWindow.document.close();
       setTimeout(() => { pWindow.print(); }, 500);
       showToast(type + ' generated and sent to printer', 'ok');
    }

    // 4. Asset Repossession Lifecycle
    if (action.includes('Attach Assets') || action.includes('Repossession')) {
       const asset = {
         id: uid('AST'),
         loanId: selLoan.id,
         customer: selLoan.customer,
         assetName: selLoan.assetName || 'Contractual Collateral',
         possessionDate: now().split('T')[0],
         status: 'Possessed',
         valuation: selLoan.balance,
         officer: worker?.name,
         notes: `Authorized via recovery pipeline: ${action}`
       };
       setRepossessedAssets(prev => [asset, ...prev]);
       sbWrite('repossessed_assets', toSupabaseAsset(asset)).catch(console.error);
       showToast(`Asset repossession recorded for ${selLoan.customer}`, 'warn');

       // Print Repossession Notice
       const html = generateCollectionLetterHTML('Repossession Notice', selLoan, cust || { name: selLoan.customer }, worker?.name, selLoan.balance);
       const pWindow = window.open('', '_blank');
       pWindow.document.write(html);
       pWindow.document.close();
       setTimeout(() => { pWindow.print(); }, 500);
    }

    if (action === 'Approve Disposal') {
       const asset = repossessedAssets.find(a => a.loanId === selLoan.id && a.status === 'Possessed');
       if (asset) {
          const upd = { 
            ...asset, 
            status: 'Disposed', 
            disposalAmount: selLoan.balance, 
            disposalDate: now().split('T')[0] 
          };
          setRepossessedAssets(prev => prev.map(a => a.id === asset.id ? upd : a));
          sbWrite('repossessed_assets', toSupabaseAsset(upd)).catch(console.error);
          showToast(`Disposal approved for ${selLoan.customer}`, 'ok');

          // Print Disposal Certificate
          const html = generateCollectionLetterHTML('Disposal Certificate', selLoan, cust || { name: selLoan.customer }, worker?.name, selLoan.balance);
          const pWindow = window.open('', '_blank');
          pWindow.document.write(html);
          pWindow.document.close();
          setTimeout(() => { pWindow.print(); }, 500);
       } else {
          showToast('No active possessed asset found for this loan', 'danger');
       }
    }

    setPipeAction(null);
    setSelLoan(null);
    setPipeStage(null);
  };

  const quickPrint = (loan, type) => {
    const cust = customers.find(c => c.name === loan.customer);
    const html = generateCollectionLetterHTML(type, loan, cust || { name: loan.customer }, worker?.name, loan.balance);
    const pWindow = window.open('', '_blank');
    pWindow.document.write(html);
    pWindow.document.close();
    setTimeout(() => { pWindow.print(); }, 500);
    showToast(`${type} printed for ${loan.customer}`, 'ok');
  };

  return (
    <div className="fu" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* ── KPI Grid ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginBottom: 32 }}>
        <Card style={{ background: `linear-gradient(135deg, #EA580C20 0%, transparent 100%)`, borderLeft: `4px solid #EA580C` }}>
          <div style={{ padding: 20 }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                   <div style={{ fontSize: 12, color: T.muted, fontWeight: 700, textTransform: 'uppercase' }}>Recovery Portfolio</div>
                   <div style={{ fontSize: 28, fontWeight: 900, color: T.txt, marginTop: 4 }}>{fmtM(stats.totalVal)}</div>
                </div>
                <div style={{ background: '#EA580C20', padding: 10, borderRadius: 12 }}>
                   <ShieldAlert color="#EA580C" size={24} />
                </div>
             </div>
             <div style={{ marginTop: 16, fontSize: 11, color: T.muted }}>{stats.count} high-risk accounts active</div>
          </div>
        </Card>

        <Card style={{ background: `linear-gradient(135deg, #FB923C20 0%, transparent 100%)`, borderLeft: `4px solid #FB923C` }}>
          <div style={{ padding: 20 }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                   <div style={{ fontSize: 12, color: T.muted, fontWeight: 700, textTransform: 'uppercase' }}>In Litigation</div>
                   <div style={{ fontSize: 28, fontWeight: 900, color: T.txt, marginTop: 4 }}>{stats.legalCount}</div>
                </div>
                <div style={{ background: '#FB923C20', padding: 10, borderRadius: 12 }}>
                   <Gavel color="#FB923C" size={24} />
                </div>
             </div>
             <div style={{ marginTop: 16, fontSize: 11, color: T.muted }}>Legal attachment phase active</div>
          </div>
        </Card>

        <Card style={{ background: `linear-gradient(135deg, ${T.ok}20 0%, transparent 100%)`, borderLeft: `4px solid ${T.ok}` }}>
          <div style={{ padding: 20 }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                   <div style={{ fontSize: 12, color: T.muted, fontWeight: 700, textTransform: 'uppercase' }}>Assets Possessed</div>
                   <div style={{ fontSize: 28, fontWeight: 900, color: T.txt, marginTop: 4 }}>{stats.possessedCount}</div>
                </div>
                <div style={{ background: `${T.ok}20`, padding: 10, borderRadius: 12 }}>
                   <Hammer color={T.ok} size={24} />
                </div>
             </div>
             <div style={{ marginTop: 16, fontSize: 11, color: T.muted }}>Value: {fmtM(repossessedAssets.filter(a => a.status === 'Possessed').reduce((s,a) => s + a.valuation, 0))}</div>
          </div>
        </Card>
      </div>

      {/* ── Recovery Pipeline ───────────────────────────────────────────────── */}
      <Card style={{ marginBottom: 24, background: T.surface }}>
        <CH title="Recovery Pipeline" sub="Advanced enforcement and asset attachment stages" />
        <div style={{ padding: 16 }}>
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
              {RECOVERY_STAGES.map(stage => (
                <div 
                   key={stage.id} 
                   onClick={() => { setPipeStage(pipeStage?.id === stage.id ? null : stage); setSelLoan(null); }}
                   style={{
                     padding: '20px 12px', textAlign: 'center', cursor: 'pointer', borderRadius: 16, border: `1px solid ${pipeStage?.id === stage.id ? stage.color : T.border}`,
                     background: pipeStage?.id === stage.id ? `${stage.color}15` : T.card2, position: 'relative', transition: 'all 0.3s'
                   }}
                >
                   <div style={{ width: 44, height: 44, borderRadius: 12, background: stage.color, color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                     {React.cloneElement(stage.icon, { size: 22 })}
                   </div>
                   <div style={{ fontSize: 11, fontWeight: 800, color: T.muted, textTransform: 'uppercase' }}>{stage.label}</div>
                   {pipeStage?.id === stage.id && <div style={{ position: 'absolute', bottom: 0, left: 10, right: 10, height: 3, background: stage.color, borderRadius: '3px 3px 0 0' }} />}
                </div>
              ))}
           </div>

           {pipeStage && (
             <div className="fade-in" style={{ background: `${pipeStage.color}08`, border: `1px solid ${pipeStage.color}25`, borderRadius: 18, padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                   <div>
                      <div style={{ color: pipeStage.color, fontWeight: 900, fontSize: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                         {React.cloneElement(pipeStage.icon, { size: 20 })} {pipeStage.label}
                      </div>
                      <div style={{ color: T.dim, fontSize: 13, marginTop: 4 }}>{pipeStage.desc}</div>
                   </div>
                   <Badge color={pipeStage.color}>Operation Active</Badge>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 16, alignItems: 'end' }}>
                   <FI 
                     label="Select Target Asset/Loan" 
                     type="select" 
                     options={recoveryLoans.map(l => ({ label: `${l.id} · ${l.customer} · ${fmt(l.balance)}`, value: l.id }))}
                     value={selLoan?.id || ''}
                     onChange={v => setSelLoan(recoveryLoans.find(l => l.id === v) || null)}
                   />
                   <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                      {selLoan && (
                        <>
                          <Btn v="secondary" onClick={() => onOpenCustomerProfile?.(selLoan.customerId || selLoan.customer_id)}>
                            Investigate Profile
                          </Btn>
                          <div style={{ display: 'flex', gap: 12 }}>
                             {pipeStage.actions.map(action => (
                               <Btn key={action} v="secondary" onClick={() => setPipeAction({ stage: pipeStage, action, loan: selLoan })}>
                                  {action}
                               </Btn>
                             ))}
                          </div>
                        </>
                      )}
                   </div>
                </div>
             </div>
           )}
        </div>
      </Card>

      {/* ── Repossessed Assets Inventory ────────────────────────────────────── */}
      <Card style={{ marginBottom: 24 }}>
        <CH title="Repossessed Assets Inventory" sub="Physical collateral currently under Adequate Capital's legal control" />
        <DT 
          cols={[
            { k: 'assetName', l: 'Asset Description', r: (v, row) => <div style={{ fontWeight: 700 }}>{v} <span style={{ fontSize: 10, color: T.muted, fontWeight: 400 }}>• {row.loanId}</span></div> },
            { k: 'customer', l: 'Owner/Customer' },
            { k: 'possessionDate', l: 'Date Seized', r: v => <span style={{ color: T.muted }}>{v}</span> },
            { k: 'valuation', l: 'Valuation', r: v => <span style={{ fontWeight: 800 }}>{fmt(v)}</span> },
            { k: 'status', l: 'Status', r: v => <Badge color={v === 'Disposed' ? T.muted : T.warn}>{v}</Badge> },
            { k: 'officer', l: 'Officer' },
            { 
              l: 'Actions', 
              r: (_, row) => (
                <div style={{ display: 'flex', gap: 6 }}>
                  <Btn size="xs" v="secondary" title="View Docs" onClick={() => {}}><FileText size={14}/></Btn>
                  {row.status === 'Possessed' && <Btn size="xs" v="secondary" title="Mark Disposed" onClick={() => setPipeAction({ stage: RECOVERY_STAGES[3], action: 'Approve Disposal', loan: { ...recoveryLoans.find(l=>l.id===row.loanId), customer: row.customer, balance: row.valuation } })}><Hammer size={14}/></Btn>}
                </div>
              )
            }
          ]}
          rows={repossessedAssets}
        />
      </Card>

      {/* ── Active Arrears Registry ────────────────────────────────────────── */}
      <Card>
        <CH title="High-Risk Enforcement Registry" sub="Outstanding arrears exceeding 30 days or in litigation" />
        <DT 
          cols={[
            { k: 'id', l: 'Loan ID', r: v => <span style={{ color: '#EA580C', fontFamily: T.mono, fontWeight: 800 }}>{v}</span> },
            { k: 'customer', l: 'Customer', r: (v, row) => <span onClick={() => onOpenCustomerProfile?.(row.customerId)} style={{ fontWeight: 700, color: T.accent, cursor: 'pointer', borderBottom: `1px dashed ${T.accent}40` }}>{v}</span> },
            { k: 'balance', l: 'Balance', r: v => <span style={{ color: T.danger, fontWeight: 800 }}>{fmt(v)}</span> },
            { k: 'daysOverdue', l: 'Aging', r: v => <Badge v={v > 90 ? 'danger' : 'warn'}>{v} Days</Badge> },
            { k: 'status', l: 'Status', r: v => <Badge color={SC[v]}>{v}</Badge> },
            { k: 'officer', l: 'Officer' },
            { 
              l: 'Actions', 
              r: (_, row) => (
                <div style={{ display: 'flex', gap: 6 }}>
                  <Btn size="xs" v="secondary" title="Print Demand" onClick={() => quickPrint(row, 'Demand Letter')}><FileText size={14}/></Btn>
                  <Btn size="xs" v="secondary" title="Print Final Warning" onClick={() => quickPrint(row, 'Final Notice')}><ShieldAlert size={14}/></Btn>
                  <Btn size="xs" v="secondary" title="Mark for Blacklist" onClick={() => setPipeAction({ stage: RECOVERY_STAGES[1], action: 'Blacklist', loan: row })}><XCircle size={14}/></Btn>
                </div>
              )
            }
          ]}
          rows={recoveryLoans.sort((a,b) => b.daysOverdue - a.daysOverdue)}
        />
      </Card>

      {/* ── Confirmation Dialog ────────────────────────────────────────────── */}
      {pipeAction && (
        <Dialog title="Confirm Enforcement Action" onClose={() => setPipeAction(null)}>
           <Alert type="warn">
              You are about to log: <b>{pipeAction.action}</b> for <b>{pipeAction.loan.customer}</b>. 
              This will be permanently recorded in the recovery audit trail.
           </Alert>
           <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <Btn full onClick={() => doAction(pipeAction.stage, pipeAction.action)}>
                 <Check size={18} /> Confirm Action
              </Btn>
              <Btn v="secondary" onClick={() => setPipeAction(null)}>Cancel</Btn>
           </div>
        </Dialog>
      )}
    </div>
  );
}
