'use strict';

const https      = require('https');
const { query }  = require('./db');
const crmStorage = require('./storage');

const SYNC_INTERVAL_MS = parseInt(process.env.SYNC_INTERVAL_MS || '30000', 10);
const FIRST_SYNC_DAYS  = parseInt(process.env.FIRST_SYNC_DAYS  || '30', 10);

const EXCLUDED_DOMAINS = new Set(
  (process.env.EXCLUDED_DOMAINS || 'artechsolution.co.in').toLowerCase().split(',').map(d => d.trim())
);

// ── SSE clients: userEmail -> Set<res> ────────────────────────────────────
const sseClients = new Map();

function addSseClient(userEmail, res) {
  const key = userEmail.toLowerCase();
  if (!sseClients.has(key)) sseClients.set(key, new Set());
  sseClients.get(key).add(res);
}
function removeSseClient(userEmail, res) {
  sseClients.get(userEmail.toLowerCase())?.delete(res);
}
function notifyUser(userEmail, payload) {
  const clients = sseClients.get(userEmail.toLowerCase());
  if (!clients?.size) return;
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of [...clients]) {
    try { res.write(msg); } catch { clients.delete(res); }
  }
}

// ── Token storage ─────────────────────────────────────────────────────────
async function saveTokens(userEmail, { accessToken, refreshToken, expiresAt }) {
  await query(`
    INSERT INTO crm_tokens (user_email, access_token, refresh_token, token_expires_at, updated_at)
    VALUES ($1,$2,$3,$4,NOW())
    ON CONFLICT (user_email) DO UPDATE SET
      access_token     = EXCLUDED.access_token,
      refresh_token    = COALESCE(EXCLUDED.refresh_token, crm_tokens.refresh_token),
      token_expires_at = EXCLUDED.token_expires_at,
      updated_at       = NOW()
  `, [userEmail.toLowerCase(), accessToken, refreshToken || null, expiresAt]);
}

async function getStoredTokens(userEmail) {
  const { rows } = await query(
    'SELECT * FROM crm_tokens WHERE user_email=$1', [userEmail.toLowerCase()]
  );
  return rows[0] || null;
}

// ── Token refresh (standalone, no session needed) ─────────────────────────
function refreshTokenHttp(tenantId, clientId, clientSecret, refreshToken) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      grant_type: 'refresh_token', refresh_token: refreshToken,
    }).toString();
    const req = https.request({
      hostname: 'login.microsoftonline.com', port: 443,
      path: `/${tenantId}/oauth2/v2.0/token`, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
      timeout: 30000,
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Token refresh timed out')); });
    req.write(body); req.end();
  });
}

async function getValidToken(userEmail, msConfig) {
  const stored = await getStoredTokens(userEmail);
  if (!stored?.access_token) return null;

  const now = Date.now();
  if (stored.token_expires_at && now < Number(stored.token_expires_at) - 5 * 60 * 1000) {
    return stored.access_token;
  }
  if (!stored.refresh_token) return null;

  try {
    const tokens = await refreshTokenHttp(
      msConfig.tenantId, msConfig.clientId, msConfig.clientSecret, stored.refresh_token
    );
    if (tokens.error || !tokens.access_token) return null;
    const expiresAt = now + (tokens.expires_in || 3600) * 1000;
    await saveTokens(userEmail, { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt });
    return tokens.access_token;
  } catch { return null; }
}

