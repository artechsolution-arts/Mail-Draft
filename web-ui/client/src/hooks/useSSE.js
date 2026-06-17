import { useEffect, useRef } from 'react';

/**
 * Custom hook that connects to the SSE stream at /api/crm/stream
 * and dispatches typed events to provided callbacks.
 *
 * @param {Object} callbacks
 * @param {Function} callbacks.onNewEmail   - called with data when type === 'new_email'
 * @param {Function} callbacks.onDraftReady - called with data when type === 'draft_ready'
 * @param {Function} callbacks.onSyncDone   - called with data when type === 'sync_done'
 */
export function useSSE({ onNewEmail, onDraftReady, onSyncDone }) {
  const esRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  // Keep latest callbacks in a ref so event handlers never go stale
  const callbacksRef = useRef({ onNewEmail, onDraftReady, onSyncDone });
  useEffect(() => {
    callbacksRef.current = { onNewEmail, onDraftReady, onSyncDone };
  });

  useEffect(() => {
    let destroyed = false;

    function connect() {
      if (destroyed) return;

      const es = new EventSource('/api/crm/stream');
      esRef.current = es;

      es.onmessage = (event) => {
        let payload;
        try {
          payload = JSON.parse(event.data);
        } catch {
          // Ignore malformed frames
          return;
        }

        const { type, ...data } = payload;
        const { onNewEmail, onDraftReady, onSyncDone } = callbacksRef.current;

        switch (type) {
          case 'new_email':
            if (typeof onNewEmail === 'function') onNewEmail(data);
            break;
          case 'draft_ready':
            if (typeof onDraftReady === 'function') onDraftReady(data);
            break;
          case 'sync_done':
            if (typeof onSyncDone === 'function') onSyncDone(data);
            break;
          default:
            // Unknown type — ignore
            break;
        }
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;

        if (!destroyed) {
          reconnectTimerRef.current = setTimeout(connect, 3000);
        }
      };
    }

    connect();

    return () => {
      destroyed = true;

      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, []); // runs once on mount; callbacks are accessed via ref
}
