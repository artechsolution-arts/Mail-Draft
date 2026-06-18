'use strict';

/**
 * CRM REST API — v1
 *
 * Authentication:
 *   Authorization: Bearer crm_live_<key>
 *   — OR —
 *   X-API-Key: crm_live_<key>
 *
 * All responses: { data, meta } on success  |  { error, meta } on failure
 * meta always contains: { timestamp, version, requestId }
 */

const express    = require('express');
const crypto     = require('crypto');
const { pool }   = require('./db');
const crmStorage = require('./storage');
const apiKeys    = require('./api-keys');
const syncWorker = require('./sync-worker');

const router = express.Router();

// ── CORS — allow any origin so external CRM systems can call this ─────────────
router.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.set({
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Access-Control-Max-Age':       '86400',
  });
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── Response helpers ──────────────────────────────────────────────────────────
function meta(req) {
  return {
    timestamp: new Date().toISOString(),
    version:   'v1',
    requestId: req._v1Id,
  };
}
function ok(res, req, data, status = 200) {
  return res.status(status).json({ data, meta: meta(req) });
}
function fail(res, req, status, code, message) {
  return res.status(status).json({ error: { code, message }, meta: meta(req) });
}

// ── Attach request ID + parse API key ─────────────────────────────────────────
router.use(async (req, res, next) => {
  req._v1Id = crypto.randomBytes(8).toString('hex');
  const raw = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '')
           || req.headers['x-api-key']
           || '';
  if (!raw) return fail(res, req, 401, 'UNAUTHORIZED', 'Provide Authorization: Bearer crm_live_<key> or X-API-Key header');
  const record = await apiKeys.validateApiKey(raw).catch(() => null);
  if (!record) return fail(res, req, 401, 'INVALID_KEY', 'API key is invalid or revoked');
  req.apiUser = record.user_email;
  next();
});

// ── API reference ─────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  ok(res, req, {
    name:    'CRM API',
    version: 'v1',
    docs:    'https://github.com/your-repo#api',
    endpoints: [
      // Customers
      { method: 'GET',    path: '/v1/customers',                          desc: 'List all customers' },
      { method: 'POST',   path: '/v1/customers',                          desc: 'Create or update a customer' },
      { method: 'GET',    path: '/v1/customers/:email',                   desc: 'Get one customer (with emails, notes, drafts…)' },
      { method: 'PATCH',  path: '/v1/customers/:email',                   desc: 'Update customer fields' },
      { method: 'DELETE', path: '/v1/customers/:email',                   desc: 'Delete a customer' },
      // Emails
      { method: 'GET',    path: '/v1/customers/:email/emails',            desc: 'List emails for customer' },
      { method: 'POST',   path: '/v1/customers/:email/emails/send',       desc: 'Send email + auto-schedule follow-up' },
      { method: 'POST',   path: '/v1/customers/:email/emails/inbound',    desc: 'Record an inbound email + trigger AI draft' },
      // Drafts
      { method: 'GET',    path: '/v1/drafts',                             desc: 'List drafts (filter ?status=pending|sent|generating)' },
      { method: 'GET',    path: '/v1/drafts/:id',                         desc: 'Get single draft' },
      { method: 'PATCH',  path: '/v1/drafts/:id',                         desc: 'Edit draft body or status' },
      { method: 'POST',   path: '/v1/drafts/:id/send',                    desc: 'Approve & send draft via Outlook' },
      // Notes
      { method: 'GET',    path: '/v1/customers/:email/notes',             desc: 'List notes' },
      { method: 'POST',   path: '/v1/customers/:email/notes',             desc: 'Add a note' },
      // Quotations
      { method: 'GET',    path: '/v1/customers/:email/quotations',        desc: 'List quotations' },
      { method: 'POST',   path: '/v1/customers/:email/quotations',        desc: 'Create a quotation' },
      // Follow-ups
      { method: 'GET',    path: '/v1/follow-ups',                         desc: 'List follow-ups (filter ?status=pending|done)' },
      { method: 'POST',   path: '/v1/customers/:email/follow-ups',        desc: 'Schedule a follow-up' },
      { method: 'PATCH',  path: '/v1/follow-ups/:id',                     desc: 'Update follow-up status' },
      // Sync
      { method: 'POST',   path: '/v1/sync',                               desc: 'Trigger an immediate Outlook sync' },
      // Webhooks (future)
      { method: 'GET',    path: '/v1/stream',                             desc: 'Server-Sent Events stream for real-time sync pushes' },
    ],
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMERS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/customers', async (req, res) => {
  try {
    const list = await crmStorage.listCustomers(req.apiUser);
    ok(res, req, { customers: list, total: list.length });
  } catch (e) { fail(res, req, 500, 'DB_ERROR', e.message); }
});

