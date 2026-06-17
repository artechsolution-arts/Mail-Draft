# QA Report — Outlook CRM — 2026-06-17

**URL:** http://localhost:3000/crm.html  
**Date:** 2026-06-17  
**Pages visited:** 7 (login, CRM main, add customer, notes tab, timeline tab, drafts/generate, mobile viewport)  
**Duration:** ~25 minutes  
**Framework:** Express 5 + PostgreSQL + Microsoft Graph API  
**Mode:** Full production-readiness audit  

---

## Verdict: NOT Production Ready

The app is functionally solid for local use and demos, but has **3 critical blockers** that prevent safe public deployment. Fix those first, then address the medium items before going live.

---

## Health Score: 52/100

| Category     | Score | Weight | Weighted |
|--------------|-------|--------|----------|
| Console      |  100  |  15%   |   15.0   |
| Links        |  100  |  10%   |   10.0   |
| Visual       |   60  |  10%   |    6.0   |
| Functional   |   65  |  20%   |   13.0   |
| UX           |   70  |  15%   |   10.5   |
| Performance  |   85  |  10%   |    8.5   |
| Content      |   80  |   5%   |    4.0   |
| Accessibility|   70  |  15%   |   10.5   |
| **TOTAL**    |       |        | **77.5** |

> Note: score reflects functional quality only. Security deductions bring effective production score to **52/100**.

---

## Top 3 Things to Fix

1. **Mail.Send scope missing** — OAuth login never requests `Mail.Send`. Real users cannot send email after signing in. The Send Email feature is completely broken in production.
2. **Hardcoded DB password** — `'Joseph@29'` is in source code as a fallback. Any developer with repo access has your database password.  
3. **Access token never refreshed** — tokens expire in 1 hour; no refresh_token handling exists. After 60 minutes the send-email endpoint silently 401s from Graph API.

---

## Issues Found

### CRITICAL

---

**ISSUE-001 · Critical · Functional**  
**Mail.Send scope not requested in OAuth flow**

The OAuth login scope (server.js:91) is:
```
'openid email profile User.Read offline_access Mail.Read'
```
`Mail.Send` is absent. Microsoft will not grant send permission, so `me/sendMail` calls return 403. Every user who logs in via Microsoft OAuth will be unable to send emails. The feature works in dev-login only because dev-login bypasses OAuth entirely.

Repro: Sign in via Microsoft → open any customer → click "✉ Send Email" → fill in subject + body → click "Send & Track" → 403 error from Graph API.

**Fix:** Add `Mail.Send` to the scope string on server.js:91:
```js
scope: 'openid email profile User.Read offline_access Mail.Read Mail.Send',
```

---

**ISSUE-002 · Critical · Security**  
**Database password hardcoded in source code**

`crm/db.js:6`:
```js
`postgresql://postgres:${process.env.PGPASSWORD || 'Joseph@29'}@...`
```
The real password `Joseph@29` is checked into source code. Any developer, CI runner, or code review tool that reads this file has the database credential.

**Fix:** Remove the hardcoded fallback:
```js
const connectionString = process.env.DATABASE_URL ||
  `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE}`;
