import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiKeys, createApiKey, revokeApiKey } from '../api.js';

const ENDPOINTS = [
  ['GET',    '/v1/customers',                       'List all CRM customers'],
  ['POST',   '/v1/customers',                       'Create / update customer — body: { email*, name, company, phone }'],
  ['GET',    '/v1/customers/:email',                'Get one customer with full history'],
  ['PATCH',  '/v1/customers/:email',                'Update fields — body: { name, company, phone, aiSummary }'],
  ['DELETE', '/v1/customers/:email',                'Delete customer'],
  ['GET',    '/v1/customers/:email/emails',         'List emails for customer'],
  ['POST',   '/v1/customers/:email/emails/send',    'Send outbound email — body: { subject*, body*, cc, followUpDays }'],
  ['POST',   '/v1/customers/:email/emails/inbound', 'Record inbound email + trigger AI draft — body: { subject*, body, date, outlookId, generateDraft }'],
  ['GET',    '/v1/drafts',                          'List AI drafts — ?status=pending|sent|generating'],
  ['GET',    '/v1/drafts/:id',                      'Get one draft'],
  ['PATCH',  '/v1/drafts/:id',                      'Edit draft — body: { body, status }'],
  ['POST',   '/v1/drafts/:id/send',                 'Approve & send draft — body: { body } (optional override)'],
  ['GET',    '/v1/customers/:email/notes',          'List notes'],
  ['POST',   '/v1/customers/:email/notes',          'Add note — body: { text* }'],
  ['GET',    '/v1/customers/:email/quotations',     'List quotations'],
  ['POST',   '/v1/customers/:email/quotations',     'Create quotation — body: { reference*, description, amount, currency, validUntil }'],
  ['GET',    '/v1/follow-ups',                      'List follow-ups — ?status=pending|done'],
  ['POST',   '/v1/customers/:email/follow-ups',     'Schedule follow-up — body: { subject, note, daysFromNow }'],
  ['PATCH',  '/v1/follow-ups/:id',                  'Update status — body: { status: pending|done|dismissed }'],
  ['POST',   '/v1/sync',                            'Trigger immediate Outlook sync'],
  ['GET',    '/v1/stream',                          'SSE stream — receive real-time sync events'],
];

const METHOD_COLORS = {
  GET:    { background: '#dbeafe', color: '#1d4ed8' },
  POST:   { background: '#dcfce7', color: '#166534' },
  PATCH:  { background: '#fef9c3', color: '#854d0e' },
  DELETE: { background: '#fee2e2', color: '#991b1b' },
};

