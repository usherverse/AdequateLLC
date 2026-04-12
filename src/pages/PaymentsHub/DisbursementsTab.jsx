import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, X, AlertOctagon, FileText, ClipboardSignature, PackageOpen, Rocket, CheckCircle, Zap, ExternalLink, ShieldAlert, BadgeCheck, Plus } from 'lucide-react';
import { 
  T, Badge, Btn, fmt, Alert, FI, Dialog, WaitingOverlay, DT,
  hasRegFee, generateLoanAgreementHTML, generateAssetListHTML, downloadLoanDoc,
  sbWrite, toSupabaseLoan, now
} from '@/lms-common';
import { useDisbursements } from './hooks/useDisbursements';

const DisbursementsTab = ({ loans = [], customers = [], payments = [], setLoans, addAudit, showToast, onManualLog }) => {
  const [, setSearchParams] = useSearchParams();
  const [sel, setSel] = useState(null);
  const [disbF, setDisbF] = useState({ mpesa: '', phone: '', date: now() });
  const { disburse, loading: disburseLoading, waitingForCallback, status: disbStatus, isSuccess, failureReason, reset } = useDisbursements();

  const approvedLoans = loans.filter(l => l.status === 'Approved');

  const doManualDisburse = () => {
    if (!disbF.mpesa || !disbF.phone) return;
    const disbUpd = { ...sel, status: 'Active', disbursed: disbF.date, mpesa: disbF.mpesa, phone: disbF.phone };
    
    sbWrite('loans', toSupabaseLoan(disbUpd))
      .then(() => {
        if (setLoans) setLoans(ls => ls.map(l => l.id === sel.id ? disbUpd : l));
        addAudit('Loan Disbursed (Manual)', sel.id, `${fmt(sel.amount)} via ${disbF.mpesa}`);
        showToast(`✅ Loan ${sel.id} disbursed — ${fmt(sel.amount)}`, 'ok');
        setSel(null);
        setDisbF({ mpesa: '', phone: '', date: now() });
      })
      .catch(err => showToast('❌ Error: ' + err.message, 'danger'));
  };

  const doMpesaDisburse = async () => {
    if (!sel) return;
    try {
      await disburse(sel.id, disbF.phone);
      addAudit('M-Pesa Disbursement Initiated', sel.id, `${fmt(sel.amount)} via Daraja`);
      showToast('🚀 Disbursement initiated via M-Pesa.', 'info');
      setSel(null);
    } catch (err) {
      showToast('❌ M-Pesa Error: ' + err.message, 'danger');
    }
  };

  return (
    <div className="fu" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: T.txt, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={20} color={T.accent} /> Disbursement Queue
          </h2>
          <p style={{ color: T.muted, fontSize: 13, marginTop: 4 }}>Review applications and authorize fund releases.</p>
        </div>
        <div style={{ background: T.aLo, padding: '8px 16px', borderRadius: 99, border: `1px solid ${T.accent}40`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.accent, animation: 'pulse 2s infinite' }} />
            <span style={{ color: T.accent, fontWeight: 800, fontSize: 13 }}>{approvedLoans.length} Pending Approval</span>
        </div>
      </div>

      <DT 
        cols={[
            { k: 'customer', l: 'Customer Entity', r: (v, row) => (
                <div>
                    <div style={{ fontWeight: 800, color: T.txt }}>{v}</div>
                    <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono }}>ID: {row.id}</div>
                </div>
            )},
            { k: 'amount', l: 'Principal', r: (v) => <span style={{ fontWeight: 900, color: T.accent, fontSize: 15 }}>{fmt(v)}</span> },
            { k: 'registration', l: 'M-Pesa Registry', r: (v, row) => {
                const cust = customers.find(c => c.id === row.customerId);
                const feePaid = hasRegFee(cust, payments);
                return (
                    <Badge color={feePaid ? T.ok : T.danger}>
                        {feePaid 
                          ? <><BadgeCheck size={12} /> Registered</>
                          : <><ShieldAlert size={12} /> Unregistered</>
                        }
                    </Badge>
                );
            }},
            { k: 'action', l: 'Access Management', r: (v, row) => (
                <Btn onClick={() => { setSel(row); setDisbF(f=>({...f, phone: row.phone || customers.find(c => c.id === row.customerId)?.phone || ''})) }} v="primary" sm icon={Rocket}>
                    Authorize
                </Btn>
            )}
        ]}
        rows={approvedLoans}
        emptyMsg="The disbursement queue is currently clear. Approved loans will appear here."
      />

      {sel && (() => {
        const cust = customers.find(c => c.id === sel.customerId);
        const feeOk = hasRegFee(cust, payments);
        return (
          <Dialog title={`Authorize Disbursement · ${sel.id}`} onClose={() => setSel(null)} width={580}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: T.card2, padding: '16px 20px', borderRadius: 16, border: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>Target Entity</div>
                        <div style={{ color: T.txt, fontSize: 18, fontWeight: 900, marginTop: 2 }}>{sel.customer}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>Payout Volume</div>
                        <div style={{ color: T.accent, fontSize: 18, fontWeight: 900, marginTop: 2 }}>{fmt(sel.amount)}</div>
                    </div>
              </div>

              {!feeOk && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Alert type='danger'>
                    <div style={{display: 'flex', alignItems: 'flex-start', gap: 10, lineHeight: 1.4}}>
                      <ShieldAlert size={20} style={{marginTop: 2}} /> 
                      <div>
                        <b>Security Block: M-Pesa Registration Required.</b><br/>
                        This customer has not paid their mandatory registration fee. Disbursement engine is locked.
                      </div>
                    </div>
                  </Alert>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Btn v='gold' onClick={() => setSearchParams({ tab: 'registration-fee', customerId: sel.customerId })} full icon={ExternalLink}>Go to Registry</Btn>
                    <Btn v='secondary' onClick={() => onManualLog(cust)} full icon={Plus} style={{ border: `1px dashed ${T.border}` }}>Log Fee Manually</Btn>
                  </div>
                </div>
              )}

              <div style={{ background: T.surface, padding: 18, borderRadius: 16, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 11, fontWeight: 850, color: T.dim, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1.5 }}>Configuration</div>
                <FI label='M-Pesa Reference / TXN Code' value={disbF.mpesa} onChange={v => setDisbF(f => ({ ...f, mpesa: v }))} required placeholder='OAB1234567' />
                <div style={{ height: 12 }} />
                <FI label='Target Mobile Identity (MSISDN)' value={disbF.phone} onChange={v => setDisbF(f => ({ ...f, phone: v }))} required />
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 850, color: T.dim, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1.5 }}>Compliance Documents</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Btn v='secondary' sm onClick={() => downloadLoanDoc(generateLoanAgreementHTML(sel, cust || { name: sel.customer }, sel.officer), 'loan-agreement-' + sel.id + '.html')} icon={ClipboardSignature}>Agreement</Btn>
                  <Btn v='secondary' sm onClick={() => downloadLoanDoc(generateAssetListHTML(sel, cust || { name: sel.customer }, sel.officer), 'asset-list-' + sel.id + '.html')} icon={PackageOpen}>Assets</Btn>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 16, borderTop: `1px solid ${T.border}`, marginTop: 8 }}>
                <Btn onClick={doMpesaDisburse} v='primary' full disabled={!feeOk || disburseLoading} icon={Rocket}>
                  {disburseLoading ? 'Sending API Request...' : 'Trigger M-Pesa B2C Payout'}
                </Btn>
                <div style={{ display: 'flex', gap: 12 }}>
                  <Btn onClick={doManualDisburse} v='ok' full disabled={!feeOk || !disbF.mpesa || !disbF.phone} icon={CheckCircle}>Confirm Manual Payout</Btn>
                  <Btn onClick={() => setSel(null)} v='secondary' style={{ minWidth: 100 }}>Close</Btn>
                </div>
              </div>
            </div>
          </Dialog>
        );
      })()}

      {waitingForCallback && (
        <WaitingOverlay title="Funds Dispatch" message={`Releasing capital to ${sel?.customer}`} sub="Connecting to M-Pesa Secure Gateway..." onClose={reset} />
      )}
      {isSuccess && (
        <WaitingOverlay type="success" title="Capital Dispatched" message={`The funds for ${sel?.customer} have been released successfully.`} onClose={reset} />
      )}
      {disbStatus === 'Failed' && failureReason && (
        <WaitingOverlay type="danger" title="Disbursement Failed" message={failureReason} onClose={reset} />
      )}
      <style>{`
          @keyframes pulse {
              0% { opacity: 0.6; transform: scale(1); }
              50% { opacity: 1; transform: scale(1.1); }
              100% { opacity: 0.6; transform: scale(1); }
          }
      `}</style>
    </div>
  );
};

export default DisbursementsTab;
