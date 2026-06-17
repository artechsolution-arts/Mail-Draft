import React from 'react';

/**
 * Spinner — 16 px rotating circle, inherits color from parent.
 * Usage: <Spinner /> or <Spinner size={20} />
 */
export default function Spinner({ size = 16, className = '' }) {
  return (
    <span
      className={`ui-spinner ${className}`}
      style={{ width: size, height: size }}
      aria-label="Loading"
      role="status"
    >
      <style>{`
        @keyframes ui-spin {
          to { transform: rotate(360deg); }
        }
        .ui-spinner {
          display: inline-block;
          border-radius: 50%;
          border: 2px solid currentColor;
          border-top-color: transparent;
          animation: ui-spin 0.7s linear infinite;
          flex-shrink: 0;
        }
      `}</style>
    </span>
  );
}
