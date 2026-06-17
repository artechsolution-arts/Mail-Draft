import React, { createContext, useContext, useEffect, useState } from 'react';

// ── Theme definitions ──────────────────────────────────────────────────────────
export const THEMES = {
  default: {
    key: 'default',
    label: 'Default',
    description: 'Clean warm-white',
    preview: null,
    dark: false,
  },
  light: {
    key: 'light',
    label: 'Soft Faded Light',
    description: 'Airy blue-tinted background',
    preview: '/themes/lighttheme.jpg',
    dark: false,
    bgImage: '/themes/lighttheme.jpg',
    bgOverlay: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(240,246,255,0.14) 100%)',
    bgFallback: '#EEF3FC',
  },
  dark: {
    key: 'dark',
    label: 'Dark',
    description: 'Deep space dark mode',
    preview: '/themes/darktheme.png',
    dark: true,
    bgImage: '/themes/darktheme.png',
    bgOverlay: 'linear-gradient(180deg, rgba(8,10,24,0.50) 0%, rgba(6,8,20,0.68) 100%)',
    bgFallback: '#081428',
  },
};

const ThemeContext = createContext(null);

function applyTheme(key) {
  document.documentElement.setAttribute('data-theme', key);
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('crm-theme') || 'default';
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function setTheme(key) {
    localStorage.setItem('crm-theme', key);
    setThemeState(key);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
