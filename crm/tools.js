'use strict';

const storage = require('./storage');

function ok(text) { return { content: [{ type: 'text', text }] }; }
function err(text) { return { content: [{ type: 'text', text: `Error: ${text}` }] }; }

// MCP tools use CRM_DEFAULT_USER env var or the optional owner_email arg
function getOwner(args) {
  return ((args.owner_email || process.env.CRM_DEFAULT_USER || '')).toLowerCase().trim();
}

const OWNER_SCHEMA = {
  owner_email: { type: 'string', description: 'Your email address (owner). Falls back to CRM_DEFAULT_USER env var.' },
};

const crmTools = [
  // ── Customer management ────────────────────────────────────────────────────
  {
    name: 'crm_add_customer',
    description: 'Add or update a CRM customer record.',
    inputSchema: {
      type: 'object',
      properties: {
        ...OWNER_SCHEMA,
        email:         { type: 'string', description: 'Customer email (required)' },
        name:          { type: 'string', description: 'Full name' },
        company:       { type: 'string', description: 'Company name' },
        phone:         { type: 'string', description: 'Phone number' },
        customerSince: { type: 'string', description: 'ISO date string' },
      },
      required: ['email'],
    },
    async handler(args) {
      try {
        const ue = getOwner(args);
        if (!ue) return err('Set CRM_DEFAULT_USER env var or pass owner_email');
        await storage.ensureUser(ue);
        const c = await storage.upsertCustomer(ue, args);
        return ok(`Customer saved: ${c.name || c.email} (${c.email})`);
      } catch (e) { return err(e.message); }
    },
  },

  {
    name: 'crm_get_customer',
    description: 'Get full CRM profile for a customer.',
    inputSchema: {
      type: 'object',
      properties: { ...OWNER_SCHEMA, email: { type: 'string' } },
      required: ['email'],
    },
    async handler(args) {
      try {
        const ue = getOwner(args);
        if (!ue) return err('Set CRM_DEFAULT_USER env var or pass owner_email');
        const c = await storage.getCustomer(ue, args.email);
        if (!c) return ok(`No CRM record for ${args.email}`);
        return ok([
          `Name: ${c.name||'—'}`, `Email: ${c.email}`, `Company: ${c.company||'—'}`, `Phone: ${c.phone||'—'}`,
          `Received: ${c.receivedEmails.length}`, `Sent: ${c.sentEmails.length}`,
          `Follow-ups: ${c.followUps.filter(f=>f.status==='pending').length} pending`,
          `Notes: ${c.notes.length}`, `Quotations: ${c.quotations.length}`,
          `AI Summary: ${c.aiSummary||'None'}`,
        ].join('\n'));
      } catch (e) { return err(e.message); }
    },
  },

  {
    name: 'crm_list_customers',
    description: 'List all CRM customers for the owner.',
    inputSchema: { type: 'object', properties: { ...OWNER_SCHEMA } },
    async handler(args) {
      try {
        const ue = getOwner(args);
        if (!ue) return err('Set CRM_DEFAULT_USER env var or pass owner_email');
        const all = await storage.listCustomers(ue);
        if (!all.length) return ok('No customers yet.');
        return ok(all.map((c,i)=>`${i+1}. ${c.name||c.email} | ${c.company||'N/A'} | Emails: ${c.receivedEmails.length+c.sentEmails.length} | Pending FU: ${c.followUps.filter(f=>f.status==='pending').length}`).join('\n'));
      } catch (e) { return err(e.message); }
    },
  },

  // ── Notes & Quotations ─────────────────────────────────────────────────────
  {
    name: 'crm_add_note',
    description: 'Add an internal note to a customer.',
    inputSchema: { type: 'object', properties: { ...OWNER_SCHEMA, email: { type: 'string' }, text: { type: 'string' } }, required: ['email','text'] },
    async handler(args) {
      try {
        const ue = getOwner(args);
        if (!ue) return err('Set CRM_DEFAULT_USER or pass owner_email');
        await storage.addNote(ue, args.email, args.text);
        return ok(`Note added to ${args.email}`);
      } catch (e) { return err(e.message); }
    },
  },

  {
    name: 'crm_add_quotation',
    description: 'Record a quotation for a customer.',
    inputSchema: {
      type: 'object',
      properties: {
        ...OWNER_SCHEMA,
        email: { type: 'string' }, reference: { type: 'string' },
        description: { type: 'string' }, amount: { type: 'string' },
        currency: { type: 'string' }, validUntil: { type: 'string' },
      },
      required: ['email','reference'],
    },
    async handler(args) {
      try {
        const ue = getOwner(args);
        if (!ue) return err('Set CRM_DEFAULT_USER or pass owner_email');
        const { email, ...rest } = args;
        const q = await storage.addQuotation(ue, email, rest);
        return ok(`Quotation ${q.reference} recorded for ${email}`);
      } catch (e) { return err(e.message); }
    },
  },

  // ── Follow-ups ─────────────────────────────────────────────────────────────
  {
    name: 'crm_set_followup',
    description: 'Create a follow-up task for a customer.',
    inputSchema: {
      type: 'object',
      properties: { ...OWNER_SCHEMA, email: { type: 'string' }, subject: { type: 'string' }, daysUntilDue: { type: 'number' }, note: { type: 'string' } },
      required: ['email'],
    },
    async handler(args) {
      try {
        const ue = getOwner(args);
        if (!ue) return err('Set CRM_DEFAULT_USER or pass owner_email');
        const fu = await storage.addFollowUp(ue, args.email, { subject: args.subject, daysUntilDue: args.daysUntilDue, note: args.note });
        return ok(`Follow-up for ${args.email} — due ${new Date(fu.dueAt).toLocaleDateString()}`);
      } catch (e) { return err(e.message); }
    },
  },

  {
    name: 'crm_get_followups',
    description: 'Get all overdue follow-ups.',
    inputSchema: { type: 'object', properties: { ...OWNER_SCHEMA } },
    async handler(args) {
      try {
        const ue = getOwner(args);
        if (!ue) return err('Set CRM_DEFAULT_USER or pass owner_email');
        const items = await storage.getPendingFollowUps(ue);
        if (!items.length) return ok('No overdue follow-ups.');
        return ok(items.map(({customer,followUp},i)=>`${i+1}. ${customer.name||customer.email} — ${followUp.subject||'N/A'} (due ${new Date(followUp.dueAt).toLocaleDateString()}) ID:${followUp.id}`).join('\n'));
      } catch (e) { return err(e.message); }
    },
  },

  {
    name: 'crm_complete_followup',
    description: 'Mark a follow-up as completed or dismissed.',
    inputSchema: {
      type: 'object',
      properties: { ...OWNER_SCHEMA, email: { type: 'string' }, followUpId: { type: 'string' }, status: { type: 'string', enum: ['completed','dismissed'] } },
      required: ['email','followUpId'],
    },
    async handler(args) {
      try {
        const ue = getOwner(args);
        if (!ue) return err('Set CRM_DEFAULT_USER or pass owner_email');
        const fu = await storage.updateFollowUp(ue, args.followUpId, args.status||'completed');
        return ok(`Follow-up ${fu.id} marked ${fu.status}`);
      } catch (e) { return err(e.message); }
    },
  },

  // ── Email processing ───────────────────────────────────────────────────────
  {
    name: 'crm_record_email',
    description: 'Record an email (received or sent) against a customer. Auto-schedules follow-ups.',
    inputSchema: {
      type: 'object',
      properties: {
        ...OWNER_SCHEMA,
        customerEmail: { type: 'string' }, direction: { type: 'string', enum: ['received','sent'] },
        subject: { type: 'string' }, body: { type: 'string' }, date: { type: 'string' }, emailId: { type: 'string' },
      },
      required: ['customerEmail','direction'],
    },
    async handler(args) {
      try {
        const ue = getOwner(args);
        if (!ue) return err('Set CRM_DEFAULT_USER or pass owner_email');
        const { customerEmail, direction, ...emailData } = args;
        await storage.recordEmail(ue, customerEmail, emailData, direction);
        return ok(`Email recorded for ${customerEmail} (${direction})`);
      } catch (e) { return err(e.message); }
    },
  },

  {
    name: 'crm_process_email',
    description: 'Process a received email: save to CRM and create a draft reply for approval.',
    inputSchema: {
      type: 'object',
      properties: {
        ...OWNER_SCHEMA,
        customerEmail: { type: 'string' }, customerName: { type: 'string' },
        subject: { type: 'string' }, body: { type: 'string' }, date: { type: 'string' },
        emailId: { type: 'string' }, draftReply: { type: 'string' },
      },
      required: ['customerEmail','subject','draftReply'],
    },
    async handler(args) {
      try {
        const ue = getOwner(args);
        if (!ue) return err('Set CRM_DEFAULT_USER or pass owner_email');
        await storage.ensureUser(ue);
        await storage.upsertCustomer(ue, { email: args.customerEmail, name: args.customerName||'' });
        await storage.recordEmail(ue, args.customerEmail, { subject: args.subject, body: args.body, date: args.date, emailId: args.emailId }, 'received');
        const draft = await storage.addDraft(ue, {
          customerEmail: args.customerEmail, customerName: args.customerName,
          inReplyTo: args.emailId,
          subject: args.subject?.startsWith('Re:') ? args.subject : `Re: ${args.subject}`,
          body: args.draftReply,
        });
        return ok(`Draft created (ID: ${draft.id}) for ${args.customerEmail}.\n\nSubject: ${draft.subject}\n\n${draft.body}`);
      } catch (e) { return err(e.message); }
    },
  },

  // ── Draft management ───────────────────────────────────────────────────────
  {
    name: 'crm_list_pending_drafts',
    description: 'List all email drafts waiting for approval.',
    inputSchema: { type: 'object', properties: { ...OWNER_SCHEMA } },
    async handler(args) {
      try {
        const ue = getOwner(args);
        if (!ue) return err('Set CRM_DEFAULT_USER or pass owner_email');
        const drafts = await storage.listDrafts(ue, 'pending');
        if (!drafts.length) return ok('No pending drafts.');
        return ok(drafts.map((d,i)=>`${i+1}. ID:${d.id} | To:${d.customerEmail} | ${d.subject} | ${new Date(d.createdAt).toLocaleString()}`).join('\n'));
      } catch (e) { return err(e.message); }
    },
  },

  {
    name: 'crm_update_draft',
    description: 'Approve, reject, or escalate a pending draft.',
    inputSchema: {
      type: 'object',
      properties: { ...OWNER_SCHEMA, draftId: { type: 'string' }, action: { type: 'string', enum: ['approve','reject','escalate'] }, editedBody: { type: 'string' } },
      required: ['draftId','action'],
    },
    async handler(args) {
      try {
        const ue = getOwner(args);
        if (!ue) return err('Set CRM_DEFAULT_USER or pass owner_email');
        const map = { approve:'approved', reject:'rejected', escalate:'escalated' };
        const draft = await storage.updateDraft(ue, args.draftId, { status: map[args.action], editedBody: args.editedBody });
        return ok(`Draft ${draft.id} ${draft.status}.`);
      } catch (e) { return err(e.message); }
    },
  },

  // ── AI Summary ─────────────────────────────────────────────────────────────
  {
    name: 'crm_update_summary',
    description: 'Store an AI-generated summary for a customer.',
    inputSchema: { type: 'object', properties: { ...OWNER_SCHEMA, email: { type: 'string' }, summary: { type: 'string' } }, required: ['email','summary'] },
    async handler(args) {
      try {
        const ue = getOwner(args);
        if (!ue) return err('Set CRM_DEFAULT_USER or pass owner_email');
        await storage.updateAiSummary(ue, args.email, args.summary);
        return ok(`Summary updated for ${args.email}`);
      } catch (e) { return err(e.message); }
    },
  },

  {
    name: 'crm_get_timeline',
    description: 'Get the full activity timeline for a customer.',
    inputSchema: { type: 'object', properties: { ...OWNER_SCHEMA, email: { type: 'string' } }, required: ['email'] },
    async handler(args) {
      try {
        const ue = getOwner(args);
        if (!ue) return err('Set CRM_DEFAULT_USER or pass owner_email');
        const c = await storage.getCustomer(ue, args.email);
        if (!c) return ok(`No CRM record for ${args.email}`);
        const events = [
          ...c.receivedEmails.map(e=>({date:e.date||e.recordedAt,label:`Received: ${e.subject||'(no subject)'}`})),
          ...c.sentEmails.map(e=>({date:e.date||e.recordedAt,label:`Sent: ${e.subject||'(no subject)'}`})),
          ...c.quotations.map(q=>({date:q.createdAt,label:`Quotation: ${q.reference}`})),
          ...c.notes.map(n=>({date:n.createdAt,label:`Note: ${n.text}`})),
          ...c.followUps.map(f=>({date:f.createdAt,label:`Follow-up (${f.status}): ${f.subject}`})),
        ].sort((a,b)=>new Date(b.date)-new Date(a.date));
        if (!events.length) return ok(`No activity for ${args.email}`);
        return ok(events.map(ev=>`[${new Date(ev.date).toLocaleDateString()}] ${ev.label}`).join('\n'));
      } catch (e) { return err(e.message); }
    },
  },

  {
    name: 'crm_chatbot',
    description: 'Answer CRM queries: customer info, follow-ups, quotations, next actions.',
    inputSchema: { type: 'object', properties: { ...OWNER_SCHEMA, query: { type: 'string' }, customerEmail: { type: 'string' } }, required: ['query'] },
    async handler(args) {
      try {
        const ue = getOwner(args);
        if (!ue) return err('Set CRM_DEFAULT_USER or pass owner_email');
        const q = args.query.toLowerCase();
        const ce = args.customerEmail;
        if (/overdue|pending follow.?up/.test(q)) {
          const items = await storage.getPendingFollowUps(ue);
          return ok(items.length ? items.map(({customer,followUp})=>`• ${customer.name||customer.email} — ${followUp.subject||'N/A'} (${new Date(followUp.dueAt).toLocaleDateString()})`).join('\n') : 'No overdue follow-ups.');
        }
        if (ce && /summary|about|tell me/.test(q)) {
          const c = await storage.getCustomer(ue, ce);
          return ok(c?.aiSummary || `${c?.name||ce}: ${c?.receivedEmails.length||0} received, ${c?.sentEmails.length||0} sent.`);
        }
        if (ce && /quotation|quote/.test(q)) {
          const c = await storage.getCustomer(ue, ce);
          return ok((c?.quotations||[]).map(q=>`• ${q.reference}: ${q.description||''} — ${q.amount||'N/A'}`).join('\n') || 'No quotations.');
        }
        if (/all customer|list customer/.test(q)) {
          const all = await storage.listCustomers(ue);
          return ok(all.map(c=>`• ${c.name||c.email} (${c.email})`).join('\n') || 'No customers.');
        }
        return ok('Try: "show pending follow-ups", "tell me about [email]", "open quotations for [email]", "list all customers".');
      } catch (e) { return err(e.message); }
    },
  },

  {
    name: 'crm_set_followup_days',
    description: 'Set the default follow-up period in days.',
    inputSchema: { type: 'object', properties: { ...OWNER_SCHEMA, days: { type: 'number' } }, required: ['days'] },
    async handler(args) {
      try {
        const ue = getOwner(args);
        if (!ue) return err('Set CRM_DEFAULT_USER or pass owner_email');
        await storage.setFollowUpDays(ue, args.days);
        return ok(`Default follow-up period set to ${args.days} days.`);
      } catch (e) { return err(e.message); }
    },
  },
];

module.exports = { crmTools };
