import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';

import { AppProvider, useApp }   from './context/AppContext.jsx';
import { ThemeProvider }          from './context/ThemeContext.jsx';
import LoginPage                  from './pages/LoginPage.jsx';
import ApiKeysPage                from './pages/ApiKeysPage.jsx';
import CrmPage                    from './pages/CrmPage.jsx';
import SettingsPage               from './pages/SettingsPage.jsx';
import Toast                      from './components/ui/Toast.jsx';
import Spinner                    from './components/ui/Spinner.jsx';
import ThemeBackground            from './components/ThemeBackground.jsx';

// ---------------------------------------------------------------------------
// ProtectedRoute — only renders children when the user is authenticated
// ---------------------------------------------------------------------------
function ProtectedRoute({ children }) {
  const { user } = useApp();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// ---------------------------------------------------------------------------
// AppShell — handles the auth-check on mount, then renders routes
// ---------------------------------------------------------------------------
function AppShell() {
  const { setUser, toasts, removeToast } = useApp();
  const navigate  = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/crm/me', { credentials: 'include' })
      .then((res) => {
        if (res.status === 401) {
          navigate('/login', { replace: true });
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setUser(data);
      })
      .catch(() => {
        navigate('/login', { replace: true });
      })
      .finally(() => {
        setLoading(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100dvh',
        }}
      >
        <Spinner size={40} />
      </div>
    );
  }

  return (
    <>
      <ThemeBackground />

      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/api-keys"
          element={
            <ProtectedRoute>
              <ApiKeysPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <CrmPage />
            </ProtectedRoute>
          }
        />

        {/* Catch-all — redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Global toast stack */}
      <Toast toasts={toasts} removeToast={removeToast} />
    </>
  );
}

// ---------------------------------------------------------------------------
// App — wraps everything in the global context provider
// ---------------------------------------------------------------------------
export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <AppShell />
      </AppProvider>
    </ThemeProvider>
  );
}
