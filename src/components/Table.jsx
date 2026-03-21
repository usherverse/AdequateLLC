// components/Table.jsx
// Standalone virtualized table with sorting, search, and pagination.
// Used independently from lms-core when building new pages.

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';

const ROW_H    = 44;
const PAGE_SZ  = 60;
const VIRT_THR = 120;

const T = {
  bg:      '#080C14',
  card:    '#0D1117',
  surface: '#111827',
  border:  '#1E2D45',
  txt:     '#E2E8F0',
  muted:   '#64748B',
  dim:     '#374151',
  accent:  '#00D4AA',
  mono:    "'JetBrains Mono','Fira Mono','Courier New',monospace",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function THead({ cols, sortKey, sortDir, onSort }) {
  return (
    <thead>
      <tr>
        {cols.map((c) => (
          <th
            key={c.key}
            onClick={() => c.sortable !== false && onSort?.(c.key)}
            style={{
              color: T.muted, fontWeight: 700, fontSize: 10,
              letterSpacing: 1, textTransform: 'uppercase',
              padding: '10px 13px', textAlign: 'left',
              borderBottom: `1px solid ${T.border}`,
              whiteSpace: 'nowrap', position: 'sticky', top: 0,
              background: T.card, zIndex: 2,
              cursor: c.sortable !== false ? 'pointer' : 'default',
              userSelect: 'none',
            }}
          >
            {c.label}
            {sortKey === c.key && (
              <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
            )}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function TRow({ cols, row, idx, onRow }) {
  return (
    <tr
      onClick={() => onRow?.(row)}
      style={{
        borderBottom: `1px solid ${T.border}18`,
        cursor: onRow ? 'pointer' : 'default',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => { if (onRow) e.currentTarget.style.background = '#00D4AA08'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
    >
      {cols.map((c, j) => (
        <td key={j} style={{ padding: '10px 13px', color: T.txt, verticalAlign: 'middle', fontSize: 13 }}>
          {c.render ? c.render(row[c.key], row) : (row[c.key] ?? '—')}
        </td>
      ))}
    </tr>
  );
}

function EmptyState({ message }) {
  return (
    <tr>
      <td colSpan={999}>
        <div style={{ padding: '32px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.35 }}>📋</div>
          <div style={{ color: T.muted, fontSize: 13, fontWeight: 500 }}>{message}</div>
          <div style={{ color: T.dim, fontSize: 11, marginTop: 4 }}>
            Try adjusting your search or filters
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Virtual scroll ────────────────────────────────────────────────────────────

function VirtualTable({ cols, rows, onRow, maxH }) {
  const [startIdx, setStartIdx] = useState(0);
  const wrapRef = useRef(null);
  const rafRef  = useRef(null);
  const visCount = Math.ceil(maxH / ROW_H) + 16;

  useEffect(() => {
    setStartIdx(0);
    const wrap = wrapRef.current;
    if (!wrap) return;
    wrap.scrollTop = 0;
    const onScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        if (wrapRef.current)
          setStartIdx(Math.max(0, Math.floor(wrapRef.current.scrollTop / ROW_H) - 8));
      });
    };
    wrap.addEventListener('scroll', onScroll, { passive: true });
    return () => { wrap.removeEventListener('scroll', onScroll); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [rows]);

  const start  = startIdx;
  const end    = Math.min(rows.length, start + visCount);
  const slice  = rows.slice(start, end);
  const topPad = start * ROW_H;
  const botPad = (rows.length - end) * ROW_H;

  return (
    <div>
      <div style={{ padding: '4px 13px 5px', color: T.muted, fontSize: 11, borderBottom: `1px solid ${T.border}18` }}>
        {rows.length.toLocaleString()} records
      </div>
      <div ref={wrapRef} style={{ overflowY: 'auto', overflowX: 'auto', height: maxH, WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse', fontSize: 13 }}>
          <THead cols={cols} />
          <tbody>
            {topPad > 0 && <tr style={{ height: topPad }}><td colSpan={cols.length} style={{ padding: 0 }} /></tr>}
            {slice.map((row, i) => <TRow key={row.id ?? start + i} cols={cols} row={row} idx={start + i} onRow={onRow} />)}
            {botPad > 0 && <tr style={{ height: botPad }}><td colSpan={cols.length} style={{ padding: 0 }} /></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Paginated table ───────────────────────────────────────────────────────────

function PagedTable({ cols, rows, onRow, emptyMsg, maxH }) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [rows]);
  const totalPages = Math.ceil(rows.length / PAGE_SZ);
  const slice = rows.slice(page * PAGE_SZ, (page + 1) * PAGE_SZ);
  const from  = page * PAGE_SZ + 1;
  const to    = Math.min((page + 1) * PAGE_SZ, rows.length);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ overflowY: 'auto', overflowX: 'auto', height: maxH, WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse', fontSize: 13 }}>
          <THead cols={cols} />
          <tbody>
            {slice.length === 0
              ? <EmptyState message={emptyMsg} />
              : slice.map((row, i) => <TRow key={row.id ?? page * PAGE_SZ + i} cols={cols} row={row} idx={page * PAGE_SZ + i} onRow={onRow} />)
            }
          </tbody>
        </table>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 13px', borderTop: `1px solid ${T.border}`,
        background: T.surface, flexWrap: 'wrap', gap: 6, flexShrink: 0,
      }}>
        <span style={{ color: T.muted, fontSize: 12 }}>
          {from.toLocaleString()}–{to.toLocaleString()} of {rows.length.toLocaleString()}
        </span>
        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          {[['«', 0, page === 0], ['‹', page - 1, page === 0]].map(([lbl, pg, dis]) => (
            <button key={lbl} onClick={() => setPage(pg)} disabled={dis}
              style={{ background: T.card, border: `1px solid ${T.border}`, color: T.muted,
                borderRadius: 5, padding: '3px 8px', cursor: dis ? 'default' : 'pointer', fontSize: 11, opacity: dis ? 0.35 : 1 }}>
              {lbl}
            </button>
          ))}
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const p = page < 2 ? i : page > totalPages - 3 ? totalPages - 5 + i : page - 2 + i;
            if (p < 0 || p >= totalPages) return null;
            return (
              <button key={p} onClick={() => setPage(p)}
                style={{ background: p === page ? T.accent : T.card, color: p === page ? '#060A10' : T.muted,
                  border: `1px solid ${p === page ? T.accent : T.border}`, borderRadius: 5,
                  padding: '3px 8px', cursor: 'pointer', fontSize: 11, fontWeight: p === page ? 800 : 400 }}>
                {p + 1}
              </button>
            );
          })}
          {[['›', page + 1, page >= totalPages - 1], ['»', totalPages - 1, page >= totalPages - 1]].map(([lbl, pg, dis]) => (
            <button key={lbl} onClick={() => setPage(pg)} disabled={dis}
              style={{ background: T.card, border: `1px solid ${T.border}`, color: T.muted,
                borderRadius: 5, padding: '3px 8px', cursor: dis ? 'default' : 'pointer', fontSize: 11, opacity: dis ? 0.35 : 1 }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Smart data table — automatically selects virtual scroll, pagination, or simple
 * based on row count. Supports client-side sort and search.
 *
 * @param {Array}  cols        Column definitions: { key, label, render?, sortable? }
 * @param {Array}  rows        Data rows (plain objects)
 * @param {Function} onRow     Called with the clicked row object
 * @param {string} emptyMsg    Message shown when rows is empty
 * @param {number} maxHeightVh Fraction of viewport height for the scroll container
 */
export default function Table({
  cols,
  rows,
  onRow,
  emptyMsg = 'No records found.',
  maxHeightVh = 0.48,
}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = useCallback((key) => {
    setSortKey(prev => {
      if (prev === key) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return key; }
      setSortDir('asc');
      return key;
    });
  }, []);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  const maxH = typeof window !== 'undefined'
    ? Math.round(window.innerHeight * maxHeightVh)
    : 400;

  const colsWithSort = cols.map(c => ({ ...c }));

  if (sorted.length > VIRT_THR) {
    return <VirtualTable cols={colsWithSort} rows={sorted} onRow={onRow} maxH={maxH} />;
  }
  if (sorted.length > PAGE_SZ) {
    return <PagedTable cols={colsWithSort} rows={sorted} onRow={onRow} emptyMsg={emptyMsg} maxH={maxH} />;
  }

  // Small — simple fixed-height scroll
  return (
    <div style={{ overflowY: 'auto', overflowX: 'auto', maxHeight: maxH, WebkitOverflowScrolling: 'touch' }}>
      <table style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse', fontSize: 13 }}>
        <THead cols={colsWithSort} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
        <tbody>
          {sorted.length === 0
            ? <EmptyState message={emptyMsg} />
            : sorted.map((row, i) => <TRow key={row.id ?? i} cols={colsWithSort} row={row} idx={i} onRow={onRow} />)
          }
        </tbody>
      </table>
    </div>
  );
}
