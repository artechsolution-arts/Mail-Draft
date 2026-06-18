import { useState, useEffect, useCallback, useRef } from 'react';

const POLL_INTERVAL_MS = 3000;

/**
 * Custom hook that fetches draft emails from /api/crm/drafts and filters
 * them by customerEmail. Polls while any draft is generating and listens
 * for SSE draft_ready / draft_generating events for instant updates.
 *
 * @param {string} customerEmail
 * @returns {{ drafts: Array, loading: boolean, reload: Function }}
 */
export function useDrafts(customerEmail) {
  const [allDrafts, setAllDrafts]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const pollTimerRef                = useRef(null);
  const mountedRef                  = useRef(true);

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/crm/drafts');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (mountedRef.current) {
        setAllDrafts(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('[useDrafts] fetch error:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  // Derive filtered list — case-insensitive match
  const drafts = customerEmail
    ? allDrafts.filter(
        (d) => (d.customerEmail || '').toLowerCase() === customerEmail.toLowerCase()
      )
    : allDrafts;

  // Any draft still generating? → poll
  const hasGenerating = allDrafts.some((d) => d.generationStatus === 'generating');

  // Poll while generating
  useEffect(() => {
    if (!hasGenerating) return;
    function scheduleNext() {
      pollTimerRef.current = setTimeout(async () => {
        await fetchDrafts();
      }, POLL_INTERVAL_MS);
    }
    scheduleNext();
    return () => {
      if (pollTimerRef.current !== null) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [hasGenerating, fetchDrafts]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    fetchDrafts();
    return () => { mountedRef.current = false; };
  }, [fetchDrafts]);

  // SSE: auto-refresh when server pushes draft_ready / draft_generating
  useEffect(() => {
    let es;
    try {
      es = new EventSource('/api/crm/stream');
      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (
            msg.type === 'draft_ready' ||
            msg.type === 'draft_generating' ||
            msg.type === 'draft_failed' ||
            msg.type === 'sync'
          ) {
            fetchDrafts();
          }
        } catch {}
      };
    } catch {}
    return () => { es?.close(); };
  }, [fetchDrafts]);

  return { drafts, loading, reload: fetchDrafts };
}
