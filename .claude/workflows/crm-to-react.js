
export const meta = {
  name: 'crm-to-react',
  description: 'Convert CRM HTML pages to a React + Vite + Tailwind app with modern design',
  phases: [
    { title: 'Setup' },
    { title: 'Utilities' },
    { title: 'Components' },
    { title: 'Assembly' },
  ],
};

const BASE    = '/Users/MURALI/Downloads/Mail Draft';
const CLIENT  = `${BASE}/web-ui/client`;
const SRC     = `${CLIENT}/src`;
const PUB     = `${BASE}/web-ui/public`;

// ─── Phase 1: project scaffold ────────────────────────────────────────────────
phase('Setup');

await agent(`
Create a Vite + React + Tailwind CSS project scaffold at ${CLIENT}.

Write each file exactly as shown below.

--- FILE: ${CLIENT}/package.json ---
{
  "name": "crm-client",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2",
    "lucide-react": "^0.447.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.2",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "vite": "^5.4.10"
  }
}

--- FILE: ${CLIENT}/vite.config.js ---
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    proxy: {
      '/api': { target: 'https://localhost:3000', secure: false, changeOrigin: true },
      '/crm': { target: 'https://localhost:3000', secure: false, changeOrigin: true },
      '/v1':  { target: 'https://localhost:3000', secure: false, changeOrigin: true },
    },
  },
  build: {
    outDir: '../public/dist',
    emptyOutDir: true,
  },
});

--- FILE: ${CLIENT}/postcss.config.js ---
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };

--- FILE: ${CLIENT}/tailwind.config.js ---
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:     ['Satoshi', 'system-ui', 'sans-serif'],
        display:  ['Bricolage Grotesque', 'sans-serif'],
      },
      colors: {
        stone: {
          50:  'oklch(0.988 0.004 68)',
          100: 'oklch(0.958 0.007 68)',
          150: 'oklch(0.945 0.009 68)',
          200: 'oklch(0.910 0.011 68)',
          300: 'oklch(0.840 0.014 68)',
          500: 'oklch(0.570 0.014 68)',
          700: 'oklch(0.400 0.013 68)',
          900: 'oklch(0.160 0.010 68)',
        },
        amber: {
          50:  'oklch(0.975 0.024 65)',
          100: 'oklch(0.942 0.048 64)',
          200: 'oklch(0.888 0.082 60)',
          500: 'oklch(0.680 0.148 54)',
          600: 'oklch(0.580 0.148 52)',
          700: 'oklch(0.490 0.130 50)',
        },
      },
      animation: {
        'slide-in':   'slideIn 0.2s ease-out',
        'fade-in':    'fadeIn 0.15s ease-out',
        'scale-in':   'scaleIn 0.15s ease-out',
      },
      keyframes: {
        slideIn:  { from: { transform: 'translateY(8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        fadeIn:   { from: { opacity: '0' }, to: { opacity: '1' } },
        scaleIn:  { from: { transform: 'scale(0.96)', opacity: '0' }, to: { transform: 'scale(1)', opacity: '1' } },
      },
    },
  },
  plugins: [],
};

--- FILE: ${CLIENT}/index.html ---
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mail Assistant</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=Satoshi:wght@400;500;600;700&display=swap" rel="stylesheet" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>

--- FILE: ${SRC}/index.css ---
@import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg:          oklch(0.988 0.004 68);
  --bg-sidebar:  oklch(0.958 0.007 68);
  --bg-panel:    oklch(0.945 0.009 68);
  --border:      oklch(0.910 0.011 68);
  --text:        oklch(0.160 0.010 68);
  --text-2:      oklch(0.400 0.013 68);
  --text-3:      oklch(0.570 0.014 68);
  --amber-5:     oklch(0.680 0.148 54);
  --amber-6:     oklch(0.580 0.148 52);
  --amber-7:     oklch(0.490 0.130 50);
  --green-7:     oklch(0.440 0.140 155);
  --green-bg:    oklch(0.930 0.042 155);
  --red-7:       oklch(0.440 0.165 25);
  --red-bg:      oklch(0.930 0.034 25);
  --blue-7:      oklch(0.440 0.140 240);
  --blue-bg:     oklch(0.930 0.034 240);
}

*,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #root { height: 100%; }
body { font-family: 'Satoshi', system-ui, sans-serif; background: var(--bg); color: var(--text); }

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }

/* Transitions */
* { transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke; transition-duration: 120ms; transition-timing-function: ease; }

--- FILE: ${SRC}/main.jsx ---
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

Now run these commands:
  cd "${CLIENT}" && npm install 2>&1 | tail -5

After npm install completes successfully, output the exact text: SETUP_COMPLETE
`, { label: 'scaffold + npm install' });

