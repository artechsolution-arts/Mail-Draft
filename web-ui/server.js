'use strict';

const express      = require('express');
const path         = require('path');
const http         = require('http');
const https        = require('https');
const fs           = require('fs');
const os           = require('os');
const session      = require('express-session');
const PgSession    = require('connect-pg-simple')(session);
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const multer       = require('multer');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// ── Detect LAN IP for multi-user access ──────────────────────────────────────
function getLanIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}
const LAN_IP = process.env.SERVER_HOST || getLanIp();

// Memory storage — files never touch disk; passed directly to Graph API as base64
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 24 * 1024 * 1024, files: 10 }, // 24 MB per file, up to 10 files
});

const app = express();

// Trust Railway / Render / Heroku reverse proxy so secure cookies work over HTTPS
app.set('trust proxy', 1);

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:    ["'self'"],
      scriptSrc:     ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc:      ["'self'", "'unsafe-inline'", 'fonts.googleapis.com', 'api.fontshare.com'],
      fontSrc:       ["'self'", 'fonts.gstatic.com', 'api.fontshare.com', 'cdn.fontshare.com'],
      imgSrc:        ["'self'", 'data:'],
      connectSrc:    ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 120,              // 120 requests / min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,
  message: { error: 'Too many auth attempts.' },
});
app.use('/api/', apiLimiter);
app.use('/crm/auth/', authLimiter);

app.use(express.json({ limit: '500kb' }));

const { authTools, tokenStorage } = require('../auth');
const { emailTools }              = require('../email');
const crmStorage                  = require('../crm/storage');
const { pool }                    = require('../crm/db');
const syncWorker                  = require('../crm/sync-worker');
const { syncFolder }              = syncWorker;
const apiKeysMgr                  = require('../crm/api-keys');
const v1Router                    = require('../crm/v1-router');

// ── Session ───────────────────────────────────────────────────────────────────
app.use(session({
  store: new PgSession({ pool, tableName: 'session', createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || ((process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT)
    ? (() => { console.error('FATAL: SESSION_SECRET must be set in production'); process.exit(1); })()
    : 'dev-only-insecure-secret'),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT, maxAge: 7 * 24 * 60 * 60 * 1000 },
}));

// ── Auth helpers ──────────────────────────────────────────────────────────────
const PORT             = process.env.PORT || process.env.WEB_UI_PORT || 3000;
const MS_CLIENT_ID     = process.env.MS_CLIENT_ID   || process.env.OUTLOOK_CLIENT_ID     || '';
const MS_CLIENT_SECRET = process.env.MS_CLIENT_SECRET || process.env.OUTLOOK_CLIENT_SECRET || '';
const MS_TENANT_ID     = process.env.MS_TENANT_ID   || 'common';
const _hasCert         = fs.existsSync(path.join(__dirname, '../certs/cert.pem'));
const _proto           = _hasCert ? 'https' : 'http';
const REDIRECT_URI     = process.env.REDIRECT_URI || `${_proto}://${LAN_IP}:${PORT}/crm/auth/callback`;
const crypto           = require('crypto');

function requireAuth(req, res, next) {
  if (req.session?.userEmail) return next();
  if ((req.originalUrl || req.path).startsWith('/api/')) return res.status(401).json({ error: 'Not authenticated', redirect: '/' });
  res.redirect('/');
}

function httpsPost(url, data) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(data).toString();
    const u    = new URL(url);
    const req  = https.request({
      hostname: u.hostname, port: 443, path: u.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
      timeout: 30000,
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(raw); } });
    });
    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timed out')));
    req.write(body);
    req.end();
  });
}

function bearerGet(url, token) {
  return new Promise((resolve, reject) => {
    const u   = new URL(url);
    const req = https.request({
      hostname: u.hostname, port: 443, path: u.pathname,
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(raw); } });
    });
    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timed out')));
    req.end();
  });
}

async function getValidToken(req) {
  if (!req.session.accessToken) return null;
  const expiresAt = req.session.tokenExpiresAt || 0;
  if (Date.now() < expiresAt - 5 * 60 * 1000) return req.session.accessToken;
  if (!req.session.refreshToken) return null;
  try {
    const tokens = await httpsPost(
      `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
      { client_id: MS_CLIENT_ID, client_secret: MS_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: req.session.refreshToken }
    );
    if (tokens.error) return null;
    req.session.accessToken    = tokens.access_token;
    if (tokens.refresh_token) req.session.refreshToken = tokens.refresh_token;
    req.session.tokenExpiresAt = Date.now() + (tokens.expires_in || 3600) * 1000;
    return tokens.access_token;
  } catch { return null; }
}

// ── OAuth routes ──────────────────────────────────────────────────────────────
app.get('/crm/auth/login', (req, res) => {
  if (!MS_CLIENT_ID) return res.status(500).send('MS_CLIENT_ID not set in .env');
  const state = crypto.randomBytes(20).toString('hex');
  req.session.oauthState = state;
  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: 'openid email profile User.Read offline_access Mail.Read Mail.Send',
    state,
    prompt: 'select_account',
  });
  res.redirect(`https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/authorize?${params}`);
});

app.get('/crm/auth/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;
  if (error) {
    console.error('[auth] Microsoft OAuth error:', error, '|', error_description);
    return res.redirect(`/login?error=${encodeURIComponent(error_description || error)}`);
  }
  console.log('[auth] callback received — code:', !!code, 'state match:', state === req.session.oauthState, 'sessionState:', req.session.oauthState?.slice(0,8));
  if (!code || state !== req.session.oauthState) return res.redirect('/login?error=invalid_state');

  try {
    const tokens = await httpsPost(
      `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
      { client_id: MS_CLIENT_ID, client_secret: MS_CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI }
    );
    console.log('[auth] token response — error:', tokens.error, '|', tokens.error_description);
    if (tokens.error) return res.redirect(`/login?error=${encodeURIComponent(tokens.error_description || tokens.error)}`);

    const me    = await bearerGet('https://graph.microsoft.com/v1.0/me', tokens.access_token);
    const email = (me.mail || me.userPrincipalName || '').toLowerCase();
    if (!email) return res.redirect('/login?error=no_email');

    await crmStorage.ensureUser(email, me.displayName || '');
    req.session.userEmail      = email;
    req.session.userName       = me.displayName || email;
    req.session.accessToken    = tokens.access_token;
    req.session.refreshToken   = tokens.refresh_token;
    req.session.tokenExpiresAt = Date.now() + (tokens.expires_in || 3600) * 1000;
    delete req.session.oauthState;

    // Persist tokens for background auto-sync worker
    await syncWorker.saveTokens(email, {
      accessToken:  tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt:    Date.now() + (tokens.expires_in || 3600) * 1000,
    });

    res.redirect('/');
  } catch (e) {
    console.error('OAuth callback error:', e.message);
    res.redirect(`/login?error=${encodeURIComponent(e.message)}`);
  }
});

