import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Rocket, Smartphone, Users, ChevronLeft, Search } from 'lucide-react';
import { supabase } from '@/config/supabaseClient';
import { T, Badge, Btn, fmt, FI, WaitingOverlay } from '@/lms-common';
import { useRegistrationFee } from './hooks/useRegistrationFee';

// A customer has paid if: mpesaRegistered flag OR any payment with is_reg_fee=true
const customerHasPaidRegFee = (c, payments = []) =>
  c.mpesaRegistered === true ||
  payments.some(p =>
    p.customerId === c.id &&
    (p.isRegFee === true ||
      (p.amount >= 1 && typeof p.note === 'string' &&
        (p.note.toLowerCase().includes('registration') || p.note.toLowerCase().includes('reg fee'))))
  );

const RegistrationFeeTab = ({ customers = [], payments = [], showToast, onManualLog }) => {

  const [searchParams, setSearchParams] = useSearchParams();
  const customerIdParam = searchParams.get('customerId');
  
  const [customer, setCustomer] = useState(null);
  const [phone, setPhone] = useState('');
  const [query, setQuery] = useState('');
  const [loadingLocal, setLoadingLocal] = useState(false);
  const { status, loading, waitingForCallback, isSuccess, failureReason, initiateStk, reset } = useRegistrationFee(customerIdParam);

  useEffect(() => {
    if (customerIdParam) {
      // First, attempt to locate securely from the pre-loaded global local state cache
      const localCust = customers?.find(c => c.id === customerIdParam);
      if (localCust) {
        setCustomer(localCust);
        setPhone(localCust.phone);
        return;
      }
      // If not populated in state (e.g. strict direct navigation link), query the server
      supabase.from('customers').select('*').eq('id', customerIdParam).single().then(({ data, error }) => {
        if (data) {
          setCustomer(data);
          setPhone(data.phone);
        } else {
          // Break endless hang if fetching utterly fails
          console.error('[RegistrationFeeTab] Could not load customer:', error);
          setCustomer({ id: customerIdParam, name: 'Unknown/Unsynced Customer', phone: '' });
        }
      });
    }
  }, [customerIdParam, customers]);

  const handlePush = async () => {
    if (!phone) return;
    setLoadingLocal(true);
    try {
      await initiateStk(phone);
      showToast('STK Push Sent!', 'Check your phone to complete payment.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Push Failed', err.message, 'error');
    } finally {
      setLoadingLocal(false);
    }
  };

  const statusColors = {
    pending: T.gold,
    paid: T.ok,
    waived: T.muted
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '20px clamp(0px, 2vw, 24px)', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ 
        background: T.card, 
        border: `1px solid ${T.border}`, 
        borderRadius: 24, 
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)', 
        overflow: 'hidden', 
        padding: 'clamp(20px, 4vw, 40px)' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
          <div>
            {customerIdParam && (
              <button 
                onClick={() => {
                  setCustomer(null);
                  setPhone('');
                  setSearchParams(prev => { prev.delete('customerId'); return prev; });
                }}
                style={{ background: 'none', border: 'none', color: T.accent, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0, marginBottom: 8, fontSize: 13, fontWeight: 600 }}
              >
                <ChevronLeft size={16} /> Back to List
              </button>
            )}
            <h2 style={{ fontSize: 24, fontWeight: 900, color: T.txt, margin: 0 }}>Registration Fee Verification</h2>
            <p style={{ color: T.muted, fontSize: 14, marginTop: 4 }}>Manage and verify mandatory onboarding payments</p>
          </div>
          {customerIdParam && <Badge color={statusColors[status] || T.muted}>{status?.toUpperCase()}</Badge>}
        </div>

        {customerIdParam ? (
          customer ? (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: 24, 
              background: T.surface, 
              padding: 24, 
              borderRadius: 16, 
              border: `1px solid ${T.border}`, 
              marginBottom: 32 
            }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 }}>Customer Name</label>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.txt }}>{customer.name}</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 }}>Customer ID</label>
                <div style={{ fontSize: 14, fontFamily: T.mono, color: T.dim }}>{customer.id}</div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>Phone Number (Safaricom)</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{
                    width: '100%',
                    background: T.card,
                    border: `1px solid ${T.border}`,
                    borderRadius: 10,
                    padding: '12px 16px',
                    color: T.txt,
                    fontSize: 16,
                    fontFamily: T.mono,
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = T.accent}
                  onBlur={(e) => e.target.style.borderColor = T.border}
                  placeholder="2547XXXXXXXX"
                />
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: T.muted, marginBottom: 32 }}>Loading customer details...</div>
          )
        ) : (
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <h3 style={{ color: T.txt, fontSize: 16, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={18} color={T.accent} /> Customers Pending Registration Fee
              </h3>
              <div style={{ position: 'relative', width: '100%', maxWidth: 260 }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.muted }} />
                <input 
                  type="text" 
                  placeholder="Search name, phone, ID..." 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  style={{ 
                    width: '100%', 
                    background: T.surface, 
                    border: `1px solid ${T.border}`, 
                    borderRadius: 10, 
                    padding: '8px 12px 8px 36px', 
                    color: T.txt, 
                    fontSize: 13,
                    outline: 'none'
                  }}
                />
              </div>
            </div>
            {(() => {
              const baseList = customers.filter(c => !customerHasPaidRegFee(c, payments));
              const filtered = baseList.filter(c => 
                c.name?.toLowerCase().includes(query.toLowerCase()) || 
                c.id?.toLowerCase().includes(query.toLowerCase()) ||
                c.phone?.includes(query)
              );

              if (baseList.length === 0) {
                return (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '40px 20px', 
                    background: T.surface, 
                    borderRadius: 16, 
                    border: `1px dashed ${T.border}`, 
                    color: T.muted, 
                    fontSize: 14
                  }}>
                    All onboarded customers have paid their registration fees.
                  </div>
                );
              }

              if (filtered.length === 0) {
                return (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '40px 20px', 
                    background: T.surface, 
                    borderRadius: 16, 
                    border: `1px dashed ${T.border}`, 
                    color: T.muted, 
                    fontSize: 14
                  }}>
                    No customers found matching "{query}"
                  </div>
                );
              }

              return (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                  gap: 16,
                  maxHeight: 400,
                  overflowY: 'auto',
                  paddingRight: 8
                }}>
                  {filtered.map((c, i) => (
                    <div 
                      key={`${c.id}-${i}`} 
                      onClick={() => setSearchParams(prev => { prev.set('customerId', c.id); return prev; })}
                      style={{ 
                        background: T.surface, 
                        border: `1px solid ${T.border}`, 
                        borderRadius: 12, 
                        padding: 16, 
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.background = T.aLo; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.surface; }}
                    >
                      <div style={{ fontWeight: 700, color: T.txt, fontSize: 16, display: 'flex', justifyContent: 'space-between' }}>
                        {c.name}
                        <Badge color={T.gold}>PENDING</Badge>
                      </div>
                      <div style={{ color: T.muted, fontSize: 12, fontFamily: T.mono }}>ID: {c.id}</div>
                      <div style={{ color: T.dim, fontSize: 12, fontFamily: T.mono }}>{c.phone}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {customerIdParam && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Primary: STK Push */}
            <button
              onClick={handlePush}
              disabled={loading || loadingLocal || !customer || status === 'paid'}
              style={{
                width: '100%',
                padding: '15px 24px',
                borderRadius: 14,
                border: 'none',
                background: loading || loadingLocal || !customer || status === 'paid'
                  ? 'rgba(0,212,170,0.2)'
                  : 'linear-gradient(135deg, #00D4AA 0%, #00a884 100%)',
                color: loading || loadingLocal || !customer || status === 'paid' ? 'rgba(0,0,0,0.35)' : '#000',
                fontSize: 15,
                fontWeight: 900,
                cursor: loading || loadingLocal || !customer || status === 'paid' ? 'not-allowed' : 'pointer',
                letterSpacing: '0.02em',
                boxShadow: loading || loadingLocal || status === 'paid' ? 'none' : '0 6px 24px rgba(0, 212, 170, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 212, 170, 0.6)'; }}
              onMouseLeave={e => { if (!e.currentTarget.disabled) e.currentTarget.style.boxShadow = '0 6px 24px rgba(0, 212, 170, 0.4)'; }}
            >
              {loading || loadingLocal
                ? <><Rocket size={16} /> Sending...</>
                : <><Smartphone size={16} /> Send STK Push</>
              }
            </button>

            {/* Secondary: Manual Log — clean ghost */}
            <button
              onClick={() => onManualLog(customer)}
              disabled={status === 'paid'}
              style={{
                width: '100%',
                padding: '11px 24px',
                borderRadius: 14,
                border: 'none',
                background: 'transparent',
                color: status === 'paid' ? T.dim : T.muted,
                fontSize: 14,
                fontWeight: 700,
                cursor: status === 'paid' ? 'not-allowed' : 'pointer',
                letterSpacing: '0.02em',
                transition: 'color 0.2s ease',
                textDecoration: 'underline',
              }}
              onMouseEnter={e => { if (status !== 'paid') e.currentTarget.style.color = T.txt; }}
              onMouseLeave={e => { e.currentTarget.style.color = status === 'paid' ? T.dim : T.muted; }}
            >
              Log Manually
            </button>

            <p style={{ textAlign: 'center', fontSize: 11, color: T.dim, margin: 0 }}>
              Real-time status updates upon PIN confirmation.
            </p>
          </div>
        )}
      </div>

      {waitingForCallback && (
        <WaitingOverlay 
          title="Processing" 
          message={`Sent to ${customer?.name || "phone"}`} 
          sub="Verifying PIN entry..."
          onClose={reset}
        />
      )}

      {isSuccess && (
        <WaitingOverlay 
          type="success"
          title="Payment Verified" 
          message={`Registration fee for ${customer?.name} has been successfully paid and recorded.`} 
          onClose={reset}
        />
      )}

      {status === 'failed' && failureReason && (
        <WaitingOverlay 
          type="danger"
          title="Failed" 
          message={failureReason} 
          onClose={reset}
        />
      )}
    </div>
  );
};

export default RegistrationFeeTab;
