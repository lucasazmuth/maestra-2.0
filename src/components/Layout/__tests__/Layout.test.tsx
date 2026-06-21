/**
 * Unit Tests for AppLayout fetchSubscriptionStatus dispatch
 * Feature: asaas-payment-e2e, Task 10.3
 *
 * Verifies:
 * - fetchSubscriptionStatus is NOT dispatched when PAYWALL_DISABLED === true
 * - fetchSubscriptionStatus IS dispatched on mount when PAYWALL_DISABLED is false and user is authenticated
 * - fetchSubscriptionStatus is NOT dispatched when user is not authenticated
 *
 * Validates: Requirements 10.1, 6.1
 */

import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';

// ─── Global Mocks (jsdom polyfills) ──────────────────────────────────────────

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock supabase functions.invoke to track calls
const mockInvoke = jest.fn().mockResolvedValue({
  data: {
    status: 'none',
    asaasCustomerId: null,
    asaasSubscriptionId: null,
    nextDueDate: null,
    value: null,
    gracePeriodEndsAt: null,
  },
  error: null,
});

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    functions: { invoke: (...args: any[]) => mockInvoke(...args) },
  },
}));

// Mock child components that have complex dependencies
jest.mock('../components/Topbar', () => ({
  Topbar: () => <div data-testid="topbar">Topbar</div>,
}));

jest.mock('../components/Sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar">Sidebar</div>,
}));

jest.mock('../../Modals/LanguageModal', () => ({
  LanguageModal: () => null,
}));

jest.mock('../../AnnouncementBanner', () => ({
  StatusBanner: () => null,
  useStatusBanner: () => null,
}));

jest.mock('../../nyta/NytaFloatingModal', () => ({
  NytaFloatingModal: () => null,
}));

jest.mock('../../../utils/isMobile', () => ({
  __esModule: true,
  default: () => false,
}));

jest.mock('react-resizable-panels', () => ({
  Panel: ({ children }: any) => <div>{children}</div>,
  PanelGroup: ({ children }: any) => <div>{children}</div>,
  PanelResizeHandle: () => <div />,
}));

// Mock antd grid components to avoid responsiveObserver issues in jsdom
jest.mock('antd', () => ({
  Col: ({ children }: any) => <div>{children}</div>,
  Row: ({ children }: any) => <div>{children}</div>,
}));

// Default: PAYWALL_DISABLED = false
let mockPaywallDisabled = false;
jest.mock('../../../constants/maestra', () => ({
  get PAYWALL_DISABLED() {
    return mockPaywallDisabled;
  },
  FEATURE_NYTA_MODAL: false,
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { AppLayout } from '../index';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createTestStore(userId?: string) {
  return configureStore({
    reducer: {
      auth: (state = { user: userId ? { id: userId } : null, session: {}, requesting: false }) => state,
      subscription: (
        state = {
          status: 'none' as const,
          asaasCustomerId: null,
          asaasSubscriptionId: null,
          nextDueDate: null,
          value: null,
          gracePeriodEndsAt: null,
          loading: false,
          error: null,
          pixData: null,
          initialized: false,
        }
      ) => state,
      ui: (state = { libraryCollapsed: false }) => state,
      language: (state = {}) => state,
      artists: (state = { items: [], loading: false }) => state,
    },
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AppLayout - fetchSubscriptionStatus dispatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPaywallDisabled = false;
  });

  describe('when PAYWALL_DISABLED is false', () => {
    beforeEach(() => {
      mockPaywallDisabled = false;
    });

    it('dispatches fetchSubscriptionStatus on mount when user is authenticated', () => {
      const store = createTestStore('user-123');

      render(
        <Provider store={store}>
          <MemoryRouter>
            <AppLayout />
          </MemoryRouter>
        </Provider>
      );

      expect(mockInvoke).toHaveBeenCalledWith('asaas-subscription-status');
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });

    it('does NOT dispatch fetchSubscriptionStatus when user is not authenticated', () => {
      const store = createTestStore(undefined);

      render(
        <Provider store={store}>
          <MemoryRouter>
            <AppLayout />
          </MemoryRouter>
        </Provider>
      );

      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  describe('when PAYWALL_DISABLED is true', () => {
    beforeEach(() => {
      mockPaywallDisabled = true;
    });

    it('does NOT dispatch fetchSubscriptionStatus even when user is authenticated', () => {
      const store = createTestStore('user-123');

      render(
        <Provider store={store}>
          <MemoryRouter>
            <AppLayout />
          </MemoryRouter>
        </Provider>
      );

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('does NOT dispatch fetchSubscriptionStatus when user is not authenticated', () => {
      const store = createTestStore(undefined);

      render(
        <Provider store={store}>
          <MemoryRouter>
            <AppLayout />
          </MemoryRouter>
        </Provider>
      );

      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });
});