// ─── Phase 2: Utilities (parallel) ────────────────────────────────────────────
phase('Utilities');

await parallel([

  () => agent(`
Write ${SRC}/api.js — a thin wrapper around fetch for every CRM API endpoint.
All functions are async, throw on non-ok responses (include res.status and parsed error text).
Base path is relative (no host prefix), so it works both in dev proxy and prod.

Implement:
  export async function getMe()
  export async function getCustomers()
  export async function getCustomer(email)
  export async function upsertCustomer(fields)  // POST /api/crm/customers
  export async function sendEmail(customerEmail, formData)  // POST multipart /api/crm/customers/:email/send-email
  export async function addNote(email, text)
  export async function addQuotation(email, q)  // { reference, description, amount, currency, validUntil }
  export async function addFollowUp(email, { subject, note, daysUntilDue })
  export async function updateFollowUp(email, fuId, status)
  export async function getOverdueFollowUps()
  export async function getDrafts()
  export async function updateDraft(id, fields)  // PATCH { body, status }
  export async function sendDraft(id, formData)  // POST multipart /api/crm/drafts/:id/send
  export async function escalateDraft(id, { escalateTo, note })
  export async function processEmail(payload)  // POST /api/crm/process-email
  export async function importPreview(formData)
  export async function importCustomers(formData)
  export async function getApiKeys()
  export async function createApiKey(name)
  export async function revokeApiKey(id)
  export async function getAuthStatus()
  export async function getSettings()
  export async function setFollowUpDays(days)
  export async function sendChat({ query, customerEmail })  // POST /api/crm/chat

Each function wraps fetch with proper headers. For multipart (FormData) payloads do NOT set Content-Type. For JSON payloads set Content-Type application/json and JSON.stringify the body.

On 401, throw an error with message 'UNAUTHENTICATED'.

Write the file.
`, { label: 'api.js' }),

  () => agent(`
Write ${SRC}/context/AppContext.jsx — a React Context providing global CRM state.

State shape:
  user           : null | { email, name }
  customers      : []
  activeCustomer : null | customerObject  (full customer with emails, notes, etc.)
  notifications  : []   (overdue follow-ups)
  toasts         : []   (array of { id, type, message })
  sseConnected   : boolean

Actions (exposed via context):
  setUser(u)
  loadCustomers()              — fetches GET /api/crm/customers
  openCustomer(email)         — fetches GET /api/crm/customers/:email, sets activeCustomer
  refreshActiveCustomer()     — re-fetches activeCustomer if one is open
  loadNotifications()         — fetches GET /api/crm/followups/overdue
  addToast(type, message)     — adds toast with auto-remove after 4s; types: 'success'|'error'|'info'
  removeToast(id)
  setSseConnected(b)

Use useReducer for state, useMemo for the context value.
Import getCustomers, getCustomer, getOverdueFollowUps from ../api.js.

Also export: useApp() hook = useContext(AppContext).

Write ${SRC}/context/AppContext.jsx.
`, { label: 'AppContext' }),

  () => agent(`
Write ${SRC}/hooks/useSSE.js — a custom React hook for the SSE stream.

  export function useSSE({ onNewEmail, onDraftReady, onSyncDone })

Connects to /api/crm/stream using EventSource.
On message with type 'new_email', calls onNewEmail(data).
On message with type 'draft_ready', calls onDraftReady(data).
On message with type 'sync_done', calls onSyncDone(data).
Reconnects after 3s on error.
Cleans up EventSource on unmount.

Also write ${SRC}/hooks/useDrafts.js:
  export function useDrafts(customerEmail)
  — fetches GET /api/crm/drafts and filters by customerEmail
  — returns { drafts, loading, reload }
  — polls every 5s when any draft has generationStatus === 'generating'

Write both files.
`, { label: 'hooks' }),

]);

// ─── Phase 3: Components (all parallel) ───────────────────────────────────────
phase('Components');