app.get('/crm/auth/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Serve React build when available
const reactDist = path.join(__dirname, 'public', 'dist');
if (require('fs').existsSync(reactDist)) {
  app.use(express.static(reactDist));
}

// ── Static files (login page, crm page) ──────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── REST API v1 (API-key authenticated, CORS enabled) ─────────────────────────
app.use('/v1', v1Router);

// ── Outlook connection status ─────────────────────────────────────────────────
app.get('/api/crm/auth/status', requireAuth, async (req, res) => {
  try {
    const ue = req.session.userEmail;
    const { rows } = await pool.query(
      'SELECT access_token, token_expires_at FROM crm_tokens WHERE user_email=$1', [ue]
    );
    const row = rows[0];
    const connected = !!(row?.access_token && (!row.token_expires_at || row.token_expires_at > Date.now() + 60000));
    const sessionConnected = !!(req.session.accessToken && req.session.tokenExpiresAt > Date.now() + 60000);
    res.json({ connected: connected || sessionConnected, loginUrl: '/crm/auth/login' });
  } catch (e) { res.json({ connected: false, loginUrl: '/crm/auth/login' }); }
});

// ── API key management — web UI endpoints (session-authenticated) ─────────────
app.get('/api/crm/api-keys', requireAuth, async (req, res) => {
  try { res.json(await apiKeysMgr.listApiKeys(req.session.userEmail)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/crm/api-keys', requireAuth, async (req, res) => {
  const name = (req.body.name || '').trim().slice(0, 100) || 'My App';
  try {
    const result = await apiKeysMgr.createApiKey(req.session.userEmail, name);
    res.status(201).json(result); // includes raw key — shown once
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/crm/api-keys/:id', requireAuth, async (req, res) => {
  try {
    const ok = await apiKeysMgr.revokeApiKey(req.session.userEmail, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Key not found or already revoked' });
    res.json({ revoked: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Current user ──────────────────────────────────────────────────────────────
app.get('/api/crm/me', requireAuth, (req, res) => {
  res.json({ email: req.session.userEmail, name: req.session.userName });
});

// ── CRM API (all protected) ───────────────────────────────────────────────────
// DEV-ONLY: instant login for local testing without Microsoft OAuth
if (process.env.NODE_ENV !== 'production') {
  app.get('/crm/dev-login', async (req, res) => {
    const email = (req.query.email || 'dev@localhost').toLowerCase();
    const name  = req.query.name  || 'Dev User';
    await crmStorage.ensureUser(email, name);
    req.session.userEmail = email;
    req.session.userName  = name;
    res.redirect('/');
  });
}

app.use('/api/crm', requireAuth);

// ── Send email + auto follow-up (supports file attachments) ──────────────────
app.post('/api/crm/customers/:customerEmail/send-email',
  upload.array('attachments', 10),
  async (req, res) => {
    const { callGraphAPI } = require('../utils/graph-api');
    const ue = req.session.userEmail;
    const ce = req.params.customerEmail;
    const { subject, body, cc, followUpDays } = req.body;

    if (!subject || !body) return res.status(400).json({ error: 'subject and body are required' });

    if (followUpDays !== undefined) {
      const d = parseInt(followUpDays, 10);
      if (isNaN(d) || d < 1 || d > 365) return res.status(400).json({ error: 'followUpDays must be 1–365' });
    }

    const token = await getValidToken(req);
    if (!token) return res.status(401).json({ error: 'No access token — please sign in again', redirect: '/' });

    // Build Graph API attachments array from uploaded files
    const attachments = (req.files || []).map(f => ({
      '@odata.type':  '#microsoft.graph.fileAttachment',
      name:            f.originalname,
      contentType:     f.mimetype || 'application/octet-stream',
      contentBytes:    f.buffer.toString('base64'),
    }));

    try {
      await callGraphAPI(token, 'POST', 'me/sendMail', {
        message: {
          subject,
          body: { contentType: 'text', content: body },
          toRecipients: [{ emailAddress: { address: ce } }],
          ccRecipients: cc ? cc.split(',').map(e => ({ emailAddress: { address: e.trim() } })) : [],
          attachments,
        },
        saveToSentItems: true,
      });

      await crmStorage.recordEmail(ue, ce, { subject, body, date: new Date().toISOString() }, 'sent');

      if (followUpDays) {
        const { query } = require('../crm/db');
        await query(
          `UPDATE crm_follow_ups SET due_at = NOW() + ($1 || ' days')::interval
           WHERE user_email=$2 AND customer_email=$3 AND status='pending'
           AND created_at = (SELECT MAX(created_at) FROM crm_follow_ups WHERE user_email=$2 AND customer_email=$3 AND status='pending')`,
          [String(followUpDays), ue, ce]
        );
      }

      res.json({ ok: true, attachments: attachments.length });
    } catch (e) {
      console.error('Send email error:', e.message);
      res.status(500).json({ error: e.message });
    }
  }
);

app.get('/api/crm/customers', async (req, res) => {
  try { res.json(await crmStorage.listCustomers(req.session.userEmail)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/crm/customers/:email', async (req, res) => {
  try {
    const c = await crmStorage.getCustomer(req.session.userEmail, req.params.email);
    if (!c) return res.status(404).json({ error: 'Customer not found' });
    res.json(c);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/crm/customers', async (req, res) => {
  try { res.json(await crmStorage.upsertCustomer(req.session.userEmail, req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// ── Excel / CSV bulk import ────────────────────────────────────────────────────
const xlsxImport = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const ok = /\.(xlsx|xls|csv)$/i.test(file.originalname);
    cb(ok ? null : new Error('Only .xlsx, .xls, or .csv files are accepted'), ok);
  },
});

function detectColumns(keys) {
  function find(patterns) { return keys.find(k => patterns.some(p => p.test(k.trim()))) || null; }
  return {
    email:   find([/^email$/i, /e[\s_-]?mail/i, /email[\s_-]?address/i]),
    name:    find([/^name$/i, /full[\s_-]?name/i, /customer[\s_-]?name/i, /contact[\s_-]?name/i]),
    first:   find([/^first[\s_-]?name$/i, /^first$/i]),
    last:    find([/^last[\s_-]?name$/i, /^last$/i, /^surname$/i]),
    company: find([/^company$/i, /^org(anization)?$/i, /^business$/i, /^firm$/i, /^account$/i]),
    phone:   find([/^phone$/i, /^mobile$/i, /^tel(ephone)?$/i, /^contact[\s_-]?no$/i, /^ph$/i]),
  };
}

app.post('/api/crm/customers/import/preview', requireAuth, xlsxImport.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const XLSX = require('xlsx');
    const wb   = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '', range: 0 });
    if (!rows.length) return res.status(400).json({ error: 'No data rows found' });
    const rawCols = Object.keys(rows[0]);
    const detected = detectColumns(rawCols);
    res.json({ rowCount: rows.length, sheet: wb.SheetNames[0], columns: rawCols.slice(0, 20), detected });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/crm/customers/import', requireAuth, xlsxImport.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const XLSX = require('xlsx');
    const wb   = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (!rows.length) return res.status(400).json({ error: 'The file contains no data rows' });

    const { email: emailCol, name: nameCol, first: firstCol, last: lastCol, company: companyCol, phone: phoneCol } = detectColumns(Object.keys(rows[0]));

    const ue = req.session.userEmail;
    let created = 0, skipped = 0, errors = [];

    for (const [i, row] of rows.entries()) {
      const rawEmail = emailCol ? String(row[emailCol] || '').trim().toLowerCase() : '';
      if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
        skipped++;
        if (i < 5) errors.push(`Row ${i + 2}: invalid or missing email "${rawEmail}"`);
        continue;
      }
      // Build name from name column or first+last
      let name = nameCol ? String(row[nameCol] || '').trim() : '';
      if (!name && firstCol) name = [String(row[firstCol]||''), lastCol ? String(row[lastCol]||'') : ''].filter(Boolean).join(' ').trim();

      const company = companyCol ? String(row[companyCol] || '').trim() : '';
      const phone   = phoneCol   ? String(row[phoneCol]   || '').trim() : '';

      try {
        await crmStorage.upsertCustomer(ue, { email: rawEmail, name: name || null, company: company || null, phone: phone || null });
        created++;
      } catch (e) {
        skipped++;
        if (errors.length < 5) errors.push(`Row ${i + 2}: ${e.message}`);
      }
    }

    res.json({ total: rows.length, created, skipped, errors, columns: { email: emailCol, name: nameCol||`${firstCol}+${lastCol}`, company: companyCol, phone: phoneCol } });
  } catch (e) {
    console.error('Import error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/crm/customers/:email/notes', async (req, res) => {
  try { res.json(await crmStorage.addNote(req.session.userEmail, req.params.email, req.body.text)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/crm/customers/:email/quotations', async (req, res) => {
  try { res.json(await crmStorage.addQuotation(req.session.userEmail, req.params.email, req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/crm/customers/:email/followup', async (req, res) => {
  try { res.json(await crmStorage.addFollowUp(req.session.userEmail, req.params.email, req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

app.patch('/api/crm/customers/:email/followup/:id', async (req, res) => {
  try { res.json(await crmStorage.updateFollowUp(req.session.userEmail, req.params.id, req.body.status)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/crm/followups/overdue', async (req, res) => {
  try { res.json(await crmStorage.getPendingFollowUps(req.session.userEmail)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/crm/drafts', async (req, res) => {
  try { res.json(await crmStorage.listDrafts(req.session.userEmail, req.query.status)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/crm/drafts/:id', async (req, res) => {
  try { res.json(await crmStorage.updateDraft(req.session.userEmail, req.params.id, req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// ── Re-generate a draft with Ollama ──────────────────────────────────────────
app.post('/api/crm/drafts/:id/regenerate', async (req, res) => {
  try {
    const ue    = req.session.userEmail;
    const draft = await crmStorage.getDraft(ue, req.params.id);
    if (!draft) return res.status(404).json({ error: 'Draft not found' });
    if (draft.status === 'sent') return res.status(400).json({ error: 'Draft already sent' });

    // Mark as generating immediately so the UI shows the spinner
    const updated = await crmStorage.updateDraft(ue, draft.id, {
      generationStatus: 'generating', body: '',
    });
    res.json(updated);

    // Fire-and-forget regeneration
    (async () => {
      try {
        const ollama   = require('../crm/ollama');
        const user     = await crmStorage.getUser(ue);
        const customer = await crmStorage.getCustomer(ue, draft.customerEmail);
        const result   = await ollama.generateEmailDraft({
          senderName:      user?.name || ue,
          customer:        { email: draft.customerEmail, name: draft.customerName || '', company: customer?.company || '' },
          receivedSubject: draft.sourceSubject || draft.subject || '',
          receivedBody:    draft.sourceBody || '',
          notes:           customer?.notes || [],
          sentEmails:      customer?.sentEmails || [],
        });
        await crmStorage.updateDraft(ue, draft.id, {
          body: result.body, generatedBy: 'ollama',
          ollamaModel: result.model, generationStatus: 'pending',
        });
      } catch (err) {
        console.error('[regenerate] Ollama error:', err.message);
        await crmStorage.updateDraft(ue, draft.id, {
          body: '(AI generation failed — please write your reply manually)',
          generationStatus: 'failed',
        }).catch(() => {});
      }
    })();
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/crm/process-email', async (req, res) => {
  try {
    const ue = req.session.userEmail;
    const { customerEmail, customerName, subject, body, date, emailId } = req.body;
    if (!customerEmail) return res.status(400).json({ error: 'customerEmail is required' });

    await crmStorage.upsertCustomer(ue, { email: customerEmail, name: customerName || '' });
    await crmStorage.recordEmail(ue, customerEmail, { subject, body, date, emailId }, 'received');

    // Create a placeholder draft immediately so the UI can poll for it
    const draft = await crmStorage.addDraft(ue, {
      customerEmail, customerName: customerName || '',
      inReplyTo: emailId || '',
      subject: subject?.startsWith('Re:') ? subject : `Re: ${subject}`,
      body: '',
      sourceSubject: subject || '',
      sourceBody: body || '',
      generationStatus: 'generating',
    });

    // Respond immediately — UI will refresh when generation completes
    res.json(draft);

    // Fire-and-forget Ollama draft generation
    (async () => {
      try {
        const ollama   = require('../crm/ollama');
        const user     = await crmStorage.getUser(ue);
        const customer = await crmStorage.getCustomer(ue, customerEmail);
        const result   = await ollama.generateEmailDraft({
          senderName:      user?.name || ue,
          customer:        { email: customerEmail, name: customerName || customer?.name || '', company: customer?.company || '' },
          receivedSubject: subject || '',
          receivedBody:    body || '',
          notes:           customer?.notes || [],
          sentEmails:      customer?.sentEmails || [],
        });
        await crmStorage.updateDraft(ue, draft.id, {
          body:             result.body,
          generatedBy:      'ollama',
          ollamaModel:      result.model,
          generationStatus: 'pending',
        });
      } catch (err) {
        console.error('Ollama draft generation failed for draft', draft.id, ':', err.message);
        await crmStorage.updateDraft(ue, draft.id, {
          body:             '(AI generation failed — please write your reply manually)',
          generationStatus: 'failed',
        }).catch(() => {});
      }
    })();
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── Send an approved draft via Graph API (supports file attachments) ──────────
app.post('/api/crm/drafts/:id/send', upload.array('attachments', 10), async (req, res) => {
  const { callGraphAPI } = require('../utils/graph-api');
  const ue      = req.session.userEmail;
  const draftId = req.params.id;

  const token = await getValidToken(req);
  if (!token) return res.status(401).json({ error: 'No access token — please sign in again', redirect: '/' });

  try {
    const draft = await crmStorage.getDraft(ue, draftId);
    if (!draft) return res.status(404).json({ error: 'Draft not found' });
    if (draft.status === 'sent') return res.status(400).json({ error: 'Already sent' });
    if (draft.generationStatus === 'generating') return res.status(400).json({ error: 'Draft is still being generated, please wait' });

    const bodyToSend = (req.body.body || draft.body || '').trim();
    if (!bodyToSend) return res.status(400).json({ error: 'Email body is empty' });

    const attachments = (req.files || []).map(f => ({
      '@odata.type':  '#microsoft.graph.fileAttachment',
      name:            f.originalname,
      contentType:     f.mimetype || 'application/octet-stream',
      contentBytes:    f.buffer.toString('base64'),
    }));

    await callGraphAPI(token, 'POST', 'me/sendMail', {
      message: {
        subject:      draft.subject,
        body:         { contentType: 'text', content: bodyToSend },
        toRecipients: [{ emailAddress: { address: draft.customerEmail } }],
        attachments,
      },
      saveToSentItems: true,
    });

    await crmStorage.recordEmail(ue, draft.customerEmail, { subject: draft.subject, body: bodyToSend, date: new Date().toISOString() }, 'sent');
    const updated = await crmStorage.updateDraft(ue, draftId, { status: 'sent', editedBody: bodyToSend });
    res.json({ ...updated, attachments: attachments.length });
  } catch (e) {
    console.error('Send draft error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Escalate draft ────────────────────────────────────────────────────────────
app.post('/api/crm/drafts/:id/escalate', requireAuth, async (req, res) => {
  try {
    const { callGraphAPI } = require('../utils/graph-api');
    const ue      = req.session.userEmail;
    const draftId = req.params.id;
    const { escalateTo, note } = req.body;

    if (!escalateTo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(escalateTo.trim())) {
      return res.status(400).json({ error: 'A valid escalation email address is required' });
    }

    const draft    = await crmStorage.getDraft(ue, draftId);
    if (!draft) return res.status(404).json({ error: 'Draft not found' });
    if (draft.status === 'sent') return res.status(400).json({ error: 'Draft already sent' });

    const customer = await crmStorage.getCustomer(ue, draft.customerEmail);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    // Build full HTML history email
    const received   = (customer.receivedEmails || []).slice(0, 30);
    const sent       = (customer.sentEmails     || []).slice(0, 30);
    const allEmails  = [...received.map(e => ({ ...e, dir: 'Received' })), ...sent.map(e => ({ ...e, dir: 'Sent' }))]
      .sort((a, b) => new Date(a.date || a.recordedAt) - new Date(b.date || b.recordedAt));
    const notes      = (customer.notes      || []).slice(0, 20);
    const quotes     = (customer.quotations || []).slice(0, 10);
    const followUps  = (customer.followUps  || []).filter(f => f.status === 'pending').slice(0, 10);

    function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    const emailRows = allEmails.map(e => `
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:8px 12px;font-size:12px;color:#6b7280;white-space:nowrap">${new Date(e.date || e.recordedAt).toLocaleString()}</td>
        <td style="padding:8px 12px;font-size:12px">
          <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;${e.dir==='Received'?'background:#dbeafe;color:#1d4ed8':'background:#dcfce7;color:#166534'}">${e.dir}</span>
        </td>
        <td style="padding:8px 12px;font-size:13px;font-weight:600">${esc(e.subject)}</td>
        <td style="padding:8px 12px;font-size:12px;color:#374151;max-width:400px">${esc((e.body||'').slice(0,300))}${(e.body||'').length>300?'…':''}</td>
      </tr>`).join('');

    const noteRows = notes.map(n => `
      <li style="margin-bottom:6px;font-size:13px;color:#374151">
        ${esc(n.text)} <span style="color:#9ca3af;font-size:11px">${new Date(n.createdAt).toLocaleDateString()}</span>
      </li>`).join('');

    const quoteRows = quotes.map(q => `
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:8px 12px;font-size:13px;font-weight:600">${esc(q.reference)}</td>
        <td style="padding:8px 12px;font-size:12px">${esc(q.description)}</td>
        <td style="padding:8px 12px;font-size:12px">${esc(q.amount)} ${esc(q.currency)}</td>
        <td style="padding:8px 12px;font-size:12px">${q.validUntil ? new Date(q.validUntil).toLocaleDateString() : '—'}</td>
      </tr>`).join('');

    const fuRows = followUps.map(f => `
      <li style="margin-bottom:6px;font-size:13px;color:#374151">
        <strong>${esc(f.subject||'No subject')}</strong> — Due ${new Date(f.dueAt).toLocaleDateString()}
        ${f.note ? `<br><span style="color:#6b7280">${esc(f.note)}</span>` : ''}
      </li>`).join('');

    const htmlBody = `
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:system-ui,sans-serif;color:#1c1917;max-width:800px;margin:0 auto;padding:24px">

<div style="background:#b45309;color:#fff;border-radius:10px 10px 0 0;padding:20px 24px">
  <h1 style="margin:0;font-size:20px">⚠️ Escalation — Action Required</h1>
  <p style="margin:6px 0 0;font-size:13px;opacity:.9">Escalated by ${esc(ue)}</p>
</div>

<div style="border:1px solid #e5e2dc;border-top:none;border-radius:0 0 10px 10px;padding:24px">

  ${note ? `<div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:14px 16px;margin-bottom:20px">
    <strong style="font-size:13px">Note from ${esc(ue)}:</strong><br>
    <span style="font-size:13px">${esc(note)}</span>
  </div>` : ''}

  <!-- Customer -->
  <h2 style="font-size:15px;font-weight:700;margin-bottom:12px;border-bottom:2px solid #b45309;padding-bottom:6px">Customer Profile</h2>
  <table style="font-size:13px;margin-bottom:20px">
    <tr><td style="color:#6b7280;padding:3px 16px 3px 0;white-space:nowrap">Name</td><td><strong>${esc(customer.name||'—')}</strong></td></tr>
    <tr><td style="color:#6b7280;padding:3px 16px 3px 0">Email</td><td>${esc(customer.email)}</td></tr>
    <tr><td style="color:#6b7280;padding:3px 16px 3px 0">Company</td><td>${esc(customer.company||'—')}</td></tr>
    <tr><td style="color:#6b7280;padding:3px 16px 3px 0">Phone</td><td>${esc(customer.phone||'—')}</td></tr>
    <tr><td style="color:#6b7280;padding:3px 16px 3px 0">Since</td><td>${new Date(customer.since||customer.createdAt||Date.now()).toLocaleDateString()}</td></tr>
  </table>

  <!-- Draft being escalated -->
  <h2 style="font-size:15px;font-weight:700;margin-bottom:12px;border-bottom:2px solid #b45309;padding-bottom:6px">Draft Being Escalated</h2>
  <div style="background:#f7f5f2;border:1px solid #e5e2dc;border-radius:8px;padding:16px;margin-bottom:20px">
    <p style="margin:0 0 8px;font-size:12px;color:#6b7280"><strong>Subject:</strong> ${esc(draft.subject)}</p>
    <p style="margin:0 0 8px;font-size:12px;color:#6b7280"><strong>In reply to:</strong> ${esc(draft.sourceSubject||draft.inReplyTo||'—')}</p>
    <div style="border-top:1px solid #e5e2dc;padding-top:12px;margin-top:12px;font-size:13px;white-space:pre-wrap">${esc(draft.body||'(empty)')}</div>
  </div>

  <!-- Email history -->
  <h2 style="font-size:15px;font-weight:700;margin-bottom:12px;border-bottom:2px solid #b45309;padding-bottom:6px">Full Email History (${allEmails.length} emails)</h2>
  ${allEmails.length ? `<table style="width:100%;border-collapse:collapse;margin-bottom:20px">
    <thead><tr style="background:#f7f5f2">
      <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280">Date</th>
      <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280">Dir</th>
      <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280">Subject</th>
      <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280">Preview</th>
    </tr></thead>
    <tbody>${emailRows}</tbody>
  </table>` : '<p style="font-size:13px;color:#9ca3af;margin-bottom:20px">No emails recorded yet.</p>'}

  <!-- AI Summary -->
  ${customer.aiSummary ? `<h2 style="font-size:15px;font-weight:700;margin-bottom:12px;border-bottom:2px solid #b45309;padding-bottom:6px">AI Summary</h2>
  <p style="font-size:13px;line-height:1.6;margin-bottom:20px">${esc(customer.aiSummary)}</p>` : ''}

  <!-- Notes -->
  ${notes.length ? `<h2 style="font-size:15px;font-weight:700;margin-bottom:12px;border-bottom:2px solid #b45309;padding-bottom:6px">Internal Notes (${notes.length})</h2>
  <ul style="padding-left:20px;margin-bottom:20px">${noteRows}</ul>` : ''}

  <!-- Quotations -->
  ${quotes.length ? `<h2 style="font-size:15px;font-weight:700;margin-bottom:12px;border-bottom:2px solid #b45309;padding-bottom:6px">Quotations (${quotes.length})</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
    <thead><tr style="background:#f7f5f2">
      <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280">Reference</th>
      <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280">Description</th>
      <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280">Amount</th>
      <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280">Valid Until</th>
    </tr></thead>
    <tbody>${quoteRows}</tbody>
  </table>` : ''}

  <!-- Follow-ups -->
  ${followUps.length ? `<h2 style="font-size:15px;font-weight:700;margin-bottom:12px;border-bottom:2px solid #b45309;padding-bottom:6px">Pending Follow-ups (${followUps.length})</h2>
  <ul style="padding-left:20px;margin-bottom:20px">${fuRows}</ul>` : ''}

  <hr style="border:none;border-top:1px solid #e5e2dc;margin:24px 0">
  <p style="font-size:11px;color:#9ca3af">This escalation was sent automatically from the CRM system by ${esc(ue)}.</p>
</div>
</body></html>`;

    // Always save escalation record to DB first — nothing is lost even if email fails
    const escalationId = await crmStorage.saveEscalation(ue, customer.email, draftId, escalateTo.trim(), note, false, null);

    const token = await syncWorker.getValidToken(ue, {
      clientId: process.env.MS_CLIENT_ID || process.env.OUTLOOK_CLIENT_ID,
      clientSecret: process.env.MS_CLIENT_SECRET || process.env.OUTLOOK_CLIENT_SECRET,
      tenantId: process.env.MS_TENANT_ID || 'common',
      redirectUri: REDIRECT_URI,
    });

    if (!token) {
      // Saved to DB but email not sent — tell the client so it can prompt for auth
      await pool.query('UPDATE crm_escalations SET send_error=$1 WHERE id=$2', ['No Outlook token', escalationId]);
      return res.status(401).json({
        error: 'Outlook is not connected. Please connect your Outlook account.',
        saved: true, escalationId,
        loginUrl: '/crm/auth/login',
      });
    }

    await callGraphAPI(token, 'POST', 'me/sendMail', {
      message: {
        subject: `[Escalation] ${customer.name || customer.email} — ${draft.subject || 'Customer Case'}`,
        body: { contentType: 'HTML', content: htmlBody },
        toRecipients: [{ emailAddress: { address: escalateTo.trim() } }],
      },
      saveToSentItems: true,
    });

    // Mark email as sent in DB
    await pool.query('UPDATE crm_escalations SET email_sent=TRUE WHERE id=$1', [escalationId]);
    const updated = await crmStorage.updateDraft(ue, draftId, { status: 'escalated' });
    res.json({ ok: true, escalatedTo: escalateTo.trim(), draft: updated });
  } catch (e) {
    console.error('Escalate error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Customer-level escalation (no specific draft required) ───────────────────
app.post('/api/crm/customers/:email/escalate', requireAuth, async (req, res) => {
  try {
    const { callGraphAPI } = require('../utils/graph-api');
    const ue           = req.session.userEmail;
    const customerEmail = decodeURIComponent(req.params.email);
    const { escalateTo, note } = req.body;

    if (!escalateTo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(escalateTo.trim())) {
      return res.status(400).json({ error: 'A valid escalation email address is required' });
    }

    const customer = await crmStorage.getCustomer(ue, customerEmail);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const received   = (customer.receivedEmails || []).slice(0, 30);
    const sent       = (customer.sentEmails     || []).slice(0, 30);
    const allEmails  = [...received.map(e => ({ ...e, dir: 'Received' })), ...sent.map(e => ({ ...e, dir: 'Sent' }))]
      .sort((a, b) => new Date(a.date || a.recordedAt) - new Date(b.date || b.recordedAt));
    const notes      = (customer.notes      || []).slice(0, 20);
    const quotes     = (customer.quotations || []).slice(0, 10);
    const followUps  = (customer.followUps  || []).filter(f => f.status === 'pending').slice(0, 10);

    function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    const emailRows = allEmails.map(e => `
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:8px 12px;font-size:12px;color:#6b7280;white-space:nowrap">${new Date(e.date || e.recordedAt).toLocaleString()}</td>
        <td style="padding:8px 12px;font-size:12px">
          <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;${e.dir==='Received'?'background:#dbeafe;color:#1d4ed8':'background:#dcfce7;color:#166534'}">${e.dir}</span>
        </td>
        <td style="padding:8px 12px;font-size:13px;font-weight:600">${esc(e.subject)}</td>
        <td style="padding:8px 12px;font-size:12px;color:#374151;max-width:400px">${esc((e.body||'').slice(0,300))}${(e.body||'').length>300?'…':''}</td>
      </tr>`).join('');

    const noteRows  = notes.map(n => `<li style="margin-bottom:6px;font-size:13px;color:#374151">${esc(n.text)} <span style="color:#9ca3af;font-size:11px">${new Date(n.createdAt).toLocaleDateString()}</span></li>`).join('');
    const quoteRows = quotes.map(q => `<tr style="border-bottom:1px solid #e5e7eb"><td style="padding:8px 12px;font-size:13px;font-weight:600">${esc(q.reference)}</td><td style="padding:8px 12px;font-size:12px">${esc(q.description)}</td><td style="padding:8px 12px;font-size:12px">${esc(q.amount)} ${esc(q.currency)}</td><td style="padding:8px 12px;font-size:12px">${q.validUntil ? new Date(q.validUntil).toLocaleDateString() : '—'}</td></tr>`).join('');
    const fuRows    = followUps.map(f => `<li style="margin-bottom:6px;font-size:13px;color:#374151"><strong>${esc(f.subject||'No subject')}</strong> — Due ${new Date(f.dueAt).toLocaleDateString()}${f.note ? `<br><span style="color:#6b7280">${esc(f.note)}</span>` : ''}</li>`).join('');

    const htmlBody = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:system-ui,sans-serif;color:#1c1917;max-width:800px;margin:0 auto;padding:24px">
<div style="background:#1A6AB4;color:#fff;border-radius:10px 10px 0 0;padding:20px 24px">
  <h1 style="margin:0;font-size:20px">⚠️ Escalation — Action Required</h1>
  <p style="margin:6px 0 0;font-size:13px;opacity:.9">Escalated by ${esc(ue)}</p>
</div>
<div style="border:1px solid #e5e2dc;border-top:none;border-radius:0 0 10px 10px;padding:24px">
  ${note ? `<div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:14px 16px;margin-bottom:20px"><strong style="font-size:13px">Note from ${esc(ue)}:</strong><br><span style="font-size:13px">${esc(note)}</span></div>` : ''}
  <h2 style="font-size:15px;font-weight:700;margin-bottom:12px;border-bottom:2px solid #1A6AB4;padding-bottom:6px">Customer Profile</h2>
  <table style="font-size:13px;margin-bottom:20px">
    <tr><td style="color:#6b7280;padding:3px 16px 3px 0;white-space:nowrap">Name</td><td><strong>${esc(customer.name||'—')}</strong></td></tr>
    <tr><td style="color:#6b7280;padding:3px 16px 3px 0">Email</td><td>${esc(customer.email)}</td></tr>
    <tr><td style="color:#6b7280;padding:3px 16px 3px 0">Company</td><td>${esc(customer.company||'—')}</td></tr>
    <tr><td style="color:#6b7280;padding:3px 16px 3px 0">Phone</td><td>${esc(customer.phone||'—')}</td></tr>
    <tr><td style="color:#6b7280;padding:3px 16px 3px 0">Since</td><td>${new Date(customer.since||customer.createdAt||Date.now()).toLocaleDateString()}</td></tr>
  </table>
  <h2 style="font-size:15px;font-weight:700;margin-bottom:12px;border-bottom:2px solid #1A6AB4;padding-bottom:6px">Full Email History (${allEmails.length} emails)</h2>
  ${allEmails.length ? `<table style="width:100%;border-collapse:collapse;margin-bottom:20px"><thead><tr style="background:#f7f5f2"><th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280">Date</th><th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280">Dir</th><th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280">Subject</th><th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280">Preview</th></tr></thead><tbody>${emailRows}</tbody></table>` : '<p style="font-size:13px;color:#9ca3af;margin-bottom:20px">No emails recorded yet.</p>'}
  ${notes.length ? `<h2 style="font-size:15px;font-weight:700;margin-bottom:12px;border-bottom:2px solid #1A6AB4;padding-bottom:6px">Internal Notes (${notes.length})</h2><ul style="padding-left:20px;margin-bottom:20px">${noteRows}</ul>` : ''}
  ${quotes.length ? `<h2 style="font-size:15px;font-weight:700;margin-bottom:12px;border-bottom:2px solid #1A6AB4;padding-bottom:6px">Quotations (${quotes.length})</h2><table style="width:100%;border-collapse:collapse;margin-bottom:20px"><thead><tr style="background:#f7f5f2"><th style="padding:8px 12px;text-align:left;font-size:11px">Reference</th><th style="padding:8px 12px;text-align:left;font-size:11px">Description</th><th style="padding:8px 12px;text-align:left;font-size:11px">Amount</th><th style="padding:8px 12px;text-align:left;font-size:11px">Valid Until</th></tr></thead><tbody>${quoteRows}</tbody></table>` : ''}
  ${followUps.length ? `<h2 style="font-size:15px;font-weight:700;margin-bottom:12px;border-bottom:2px solid #1A6AB4;padding-bottom:6px">Pending Follow-ups (${followUps.length})</h2><ul style="padding-left:20px;margin-bottom:20px">${fuRows}</ul>` : ''}
  <hr style="border:none;border-top:1px solid #e5e2dc;margin:24px 0">
  <p style="font-size:11px;color:#9ca3af">This escalation was sent automatically from the CRM system by ${esc(ue)}.</p>
</div></body></html>`;

    const escalationId = await crmStorage.saveEscalation(ue, customer.email, null, escalateTo.trim(), note, false, null);

    const token = await syncWorker.getValidToken(ue, {
      clientId: process.env.MS_CLIENT_ID || process.env.OUTLOOK_CLIENT_ID,
      clientSecret: process.env.MS_CLIENT_SECRET || process.env.OUTLOOK_CLIENT_SECRET,
      tenantId: process.env.MS_TENANT_ID || 'common',
      redirectUri: REDIRECT_URI,
    });

    if (!token) {
      await pool.query('UPDATE crm_escalations SET send_error=$1 WHERE id=$2', ['No Outlook token', escalationId]);
      return res.status(401).json({ error: 'Outlook is not connected.', saved: true, escalationId, loginUrl: '/crm/auth/login' });
    }

    await callGraphAPI(token, 'POST', 'me/sendMail', {
      message: {
        subject: `[Escalation] ${customer.name || customer.email} — Customer Case`,
        body: { contentType: 'HTML', content: htmlBody },
        toRecipients: [{ emailAddress: { address: escalateTo.trim() } }],
      },
      saveToSentItems: true,
    });

    await pool.query('UPDATE crm_escalations SET email_sent=TRUE WHERE id=$1', [escalationId]);
    res.json({ ok: true, escalatedTo: escalateTo.trim() });
  } catch (e) {
    console.error('Customer escalate error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── SSE — real-time push when background worker finds new emails ──────────────
app.get('/api/crm/stream', requireAuth, (req, res) => {
  const ue = req.session.userEmail;
  res.set({
    'Content-Type':      'text/event-stream',
    'Cache-Control':     'no-cache',
    'Connection':        'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('data: {"type":"connected"}\n\n');

  syncWorker.addSseClient(ue, res);

  // Keepalive ping every 25s to prevent proxy timeouts
  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(ping); }
  }, 25000);

  req.on('close', () => {
    clearInterval(ping);
    syncWorker.removeSseClient(ue, res);
  });
});

// ── Manual sync trigger (button click) ───────────────────────────────────────
app.post('/api/crm/trigger-sync', requireAuth, async (req, res) => {
  const ue = req.session.userEmail;
  try {
    const { rows: customers } = await pool.query(
      'SELECT email, name FROM crm_customers WHERE user_email=$1', [ue]
    );
    if (!customers.length) return res.json({ inbox: 0, sent: 0, message: 'No CRM customers yet' });

    const { rows: existingRows } = await pool.query(
      'SELECT outlook_id FROM crm_emails WHERE user_email=$1 AND outlook_id IS NOT NULL', [ue]
    );
    const existingIds = new Set(existingRows.map(r => r.outlook_id));
    const customerMap = new Map(customers.map(c => [c.email.toLowerCase(), c]));

    const token = await getValidToken(req);
    if (!token) return res.status(401).json({ error: 'No access token', redirect: '/' });

    // Save/refresh token in crm_tokens so background worker can reuse it
    if (req.session.refreshToken) {
      await syncWorker.saveTokens(ue, {
        accessToken:  token,
        refreshToken: req.session.refreshToken,
        expiresAt:    Date.now() + 55 * 60 * 1000,
      });
    }

    const { rows: stored } = await pool.query('SELECT last_inbox_sync, last_sent_sync FROM crm_tokens WHERE user_email=$1', [ue]);
    const s = stored[0] || {};

    const inboxCount = await syncFolder(ue, token, 'inbox',     s.last_inbox_sync, customerMap, existingIds);
    const sentCount  = await syncFolder(ue, token, 'sentitems', s.last_sent_sync,  customerMap, existingIds);

    const now = new Date();
    await pool.query(
      'UPDATE crm_tokens SET last_inbox_sync=$1, last_sent_sync=$2, updated_at=NOW() WHERE user_email=$3',
      [now, now, ue.toLowerCase()]
    );

    res.json({ inbox: inboxCount, sent: sentCount });
  } catch (e) {
    console.error('trigger-sync error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/crm/customers/:email/summary', async (req, res) => {
  try { await crmStorage.updateAiSummary(req.session.userEmail, req.params.email, req.body.summary); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/crm/settings', async (req, res) => {
  try { res.json(await crmStorage.getSettings(req.session.userEmail)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/crm/settings', async (req, res) => {
  try { await crmStorage.setFollowUpDays(req.session.userEmail, req.body.defaultDays); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// ── Email/Chat API (for the web UI chat — unchanged) ──────────────────────────
const ALL_TOOLS = [
  ...authTools.filter(t => t.name !== 'authenticate'),
  ...emailTools,
];
const TOOL_DEFINITIONS = ALL_TOOLS.map(t => ({
  type: 'function',
  function: { name: t.name, description: t.description, parameters: t.inputSchema || { type: 'object', properties: {} } },
}));
const MAX_TOOL_RESULT = 1200;

async function executeTool(name, args) {
  const tool = ALL_TOOLS.find(t => t.name === name);
  if (!tool) return `Error: tool "${name}" not found`;
  try {
    const result = await tool.handler(args || {});
    let text;
    if (result?.content?.[0]?.text) text = result.content[0].text;
    else if (result?.error) return `Error: ${result.error.message}`;
    else text = JSON.stringify(result);
    return text.length > MAX_TOOL_RESULT ? text.slice(0, MAX_TOOL_RESULT) + `\n…[truncated]` : text;
  } catch (err) { return `Error: ${err.message}`; }
}

function httpRequest(baseUrl, pathname, method, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, baseUrl);
    const lib = url.protocol === 'https:' ? https : http;
    const payload = body ? JSON.stringify(body) : null;
    const req = lib.request({
      hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search, method,
      headers: { 'Content-Type': 'application/json', ...(payload && { 'Content-Length': Buffer.byteLength(payload) }) },
      timeout: 120000,
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(data) }); } catch { resolve({ status: res.statusCode, body: data }); } });
    });
    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timed out')));
    if (payload) req.write(payload);
    req.end();
  });
}

function isOllama(baseUrl) { return baseUrl.includes('11434'); }
function parseToolArgs(raw) { if (!raw) return {}; if (typeof raw === 'object') return raw; try { return JSON.parse(raw); } catch { return {}; } }

async function callModel(baseUrl, model, messages, withTools = true) {
  if (isOllama(baseUrl)) {
    const body = { model, messages, stream: false, options: { temperature: 0.3, num_ctx: 2048 }, ...(withTools && { tools: TOOL_DEFINITIONS }) };
    const res = await httpRequest(baseUrl, '/api/chat', 'POST', body);
    if (res.status !== 200) throw new Error(`Model HTTP ${res.status}`);
    return { choices: [{ message: res.body.message }] };
  }
  const body = { model, messages, stream: false, temperature: 0.3, ...(withTools && { tools: TOOL_DEFINITIONS, tool_choice: 'auto' }) };
  const res = await httpRequest(baseUrl, '/v1/chat/completions', 'POST', body);
  if (res.status !== 200) throw new Error(`Model HTTP ${res.status}`);
  return res.body;
}

function routeToTool(text) {
  const q = text.toLowerCase();
  if (/unread|inbox/.test(q))        return { tool: 'list-emails',   args: { folder: 'inbox', count: 5, unreadOnly: true } };
  if (/search|find|look.?for/.test(q)) { const m = q.match(/(?:from|by)\s+([\w.]+)/); return { tool: 'search-emails', args: { query: m ? m[1] : q.slice(0,60), count: 5 } }; }
  if (/latest|newest|recent/.test(q)) return { tool: 'list-emails',   args: { folder: 'inbox', count: 3 } };
  if (/read|open|show|view/.test(q) && /email|message/.test(q)) return { tool: 'list-emails', args: { folder: 'inbox', count: 5 } };
  return null;
}

function formatEmailResult(raw) { return raw.replace(/\nID:\s*\S{40,}/g,'').replace(/\n…\[truncated.*\]/g,'').trim(); }

async function runAgenticLoop(baseUrl, model, userMessages) {
  const today = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const userText = userMessages.find(m => m.role === 'user')?.content || '';
  const route = routeToTool(userText);
  if (route) {
    const toolResult = await executeTool(route.tool, route.args);
    const formatMessages = [
      { role:'system', content: `Format email data as a clean numbered list. Today: ${today}.` },
      { role:'user', content: userText },
      { role:'assistant', content: null, tool_calls: [{ id:'r1', function: { name: route.tool, arguments: JSON.stringify(route.args) } }] },
      { role:'tool', tool_call_id:'r1', content: toolResult },
    ];
    try {
      const response = await callModel(baseUrl, model, formatMessages, false);
      return { content: response.choices?.[0]?.message?.content || formatEmailResult(toolResult), toolsUsed: [route] };
    } catch { return { content: formatEmailResult(toolResult), toolsUsed: [route] }; }
  }
  const messages = [{ role:'system', content:`You are an Outlook email assistant. Today: ${today}.` }, ...userMessages];
  const toolsUsed = [];
  for (let i = 0; i < 4; i++) {
    const response = await callModel(baseUrl, model, messages, i === 0);
    const msg = response.choices?.[0]?.message;
    if (!msg) throw new Error('Empty response');
    messages.push(msg);
    if (!msg.tool_calls?.length) return { content: msg.content || '', toolsUsed };
    for (const call of msg.tool_calls) {
      const name = call.function.name;
      const args = parseToolArgs(call.function.arguments);
      toolsUsed.push({ name, args });
      messages.push({ role:'tool', tool_call_id: call.id||'', content: await executeTool(name, args) });
    }
  }
  return { content: 'Reached maximum iterations.', toolsUsed };
}

app.get('/api/status', async (_req, res) => {
  let authenticated = false;
  try { const t = await tokenStorage.getValidAccessToken(); authenticated = !!t; } catch {}
  res.json({ authenticated, toolCount: ALL_TOOLS.length });
});

// ── CRM-aware Ollama chat ─────────────────────────────────────────────────────
async function buildCustomerContext(userEmail, query) {
  // Detect if the query references a customer (by email, name, or active-customer keyword)
  const emailMatch = query.match(/[\w.+-]+@[\w-]+\.\w+/);
  let customerEmail = emailMatch?.[0]?.toLowerCase() || null;

  // If no email in query, look for name patterns like "tell me about Syam" / "about customer X"
  if (!customerEmail && activeCustomerHint(query)) {
    // Can't know active customer server-side — caller passes it in meta
    customerEmail = null;
  }
  return customerEmail;
}
function activeCustomerHint(q) {
  return /about|summary|tell me|history|conversation|mail.*with|email.*with/.test(q.toLowerCase());
}

async function buildSystemPrompt(userEmail, customerEmail) {
  const today = new Date().toLocaleString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' });
  let ctx = '';

  if (customerEmail) {
    try {
      const c = await crmStorage.getCustomer(userEmail, customerEmail);
      if (c) {
        const received = (c.receivedEmails || []).slice(0, 20);
        const sent     = (c.sentEmails     || []).slice(0, 20);
        const notes    = (c.notes          || []).slice(0, 10);
        const quotes   = (c.quotations     || []).slice(0, 5);
        const fups     = (c.followUps      || []).filter(f => f.status === 'pending').slice(0, 5);

        const emailHistory = [
          ...received.map(e => `[${new Date(e.date||e.recordedAt).toLocaleDateString()}] RECEIVED — "${e.subject}"\n${(e.body||'').slice(0, 400)}`),
          ...sent.map(e    => `[${new Date(e.date||e.recordedAt).toLocaleDateString()}] SENT — "${e.subject}"\n${(e.body||'').slice(0, 400)}`),
        ].sort().join('\n\n---\n\n');

        ctx = `
=== CUSTOMER PROFILE ===
Name:    ${c.name || 'Unknown'}
Email:   ${customerEmail}
Company: ${c.company || 'N/A'}
Phone:   ${c.phone   || 'N/A'}

=== EMAIL HISTORY (${received.length} received, ${sent.length} sent) ===
${emailHistory || 'No emails recorded yet.'}

=== NOTES ===
${notes.map(n => `• ${n.text}`).join('\n') || 'No notes.'}

=== QUOTATIONS ===
${quotes.map(q => `• ${q.reference}: ${q.description||''} — ${q.amount||'N/A'} ${q.currency||''}`).join('\n') || 'None.'}

=== PENDING FOLLOW-UPS ===
${fups.map(f => `• ${f.subject||'No subject'} — due ${new Date(f.dueAt).toLocaleDateString()}`).join('\n') || 'None.'}

=== AI SUMMARY (if any) ===
${c.aiSummary || 'Not generated yet.'}
`;
      }
    } catch { /* customer not found — continue without context */ }
  }

  if (!customerEmail) {
    // General CRM context — customers + follow-ups + stats
    try {
      const [list, allFups] = await Promise.all([
        crmStorage.listCustomers(userEmail),
        crmStorage.getAllPendingFollowUps(userEmail),
      ]);
      const overdueFups  = allFups.filter(f => new Date(f.followUp.dueAt) <= new Date());
      const upcomingFups = allFups.filter(f => new Date(f.followUp.dueAt) >  new Date());
      const customerLines = list.map(c => `• ${c.name||c.email} <${c.email}> — ${c.receivedEmails?.length||0} received, ${c.sentEmails?.length||0} sent`).join('\n');
      const overdueLines  = overdueFups.map(f => `• ${f.customer.name||f.customer.email} <${f.customer.email}> — "${f.followUp.subject||'No subject'}" overdue since ${new Date(f.followUp.dueAt).toLocaleDateString()}`).join('\n');
      const upcomingLines = upcomingFups.map(f => `• ${f.customer.name||f.customer.email} <${f.customer.email}> — "${f.followUp.subject||'No subject'}" due ${new Date(f.followUp.dueAt).toLocaleDateString()}`).join('\n');
      ctx = `
=== YOUR CRM CUSTOMERS (${list.length} total) ===
${customerLines || 'No customers yet.'}

=== OVERDUE FOLLOW-UPS (${overdueFups.length}) ===
${overdueLines || 'None — all clear.'}

=== UPCOMING FOLLOW-UPS (${upcomingFups.length}) ===
${upcomingLines || 'None scheduled.'}
`;
    } catch {}
  }

  return `You are an intelligent CRM assistant for ${userEmail}. Today: ${today}.
Your job is to help the user understand their customer relationships, email conversations, and next actions.
When asked for a summary, be thorough — cover: relationship status, recent conversations, key topics discussed, pending actions, quotations, and recommended next steps.
Answer in clear, professional prose. Be specific and use actual data from the context provided.
${ctx}`;
}

app.post('/api/crm/chat', requireAuth, async (req, res) => {
  const { message, messages = [], customerEmail } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });

  const ollama  = require('../crm/ollama');
  const ollamaUrl   = process.env.OLLAMA_URL  || 'http://localhost:11434';
  const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.2:3b';
  const ue = req.session.userEmail;

  try {
    // Resolve customer from message or explicit param
    const emailInMsg = message.match(/[\w.+-]+@[\w-]+\.\w+/)?.[0]?.toLowerCase();
    const targetCustomer = customerEmail || emailInMsg || null;

    const systemPrompt = await buildSystemPrompt(ue, targetCustomer);

    // Build conversation history for multi-turn
    const history = messages.map(m => ({ role: m.role, content: m.content }));

    const payload = {
      model:  ollamaModel,
      stream: false,
      options: { temperature: 0.4, num_ctx: 8192 },
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user',   content: message },
      ],
    };

    const reply = await new Promise((resolve, reject) => {
      const body = JSON.stringify(payload);
      const u    = new URL(ollamaUrl);
      const req2 = http.request({
        hostname: u.hostname, port: u.port || 11434,
        path: '/api/chat', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout: 120000,
      }, r => {
        let d = '';
        r.on('data', c => d += c);
        r.on('end', () => {
          try { resolve(JSON.parse(d)); }
          catch { reject(new Error('Invalid JSON from Ollama: ' + d.slice(0, 200))); }
        });
      });
      req2.on('error', reject);
      req2.on('timeout', () => { req2.destroy(); reject(new Error('Ollama request timed out')); });
      req2.write(body); req2.end();
    });

    const content = reply.message?.content || reply.response || '';
    res.json({ content, model: ollamaModel });
  } catch (e) {
    console.error('CRM chat error:', e.message);
    res.status(500).json({ error: e.message, hint: 'Make sure Ollama is running: ollama serve' });
  }
});

// SPA fallback — serve React index.html for non-API routes
const reactIndex = path.join(__dirname, 'public', 'dist', 'index.html');
app.get('/{*path}', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/crm/auth') || req.path.startsWith('/v1')) return next();
  if (require('fs').existsSync(reactIndex)) return res.sendFile(reactIndex);
  next();
});

// ── Start ─────────────────────────────────────────────────────────────────────
const CERT_DIR  = path.join(__dirname, '../certs');
const CERT_FILE = path.join(CERT_DIR, 'cert.pem');
const KEY_FILE  = path.join(CERT_DIR, 'key.pem');
const USE_HTTPS = fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE);

const PROTO = USE_HTTPS ? 'https' : 'http';

function onListening() {
  console.log(`CRM Web UI (local)  → ${PROTO}://localhost:${PORT}/`);
  console.log(`CRM Web UI (LAN)    → ${PROTO}://${LAN_IP}:${PORT}/`);
  console.log(`Tools loaded: ${ALL_TOOLS.length}`);
  console.log(`OAuth callback: ${REDIRECT_URI}`);
  if (USE_HTTPS) console.log(`TLS: self-signed cert active (browser will warn once — click "Advanced → Proceed")`);

  if (MS_CLIENT_ID && MS_CLIENT_SECRET) {
    syncWorker.startWorker({ clientId: MS_CLIENT_ID, clientSecret: MS_CLIENT_SECRET, tenantId: MS_TENANT_ID });
  } else {
    console.warn('[sync] MS_CLIENT_ID or MS_CLIENT_SECRET missing — auto-sync disabled');
  }
}

if (USE_HTTPS) {
  const tlsOptions = {
    key:  fs.readFileSync(KEY_FILE),
    cert: fs.readFileSync(CERT_FILE),
  };
  https.createServer(tlsOptions, app).listen(PORT, '0.0.0.0', onListening);
} else {
  http.createServer(app).listen(PORT, '0.0.0.0', onListening);
}

async function shutdown() {
  syncWorker.stopWorker();
  await pool.end().catch(() => {});
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);
