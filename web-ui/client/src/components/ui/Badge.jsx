import React from 'react';

/**
 * Badge — colored status pill matching crm.html .status-pill styles.
 *
 * variant: 'pending' | 'sent' | 'rejected' | 'escalated' | 'generating' | 'success' | 'error'
 */

const VARIANT_STYLES = {
  pending: {
    background: 'var(--blue-bg)',
    color:      'var(--brand-primary)',
  },
  sent: {
    background: 'var(--green-bg)',
    color:      'var(--green-7)',
  },
  success: {
    background: 'var(--green-bg)',
    color:      'var(--green-7)',
  },
  rejected: {
    background: 'var(--red-bg)',
    color:      'var(--red-7)',
  },
  error: {
    background: 'var(--red-bg)',
    color:      'var(--red-7)',
  },
  escalated: {
    background: 'var(--blue-bg)',
    color:      'var(--blue-7)',
  },
  generating: {
    background: 'var(--bg-panel)',
    color:      'var(--text-3)',
  },
};

export default function Badge({ variant = 'pending', children, className = '' }) {
  const variantStyle = VARIANT_STYLES[variant] || VARIANT_STYLES.pending;

  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '10.5px',
    fontWeight: 600,
    letterSpacing: '0.05em',
    padding: '2px 9px',
    borderRadius: '999px',
    fontFamily: "'Satoshi', system-ui, sans-serif",
    lineHeight: 1.6,
    whiteSpace: 'nowrap',
    ...variantStyle,
  };

  return (
    <span
      style={style}
      className={`ui-badge ui-badge--${variant} ${className}`}
    >
      {children}
    </span>
  );
}
