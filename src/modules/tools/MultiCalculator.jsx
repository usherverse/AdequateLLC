import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, Percent, Gavel, X, Delete, Divide, Minus, Plus, Equal, Hash, RefreshCcw, Info } from 'lucide-react';
import { T, Card, Btn, FI, fmt, Dialog } from '@/lms-common';

export default function MultiCalculator({ onClose }) {
  const [activeTab, setActiveTab] = useState('loan'); // 'arithmetic' or 'loan'

  return (
    <Dialog 
      title="" 
      onClose={onClose} 
      width={400} 
      noPadding
      style={{ overflow: 'hidden', borderRadius: 28 }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: 580 }}>
        {/* Header Toggle */}
        <div style={{ 
          display: 'flex', 
          background: T.surface, 
          padding: 6, 
          margin: 16, 
          borderRadius: 16, 
          border: `1px solid ${T.border}` 
        }}>
          <button 
            onClick={() => setActiveTab('loan')}
            style={{ 
              flex: 1, 
              padding: '10px 0', 
              borderRadius: 12, 
              border: 'none', 
              background: activeTab === 'loan' ? T.card : 'none',
              color: activeTab === 'loan' ? T.accent : T.dim,
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: activeTab === 'loan' ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            <Percent size={14} /> Loan Math
          </button>
          <button 
            onClick={() => setActiveTab('arithmetic')}
            style={{ 
              flex: 1, 
              padding: '10px 0', 
              borderRadius: 12, 
              border: 'none', 
              background: activeTab === 'arithmetic' ? T.card : 'none',
              color: activeTab === 'arithmetic' ? T.accent : T.dim,
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: activeTab === 'arithmetic' ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            <Calculator size={14} /> Arithmetic
          </button>
        </div>

        <div style={{ flex: 1, padding: '0 20px 20px', overflowY: 'auto' }}>
          {activeTab === 'loan' ? <LoanCalculatorView /> : <ArithmeticCalculatorView />}
        </div>
      </div>
    </Dialog>
  );
}

function LoanCalculatorView() {
  const [amt, setAmt] = useState(10000);
  const [odDays, setOdDays] = useState(0);

  const interest = Math.round(amt * 0.3);
  const baseTotal = amt + interest;
  const dailyRate = 0.012;
  const cappedOd = Math.min(Number(odDays), 60);
  const penalty = Math.round(baseTotal * dailyRate * cappedOd);
  const totalDue = baseTotal + penalty;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <FI 
          label="Principal Amount (KES)" 
          type="number" 
          value={amt} 
          onChange={v => setAmt(Number(v))} 
          placeholder="5,000"
        />
        <FI 
          label="Days Overdue" 
          type="number" 
          value={odDays} 
          onChange={v => setOdDays(Number(v))} 
          placeholder="0"
          sub="Max penalty caps at 60 days"
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
        <ResultRow label="Principal" value={amt} />
        <ResultRow label="Interest (30%)" value={interest} color={T.accent} />
        <div style={{ height: 1, background: T.border, margin: '4px 0' }} />
        <ResultRow label="Base Payable" value={baseTotal} bold />
        <ResultRow 
          label={`Penalty (${odDays}d @ 1.2%/day)`} 
          value={penalty} 
          color={penalty > 0 ? T.danger : T.muted} 
        />
        
        <div style={{ 
          marginTop: 15, 
          padding: 20, 
          background: `linear-gradient(135deg, ${T.surface}, ${T.card})`, 
          borderRadius: 20,
          border: `1px solid ${T.accent}30`,
          boxShadow: `0 8px 24px ${T.accent}10`
        }}>
          <div style={{ color: T.dim, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>TOTAL DUE FOR INQUIRY</div>
          <div style={{ color: T.txt, fontSize: 32, fontWeight: 900, fontFamily: T.head }}>{fmt(totalDue)}</div>
          {odDays >= 60 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.danger, fontSize: 11, fontWeight: 700, marginTop: 8 }}>
              <Gavel size={12} /> Account is FROZEN (Max Penalty)
            </div>
          )}
        </div>
      </div>

      <div style={{ 
        background: T.blue + '10', 
        padding: 14, 
        borderRadius: 16, 
        border: `1px solid ${T.blue}20`,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start'
      }}>
        <Info size={16} color={T.blue} style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontSize: 12, color: T.dim, lineHeight: 1.5 }}>
          <b>Note:</b> Standard flat interest is 30%. Penalties of 1.2% per day apply only to the base total (Principal + Interest) after the initial 30-day term.
        </div>
      </div>
    </div>
  );
}

