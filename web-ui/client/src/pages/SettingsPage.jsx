import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme, THEMES } from '../context/ThemeContext.jsx';

export default function SettingsPage() {
  const { theme: activeTheme, setTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="settings-page">
      {/* Header */}
      <div className="settings-header">
        <button
          className="settings-back"
          onClick={() => navigate('/')}
          aria-label="Back to CRM"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M11.354 1.646a.5.5 0 010 .708L5.707 8l5.647 5.646a.5.5 0 01-.708.708l-6-6a.5.5 0 010-.708l6-6a.5.5 0 01.708 0z"/>
          </svg>
          Back
        </button>
        <h1 className="settings-title">Settings</h1>
      </div>

      <div className="settings-body">
        {/* Background section */}
        <section className="settings-section">
          <h2 className="settings-section-title">Background Theme</h2>
          <p className="settings-section-desc">
            Choose the background style for your workspace.
          </p>

          <div className="theme-grid">
            {Object.values(THEMES).map((t) => (
              <button
                key={t.key}
                className={`theme-card${activeTheme === t.key ? ' active' : ''}`}
                onClick={() => setTheme(t.key)}
                aria-pressed={activeTheme === t.key}
              >
                {/* Preview */}
                <div className="theme-preview">
                  {t.preview ? (
                    <img
                      src={t.preview}
                      alt={t.label}
                      className="theme-preview-img"
                    />
                  ) : (
                    <div className="theme-preview-default" />
                  )}
                  {activeTheme === t.key && (
                    <span className="theme-check" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/>
                      </svg>
                    </span>
                  )}
                </div>

                {/* Label */}
                <div className="theme-label">
                  <span className="theme-name">{t.label}</span>
                  <span className="theme-desc">{t.description}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
