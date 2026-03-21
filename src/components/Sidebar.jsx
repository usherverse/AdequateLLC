// components/Sidebar.jsx
// Standalone sidebar component for use in new route-based pages.
// The full sidebar is embedded in lms-core AdminPanel.

import { useAuth } from '@/context/AuthContext';

const NAV_ITEMS = [
  { id: 'dashboard',   label: 'Dashboard',   icon: '🏠' },
  { id: 'loans',       label: 'Loans',       icon: '💰' },
  { id: 'customers',   label: 'Customers',   icon: '👤' },
  { id: 'payments',    label: 'Payments',    icon: '💳' },
  { id: 'collections', label: 'Collections', icon: '📞' },
  { id: 'leads',       label: 'Leads',       icon: '🎯' },
  { id: 'workers',     label: 'Team',        icon: '👷' },
  { id: 'reports',     label: 'Reports',     icon: '📊' },
  { id: 'security',    label: 'Security',    icon: '🔐' },
  { id: 'database',    label: 'Database',    icon: '🗄️' },
];

const T = {
  bg:      '#080C14',
  surface: '#0D1117',
  border:  '#1E2D45',
  txt:     '#E2E8F0',
  muted:   '#64748B',
  accent:  '#00D4AA',
  aLo:     '#00D4AA12',
};

export default function Sidebar({ active, onNavigate, onClose }) {
  const { worker, role, signOut } = useAuth();

  const visible = NAV_ITEMS.filter((item) => {
    if (role === 'Viewer / Auditor') return ['dashboard', 'reports', 'security'].includes(item.id);
    if (role === 'Finance') return !['workers'].includes(item.id);
    return true;
  });

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      style={{
        width: 220, background: T.surface, borderRight: `1px solid ${T.border}`,
        display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <div style={{ padding: '20px 16px 14px', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ color: T.accent, fontWeight: 900, fontSize: 15, letterSpacing: -0.3 }}>
          Adequate Capital
        </div>
        <div style={{ color: T.muted, fontSize: 10, marginTop: 2 }}>Microfinance LMS</div>
      </div>

      {/* Nav items */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
        {visible.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { onNavigate?.(item.id); onClose?.(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '9px 10px', borderRadius: 9, border: 'none',
                background: isActive ? T.aLo : 'transparent',
                color: isActive ? T.accent : T.muted,
                cursor: 'pointer', fontSize: 13, fontWeight: isActive ? 700 : 500,
                marginBottom: 2, textAlign: 'left', transition: 'background 0.15s, color 0.15s',
              }}
            >
              <span style={{ fontSize: 15, flexShrink: 0, width: 22, textAlign: 'center' }}>
                {item.icon}
              </span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* User footer */}
      <div style={{ padding: '12px 14px', borderTop: `1px solid ${T.border}` }}>
        <div style={{ color: T.txt, fontSize: 12, fontWeight: 700, marginBottom: 2 }}>
          {worker?.name ?? 'Admin'}
        </div>
        <div style={{ color: T.muted, fontSize: 10, marginBottom: 8 }}>{role ?? ''}</div>
        <button
          onClick={signOut}
          style={{
            width: '100%', background: 'none', border: `1px solid ${T.border}`,
            color: T.muted, borderRadius: 7, padding: '6px', cursor: 'pointer',
            fontSize: 11, fontWeight: 600, transition: 'border-color 0.15s, color 0.15s',
          }}
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
