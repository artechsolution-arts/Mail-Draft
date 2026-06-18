import React from 'react';
import Spinner from './Spinner';

/**
 * Button — design-system primitive.
 *
 * variant : 'primary' | 'ghost' | 'danger' | 'warn' | 'success'
 * size    : 'sm' | 'md'
 */

const VARIANT_STYLES = {
  primary: {
    background: 'var(--brand-primary)',
    color: '#fff',
    border: '1px solid var(--brand-primary-dark)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-2)',
    border: '1px solid var(--border)',
  },
  danger: {
    background: 'var(--red-bg)',
    color: 'var(--red-7)',
    border: '1px solid var(--red-7)',
  },
  warn: {
    background: 'rgba(61,199,179,0.12)',
    color: 'var(--brand-teal-dark)',
    border: '1px solid rgba(61,199,179,0.30)',
  },
  success: {
    background: 'var(--green-bg)',
    color: 'var(--green-7)',
    border: '1px solid var(--green-7)',
  },
};

const SIZE_STYLES = {
  sm: { fontSize: '12px', padding: '6px 12px', borderRadius: '5px' },
  md: { fontSize: '13px', padding: '8px 16px',  borderRadius: '8px' },
};

export default function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  children,
  className = '',
  type = 'button',
  ...rest
}) {
  const variantStyle = VARIANT_STYLES[variant] || VARIANT_STYLES.primary;
  const sizeStyle    = SIZE_STYLES[size]       || SIZE_STYLES.md;

  const isDisabled = disabled || loading;

  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontFamily: "'Satoshi', system-ui, sans-serif",
    fontWeight: 600,
    lineHeight: 1,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.5 : 1,
    transition: 'opacity 0.15s, box-shadow 0.15s, transform 0.1s',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    ...variantStyle,
    ...sizeStyle,
  };

  function handleClick(e) {
    if (isDisabled) return;
    onClick?.(e);
  }

  return (
    <button
      type={type}
      style={style}
      disabled={isDisabled}
      onClick={handleClick}
      className={`ui-btn ui-btn--${variant} ui-btn--${size} ${className}`}
      {...rest}
    >
      {loading && <Spinner size={size === 'sm' ? 12 : 14} />}
      {children}
    </button>
  );
}
