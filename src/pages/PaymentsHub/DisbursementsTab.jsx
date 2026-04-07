import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, X, AlertOctagon, FileText, ClipboardSignature, PackageOpen, Rocket, CheckCircle } from 'lucide-react';
import { 
  T, Badge, Btn, fmt, Alert, FI, Dialog, 
  hasRegFee, generateLoanAgreementHTML, generateAssetListHTML, downloadLoanDoc,
  sbWrite, toSupabaseLoan, now
} from '@/lms-common';
import { useDisbursements } from './hooks/useDisbursements';

const DisbursementsTab = ({ loans = [], customers = [], payments = [], setLoans, addAudit, showToast }) => {
  const [, setSearchParams] = useSearchParams();
  const [sel, setSel] = useState(null);
  const [disbF, setDisbF] = useState({ mpesa: '', phone: '', date: now() });
  const { disburse, loading: disburseLoading } = useDisbursements();

  // Filter global loans for 'Approved' status
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
      await disburse(sel.id);
      addAudit('M-Pesa Disbursement Initiated', sel.id, `${fmt(sel.amount)} via Daraja`);
      showToast('🚀 Disbursement initiated via M-Pesa.', 'info');
      setSel(null);
    } catch (err) {
      showToast('❌ M-Pesa Error: ' + err.message, 'danger');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: T.txt, margin: 0 }}>Approved Loans Pending Disbursement</h2>
          <p style={{ color: T.muted, fontSize: 13, marginTop: 4 }}>Verify eligibility and release funds</p>
        </div>
        <div style={{ background: T.aLo, padding: '8px 16px', borderRadius: 10, border: `1px solid ${T.aMid}` }}>
          <span style={{ color: T.accent, fontWeight: 800, fontSize: 13 }}>{approvedLoans.length} Loans Waiting</span>
        </div>
      </div>

      <div style={{ overflowX: 'auto', border: `1px solid ${T.border}`, borderRadius: 12, background: T.card }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
              <th style={{ padding: '14px 20px', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Customer</th>
              <th style={{ padding: '14px 20px', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Amount</th>
              <th style={{ padding: '14px 20px', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Reg. Fee</th>
              <th style={{ padding: '14px 20px', color: T.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {approvedLoans.length === 0 ? (
              <tr><td colSpan="4" style={{ textAlign: 'center', padding: '60px 0', color: T.muted }}>No approved loans pending. Approve loans in the Loans tab to see them here.</td></tr>
            ) : (
              approvedLoans.map((loan) => {
                const cust = customers.find(c => c.id === loan.customerId);
                const feePaid = hasRegFee(cust, payments);
                return (
                  <tr key={loan.id} style={{ borderBottom: `1px solid ${T.border}`, transition: 'background 0.2s' }}>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 700, color: T.txt }}>{loan.customer}</div>
                      <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>{loan.id}</div>
                    </td>
                    <td style={{ padding: '16px 20px', fontWeight: 900, color: T.accent }}>{fmt(loan.amount)}</td>
                    <td style={{ padding: '16px 20px' }}>
                      <Badge color={feePaid ? T.ok : T.danger}>
                        {feePaid 
                          ? <span style={{display: 'inline-flex', alignItems: 'center', gap: 4}}><Check size={14} /> Paid</span>
                          : <span style={{display: 'inline-flex', alignItems: 'center', gap: 4}}><X size={14} /> Unpaid</span>
                        }
                      </Badge>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <Btn onClick={() => { setSel(loan); setDisbF(f=>({...f, phone: loan.phone || cust?.phone || ''})) }} v="primary" sm>Manage Disbursement</Btn>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {sel && (() => {
        const cust = customers.find(c => c.id === sel.customerId);
        const feeOk = hasRegFee(cust, payments);
        return (
          <Dialog title={`Disburse Loan · ${sel.id}`} onClose={() => setSel(null)} width={580}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Alert type='info'>
                Releasing <b>{fmt(sel.amount)}</b> to <b>{sel.customer}</b>
              </Alert>

              {!feeOk && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Alert type='danger'>
                    <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                      <AlertOctagon size={18} /> <b>Registration Fee (KES 500) missing.</b> Disbursement is blocked until the fee is recorded in the "Registration Fees" tab.
                    </div>
                  </Alert>
                  <Btn 
                    v='gold' 
                    onClick={() => setSearchParams({ tab: 'registration-fee', customerId: sel.customerId })}
                    full
                  >
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6}}>
                      <FileText size={16} /> Go to Registration Fees →
                    </div>
                  </Btn>
                </div>
              )}

              <div style={{ background: T.surface, padding: 16, borderRadius: 12, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 12, textTransform: 'uppercase' }}>Disbursement Details</div>
                <FI label='M-Pesa Transaction Code' value={disbF.mpesa} onChange={v => setDisbF(f => ({ ...f, mpesa: v }))} required placeholder='e.g. QAB123456' />
                <FI label='Target Phone Number' value={disbF.phone} onChange={v => setDisbF(f => ({ ...f, phone: v }))} required />
                <FI label='Disbursement Date' type='date' value={disbF.date} onChange={v => setDisbF(f => ({ ...f, date: v }))} />
              </div>

              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 10, textTransform: 'uppercase' }}>Documents</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn v='secondary' sm onClick={() => downloadLoanDoc(generateLoanAgreementHTML(sel, cust || { name: sel.customer }, sel.officer), 'loan-agreement-' + sel.id + '.html')}>
                    <span style={{display: 'flex', alignItems: 'center', gap: 4}}><ClipboardSignature size={14} /> Agreement</span>
                  </Btn>
                  <Btn v='secondary' sm onClick={() => downloadLoanDoc(generateAssetListHTML(sel, cust || { name: sel.customer }, sel.officer), 'asset-list-' + sel.id + '.html')}>
                    <span style={{display: 'flex', alignItems: 'center', gap: 4}}><PackageOpen size={14} /> Assets</span>
                  </Btn>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 16, borderTop: `1px solid ${T.border}`, marginTop: 8 }}>
                <Btn 
                  onClick={doMpesaDisburse} 
                  v='primary' 
                  full 
                  disabled={!feeOk || disburseLoading}
                >
                  {disburseLoading ? 'Wait...' : <span style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6}}><Rocket size={16} /> Disburse via M-Pesa B2C</span>}
                </Btn>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn 
                    onClick={doManualDisburse} 
                    v='ok' 
                    full 
                    disabled={!feeOk || !disbF.mpesa || !disbF.phone}
                  >
                    <span style={{display: 'flex', alignItems: 'center', gap: 6}}><CheckCircle size={16} /> Manual Confirmation</span>
                  </Btn>
                  <Btn onClick={() => setSel(null)} v='secondary' full>Close Engine</Btn>
                </div>
              </div>
            </div>
          </Dialog>
        );
      })()}
    </div>
  );
};

export default DisbursementsTab;
