import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Banknote, FileText, Inbox, Search, Landmark } from 'lucide-react';
import { T, ModuleHeader, Card } from '@/lms-common';
import DisbursementsTab from './DisbursementsTab';
import RegistrationFeeTab from './RegistrationFeeTab';
import PaybillReceiptsTab from './PaybillReceiptsTab';
import AuditTab from './AuditTab';

const PaymentsHub = ({ customers, loans, payments, setLoans, setPayments, addAudit, showToast }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'disbursements';

  const tabs = [
    { id: 'disbursements', label: 'Disbursements', icon: <Banknote size={16} /> },
    { id: 'registration-fee', label: 'Registration Fees', icon: <FileText size={16} /> },
    { id: 'paybill', label: 'Paybill Receipts', icon: <Inbox size={16} /> },
    { id: 'audit', label: 'Audit Ledger', icon: <Search size={16} /> },
  ];

  const handleTabChange = (id) => {
    setSearchParams({ tab: id });
  };

  const activeTab = tabs.find(t => t.id === currentTab) || tabs[0];

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      <ModuleHeader 
        title={<><Landmark size={24} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 8, marginTop: -4 }} /> Disbursement & Payments Hub</>} 
        sub="Unified M-Pesa management and immutable transaction ledger"
      />

      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: 4, 
        marginBottom: 20, 
        background: T.surface, 
        padding: '6px', 
        borderRadius: 14, 
        border: `1px solid ${T.border}`,
        width: 'fit-content'
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              borderRadius: 10,
              border: 'none',
              background: currentTab === tab.id ? T.aLo : 'transparent',
              color: currentTab === tab.id ? T.accent : T.muted,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 700,
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <span style={{ fontSize: 16 }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <Card style={{ padding: 0, overflow: 'hidden', border: `1px solid ${T.border}` }}>
        <div style={{ padding: 24 }}>
          {currentTab === 'disbursements' && <DisbursementsTab loans={loans} customers={customers} payments={payments} setLoans={setLoans} addAudit={addAudit} showToast={showToast} />}
          {currentTab === 'registration-fee' && <RegistrationFeeTab customers={customers} loans={loans} payments={payments} setPayments={setPayments} addAudit={addAudit} showToast={showToast} />}
          {currentTab === 'paybill' && <PaybillReceiptsTab />}
          {currentTab === 'audit' && <AuditTab />}
        </div>
      </Card>

      <style>{`
        .tab-btn:hover { color: ${T.accent} !important; background: ${T.aLo} !important; }
      `}</style>
    </div>
  );
};

export default PaymentsHub;
