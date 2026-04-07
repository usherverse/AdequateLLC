import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/config/supabaseClient';
import { T, Badge, Btn, fmt, FI } from '@/lms-common';
import { useRegistrationFee } from './hooks/useRegistrationFee';

const RegistrationFeeTab = () => {
  const [searchParams] = useSearchParams();
  const customerIdParam = searchParams.get('customerId');
  
  const [customer, setCustomer] = useState(null);
  const [phone, setPhone] = useState('');
  const [loadingLocal, setLoadingLocal] = useState(false);
  const { status, loading, initiateStk } = useRegistrationFee(customerIdParam);

  useEffect(() => {
    if (customerIdParam) {
      supabase.from('customers').select('*').eq('id', customerIdParam).single().then(({ data }) => {
        if (data) {
          setCustomer(data);
          setPhone(data.phone);
        }
      });
    }
  }, [customerIdParam]);

  const handlePush = async () => {
    if (!phone) return;
    setLoadingLocal(true);
    try {
      await initiateStk(phone);
    } catch (err) {
      console.error(err);
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
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 0' }}>
      <div style={{ 
        background: T.card, 
        border: `1px solid ${T.border}`, 
        borderRadius: 20, 
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)', 
        overflow: 'hidden', 
        padding: 32 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 900, color: T.txt, margin: 0 }}>Registration Fee Verification</h2>
            <p style={{ color: T.muted, fontSize: 14, marginTop: 4 }}>Manage and verify mandatory onboarding payments</p>
          </div>
          <Badge color={statusColors[status] || T.muted}>{status?.toUpperCase()}</Badge>
        </div>

        {customer ? (
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
          <div style={{ 
            textAlign: 'center', 
            padding: '40px 20px', 
            background: T.surface, 
            borderRadius: 16, 
            border: `1px dashed ${T.border}`, 
            color: T.muted, 
            marginBottom: 32,
            fontSize: 14
          }}>
            Select a customer from the onboarding flow to manage their fee.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Btn
            onClick={handlePush}
            disabled={loading || loadingLocal || !customer || status === 'paid'}
            v="primary"
            full
            style={{ padding: '16px 24px', fontSize: 18, height: 'auto' }}
          >
            {loading || loadingLocal ? '🚀 Initiating Push...' : '📲 Trigger KES 500 STK Push'}
          </Btn>
          
          <p style={{ textAlign: 'center', fontSize: 12, color: T.muted, margin: 0 }}>
            Pushing will send an M-Pesa prompt to the phone above. Real-time status will update automatically.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegistrationFeeTab;
