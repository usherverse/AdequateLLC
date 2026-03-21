// components/Modal.jsx
// Generic portal-based modal wrapper.
// The Dialog component in lms-core.jsx implements the full modal system
// (focus trap, Escape key, aria-modal, position:fixed, body scroll lock).
// This file re-exports a lightweight version for use outside lms-core.

import { useEffect, useRef } from 'react';

const ZINDEX = 9900;

export default function Modal({ title, children, onClose, width = 520 }) {
  const ref = useRef(null);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Escape key
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: ZINDEX,
        background: 'rgba(4,8,16,0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '16px 8px', overflow: 'hidden',
      }}
    >
      <div
        ref={ref}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#111827',
          border: '1px solid #1E2D45',
          borderRadius: 16,
          width: '100%',
          maxWidth: width,
          maxHeight: 'calc(100vh - 32px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', borderBottom: '1px solid #1E2D45', flexShrink: 0,
        }}>
          <h2 style={{ color: '#E2E8F0', fontSize: 15, fontWeight: 800, margin: 0,
            fontFamily: '-apple-system,BlinkMacSystemFont,Inter,sans-serif' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: '#1E2D45', border: '1px solid #2D3F55',
              color: '#64748B', borderRadius: 99, width: 28, height: 28,
              cursor: 'pointer', fontSize: 13, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>
        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px 24px',
          WebkitOverflowScrolling: 'touch' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
