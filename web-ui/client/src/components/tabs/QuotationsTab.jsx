import React, { useState } from 'react';
import { addQuotation } from '../../api.js';
import { useApp } from '../../context/AppContext.jsx';

const STATUS_BADGE = {
  draft:    { bg: 'var(--bg-panel)',  color: 'var(--text-3)',  border: 'var(--border)' },
  sent:     { bg: 'var(--blue-bg)',  color: 'var(--blue-7)',  border: 'var(--blue-7)' },
  accepted: { bg: 'var(--green-bg)',  color: 'var(--green-7)', border: 'var(--green-7)' },
  rejected: { bg: 'var(--red-bg)',    color: 'var(--red-7)',   border: 'var(--red-7)' },
  expired:  { bg: 'var(--bg-panel)', color: 'var(--text-3)', border: 'var(--border)' },
};

function StatusBadge({ status }) {
  const s = STATUS_BADGE[status] ?? STATUS_BADGE.draft;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 600,
      border: `1px solid ${s.border}`,
      background: s.bg,
      color: s.color,
      textTransform: 'capitalize',
      whiteSpace: 'nowrap',
    }}>
      {status || 'draft'}
    </span>
  );
}

export default function QuotationsTab({ customer, onRefresh }) {
  const { addToast } = useApp();
  const quotations = customer?.quotations || [];

  const [open, setOpen] = useState(false);
  const [ref, setRef] = useState('');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [validUntil, setValidUntil] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    if (!ref.trim()) return;
    setSaving(true);
    try {
      await addQuotation(customer.email, {
        reference: ref.trim(),
        description: desc.trim() || undefined,
        amount: amount.trim() || undefined,
        currency,
        validUntil: validUntil || undefined,
      });
      addToast('success', 'Quotation added.');
      setRef(''); setDesc(''); setAmount(''); setCurrency('USD'); setValidUntil('');
      setOpen(false);
      onRefresh?.();
    } catch (err) {
      addToast('error', `Failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {quotations.length === 0 && !open && (
        <p style={{ color: 'var(--text-3)', fontSize: 13, paddingTop: 4 }}>
          No quotations recorded yet.
        </p>
      )}

      {quotations.map((q, i) => (
        <div
          key={q.id ?? i}
          style={{
            padding: '14px 16px',
            border: '1px solid var(--border)',
            borderRadius: 10,
            background: 'var(--bg)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>
              {q.reference}
            </div>
            {q.description && (
              <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 3 }}>
                {q.description}
              </div>
            )}
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4 }}>
              {new Date(q.createdAt).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric',
              })}
              {q.validUntil &&
                ` · Valid until ${new Date(q.validUntil).toLocaleDateString(undefined, {
                  year: 'numeric', month: 'short', day: 'numeric',
                })}`}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
            <StatusBadge status={q.status} />
            {(q.amount || q.currency) && (
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                {[q.amount, q.currency].filter(Boolean).join(' ')}
              </div>
            )}
          </div>
        </div>
      ))}

      {open ? (
        <form
          onSubmit={handleSave}
          className="tab-form"
          style={{
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '16px',
            background: 'var(--bg-sidebar)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 140px' }}>
              <label style={labelStyle}>Reference *</label>
              <input
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="Q-2025-001"
                required
              />
            </div>
            <div style={{ flex: '1 1 100px' }}>
              <label style={labelStyle}>Amount</label>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1500"
              />
            </div>
            <div style={{ width: 90 }}>
              <label style={labelStyle}>Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="INR">INR</option>
                <option value="AED">AED</option>
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="What this quotation covers"
            />
          </div>
          <div>
            <label style={labelStyle}>Valid Until</label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? 'Saving…' : 'Save Quotation'}
            </button>
          </div>
        </form>
      ) : (
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setOpen(true)}
          style={{ alignSelf: 'flex-start' }}
        >
          + Add Quotation
        </button>
      )}
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: 11.5,
  fontWeight: 600,
  color: 'var(--text-2)',
  marginBottom: 3,
};
