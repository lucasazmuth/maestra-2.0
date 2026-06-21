/**
 * Unit tests for Payment page redirect guard.
 *
 * Requirement 9.6: Redirect to /assinatura within 1 second when pixData is missing qrCode or expiresAt
 * Requirement 4.2: pixData must contain required fields (qrCodeImage, expiresAt)
 *
 * Validates: Requirements 9.6, 4.2
 */

import { render, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';

import subscriptionReducer, {
  SubscriptionState,
} from '../../../store/slices/subscription';

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

jest.mock('../../../lib/supabase', () => ({
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

describe('Payment page redirect guard', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    currentPath = '/pagamento';
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
      renderPaymentPage({
        pixData: null,
        status: 'active',
      });

      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      // Status active means payment confirmed, should not redirect to /assinatura
      expect(currentPath).toBe('/pagamento');
    });
  });
});