router.post('/customers', async (req, res) => {
  const { email, name, company, phone } = req.body;
  if (!email) return fail(res, req, 400, 'MISSING_FIELD', 'email is required');
  try {
    const c = await crmStorage.upsertCustomer(req.apiUser, { email, name, company, phone });
    ok(res, req, c, 201);
  } catch (e) { fail(res, req, 400, 'INVALID_INPUT', e.message); }
});

router.get('/customers/:email', async (req, res) => {
  try {
    const c = await crmStorage.getCustomer(req.apiUser, req.params.email);
    if (!c) return fail(res, req, 404, 'NOT_FOUND', 'Customer not found');
    ok(res, req, c);
  } catch (e) { fail(res, req, 500, 'DB_ERROR', e.message); }
});

router.patch('/customers/:email', async (req, res) => {
  const allowed = ['name','company','phone','aiSummary'];
  const updates = {};
  for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
  if (!Object.keys(updates).length) return fail(res, req, 400, 'MISSING_FIELD', 'Provide at least one of: ' + allowed.join(', '));
  try {
    const c = await crmStorage.upsertCustomer(req.apiUser, { email: req.params.email, ...updates });
    ok(res, req, c);
  } catch (e) { fail(res, req, 400, 'INVALID_INPUT', e.message); }
});

