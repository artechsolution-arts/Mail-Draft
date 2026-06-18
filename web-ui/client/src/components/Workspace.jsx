import React, { useState, useCallback } from 'react';
import { useApp } from '../context/AppContext.jsx';

import EmailsTab    from './tabs/EmailsTab.jsx';
import DraftsTab    from './tabs/DraftsTab.jsx';
import NotesTab     from './tabs/NotesTab.jsx';
import QuotationsTab from './tabs/QuotationsTab.jsx';
import FollowUpsTab from './tabs/FollowUpsTab.jsx';

import AddCustomerModal from './modals/AddCustomerModal.jsx';
import ComposeModal     from './modals/ComposeModal.jsx';
import EscalateModal    from './modals/EscalateModal.jsx';

// ─── helpers ──────────────────────────────────────────────────────────────────

function initials(name, email) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name[0].toUpperCase();
  }
  return (email || '?')[0].toUpperCase();
}

function sinceLabel(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

const AVATAR_PALETTE = ['#1A6AB4', '#3DC7B3', '#0D1F4E', '#2DB37A', '#155a97', '#31a593'];
function avatarColor(email) {
  const str = email || '';
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 32px',
        color: 'var(--text-3)',
        userSelect: 'none',
      }}
    >
      {/* Abstract illustration using layered SVG circles + envelope silhouette */}
      <svg
        width="96"
        height="96"
        viewBox="0 0 96 96"
        fill="none"
        aria-hidden="true"
        style={{ marginBottom: 24, opacity: 0.55 }}
      >
        <circle cx="48" cy="48" r="46" stroke="var(--border-mid)" strokeWidth="1.5" />
        <circle cx="48" cy="48" r="34" fill="var(--stone-100)" />
        {/* envelope */}
        <rect x="26" y="35" width="44" height="28" rx="4" fill="var(--stone-200)" />
        <path
          d="M26 39 L48 55 L70 39"
          stroke="var(--stone-300)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        {/* dot decoration */}
        <circle cx="74" cy="26" r="7" fill="rgba(26,106,180,0.12)" stroke="rgba(26,106,180,0.22)" strokeWidth="1.5" />
        <circle cx="22" cy="68" r="5" fill="rgba(61,199,179,0.12)" stroke="rgba(61,199,179,0.22)" strokeWidth="1.5" />
      </svg>

      <p
        style={{
          fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
          fontSize: 17,
          fontWeight: 600,
          color: 'var(--text-2)',
          marginBottom: 6,
          textAlign: 'center',
        }}
      >
        Select a customer from the sidebar
      </p>
      <p style={{ fontSize: 13, textAlign: 'center', maxWidth: 260, lineHeight: 1.6 }}>
        Choose a contact to view their emails, notes, quotations and follow-ups.
      </p>
    </div>
  );
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ svgIcon, value, label, accentClass, hasPending, onClick }) {
  return (
    <button
      className={`stat-card ${accentClass}${hasPending ? ' has-pending' : ''}`}
      onClick={onClick}
      type="button"
    >
      <div className={`stat-icon-circle ${accentClass}`}>{svgIcon}</div>
      <div className="stat-body">
        <div className={`stat-num${hasPending ? ' warn' : ''}`}>{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </button>
  );
}

// SVG icons for stats
const ICON_INBOX = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
    <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/>
  </svg>
);
const ICON_SEND = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);
const ICON_CLOCK = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);
const ICON_NOTE = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);

// ─── Tab bar ───────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'emails',      label: (c) => `Emails (${(c.receivedEmails||[]).length + (c.sentEmails||[]).length})` },
  { id: 'drafts',      label: () => 'Drafts' },
  { id: 'notes',       label: (c) => `Notes (${(c.notes||[]).length})` },
  { id: 'quotations',  label: (c) => `Quotations (${(c.quotations||[]).length})` },
  { id: 'follow-ups',  label: (c) => { const n = (c.followUps||[]).filter(f=>f.status==='pending').length; return `Follow-ups${n>0?' ('+n+')':''}`; } },
];

// ─── Workspace ─────────────────────────────────────────────────────────────────