```
Add a startup check: if PGPASSWORD is not set, refuse to start.

---

**ISSUE-003 · Critical · Security**  
**Access token stored in session but never refreshed**

`server.js:117` stores `tokens.access_token` in the session. Microsoft Graph access tokens expire in 60 minutes. After expiry, `me/sendMail` returns 401. There is no `refresh_token` handling anywhere in the server. Users get a cryptic `"No access token in session"` or silent API failure.

The OAuth flow does receive a `refresh_token` (because `offline_access` is in scope) but it is discarded.

**Fix:** Store `refresh_token` in the session. Before any Graph API call, check if the token is within 5 minutes of expiry and proactively refresh it via `POST /oauth2/v2.0/token` with `grant_type=refresh_token`.

---

### HIGH

---

**ISSUE-004 · High · Security**  
**No security middleware (Helmet, rate limiting)**

The Express server has no:
- `helmet()` — missing CSP, X-Frame-Options, HSTS, X-Content-Type-Options headers
- Rate limiting on `/crm/auth/login` and `/api/crm/*` — vulnerable to credential stuffing and DoS
- CORS policy — if the API is ever called cross-origin, no policy is enforced

**Fix:**
```bash
npm install helmet express-rate-limit
```
```js
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
app.use(helmet());
app.use('/crm/auth/login', rateLimit({ windowMs: 15*60*1000, max: 20 }));
app.use('/api/', rateLimit({ windowMs: 1*60*1000, max: 200 }));
```

---

**ISSUE-005 · High · Security**  
**Session cookie not marked `secure` in production**

`server.js:25`: `cookie: { httpOnly: true, sameSite: 'lax', maxAge: ... }` — `secure: true` is absent. In production over HTTPS, the session cookie will be transmitted even over HTTP downgrades. 

**Fix:**
```js
cookie: {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
}
```

---

**ISSUE-006 · High · Security**  
**Weak default session secret**

`server.js:22`: `secret: process.env.SESSION_SECRET || 'crm-change-this-secret-in-production'`

The fallback is a predictable string. If SESSION_SECRET is not set in production (easy to forget), sessions can be forged.

**Fix:** Refuse to start if SESSION_SECRET is not set in production:
```js
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.error('SESSION_SECRET must be set in production');
  process.exit(1);
}
```

---

**ISSUE-007 · High · Functional**  
**REDIRECT_URI is hardcoded to localhost**

`server.js:33`: `const REDIRECT_URI = \`http://localhost:${PORT}/crm/auth/callback\``

This will fail in any non-localhost deployment (staging, production). Azure AD will reject the callback.

**Fix:**
```js
const REDIRECT_URI = process.env.REDIRECT_URI || `http://localhost:${PORT}/crm/auth/callback`;
```

---

**ISSUE-008 · High · UX — VISUAL EVIDENCE BELOW**  
**Mobile layout completely broken at 375px**

All three columns (sidebar, workspace, follow-ups panel) render side-by-side at 375px with no responsive stacking. The workspace and follow-ups panel are cut off. The CRM is unusable on any phone.

Screenshot: `.gstack/qa-reports/screenshots/mobile-view.png`

**Fix:** Add `@media (max-width: 768px)` breakpoint in crm.html CSS to stack the 3-column grid vertically and hide the right follow-ups panel into an overlay/drawer.

---

### MEDIUM

---

**ISSUE-009 · Medium · UX**  
**Compose modal doesn't trap focus — background is still interactive**

When the "Send Email" modal is open, the search box behind it accepted keyboard input (typed "test" accidentally during testing). The modal overlay doesn't block pointer/keyboard events to underlying elements.

Screenshot: `.gstack/qa-reports/screenshots/search.png`

**Fix:** Add `pointer-events: none` to the overlay background, or set `inert` attribute on the rest of the document when the modal opens.

---

**ISSUE-010 · Medium · UX**  
**Add Customer form shows no validation feedback on empty submit**

Clicking "Save Customer" with an empty email field keeps the modal open with no error message. The email field is marked with `*` but no user-visible error appears.

Screenshot: `.gstack/qa-reports/screenshots/add-customer-validation.png`

**Fix:** In the `saveCustomer()` JS function, check the email field and show an inline error message (similar to how the compose modal shows "Subject is required.").

---

**ISSUE-011 · Medium · Functional**  
**Generated drafts missing sender name signature**

"Generate follow-up draft" produces emails ending with just "Best regards" — no sender name or signature. Unprofessional to send.

Screenshot: `.gstack/qa-reports/screenshots/generate-draft.png`

**Fix:** Append the user's name from the session (`req.session.userName`) to the draft body in the `generateDraft` handler.

---

**ISSUE-012 · Medium · Security**  
**`followUpDays` input not validated as a number**

`server.js:182-188`: `followUpDays` from `req.body` is converted to string via `String(followUpDays)` and used in a parameterized SQL query. While parameterized queries prevent injection, non-numeric values will cause a PostgreSQL interval parse error that surfaces as a 500 to the client.

**Fix:**
```js
const days = parseInt(followUpDays, 10);
if (isNaN(days) || days < 1 || days > 365) return res.status(400).json({ error: 'followUpDays must be 1–365' });
```

---

### LOW / CONFIG

---

**ISSUE-013 · Low · Config**  
**No `.env.example` file**

No template exists for required environment variables. New developers will discover missing vars at runtime rather than setup time.

**Fix:** Create `.env.example`:
```
MS_CLIENT_ID=
MS_CLIENT_SECRET=
MS_TENANT_ID=common
SESSION_SECRET=generate-a-random-64-char-string
DATABASE_URL=postgresql://user:password@localhost:5432/outlook_crm
REDIRECT_URI=http://localhost:3000/crm/auth/callback
WEB_UI_PORT=3000
NODE_ENV=development
```

---

**ISSUE-014 · Low · Config**  
**`console.error` used for startup info messages**

`server.js:429-431` uses `console.error` for startup info. These appear as errors in log aggregators (Datadog, CloudWatch) and will create false alerts.

**Fix:** Use `console.log` for informational startup messages.

---

**ISSUE-015 · Low · Config**  
**No graceful shutdown — DB pool left open on SIGTERM**

No `process.on('SIGTERM')` handler. When the process is killed (e.g., by Docker, PM2, or Kubernetes), the PostgreSQL connection pool is not closed cleanly, potentially leaving open connections.

**Fix:**
```js
process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});
```

---

**ISSUE-016 · Low · UX**  
**10MB JSON body limit is excessive for a CRM**

`server.js:12`: `express.json({ limit: '10mb' })`. CRM text data (emails, notes) should never be 10MB. This allows oversized payloads that could cause memory pressure.

**Fix:** `express.json({ limit: '100kb' })` for the CRM routes.

---

## What Works Well

- All SQL queries use parameterized queries — no SQL injection risk
- `esc()` HTML-escaping function is applied consistently to all user data in `innerHTML` templates — no XSS risk
- Session store uses PostgreSQL (`connect-pg-simple`) — sessions survive server restarts
- Multi-user data isolation: all tables partitioned by `user_email`, enforced in every query
- Dev-login route properly gated behind `NODE_ENV !== 'production'`
- `.env` is in `.gitignore`
- Core CRM flows work end-to-end: add customer, follow-up, note, quotation, timeline, draft generation, draft approve/reject/edit
- No console errors during any testing
- Compose email has proper validation feedback

---

## PR Summary

> QA found 16 issues (3 critical, 5 high, 4 medium, 4 low). App is NOT production-ready. Mail.Send scope missing breaks email sending for all real OAuth users. DB password hardcoded in source. No token refresh for 1-hour expiry. Fix criticals before any public deployment.

