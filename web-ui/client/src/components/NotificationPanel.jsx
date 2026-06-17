import React, { useCallback } from 'react';
import { useApp } from '../context/AppContext.jsx';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function daysAgoText(dateStr) {
  if (!dateStr) return null;
  const days = Math.floor((Date.now() - new Date(dateStr)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function dueDateText(dueAt) {
  if (!dueAt) return null;
  const dueDate = new Date(dueAt);
  const now = new Date();
  const diffDays = Math.round((now - dueDate) / 86_400_000);
  if (diffDays <= 0) return `Due ${dueDate.toLocaleDateString()}`;
  if (diffDays === 1) return 'Due 1 day ago';
  return `Due ${diffDays} days ago`;
}

// ---------------------------------------------------------------------------
// Sub-component: single notification card
// ---------------------------------------------------------------------------
function NotifCard({ item, onView, onGenerate, onDismiss }) {
  const { customer, followUp, lastEmailAt } = item;
  const name = customer.name || customer.email;
  const lastActivityText = daysAgoText(lastEmailAt);
  const dueText = dueDateText(followUp?.dueAt);

  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      {/* Name + company */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
          {name}
        </span>
        {customer.company && (
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {customer.company}
          </span>
        )}
      </div>

      {/* Last activity */}
      {lastActivityText && (
        <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
          Last Activity:{' '}
          <span style={{ fontWeight: 600 }}>{lastActivityText}</span>
        </div>
      )}

      {/* Status pill */}
      <div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            fontWeight: 600,
            color: '#2DB37A',
            background: 'rgba(45,179,122,0.10)',
            border: '1px solid rgba(45,179,122,0.25)',
            borderRadius: 99,
            padding: '2px 8px',
          }}
        >
          Awaiting Response
        </span>
      </div>

      {/* Due date */}
      {dueText && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--red-7)',
          }}
        >
          {dueText}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
        <button
          onClick={onView}
          style={btnStyle('ghost')}
        >
          View
        </button>
        <button
          onClick={onGenerate}
          style={btnStyle('amber')}
        >
          Generate
        </button>
        <button
          onClick={onDismiss}
          style={btnStyle('ghost')}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tiny inline button style helper (avoids Tailwind dependency at component level)
// ---------------------------------------------------------------------------
function btnStyle(variant) {
  const base = {
    fontSize: 12,
    fontWeight: 600,
    padding: '3px 10px',
    borderRadius: 6,
    border: '1px solid transparent',
    cursor: 'pointer',
    lineHeight: 1.6,
    transition: 'background 120ms',
  };
  if (variant === 'amber') {
    return {
      ...base,
      background: '#1A6AB4',
      color: '#fff',
      borderColor: '#155a97',
    };
  }
  // ghost
  return {
    ...base,
    background: 'transparent',
    color: 'var(--text-2)',
    borderColor: 'var(--border)',
  };
}

// ---------------------------------------------------------------------------
// Refresh icon (simple SVG)
// ---------------------------------------------------------------------------
function RefreshIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function NotificationPanel() {
  const { notifications, openCustomer, loadNotifications } = useApp();

  // -- View ------------------------------------------------------------------
  const handleView = useCallback(
    (email) => {
      openCustomer(email);
    },
    [openCustomer]
  );

  // -- Generate follow-up draft ---------------------------------------------
  const handleGenerate = useCallback(
    async (customerEmail) => {
      try {
        await fetch('/api/crm/process-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerEmail, generateDraft: true }),
        });
        await loadNotifications();
      } catch (err) {
        console.error('generate follow-up error:', err);
      }
    },
    [loadNotifications]
  );

  // -- Dismiss ---------------------------------------------------------------
  const handleDismiss = useCallback(
    async (customerEmail, fuId) => {
      try {
        await fetch(
          `/api/crm/customers/${encodeURIComponent(customerEmail)}/followup/${fuId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'dismissed' }),
          }
        );
        await loadNotifications();
      } catch (err) {
        console.error('dismiss follow-up error:', err);
      }
    },
    [loadNotifications]
  );

  // -- Refresh ---------------------------------------------------------------
  const handleRefresh = useCallback(() => {
    loadNotifications();
  }, [loadNotifications]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <aside
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        height: '100%',
        minWidth: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px 10px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--text)',
            }}
          >
            Follow-ups
          </span>

          {/* Count badge */}
          {notifications.length > 0 && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#1A6AB4',
                background: 'rgba(26,106,180,0.10)',
                border: '1px solid rgba(26,106,180,0.22)',
                borderRadius: 99,
                padding: '1px 7px',
                lineHeight: 1.7,
              }}
            >
              {notifications.length}
            </span>
          )}
        </div>

        {/* Refresh icon button */}
        <button
          onClick={handleRefresh}
          aria-label="Refresh follow-ups"
          title="Refresh"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--text-2)',
          }}
        >
          <RefreshIcon />
        </button>
      </div>

      {/* Card list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {notifications.length === 0 ? (
          /* Empty state */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingTop: 40,
              color: 'var(--text-3)',
            }}
          >
            {/* Checkmark icon */}
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ color: 'var(--green-7)', opacity: 0.7 }}
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 600 }}>All caught up!</span>
          </div>
        ) : (
          notifications.map((item) => (
            <NotifCard
              key={`${item.customer.email}-${item.followUp?.id}`}
              item={item}
              onView={() => handleView(item.customer.email)}
              onGenerate={() => handleGenerate(item.customer.email)}
              onDismiss={() => handleDismiss(item.customer.email, item.followUp?.id)}
            />
          ))
        )}
      </div>
    </aside>
  );
}
