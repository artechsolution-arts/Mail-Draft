import React from 'react';

/**
 * Badge — colored status pill matching crm.html .status-pill styles.
 *
 * variant: 'pending' | 'sent' | 'rejected' | 'escalated' | 'generating' | 'success' | 'error'
 */

const VARIANT_STYLES = {
  pending: {
    background: 'rgba(26,106,180,0.10)',
    color:      '#1A6AB4',
  },
  sent: {
    background: 'rgba(45,179,122,0.14)',
    color:      '#2DB37A',
  },
  success: {
    background: 'rgba(45,179,122,0.14)',
    color:      '#2DB37A',
  },
  rejected: {
    background: 'oklch(0.930 0.034 25)',  // --red-100
    color:      'oklch(0.440 0.165 25)',  // --red-700
  },
  error: {
    background: 'oklch(0.930 0.034 25)',  // --red-100
    color:      'oklch(0.440 0.165 25)',  // --red-700
  },
  escalated: {
    background: 'oklch(0.930 0.034 240)', // --blue-100
    color:      'oklch(0.440 0.140 240)', // --blue-700
  },
  generating: {
    background: 'oklch(0.958 0.007 68)',  // --stone-100
    color:      'oklch(0.400 0.013 68)',  // --stone-700
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
