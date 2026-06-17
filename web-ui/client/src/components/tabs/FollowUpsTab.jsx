import React, { useState } from 'react';
import { addFollowUp, updateFollowUp } from '../../api.js';
import { useApp } from '../../context/AppContext.jsx';

const STATUS_STYLES = {
  pending:   { background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' },
  closed:    { background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' },
  dismissed: { background: 'oklch(0.940 0.008 68)', color: 'var(--text-3)', border: '1px solid var(--border)' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.dismissed;
  return (
    <span style={{
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      padding: '2px 8px',
      borderRadius: 9999,
      whiteSpace: 'nowrap',
      ...s,
    }}>
      {status}
    </span>
  );
}

function FollowUpCard({ fu, email, onRefresh }) {
  const { addToast } = useApp();
  const [updating, setUpdating] = useState(null);

  const isPending = fu.status === 'pending';
  const dueDate = fu.dueAt || fu.dueDate;
  const isOverdue = isPending && dueDate && new Date(dueDate) < new Date();

  async function changeStatus(newStatus) {
    setUpdating(newStatus);
    try {
      await updateFollowUp(email, fu.id, newStatus);
      addToast('success', `Follow-up marked as ${newStatus}.`);
      onRefresh?.();
    } catch (err) {
      addToast('error', `Failed: ${err.message}`);
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div style={{
      padding: '14px 16px',
      border: `1px solid ${isOverdue ? '#fb923c' : 'var(--border)'}`,
      borderRadius: 10,
      background: isOverdue ? '#fff7ed' : 'var(--bg)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text)' }}>
            {fu.subject || '(no subject)'}
          </div>
          {fu.note && (
            <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 3, whiteSpace: 'pre-wrap' }}>
              {fu.note}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <StatusBadge status={fu.status} />
            {dueDate && (
              <span style={{ fontSize: 11.5, color: isOverdue ? '#c2410c' : 'var(--text-3)', fontWeight: isOverdue ? 700 : 400 }}>
                {isOverdue ? 'Overdue · ' : 'Due '}
                {new Date(dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>

        {isPending && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              className="btn btn-success btn-sm"
              disabled={!!updating}
              onClick={() => changeStatus('closed')}
            >
              {updating === 'closed' ? '…' : 'Close'}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              disabled={!!updating}
              onClick={() => changeStatus('dismissed')}
            >
              {updating === 'dismissed' ? '…' : 'Dismiss'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FollowUpsTab({ customer, onRefresh }) {
  const { addToast } = useApp();
  const followUps = customer?.followUps || customer?.followups || [];

  const [subject, setSubject] = useState('');
  const [note, setNote] = useState('');
  const [days, setDays] = useState(3);
  const [saving, setSaving] = useState(false);

  const pending  = followUps.filter((fu) => fu.status === 'pending');
  const archived = followUps.filter((fu) => fu.status !== 'pending');

  async function handleSave(e) {
    e.preventDefault();
    if (!subject.trim()) {
      addToast('error', 'Subject is required.');
      return;
    }
    setSaving(true);
    try {
      await addFollowUp(customer.email, {
        subject: subject.trim(),
        note: note.trim() || undefined,
        daysUntilDue: Number(days) || 3,
      });
      addToast('success', 'Follow-up scheduled.');
      setSubject(''); setNote(''); setDays(3);
      onRefresh?.();
    } catch (err) {
      addToast('error', `Failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  const hasAny = followUps.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {!hasAny && (
        <p style={{ color: 'var(--text-3)', fontSize: 13, paddingTop: 4 }}>
          No follow-ups scheduled yet.
        </p>
      )}

      {/* Pending first */}
      {pending.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
            Pending ({pending.length})
          </p>
          {pending.map((fu) => (
            <FollowUpCard key={fu.id} fu={fu} email={customer.email} onRefresh={onRefresh} />
          ))}
        </div>
      )}

      {/* Divider */}
      {pending.length > 0 && archived.length > 0 && (
        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '2px 0' }} />
      )}

      {/* Archived */}
      {archived.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
            Closed / Dismissed ({archived.length})
          </p>
          {archived.map((fu) => (
            <FollowUpCard key={fu.id} fu={fu} email={customer.email} onRefresh={onRefresh} />
          ))}
        </div>
      )}

      {/* Schedule form — always visible at bottom */}
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
          marginTop: hasAny ? 4 : 0,
        }}
      >
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 2 }}>
          Schedule Follow-up
        </p>

        <div>
          <label style={labelStyle}>Subject *</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Follow-up subject"
            required
            disabled={saving}
          />
        </div>

        <div>
          <label style={labelStyle}>Note (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Additional context…"
            rows={2}
            disabled={saving}
            style={{ minHeight: 56 }}
          />
        </div>

        <div style={{ maxWidth: 160 }}>
          <label style={labelStyle}>Days until due</label>
          <input
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            disabled={saving}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-warn btn-sm" disabled={saving || !subject.trim()}>
            {saving ? 'Scheduling…' : 'Schedule Follow-up'}
          </button>
        </div>
      </form>
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
