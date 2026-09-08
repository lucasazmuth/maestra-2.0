import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { FiCheck, FiX, FiLoader } from 'react-icons/fi';

import type { PendingToolCall } from '@maestra/core/store/slices/nytaChat';
import {
  buildActionSummary, formatArgValue, HIDDEN_ARG_KEYS, translateArgLabel, translateToolName,
} from '@maestra/core/nucleo/acoesDaNyta';

import './ToolConfirmationCard.scss';

// As tabelas de tradução e o resumo moram no núcleo: o app nativo mostra o MESMO cartão, e o
// texto dele É o consentimento da pessoa. Reexportados porque os testes deste diretório os
// importam daqui.
export {
  translateToolName, buildActionSummary, translateArgLabel, formatArgValue, HIDDEN_ARG_KEYS,
} from '@maestra/core/nucleo/acoesDaNyta';

const TIMEOUT_MS = 30_000;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ToolConfirmationCardProps {
  toolCall: PendingToolCall;
  onConfirm?: (toolCallId: string) => void;
  onCancel?: (toolCallId: string) => void;
  /**
   * O mesmo cartão, no histórico da conversa: mostra O QUE a Nyta fez e como terminou, sem
   * oferecer decisão. Uma ação que já rodou não se confirma de novo, e uma que falhou há três
   * dias não se repete por um botão que sobrou na tela.
   */
  somenteLeitura?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ToolConfirmationCard: FC<ToolConfirmationCardProps> = ({
  toolCall,
  onConfirm,
  onCancel,
  somenteLeitura = false,
}) => {
  const { toolCallId, name, arguments: args, status } = toolCall;
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // When status transitions from 'executing' to 'done' or 'confirmed', clear timeout
  useEffect(() => {
    if (status === 'done' || status === 'confirmed' || status === 'cancelled') {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setError(null);
    }
  }, [status]);

  // When status becomes 'error', clear timeout and show error
  useEffect(() => {
    if (status === 'error') {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setError('Não foi possível completar a ação. Tente novamente.');
    }
  }, [status]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleConfirm = useCallback(() => {
    setError(null);

    // Set a 30s timeout
    timeoutRef.current = setTimeout(() => {
      setError('Tempo limite excedido. Tente novamente.');
    }, TIMEOUT_MS);

    onConfirm?.(toolCallId);
  }, [onConfirm, toolCallId]);

  const handleCancel = useCallback(() => {
    setError(null);
    onCancel?.(toolCallId);
  }, [onCancel, toolCallId]);

  // ─── Derived ──────────────────────────────────────────────────────────────

  const actionName = translateToolName(name);
  const summary = buildActionSummary(name, args);

  // Filter out artist_id from displayed arguments
  const displayArgs = Object.entries(args).filter(([key]) => !HIDDEN_ARG_KEYS.has(key));

  // ─── Render status indicator ──────────────────────────────────────────────

  const renderStatus = () => {
    switch (status) {
      case 'executing':
        return (
          <div className="tool-confirmation-card__status tool-confirmation-card__status--executing">
            <FiLoader className="tool-confirmation-card__spinner" size={14} />
            <span>Executando…</span>
          </div>
        );

      case 'confirmed':
      case 'done':
        return (
          <div className="tool-confirmation-card__status tool-confirmation-card__status--success">
            <FiCheck size={14} />
            {/* Sem o "✓" no texto: o ícone ao lado já é um, e a linha saía com dois vistos. */}
            <span>Ação executada</span>
          </div>
        );

      case 'cancelled':
        return (
          <div className="tool-confirmation-card__status tool-confirmation-card__status--cancelled">
            <span>Ação cancelada</span>
          </div>
        );

      case 'error':
        return null; // Error state shows buttons again (below)

      case 'pending':
      default:
        return null;
    }
  };

  // ─── Render buttons (pending or error with retry) ─────────────────────────

  const showButtons = !somenteLeitura && (status === 'pending' || status === 'error');

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="tool-confirmation-card" data-testid="tool-confirmation-card">
      {/* Header: Action name */}
      <div className="tool-confirmation-card__header">
        <span className="tool-confirmation-card__action-label">Ação:</span>
        <span className="tool-confirmation-card__action-name">{actionName}</span>
      </div>

      {/* Summary */}
      <p className="tool-confirmation-card__summary" data-testid="tool-confirmation-summary">
        {summary}
      </p>

      {/* Arguments as labeled fields */}
      {displayArgs.length > 0 && (
        <div className="tool-confirmation-card__args">
          {displayArgs.map(([key, val]) => (
            <div key={key} className="tool-confirmation-card__arg">
              <span className="tool-confirmation-card__arg-label">
                {translateArgLabel(key)}:
              </span>
              {Array.isArray(val) ? (
                <ul className="tool-confirmation-card__arg-list">
                  {(val as unknown[]).map((item, i) => (
                    <li key={i}>{formatArgValue(item)}</li>
                  ))}
                </ul>
              ) : (
                <span className="tool-confirmation-card__arg-value">
                  {formatArgValue(val, key)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="tool-confirmation-card__error">
          {error}
        </div>
      )}

      {/* Status indicator (executing, done, cancelled) */}
      {renderStatus()}

      {/* Buttons: Confirmar / Cancelar */}
      {showButtons && (
        <div className="tool-confirmation-card__actions">
          <button
            className="tool-confirmation-card__btn tool-confirmation-card__btn--confirm"
            onClick={handleConfirm}
            type="button"
            aria-label="Confirmar ação"
          >
            <FiCheck size={14} />
            Confirmar
          </button>
          <button
            className="tool-confirmation-card__btn tool-confirmation-card__btn--cancel"
            onClick={handleCancel}
            type="button"
            aria-label="Cancelar ação"
          >
            <FiX size={14} />
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
};

export default ToolConfirmationCard;