export default function Workspace() {
  const { activeCustomer, refreshActiveCustomer, openCustomer } = useApp();

  const [activeTab, setActiveTab]         = useState('emails');
  const [showEdit, setShowEdit]           = useState(false);
  const [showCompose, setShowCompose]     = useState(false);
  const [showEscalate, setShowEscalate]   = useState(false);

  const handleRefresh = useCallback(async () => {
    await refreshActiveCustomer();
  }, [refreshActiveCustomer]);

  const switchTab = useCallback((id) => setActiveTab(id), []);

  if (!activeCustomer) {
    return (
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'transparent',
        }}
      >
        <EmptyState />
      </main>
    );
  }

  const c = activeCustomer;
  const pendingFU = (c.followUps || []).filter((f) => f.status === 'pending').length;

  // ── Render active tab content ──────────────────────────────────────────────
  function renderTab() {
    switch (activeTab) {
      case 'emails':
        return <EmailsTab customer={c} />;
      case 'drafts':
        return <DraftsTab customer={c} />;
      case 'notes':
        return <NotesTab customer={c} onRefresh={handleRefresh} />;
      case 'quotations':
        return <QuotationsTab customer={c} onRefresh={handleRefresh} />;
      case 'follow-ups':
        return <FollowUpsTab customer={c} onRefresh={handleRefresh} />;
      default:
        return null;
    }
  }

  return (
    <main
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'transparent',
        minWidth: 0,
      }}
    >
      {/* ── Customer header ─────────────────────────────────────────────── */}
      <header className="ws-header">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          {/* Avatar */}
          <div
            className="ws-avatar"
            aria-hidden="true"
            style={{ background: avatarColor(c.email) }}
          >
            {initials(c.name, c.email)}
          </div>

          {/* Name + meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
              <h1 className="ws-customer-name">{c.name || c.email}</h1>
              {c.company && (
                <span className="ws-company-badge">{c.company}</span>
              )}
            </div>
            <div className="ws-customer-meta">
              {c.email && (
                <span className="ws-meta-item">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  {c.email}
                </span>
              )}
              {c.phone && (
                <span className="ws-meta-item">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.1 1.18 2 2 0 012.1 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.72 6.72l1.28-.44a2 2 0 012.11.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                  {c.phone}
                </span>
              )}
              {c.customerSince && (
                <span className="ws-meta-item ws-meta-since">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  Since {sinceLabel(c.customerSince)}
                </span>
              )}
            </div>
          </div>

          {/* Action cards — stat-card style */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 'auto' }}>
            <button
              className="action-card ac-edit"
              onClick={() => setShowEdit(true)}
              type="button"
              aria-label="Edit customer"
            >
              <div className="action-icon-circle ac-edit">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M12.854.146a.5.5 0 00-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 000-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 01.5.5v.5h.5a.5.5 0 01.5.5v.5h.5a.5.5 0 01.5.5v.5h.5a.5.5 0 01.5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 016 13.5V13h-.5a.5.5 0 01-.5-.5V12h-.5a.5.5 0 01-.5-.5V11h-.5a.5.5 0 01-.5-.5V10h-.5a.499.499 0 01-.175-.032l-.179.178a.5.5 0 00-.11.168l-2 5a.5.5 0 00.65.65l5-2a.5.5 0 00.168-.11l.178-.178z"/>
                </svg>
              </div>
              <span className="action-label">Edit</span>
            </button>
            <button
              className="action-card ac-escalate"
              onClick={() => setShowEscalate(true)}
              type="button"
              aria-label="Delegate customer"
            >
              <div className="action-icon-circle ac-escalate">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <span className="action-label">Delegate</span>
            </button>
            <button
              className="action-card ac-compose"
              onClick={() => setShowCompose(true)}
              type="button"
              aria-label="Compose email"
            >
              <div className="action-icon-circle ac-compose">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M15.502 1.94a.5.5 0 010 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 01.707 0l1.293 1.293zm-1.75 2.456l-2-2L4.939 9.21a.5.5 0 00-.121.196l-.805 2.414a.25.25 0 00.316.316l2.414-.805a.5.5 0 00.196-.12l6.813-6.814z"/>
                  <path fillRule="evenodd" d="M1 13.5A1.5 1.5 0 002.5 15h11a1.5 1.5 0 001.5-1.5v-6a.5.5 0 00-1 0v6a.5.5 0 01-.5.5h-11a.5.5 0 01-.5-.5v-11a.5.5 0 01.5-.5H9a.5.5 0 000-1H2.5A1.5 1.5 0 001 2.5v11z"/>
                </svg>
              </div>
              <span className="action-label">Compose</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Stats row ───────────────────────────────────────────────────── */}
      <div className="stats-strip">
        <StatCard
          svgIcon={ICON_INBOX}
          value={(c.receivedEmails || []).length}
          label="Received"
          accentClass="sc-received"
          onClick={() => switchTab('emails')}
        />
        <StatCard
          svgIcon={ICON_SEND}
          value={(c.sentEmails || []).length}
          label="Sent"
          accentClass="sc-sent"
          onClick={() => switchTab('emails')}
        />
        <StatCard
          svgIcon={ICON_CLOCK}
          value={pendingFU}
          label="Follow-ups"
          accentClass="sc-followups"
          hasPending={pendingFU > 0}
          onClick={() => switchTab('follow-ups')}
        />
        <StatCard
          svgIcon={ICON_NOTE}
          value={(c.notes || []).length}
          label="Notes"
          accentClass="sc-notes"
          onClick={() => switchTab('notes')}
        />
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <nav
        className="ws-tabs"
        role="tablist"
        aria-label="Customer sections"
        style={{ flexShrink: 0 }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`ws-pane-${tab.id}`}
            id={`ws-tab-${tab.id}`}
            className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => switchTab(tab.id)}
          >
            {tab.label(c)}
          </button>
        ))}
      </nav>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      <div
        className="ws-body"
        id={`ws-pane-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`ws-tab-${activeTab}`}
        style={{ flex: 1, overflowY: 'auto', padding: '24px' }}
      >
        {renderTab()}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <AddCustomerModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        editCustomer={c}
        onSaved={() => openCustomer(c.email)}
      />

      <ComposeModal
        open={showCompose}
        onClose={() => setShowCompose(false)}
        customer={c}
        onSent={handleRefresh}
      />

      <EscalateModal
        open={showEscalate}
        onClose={() => setShowEscalate(false)}
        customer={c}
        onEscalated={() => { setShowEscalate(false); handleRefresh(); }}
      />
    </main>
  );
}