await parallel([

  // UI primitives
  () => agent(`
Read the existing crm.html CSS (first 700 lines) for design reference:
  head -700 "${BASE}/web-ui/public/crm.html"

Then write these UI primitive components in ${SRC}/components/ui/:

1. Button.jsx
   Props: variant ('primary'|'ghost'|'danger'|'warn'|'success'), size ('sm'|'md'), disabled, loading, onClick, children, className
   primary  = amber-600 bg, white text
   ghost    = transparent bg, border, stone-700 text
   danger   = red-bg bg, red-7 text
   warn     = amber-100 bg, amber-700 text
   success  = green-bg bg, green-7 text
   sm = text-xs px-3 py-1.5, md = text-sm px-4 py-2
   Show a tiny spinner inside when loading=true

2. Badge.jsx
   Props: variant ('pending'|'sent'|'rejected'|'escalated'|'generating'|'success'|'error'), children
   Colored pill — use amber/red/green/blue/stone matching the existing status-pill CSS from crm.html

3. Spinner.jsx
   A simple 16px rotating circle using CSS animation, color inherits from parent

4. Toast.jsx
   Props: toasts (array), removeToast (fn)
   Fixed bottom-right, each toast slides in, auto-removes
   success=green, error=red, info=amber backgrounds
   Has ✕ close button

5. Modal.jsx
   Props: open, onClose, title, children, maxWidth ('sm'|'md'|'lg')
   Overlay + centered card, scale-in animation, Escape closes, click-outside closes
   Header with title and ✕ button

Write all 5 files.
`, { label: 'UI primitives' }),

  // Login + ApiKeys pages
  () => agent(`
Convert two pages to React:

1. Write ${SRC}/pages/LoginPage.jsx
Reference the existing login page design:
  cat "${BASE}/web-ui/public/crm-login.html"

Keep the exact same visual design:
  - Centered card with amber gradient background
  - Logo icon (amber gradient square with email SVG icon)
  - "Mail Assistant" wordmark using Bricolage Grotesque
  - "Welcome back" hero text
  - "Sign in with Microsoft" black button with Microsoft logo squares
  - Error banner from URL ?error= param

The sign-in button is a plain <a href="/crm/auth/login"> (not fetch) since it triggers OAuth.

2. Write ${SRC}/pages/ApiKeysPage.jsx
Reference the existing api-keys page:
  cat "${BASE}/web-ui/public/api-keys.html"

Same layout: topbar with "← Back to CRM" link and "API Keys" title.
Card for generating a new key (name input + Generate button).
New-key reveal banner (yellow, shows key once with Copy button, collapses after copy or navigation).
List of existing keys with Active/Revoked badge + Revoke button.
Quick-start docs card (code blocks for curl examples and endpoint table).

Import and use: getApiKeys, createApiKey, revokeApiKey from ../../api.js
Import useNavigate from react-router-dom (redirect to /login on 401).

Write both files.
`, { label: 'Login + ApiKeys pages' }),

  // Sidebar
  () => agent(`
Read the sidebar section of crm.html (lines 700-900 HTML + loadCustomers/renderCustomerList/filterCustomers JS):
  sed -n '700,900p' "${BASE}/web-ui/public/crm.html"
  grep -n "filterCustomers\\|renderCustomerList\\|loadCustomers\\|import-btn\\|sync" "${BASE}/web-ui/public/crm.html" | head -30

Write ${SRC}/components/Sidebar.jsx

Props: none — reads from AppContext.

Features:
  - Topbar: "Mail Assistant" wordmark + user avatar/email (from context.user) + Settings link + Logout link (/crm/auth/logout)
  - Sync button (POST /api/crm/sync → triggers inbox sync, shows spinner while syncing)
  - "↑ Import" button (opens ImportModal)
  - "+ Customer" button (opens AddCustomerModal)
  - Search input that filters the customer list
  - Customer list: each item shows avatar circle (first letter), name, company, pending follow-up count badge (amber), unread email badge
  - Clicking a customer calls context.openCustomer(email) and highlights it
  - Active customer has amber-left-border highlight
  - Empty state: "No customers yet" with a helpful subtitle
  - Loading skeleton (3 placeholder rows animating with pulse)

Styling: left sidebar, bg-[var(--bg-sidebar)], border-right, fixed height, overflow-y-auto on the list.

Import useApp from ../context/AppContext.
Write the file.
`, { label: 'Sidebar' }),

  // Workspace + Tabs structure
  () => agent(`
Read the main workspace structure from crm.html:
  sed -n '900,1100p' "${BASE}/web-ui/public/crm.html"
  grep -n "switchTab\\|tab-btn\\|tab-pane\\|renderWorkspace\\|pane-" "${BASE}/web-ui/public/crm.html" | head -30

Write ${SRC}/components/Workspace.jsx — the main right-side content area.

Props: none — reads from AppContext.

When no customer is selected: empty state with "Select a customer from the sidebar" prompt and a nice illustration (abstract SVG or emoji-based).

When a customer is selected: show
  1. Customer header bar:
     - Avatar circle (big, first letter or initials, amber bg)
     - Name (Bricolage Grotesque, large)
     - Email and company (small, muted)
     - Company badge
     - "Edit" button (pencil icon) to open AddCustomerModal in edit mode
     - "Compose" button to open ComposeModal
     - Customer since date
  2. Stats row: 4 stat cards (Emails received, Emails sent, Pending follow-ups, Notes)
     Each is a clickable chip that switches to the relevant tab. Pending follow-ups chip is amber if > 0.
  3. Tab bar: Emails | Drafts | Notes | Quotations | Follow-ups
     Active tab has amber underline. Smooth indicator.
  4. Tab content area: renders the active tab's component

Import: EmailsTab, DraftsTab, NotesTab, QuotationsTab, FollowUpsTab from ./tabs/
Import: ComposeModal, AddCustomerModal from ./modals/
Import useApp from ../context/AppContext.

Write the file.
`, { label: 'Workspace' }),

  // Emails Tab
  () => agent(`
Read the emails section of crm.html:
  grep -n "receivedEmails\\|sentEmails\\|pane-emails\\|email-row\\|email-thread" "${BASE}/web-ui/public/crm.html" | head -40
  sed -n '1600,1800p' "${BASE}/web-ui/public/crm.html"

Write ${SRC}/components/tabs/EmailsTab.jsx

Props: customer (full customer object from context)

Shows two sub-sections side by side (or stacked on narrow):
  Left: "Received" emails
  Right: "Sent" emails

Each email item shows:
  - Date (relative: "3 days ago" or absolute if > 30 days)
  - Subject (bold)
  - Body preview (2 lines, truncated, text-xs, muted)
  - Direction badge (blue "Received" or green "Sent")
  - Hover: card lifts slightly (shadow + translateY)

Clicking an email expands it inline to show the full body.
Empty state per section: "No received emails" / "No sent emails"

Write the file.
`, { label: 'EmailsTab' }),

  // Drafts Tab + DraftCard
  () => agent(`
Read the drafts section of crm.html (this is the most complex tab):
  grep -n "draft\\|Draft" "${BASE}/web-ui/public/crm.html" | grep -v "css\\|generateDraft\\|Follow" | head -50
  sed -n '1850,2080p' "${BASE}/web-ui/public/crm.html"

Write two files:

1. ${SRC}/components/tabs/DraftsTab.jsx
   Props: customer
   Uses useDrafts(customer.email) hook
   Shows loading spinner while loading
   Empty state: "No drafts — AI replies will appear here after you receive an email"
   Lists DraftCard for each draft, newest first

2. ${SRC}/components/DraftCard.jsx
   Props: draft, onRefresh
   
   Draft card shows:
     - Status badge (pending/sent/rejected/escalated/generating)
     - "In reply to:" source subject (muted)
     - Subject
     - AI spinner row while generationStatus === 'generating' (polls via hook)
     - Editable textarea for draft body (edit mode toggled by Edit button)
     - File attachment input (hidden, triggered by "Attach" button)
     - Action buttons row:
       - "Approve & Send" (green) → POST /api/crm/drafts/:id/send with FormData
       - "Edit" (ghost) → toggles edit mode
       - "Escalate" (warn/amber) → opens EscalateModal
       - "Reject" (danger) → PATCH status=rejected
     - When in edit mode: "Send Edited" (primary) + "Cancel" (ghost)
   
   Import EscalateModal from ../modals/EscalateModal.
   Import updateDraft, sendDraft from ../../api.js.
   Import useApp for addToast and refreshActiveCustomer.

Write both files.
`, { label: 'Drafts + DraftCard' }),

  // Notes, Quotations, FollowUps tabs
  () => agent(`
Read the notes/quotations/followups sections:
  grep -n "pane-notes\\|pane-quotes\\|pane-followups\\|addNote\\|addQuotation\\|addFollowUp\\|note-row\\|quote-row\\|followup-row" "${BASE}/web-ui/public/crm.html" | head -40

Write three tab components:

1. ${SRC}/components/tabs/NotesTab.jsx
   Props: customer, onRefresh
   List of notes (newest first), each showing: text, relative date, delete option (if you want)
   Add-note form at bottom: textarea + "Add Note" button
   POST /api/crm/customers/:email/notes → { text }
   On success: call onRefresh()

2. ${SRC}/components/tabs/QuotationsTab.jsx
   Props: customer, onRefresh
   List of quotations, each card showing: reference, description, amount+currency, valid-until date, status badge
   "Add Quotation" form (collapsible, toggled by + button):
     Fields: Reference*, Description, Amount, Currency (select: USD/EUR/GBP/INR/AED), Valid Until (date)
   POST /api/crm/customers/:email/quotations → quotation fields
   On success: call onRefresh()

3. ${SRC}/components/tabs/FollowUpsTab.jsx
   Props: customer, onRefresh
   List of all follow-ups with status badge (pending=amber, closed=green, dismissed=stone)
   Pending ones first, others below a divider
   Each shows: subject, note, due date, status
   Pending follow-ups have: "Close" button (PATCH status=closed) and "Dismiss" button (PATCH status=dismissed)
   "Schedule Follow-up" form at bottom:
     Fields: Subject, Note, Days until due (number input, default 3)
   POST /api/crm/customers/:email/followup → { subject, note, daysUntilDue }
   On success: call onRefresh()

Import api functions from ../../api.js.
Import useApp for addToast.
Write all three files.
`, { label: 'Notes + Quotations + FollowUps tabs' }),

  // Notification Panel + Chat Panel
  () => agent(`
Read the notification and chat sections:
  grep -n "notif\\|refreshFollowUps\\|dismissFollowUp\\|sendChat\\|chatbot\\|chat-" "${BASE}/web-ui/public/crm.html" | head -50
  sed -n '2160,2350p' "${BASE}/web-ui/public/crm.html"

Write two panel components:

1. ${SRC}/components/NotificationPanel.jsx
   Props: none — reads from context (context.notifications)
   
   Right sidebar panel showing overdue follow-ups as notification cards.
   Panel has: title "Follow-ups", count badge (amber), "Refresh" icon button.
   
   Each notification card:
     - Customer name + company (bold)
     - "Last Activity: X days ago" (if lastEmailAt exists)
     - Status pill: "Awaiting Response" (amber)
     - Due date in red: "Due: 3 days ago"
     - Three buttons: "View" (opens that customer), "Generate" (generates follow-up draft), "Dismiss"
   
   Empty state: checkmark icon + "All caught up!" text
   
   Calls context.openCustomer(email) for View.
   POST /api/crm/process-email for Generate (with { customerEmail, generateDraft: true }).
   PATCH /api/crm/customers/:email/followup/:id → status dismissed for Dismiss.
   After any action: context.loadNotifications().

2. ${SRC}/components/ChatPanel.jsx
   Props: none — reads context.activeCustomer
   
   AI chat panel at the bottom right.
   Collapsible (toggle with a "AI Assistant" header bar click).
   
   Chat message list (scrollable, newest at bottom).
   Messages: user messages (right, amber bg) and AI messages (left, white card).
   AI messages render with basic markdown: **bold** → <strong>, newlines → <br>.
   Loading state while AI is thinking: animated "..." dots.
   
   Input row: text input + Send button (or Enter key).
   
   When a customer is active: the query is customer-specific.
   Global queries (keywords: "all customers", "pending follow-ups", "overdue", "list all") send customerEmail=null.
   
   POST /api/crm/chat → { query, customerEmail } → { reply }
   
   System message at top when no customer: "Ask me about any customer or 'show all pending follow-ups'"
   
   Write both files.
`, { label: 'NotificationPanel + ChatPanel' }),

  // All Modals
  () => agent(`
Read the modal sections of crm.html:
  grep -n "modal\\|openImport\\|openEscalate\\|openAddCustomer\\|openCompose\\|compose-modal\\|import-modal\\|add-customer-modal\\|escalate-modal" "${BASE}/web-ui/public/crm.html" | head -50
  sed -n '1250,1450p' "${BASE}/web-ui/public/crm.html"

Write four modal components. All use Modal from ../ui/Modal.

1. ${SRC}/components/modals/AddCustomerModal.jsx
   Props: open, onClose, editCustomer (null=add mode, object=edit mode), onSaved
   Fields: Email (required, disabled in edit mode), Name, Company, Phone, Customer Since (date)
   POST/PUT /api/crm/customers → upsertCustomer(fields)
   On success: call onSaved(), close modal, addToast success

2. ${SRC}/components/modals/ComposeModal.jsx
   Props: open, onClose, customer, onSent
   Fields: Subject (required), Body (textarea, required), CC (email input), Follow-up Days (number, default 3)
   File attachments: drag-and-drop zone + click to browse, shows attached file chips with × remove
   "Send Email" button → POST multipart /api/crm/customers/:email/send-email
   On success: call onSent(), close modal, addToast "Email sent!"

3. ${SRC}/components/modals/EscalateModal.jsx
   Props: open, onClose, draft, customer, onEscalated
   
   Warning banner: "Recipient gets complete customer history"
   Outlook auth warning (hidden by default): fetch /api/crm/auth/status on open; if not connected show red banner with link to /crm/auth/login
   Fields: "Escalate To" email (required), "Note / Reason" (textarea, optional)
   Customer preview box: shows name, email, email count, company
   "Send Escalation" button → escalateDraft(draft.id, { escalateTo, note })
   On 401 with saved=true: show "Saved — connect Outlook to send"
   On success: onEscalated(), addToast, close

4. ${SRC}/components/modals/ImportModal.jsx
   Props: open, onClose, onImported
   
   Drag-and-drop zone for .xlsx/.csv files
   After file selection: POST /api/crm/customers/import/preview (FormData with file field 'file')
   Shows: row count, column mapping chips (green=found: email/name/company/phone, gray=missing)
   "Import X customers" button → POST /api/crm/customers/import
   Result: "Created Y, Skipped Z" toast
   On success: onImported(), close

Write all four files.
`, { label: 'All Modals' }),

]);

