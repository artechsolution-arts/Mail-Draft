import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { escalateDraft, escalateCustomer, getAuthStatus } from '../../api.js';
import { useApp } from '../../context/AppContext.jsx';

/**
 * EscalateModal — escalate a customer (or a specific draft) to a higher authority.
 *
 * Props:
 *   open         {boolean}
 *   onClose      {function}
 *   customer     {object}   – the customer being escalated
 *   draft        {object=}  – optional: specific draft being escalated
 *   onEscalated  {function} – called after a successful escalation
 */
export default function EscalateModal({ open, onClose, draft, customer, onEscalated }) {
  const { addToast } = useApp();

  const [escalateTo, setEscalateTo]   = useState('');
  const [note, setNote]               = useState('');
  const [escalateToErr, setEscalateToErr] = useState('');
  const [apiError, setApiError]       = useState('');
  const [loading, setLoading]         = useState(false);
  const [savedNoAuth, setSavedNoAuth] = useState(false);

  // Outlook auth status
  const [authChecked, setAuthChecked]     = useState(false);
  const [outlookConnected, setOutlookConnected] = useState(true);

  // Check Outlook auth status when the modal opens
  useEffect(() => {
    if (!open) return;

    // Reset state
    setEscalateTo('');
    setNote('');
    setEscalateToErr('');
    setApiError('');
    setLoading(false);
    setSavedNoAuth(false);
    setAuthChecked(false);
    setOutlookConnected(true);

    let cancelled = false;
    getAuthStatus()
      .then((status) => {
        if (!cancelled) {
          // Accept either { connected: true } or { authenticated: true } shape
          const connected = status?.connected ?? status?.authenticated ?? false;
          setOutlookConnected(connected);
          setAuthChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          // If the check fails assume not connected to be safe
          setOutlookConnected(false);
          setAuthChecked(true);
        }
      });

    return () => { cancelled = true; };
  }, [open]);

  function validate() {
    if (!escalateTo.trim()) {
      setEscalateToErr('Recipient email is required.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(escalateTo.trim())) {
      setEscalateToErr('Enter a valid email address.');
      return false;
    }
    setEscalateToErr('');
    return true;
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setApiError('');
    setSavedNoAuth(false);

    try {
      if (draft?.id) {
        await escalateDraft(draft.id, { escalateTo: escalateTo.trim(), note: note.trim() });
      } else {
        await escalateCustomer(customer.email, { escalateTo: escalateTo.trim(), note: note.trim() });
      }
      addToast('success', 'Escalation sent successfully.');
      onEscalated?.();
      onClose();
    } catch (err) {
      // 401 with a "saved" flag means the record was persisted but Outlook is not connected
      if (err.message?.includes('401') && err.message?.toLowerCase().includes('saved')) {
        setSavedNoAuth(true);
      } else {
        setApiError(err.message ?? 'Failed to send escalation. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  const emailCount = customer?.emails?.length ?? customer?.emailCount ?? 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Escalate Customer"
      maxWidth="sm"
    >
      <form onSubmit={handleSend} noValidate className="modal-form">
        {/* Info banner */}
        <div style={infoBannerStyle}>
          The recipient will receive the <strong>complete customer history</strong> — all emails,
          notes, quotations, and follow-ups — so they can take over immediately.
        </div>

        {/* Outlook auth warning */}
        {authChecked && !outlookConnected && !savedNoAuth && (
          <div style={authWarningStyle}>
            <strong>Outlook is not connected.</strong> The escalation email cannot be sent until you
            authenticate with Microsoft.
            <br />
            <a href="/crm/auth/login" style={authLinkStyle}>
              Connect Outlook now
            </a>
            {' '}— your draft will be saved and you can send the escalation after connecting.
          </div>
        )}

        {/* Saved but no auth state */}
        {savedNoAuth && (
          <div style={{ ...authWarningStyle, background: 'var(--blue-bg)', borderColor: 'var(--brand-primary)', color: 'var(--brand-primary)' }}>
            <strong>Saved</strong> — connect Outlook to send the escalation email.{' '}
            <a href="/crm/auth/login" style={{ color: 'var(--brand-primary)', fontWeight: 600, textDecoration: 'underline' }}>
              Connect Outlook
            </a>
          </div>
        )}

        {/* Escalate To */}
        <div className="mf-field">
          <label htmlFor="esc-to">
            Escalate To <span aria-hidden="true" style={{ color: 'var(--red-7)', fontWeight: 400 }}>*</span>
          </label>
          <input
            id="esc-to"
            type="email"
            value={escalateTo}
            onChange={(e) => { setEscalateTo(e.target.value); setEscalateToErr(''); }}
            placeholder="accounts@company.com"
            autoComplete="off"
            disabled={loading}
          />
          {escalateToErr && <p className="mf-error">{escalateToErr}</p>}
        </div>

        {/* Note / Reason */}
        <div className="mf-field">
          <label htmlFor="esc-note">
            Note / Reason{' '}
            <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            id="esc-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. This inquiry is related to billing and needs the accounts team…"
            rows={3}
            disabled={loading}
          />
        </div>

        {/* Customer preview */}
        {customer && (
          <div style={customerPreviewStyle}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>
              {customer.name || '(No name)'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text)' }}>{customer.email}</div>
            {customer.company && (
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 1 }}>{customer.company}</div>
            )}
            {emailCount > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                {emailCount} email{emailCount !== 1 ? 's' : ''} on record
              </div>
            )}
          </div>
        )}

        {/* API error */}
        {apiError && <p className="mf-api-error">{apiError}</p>}

        {/* Actions */}
        <div className="mf-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn btn-warn" disabled={loading} id="escalate-send-btn">
            {loading ? 'Sending…' : '⚠️ Send Escalation'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const infoBannerStyle = {
  background: 'rgba(61,199,179,0.10)',
  border: '1px solid rgba(61,199,179,0.30)',
  borderRadius: 8,
  padding: '12px 14px',
  marginBottom: 20,
  fontSize: 12.5,
  color: 'var(--text-2)',
  lineHeight: 1.6,
};

const authWarningStyle = {
  background: 'var(--red-bg)',
  border: '1px solid var(--red-7)',
  borderRadius: 8,
  padding: '12px 16px',
  marginBottom: 16,
  fontSize: 12.5,
  color: 'var(--red-7)',
  lineHeight: 1.6,
};

const authLinkStyle = {
  color: 'var(--red-7)',
  fontWeight: 600,
  textDecoration: 'underline',
};

const customerPreviewStyle = {
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '12px 14px',
  marginBottom: 'var(--sp-4)',
  fontSize: 12.5,
};

const errorBannerStyle = {
  padding: '10px 14px',
  borderRadius: 8,
  background: 'var(--red-bg)',
  border: '1px solid var(--red-7)',
  color: 'var(--red-7)',
  fontSize: 13,
  marginBottom: 8,
};
