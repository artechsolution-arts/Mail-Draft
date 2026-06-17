import React, { useEffect } from 'react';

/**
 * Toast — fixed bottom-right notification stack.
 *
 * Props:
 *   toasts     : Array<{ id, type ('success'|'error'|'info'), message, duration? }>
 *   removeToast: (id) => void
 *
 * Each toast auto-removes after `duration` ms (default 4000).
 */

const TYPE_STYLES = {
  success: {
    background: 'oklch(0.930 0.042 155)',  // --green-100
    color:      'oklch(0.440 0.140 155)',  // --green-700
    border:     '1px solid oklch(0.440 0.140 155 / 0.25)',
    icon: '✓',
  },
  error: {
    background: 'oklch(0.930 0.034 25)',   // --red-100
    color:      'oklch(0.440 0.165 25)',   // --red-700
    border:     '1px solid oklch(0.440 0.165 25 / 0.25)',
    icon: '✕',
  },
  info: {
    background: 'rgba(26,106,180,0.10)',
    color:      '#1A6AB4',
    border:     '1px solid rgba(26,106,180,0.25)',
    icon: 'ℹ',
  },
};

const DEFAULT_DURATION = 4000;

function ToastItem({ toast, removeToast }) {
  const typeStyle = TYPE_STYLES[toast.type] || TYPE_STYLES.info;

  useEffect(() => {
    const timer = setTimeout(
      () => removeToast(toast.id),
      toast.duration ?? DEFAULT_DURATION,
    );
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, removeToast]);

  return (
    <>
      <style>{`
        @keyframes toast-slide-in {
          from { opacity: 0; transform: translateX(24px) scale(0.96); }
          to   { opacity: 1; transform: translateX(0)   scale(1); }
        }
        .ui-toast-item {
          animation: toast-slide-in 0.22s cubic-bezier(0.34, 1.3, 0.64, 1);
        }
      `}</style>
      <div
        className="ui-toast-item"
        role="alert"
        aria-live="assertive"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          minWidth: '280px',
          maxWidth: '380px',
          padding: '12px 14px',
          borderRadius: '10px',
          boxShadow: '0 4px 16px oklch(0.16 0.010 68 / 0.13), 0 1px 4px oklch(0.16 0.010 68 / 0.08)',
          fontFamily: "'Satoshi', system-ui, sans-serif",
          fontSize: '13px',
          lineHeight: 1.5,
          ...typeStyle,
        }}
      >
        {/* Icon */}
        <span
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: typeStyle.color,
            color: typeStyle.background,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 700,
            flexShrink: 0,
            marginTop: '1px',
          }}
        >
          {typeStyle.icon}
        </span>

        {/* Message */}
        <span style={{ flex: 1, color: typeStyle.color, fontWeight: 500 }}>
          {toast.message}
        </span>

        {/* Close button */}
        <button
          onClick={() => removeToast(toast.id)}
          aria-label="Close notification"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: typeStyle.color,
            opacity: 0.6,
            fontSize: '14px',
            lineHeight: 1,
            padding: '0 2px',
            flexShrink: 0,
            marginTop: '1px',
            transition: 'opacity 0.12s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
        >
          ✕
        </button>
      </div>
    </>
  );
}

export default function Toast({ toasts = [], removeToast }) {
  if (!toasts.length) return null;

  return (
    <div
      aria-label="Notifications"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        alignItems: 'flex-end',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} style={{ pointerEvents: 'auto' }}>
          <ToastItem toast={toast} removeToast={removeToast} />
        </div>
      ))}
    </div>
  );
}
