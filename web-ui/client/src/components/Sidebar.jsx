import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Spinner from './ui/Spinner';

// ---------------------------------------------------------------------------
// Helper: avatar initials from a name or email
// ---------------------------------------------------------------------------
const AVATAR_PALETTE = ['#1A6AB4', '#3DC7B3', '#0D1F4E', '#2DB37A', '#155a97', '#31a593'];

function initials(name, email) {
  const src = name || email || '?';
  const parts = src.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return src[0].toUpperCase();
}

function avatarColor(email) {
  const str = email || '';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AvatarCircle({ name, email, size = 32, className = '' }) {
  const letter = initials(name, email);
  const bg = avatarColor(email || name || '');
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.4),
        fontWeight: 700,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {letter}
    </span>
  );
}

// Three skeleton placeholder rows that pulse
function SkeletonList() {
  return (
    <ul aria-busy="true" aria-label="Loading customers" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="animate-pulse"
          style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {/* Avatar placeholder */}
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'var(--border)',
              flexShrink: 0,
            }}
          />
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span
              style={{
                height: 11,
                width: `${60 + i * 12}%`,
                borderRadius: 4,
                background: 'var(--border)',
                display: 'block',
              }}
            />
            <span
              style={{
                height: 9,
                width: `${40 + i * 8}%`,
                borderRadius: 4,
                background: 'var(--border)',
                display: 'block',
                opacity: 0.7,
              }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

// A single customer row
function CustomerRow({ customer, isActive, onClick }) {
  const pendingCount = useMemo(
    () => (customer.followUps || []).filter((f) => f.status === 'pending').length,
    [customer.followUps]
  );

  const unreadCount = useMemo(
    () => (customer.receivedEmails || []).filter((e) => !e.isRead).length,
    [customer.receivedEmails]
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <li
      role="listitem"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      aria-label={`${customer.name || customer.email}${pendingCount ? `, ${pendingCount} pending follow-up${pendingCount !== 1 ? 's' : ''}` : ''}`}
      aria-current={isActive ? 'true' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        cursor: 'pointer',
        borderBottom: '1px solid var(--border)',
        borderLeft: isActive ? '3px solid var(--brand-primary, #1A6AB4)' : '3px solid transparent',
        background: isActive ? 'var(--brand-primary-bg, rgba(26,106,180,0.08))' : 'transparent',
        outline: 'none',
        userSelect: 'none',
      }}
    >
      <AvatarCircle name={customer.name} email={customer.email} size={32} />

      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {customer.name || customer.email}
        </span>
        {customer.company && (
          <span
            style={{
              display: 'block',
              fontSize: 13.5,
              color: 'var(--text-3)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginTop: 1,
            }}
          >
            {customer.company}
          </span>
        )}
      </span>

      {/* Badges */}
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
        {pendingCount > 0 && (
          <span
            aria-label={`${pendingCount} pending follow-up${pendingCount !== 1 ? 's' : ''}`}
            style={{
              fontSize: 12,
              fontWeight: 700,
              lineHeight: 1,
              padding: '2px 5px',
              borderRadius: 999,
              background: 'var(--amber-5)',
              color: '#fff',
              whiteSpace: 'nowrap',
            }}
          >
            {pendingCount} fu
          </span>
        )}
        {unreadCount > 0 && (
          <span
            aria-label={`${unreadCount} unread email${unreadCount !== 1 ? 's' : ''}`}
            style={{
              fontSize: 12,
              fontWeight: 700,
              lineHeight: 1,
              padding: '2px 5px',
              borderRadius: 999,
              background: 'var(--blue-bg, oklch(0.930 0.034 240))',
              color: 'var(--blue-7)',
              whiteSpace: 'nowrap',
            }}
          >
            {unreadCount}
          </span>
        )}
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main Sidebar
// ---------------------------------------------------------------------------
export default function Sidebar({ onOpenImportModal, onOpenAddCustomerModal }) {
  const {
    user,
    customers,
    activeCustomer,
    openCustomer,
    loadCustomers,
    addToast,
  } = useApp();

  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  // Close profile popover on outside click
  useEffect(() => {
    if (!profileOpen) return;
    function handler(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileOpen]);

  // Derived: filtered list
  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const lq = search.toLowerCase();
    return customers.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(lq) ||
        c.email.toLowerCase().includes(lq) ||
        (c.company || '').toLowerCase().includes(lq)
    );
  }, [customers, search]);

  // Loading state: customers is null means still loading (initial fetch not done)
  const isLoading = customers === null;

  // Sync inbox
  const handleSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/crm/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        if (data?.redirect) {
          window.location.href = data.redirect;
          return;
        }
        addToast('error', 'Sync failed: ' + (data?.error || 'Unknown error'));
        return;
      }
      const total = (data.inbox || 0) + (data.sent || 0);
      addToast(
        'success',
        total > 0
          ? `Synced: ${data.inbox || 0} received, ${data.sent || 0} sent`
          : 'Already up to date'
      );
      await loadCustomers();
    } catch (err) {
      addToast('error', 'Sync error: ' + err.message);
    } finally {
      setSyncing(false);
    }
  }, [syncing, loadCustomers, addToast]);

  const handleCustomerClick = useCallback(
    (email) => {
      openCustomer(email);
    },
    [openCustomer]
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <aside
      role="navigation"
      aria-label="Customer list"
      style={{
        width: 248,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
        overflow: 'hidden',
      }}
    >
      {/* ── Topbar ─────────────────────────────────────────────────────── */}
      <header
        style={{
          padding: '12px 14px 10px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        {/* Wordmark row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-display, Satoshi, system-ui, sans-serif)',
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--text)',
              letterSpacing: '-0.01em',
            }}
          >
            Mail Draft{' '}
            <span style={{ color: 'var(--amber-5)', fontWeight: 800 }}>CRM</span>
          </span>
        </div>

        {/* Action row: Sync + Import + Add */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* Sync */}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="sb-sync-btn"
            aria-label="Sync inbox emails"
            style={{ cursor: syncing ? 'not-allowed' : 'pointer' }}
          >
            {syncing ? (
              <Spinner size={12} />
            ) : (
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="1 4 1 10 7 10" />
                <polyline points="23 20 23 14 17 14" />
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
              </svg>
            )}
            {syncing ? 'Syncing…' : 'Sync'}
          </button>

          {/* Import */}
          <button
            onClick={onOpenImportModal}
            className="sb-import-btn"
            aria-label="Import customers from Excel or CSV"
            title="Import customers from Excel / CSV"
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Import
          </button>

          {/* Add customer */}
          <button
            onClick={onOpenAddCustomerModal}
            className="sb-add-btn"
            aria-label="Add customer"
            title="Add customer"
          >
            +
          </button>
        </div>
      </header>

      {/* ── Search ─────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '8px 10px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <label className="sb-search-box">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ color: 'var(--text-3)', flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers…"
            aria-label="Search customers"
            autoComplete="off"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 14.5,
              color: 'var(--text)',
            }}
          />
        </label>
      </div>

      {/* ── Section label ──────────────────────────────────────────────── */}
      <div
        style={{
          padding: '6px 14px 4px',
          fontSize: 12.5,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--text-3)',
          flexShrink: 0,
        }}
      >
        Customers
        {!isLoading && customers !== null && (
          <span style={{ fontWeight: 500, marginLeft: 5, textTransform: 'none', letterSpacing: 0 }}>
            ({customers.length})
          </span>
        )}
      </div>

      {/* ── Customer list (scrollable) ──────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading ? (
          <SkeletonList />
        ) : filtered.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <div aria-hidden="true" style={{ fontSize: 28, marginBottom: 10, opacity: 0.4 }}>👤</div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>
              {search.trim() ? 'No results found' : 'No customers yet'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
              {search.trim()
                ? 'Try a different name, email, or company.'
                : 'Click + to add your first customer, or import from Excel / CSV.'}
            </p>
          </div>
        ) : (
          <ul role="list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {filtered.map((c) => (
              <CustomerRow
                key={c.email}
                customer={c}
                isActive={activeCustomer?.email === c.email}
                onClick={() => handleCustomerClick(c.email)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* ── User profile footer (ChatGPT-style) ────────────────────────── */}
      {user && (
        <div
          ref={profileRef}
          style={{ position: 'relative', borderTop: '1px solid var(--border)', flexShrink: 0 }}
        >
          {/* Popover menu */}
          {profileOpen && (
            <div className="profile-popover">
              <button
                className="profile-menu-item"
                onClick={() => { setProfileOpen(false); navigate('/settings'); }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
                </svg>
                Settings
              </button>
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              <a
                href="/crm/auth/logout"
                className="profile-menu-item profile-menu-danger"
                onClick={() => setProfileOpen(false)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Log out
              </a>
            </div>
          )}

          {/* Profile trigger button */}
          <button
            className="profile-footer-btn"
            onClick={() => setProfileOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={profileOpen}
          >
            <AvatarCircle name={user.displayName || user.name} email={user.email} size={32} />
            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <div style={{
                fontSize: 14.5,
                fontWeight: 600,
                color: 'var(--text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {user.displayName || user.name || user.email}
              </div>
              <div style={{
                fontSize: 13,
                color: 'var(--text-3)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {user.email}
              </div>
            </div>
            {/* Ellipsis icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ color: 'var(--text-3)', flexShrink: 0 }}>
              <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
            </svg>
          </button>
        </div>
      )}
    </aside>
  );
}
