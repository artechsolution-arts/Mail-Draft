import { useState, useEffect, useCallback, useRef } from 'react';

const POLL_INTERVAL_MS = 5000;

/**
 * Custom hook that fetches draft emails from /api/crm/drafts and filters
 * them by customerEmail. When any draft has generationStatus === 'generating'
 * the hook polls every 5 s automatically.
 *
 * @param {string} customerEmail - The customer email address to filter by.
 * @returns {{ drafts: Array, loading: boolean, reload: Function }}
 */
export function useDrafts(customerEmail) {
  const [allDrafts, setAllDrafts] = useState([]);
  const [loading, setLoading] = useState(false);
  const pollTimerRef = useRef(null);
  const mountedRef = useRef(true);

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
      // Keep existing drafts on error; caller can inspect loading state
      console.error('[useDrafts] fetch error:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  // Derive the filtered list
  const drafts = customerEmail
    ? allDrafts.filter((d) => d.customerEmail === customerEmail)
    : allDrafts;

  // Determine whether any draft in the filtered set is still generating
  const hasGenerating = drafts.some((d) => d.generationStatus === 'generating');

  // Schedule/cancel polling based on generationStatus
  useEffect(() => {
    function scheduleNext() {
      pollTimerRef.current = setTimeout(async () => {
        await fetchDrafts();
        // After the fetch, the effect will re-run if hasGenerating changed,
        // so we don't need to call scheduleNext() here — the effect handles it.
      }, POLL_INTERVAL_MS);
    }

    if (hasGenerating) {
      scheduleNext();
    }

    return () => {
      if (pollTimerRef.current !== null) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [hasGenerating, fetchDrafts]);

  // Initial fetch on mount
  useEffect(() => {
    mountedRef.current = true;
    fetchDrafts();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchDrafts]);

  return { drafts, loading, reload: fetchDrafts };
}
