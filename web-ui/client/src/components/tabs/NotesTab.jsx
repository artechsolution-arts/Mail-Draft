import React, { useState } from 'react';
import { addNote } from '../../api.js';
import { useApp } from '../../context/AppContext.jsx';

function relativeDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function NotesTab({ customer, onRefresh }) {
  const { addToast } = useApp();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const notes = [...(customer.notes || [])].reverse();

  async function handleAdd(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    setSaving(true);
    try {
      await addNote(customer.email, trimmed);
      setText('');
      addToast('success', 'Note added.');
      onRefresh();
    } catch (err) {
      addToast('error', `Failed to add note: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Note list */}
      {notes.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-3)', paddingTop: '0.5rem' }}>
          No notes yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {notes.map((n, i) => (
            <div
              key={n.id ?? n.createdAt ?? i}
              className="rounded-lg border p-3"
              style={{ background: 'var(--bg-panel)', borderColor: 'var(--border)' }}
            >
              <div
                className="text-xs mb-1 font-medium"
                style={{ color: 'var(--text-3)' }}
                title={new Date(n.createdAt).toLocaleString()}
              >
                {relativeDate(n.createdAt)}
                {' · '}
                {new Date(n.createdAt).toLocaleString(undefined, {
                  month: 'short', day: 'numeric', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </div>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text)' }}>
                {n.text}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Add-note form */}
      <form
        onSubmit={handleAdd}
        className="tab-form"
        style={{
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '14px',
          background: 'var(--bg-sidebar)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
          Add a note
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your internal note here…"
          rows={3}
          disabled={saving}
          style={{ resize: 'vertical' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            disabled={saving || !text.trim()}
            className="btn btn-primary btn-sm"
          >
            {saving ? 'Adding…' : 'Add Note'}
          </button>
        </div>
      </form>
    </div>
  );
}
