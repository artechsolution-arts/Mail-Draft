import React, { useState, useEffect, useRef } from 'react';
import Modal from '../ui/Modal';
import { upsertCustomer } from '../../api.js';
import { useApp } from '../../context/AppContext.jsx';

// ── Calendar constants ────────────────────────────────────────────────────────
const MONTH_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_NAMES   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// ── DatePicker ────────────────────────────────────────────────────────────────
function DatePicker({ value, onChange }) {
  const today  = new Date();
  const parsed = value ? new Date(value + 'T12:00:00') : null;

  const [viewYear,  setViewYear]  = useState(parsed ? parsed.getFullYear()  : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed ? parsed.getMonth()     : today.getMonth());
  const [viewMode,  setViewMode]  = useState('days'); // 'days' | 'months' | 'years'
  const [yearStart, setYearStart] = useState(() => {
    const y = parsed?.getFullYear() ?? today.getFullYear();
    return Math.floor(y / 12) * 12;
  });

  // Sync view when external value changes
  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T12:00:00');
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [value]);

  // ── Day grid helpers ─────────────────────────────────────────────────────
  const firstWeekday  = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth   = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrev    = new Date(viewYear, viewMonth, 0).getDate();

  const cells = [];
  for (let i = firstWeekday - 1; i >= 0; i--) cells.push({ day: daysInPrev - i, type: 'prev' });
  for (let d = 1; d <= daysInMonth; d++)        cells.push({ day: d, type: 'cur' });
  let nd = 1;
  while (cells.length % 7 !== 0) cells.push({ day: nd++, type: 'next' });

  const isToday    = (c) => c.type === 'cur' && viewYear === today.getFullYear() && viewMonth === today.getMonth() && c.day === today.getDate();
  const isSelected = (c) => parsed && c.type === 'cur' && viewYear === parsed.getFullYear() && viewMonth === parsed.getMonth() && c.day === parsed.getDate();

  // ── Prev / Next logic per view mode ─────────────────────────────────────
  function handlePrev() {
    if (viewMode === 'days') {
      if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
      else setViewMonth(m => m - 1);
    } else if (viewMode === 'months') {
      setViewYear(y => y - 1);
    } else {
      setYearStart(s => s - 12);
    }
  }
  function handleNext() {
    if (viewMode === 'days') {
      if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
      else setViewMonth(m => m + 1);
    } else if (viewMode === 'months') {
      setViewYear(y => y + 1);
    } else {
      setYearStart(s => s + 12);
    }
  }

  function selectDay(cell) {
    if (cell.type !== 'cur') return;
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(cell.day).padStart(2, '0');
    onChange(`${viewYear}-${m}-${d}`);
  }
  function selectMonth(mi) {
    setViewMonth(mi);
    setViewMode('days');
  }
  function selectYear(yr) {
    setViewYear(yr);
    setViewMode('months');
  }
  function goToday() {
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    onChange(`${today.getFullYear()}-${m}-${d}`);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setViewMode('days');
  }

  // ── Header label ─────────────────────────────────────────────────────────
  const headerLabel = viewMode === 'days'
    ? null
    : viewMode === 'months'
      ? String(viewYear)
      : `${yearStart} – ${yearStart + 11}`;

  return (
    <div className="cal-picker">

      {/* ── Header ── */}
      <div className="cal-header">
        <button type="button" className="cal-nav" onClick={handlePrev} aria-label="Previous">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>

        {viewMode === 'days' ? (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button type="button" className="cal-header-btn" onClick={() => setViewMode('months')}>
              {MONTH_LONG[viewMonth]}
            </button>
            <button type="button" className="cal-header-btn" onClick={() => { setYearStart(Math.floor(viewYear / 12) * 12); setViewMode('years'); }}>
              {viewYear}
            </button>
          </div>
        ) : (
          <span className="cal-month-label">{headerLabel}</span>
        )}

        <button type="button" className="cal-nav" onClick={handleNext} aria-label="Next">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      {/* ── Day grid ── */}
      {viewMode === 'days' && (
        <div className="cal-grid">
          {DAY_NAMES.map(d => <span key={d} className="cal-day-name">{d}</span>)}
          {cells.map((cell, i) => (
            <button
              key={i}
              type="button"
              onClick={() => selectDay(cell)}
              tabIndex={cell.type === 'cur' ? 0 : -1}
              className={['cal-cell', cell.type !== 'cur' ? 'other-month' : '', isToday(cell) ? 'today' : '', isSelected(cell) ? 'selected' : ''].filter(Boolean).join(' ')}
            >
              {cell.day}
            </button>
          ))}
        </div>
      )}

      {/* ── Month grid ── */}
      {viewMode === 'months' && (
        <div className="cal-month-grid">
          {MONTH_SHORT.map((name, i) => (
            <button
              key={name}
              type="button"
              onClick={() => selectMonth(i)}
              className={['cal-month-cell', i === viewMonth && viewYear === (parsed?.getFullYear() ?? -1) ? 'selected' : '', i === today.getMonth() && viewYear === today.getFullYear() ? 'today' : ''].filter(Boolean).join(' ')}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* ── Year grid ── */}
      {viewMode === 'years' && (
        <div className="cal-month-grid">
          {Array.from({ length: 12 }, (_, i) => yearStart + i).map(yr => (
            <button
              key={yr}
              type="button"
              onClick={() => selectYear(yr)}
              className={['cal-month-cell', yr === viewYear ? 'selected' : '', yr === today.getFullYear() ? 'today' : ''].filter(Boolean).join(' ')}
            >
              {yr}
            </button>
          ))}
        </div>
      )}

      {/* ── Footer ── */}
      <div className="cal-footer">
        <button type="button" className="cal-action-btn" onClick={() => { onChange(''); setViewMode('days'); }}>Clear</button>
        <button type="button" className="cal-action-btn amber" onClick={goToday}>Today</button>
      </div>
    </div>
  );
}

// ── AddCustomerModal ──────────────────────────────────────────────────────────

export default function AddCustomerModal({ open, onClose, editCustomer = null, onSaved }) {
  const { addToast } = useApp();
  const isEdit = editCustomer !== null;

  const [email,     setEmail]     = useState('');
  const [name,      setName]      = useState('');
  const [company,   setCompany]   = useState('');
  const [phone,     setPhone]     = useState('');
  const [since,     setSince]     = useState('');
  const [sinceOpen, setSinceOpen] = useState(false);
  const [emailErr,  setEmailErr]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [apiError,  setApiError]  = useState('');

  const calRef = useRef(null);

  useEffect(() => {
    if (!sinceOpen) return;
    const handle = (e) => { if (calRef.current && !calRef.current.contains(e.target)) setSinceOpen(false); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [sinceOpen]);

  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setEmail(editCustomer.email ?? '');
      setName(editCustomer.name ?? '');
      setCompany(editCustomer.company ?? '');
      setPhone(editCustomer.phone ?? '');
      setSince(editCustomer.customerSince ? editCustomer.customerSince.slice(0, 10) : '');
    } else {
      setEmail(''); setName(''); setCompany(''); setPhone(''); setSince('');
    }
    setEmailErr(''); setApiError(''); setLoading(false); setSinceOpen(false);
  }, [open, isEdit, editCustomer]);

  function validate() {
    if (!email.trim()) { setEmailErr('Email is required.'); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setEmailErr('Enter a valid email address.'); return false; }
    setEmailErr(''); return true;
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true); setApiError('');
    try {
      await upsertCustomer({
        email:         email.trim(),
        name:          name.trim() || undefined,
        company:       company.trim() || undefined,
        phone:         phone.trim() || undefined,
        customerSince: since || undefined,
      });
      addToast('success', isEdit ? 'Customer updated.' : 'Customer added.');
      onSaved?.(); onClose();
    } catch (err) {
      setApiError(err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const sinceDisplay = since
    ? new Date(since + 'T12:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : '';

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Customer' : 'Add Customer'} maxWidth="sm">
      <form onSubmit={handleSave} noValidate className="modal-form">

        {/* Email */}
        <div className="mf-field">
          <label htmlFor="ac-email">
            Email <span aria-hidden="true" style={{ color: 'var(--red-7,#e53e3e)', textTransform: 'none', fontWeight: 400 }}>*</span>
          </label>
          {isEdit ? (
            <div className="mf-readonly-row">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              {email}
              <span className="mf-locked-badge">Locked</span>
            </div>
          ) : (
            <>
              <input id="ac-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setEmailErr(''); }} placeholder="customer@example.com" autoComplete="off" />
              {emailErr && <p className="mf-error">{emailErr}</p>}
            </>
          )}
        </div>

        {/* Name + Company */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div className="mf-field" style={{ marginBottom: 0 }}>
            <label htmlFor="ac-name">Name</label>
            <input id="ac-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" />
          </div>
          <div className="mf-field" style={{ marginBottom: 0 }}>
            <label htmlFor="ac-company">Company</label>
            <input id="ac-company" type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Corp" />
          </div>
        </div>

        {/* Phone */}
        <div className="mf-field">
          <label htmlFor="ac-phone">Phone</label>
          <input id="ac-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 000 0000" />
        </div>

        {/* Customer Since */}
        <div className="mf-field" ref={calRef}>
          <label>Customer Since</label>
          <button type="button" className={`date-trigger-btn${sinceOpen ? ' open' : ''}`} onClick={() => setSinceOpen(o => !o)}>
            <span style={{ color: sinceDisplay ? 'var(--text)' : 'var(--text-3)' }}>
              {sinceDisplay || 'Pick a date'}
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </button>
          {sinceOpen && (
            <div style={{ marginTop: 6 }}>
              <DatePicker value={since} onChange={(v) => { setSince(v); setSinceOpen(false); }} />
            </div>
          )}
        </div>

        {apiError && <p className="mf-api-error">{apiError}</p>}

        <div className="mf-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Customer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
