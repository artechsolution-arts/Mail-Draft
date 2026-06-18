'use strict';

const https = require('https');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OpenAI_API_KEY || '';
const OPENAI_MODEL   = process.env.OPENAI_MODEL   || 'gpt-4o-mini';

function openaiPost(messages, options = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature: options.temperature ?? 0.4,
      max_tokens:  options.maxTokens   ?? 800,
    });
    const req = https.request({
      hostname: 'api.openai.com', port: 443,
      path: '/v1/chat/completions', method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 60000,
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { reject(new Error('Invalid JSON from OpenAI: ' + raw.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('OpenAI request timed out')); });
    req.write(body); req.end();
  });
}

async function generateEmailDraft({ senderName, customer, receivedSubject, receivedBody, notes, sentEmails }) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  const noteText    = (notes || []).map(n => `- ${n.text || n}`).join('\n') || 'None';
  const sentSummary = (sentEmails || []).slice(0, 3).map(e => `Subject: ${e.subject}`).join('\n') || 'None';

  const systemPrompt = `You are ${senderName}, writing a professional email reply on behalf of your company. Keep replies concise, friendly, and action-oriented. Do NOT use placeholders like [Name] or [Date]. Do NOT include a subject line. Output ONLY the email body text.`;

  const userPrompt = `Customer: ${customer.name || customer.email}${customer.company ? ` (${customer.company})` : ''}
Email: ${customer.email}

Previous notes about this customer:
${noteText}

Recent emails you have sent to them:
${sentSummary}

Received email to reply to:
Subject: ${receivedSubject}
Body: ${(receivedBody || '').slice(0, 2000)}

Write a professional reply email body (no subject line, no placeholders):`;

  const result = await openaiPost([
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt },
  ], { temperature: 0.4, maxTokens: 600 });

  if (result.error) throw new Error(result.error.message || 'OpenAI error');
  const text = result.choices?.[0]?.message?.content?.trim() || '';
  if (!text) throw new Error('OpenAI returned empty response');
  return { body: text, model: result.model || OPENAI_MODEL };
}

async function chat(messages, systemPrompt) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  const result = await openaiPost([
    { role: 'system', content: systemPrompt },
    ...messages,
  ], { temperature: 0.4, maxTokens: 1000 });

  if (result.error) throw new Error(result.error.message || 'OpenAI error');
  return result.choices?.[0]?.message?.content?.trim() || '';
}

module.exports = { generateEmailDraft, chat, OPENAI_MODEL, isAvailable: () => !!OPENAI_API_KEY };
