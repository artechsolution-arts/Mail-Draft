import React from 'react';
import { useDrafts } from '../../hooks/useDrafts.js';
import Spinner from '../ui/Spinner.jsx';
import DraftCard from '../DraftCard.jsx';

/**
 * DraftsTab — renders the Drafts pane for a given customer.
 *
 * Props:
 *   customer  {object}  The active customer object (must have .email).
 */
export default function DraftsTab({ customer }) {
  const { drafts, loading, reload } = useDrafts(customer.email);

  if (loading && drafts.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: 'var(--sp-4) 0',
          color: 'var(--text-3)',
          fontSize: 13,
        }}
      >
        <Spinner size={16} />
        Loading drafts…
      </div>
    );
  }

  if (!drafts.length) {
    return (
      <p style={{ color: 'var(--text-3)', fontSize: 13, paddingTop: 'var(--sp-4)' }}>
        No drafts — AI replies will appear here after you receive an email
      </p>
    );
  }

  // Newest first
  const sorted = [...drafts].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  return (
    <div className="draft-list">
      {sorted.map((draft) => (
        <DraftCard key={draft.id} draft={draft} onRefresh={reload} />
      ))}
    </div>
  );
}
