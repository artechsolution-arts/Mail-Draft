'use strict';

const { query } = require('./db');

// ── Row mappers ───────────────────────────────────────────────────────────────
function emailRow(r) {
  return {
    id: String(r.id),
    subject: r.subject || '',
    body: r.body || '',
    date: r.email_date,
    emailId: r.outlook_id,
    recordedAt: r.created_at,
  };
}
function followUpRow(r) {
  return {
    id: String(r.id),
    subject: r.subject || '',
    note: r.note || '',
    dueAt: r.due_at,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
function noteRow(r)      { return { id: String(r.id), text: r.text, createdAt: r.created_at }; }
function quotationRow(r) {
  return { id: String(r.id), reference: r.reference, description: r.description || '', amount: r.amount || '', currency: r.currency || 'USD', validUntil: r.valid_until, createdAt: r.created_at };
}
function draftRow(r) {
  return {
    id: String(r.id),
    userEmail: r.user_email,
    customerEmail: r.customer_email,
    customerName: r.customer_name || '',
    inReplyTo: r.in_reply_to || '',
    subject: r.subject || '',
    body: r.body || '',
    status: r.status,
    sourceSubject: r.source_subject || '',
    sourceBody: r.source_body || '',
    generatedBy: r.generated_by || '',
    ollamaModel: r.ollama_model || '',
    generationStatus: r.generation_status || 'pending',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ── User ──────────────────────────────────────────────────────────────────────
async function ensureUser(email, name = '') {
  await query(
    `INSERT INTO crm_users (email, name) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET name = COALESCE(EXCLUDED.name, crm_users.name)`,
    [email.toLowerCase(), name || null]
  );
}

async function getUser(email) {
  const { rows } = await query('SELECT * FROM crm_users WHERE email = $1', [email.toLowerCase()]);
  return rows[0] || null;
}

// ── Customer (full, with related data) ───────────────────────────────────────
async function buildCustomer(row, userEmail) {
  const ue = userEmail.toLowerCase();
  const ce = row.email;
  const [emails, fups, notes, quotes] = await Promise.all([
    query('SELECT * FROM crm_emails WHERE user_email=$1 AND customer_email=$2 ORDER BY COALESCE(email_date,created_at) DESC', [ue, ce]),
    query('SELECT * FROM crm_follow_ups WHERE user_email=$1 AND customer_email=$2 ORDER BY created_at DESC', [ue, ce]),
    query('SELECT * FROM crm_notes WHERE user_email=$1 AND customer_email=$2 ORDER BY created_at DESC', [ue, ce]),
    query('SELECT * FROM crm_quotations WHERE user_email=$1 AND customer_email=$2 ORDER BY created_at DESC', [ue, ce]),
  ]);
  return {
    email:                row.email,
    name:                 row.name || '',
    company:              row.company || '',
    phone:                row.phone || '',
    customerSince:        row.customer_since,
    aiSummary:            row.ai_summary || '',
    aiSummaryUpdatedAt:   row.ai_summary_updated_at,
    lastUpdated:          row.updated_at,
    createdAt:            row.created_at,
    receivedEmails:       emails.rows.filter(e => e.direction === 'received').map(emailRow),
    sentEmails:           emails.rows.filter(e => e.direction === 'sent').map(emailRow),
    attachments:          [],
    followUps:            fups.rows.map(followUpRow),
    notes:                notes.rows.map(noteRow),
    quotations:           quotes.rows.map(quotationRow),
  };
}

async function upsertCustomer(userEmail, fields) {
  const ue  = userEmail.toLowerCase();
  const ce  = (fields.email || '').toLowerCase().trim();
  if (!ce) throw new Error('email is required');
  const { rows } = await query(`
    INSERT INTO crm_customers (user_email, email, name, company, phone, customer_since, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,NOW())
    ON CONFLICT (user_email, email) DO UPDATE SET
      name           = COALESCE(EXCLUDED.name, crm_customers.name),
      company        = COALESCE(EXCLUDED.company, crm_customers.company),
      phone          = COALESCE(EXCLUDED.phone, crm_customers.phone),
      customer_since = COALESCE(EXCLUDED.customer_since, crm_customers.customer_since),
      updated_at     = NOW()
    RETURNING *
  `, [ue, ce, fields.name||null, fields.company||null, fields.phone||null, fields.customerSince||null]);
  return buildCustomer(rows[0], userEmail);
}

async function getCustomer(userEmail, customerEmail) {
  const ue = userEmail.toLowerCase();
  const ce = (customerEmail || '').toLowerCase().trim();
  const { rows } = await query('SELECT * FROM crm_customers WHERE user_email=$1 AND email=$2', [ue, ce]);
  if (!rows[0]) return null;
  return buildCustomer(rows[0], userEmail);
}

async function listCustomers(userEmail) {
  const ue = userEmail.toLowerCase();
  const { rows } = await query(`
    SELECT c.*,
      (SELECT COUNT(*) FROM crm_emails      WHERE user_email=$1 AND customer_email=c.email AND direction='received') AS received_count,
      (SELECT COUNT(*) FROM crm_emails      WHERE user_email=$1 AND customer_email=c.email AND direction='sent')     AS sent_count,
      (SELECT COUNT(*) FROM crm_follow_ups  WHERE user_email=$1 AND customer_email=c.email AND status='pending')     AS pending_fu,
      (SELECT COUNT(*) FROM crm_notes       WHERE user_email=$1 AND customer_email=c.email)                          AS note_count,
      (SELECT COUNT(*) FROM crm_quotations  WHERE user_email=$1 AND customer_email=c.email)                          AS quote_count
    FROM crm_customers c WHERE c.user_email=$1
    ORDER BY COALESCE(c.name, c.email) ASC
  `, [ue]);

  return rows.map(r => ({
    email:         r.email,
    name:          r.name || '',
    company:       r.company || '',
    phone:         r.phone || '',
    customerSince: r.customer_since,
    aiSummary:     r.ai_summary || '',
    lastUpdated:   r.updated_at,
    // Counts for sidebar (no N+1)
    receivedEmails: Array(parseInt(r.received_count||0)).fill({}),
    sentEmails:     Array(parseInt(r.sent_count||0)).fill({}),
    followUps:      Array.from({length: parseInt(r.pending_fu||0)}, () => ({status:'pending'})),
    notes:          Array(parseInt(r.note_count||0)).fill({}),
    quotations:     Array(parseInt(r.quote_count||0)).fill({}),
    attachments:    [],
  }));
}

// ── Notes ─────────────────────────────────────────────────────────────────────
async function addNote(userEmail, customerEmail, text) {
  const { rows } = await query(
    'INSERT INTO crm_notes (user_email, customer_email, text) VALUES ($1,$2,$3) RETURNING *',
    [userEmail.toLowerCase(), customerEmail.toLowerCase(), text]
  );
  return noteRow(rows[0]);
}

// ── Quotations ────────────────────────────────────────────────────────────────
async function addQuotation(userEmail, customerEmail, q) {
  const { rows } = await query(
    'INSERT INTO crm_quotations (user_email,customer_email,reference,description,amount,currency,valid_until) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [userEmail.toLowerCase(), customerEmail.toLowerCase(), q.reference, q.description||null, q.amount||null, q.currency||'USD', q.validUntil||null]
  );
  return quotationRow(rows[0]);
}

// ── Follow-ups ────────────────────────────────────────────────────────────────
async function addFollowUp(userEmail, customerEmail, { subject, daysUntilDue, note }) {
  const ue   = userEmail.toLowerCase();
  const ce   = customerEmail.toLowerCase();
  const cfg  = await getSettings(userEmail);
  const days = daysUntilDue || cfg.defaultDays;
  const due  = new Date(Date.now() + days * 86400 * 1000);
  const { rows } = await query(
    'INSERT INTO crm_follow_ups (user_email,customer_email,subject,note,due_at) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [ue, ce, subject||null, note||null, due]
  );
  return followUpRow(rows[0]);
}

async function updateFollowUp(userEmail, followUpId, status) {
  const { rows } = await query(
    'UPDATE crm_follow_ups SET status=$1, updated_at=NOW() WHERE id=$2 AND user_email=$3 RETURNING *',
    [status, parseInt(followUpId), userEmail.toLowerCase()]
  );
  if (!rows[0]) throw new Error('Follow-up not found');
  return followUpRow(rows[0]);
}

async function getPendingFollowUps(userEmail) {
  const { rows } = await query(`
    SELECT f.*, c.name AS customer_name, c.company AS customer_company,
           (SELECT MAX(email_date) FROM crm_emails e
            WHERE e.user_email=f.user_email AND e.customer_email=f.customer_email) AS last_email_at
    FROM crm_follow_ups f
    JOIN crm_customers c ON c.user_email=f.user_email AND c.email=f.customer_email
    WHERE f.user_email=$1 AND f.status='pending' AND f.due_at<=NOW()
    ORDER BY f.due_at ASC
  `, [userEmail.toLowerCase()]);
  return rows.map(r => ({
    customer: { email: r.customer_email, name: r.customer_name||'', company: r.customer_company||'' },
    followUp: followUpRow(r),
    lastEmailAt: r.last_email_at || null,
  }));
}

async function getAllPendingFollowUps(userEmail) {
  const { rows } = await query(`
    SELECT f.*, c.name AS customer_name, c.company AS customer_company,
           (SELECT MAX(email_date) FROM crm_emails e
            WHERE e.user_email=f.user_email AND e.customer_email=f.customer_email) AS last_email_at
    FROM crm_follow_ups f
    JOIN crm_customers c ON c.user_email=f.user_email AND c.email=f.customer_email
    WHERE f.user_email=$1 AND f.status='pending'
    ORDER BY f.due_at ASC
  `, [userEmail.toLowerCase()]);
  return rows.map(r => ({
    customer: { email: r.customer_email, name: r.customer_name||'', company: r.customer_company||'' },
    followUp: followUpRow(r),
    lastEmailAt: r.last_email_at || null,
  }));
}

// ── Email tracking ────────────────────────────────────────────────────────────
async function recordEmail(userEmail, customerEmail, emailData, direction) {
  const ue = userEmail.toLowerCase();
  const ce = customerEmail.toLowerCase().trim();
  // Auto-create customer if missing
  await query(
    'INSERT INTO crm_customers (user_email,email) VALUES ($1,$2) ON CONFLICT (user_email,email) DO NOTHING',
    [ue, ce]
  );
  const { rows } = await query(
    'INSERT INTO crm_emails (user_email,customer_email,direction,subject,body,email_date,outlook_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [ue, ce, direction, emailData.subject||null, emailData.body||null, emailData.date||null, emailData.emailId||null]
  );
  if (direction === 'sent') {
    const cfg = await getSettings(userEmail);
    await query(
      'INSERT INTO crm_follow_ups (user_email,customer_email,subject,note,due_at) VALUES ($1,$2,$3,$4,$5)',
      [ue, ce, emailData.subject||null, 'Auto follow-up after sent email', new Date(Date.now() + cfg.defaultDays*86400*1000)]
    );
  } else {
    await query(
      `UPDATE crm_follow_ups SET status='closed', updated_at=NOW() WHERE user_email=$1 AND customer_email=$2 AND status='pending'`,
      [ue, ce]
    );
  }
  return emailRow(rows[0]);
}

// ── Drafts ────────────────────────────────────────────────────────────────────
async function addDraft(userEmail, draft) {
  const initialStatus = draft.generationStatus || 'pending';
  const { rows } = await query(
    `INSERT INTO crm_drafts
       (user_email,customer_email,customer_name,in_reply_to,subject,body,status,
        source_subject,source_body,generated_by,ollama_model,generation_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [
      userEmail.toLowerCase(),
      (draft.customerEmail||'').toLowerCase(),
      draft.customerName||null,
      draft.inReplyTo||null,
      draft.subject||null,
      draft.body||null,
      'pending',
      draft.sourceSubject||null,
      draft.sourceBody||null,
      draft.generatedBy||null,
      draft.ollamaModel||null,
      initialStatus,
    ]
  );
  return draftRow(rows[0]);
}

async function getDraft(userEmail, draftId) {
  const { rows } = await query(
    'SELECT * FROM crm_drafts WHERE id=$1 AND user_email=$2',
    [parseInt(draftId), userEmail.toLowerCase()]
  );
  return rows[0] ? draftRow(rows[0]) : null;
}

async function listDrafts(userEmail, status) {
  const ue = userEmail.toLowerCase();
  const { rows } = await query(
    status
      ? 'SELECT * FROM crm_drafts WHERE user_email=$1 AND status=$2 ORDER BY created_at DESC'
      : 'SELECT * FROM crm_drafts WHERE user_email=$1 ORDER BY created_at DESC',
    status ? [ue, status] : [ue]
  );
  return rows.map(draftRow);
}

async function updateDraft(userEmail, draftId, { status, editedBody, generatedBy, ollamaModel, generationStatus, body }) {
  const ue = userEmail.toLowerCase();
  const id = parseInt(draftId);

  const setClauses = ['updated_at=NOW()'];
  const params     = [];
  let   idx        = 1;

  if (status           !== undefined) { setClauses.push(`status=$${idx++}`);            params.push(status); }
  if (editedBody       !== undefined) { setClauses.push(`body=$${idx++}`);              params.push(editedBody); }
  if (body             !== undefined && editedBody === undefined) { setClauses.push(`body=$${idx++}`); params.push(body); }
  if (generatedBy      !== undefined) { setClauses.push(`generated_by=$${idx++}`);      params.push(generatedBy); }
  if (ollamaModel      !== undefined) { setClauses.push(`ollama_model=$${idx++}`);      params.push(ollamaModel); }
  if (generationStatus !== undefined) { setClauses.push(`generation_status=$${idx++}`); params.push(generationStatus); }

  if (params.length === 0) throw new Error('Nothing to update');
  params.push(id, ue);

  const { rows } = await query(
    `UPDATE crm_drafts SET ${setClauses.join(', ')} WHERE id=$${idx++} AND user_email=$${idx} RETURNING *`,
    params
  );
  if (!rows[0]) throw new Error('Draft not found');
  return draftRow(rows[0]);
}

// ── Escalations ───────────────────────────────────────────────────────────────
async function saveEscalation(userEmail, customerEmail, draftId, escalateTo, note, emailSent, sendError) {
  const { rows } = await query(
    `INSERT INTO crm_escalations (user_email,customer_email,draft_id,escalate_to,note,email_sent,send_error)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [userEmail.toLowerCase(), (customerEmail||'').toLowerCase(), draftId||null, escalateTo, note||null, !!emailSent, sendError||null]
  );
  return rows[0].id;
}

// ── Settings ──────────────────────────────────────────────────────────────────
async function getSettings(userEmail) {
  const { rows } = await query('SELECT * FROM crm_settings WHERE user_email=$1', [userEmail.toLowerCase()]);
  return { defaultDays: rows[0]?.followup_days ?? 3 };
}

async function setFollowUpDays(userEmail, days) {
  await query(
    'INSERT INTO crm_settings (user_email,followup_days) VALUES ($1,$2) ON CONFLICT (user_email) DO UPDATE SET followup_days=$2, updated_at=NOW()',
    [userEmail.toLowerCase(), days]
  );
}

// ── AI Summary ────────────────────────────────────────────────────────────────
async function updateAiSummary(userEmail, customerEmail, summary) {
  await query(
    'UPDATE crm_customers SET ai_summary=$1, ai_summary_updated_at=NOW(), updated_at=NOW() WHERE user_email=$2 AND email=$3',
    [summary, userEmail.toLowerCase(), customerEmail.toLowerCase()]
  );
}

module.exports = {
  ensureUser, getUser,
  upsertCustomer, getCustomer, listCustomers,
  addNote, addQuotation,
  addFollowUp, updateFollowUp, getPendingFollowUps, getAllPendingFollowUps,
  recordEmail,
  addDraft, getDraft, listDrafts, updateDraft,
  saveEscalation,
  getSettings, setFollowUpDays,
  updateAiSummary,
};
