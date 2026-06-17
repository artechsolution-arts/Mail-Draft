'use strict';
const http = require('http');

const OLLAMA_BASE  = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';

function ollamaPost(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const u = new URL(path, OLLAMA_BASE);
    const req = http.request({
      hostname: u.hostname,
      port: parseInt(u.port) || 11434,
      path: u.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout: 90000,
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ error: 'parse_error', raw: data }); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Ollama request timed out after 90s')); });
    req.write(payload);
    req.end();
  });
}

async function isAvailable() {
  try {
    const res = await ollamaPost('/api/tags', {});
    return Array.isArray(res.models);
  } catch { return false; }
}

async function availableModels() {
  try {
    const res = await ollamaPost('/api/tags', {});
    return (res.models || []).map(m => m.name);
  } catch { return []; }
}

/**
 * Generate a contextual email reply draft using the local Ollama model.
 *
 * @param {object} opts
 * @param {string} opts.senderName       — logged-in user's display name
 * @param {object} opts.customer         — { email, name, company }
 * @param {string} opts.receivedSubject
 * @param {string} opts.receivedBody
 * @param {Array}  opts.notes            — recent crm notes for this customer
 * @param {Array}  opts.sentEmails       — recent sent emails to this customer
 * @param {string} [opts.model]          — override model
 */
async function generateEmailDraft({ senderName, customer, receivedSubject, receivedBody, notes = [], sentEmails = [], model }) {
  const usedModel = model || OLLAMA_MODEL;

  const contextParts = [
    `You are ${senderName || 'a professional business representative'} writing an email reply.`,
    `Recipient: ${customer.name || customer.email}${customer.company ? ` (${customer.company})` : ''}`,
  ];

  if (notes.length) {
    contextParts.push(`Context about this customer: ${notes.slice(0, 3).map(n => n.text).join(' | ')}`);
  }
  if (sentEmails.length) {
    contextParts.push(`Recent topics discussed: ${sentEmails.slice(0, 3).map(e => e.subject).filter(Boolean).join(', ')}`);
  }

  const prompt = `${contextParts.join('\n')}

--- Received email ---
Subject: ${receivedSubject || '(no subject)'}
${receivedBody ? receivedBody.slice(0, 1000) : '(no body)'}
--- End of received email ---

Instructions: Write a professional, concise, and genuinely helpful reply to the email above.
- Be warm and direct
- Address the specific points raised
- Do NOT include subject line, headers, or "From:" — just the body text
- End with: Best regards,\\n${senderName || 'Regards'}
- Keep it under 200 words unless the email demands more detail

Reply:`;

  const result = await ollamaPost('/api/generate', {
    model: usedModel,
    prompt,
    stream: false,
    options: { temperature: 0.65, num_ctx: 3072, num_predict: 512 },
  });

  const text = (result.response || '').trim();
  if (!text || result.error) throw new Error(result.error || 'Ollama returned empty response');
  return { body: text, model: usedModel };
}

/**
 * Generate a proactive follow-up email draft (not a reply, but a new outreach).
 */
async function generateFollowUpDraft({ senderName, customer, lastSubject, notes = [], model }) {
  const usedModel = model || OLLAMA_MODEL;

  const prompt = `You are ${senderName || 'a professional'} writing a follow-up email.
Recipient: ${customer.name || customer.email}${customer.company ? ` at ${customer.company}` : ''}
${notes.length ? `Context: ${notes.slice(0, 2).map(n => n.text).join(' | ')}` : ''}
Last topic: ${lastSubject || 'our previous conversation'}

Write a short, professional follow-up email body (under 120 words).
Do NOT include subject line or headers — just the email body.
End with: Best regards,\\n${senderName || 'Regards'}

Follow-up email:`;

  const result = await ollamaPost('/api/generate', {
    model: usedModel,
    prompt,
    stream: false,
    options: { temperature: 0.6, num_ctx: 2048, num_predict: 300 },
  });

  const text = (result.response || '').trim();
  if (!text || result.error) throw new Error(result.error || 'Ollama returned empty response');
  return { body: text, model: usedModel };
}

module.exports = { isAvailable, availableModels, generateEmailDraft, generateFollowUpDraft, OLLAMA_MODEL };
