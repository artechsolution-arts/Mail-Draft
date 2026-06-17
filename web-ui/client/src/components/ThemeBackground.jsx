import React from 'react';
import { useTheme, THEMES } from '../context/ThemeContext.jsx';

export default function ThemeBackground() {
  const { theme } = useTheme();
  const t = THEMES[theme];

  if (!t?.bgImage) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        background: t.bgFallback,
        pointerEvents: 'none',
      }}
    >
      <img
        src={t.bgImage}
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: t.bgOverlay,
        }}
      />
    </div>
  );
}