// ─── Phase 4: Assembly ─────────────────────────────────────────────────────────
phase('Assembly');

await agent(`
Now assemble the complete CRM app. Write these final files:

1. ${SRC}/App.jsx
   - On mount: fetch /api/crm/me — if 401, redirect to /login; else call setUser and proceed
   - Routes:
     /login        → <LoginPage />
     /api-keys     → <ApiKeysPage />  (protected)
     /             → <CrmLayout />   (protected)
     *             → redirect to /
   - Wrap the whole app in AppProvider from ./context/AppContext
   - Show a full-page loading spinner while checking auth on mount
   - Show <Toast /> (from ./components/ui/Toast) using context toasts

2. ${SRC}/pages/CrmPage.jsx — the main 3-column layout:
   
   CSS grid: [240px sidebar] [1fr workspace] [300px right-panel]
   
   Left: <Sidebar />
   Center: <Workspace />
   Right: vertical flex containing <NotificationPanel /> (flex-1) and <ChatPanel /> (flex-shrink-0, ~280px)
   
   On mount: call context.loadCustomers() and context.loadNotifications()
   
   Use useSSE hook:
     onNewEmail: context.refreshActiveCustomer() + context.loadNotifications() + addToast info
     onDraftReady: context.refreshActiveCustomer() + addToast "New AI draft ready"
     onSyncDone: context.loadCustomers()
   
   Import all layout components.

3. Update ${BASE}/web-ui/server.js:
   Read the file first, then make these changes:
   a. Find the static files section (around line 223: app.use(express.static...)) and add BEFORE it:
      // Serve React build when available
      const reactDist = path.join(__dirname, 'public', 'dist');
      if (require('fs').existsSync(reactDist)) {
        app.use(express.static(reactDist));
      }
   b. Just before app.listen (near end of file), add a catch-all for client-side routing:
      // SPA fallback — serve React index.html for non-API routes
      const reactIndex = path.join(__dirname, 'public', 'dist', 'index.html');
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/crm/auth') || req.path.startsWith('/v1')) return next();
        if (require('fs').existsSync(reactIndex)) return res.sendFile(reactIndex);
        next();
      });

4. Update ${BASE}/package.json:
   Read it, then add to scripts:
     "build:ui": "cd web-ui/client && npm install && npm run build",
     "dev:ui": "cd web-ui/client && npm run dev"

Write all files. Then run:
  cd "${CLIENT}" && npm run build 2>&1 | tail -20

Report what happened.
`, { label: 'App.jsx + CrmPage + server wiring + build' });

log('React build complete — restart the server to serve the new UI');