// ── Graph API helper ──────────────────────────────────────────────────────
function stripHtml(html) {
  return (html || '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3000);
}

// ── Sync one folder (inbox or sentitems) ──────────────────────────────────
async function syncFolder(userEmail, token, folder, lastSync, customerMap, existingIds) {
  const { callGraphAPI } = require('../utils/graph-api');
  const openai = require('./openai');
  const isInbox   = folder === 'inbox';
  const direction = isInbox ? 'received' : 'sent';
  const dateField = isInbox ? 'receivedDateTime' : 'sentDateTime';

  const since = lastSync
    ? new Date(lastSync)
    : new Date(Date.now() - FIRST_SYNC_DAYS * 24 * 60 * 60 * 1000);

  let messages = [];
  try {
    const res = await callGraphAPI(token, 'GET', `me/mailFolders/${folder}/messages`, null, {
      $top: 50,
      $orderby: `${dateField} desc`,
      $select: `id,subject,from,toRecipients,${dateField},bodyPreview,isDraft`,
      $filter: `isDraft eq false and ${dateField} ge ${since.toISOString()}`,
    });
    messages = res?.value || [];
  } catch (err) {
    console.error(`[sync] ${userEmail}/${folder} fetch error:`, err.message);
    return 0;
  }

  let processed = 0;

  for (const msg of messages) {
    if (existingIds.has(msg.id)) continue;

    // Identify which CRM customer this email belongs to
    let customerEmail = null;
    if (isInbox) {
      customerEmail = (msg.from?.emailAddress?.address || '').toLowerCase().trim();
      if (!customerEmail) continue;
      // Skip internal domain emails
      const domain = customerEmail.split('@')[1] || '';
      if (EXCLUDED_DOMAINS.has(domain)) continue;
      // Auto-create customer if new
      if (!customerMap.has(customerEmail)) {
        const senderName = msg.from?.emailAddress?.name || '';
        await crmStorage.upsertCustomer(userEmail, { email: customerEmail, name: senderName });
        customerMap.set(customerEmail, { email: customerEmail, name: senderName });
      }
    } else {
      for (const r of (msg.toRecipients || [])) {
        const addr = (r.emailAddress?.address || '').toLowerCase().trim();
        if (customerMap.has(addr)) { customerEmail = addr; break; }
      }
      if (!customerEmail) continue;
    }

    const customer     = customerMap.get(customerEmail);
    const customerName = customer.name || msg.from?.emailAddress?.name || '';
    const subject      = msg.subject || '';
    const date         = msg[dateField];

    // Fetch full email body
    let body = msg.bodyPreview || '';
    try {
      const detail = await callGraphAPI(token, 'GET', `me/messages/${msg.id}`, null, { $select: 'body' });
      const raw = detail?.body?.content || msg.bodyPreview || '';
      body = detail?.body?.contentType === 'html' ? stripHtml(raw) : raw.slice(0, 3000);
    } catch {}

    await crmStorage.upsertCustomer(userEmail, { email: customerEmail, name: customerName });
    await crmStorage.recordEmail(userEmail, customerEmail, { subject, body, date, emailId: msg.id }, direction);
    existingIds.add(msg.id);

    // Auto-generate Ollama draft only for received emails
    if (isInbox) {
      const draft = await crmStorage.addDraft(userEmail, {
        customerEmail, customerName,
        inReplyTo:        msg.id,
        subject:          subject.startsWith('Re:') ? subject : `Re: ${subject}`,
        body:             '',
        sourceSubject:    subject,
        sourceBody:       body,
        generationStatus: 'generating',
      });

      // Fire-and-forget
      (async (d, sub, b, ce, cn) => {
        try {
          const user     = await crmStorage.getUser(userEmail);
          const custFull = await crmStorage.getCustomer(userEmail, ce);
          const result   = await openai.generateEmailDraft({
            senderName:      user?.name || userEmail,
            customer:        { email: ce, name: cn, company: custFull?.company || '' },
            receivedSubject: sub, receivedBody: b,
            notes:           custFull?.notes || [], sentEmails: custFull?.sentEmails || [],
          });
          await crmStorage.updateDraft(userEmail, d.id, {
            body: result.body, generatedBy: 'openai',
            ollamaModel: result.model, generationStatus: 'pending',
          });
          console.log(`[sync] Draft ready for ${ce} — "${sub.slice(0,40)}"`);
          notifyUser(userEmail, { type: 'draft_ready', draftId: d.id, customerEmail: ce });
        } catch (err) {
          console.error('[sync] OpenAI draft error:', err.message);
          await crmStorage.updateDraft(userEmail, d.id, {
            body: '(AI generation failed — please write manually)',
            generationStatus: 'failed',
          }).catch(() => {});
          notifyUser(userEmail, { type: 'draft_failed', draftId: d.id, customerEmail: ce });
        }
      })(draft, subject, body, customerEmail, customerName);
    }

    processed++;
  }

  return processed;
}

// ── Backfill: generate drafts for received emails that have none ──────────
async function backfillDrafts(userEmail) {
  const openai = require('./openai');

  // Find received emails from known customers that have NO draft yet
  const { rows: missing } = await query(`
    SELECT e.id, e.customer_email, e.subject, e.body, e.outlook_id,
           c.name AS customer_name
    FROM crm_emails e
    JOIN crm_customers c ON c.user_email = e.user_email AND c.email = e.customer_email
    LEFT JOIN crm_drafts d ON d.user_email = e.user_email AND d.in_reply_to = e.outlook_id
    WHERE e.user_email = $1
      AND e.direction  = 'received'
      AND e.outlook_id IS NOT NULL
      AND d.id IS NULL
    ORDER BY e.email_date DESC
    LIMIT 5
  `, [userEmail.toLowerCase()]);

  if (!missing.length) return;

  console.log(`[sync] Backfilling ${missing.length} draft(s) for ${userEmail}`);

  for (const row of missing) {
    const subject = row.subject || '';
    const body    = row.body    || '';
    const ce      = row.customer_email;
    const cn      = row.customer_name || '';

    const draft = await crmStorage.addDraft(userEmail, {
      customerEmail:    ce,
      customerName:     cn,
      inReplyTo:        row.outlook_id,
      subject:          subject.startsWith('Re:') ? subject : `Re: ${subject}`,
      body:             '',
      sourceSubject:    subject,
      sourceBody:       body,
      generationStatus: 'generating',
    });

    notifyUser(userEmail, { type: 'draft_generating', draftId: draft.id, customerEmail: ce });

    // Generate asynchronously — don't block the loop
    (async (d) => {
      try {
        const user     = await crmStorage.getUser(userEmail);
        const custFull = await crmStorage.getCustomer(userEmail, ce);
        const result   = await openai.generateEmailDraft({
          senderName:      user?.name || userEmail,
          customer:        { email: ce, name: cn, company: custFull?.company || '' },
          receivedSubject: subject,
          receivedBody:    body,
          notes:           custFull?.notes || [],
          sentEmails:      custFull?.sentEmails || [],
        });
        await crmStorage.updateDraft(userEmail, d.id, {
          body: result.body, generatedBy: 'openai',
          ollamaModel: result.model, generationStatus: 'pending',
        });
        console.log(`[backfill] Draft ready for ${ce} — "${subject.slice(0, 40)}"`);
        notifyUser(userEmail, { type: 'draft_ready', draftId: d.id, customerEmail: ce });
      } catch (err) {
        console.error('[backfill] OpenAI error:', err.message);
        await crmStorage.updateDraft(userEmail, d.id, {
          body: '(AI generation failed — please write manually)',
          generationStatus: 'failed',
        }).catch(() => {});
        notifyUser(userEmail, { type: 'draft_failed', draftId: d.id, customerEmail: ce });
      }
    })(draft);
  }
}

// ── Sync one user ─────────────────────────────────────────────────────────
async function syncUser(userEmail, msConfig) {
  try {
    const token = await getValidToken(userEmail, msConfig);
    if (!token) return;

    const stored = await getStoredTokens(userEmail);

    const { rows: customers } = await query(
      'SELECT email, name FROM crm_customers WHERE user_email=$1', [userEmail]
    );
    const customerMap = new Map(customers.map(c => [c.email.toLowerCase(), c]));

    const { rows: existing } = await query(
      'SELECT outlook_id FROM crm_emails WHERE user_email=$1 AND outlook_id IS NOT NULL', [userEmail]
    );
    const existingIds = new Set(existing.map(r => r.outlook_id));

    // If no external customers yet, force a full history scan to discover them
    const externalCount = customers.filter(c => { const d = (c.email || '').split('@')[1] || ''; return !EXCLUDED_DOMAINS.has(d); }).length;
    const lastInbox = externalCount === 0 ? null : stored?.last_inbox_sync;
    const lastSent  = externalCount === 0 ? null : stored?.last_sent_sync;

    const inboxCount = await syncFolder(userEmail, token, 'inbox',      lastInbox, customerMap, existingIds);
    const sentCount  = await syncFolder(userEmail, token, 'sentitems',  lastSent,  customerMap, existingIds);

    const now = new Date();
    await query(
      'UPDATE crm_tokens SET last_inbox_sync=$1, last_sent_sync=$2, updated_at=NOW() WHERE user_email=$3',
      [now, now, userEmail.toLowerCase()]
    );

    const total = inboxCount + sentCount;
    if (total > 0) {
      console.log(`[sync] ${userEmail}: +${inboxCount} received, +${sentCount} sent`);
      notifyUser(userEmail, { type: 'sync', inbox: inboxCount, sent: sentCount });
    }

    // Backfill: generate drafts for any received emails that don't have one yet
    await backfillDrafts(userEmail);
  } catch (err) {
    console.error(`[sync] Error syncing ${userEmail}:`, err.message);
  }
}

// ── Background loop ───────────────────────────────────────────────────────
let syncTimer = null;
let _msConfig = {};

async function runSync() {
  try {
    const { rows } = await query('SELECT user_email FROM crm_tokens WHERE access_token IS NOT NULL');
    for (const { user_email } of rows) {
      await syncUser(user_email, _msConfig);
    }
  } catch (err) {
    console.error('[sync] Loop error:', err.message);
  }
}

function startWorker(msConfig) {
  _msConfig = msConfig;
  runSync(); // immediate first run
  syncTimer = setInterval(runSync, SYNC_INTERVAL_MS);
  console.log(`[sync] Auto-sync started — every ${SYNC_INTERVAL_MS / 1000}s`);
}

function stopWorker() {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
}

module.exports = { startWorker, stopWorker, saveTokens, getValidToken, syncFolder, addSseClient, removeSseClient, notifyUser };
