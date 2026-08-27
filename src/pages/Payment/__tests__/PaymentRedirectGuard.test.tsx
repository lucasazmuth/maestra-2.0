/**
 * Unit tests for Payment page redirect guard.
 *
 * Requirement 9.6: Redirect to /assinatura within 1 second when pixData is missing qrCode or expiresAt
 * Requirement 4.2: pixData must contain required fields (qrCodeImage, expiresAt)
 *
 * Validates: Requirements 9.6, 4.2
 */

import { render, act, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';

import subscriptionReducer, {
  SubscriptionState,
} from '@maestra/core/store/slices/subscription';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock supabase to prevent actual API calls.
// The mock returns 'pending' status which keeps polling running without
// resolving (useful for testing redirect behavior independently of polling).
const mockInvoke = jest.fn().mockImplementation((fnName: string) => {
  // Retomar pagamento: sem nada pra retomar → dispara o redirect pra /assinatura.
  if (fnName === 'asaas-resume-payment') {
    return Promise.resolve({ data: { status: 'none' }, error: null });
  }
  // Demais (polling de status): nunca resolve — simula poll em andamento.
  return new Promise(() => {});
});

jest.mock('@maestra/core/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: any[]) => mockInvoke(...args),
    },
  },
}));

// Track which route we've navigated to
let currentPath = '/pagamento';

function LocationDisplay() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useLocation } = require('react-router-dom');
  const location = useLocation();
  currentPath = location.pathname;
  return <div data-testid="location">{location.pathname}</div>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createTestStore(subscriptionState: Partial<SubscriptionState>) {
  const preloadedState = {
    subscription: {
      status: 'pending' as const,
      asaasCustomerId: null,
      asaasSubscriptionId: null,
      nextDueDate: null,
      value: null,
      gracePeriodEndsAt: null,
      pendingRenewal: false,
      pixAutomatic: false,
      plan: null,
      loading: false,
      error: null,
      pixData: null,
      initialized: true,
      ...subscriptionState,
    },
  };

  return configureStore({
    reducer: {
      subscription: subscriptionReducer,
    },
    preloadedState,
  });
}

// Lazy import to allow mocks to be set up first
let PaymentPage: React.FC;

beforeAll(() => {
  PaymentPage = require('../index').default;
});

