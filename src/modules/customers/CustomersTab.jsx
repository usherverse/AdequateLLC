import CustomerProfile from "@/modules/customers/CustomerProfile";
import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import {
  T, SC, RC, SFX, Card, CH, KPI, DT, Btn, Badge, Av, Bar, BackBtn, RefreshBtn,
  FI, PhoneInput, NumericInput, Search, Pills, Alert, Dialog, ConfirmDialog, ToastContainer,
  LoanModal, LoanForm, RepayTracker, CustomerDetail,
  fmt, fmtM, now, uid, ts, escHtml, toCSV, dlCSV, buildFullBackup,
  calculateLoanStatus, toSupabaseCustomer,
  sbWrite, sbInsert,
  toSupabaseLoan, toSupabasePayment, toSupabaseInteraction,
  generateLoanAgreementHTML, generateAssetListHTML, downloadLoanDoc,
  useContactPopup, useToast, useReminders, useModalLock
} from '@/lms-common';


const CustomersTab = ({ customers, setCustomers, workers, loans, setLoans, payments, setPayments, interactions, setInteractions, addAudit, showToast = () => { }, onOpenCustomerProfile }) => {
  const { open: openContact, Popup: ContactPopup } = useContactPopup();
  const [q, setQ] = useState('');
  const [statusFlt, setStatusFlt] = useState('All');
  const [sel, setSel] = useState(null);
  const [selLoan, setSelLoan] = useState(null);

  // Build a set of customerIds who have an Active or Overdue loan right now
  const activeBorrowerIds = useMemo(() =>
    new Set(loans.filter(l => l.status === 'Active' || l.status === 'Overdue').map(l => l.customerId).filter(Boolean))
    , [loans]);

  const custStats = useMemo(() => ({
    total: customers.length,
    blacklisted: customers.filter(c => c.blacklisted).length,
    activeBorrowers: customers.filter(c => activeBorrowerIds.has(c.id)).length,
    noLoans: customers.filter(c => !c.blacklisted && c.loans === 0).length,
  }), [customers, activeBorrowerIds]);

  const STATUS_OPTS = ['All', 'Active Borrowers', 'Blacklisted', 'No Loans'];

  const filtered = useMemo(() => {
    const lq = q.trim().toLowerCase();
    return customers.filter(c => {
      // Status filter
      if (statusFlt === 'Active Borrowers' && !activeBorrowerIds.has(c.id)) return false;
      if (statusFlt === 'Blacklisted' && !c.blacklisted) return false;
      if (statusFlt === 'No Loans' && (c.blacklisted || c.loans > 0)) return false;
      // Search
      if (!lq) return true;
      return (
        c.id.toLowerCase().includes(lq) ||
        (c.name || '').toLowerCase().includes(lq) ||
        (c.phone || '').includes(lq) ||
        (c.altPhone || '').includes(lq) ||
        (c.idNo || '').includes(lq) ||
        (c.business || '').toLowerCase().includes(lq) ||
        (c.location || '').toLowerCase().includes(lq) ||
        (c.officer || '').toLowerCase().includes(lq) ||
        (c.risk || '').toLowerCase().includes(lq) ||
        (c.residence || '').toLowerCase().includes(lq)
      );
    });
  }, [customers, q, statusFlt, activeBorrowerIds]);

  const blacklist = c => {
    const upd = { ...c, blacklisted: true, blReason: 'Admin action' };
    setCustomers(cs => cs.map(x => x.id === c.id ? upd : x));
    sbWrite('customers', toSupabaseCustomer(upd));
    addAudit('Customer Blacklisted', c.id, c.name);
    showToast(`⚠ ${c.name} has been blacklisted`, 'warn');
    setSel(null);
  };
  const [blConfirm, setBlConfirm] = useState(null);
  return (
    <div className='fu'>
      {ContactPopup}
      <div className='mob-stack' style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10 }}>
        <div>
          <div style={{ fontFamily: T.head, color: T.txt, fontSize: 20, fontWeight: 800 }}>👤 Customers</div>
          <div style={{ color: T.muted, fontSize: 13, marginTop: 3 }}>
            {custStats.total} registered ·{' '}
            <span style={{ color: T.ok }}>{custStats.activeBorrowers} active borrowers</span> ·{' '}
            <span style={{ color: T.danger }}>{custStats.blacklisted} blacklisted</span>
          </div>
        </div>
        <RefreshBtn onRefresh={() => { setQ(''); setStatusFlt('All'); setSel(null); }} />
      </div>
      <div className='mob-stack' style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Search value={q} onChange={setQ} placeholder='Search name, phone or ID…' />
        <Pills opts={STATUS_OPTS} val={statusFlt} onChange={setStatusFlt} />
      </div>
      <div style={{ marginTop: 4 }}>
        <Card>
          <DT
            cols={[
              { k: 'id', l: 'ID', r: v => <span style={{ color: T.accent, fontFamily: T.mono, fontWeight: 700, fontSize: 12 }}>{v}</span> },
              { k: 'name', l: 'Name', r: (v, r) => <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span onClick={e => { e.stopPropagation(); onOpenCustomerProfile?.(r.id); }} style={{ color: T.accent, cursor: 'pointer', fontWeight: 600, borderBottom: `1px dashed ${T.accent}50` }}>{v}</span>{r.phone && <span onClick={e => { e.stopPropagation(); openContact(v, r.phone, e); }} title='Quick contact' style={{ cursor: 'pointer', fontSize: 12, opacity: .55, lineHeight: 1 }}>📞</span>}</span> },
              { k: 'phone', l: 'Phone' },
              { k: 'business', l: 'Business' },
              { k: 'location', l: 'Location' },
              { k: 'officer', l: 'Officer' },
              { k: 'loans', l: 'Loans' },
              { k: 'risk', l: 'Risk', r: v => <Badge color={RC[v]}>{v}</Badge> },
              {
                k: 'id', l: 'Status', r: (v, row) => {
                  if (row.blacklisted) return <Badge color={T.danger}>Blacklisted</Badge>;
                  if (activeBorrowerIds.has(v)) return <Badge color={T.ok}>Active Borrower</Badge>;
                  if (row.loans > 0) return <Badge color={T.muted}>No Active Loan</Badge>;
                  return <Badge color={T.blue}>New Client</Badge>;
                }
              },
            ]}
            rows={filtered} onRow={setSel}
          />
        </Card>
      </div>
      {blConfirm && <ConfirmDialog title="Blacklist Customer" message={blConfirm.msg} confirmLabel="Yes, Blacklist" confirmVariant="danger" onConfirm={() => { blacklist(blConfirm.c); setBlConfirm(null); }} onCancel={() => setBlConfirm(null)} />}

      {selLoan && <LoanModal loan={selLoan} customers={customers} payments={payments} interactions={interactions || []} onClose={() => setSelLoan(null)} onViewCustomer={cust => { setSelLoan(null); setSel(cust); }} />}
    </div>
  );
};

export default CustomersTab;