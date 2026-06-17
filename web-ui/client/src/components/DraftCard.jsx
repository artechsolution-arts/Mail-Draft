import React, { useRef, useState } from 'react';
import Spinner from './ui/Spinner.jsx';
import { updateDraft, sendDraft } from '../api.js';
import { useApp } from '../context/AppContext.jsx';

/**
 * DraftCard — displays a single AI-generated draft and its action buttons.
 *
 * Props:
 *   draft      {object}    Draft record from the API.
 *   onRefresh  {Function}  Called after any mutating action so the parent
 *                          can reload the drafts list.
 */
export default function DraftCard({ draft, onRefresh }) {
  const { addToast, refreshActiveCustomer } = useApp();

  const [editMode, setEditMode] = useState(false);
  const [editedBody, setEditedBody] = useState(draft.body || '');
  const [sending, setSending] = useState(false);

  const fileInputRef = useRef(null);
  const [attachedFiles, setAttachedFiles] = useState([]);

  const isGenerating = draft.generationStatus === 'generating';
  const isReady =
    !isGenerating &&
    draft.status !== 'sent' &&
    draft.status !== 'rejected';

  // ── File attachment helpers ──────────────────────────────────────────────

  function handleFileChange(e) {
    setAttachedFiles(Array.from(e.target.files || []));
  }

  function removeFile(idx) {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── Send (approve as-is) ─────────────────────────────────────────────────

  async function handleSend() {
    setSending(true);
    try {
      const fd = new FormData();
      attachedFiles.forEach((f) => fd.append('attachments', f));
      const data = await sendDraft(draft.id, fd);
      addToast(
        'success',
        data.attachments > 0
          ? `Sent with ${data.attachments} attachment(s)`
          : 'Email sent'
      );
      await refreshActiveCustomer();
      onRefresh();
    } catch (err) {
      addToast('error', err.message || 'Send failed');
    } finally {
      setSending(false);
    }
  }

  // ── Send edited ──────────────────────────────────────────────────────────

  async function handleSendEdited() {
    const body = editedBody.trim();
    if (!body) {
      addToast('error', 'Email body is empty');
      return;
    }
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('body', body);
      attachedFiles.forEach((f) => fd.append('attachments', f));
      const data = await sendDraft(draft.id, fd);
      addToast(
        'success',
        data.attachments > 0
          ? `Sent with ${data.attachments} attachment(s)`
          : 'Email sent'
      );
      await refreshActiveCustomer();
      onRefresh();
    } catch (err) {
      addToast('error', err.message || 'Send failed');
    } finally {
      setSending(false);
    }
  }

  // ── Reject ───────────────────────────────────────────────────────────────

  async function handleReject() {
    try {
      await updateDraft(draft.id, { status: 'rejected' });
      onRefresh();
    } catch (err) {
      addToast('error', err.message || 'Could not reject draft');
    }
  }

  // ── Status badge label ───────────────────────────────────────────────────

  const statusLabel = isGenerating ? 'generating…' : draft.status;

  return (
    <>
      <div className={`draft-item ${draft.status}`} id={`draft-${draft.id}`}>

        {/* Top row: to/subject + status badge + timestamp */}
        <div className="draft-top">
          <div>
            <div className="draft-to">To: {draft.customerEmail}</div>
            <div className="draft-subject">{draft.subject}</div>
            {draft.ollamaModel && (
              <span className="ai-badge" title="AI generated">
                {'🤖'} {draft.ollamaModel}
              </span>
            )}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 'var(--sp-1)',
            }}
          >
            <span className={`status-pill ${draft.status}`}>{statusLabel}</span>
            <span className="draft-ts">
              {new Date(draft.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Source email reference */}
        {draft.sourceSubject && (
          <div className="draft-source">
            <div className="draft-source-label">In reply to:</div>
            <div className="draft-source-subject">{draft.sourceSubject}</div>
            {draft.sourceBody && (
              <div className="draft-source-body">
                {draft.sourceBody.length > 300
                  ? `${draft.sourceBody.slice(0, 300)}…`
                  : draft.sourceBody}
              </div>
            )}
          </div>
        )}

        {/* Body area: spinner while generating, view/edit otherwise */}
        {isGenerating ? (
          <div className="draft-generating">
            <Spinner size={14} />
            AI is drafting your reply…
          </div>
        ) : (
          <>
            {/* Read-only view */}
            {!editMode && (
              <div
                className="draft-body-view"
                style={{ whiteSpace: 'pre-wrap' }}
              >
                {draft.body}
              </div>
            )}

            {/* Editable textarea */}
            {editMode && (
              <textarea
                className="draft-edit-area"
                aria-label="Edit draft reply"
                value={editedBody}
                onChange={(e) => setEditedBody(e.target.value)}
              />
            )}
          </>
        )}

        {/* Attachment input + action buttons (only when draft is actionable) */}
        {isReady && (
          <>
            {/* Hidden file input triggered by Attach button */}
            <div style={{ marginTop: 8 }}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Attach
              </button>
              <span className="attach-hint" style={{ marginLeft: 8 }}>
                optional — drag &amp; drop any file
              </span>
            </div>

            {/* Attached file chips */}
            {attachedFiles.length > 0 && (
              <div className="attach-list" style={{ marginTop: 4 }}>
                {attachedFiles.map((f, i) => (
                  <span className="attach-chip" key={i}>
                    {f.name}{' '}
                    <span style={{ color: 'var(--text-3)' }}>
                      ({(f.size / 1024).toFixed(0)} KB)
                    </span>
                    <button
                      type="button"
                      title="Remove"
                      onClick={() => removeFile(i)}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Normal action row */}
            {!editMode && (
              <div className="action-row">
                <button
                  className="btn btn-success btn-sm"
                  onClick={handleSend}
                  disabled={sending}
                >
                  {sending ? 'Sending…' : 'Approve & Send'}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setEditedBody(draft.body || '');
                    setEditMode(true);
                  }}
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleReject}
                >
                  Reject
                </button>
              </div>
            )}

            {/* Edit-mode action row */}
            {editMode && (
              <div className="action-row">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSendEdited}
                  disabled={sending}
                >
                  {sending ? 'Sending…' : 'Send Edited'}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditMode(false)}
                >
                  Cancel
                </button>
              </div>
            )}
          </>
        )}
      </div>

    </>
  );
}