const styles = `
  @import url('https://api.fontshare.com/v2/css?f[]=satoshi@700,500,400&display=swap');

  .ak-root {
    font-family: 'Satoshi', system-ui, sans-serif;
    background: #f7f5f2;
    color: #1c1917;
    min-height: 100vh;
  }

  .ak-topbar {
    background: #fff;
    border-bottom: 1px solid #e5e2dc;
    padding: 0 32px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .ak-topbar-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .ak-back-link {
    font-size: 13px;
    color: #78716c;
    text-decoration: none;
  }

  .ak-back-link:hover {
    color: #b45309;
  }

  .ak-topbar h1 {
    font-size: 16px;
    font-weight: 700;
    margin: 0;
  }

  .ak-page {
    max-width: 720px;
    margin: 40px auto;
    padding: 0 24px;
  }

  .ak-card {
    background: #fff;
    border: 1px solid #e5e2dc;
    border-radius: 10px;
    padding: 28px;
    margin-bottom: 24px;
  }

  .ak-card h2 {
    font-size: 15px;
    font-weight: 700;
    margin: 0 0 6px 0;
  }

  .ak-card-desc {
    font-size: 13px;
    color: #78716c;
    line-height: 1.6;
    margin: 0 0 16px 0;
  }

  .ak-form-row {
    display: flex;
    gap: 10px;
  }

  .ak-form-row input {
    flex: 1;
    padding: 9px 13px;
    border: 1px solid #e5e2dc;
    border-radius: 8px;
    font-size: 13px;
    font-family: inherit;
    outline: none;
  }

  .ak-form-row input:focus {
    border-color: #b45309;
  }

  .ak-btn {
    padding: 9px 18px;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-family: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .ak-btn-primary {
    background: #b45309;
    color: #fff;
  }

  .ak-btn-primary:hover {
    opacity: .9;
  }

  .ak-btn-primary:disabled {
    opacity: .6;
    cursor: not-allowed;
  }

  .ak-btn-ghost {
    background: transparent;
    border: 1px solid #e5e2dc;
    color: #44403c;
  }

  .ak-btn-ghost:hover {
    border-color: #dc2626;
    color: #dc2626;
  }

  .ak-btn-danger {
    background: #fee2e2;
    color: #dc2626;
    border: none;
  }

  .ak-btn-danger:hover {
    background: #fca5a5;
  }

  .ak-status {
    font-size: 13px;
    color: #78716c;
    margin-top: 8px;
    min-height: 18px;
  }

  .ak-status.error {
    color: #dc2626;
  }

  /* New-key reveal banner */
  .ak-new-key-banner {
    background: #fefce8;
    border: 1px solid #fde68a;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 24px;
  }

  .ak-new-key-banner h3 {
    font-size: 13px;
    font-weight: 700;
    color: #92400e;
    margin: 0 0 8px 0;
  }

  .ak-new-key-banner p {
    font-size: 12.5px;
    color: #78350f;
    margin: 0 0 10px 0;
    line-height: 1.5;
  }

  .ak-key-value {
    font-family: 'Courier New', monospace;
    font-size: 13px;
    background: #fff;
    border: 1px solid #fde68a;
    border-radius: 6px;
    padding: 10px 14px;
    word-break: break-all;
    user-select: all;
    cursor: text;
    margin-bottom: 10px;
  }

  /* Key list */
  .ak-key-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .ak-key-list-empty {
    font-size: 13px;
    color: #78716c;
  }

  .ak-key-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border: 1px solid #e5e2dc;
    border-radius: 8px;
    background: #f7f5f2;
  }

  .ak-key-row.revoked {
    opacity: .5;
  }

  .ak-key-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .ak-key-name {
    font-size: 14px;
    font-weight: 600;
  }

  .ak-key-meta {
    font-size: 11.5px;
    color: #78716c;
  }

  .ak-key-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .ak-key-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 999px;
    text-transform: uppercase;
    letter-spacing: .05em;
  }

  .ak-key-badge.active {
    background: #dcfce7;
    color: #16a34a;
  }

  .ak-key-badge.revoked {
    background: #f3f4f6;
    color: #9ca3af;
  }

  /* Docs */
  .ak-docs-section {
    margin-bottom: 20px;
  }

  .ak-docs-section:last-child {
    margin-bottom: 0;
  }

  .ak-docs-section h3 {
    font-size: 13px;
    font-weight: 700;
    color: #44403c;
    margin: 0 0 8px 0;
  }

  .ak-docs-block {
    background: #1c1917;
    color: #e7e5e4;
    border-radius: 8px;
    padding: 16px 20px;
    overflow-x: auto;
  }

  .ak-docs-block pre {
    font-size: 12.5px;
    line-height: 1.7;
    white-space: pre-wrap;
    margin: 0;
  }

  .ak-base-url-code {
    font-size: 12px;
    background: #f7f5f2;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
  }

  .ak-endpoint-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .ak-endpoint-table th {
    text-align: left;
    padding: 8px 10px;
    background: #f7f5f2;
    font-weight: 600;
    font-size: 11.5px;
    text-transform: uppercase;
    letter-spacing: .05em;
    color: #78716c;
  }

  .ak-endpoint-table td {
    padding: 10px;
    border-top: 1px solid #e5e2dc;
    vertical-align: top;
  }

  .ak-endpoint-table td:first-child {
    font-family: monospace;
    font-size: 12px;
    color: #b45309;
    white-space: nowrap;
  }

  .ak-endpoint-table td code {
    font-family: monospace;
    font-size: 11.5px;
    background: #f7f5f2;
    padding: 1px 5px;
    border-radius: 4px;
  }

  .ak-method-badge {
    display: inline-block;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    margin-right: 4px;
    font-family: 'Satoshi', system-ui, sans-serif;
  }
`;

function formatDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString();
}