function renderPaymentPage(subscriptionState: Partial<SubscriptionState>) {
  const store = createTestStore(subscriptionState);

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/pagamento']}>
        <Routes>
          <Route path="/pagamento" element={<PaymentPage />} />
          <Route path="/assinatura" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

// Resposta padrao do resume: "nada pra retomar". Cada teste que precisa de outro contrato
// sobrescreve com `mockInvoke.mockImplementation`.
const resumeRespondendo = (data: Record<string, unknown>) => {
  mockInvoke.mockImplementation((fnName: string) => {
    if (fnName === 'asaas-resume-payment') return Promise.resolve({ data, error: null });
    return new Promise(() => {});
  });
};

describe('Payment page redirect guard', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    currentPath = '/pagamento';
    resumeRespondendo({ status: 'none' });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Redirects to /assinatura when pixData is invalid', () => {
    it('redirects when pixData is null', async () => {
      renderPaymentPage({ pixData: null, status: 'pending' });

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(currentPath).toBe('/assinatura');
    });

    it('redirects when pixData.qrCode is null', async () => {
      renderPaymentPage({
        pixData: { qrCode: null, copyPaste: 'some-pix-key', expiresAt: '2025-12-31T23:59:59Z' },
        status: 'pending',
      });

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(currentPath).toBe('/assinatura');
    });

    it('redirects when pixData.qrCode is empty string', async () => {
      renderPaymentPage({
        pixData: { qrCode: '', copyPaste: 'some-pix-key', expiresAt: '2025-12-31T23:59:59Z' },
        status: 'pending',
      });

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(currentPath).toBe('/assinatura');
    });

    it('redirects when pixData.expiresAt is null', async () => {
      renderPaymentPage({
        pixData: { qrCode: 'base64QrCodeData', copyPaste: 'some-pix-key', expiresAt: null },
        status: 'pending',
      });

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(currentPath).toBe('/assinatura');
    });

    it('redirects when pixData.expiresAt is empty string', async () => {
      renderPaymentPage({
        pixData: { qrCode: 'base64QrCodeData', copyPaste: 'some-pix-key', expiresAt: '' },
        status: 'pending',
      });

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(currentPath).toBe('/assinatura');
    });

    it('redirects after resume finds nothing to resume', async () => {
      renderPaymentPage({ pixData: null, status: 'pending' });

      // Tenta retomar (resume → none) e então redireciona pros planos.
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(currentPath).toBe('/assinatura');
    });
  });

  describe('Does NOT redirect when valid pixData is present', () => {
    it('does not redirect when pixData has qrCode and expiresAt', async () => {
      renderPaymentPage({
        pixData: {
          qrCode: 'base64QrCodeDataValid',
          copyPaste: 'pix-copy-paste-text',
          expiresAt: new Date(Date.now() + 600000).toISOString(), // 10 minutes from now
        },
        status: 'pending',
      });

      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      expect(currentPath).toBe('/pagamento');
    });

    it('does not redirect when status is active (payment confirmed)', async () => {
      // O status do Redux nao decide mais sozinho: a pagina consulta o backend, que confirma
      // que a assinatura esta em dia. Antes havia um atalho aqui que nunca consultava — e era
      // exatamente ele que escondia a cobranca de renovacao (ver o teste abaixo).
      resumeRespondendo({ status: 'active' });
      renderPaymentPage({ pixData: null, status: 'active' });

      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      expect(currentPath).toBe('/pagamento');
    });

    it('NAO declara pagamento confirmado quando ha renovacao em aberto', async () => {
      // Regressao do bug mais grave da serie: o poll de status resolvia com `status === "active"`,
      // e numa renovacao a assinatura JA esta ativa (o ciclo anterior foi pago). O poll fechava na
      // primeira volta e a tela mandava o usuario pro /assinatura/sucesso sem ninguem ter pago.
      mockInvoke.mockImplementation((fnName: string) => {
        if (fnName === 'asaas-subscription-status') {
          return Promise.resolve({ data: { status: 'active', pendingRenewal: true }, error: null });
        }
        if (fnName === 'asaas-resume-payment') {
          return Promise.resolve({ data: { status: 'none' }, error: null });
        }
        return new Promise(() => {});
      });

      renderPaymentPage({
        status: 'active',
        pendingRenewal: true,
        pixData: { qrCode: 'data:image/png;base64,AAA', copyPaste: '000201...', expiresAt: '2026-12-31T23:59:59Z' },
      });

      await act(async () => {
        jest.advanceTimersByTime(30000);
      });

      expect(currentPath).not.toBe('/assinatura/sucesso');
      expect(currentPath).toBe('/pagamento');
    });

    it('mostra o QR da renovacao quando a assinatura esta ativa com cobranca em aberto', async () => {
      // Regressao do bug de producao: na virada do ciclo a assinatura segue `active` e nasce uma
      // cobranca nova. A pagina mostrava a tela de sucesso e o assinante nao conseguia pagar.
      resumeRespondendo({
        status: 'pending',
        pendingRenewal: true,
        pixData: { qrCode: 'data:image/png;base64,AAA', copyPaste: '000201...', expiresAt: '2026-12-31T23:59:59Z' },
      });
      renderPaymentPage({ pixData: null, status: 'active' });

      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      // Nao pode mandar pra /assinatura nem tratar como pago: fica na tela para pagar.
      expect(currentPath).toBe('/pagamento');
    });

    it('avisa que o pagamento autoriza debito recorrente quando e Pix Automatico', async () => {
      // Consentimento informado. Quem esta sendo migrado vinha pagando na mao todo mes e nao
      // espera que ESTE QR autorize debitos futuros no banco dele. Se o aviso sumir num refactor,
      // a pessoa autoriza recorrencia sem ter lido nada sobre isso.
      resumeRespondendo({
        status: 'pending',
        pendingRenewal: true,
        pixAutomatic: true,
        migrating: true,
        pixData: { qrCode: 'data:image/png;base64,AAA', copyPaste: '000201...', expiresAt: '2026-12-31T23:59:59Z' },
      });
      renderPaymentPage({ pixData: null, status: 'active' });

      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      expect(currentPath).toBe('/pagamento');
      expect(screen.getByText(/autoriza a cobranca automatica/i)).toBeInTheDocument();
      expect(screen.getByText(/cancelar quando quiser/i)).toBeInTheDocument();
    });

    it('avisa do debito recorrente tambem no checkout novo, nao so na migracao', async () => {
      // O aviso de consentimento vinha SO da resposta do resume, que e o caminho de quem esta
      // migrando. Quem contrata pelo checkout — a maioria — chegava nesta tela sem nenhuma
      // mencao a debito recorrente e autorizava no banco sem ter lido nada sobre isso.
      // Aqui o QR ja esta no estado (foi o checkout que colocou), entao o resume nem roda.
      renderPaymentPage({
        pixAutomatic: true,
        status: 'pending',
        pixData: { qrCode: 'data:image/png;base64,AAA', copyPaste: '000201...', expiresAt: '2026-12-31T23:59:59Z' },
      });

      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      expect(screen.getByText(/autoriza a cobranca automatica/i)).toBeInTheDocument();
    });

    it('nao mostra o aviso de debito recorrente numa renovacao comum', async () => {
      // O outro lado: o aviso nao pode aparecer no PIX avulso, senao promete uma automacao que
      // nao vai acontecer e a pessoa deixa de voltar pra pagar no mes seguinte.
      resumeRespondendo({
        status: 'pending',
        pendingRenewal: true,
        pixData: { qrCode: 'data:image/png;base64,AAA', copyPaste: '000201...', expiresAt: '2026-12-31T23:59:59Z' },
      });
      renderPaymentPage({ pixData: null, status: 'active' });

      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      expect(screen.queryByText(/autoriza a cobranca automatica/i)).not.toBeInTheDocument();
    });
  });
});
