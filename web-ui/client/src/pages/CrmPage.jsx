import React, { useEffect, useCallback, useState } from 'react';

import { useApp }              from '../context/AppContext.jsx';
import { useSSE }              from '../hooks/useSSE.js';

import Sidebar                 from '../components/Sidebar.jsx';
import Workspace               from '../components/Workspace.jsx';
import NotificationPanel       from '../components/NotificationPanel.jsx';
import ChatPanel               from '../components/ChatPanel.jsx';
import AddCustomerModal        from '../components/modals/AddCustomerModal.jsx';
import ImportModal             from '../components/modals/ImportModal.jsx';

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------
const GRID_STYLE = {
  display: 'grid',
  gridTemplateColumns: '248px 1fr 300px',
  height: '100dvh',
  overflow: 'hidden',
  background: 'transparent',
};

const RIGHT_PANEL_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
  borderLeft: '1px solid var(--border)',
  background: 'var(--bg-sidebar)',
  padding: '0 0 12px',
  gap: 0,
};

// ---------------------------------------------------------------------------
// CrmPage — main 3-column layout
// ---------------------------------------------------------------------------
export default function CrmPage() {
  const {
    loadCustomers,
    loadNotifications,
    refreshActiveCustomer,
    addToast,
  } = useApp();

  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showImport,      setShowImport]      = useState(false);

  // Load initial data on mount
  useEffect(() => {
    loadCustomers();
    loadNotifications();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // SSE callbacks — stable references via useCallback
  const handleNewEmail = useCallback(() => {
    refreshActiveCustomer();
    loadNotifications();
    addToast('info', 'New email received');
  }, [refreshActiveCustomer, loadNotifications, addToast]);

  const handleDraftReady = useCallback(() => {
    refreshActiveCustomer();
    addToast('info', 'New AI draft ready');
  }, [refreshActiveCustomer, addToast]);

  const handleSyncDone = useCallback(() => {
    loadCustomers();
  }, [loadCustomers]);

  useSSE({
    onNewEmail:   handleNewEmail,
    onDraftReady: handleDraftReady,
    onSyncDone:   handleSyncDone,
  });

  return (
    <>
      <div style={GRID_STYLE}>
        {/* Left column — navigation & customer list */}
        <Sidebar
          onOpenAddCustomerModal={() => setShowAddCustomer(true)}
          onOpenImportModal={() => setShowImport(true)}
        />

        {/* Centre column — customer detail workspace */}
        <Workspace />

        {/* Right column — notifications above chat */}
        <div style={RIGHT_PANEL_STYLE}>
          <NotificationPanel style={{ flex: 1, overflowY: 'auto' }} />
          <div style={{ padding: '0 12px 0', flexShrink: 0 }}>
            <ChatPanel />
          </div>
        </div>
      </div>

      <AddCustomerModal
        open={showAddCustomer}
        onClose={() => setShowAddCustomer(false)}
        onSaved={() => { setShowAddCustomer(false); loadCustomers(); }}
      />

      <ImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => { setShowImport(false); loadCustomers(); }}
      />
    </>
  );
}