router.delete('/customers/:email', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM crm_customers WHERE user_email=$1 AND email=$2',
      [req.apiUser, req.params.email.toLowerCase()]
    );
    ok(res, req, { deleted: true });
  } catch (e) { fail(res, req, 500, 'DB_ERROR', e.message); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// EMAILS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/customers/:email/emails', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, direction, subject, body,
              email_date AS "emailDate",
              created_at AS "recordedAt",
              outlook_id AS "outlookId"
       FROM crm_emails
       WHERE user_email=$1 AND customer_email=$2
       ORDER BY COALESCE(email_date, created_at) DESC`,
      [req.apiUser, req.params.email.toLowerCase()]
    );
    ok(res, req, { emails: rows, total: rows.length });
  } catch (e) { fail(res, req, 500, 'DB_ERROR', e.message); }
});

// Send an outbound email (requires Outlook token stored via OAuth)
router.post('/customers/:email/emails/send', async (req, res) => {
  const { subject, body, cc, followUpDays } = req.body;
  if (!subject || !body) return fail(res, req, 400, 'MISSING_FIELD', 'subject and body are required');
  try {
    const { callGraphAPI } = require('../utils/graph-api');
    const token = await syncWorker.getValidToken(req.apiUser, getMsConfig());
    if (!token) return fail(res, req, 401, 'NO_OUTLOOK_TOKEN', 'No valid Outlook token — user must authenticate via the web UI first');
    const ce = req.params.email.toLowerCase();
    await callGraphAPI(token, 'POST', 'me/sendMail', {
      message: {
        subject,
        body: { contentType: 'text', content: body },
        toRecipients: [{ emailAddress: { address: ce } }],
        ccRecipients: (cc || '').split(',').filter(Boolean).map(e => ({ emailAddress: { address: e.trim() } })),
      },
      saveToSentItems: true,
    });
    const recorded = await crmStorage.recordEmail(req.apiUser, ce, { subject, body, date: new Date().toISOString() }, 'sent');
    ok(res, req, { sent: true, emailId: recorded?.outlook_id || null });
  } catch (e) { fail(res, req, 500, 'SEND_ERROR', e.message); }
});

// Record an inbound email + trigger AI draft generation
router.post('/customers/:email/emails/inbound', async (req, res) => {
  const { subject, body, date, outlookId, generateDraft = true } = req.body;
  if (!subject) return fail(res, req, 400, 'MISSING_FIELD', 'subject is required');
  try {
    const ce = req.params.email.toLowerCase();
    const customer = await crmStorage.getCustomer(req.apiUser, ce);
    await crmStorage.upsertCustomer(req.apiUser, { email: ce, name: customer?.name || '' });
    await crmStorage.recordEmail(req.apiUser, ce, { subject, body: body || '', date: date || new Date().toISOString(), emailId: outlookId || null }, 'received');

    let draft = null;
    if (generateDraft) {
      draft = await crmStorage.addDraft(req.apiUser, {
        customerEmail: ce, customerName: customer?.name || '',
        inReplyTo:        outlookId || '',
        subject:          subject.startsWith('Re:') ? subject : `Re: ${subject}`,
        body:             '',
        sourceSubject:    subject,
        sourceBody:       body || '',
        generationStatus: 'generating',
      });
      // Fire-and-forget OpenAI generation
      (async (d) => {
        try {
          const openai   = require('./openai');
          const user     = await crmStorage.getUser(req.apiUser);
          const custFull = await crmStorage.getCustomer(req.apiUser, ce);
          const result   = await openai.generateEmailDraft({
            senderName:      user?.name || req.apiUser,
            customer:        { email: ce, name: custFull?.name || '', company: custFull?.company || '' },
            receivedSubject: subject, receivedBody: body || '',
            notes:           custFull?.notes || [], sentEmails: custFull?.sentEmails || [],
          });
          await crmStorage.updateDraft(req.apiUser, d.id, { body: result.body, generatedBy: 'openai', ollamaModel: result.model, generationStatus: 'pending' });
        } catch (err) {
          await crmStorage.updateDraft(req.apiUser, d.id, { body: '(AI generation failed)', generationStatus: 'failed' }).catch(() => {});
        }
      })(draft);
    }

    ok(res, req, { recorded: true, draft: draft ? { id: draft.id, generationStatus: 'generating' } : null }, 201);
  } catch (e) { fail(res, req, 500, 'DB_ERROR', e.message); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DRAFTS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/drafts', async (req, res) => {
  try {
    const list = await crmStorage.listDrafts(req.apiUser, req.query.status || undefined);
    ok(res, req, { drafts: list, total: list.length });
  } catch (e) { fail(res, req, 500, 'DB_ERROR', e.message); }
});

router.get('/drafts/:id', async (req, res) => {
  try {
    const d = await crmStorage.getDraft(req.apiUser, req.params.id);
    if (!d) return fail(res, req, 404, 'NOT_FOUND', 'Draft not found');
    ok(res, req, d);
  } catch (e) { fail(res, req, 500, 'DB_ERROR', e.message); }
});

router.patch('/drafts/:id', async (req, res) => {
  try {
    const updated = await crmStorage.updateDraft(req.apiUser, req.params.id, req.body);
    if (!updated) return fail(res, req, 404, 'NOT_FOUND', 'Draft not found');
    ok(res, req, updated);
  } catch (e) { fail(res, req, 400, 'INVALID_INPUT', e.message); }
});

router.post('/drafts/:id/send', async (req, res) => {
  try {
    const { callGraphAPI } = require('../utils/graph-api');
    const token = await syncWorker.getValidToken(req.apiUser, getMsConfig());
    if (!token) return fail(res, req, 401, 'NO_OUTLOOK_TOKEN', 'No valid Outlook token — user must authenticate via the web UI first');

    const draft = await crmStorage.getDraft(req.apiUser, req.params.id);
    if (!draft)                                    return fail(res, req, 404, 'NOT_FOUND', 'Draft not found');
    if (draft.status === 'sent')                   return fail(res, req, 400, 'ALREADY_SENT', 'Draft already sent');
    if (draft.generationStatus === 'generating')   return fail(res, req, 400, 'STILL_GENERATING', 'Draft is still being generated, retry shortly');

    const bodyToSend = (req.body.body || draft.body || '').trim();
    if (!bodyToSend) return fail(res, req, 400, 'EMPTY_BODY', 'Email body is empty');

    await callGraphAPI(token, 'POST', 'me/sendMail', {
      message: {
        subject: draft.subject,
        body: { contentType: 'text', content: bodyToSend },
        toRecipients: [{ emailAddress: { address: draft.customerEmail } }],
      },
      saveToSentItems: true,
    });

    await crmStorage.recordEmail(req.apiUser, draft.customerEmail, { subject: draft.subject, body: bodyToSend, date: new Date().toISOString() }, 'sent');
    const updated = await crmStorage.updateDraft(req.apiUser, req.params.id, { status: 'sent', editedBody: bodyToSend });
    ok(res, req, updated);
  } catch (e) { fail(res, req, 500, 'SEND_ERROR', e.message); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// NOTES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/customers/:email/notes', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, text, created_at AS "createdAt" FROM crm_notes WHERE user_email=$1 AND customer_email=$2 ORDER BY created_at DESC`,
      [req.apiUser, req.params.email.toLowerCase()]
    );
    ok(res, req, { notes: rows, total: rows.length });
  } catch (e) { fail(res, req, 500, 'DB_ERROR', e.message); }
});

