import React, { useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a relative time string (e.g. "3 days ago") for dates within 30 days,
 * or an absolute locale string for older dates.
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMs < 0) {
    // future date — show absolute
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;
  if (diffDay <= 30) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;

  // older than 30 days — absolute
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// EmailItem
// ---------------------------------------------------------------------------

function EmailItem({ email, direction }) {
  const [expanded, setExpanded] = useState(false);

  const toggle = useCallback(() => setExpanded((v) => !v), []);

  const subject = email.subject || '(no subject)';
  const body = email.body || '';
  const dateStr = email.date || email.recordedAt || '';
  const dateLabel = formatDate(dateStr);
  const absoluteDate = dateStr
    ? new Date(dateStr).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const isReceived = direction === 'received';

  return (
    <div
      onClick={toggle}
      style={{
        padding: '14px 16px',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        background: 'var(--bg)',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s ease, transform 0.15s ease',
        boxShadow: 'var(--shadow-sm)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow =
          '0 4px 12px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
      role="button"
      aria-expanded={expanded}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      }}
    >
      {/* Top row: badge + date */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px',
          gap: '8px',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '2px 8px',
            borderRadius: '9999px',
            background: isReceived
              ? 'var(--blue-100, #dbeafe)'
              : 'var(--green-100, #dcfce7)',
            color: isReceived
              ? 'var(--blue-700, #1d4ed8)'
              : 'var(--green-700, #15803d)',
            flexShrink: 0,
          }}
        >
          {isReceived ? '↙ Received' : '↗ Sent'}
        </span>

        {dateLabel && (
          <span
            title={absoluteDate}
            style={{
              fontSize: '11.5px',
              color: 'var(--text-3)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {dateLabel}
          </span>
        )}
      </div>

      {/* Subject */}
      <div
        style={{
          fontWeight: 600,
          fontSize: '13.5px',
          color: 'var(--text)',
          marginBottom: '4px',
          lineHeight: 1.3,
        }}
      >
        {subject}
      </div>

      {/* Body preview or full body */}
      {body ? (
        expanded ? (
          <div
            style={{
              fontSize: '12.5px',
              color: 'var(--text-2)',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              marginTop: '6px',
              wordBreak: 'break-word',
            }}
          >
            {body}
          </div>
        ) : (
          <div
            style={{
              fontSize: '12px',
              color: 'var(--text-3)',
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
            }}
          >
            {body}
          </div>
        )
      ) : null}

      {/* Expand/collapse hint */}
      {body && (
        <div
          style={{
            marginTop: '6px',
            fontSize: '11px',
            color: 'var(--text-3)',
            userSelect: 'none',
          }}
        >
          {expanded ? 'Click to collapse' : 'Click to expand'}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmailsTab
// ---------------------------------------------------------------------------

export default function EmailsTab({ customer }) {
  const receivedEmails = customer?.receivedEmails || [];
  const sentEmails = customer?.sentEmails || [];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '24px',
        padding: '4px 0',
      }}
    >
      {/* Received */}
      <section>
        <div className="email-section-header">
          <span className="email-section-dot received" />
          <h3 className="email-section-title">Received</h3>
          {receivedEmails.length > 0 && (
            <span className="email-section-count">{receivedEmails.length}</span>
          )}
        </div>

        {receivedEmails.length === 0 ? (
          <div className="email-empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--text-3)', opacity: 0.5, marginBottom: 8 }}>
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
              <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/>
            </svg>
            <p className="email-empty-title">No received emails yet</p>
            <p className="email-empty-sub">Emails from this contact will appear here after you sync.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {receivedEmails.map((email, idx) => (
              <EmailItem key={email.id || email.subject || idx} email={email} direction="received" />
            ))}
          </div>
        )}
      </section>

      {/* Sent */}
      <section>
        <div className="email-section-header">
          <span className="email-section-dot sent" />
          <h3 className="email-section-title">Sent</h3>
          {sentEmails.length > 0 && (
            <span className="email-section-count">{sentEmails.length}</span>
          )}
        </div>

        {sentEmails.length === 0 ? (
          <div className="email-empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--text-3)', opacity: 0.5, marginBottom: 8 }}>
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            <p className="email-empty-title">No sent emails yet</p>
            <p className="email-empty-sub">Use Compose to send your first email to this contact.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {sentEmails.map((email, idx) => (
              <EmailItem key={email.id || email.subject || idx} email={email} direction="sent" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
