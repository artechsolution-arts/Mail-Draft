import React, { useState, useEffect, useRef } from 'react';
import Modal from '../ui/Modal';
import { useApp } from '../../context/AppContext.jsx';

const IMPORT_PREVIEW_URL = '/api/crm/customers/import/preview';
const IMPORT_SUBMIT_URL  = '/api/crm/customers/import';

// Columns we try to detect in uploaded files
const EXPECTED_COLS = ['email', 'name', 'company', 'phone'];

/**
 * ImportModal — import customers from an .xlsx or .csv file.
 *
 * Props:
 *   open        {boolean}
 *   onClose     {function}
 *   onImported  {function} – called after a successful import
 */
export default function ImportModal({ open, onClose, onImported }) {
  const { addToast } = useApp();

  const [dragging, setDragging]         = useState(false);
  const [file, setFile]                 = useState(null);
  const [preview, setPreview]           = useState(null);   // { rowCount, columns: string[] }
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [importing, setImporting]       = useState(false);
  const [importResult, setImportResult] = useState(null);   // { created, skipped }
  const fileInputRef = useRef(null);

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setDragging(false);
      setFile(null);
      setPreview(null);
      setPreviewLoading(false);
      setPreviewError('');
      setImporting(false);
      setImportResult(null);
    }
  }, [open]);

  async function runPreview(selectedFile) {
    setFile(selectedFile);
    setPreview(null);
    setPreviewError('');
    setImportResult(null);
    setPreviewLoading(true);

    try {
      const fd = new FormData();
      fd.append('file', selectedFile);

      const res = await fetch(IMPORT_PREVIEW_URL, { method: 'POST', body: fd });
      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        throw new Error(`Preview failed (${res.status}): ${txt}`);
      }
      const data = await res.json();
      setPreview(data); // expected: { rowCount: number, columns: string[] }
    } catch (err) {
      setPreviewError(err.message ?? 'Could not preview the file.');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function runImport() {
    if (!file) return;
    setImporting(true);
    setPreviewError('');

    try {
      const fd = new FormData();
      fd.append('file', file);

      const res = await fetch(IMPORT_SUBMIT_URL, { method: 'POST', body: fd });
      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        throw new Error(`Import failed (${res.status}): ${txt}`);
      }
      const data = await res.json(); // expected: { created: number, skipped: number }
      setImportResult(data);
      addToast(
        'success',
        `Created ${data.created ?? 0}, Skipped ${data.skipped ?? 0}`
      );
      onImported?.();
      onClose();
    } catch (err) {
      setPreviewError(err.message ?? 'Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  }

  // Drag handlers
  function handleDragOver(e) { e.preventDefault(); setDragging(true); }
  function handleDragLeave() { setDragging(false); }
  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) runPreview(dropped);
  }

  function handleFileChosen(e) {
    const chosen = e.target.files?.[0];
    if (chosen) runPreview(chosen);
    e.target.value = '';
  }

  // Determine which expected columns were found
  const detectedCols   = preview?.columns ?? [];
  const foundCols      = EXPECTED_COLS.filter((c) => detectedCols.some((d) => d.toLowerCase() === c));
  const missingCols    = EXPECTED_COLS.filter((c) => !foundCols.includes(c));
  const extraCols      = detectedCols.filter((c) => !EXPECTED_COLS.includes(c.toLowerCase()));

  const rowCount = preview?.rowCount ?? 0;
  const canImport = preview && !previewLoading && !importing && rowCount > 0;

  return (
    <Modal open={open} onClose={onClose} title="Import Customers from Excel" maxWidth="md">
      {/* Drop zone — hide once preview is loaded and no error */}
      {(!preview || previewError) && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? 'var(--blue-500, #3b82f6)' : 'var(--border)'}`,
            borderRadius: 10,
            padding: '32px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragging ? 'oklch(97% .010 230)' : 'var(--surface, #fafaf9)',
            transition: 'border-color 0.15s, background 0.15s',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={handleFileChosen}
          />
          <svg
            width="32" height="32" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            style={{ opacity: 0.5, marginBottom: 8 }}
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            Drop your Excel or CSV file here
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
            Supports .xlsx, .xls, .csv — up to 10 MB
          </p>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
          >
            Browse file
          </button>
        </div>
      )}

      {/* Preview loading */}
      {previewLoading && (
        <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: 'var(--text-2)' }}>
          Analysing file…
        </div>
      )}

      {/* Preview result */}
      {preview && !previewError && (
        <div style={{ marginTop: 4 }}>
          {/* File info row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{file?.name}</span>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
              ({file ? (file.size / 1024).toFixed(1) : 0} KB)
            </span>
            <button
              type="button"
              className="btn-link"
              style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-2)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => { setFile(null); setPreview(null); fileInputRef.current?.click(); }}
            >
              Change file
            </button>
          </div>

          {/* Row count */}
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
            {rowCount} row{rowCount !== 1 ? 's' : ''} detected
          </p>

          {/* Column mapping chips */}
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>Detected columns:</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
            {foundCols.map((col) => (
              <span key={col} style={{ ...chipStyle, background: '#dcfce7', borderColor: '#86efac', color: '#15803d' }}>
                ✓ {col}
              </span>
            ))}
            {missingCols.map((col) => (
              <span key={col} style={{ ...chipStyle, background: 'var(--stone-100, #f5f5f4)', borderColor: 'var(--border)', color: 'var(--text-3)' }}>
                — {col}
              </span>
            ))}
            {extraCols.map((col) => (
              <span key={col} style={{ ...chipStyle, background: 'var(--stone-100, #f5f5f4)', borderColor: 'var(--border)', color: 'var(--text-2)' }}>
                {col}
              </span>
            ))}
          </div>

          {!foundCols.includes('email') && (
            <p style={{ fontSize: 12, color: 'var(--red-700)', marginTop: 6 }}>
              No "email" column found — email is required for import.
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {previewError && (
        <div style={errorBannerStyle}>{previewError}</div>
      )}

      {/* Actions */}
      <div className="modal-actions" style={{ display: 'flex', gap: 'var(--sp-2)', justifyContent: 'flex-end', marginTop: 16 }}>
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={importing}>
          Cancel
        </button>
        {canImport && foundCols.includes('email') && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={runImport}
            disabled={importing}
          >
            {importing ? 'Importing…' : `Import ${rowCount} customer${rowCount !== 1 ? 's' : ''}`}
          </button>
        )}
      </div>
    </Modal>
  );
}

const chipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  border: '1px solid',
};

const errorBannerStyle = {
  padding: '10px 14px',
  borderRadius: 8,
  background: 'oklch(96% .030 25)',
  border: '1px solid oklch(88% .060 25)',
  color: 'oklch(42% .100 25)',
  fontSize: 13,
  marginTop: 12,
};
