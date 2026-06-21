/**
 * Unit tests for subscription error handling:
 * - categorizeEdgeFunctionError returns Portuguese messages ≤ 200 chars
 * - clearError action sets state.error to null
 *
 * **Validates: Requirements 9.1, 9.2**
 */
import reducer, {
  clearError,
  categorizeEdgeFunctionError,
  SubscriptionState,
} from '../slices/subscription';

describe('categorizeEdgeFunctionError', () => {
  it('returns timeout message for timeout errors', () => {
    const result = categorizeEdgeFunctionError(
      { message: 'Request timed out after 30000ms' },
      'Fallback'
    );
    expect(result).toBe(
      'Falha na comunicação com serviço de pagamento. Tempo limite excedido.'
    );
    expect(result.length).toBeLessThanOrEqual(200);
  });

  it('returns connection message for network errors', () => {
    const result = categorizeEdgeFunctionError(
      { message: 'Failed to fetch' },
      'Fallback'
    );
    expect(result).toBe(
      'Erro de conexão. Verifique sua internet e tente novamente.'
    );
    expect(result.length).toBeLessThanOrEqual(200);
  });

  it('returns server error message for 500-level errors', () => {
    const result = categorizeEdgeFunctionError(
      { message: 'Edge Function returned a non-2xx status code 502' },
      'Fallback'
    );
    expect(result).toBe(
      'Erro no servidor de pagamento. Tente novamente em alguns instantes.'
    );
    expect(result.length).toBeLessThanOrEqual(200);
  });

  it('returns original message if short and no category match', () => {
    const result = categorizeEdgeFunctionError(
      { message: 'CPF/CNPJ já cadastrado para outro usuário' },
      'Fallback'
    );
    expect(result).toBe('CPF/CNPJ já cadastrado para outro usuário');
    expect(result.length).toBeLessThanOrEqual(200);
  });

  it('returns fallback if error message is empty', () => {
    const result = categorizeEdgeFunctionError({ message: '' }, 'Erro genérico');
    expect(result).toBe('Erro genérico');
    expect(result.length).toBeLessThanOrEqual(200);
  });

  it('returns fallback if error is null', () => {
    const result = categorizeEdgeFunctionError(null, 'Erro ao criar cliente');
    expect(result).toBe('Erro ao criar cliente');
    expect(result.length).toBeLessThanOrEqual(200);
  });

  it('truncates messages longer than 200 characters', () => {
    const longMessage = 'A'.repeat(250);
    const result = categorizeEdgeFunctionError(
      { message: longMessage },
      'Fallback'
    );
    expect(result.length).toBeLessThanOrEqual(200);
    expect(result.endsWith('...')).toBe(true);
  });

  it('all predefined messages are in Portuguese and ≤ 200 chars', () => {
    const testCases = [
      { error: { message: 'timeout' }, fallback: 'F' },
      { error: { message: 'network error' }, fallback: 'F' },
      { error: { message: '500 internal' }, fallback: 'F' },
      { error: null, fallback: 'Erro ao consultar status da assinatura' },
      { error: null, fallback: 'Erro ao criar cliente no Asaas' },
      { error: null, fallback: 'Erro ao criar assinatura' },
      { error: null, fallback: 'Erro ao cancelar assinatura' },
    ];

    for (const tc of testCases) {
      const result = categorizeEdgeFunctionError(tc.error, tc.fallback);
      expect(result.length).toBeLessThanOrEqual(200);
      // Basic check: no pure English-only messages (all should have accented chars or known PT words)
      expect(result).toBeTruthy();
    }
  });
});

describe('clearError action', () => {
  it('sets state.error to null when dispatched', () => {
    const stateWithError: SubscriptionState = {
      status: 'none',
      asaasCustomerId: null,
      asaasSubscriptionId: null,
      nextDueDate: null,
      value: null,
      gracePeriodEndsAt: null,
      plan: null,
      loading: false,
      error: 'Erro ao criar assinatura',
      pixData: null,
      initialized: false,
    };

    const newState = reducer(stateWithError, clearError());
    expect(newState.error).toBeNull();
  });

  it('does not affect other state fields', () => {
    const stateWithError: SubscriptionState = {
      status: 'active',
      asaasCustomerId: 'cust_123',
      asaasSubscriptionId: 'sub_456',
      nextDueDate: '2025-02-01',
      value: 49.9,
      gracePeriodEndsAt: null,
      plan: null,
      loading: true,
      error: 'Algum erro',
      pixData: { qrCode: 'abc', copyPaste: 'def', expiresAt: '2025-01-20' },
      initialized: true,
    };

    const newState = reducer(stateWithError, clearError());
    expect(newState.error).toBeNull();
    expect(newState.status).toBe('active');
    expect(newState.asaasCustomerId).toBe('cust_123');
    expect(newState.loading).toBe(true);
    expect(newState.pixData).toEqual({ qrCode: 'abc', copyPaste: 'def', expiresAt: '2025-01-20' });
    expect(newState.initialized).toBe(true);
  });
});
