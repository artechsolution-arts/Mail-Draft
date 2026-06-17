import React, { useEffect, useRef, useCallback } from 'react';

/**
 * Modal — overlay + centered card with scale-in animation.
 *
 * Props:
 *   open      : boolean
 *   onClose   : () => void
 *   title     : string
 *   children  : ReactNode
 *   maxWidth  : 'sm' | 'md' | 'lg'
 */

const MAX_WIDTHS = {
  sm: '400px',
  md: '560px',
  lg: '720px',
};

export default function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 'md',
}) {
  const overlayRef = useRef(null);
  const firstFocusRef = useRef(null);

  // Escape key closes modal
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose?.();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    // Lock body scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Auto-focus first focusable element
    const el = overlayRef.current;
    if (el) {
      const focusable = el.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length) {
        firstFocusRef.current = document.activeElement;
        focusable[0].focus();
      }
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prev;
      if (firstFocusRef.current) {
        try { firstFocusRef.current.focus(); } catch (_) { /* ignore */ }
      }
    };
  }, [open, handleKeyDown]);

  // Click-outside closes
  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose?.();
  }

  if (!open) return null;

  return (
    <>
      <style>{`
        @keyframes ui-modal-overlay-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes ui-modal-card-in {
          from { opacity: 0; transform: scale(0.94) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }
        .ui-modal-overlay {
          animation: ui-modal-overlay-in 0.18s ease;
        }
        .ui-modal-card {
          animation: ui-modal-card-in 0.22s cubic-bezier(0.34, 1.3, 0.64, 1);
        }
        .ui-modal-close-btn:hover {
          background: oklch(0.910 0.011 68) !important;
          color: oklch(0.160 0.010 68) !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .ui-modal-overlay, .ui-modal-card { animation: none; }
        }
      `}</style>

      {/* Overlay */}
      <div
        ref={overlayRef}
        className="ui-modal-overlay"
        onClick={handleOverlayClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'ui-modal-title' : undefined}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          background: 'oklch(0.16 0.010 68 / 0.40)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        {/* Card */}
        <div
          className="ui-modal-card"
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'oklch(0.988 0.004 68)',
            borderRadius: '14px',
            boxShadow:
              '0 20px 40px oklch(0.16 0.010 68 / 0.18), 0 4px 12px oklch(0.16 0.010 68 / 0.10)',
            border: '1px solid oklch(0.910 0.011 68)',
            width: '100%',
            maxWidth: MAX_WIDTHS[maxWidth] || MAX_WIDTHS.md,
            maxHeight: 'calc(100vh - 48px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 22px 16px',
              borderBottom: '1px solid oklch(0.910 0.011 68)',
              flexShrink: 0,
            }}
          >
            {title && (
              <h2
                id="ui-modal-title"
                style={{
                  fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
                  fontSize: '16px',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: 'oklch(0.160 0.010 68)',
                  margin: 0,
                }}
              >
                {title}
              </h2>
            )}

            {/* Close button */}
            <button
              className="ui-modal-close-btn"
              onClick={onClose}
              aria-label="Close modal"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                border: 'none',
                background: 'transparent',
                color: 'oklch(0.570 0.014 68)',
                fontSize: '15px',
                cursor: 'pointer',
                transition: 'background 0.12s, color 0.12s',
                flexShrink: 0,
                marginLeft: 'auto',
              }}
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '22px',
              fontFamily: "'Satoshi', system-ui, sans-serif",
              fontSize: '13.5px',
              color: 'oklch(0.160 0.010 68)',
              lineHeight: 1.6,
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
