import CustomerProfile from "@/modules/customers/CustomerProfile";
import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import {
  TrendingUp, Calendar, AlertTriangle, CreditCard, XCircle, ClipboardList, 
  Users, UserCog, Lock, BarChart, Download, FileSpreadsheet, FileText, 
  FileCode, Filter, ChevronRight, PieChart, Activity, ShieldCheck, 
  Phone, Briefcase, MapPin, UserPlus, Search as SearchIcon
} from 'lucide-react';
import {
  T, SC, RC, SFX, Card, CH, KPI, DT, Btn, Badge, Av, Bar, BackBtn, RefreshBtn,
  FI, PhoneInput, NumericInput, Search, Pills, Alert, Dialog, ConfirmDialog, ToastContainer,
  LoanModal, LoanForm, RepayTracker, CustomerDetail,
  fmt, fmtM, now, uid, ts, escHtml, toCSV, dlCSV, buildFullBackup,
  calculateLoanStatus, toSupabaseCustomer,
  sbWrite, sbInsert,
  toSupabaseLoan, toSupabasePayment, toSupabaseInteraction,
  generateLoanAgreementHTML, generateAssetListHTML, downloadLoanDoc,
  useContactPopup, useToast, useReminders, useModalLock,
  ModuleHeader
} from '@/lms-common';
import { useModuleFilter } from '@/hooks/useModuleFilter';