export default function ApiKeysPage() {
  const navigate = useNavigate();
  const [keys, setKeys] = useState([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [keyName, setKeyName] = useState('');
  const [status, setStatus] = useState('');
  const [statusIsError, setStatusIsError] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [newKey, setNewKey] = useState(null);
  const [copyLabel, setCopyLabel] = useState('Copy to clipboard');
  const bannerRef = useRef(null);

  function handleUnauth() {
    navigate('/login');
  }

  async function loadKeys() {
    try {
      const data = await getApiKeys();
      setKeys(data);
    } catch (err) {
      if (err.message === 'UNAUTHENTICATED') {
        handleUnauth();
      }
    } finally {
      setLoadingKeys(false);
    }
  }

  useEffect(() => {
    loadKeys();
  }, []);

  async function handleGenerate() {
    const name = keyName.trim() || 'My App';
    setGenerating(true);
    setStatus('Generating…');
    setStatusIsError(false);
    try {
      const data = await createApiKey(name);
      setKeyName('');
      setStatus('');
      setNewKey(data.key);
      setCopyLabel('Copy to clipboard');
      await loadKeys();
      if (bannerRef.current) {
        bannerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (err) {
      if (err.message === 'UNAUTHENTICATED') {
        handleUnauth();
        return;
      }
      setStatusIsError(true);
      setStatus('Error: ' + err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke(id) {
    if (!window.confirm('Revoke this API key? Any app using it will immediately lose access.')) return;
    try {
      await revokeApiKey(id);
      await loadKeys();
    } catch (err) {
      if (err.message === 'UNAUTHENTICATED') {
        handleUnauth();
        return;
      }
      alert('Failed to revoke key');
    }
  }

  function handleCopy() {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey).then(() => {
      setCopyLabel('Copied!');
      setTimeout(() => setCopyLabel('Copy to clipboard'), 2000);
    });
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleGenerate();
  }

  return (
    <>
      <style>{styles}</style>
      <div className="ak-root">
        <div className="ak-topbar">
          <div className="ak-topbar-left">
            <a className="ak-back-link" href="/crm">← Back to CRM</a>
            <h1>API Keys</h1>
          </div>
        </div>

        <div className="ak-page">
          {newKey && (
            <div className="ak-new-key-banner" ref={bannerRef}>
              <h3>Copy your API key now — it won't be shown again</h3>
              <p>
                Store it securely (e.g. in your app's environment variables).
                If you lose it, revoke this key and create a new one.
              </p>
              <div className="ak-key-value">{newKey}</div>
              <button className="ak-btn ak-btn-ghost" onClick={handleCopy}>
                {copyLabel}
              </button>
            </div>
          )}

          <div className="ak-card">
            <h2>Generate a new API key</h2>
            <p className="ak-card-desc">Each key is tied to your account. Name it after the app that will use it.</p>
            <div className="ak-form-row">
              <input
                type="text"
                placeholder="e.g. My CRM App, Zapier, n8n"
                maxLength={100}
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                className="ak-btn ak-btn-primary"
                onClick={handleGenerate}
                disabled={generating}
              >
                Generate
              </button>
            </div>
            {status && (
              <div className={`ak-status${statusIsError ? ' error' : ''}`}>{status}</div>
            )}
          </div>

          <div className="ak-card">
            <h2>Your API keys</h2>
            <p className="ak-card-desc">
              Revoke a key immediately if it's compromised. Revoked keys cannot be re-activated.
            </p>
            <div className="ak-key-list">
              {loadingKeys ? (
                <p className="ak-key-list-empty">Loading…</p>
              ) : keys.length === 0 ? (
                <p className="ak-key-list-empty">No API keys yet. Generate one above.</p>
              ) : (
                keys.map((k) => (
                  <div
                    key={k.id}
                    className={`ak-key-row${k.revoked ? ' revoked' : ''}`}
                  >
                    <div className="ak-key-info">
                      <span className="ak-key-name">{k.name}</span>
                      <span className="ak-key-meta">
                        Created {formatDate(k.created_at)}
                        {k.last_used_at
                          ? ` · Last used ${formatDate(k.last_used_at)}`
                          : ' · Never used'}
                      </span>
                    </div>
                    <div className="ak-key-actions">
                      <span className={`ak-key-badge ${k.revoked ? 'revoked' : 'active'}`}>
                        {k.revoked ? 'Revoked' : 'Active'}
                      </span>
                      {!k.revoked && (
                        <button
                          className="ak-btn ak-btn-danger"
                          onClick={() => handleRevoke(k.id)}
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="ak-card">
            <h2>Quick-start</h2>
            <p className="ak-card-desc">
              Base URL: <code className="ak-base-url-code">http://localhost:3000/v1</code>
            </p>

            <div className="ak-docs-section">
              <h3>Authentication</h3>
              <div className="ak-docs-block">
                <pre>{`curl http://localhost:3000/v1/customers \\
  -H "Authorization: Bearer crm_live_YOUR_KEY"

# or
curl http://localhost:3000/v1/customers \\
  -H "X-API-Key: crm_live_YOUR_KEY"`}</pre>
              </div>
            </div>

            <div className="ak-docs-section">
              <h3>Response format</h3>
              <div className="ak-docs-block">
                <pre>{`// Success
{ "data": { ... }, "meta": { "timestamp": "...", "version": "v1", "requestId": "..." } }

// Error
{ "error": { "code": "NOT_FOUND", "message": "Customer not found" }, "meta": { ... } }`}</pre>
              </div>
            </div>

            <div className="ak-docs-section">
              <h3>All endpoints</h3>
              <table className="ak-endpoint-table">
                <thead>
                  <tr>
                    <th>Method + Path</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {ENDPOINTS.map(([method, path, desc]) => (
                    <tr key={`${method}-${path}`}>
                      <td>
                        <span
                          className="ak-method-badge"
                          style={METHOD_COLORS[method] || {}}
                        >
                          {method}
                        </span>
                        {path}
                      </td>
                      <td>{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
