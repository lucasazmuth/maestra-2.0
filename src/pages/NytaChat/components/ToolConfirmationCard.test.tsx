import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToolConfirmationCard, translateToolName, buildActionSummary } from './ToolConfirmationCard';
import type { PendingToolCall } from '../../../store/slices/nytaChat';

// ─── Req 3.3: Card de confirmação com descrição da ação ─────────────────────

describe('ToolConfirmationCard', () => {
  const mockConfirm = jest.fn();
  const mockCancel = jest.fn();

  const basePendingToolCall: PendingToolCall = {
    toolCallId: 'tc-123',
    name: 'create_event',
    arguments: { title: 'Show no SESC', type: 'show', date: '2025-02-15' },
    status: 'pending',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders action name and summary for cross-module tool calls', () => {
    render(
      <ToolConfirmationCard
        toolCall={basePendingToolCall}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />
    );

    expect(screen.getByText('Criar evento')).toBeInTheDocument();
    expect(screen.getByTestId('tool-confirmation-summary')).toHaveTextContent('Show no SESC');
  });

  it('displays confirm and cancel buttons when status is pending', () => {
    render(
      <ToolConfirmationCard
        toolCall={basePendingToolCall}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />
    );

    expect(screen.getByRole('button', { name: /confirmar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
  });

  // ── Req 3.4: Confirmar executa tool call ────────────────────────────────

  it('calls onConfirm with toolCallId when Confirmar is clicked', () => {
    render(
      <ToolConfirmationCard
        toolCall={basePendingToolCall}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    expect(mockConfirm).toHaveBeenCalledWith('tc-123');
  });

  it('shows executing state after confirmation', () => {
    const executingToolCall: PendingToolCall = {
      ...basePendingToolCall,
      status: 'executing',
    };

    render(
      <ToolConfirmationCard
        toolCall={executingToolCall}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />
    );

    expect(screen.getByText('Executando…')).toBeInTheDocument();
    // Buttons should not be present during execution
    expect(screen.queryByRole('button', { name: /confirmar/i })).not.toBeInTheDocument();
  });

  it('shows success state when tool call completes', () => {
    const doneToolCall: PendingToolCall = {
      ...basePendingToolCall,
      status: 'done',
    };

    render(
      <ToolConfirmationCard
        toolCall={doneToolCall}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />
    );

    expect(screen.getByText(/ação executada/i)).toBeInTheDocument();
  });

  // ── Req 3.5: Cancelar descarta tool call ────────────────────────────────

  it('calls onCancel with toolCallId when Cancelar is clicked', () => {
    render(
      <ToolConfirmationCard
        toolCall={basePendingToolCall}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(mockCancel).toHaveBeenCalledWith('tc-123');
  });

  it('shows cancelled state after cancellation', () => {
    const cancelledToolCall: PendingToolCall = {
      ...basePendingToolCall,
      status: 'cancelled',
    };

    render(
      <ToolConfirmationCard
        toolCall={cancelledToolCall}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />
    );

    expect(screen.getByText('Ação cancelada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirmar/i })).not.toBeInTheDocument();
  });

  // ── Cross-module coverage: all tool types show cards ────────────────────

  it('renders card for catalog tool calls', () => {
    const catalogToolCall: PendingToolCall = {
      toolCallId: 'tc-cat-1',
      name: 'create_catalog_item',
      arguments: { title: 'Nova Faixa' },
      status: 'pending',
    };

    render(
      <ToolConfirmationCard
        toolCall={catalogToolCall}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />
    );

    expect(screen.getByText('Criar item no catálogo')).toBeInTheDocument();
  });

  it('renders card for team tool calls', () => {
    const teamToolCall: PendingToolCall = {
      toolCallId: 'tc-team-1',
      name: 'create_team_member',
      arguments: { email: 'membro@email.com', name: 'João' },
      status: 'pending',
    };

    render(
      <ToolConfirmationCard
        toolCall={teamToolCall}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />
    );

    expect(screen.getByText('Adicionar membro à equipe')).toBeInTheDocument();
  });

  it('renders card for plan task tool calls', () => {
    const taskToolCall: PendingToolCall = {
      toolCallId: 'tc-task-1',
      name: 'update_plan_task',
      arguments: { task_query: 'Gravar single', status: 'done' },
      status: 'pending',
    };

    render(
      <ToolConfirmationCard
        toolCall={taskToolCall}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />
    );

    expect(screen.getByText('Atualizar tarefa do plano de ação')).toBeInTheDocument();
  });

  it('shows error state with retry buttons', () => {
    const errorToolCall: PendingToolCall = {
      ...basePendingToolCall,
      status: 'error',
    };

    render(
      <ToolConfirmationCard
        toolCall={errorToolCall}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />
    );

    // In error state, buttons reappear for retry
    expect(screen.getByRole('button', { name: /confirmar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
  });
});

// ─── Unit tests for helper functions ──────────────────────────────────────────

describe('translateToolName', () => {
  it('translates known tool names', () => {
    expect(translateToolName('create_event')).toBe('Criar evento');
    expect(translateToolName('update_catalog_item')).toBe('Atualizar item no catálogo');
    expect(translateToolName('update_plan_task')).toBe('Atualizar tarefa do plano de ação');
  });

  it('returns the raw name for unknown tools', () => {
    expect(translateToolName('unknown_tool')).toBe('unknown_tool');
  });
});

describe('buildActionSummary', () => {
  it('builds a summary with action name and arguments', () => {
    const summary = buildActionSummary('create_event', {
      title: 'Show',
      date: '2025-03-01',
    });
    expect(summary).toContain('Criar evento');
    expect(summary).toContain('Show');
    expect(summary).toContain('2025-03-01');
  });

  it('filters out artist_id from summary', () => {
    const summary = buildActionSummary('create_event', {
      artist_id: 'some-uuid',
      title: 'Show',
    });
    expect(summary).not.toContain('some-uuid');
    expect(summary).toContain('Show');
  });

  it('truncates long summaries', () => {
    const longArgs: Record<string, unknown> = {};
    for (let i = 0; i < 20; i++) {
      longArgs[`field_${i}`] = 'a'.repeat(20);
    }
    const summary = buildActionSummary('create_event', longArgs);
    expect(summary.length).toBeLessThanOrEqual(200);
    expect(summary.endsWith('…')).toBe(true);
  });
});