const CustomersTab = ({ customers, setCustomers, workers, loans, setLoans, payments, setPayments, interactions, setInteractions, addAudit, showToast = () => { }, onOpenCustomerProfile }) => {
  const { open: openContact, Popup: ContactPopup } = useContactPopup();
  const [sel, setSel] = useState(null);
  const [selLoan, setSelLoan] = useState(null);

  // Build a set of customerIds who have an Active, Overdue or Frozen loan right now
  const activeBorrowerIds = useMemo(() =>
    new Set(loans.filter(l => ['Active', 'Overdue', 'Frozen'].includes(l.status)).map(l => l.customerId).filter(Boolean))
    , [loans]);

  const STATUS_OPTS = ['All', 'Active Borrowers', 'Blacklisted', 'No Loans'];

  const {
    q, setQ, tab: statusFlt, setTab: setStatusFlt,
    startDate, setStartDate, endDate, setEndDate, applyFilter,
    filtered, handleExport
  } = useModuleFilter({
    data: customers,
    initialTab: 'All',
    dateKey: 'joined',
    searchFields: ['id', 'name', 'phone', 'altPhone', 'idNo', 'business', 'location', 'officer', 'risk', 'residence'],
    reportId: 'customers',
    showToast,
    addAudit,
    customFilter: (c, t) => {
      if (t === 'Active Borrowers' && !activeBorrowerIds.has(c.id)) return false;
      if (t === 'Blacklisted' && !c.blacklisted) return false;
      if (t === 'No Loans' && (c.blacklisted || c.loans > 0)) return false;
      return true;
    },
    initialStartDate: '2024-01-01'
  });

  const counts = useMemo(() => {
    const total = customers.length;
    const blacklisted = customers.filter(c => c.blacklisted).length;
    const activeBorrowers = customers.filter(c => activeBorrowerIds.has(c.id)).length;
    const inArrears = customers.filter(c => {
      const borrowerLoans = loans.filter(l => l.customerId === c.id);
      return borrowerLoans.some(l => {
        const paid = payments.filter(p => p.loanId === l.id && p.status === 'Allocated').reduce((s, p) => s + p.amount, 0);
        return ['Overdue', 'Frozen'].includes(calculateLoanStatus(l, null, paid).badgeStatus);
      });
    }).length;
    const newClients = customers.filter(c => !c.loans || c.loans === 0).length;
    return { total, blacklisted, activeBorrowers, inArrears, newClients };
  }, [customers, activeBorrowerIds, loans, payments]);

  const statsText = `${counts.total} registered · ${counts.activeBorrowers} active borrowers · ${counts.blacklisted} blacklisted`;

  const blacklist = c => {
    const upd = { ...c, blacklisted: true, blReason: 'Admin action' };
    setCustomers(cs => cs.map(x => x.id === c.id ? upd : x));
    sbWrite('customers', toSupabaseCustomer(upd));
    addAudit('Customer Blacklisted', c.id, c.name);
    showToast(`⚠ ${c.name} has been blacklisted`, 'warn');
    setSel(null);
  };
  const [blConfirm, setBlConfirm] = useState(null);

  const exportCols = [
    { k: 'id', l: 'ID' },
    { k: 'name', l: 'Name' },
    { k: 'phone', l: 'Phone' },
    { k: 'business', l: 'Business' },
    { k: 'location', l: 'Location' },
    { k: 'officer', l: 'Officer' },
    { k: 'loans', l: 'Loans' },
    { k: 'risk', l: 'Risk' },
    { k: 'joined', l: 'Joined' }
  ];

  return (
    <div className='fu'>
      {ContactPopup}
      
      <ModuleHeader
        title="CRM Hub"
        sub="Manage and track your customer base, financial health, and interactions."
        stats={statsText}
        refreshProps={{ onRefresh: () => { setQ(''); setStatusFlt('All'); setSel(null); } }}
        search={{ value: q, onChange: setQ, placeholder: 'Search name, phone or ID…' }}
        dateRange={{ start: startDate, end: endDate, onStartChange: setStartDate, onEndChange: setEndDate, onSearch: applyFilter }}
        exportProps={{ onExport: (fmt) => handleExport(fmt, 'Customer Report', exportCols) }}
        pillsProps={{ opts: STATUS_OPTS, val: statusFlt, onChange: setStatusFlt }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <KPI label="Total Customers" value={counts.total} icon={Users} color={T.accent} />
        <KPI label="Active Borrowers" value={counts.activeBorrowers} icon={Activity} color={T.ok} />
        <KPI label="In Arrears" value={counts.inArrears} icon={AlertTriangle} color={T.danger} sub={counts.inArrears > 0 ? "Requires Attention" : "All Good"} />
        <KPI label="Unfunded Leads" value={counts.newClients} icon={TrendingUp} color={T.blue} />
      </div>

      <div style={{ marginTop: 4 }}>
        <Card noPadding>
          <DT
            cols={[
              { 
                k: 'name', l: 'Customer', r: (v, r) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Av ini={v.split(' ').map(n => n[0]).join('').slice(0, 2)} size={38} color={r.blacklisted ? T.danger : T.accent} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                       <span onClick={e => { e.stopPropagation(); onOpenCustomerProfile?.(r.id); }} style={{ color: T.txt, cursor: 'pointer', fontWeight: 700, fontSize: 13.5 }}>{v}</span>
                       <span style={{ fontSize: 11, color: T.dim, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }} onClick={e => { e.stopPropagation(); openContact(v, r.phone, e); }}>
                        <Phone size={10} /> {r.phone}
                       </span>
                    </div>
                  </div>
                )
              },
              { 
                k: 'business', l: 'Engagement', r: (v, r) => (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.txt, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Briefcase size={12} style={{ color: T.accent }} /> {v || 'Personal'}
                    </div>
                    <div style={{ fontSize: 11, color: T.dim, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MapPin size={12} /> {r.location}
                    </div>
                  </div>
                )
              },
              { k: 'officer', l: 'Credit Officer', r: v => <span style={{ fontSize: 12.5, fontWeight: 600, color: T.dim }}>{v}</span> },
              { k: 'loans', l: 'Count', r: v => <span style={{ fontSize: 13, fontWeight: 800 }}>{v}</span> },
              { 
                k: 'risk', l: 'Risk Profile', r: v => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 4, background: RC[v] || T.muted }} />
                    <span style={{ fontWeight: 700, fontSize: 12, color: RC[v] || T.muted }}>{v}</span>
                  </div>
                ) 
              },
              {
                k: 'id', l: 'Status', r: (v, row) => {
                  if (row.blacklisted) return <Badge color={T.danger} variant="solid">Blacklisted</Badge>;
                  const borrowerLoans = loans.filter(l => l.customerId === v);
                  const hasArrears = borrowerLoans.some(l => {
                    const paid = payments.filter(p => p.loanId === l.id && p.status === 'Allocated').reduce((s, p) => s + p.amount, 0);
                    const e = calculateLoanStatus(l, null, paid);
                    return ['Overdue', 'Frozen'].includes(e.badgeStatus);
                  });
                  if (hasArrears) return <Badge color={T.danger} outline>Critical Arrears</Badge>;
                  if (activeBorrowerIds.has(v)) return <Badge color={T.ok} variant="subtle">Active Borrower</Badge>;
                  if (row.loans > 0) return <Badge color={T.muted}>No Debt</Badge>;
                  return <Badge color={T.blue}>New Client</Badge>;
                }
              },
              {
                k: 'id', l: '', r: (v, row) => (
                  <Btn icon={ChevronRight} onClick={() => onOpenCustomerProfile?.(v)} variant="ghost" size="sm" />
                )
              }
            ]}
            rows={filtered} onRow={r => onOpenCustomerProfile?.(r.id)}
          />
        </Card>
      </div>
      {blConfirm && <ConfirmDialog title="Blacklist Customer" message={blConfirm.msg} confirmLabel="Yes, Blacklist" confirmVariant="danger" onConfirm={() => { blacklist(blConfirm.c); setBlConfirm(null); }} onCancel={() => setBlConfirm(null)} />}

      {selLoan && <LoanModal loan={selLoan} customers={customers} payments={payments} interactions={interactions || []} onClose={() => setSelLoan(null)} onViewCustomer={cust => { setSelLoan(null); setSel(cust); }} />}
    </div>
  );
};

export default CustomersTab;