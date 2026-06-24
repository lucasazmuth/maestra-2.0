import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { FiArrowUp } from 'react-icons/fi';

import type { PendingToolCall, RateLimitInfo } from '../../../store/slices/nytaChat';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_CHARS = 1000;
const MIN_ROWS = 1;
const MAX_ROWS = 4;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formats a countdown string like "Xh Ym" until the resetAt timestamp.
 */
function formatCountdown(resetAt: string): string {
  const diff = new Date(resetAt).getTime() - Date.now();
  if (diff <= 0) return '0m';
  // Arredonda pra cima no TOTAL de minutos e só então separa h/min — senão o arredondamento
  // dos minutos podia dar "60m" (ex.: "7h 60m" em vez de "8h 0m").
  const totalMinutes = Math.ceil(diff / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface InputBarProps {
  onSend: (message: string) => void;
  disabled: boolean;
  rateLimitInfo: RateLimitInfo | null;
  pendingToolCalls: PendingToolCall[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export const InputBar: FC<InputBarProps> = ({
  onSend,
  disabled,
  rateLimitInfo,
  pendingToolCalls,
}) => {
  const [value, setValue] = useState('');
  const [countdown, setCountdown] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Derived state ───────────────────────────────────────────────────────────

  const hasPendingToolCalls = pendingToolCalls.some((tc) => tc.status === 'pending');
  const isRateLimited =
    rateLimitInfo !== null && rateLimitInfo.count >= rateLimitInfo.limit;
  const isInputDisabled = disabled || hasPendingToolCalls || isRateLimited;
  const canSend = value.trim().length > 0 && !isInputDisabled;

  // ── Auto-resize textarea ────────────────────────────────────────────────────

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    // Reset height to measure scrollHeight accurately
    el.style.height = 'auto';
    // lineHeight of ~20px * MAX_ROWS = 80px max content
    const lineHeight = parseInt(getComputedStyle(el).lineHeight, 10) || 20;
    const maxHeight = lineHeight * MAX_ROWS;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [value, resizeTextarea]);

  // ── Rate limit countdown ────────────────────────────────────────────────────

  useEffect(() => {
    if (!isRateLimited || !rateLimitInfo?.resetAt) {
      setCountdown('');
      return;
    }

    setCountdown(formatCountdown(rateLimitInfo.resetAt));

    const interval = setInterval(() => {
      setCountdown(formatCountdown(rateLimitInfo.resetAt!));
    }, 60_000);

    return () => clearInterval(interval);
  }, [isRateLimited, rateLimitInfo]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isInputDisabled) return;
    onSend(trimmed);
    setValue('');
    // Reset textarea height after clearing
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    });
  }, [value, isInputDisabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      if (text.length <= MAX_CHARS) {
        setValue(text);
      } else {
        setValue(text.slice(0, MAX_CHARS));
      }
    },
    []
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="nyta-input-bar">
      {isRateLimited && rateLimitInfo && (
        <div className="nyta-input-bar__rate-limit">
          <span className="nyta-input-bar__rate-limit-text">
            {rateLimitInfo.count}/{rateLimitInfo.limit} mensagens usadas hoje
          </span>
          {countdown && (
            <span className="nyta-input-bar__rate-limit-countdown">
              Redefine em {countdown}
            </span>
          )}
        </div>
      )}

      <div className="nyta-input-bar__row">
        <textarea
          ref={textareaRef}
          className="nyta-input-bar__textarea"
          placeholder="Pergunte algo à Nyta…"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={isInputDisabled}
          rows={MIN_ROWS}
          maxLength={MAX_CHARS}
          aria-label="Mensagem para a Nyta"
        />
        <button
          className="nyta-send"
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Enviar"
          type="button"
        >
          <FiArrowUp size={18} />
        </button>
      </div>

      {!isRateLimited && (
        <div className="nyta-input-bar__footer">
          <span className="nyta-input-bar__disclaimer">
            A Nyta pode cometer erros. Confira informações importantes.
          </span>
          <span className="nyta-input-bar__char-count">
            {value.length}/{MAX_CHARS}
          </span>
        </div>
      )}
    </div>
  );
};

export default InputBar;
