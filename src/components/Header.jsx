// components/Header.jsx
// Topbar used in the dashboard layout.

import { useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';

const T = {
  bg:     '#0D1117',
  border: '#1E2D45',
  txt:    '#E2E8F0',
  muted:  '#64748B',
  accent: '#00D4AA',
};

export default function Header({ onMenuToggle, title = '', onSearch }) {
  const { worker, DEMO_MODE } = useAuth();
  const [q, setQ] = useState('');
  const debounced  = useDebounce(q, 200);

  // Propagate debounced search up
  useCallback(() => { onSearch?.(debounced); }, [debounced, onSearch]);

  return (
    <header
      style={{
        height: 56, display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 16px', background: T.bg,
        borderBottom: `1px solid ${T.border}`,
        flexShrink: 0, position: 'sticky', top: 0, zIndex: 100,
      }}
    >
      {/* Hamburger */}
      <button
        onClick={onMenuToggle}
        aria-label="Toggle navigation"
        style={{
          background: 'none', border: `1px solid ${T.border}`,
          color: T.muted, cursor: 'pointer', fontSize: 16,
          padding: '5px 9px', borderRadius: 8, lineHeight: 1, flexShrink: 0,
        }}
      >
        ☰
      </button>

      {/* Title */}
      {title && (
        <span style={{ color: T.txt, fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
          {title}
        </span>
      )}

      {/* Search */}
      {onSearch && (
        <div style={{ flex: 1, maxWidth: 320, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.muted, pointerEvents: 'none', fontSize: 13 }}>⌕</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            style={{
              width: '100%', background: '#111827', border: `1px solid ${T.border}`,
              borderRadius: 9, padding: '7px 12px 7px 28px',
              color: T.txt, fontSize: 13, outline: 'none',
            }}
          />
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Demo badge */}
      {DEMO_MODE && (
        <span style={{
          background: '#F59E0B14', color: '#F59E0B', border: '1px solid #F59E0B30',
          borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700,
        }}>
          DEMO
        </span>
      )}

      {/* User chip */}
      <div style={{
        background: '#1E2D45', border: `1px solid ${T.border}`,
        borderRadius: 99, padding: '4px 10px',
        color: T.txt, fontSize: 12, fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: 99,
          background: T.accent, color: '#060A10',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 900,
        }}>
          {(worker?.name ?? worker?.avatar ?? 'A').slice(0, 1).toUpperCase()}
        </div>
        <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {worker?.name ?? 'Admin'}
        </span>
      </div>
    </header>
  );
}
