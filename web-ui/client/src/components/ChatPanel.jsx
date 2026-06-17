import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import { useApp } from '../context/AppContext.jsx';
import { sendChat } from '../api.js';

// ---------------------------------------------------------------------------
// Global query detection — mirrors the logic in crm.html
// ---------------------------------------------------------------------------
const GLOBAL_PATTERN =
  /\b(all customers?|list all|show all|pending follow.?ups?|overdue|everyone|across all|summary of all|which customers?|how many customers?|what action|next action|top priority|priorit)\b/i;

// ---------------------------------------------------------------------------
// Markdown → safe HTML: **bold** → <strong>, newlines → <br>
// ---------------------------------------------------------------------------
function renderMarkdown(text) {
  // Escape HTML entities first, then apply lightweight markdown
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

// ---------------------------------------------------------------------------
// Animated loading dots
// ---------------------------------------------------------------------------
function ThinkingDots() {
  return (
    <span aria-label="AI is thinking" style={{ display: 'inline-flex', gap: 3 }}>
      <style>{`
        @keyframes _dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%            { transform: translateY(-4px); opacity: 1; }
        }
        ._td { width: 5px; height: 5px; border-radius: 50%;
               background: currentColor; display: inline-block;
               animation: _dot-bounce 1.2s ease-in-out infinite; }
        ._td:nth-child(2) { animation-delay: 0.2s; }
        ._td:nth-child(3) { animation-delay: 0.4s; }
      `}</style>
      <span className="_td" />
      <span className="_td" />
      <span className="_td" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Single chat message bubble
// ---------------------------------------------------------------------------
function ChatMessage({ role, content, isLoading }) {
  const isUser = role === 'user';

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 8,
      }}
    >
      <div
        style={{
          maxWidth: '82%',
          padding: '8px 12px',
          borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          fontSize: 13,
          lineHeight: 1.55,
          background: isUser ? '#1A6AB4' : '#ffffff',
          color: isUser ? '#fff' : 'var(--text)',
          border: isUser ? 'none' : '1px solid var(--border)',
          boxShadow: isUser ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
          wordBreak: 'break-word',
        }}
      >
        {isLoading ? (
          <ThinkingDots />
        ) : isUser ? (
          content
        ) : (
          /* AI messages: render lightweight markdown */
          <span
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chevron icon for collapse toggle
// ---------------------------------------------------------------------------
function ChevronIcon({ up }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: up ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 180ms' }}
      aria-hidden="true"
    >
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function ChatPanel() {
  const { activeCustomer } = useApp();

  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState([]); // { id, role, content, isLoading }
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input when panel expands
  useEffect(() => {
    if (expanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [expanded]);

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const query = input.trim();
    if (!query || isSending) return;

    setInput('');
    setIsSending(true);

    const userMsgId = `u-${Date.now()}`;
    const botMsgId  = `b-${Date.now()}`;

    // Determine whether this is a global or customer-specific query
    const isGlobal = GLOBAL_PATTERN.test(query);
    const customerEmail = isGlobal ? null : (activeCustomer?.email ?? null);

    // Add user message + loading placeholder
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user',   content: query,  isLoading: false },
      { id: botMsgId,  role: 'ai',     content: '',     isLoading: true  },
    ]);

    try {
      const data = await sendChat({ query, customerEmail });
      const reply = data.reply || data.content || data.message || '(no response)';

      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId ? { ...m, content: reply, isLoading: false } : m
        )
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? { ...m, content: `Error: ${err.message}`, isLoading: false }
            : m
        )
      );
    } finally {
      setIsSending(false);
      // Re-focus the input
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [input, isSending, activeCustomer]);

  // Enter key handler
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-panel, var(--bg))',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        flexShrink: 0,
        height: expanded ? 280 : 'auto',
        transition: 'height 0.2s ease',
      }}
    >
      {/* ── Header / toggle bar ────────────────────────────────────────── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '10px 14px',
          background: '#1A6AB4',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          flexShrink: 0,
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {/* Robot icon */}
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <circle cx="12" cy="5" r="2" />
            <line x1="12" y1="7" x2="12" y2="11" />
            <line x1="8" y1="16" x2="8" y2="16" strokeWidth="2.5" />
            <line x1="16" y1="16" x2="16" y2="16" strokeWidth="2.5" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.01em' }}>
            AI Assistant
          </span>
          {activeCustomer && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                opacity: 0.85,
                background: 'rgba(255,255,255,0.18)',
                borderRadius: 99,
                padding: '1px 7px',
                maxWidth: 140,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={activeCustomer.name || activeCustomer.email}
            >
              {activeCustomer.name || activeCustomer.email}
            </span>
          )}
        </div>
        <ChevronIcon up={expanded} />
      </button>

      {/* ── Collapsible body ───────────────────────────────────────────── */}
      {expanded && (
        <>
          {/* Message list */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 12px 4px',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* System / hint message when no customer is selected */}
            {!activeCustomer && messages.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  fontSize: 12,
                  color: 'var(--text-3)',
                  padding: '12px 8px',
                  lineHeight: 1.55,
                  background: 'oklch(0.970 0.035 75)',
                  border: '1px dashed oklch(0.860 0.080 70)',
                  borderRadius: 8,
                  marginBottom: 8,
                }}
              >
                Ask me about any customer or &ldquo;show all pending follow-ups&rdquo;
              </div>
            )}

            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                role={msg.role}
                content={msg.content}
                isLoading={msg.isLoading}
              />
            ))}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>

          {/* Input row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 10px',
              borderTop: '1px solid var(--border)',
              flexShrink: 0,
              background: '#fff',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSending}
              placeholder={
                activeCustomer
                  ? `Ask about ${activeCustomer.name || activeCustomer.email}…`
                  : 'Ask about any customer…'
              }
              aria-label="Chat message"
              style={{
                flex: 1,
                fontSize: 13,
                padding: '6px 10px',
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: isSending ? 'var(--bg-sidebar)' : '#fff',
                color: 'var(--text)',
                outline: 'none',
                minWidth: 0,
              }}
            />
            <button
              onClick={handleSend}
              disabled={isSending || !input.trim()}
              style={{
                flexShrink: 0,
                fontSize: 12,
                fontWeight: 700,
                padding: '6px 14px',
                borderRadius: 8,
                border: 'none',
                background: '#1A6AB4',
                color: '#fff',
                cursor: isSending || !input.trim() ? 'not-allowed' : 'pointer',
                opacity: isSending || !input.trim() ? 0.55 : 1,
                lineHeight: 1.6,
              }}
            >
              Send
            </button>
          </div>
        </>
      )}
    </div>
  );
}