router.post('/customers/:email/notes', async (req, res) => {
  if (!req.body.text) return fail(res, req, 400, 'MISSING_FIELD', 'text is required');
  try {
    const n = await crmStorage.addNote(req.apiUser, req.params.email, req.body.text);
    ok(res, req, n, 201);
  } catch (e) { fail(res, req, 400, 'INVALID_INPUT', e.message); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// QUOTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/customers/:email/quotations', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, reference, description, amount, currency, valid_until AS "validUntil", created_at AS "createdAt"
       FROM crm_quotations WHERE user_email=$1 AND customer_email=$2 ORDER BY created_at DESC`,
      [req.apiUser, req.params.email.toLowerCase()]
    );
    ok(res, req, { quotations: rows, total: rows.length });
  } catch (e) { fail(res, req, 500, 'DB_ERROR', e.message); }
});

router.post('/customers/:email/quotations', async (req, res) => {
  if (!req.body.reference) return fail(res, req, 400, 'MISSING_FIELD', 'reference is required');
  try {
    const q = await crmStorage.addQuotation(req.apiUser, req.params.email, req.body);
    ok(res, req, q, 201);
  } catch (e) { fail(res, req, 400, 'INVALID_INPUT', e.message); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// FOLLOW-UPS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/follow-ups', async (req, res) => {
  try {
    const { status } = req.query;
    const clause = status ? 'AND status=$2' : '';
    const params = status ? [req.apiUser, status] : [req.apiUser];
    const { rows } = await pool.query(
      `SELECT id, customer_email AS "customerEmail", subject, note, status,
              due_at AS "dueAt", created_at AS "createdAt"
       FROM crm_follow_ups WHERE user_email=$1 ${clause} ORDER BY due_at ASC`,
      params
    );
    ok(res, req, { followUps: rows, total: rows.length });
  } catch (e) { fail(res, req, 500, 'DB_ERROR', e.message); }
});

router.post('/customers/:email/follow-ups', async (req, res) => {
  try {
    const f = await crmStorage.addFollowUp(req.apiUser, req.params.email, req.body);
    ok(res, req, f, 201);
  } catch (e) { fail(res, req, 400, 'INVALID_INPUT', e.message); }
});

router.patch('/follow-ups/:id', async (req, res) => {
  const { status } = req.body;
  const valid = ['pending','done','dismissed'];
  if (!status || !valid.includes(status)) return fail(res, req, 400, 'INVALID_STATUS', `status must be one of: ${valid.join(', ')}`);
  try {
    const f = await crmStorage.updateFollowUp(req.apiUser, req.params.id, status);
    ok(res, req, f);
  } catch (e) { fail(res, req, 400, 'INVALID_INPUT', e.message); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SYNC
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/sync', async (req, res) => {
  try {
    const token = await syncWorker.getValidToken(req.apiUser, getMsConfig());
    if (!token) return fail(res, req, 401, 'NO_OUTLOOK_TOKEN', 'No valid Outlook token — user must authenticate via the web UI first');

    const { rows: customers } = await pool.query(
      'SELECT email, name FROM crm_customers WHERE user_email=$1', [req.apiUser]
    );
    if (!customers.length) return ok(res, req, { inbox: 0, sent: 0, message: 'No customers yet' });

    const { rows: existing } = await pool.query(
      'SELECT outlook_id FROM crm_emails WHERE user_email=$1 AND outlook_id IS NOT NULL', [req.apiUser]
    );
    const existingIds = new Set(existing.map(r => r.outlook_id));
    const customerMap = new Map(customers.map(c => [c.email.toLowerCase(), c]));

    const { rows: stored } = await pool.query('SELECT last_inbox_sync, last_sent_sync FROM crm_tokens WHERE user_email=$1', [req.apiUser]);
    const s = stored[0] || {};

    const { syncFolder } = syncWorker;
    const inboxCount = await syncFolder(req.apiUser, token, 'inbox',     s.last_inbox_sync, customerMap, existingIds);
    const sentCount  = await syncFolder(req.apiUser, token, 'sentitems', s.last_sent_sync,  customerMap, existingIds);

    const now = new Date();
    await pool.query(
      'UPDATE crm_tokens SET last_inbox_sync=$1, last_sent_sync=$2, updated_at=NOW() WHERE user_email=$3',
      [now, now, req.apiUser]
    );

    ok(res, req, { inbox: inboxCount, sent: sentCount, syncedAt: now.toISOString() });
  } catch (e) { fail(res, req, 500, 'SYNC_ERROR', e.message); }
});

// ── SSE stream (real-time push) ───────────────────────────────────────────────
router.get('/stream', (req, res) => {
  const ue = req.apiUser;
  res.set({
    'Content-Type':      'text/event-stream',
    'Cache-Control':     'no-cache',
    'Connection':        'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('data: {"type":"connected"}\n\n');
  syncWorker.addSseClient(ue, res);
  const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch { clearInterval(ping); } }, 25000);
  req.on('close', () => { clearInterval(ping); syncWorker.removeSseClient(ue, res); });
});

// ── Helper — read MS config from env (avoid circular dep with server.js) ──────
function getMsConfig() {
  return {
    clientId:     process.env.MS_CLIENT_ID     || process.env.OUTLOOK_CLIENT_ID     || '',
    clientSecret: process.env.MS_CLIENT_SECRET || process.env.OUTLOOK_CLIENT_SECRET || '',
    tenantId:     process.env.MS_TENANT_ID     || 'common',
  };
}

module.exports = router;
