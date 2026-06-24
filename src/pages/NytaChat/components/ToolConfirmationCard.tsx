import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { FiCheck, FiX, FiLoader } from 'react-icons/fi';

import type { PendingToolCall } from '../../../store/slices/nytaChat';

import './ToolConfirmationCard.scss';

// ─── Tool Name Translation Map ────────────────────────────────────────────────

const TOOL_NAME_PT: Record<string, string> = {
  create_catalog_item: 'Criar item no catálogo',
  update_catalog_item: 'Atualizar item no catálogo',
  delete_catalog_item: 'Remover item do catálogo',
  create_event: 'Criar evento',
  update_event: 'Atualizar evento',
  delete_event: 'Remover evento',
  create_team_member: 'Adicionar membro à equipe',
  update_team_member: 'Atualizar membro da equipe',
  remove_team_member: 'Remover membro da equipe',
  update_strategy_task: 'Atualizar tarefa estratégica',
  update_plan_task: 'Atualizar tarefa do plano de ação',
  create_strategy: 'Criar estratégia',
  create_task: 'Criar tarefa',
};

// ─── Argument Label Translation ───────────────────────────────────────────────

const ARG_LABELS_PT: Record<string, string> = {
  title: 'Título',
  name: 'Nome',
  status: 'Status',
  genre: 'Gênero',
  date: 'Data',
  description: 'Descrição',
  role: 'Papel',
  email: 'Email',
  type: 'Tipo',
  location: 'Local',
  venue: 'Local',
  time: 'Horário',
  artist_id: 'Artista',
  id: 'ID',
  task_id: 'Tarefa',
  task_query: 'Tarefa',
  strategy_query: 'Estratégia',
  notes: 'Notas',
  priority: 'Prioridade',
  due_date: 'Data de entrega',
  objective: 'Objetivo',
  tasks: 'Tarefas',
  start_time: 'Horário',
  end_time: 'Término',
  release_date: 'Lançamento',
  item_id: 'Item',
  event_id: 'Evento',
  member_id: 'Membro',
  lyrics: 'Letra',
  duration: 'Duração',
  key: 'Tom',
  bpm: 'BPM',
  isrc: 'ISRC',
  upc: 'UPC',
  access_levels: 'Acesso',
};

// Valores de enum que chegam em "código" → rótulo amigável (status de catálogo/evento, tipo, prioridade).
const ENUM_VALUES_PT: Record<string, string> = {
  // prioridade
  alta: 'Alta', media: 'Média', baixa: 'Baixa',
  // status de catálogo
  composition: 'Composição', production: 'Produção', mixing: 'Mixagem',
  mastering: 'Masterização', ready: 'Pronta', released: 'Lançada',
  // status de evento
  scheduled: 'Agendado', confirmed: 'Confirmado', cancelled: 'Cancelado', completed: 'Concluído',
  // tipo de evento
  show: 'Show', reuniao: 'Reunião', estudio: 'Estúdio', ensaio: 'Ensaio', entrevista: 'Entrevista', outro: 'Outro',
};

// Só traduz enum quando a CHAVE é de enum — evita trocar um título tipo "Show" ou "Released".
const ENUM_KEYS = new Set(['status', 'type', 'priority']);

// ─── Constants ────────────────────────────────────────────────────────────────

const SUMMARY_MAX_CHARS = 200;
const TIMEOUT_MS = 30_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Translate tool name to Portuguese action description.
 */
export function translateToolName(name: string): string {
  return TOOL_NAME_PT[name] || name;
}

/**
 * Translate an argument key to a Portuguese label.
 */
function translateArgLabel(key: string): string {
  return ARG_LABELS_PT[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format an argument value for display. Handles primitives and objects.
 */
function formatArgValue(value: unknown, key?: string): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return (key && ENUM_KEYS.has(key) && ENUM_VALUES_PT[value]) || value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  // Arrays viram texto legível (sem colchetes/aspas do JSON).
  if (Array.isArray(value)) return value.map((v) => formatArgValue(v)).join(', ');
  return JSON.stringify(value);
}

/**
 * Build a summarized description of the action, truncated to SUMMARY_MAX_CHARS.
 */
export function buildActionSummary(name: string, args: Record<string, unknown>): string {
  const actionName = translateToolName(name);
  const argParts = Object.entries(args)
    .filter(([key]) => key !== 'artist_id')
    .filter(([, val]) => !Array.isArray(val)) // listas (ex.: tarefas) vão no detalhe, não no resumo
    .map(([key, val]) => `${translateArgLabel(key)}: ${formatArgValue(val, key)}`)
    .join(', ');

  const full = argParts ? `${actionName} — ${argParts}` : actionName;

  if (full.length <= SUMMARY_MAX_CHARS) return full;
  return full.slice(0, SUMMARY_MAX_CHARS - 1) + '…';
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ToolConfirmationCardProps {
  toolCall: PendingToolCall;
  onConfirm: (toolCallId: string) => void;
  onCancel: (toolCallId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ToolConfirmationCard: FC<ToolConfirmationCardProps> = ({
  toolCall,
  onConfirm,
  onCancel,
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

    onConfirm(toolCallId);
  }, [onConfirm, toolCallId]);

  const handleCancel = useCallback(() => {
    setError(null);
    onCancel(toolCallId);
  }, [onCancel, toolCallId]);

  // ─── Derived ──────────────────────────────────────────────────────────────

  const actionName = translateToolName(name);
  const summary = buildActionSummary(name, args);

  // Filter out artist_id from displayed arguments
  const displayArgs = Object.entries(args).filter(([key]) => key !== 'artist_id');

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
            <span>✓ Ação executada</span>
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

  const showButtons = status === 'pending' || status === 'error';

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
