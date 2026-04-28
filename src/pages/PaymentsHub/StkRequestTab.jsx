import React, { useState, useMemo, useEffect } from 'react';
import { Smartphone, Search, User, CreditCard, AlertCircle, CheckCircle, Rocket, X, ChevronRight, Landmark } from 'lucide-react';
import { T, Card, Btn, FI, Badge, Alert, WaitingOverlay, fmt } from '@/lms-common';
import { supabase } from '@/config/supabaseClient';

export const useStkPush = (customerId) => {
  const [loading, setLoading] = useState(false);
  const [waitingForCallback, setWaitingForCallback] = useState(false);
  const [requestId, setRequestId] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [failureReason, setFailureReason] = useState(null);
  const [error, setError] = useState(null);

  const initiateStk = async ({ phone, amount, description, loan_id }) => {
    setLoading(true);
    setError(null);
    setFailureReason(null);
    setIsSuccess(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/mpesa-stk-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          phone_number: phone, 
          amount, 
          customer_id: customerId,
          description,
          loan_id
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to initiate STK Push');
      
      setRequestId(data.checkout_id);
      setWaitingForCallback(true);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!waitingForCallback || !requestId) return;

    const pollInterval = setInterval(async () => {
      const { data, error } = await supabase
        .from('stk_requests')
        .select('status, result_desc')
        .eq('checkout_request_id', requestId)
        .maybeSingle();

      if (data) {
        const s = data.status?.toLowerCase();
        if (s === 'completed' || s === 'success') {
          setIsSuccess(true);
          setWaitingForCallback(false);
          setRequestId(null);
          clearInterval(pollInterval);
        } else if (s === 'failed' || s === 'cancelled' || s === 'rejected') {
          setFailureReason(data.result_desc || 'Transaction failed');
          setWaitingForCallback(false);
          setRequestId(null);
          clearInterval(pollInterval);
        }
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [waitingForCallback, requestId]);

  const reset = () => {
    setWaitingForCallback(false);
    setRequestId(null);
    setIsSuccess(false);
    setFailureReason(null);
    setError(null);
  };

  return { initiateStk, loading, waitingForCallback, isSuccess, failureReason, error, reset };
};

const StkRequestTab = ({ customers = [], loans = [], showToast }) => {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [type, setType] = useState('Loan Repayment');
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [targetLoan, setTargetLoan] = useState(null);

  const { initiateStk, loading, waitingForCallback, isSuccess, failureReason, error, reset } = useStkPush(sel?.id);

  const filteredCustomers = useMemo(() => {
    if (!q || q.length < 2) return [];
    const lq = q.toLowerCase();
    return customers.filter(c => 
      c.name?.toLowerCase().includes(lq) || 
      c.id?.toLowerCase().includes(lq) || 
      c.phone?.includes(lq) ||
      c.id_no?.includes(lq)
    ).slice(0, 10);
  }, [q, customers]);

  const customerLoans = useMemo(() => {
    if (!sel) return [];
    return loans.filter(l => l.customerId === sel.id && (l.status === 'Active' || l.status === 'Overdue'));
  }, [sel, loans]);

  useEffect(() => {
    if (sel) {
      setPhone(sel.phone || '');
      const active = customerLoans[0];
      if (active) setTargetLoan(active);
    }
  }, [sel, customerLoans]);

  const handleSend = async () => {
    if (!sel || !phone || !amount) {
      showToast('Please complete all fields', 'warn');
      return;
    }
    try {
      let desc = type;
      if (type === 'Loan Repayment' && targetLoan) {
        desc = `Loan Repayment (${targetLoan.id})`;
      }
      await initiateStk({ 
        phone, 
        amount: parseFloat(amount), 
        description: desc,
        loan_id: (type === 'Loan Repayment' && targetLoan) ? targetLoan.id : null
      });
      showToast('STK Push Request Sent', 'Waiting for customer PIN entry...', 'info');
    } catch (err) {
      showToast('Push Failed', err.message, 'danger');
    }
  };

  if (isSuccess) {
    return (
      <WaitingOverlay 
        type="success"
        title="Payment Received!"
        message="The customer has successfully completed the transaction. The payment has been recorded in the ledger."
        onClose={reset}
      />
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <CH title="Request Payment (STK Push)" sub="Prompt a customer to pay instantly via M-Pesa. Works for loans, penalties, or registration fees." />

      {!sel ? (
        <Card>
          <div style={{ position: 'relative', marginBottom: 20 }}>
            <FI 
              icon={Search} 
              placeholder="Search customer by name, National ID, or Phone..." 
              value={q} 
              onChange={setQ} 
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredCustomers.map(c => (
              <div 
                key={c.id} 
                onClick={() => setSel(c)}
                style={{ 
                  padding: '12px 16px', 
                  background: T.surface, 
                  borderRadius: 12, 
                  border: `1px solid ${T.border}`, 
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.background = T.aLo; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.surface; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 18, background: T.accent, color: '#000', display: 'flex', alignItems: 'center', justifyCenter: 'center', fontWeight: 900, fontSize: 12 }}>
                    <span style={{width:'100%', textAlign:'center'}}>{c.name?.[0]}</span>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: T.txt }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono }}>ID: {c.id_no || c.id} · {c.phone}</div>
                  </div>
                </div>
                <ChevronRight size={18} color={T.dim} />
              </div>
            ))}
            {q.length >= 2 && filteredCustomers.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: T.dim }}>No customers found matching "{q}"</div>
            )}
            {q.length < 2 && (
              <div style={{ textAlign: 'center', padding: 40, color: T.dim }}>
                <User size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
                <p>Search for a customer to begin.</p>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: 24, background: T.accent, color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18 }}>
                  {sel.name?.[0]}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{sel.name}</h3>
                  <div style={{ color: T.dim, fontSize: 12, fontFamily: T.mono }}>ID: {sel.id_no || sel.id}</div>
                </div>
              </div>
              <Btn variant="ghost" size="sm" onClick={() => { setSel(null); setQ(''); }} icon={X}>Change</Btn>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <FI 
                label="Target Phone Number" 
                icon={Smartphone} 
                value={phone} 
                onChange={setPhone} 
                placeholder="2547XXXXXXXX" 
              />
              <FI 
                label="Payment Type" 
                type="select" 
                value={type} 
                onChange={v => {
                  setType(v);
                  if (v === 'Registration Fee') setAmount('500');
                  else setAmount('');
                }}
                options={[
                  { l: '💳 Loan Repayment', v: 'Loan Repayment' },
                  { l: '🔑 Registration Fee', v: 'Registration Fee' },
                  { l: '⚠️ Penalty / Other', v: 'Penalty' }
                ]}
              />
            </div>

            {type === 'Loan Repayment' && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>Select Target Loan</label>
                {customerLoans.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {customerLoans.map(l => (
                      <div 
                        key={l.id}
                        onClick={() => setTargetLoan(l)}
                        style={{
                          padding: 12,
                          borderRadius: 12,
                          border: `1px solid ${targetLoan?.id === l.id ? T.accent : T.border}`,
                          background: targetLoan?.id === l.id ? T.aLo : T.surface,
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{l.id} <Badge color={l.status === 'Overdue' ? T.danger : T.ok}>{l.status}</Badge></div>
                          <div style={{ fontSize: 11, color: T.dim }}>Balance: <b>{fmt(l.balance)}</b> · Disbursed: {l.disbursed}</div>
                        </div>
                        {targetLoan?.id === l.id && <CheckCircle size={18} color={T.accent} />}
                      </div>
                    ))}
                  </div>
                ) : (
                  <Alert type="warn">This customer has no active or overdue loans.</Alert>
                )}
              </div>
            )}

            <FI 
              label="Amount to Request (KES)" 
              type="number" 
              icon={CreditCard} 
              value={amount} 
              onChange={setAmount} 
              placeholder="Enter amount" 
              disabled={type === 'Registration Fee'}
            />

            <div style={{ marginTop: 24 }}>
              <button
                onClick={handleSend}
                disabled={loading || waitingForCallback || !amount || !phone || (type === 'Loan Repayment' && !targetLoan)}
                style={{
                  width: '100%',
                  padding: '16px 24px',
                  borderRadius: 16,
                  border: 'none',
                  background: (loading || waitingForCallback || !amount || !phone) 
                    ? 'rgba(0,212,170,0.1)' 
                    : 'linear-gradient(135deg, #00D4AA 0%, #00a884 100%)',
                  color: (loading || waitingForCallback || !amount || !phone) ? T.dim : '#000',
                  fontSize: 16,
                  fontWeight: 900,
                  cursor: (loading || waitingForCallback || !amount || !phone) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  boxShadow: (loading || waitingForCallback || !amount || !phone) ? 'none' : '0 8px 32px rgba(0, 212, 170, 0.45)',
                  transition: 'all 0.2s ease'
                }}
              >
                {loading || waitingForCallback ? (
                  <><Rocket size={20} className="spin" /> Processing...</>
                ) : (
                  <><Smartphone size={20} /> Send STK Push Prompt</>
                )}
              </button>
              <p style={{ textAlign: 'center', fontSize: 11, color: T.dim, marginTop: 12 }}>
                The customer will receive a popup on their phone to enter their M-Pesa PIN.
              </p>
            </div>
          </Card>
        </div>
      )}

      {waitingForCallback && (
        <WaitingOverlay 
          title="Push Sent"
          message={`Request for ${fmt(amount)} sent to ${phone}`}
          sub="Waiting for customer to enter PIN..."
          onClose={reset}
        />
      )}

      {failureReason && (
        <WaitingOverlay 
          type="danger"
          title="Request Failed"
          message={failureReason}
          onClose={reset}
        />
      )}
    </div>
  );
};

const CH = ({ title, sub }) => (
  <div style={{ marginBottom: 24 }}>
    <h2 style={{ fontSize: 24, fontWeight: 900, color: T.txt, margin: 0 }}>{title}</h2>
    <p style={{ color: T.muted, fontSize: 14, marginTop: 4 }}>{sub}</p>
  </div>
);

export default StkRequestTab;
