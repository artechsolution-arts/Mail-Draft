async function request(method, path, body, isFormData = false) {
  const headers = {};
  if (!isFormData && body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const options = { method, headers };
  if (body !== undefined) {
    options.body = isFormData ? body : JSON.stringify(body);
  }

  const res = await fetch(path, options);

  if (res.status === 401) {
    throw new Error('UNAUTHENTICATED');
  }

  if (!res.ok) {
    let errorText;
    try {
      errorText = await res.text();
    } catch {
      errorText = res.statusText;
    }
    throw new Error(`Request failed with status ${res.status}: ${errorText}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res.text();
}

export async function getMe() {
  return request('GET', '/api/crm/me');
}

export async function getCustomers() {
  return request('GET', '/api/crm/customers');
}

export async function getCustomer(email) {
  return request('GET', `/api/crm/customers/${encodeURIComponent(email)}`);
}

export async function upsertCustomer(fields) {
  return request('POST', '/api/crm/customers', fields);
}

export async function sendEmail(customerEmail, formData) {
  return request('POST', `/api/crm/customers/${encodeURIComponent(customerEmail)}/send-email`, formData, true);
}

export async function addNote(email, text) {
  return request('POST', `/api/crm/customers/${encodeURIComponent(email)}/notes`, { text });
}

export async function addQuotation(email, q) {
  // q: { reference, description, amount, currency, validUntil }
  return request('POST', `/api/crm/customers/${encodeURIComponent(email)}/quotations`, q);
}

export async function addFollowUp(email, { subject, note, daysUntilDue }) {
  return request('POST', `/api/crm/customers/${encodeURIComponent(email)}/follow-ups`, { subject, note, daysUntilDue });
}

export async function updateFollowUp(email, fuId, status) {
  return request('PATCH', `/api/crm/customers/${encodeURIComponent(email)}/follow-ups/${fuId}`, { status });
}

export async function getOverdueFollowUps() {
  return request('GET', '/api/crm/follow-ups/overdue');
}

export async function getDrafts() {
  return request('GET', '/api/crm/drafts');
}

export async function updateDraft(id, fields) {
  // fields: { body, status }
  return request('PATCH', `/api/crm/drafts/${id}`, fields);
}

export async function sendDraft(id, formData) {
  return request('POST', `/api/crm/drafts/${id}/send`, formData, true);
}

export async function escalateDraft(id, { escalateTo, note }) {
  return request('POST', `/api/crm/drafts/${id}/escalate`, { escalateTo, note });
}

export async function escalateCustomer(email, { escalateTo, note }) {
  return request('POST', `/api/crm/customers/${encodeURIComponent(email)}/escalate`, { escalateTo, note });
}

export async function processEmail(payload) {
  return request('POST', '/api/crm/process-email', payload);
}

export async function importPreview(formData) {
  return request('POST', '/api/crm/import/preview', formData, true);
}

export async function importCustomers(formData) {
  return request('POST', '/api/crm/import/customers', formData, true);
}

export async function getApiKeys() {
  return request('GET', '/api/crm/api-keys');
}

export async function createApiKey(name) {
  return request('POST', '/api/crm/api-keys', { name });
}

export async function revokeApiKey(id) {
  return request('DELETE', `/api/crm/api-keys/${id}`);
}

export async function getAuthStatus() {
  return request('GET', '/api/crm/auth/status');
}

export async function getSettings() {
  return request('GET', '/api/crm/settings');
}

export async function setFollowUpDays(days) {
  return request('PATCH', '/api/crm/settings/follow-up-days', { days });
}

export async function sendChat({ query, customerEmail }) {
  return request('POST', '/api/crm/chat', { query, customerEmail });
}
