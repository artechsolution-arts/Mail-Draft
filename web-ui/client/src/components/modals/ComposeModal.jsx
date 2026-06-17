import React, { useState, useEffect, useRef } from 'react';
import Modal from '../ui/Modal';
import { sendEmail } from '../../api.js';
import { useApp } from '../../context/AppContext.jsx';

const FOLLOW_UP_OPTS = [
  { value: 1, label: '1 day' },
  { value: 3, label: '3 days' },
  { value: 5, label: '5 days' },
  { value: 7, label: '7 days' },
  { value: 0, label: 'None' },
];

export default function ComposeModal({ open, onClose, customer, onSent }) {
  const { addToast } = useApp();

  const [subject,      setSubject]      = useState('');
  const [body,         setBody]         = useState('');
  const [cc,           setCc]           = useState('');
  const [followUpDays, setFollowUpDays] = useState(3);
  const [attachments,  setAttachments]  = useState([]);
  const [subjectErr,   setSubjectErr]   = useState('');
  const [bodyErr,      setBodyErr]      = useState('');
  const [apiError,     setApiError]     = useState('');
  const [sending,      setSending]      = useState(false);
  const [dragging,     setDragging]     = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setSubject(''); setBody(''); setCc(''); setFollowUpDays(3);
      setAttachments([]); setSubjectErr(''); setBodyErr('');
      setApiError(''); setSending(false); setDragging(false);
    }
  }, [open]);

  function validate() {
    let ok = true;
    if (!subject.trim()) { setSubjectErr('Subject is required.'); ok = false; } else setSubjectErr('');
    if (!body.trim())    { setBodyErr('Message body is required.'); ok = false; } else setBodyErr('');
    return ok;
  }

  function addFiles(files) {
    const incoming = Array.from(files);
    setAttachments(prev => {
      const seen = new Set(prev.map(f => `${f.name}:${f.size}`));
      return [...prev, ...incoming.filter(f => !seen.has(`${f.name}:${f.size}`))];
    });
  }

  function handleDragOver(e)  { e.preventDefault(); setDragging(true); }
  function handleDragLeave()  { setDragging(false); }
  function handleDrop(e)      { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files); }

  async function handleSend(e) {
    e.preventDefault();
    if (!validate()) return;
    setSending(true); setApiError('');
    try {
      const fd = new FormData();
      fd.append('subject', subject.trim());
      fd.append('body', body.trim());
      if (cc.trim()) fd.append('cc', cc.trim());
      fd.append('followUpDays', String(followUpDays));
      attachments.forEach(file => fd.append('attachments', file));
      await sendEmail(customer.email, fd);
      addToast('success', 'Email sent!');
      onSent?.(); onClose();
    } catch (err) {
      setApiError(err.message ?? 'Failed to send email. Please try again.');
    } finally {
      setSending(false);
    }
  }

  if (!customer) return null;

  const initials = customer.name
    ? customer.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : customer.email[0].toUpperCase();

  const recipientLabel = customer.name
    ? `${customer.name} <${customer.email}>`
    : customer.email;

  return (
    <Modal open={open} onClose={onClose} title="New Email" maxWidth="md">
      <form onSubmit={handleSend} noValidate className="modal-form compose-form">

        {/* ── Recipient row ── */}
        <div className="compose-to-row">
          <span className="compose-field-label">To</span>
          <div className="compose-recipient-chip">
            <span className="compose-chip-avatar">{initials}</span>
            <span className="compose-chip-name">{recipientLabel}</span>
          </div>
        </div>

        {/* ── Subject ── */}
        <div className="compose-subject-row">
          <label htmlFor="cm-subject" className="compose-field-label">Subject</label>
          <div style={{ flex: 1 }}>
            <input
              id="cm-subject"
              type="text"
              value={subject}
              onChange={e => { setSubject(e.target.value); setSubjectErr(''); }}
              placeholder="What's this about?"
              autoComplete="off"
              disabled={sending}
              className="compose-subject-input"
            />
            {subjectErr && <p className="mf-error" style={{ marginTop: 4 }}>{subjectErr}</p>}
          </div>
        </div>

        {/* ── Message ── */}
        <div className="compose-body-wrap">
          <textarea
            id="cm-body"
            value={body}
            onChange={e => { setBody(e.target.value); setBodyErr(''); }}
            placeholder="Write your message…"
            rows={9}
            disabled={sending}
          />
          {bodyErr && <p className="mf-error" style={{ marginTop: 4 }}>{bodyErr}</p>}
        </div>

        {/* ── Secondary fields ── */}
        <div className="compose-secondary">

          {/* CC */}
          <div className="mf-field">
            <label htmlFor="cm-cc">CC</label>
            <input id="cm-cc" type="email" value={cc} onChange={e => setCc(e.target.value)} placeholder="cc@example.com" autoComplete="off" disabled={sending} />
          </div>

          {/* Attachments */}
          <div className="mf-field">
            <label>Attachments</label>
            <div
              className={`compose-dropzone${dragging ? ' dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={e => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }} />
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, color: 'var(--text-3)' }}>
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
              </svg>
              <span>Drag &amp; drop, or <strong onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>browse</strong></span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>any type · 24 MB max</span>
            </div>
            {attachments.length > 0 && (
              <div className="compose-chips">
                {attachments.map((file, i) => (
                  <span key={i} className="compose-file-chip">
                    {file.name}
                    <span style={{ fontSize: 10.5, color: 'var(--text-3)', marginLeft: 3 }}>({(file.size / 1024).toFixed(0)} KB)</span>
                    <button type="button" onClick={e => { e.stopPropagation(); setAttachments(p => p.filter((_, j) => j !== i)); }} aria-label={`Remove ${file.name}`} className="compose-chip-remove">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Follow-up */}
          <div className="mf-field" style={{ marginBottom: 0 }}>
            <label>Auto follow-up</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
              {FOLLOW_UP_OPTS.map(opt => (
                <button key={opt.value} type="button" className={`fu-pill${followUpDays === opt.value ? ' active' : ''}`} onClick={() => setFollowUpDays(opt.value)} disabled={sending}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {apiError && <p className="mf-api-error">{apiError}</p>}

        {/* Actions */}
        <div className="mf-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={sending}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={sending}>
            {sending ? 'Sending…' : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: 6 }}>
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
                Send Email
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
