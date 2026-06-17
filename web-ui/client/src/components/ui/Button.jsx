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
    background: '#1A6AB4',
    color: '#fff',
    border: '1px solid #155a97',
  },
  ghost: {
    background: 'transparent',
    color: 'oklch(0.400 0.013 68)',
    border: '1px solid oklch(0.910 0.011 68)',
  },
  danger: {
    background: 'oklch(0.930 0.034 25)',
    color: 'oklch(0.440 0.165 25)',
    border: '1px solid oklch(0.930 0.034 25)',
  },
  warn: {
    background: 'rgba(61,199,179,0.12)',
    color: '#31a593',
    border: '1px solid rgba(61,199,179,0.30)',
  },
  success: {
    background: 'rgba(45,179,122,0.12)',
    color: '#2DB37A',
    border: '1px solid rgba(45,179,122,0.30)',
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