function ResultRow({ label, value, color, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: T.dim, fontSize: 13, fontWeight: 500 }}>{label}</span>
      <span style={{ 
        color: color || T.txt, 
        fontSize: 14, 
        fontWeight: bold ? 900 : 700, 
        fontFamily: T.mono 
      }}>
        {fmt(value)}
      </span>
    </div>
  );
}

function ArithmeticCalculatorView() {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [isDone, setIsDone] = useState(false);

  const handleChar = (char) => {
    if (isDone) {
      if (['+', '-', '*', '/'].includes(char)) {
        setEquation(display + char);
        setIsDone(false);
      } else {
        setDisplay(char);
        setEquation('');
        setIsDone(false);
      }
      return;
    }

    if (display === '0' && !['+', '-', '*', '/', '.'].includes(char)) {
      setDisplay(char);
    } else {
      setDisplay(prev => prev + char);
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setEquation('');
    setIsDone(false);
  };

  const handleBackspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  const calc = () => {
    try {
      // Very crude eval, but safe for numbers/ops
      // eslint-disable-next-line no-eval
      const res = eval(display.replace(/×/g, '*').replace(/÷/g, '/'));
      setEquation(display + ' =');
      setDisplay(String(Number(res.toFixed(10))));
      setIsDone(true);
    } catch (e) {
      setDisplay('Error');
    }
  };

  const buttons = [
    { l: 'C', c: T.danger, fn: handleClear },
    { l: '⌫', c: T.dim, fn: handleBackspace },
    { l: '÷', c: T.accent, v: '/' },
    { l: '×', c: T.accent, v: '*' },
    { l: '7', c: T.txt, v: '7' },
    { l: '8', c: T.txt, v: '8' },
    { l: '9', c: T.txt, v: '9' },
    { l: '-', c: T.accent, v: '-' },
    { l: '4', c: T.txt, v: '4' },
    { l: '5', c: T.txt, v: '5' },
    { l: '6', c: T.txt, v: '6' },
    { l: '+', c: T.accent, v: '+' },
    { l: '1', c: T.txt, v: '1' },
    { l: '2', c: T.txt, v: '2' },
    { l: '3', c: T.txt, v: '3' },
    { l: '=', c: '#fff', bg: T.accent, rowSpan: 2, fn: calc },
    { l: '0', c: T.txt, v: '0', colSpan: 2 },
    { l: '.', c: T.txt, v: '.' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ 
        background: T.surface, 
        padding: '24px 20px', 
        borderRadius: 24, 
        textAlign: 'right',
        border: `1px solid ${T.border}`,
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ 
          position: 'absolute', top: 8, right: 20, 
          fontSize: 12, fontWeight: 700, color: T.muted,
          fontFamily: T.mono, minHeight: 18
        }}>
          {equation}
        </div>
        <div style={{ 
          fontSize: 36, fontWeight: 900, color: T.txt,
          fontFamily: T.mono, overflow: 'hidden', textOverflow: 'ellipsis'
        }}>
          {display}
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gridAutoRows: 64,
        gap: 12 
      }}>
        {buttons.map((b, i) => (
          <button
            key={i}
            onClick={() => b.fn ? b.fn() : handleChar(b.v)}
            style={{
              gridColumn: b.colSpan ? `span ${b.colSpan}` : 'auto',
              gridRow: b.rowSpan ? `span ${b.rowSpan}` : 'auto',
              background: b.bg || T.card,
              color: b.c,
              border: `1px solid ${T.border}`,
              borderRadius: 18,
              fontSize: 18,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              boxShadow: b.bg ? `0 8px 16px ${b.bg}30` : 'none'
            }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = T.accent; }}
            onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = T.border; }}
          >
            {b.l}
          </button>
        ))}
      </div>
    </div>
  );
}
