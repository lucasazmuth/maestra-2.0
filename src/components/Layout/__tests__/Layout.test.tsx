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

import { render, screen, waitFor, within } from '@testing-library/react';
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

  Object.defineProperty(window, 'scrollTo', {
    writable: true,
    value: jest.fn(),
  });

  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    value: jest.fn(),
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
    // `from` entrou depois deste mock: o menu do sistema usa `useIsPlatformAdmin`, que
    // consulta `platform_admins`. Sem isto o hook estourava "supabase.from is not a function"
    // dentro de um efeito e derrubava o render antes do que estes testes verificam.
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
      }),
    }),
    // O menu do sistema carrega os modulos do admin por rpc; sem isto o Promise.all do
    // `useAdminRole` rejeita e derruba o render inteiro.
    rpc: () => Promise.resolve({ data: [], error: null }),
    // O sino assina realtime para acender sem precisar navegar.
    channel: () => ({ on: function () { return this; }, subscribe: function () { return this; } }),
    removeChannel: () => {},
  },
}));

// Contador de nao-lidas do sino. Cada teste ajusta o retorno.
// O `??` nao e zelo excessivo: o CRA roda com `resetMocks`, entao a implementacao definida aqui
// e apagada antes de cada teste e a chamada devolveria `undefined` — o efeito faria
// `undefined.then(...)` e derrubaria o render de TODOS os testes deste arquivo.
const mockCountUnread = jest.fn();
jest.mock('../../../services/db/notifications', () => ({
  countUnread: (...args: any[]) => mockCountUnread(...args) ?? Promise.resolve(0),
}));

// Mock child components that have complex dependencies
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

// lottie-web reads a real canvas context at import time, which JSDOM does not
// provide. Layout behavior does not depend on animation rendering.
jest.mock('lottie-web', () => ({
  __esModule: true,
  default: {
    loadAnimation: jest.fn(() => ({
      destroy: jest.fn(),
      setSpeed: jest.fn(),
    })),
  },
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
  // O Layout usa `useJourneyState`, que chama `isOnboardingComplete` deste módulo. Sem o stub o
  // mock devolve undefined e o render quebra antes de chegar no que estes testes verificam
  // (o dispatch de fetchSubscriptionStatus). O valor não importa aqui.
  isOnboardingComplete: () => false,
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { AppLayout } from '../index';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createTestStore(userId?: string, artistas: unknown[] = []) {
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
      artists: (state = { items: artistas, loading: false }) => state,
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

describe('AppLayout - ponto vermelho do sino', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPaywallDisabled = false;
  });

  const renderizar = () =>
    render(
      <Provider store={createTestStore('user-123')}>
        <MemoryRouter>
          <AppLayout />
        </MemoryRouter>
      </Provider>
    );

  // Ha mais de uma campainha na arvore (cabecalho e navegacao); o ponto vermelho e a do
  // cabecalho, que e a `.round-control`.
  const sinoDoCabecalho = () =>
    screen
      .getAllByRole('button', { name: /notifica/i })
      .find((b) => b.className.includes('round-control'))!;

  // O ponto vinha do CSS da referencia, pintado incondicionalmente: acendia sem notificacao
  // nenhuma. Um alerta que esta sempre aceso nao informa nada e ensina a ignorar o proximo.
  it('nao acende quando nao ha notificacoes nao lidas', async () => {
    mockCountUnread.mockResolvedValue(0);
    renderizar();

    await waitFor(() => expect(mockCountUnread).toHaveBeenCalledWith('user-123'));
    expect(sinoDoCabecalho().className).not.toContain('has-unread');
  });

  it('acende e diz quantas sao quando ha nao lidas', async () => {
    mockCountUnread.mockResolvedValue(3);
    renderizar();

    await waitFor(() => expect(sinoDoCabecalho().className).toContain('has-unread'));
    // O rotulo carrega a contagem: quem usa leitor de tela nao enxerga a bolinha.
    expect(sinoDoCabecalho()).toHaveAttribute('aria-label', expect.stringContaining('3 não lidas'));
  });
});

describe('AppLayout - lista de perfis do rail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPaywallDisabled = false;
  });

  const perfis = (quantos: number) =>
    Array.from({ length: quantos }, (_, i) => ({
      id: `artista-${i}`,
      name: `Artista ${i}`,
      content: {},
    }));

  const renderizarCom = (quantos: number) =>
    render(
      <Provider store={createTestStore('user-123', perfis(quantos))}>
        <MemoryRouter>
          <AppLayout />
        </MemoryRouter>
      </Provider>
    );

  // O rail cortava a lista nos 4 primeiros. Numa conta com 5 perfis o quinto simplesmente nao
  // existia na tela, e se ele fosse o selecionado nao havia como perceber qual estava ativo.
  // Cortar sem avisar e pior que rolar: some com o dado e nao deixa rastro.
  it('mostra todos os perfis da conta, nao so os primeiros', () => {
    renderizarCom(9);

    perfis(9).forEach(({ name }) => {
      expect(screen.getByLabelText(`Abrir perfil de ${name}`)).toBeInTheDocument();
    });
  });

  // A lista precisa ser o unico pedaco do rail que rola: se ela empurrasse os vizinhos, rolar
  // ate um perfil la embaixo esconderia os atalhos ou o botao de criar.
  it('mantem os atalhos e o botao de criar fora da area rolavel', () => {
    renderizarCom(30);

    const lista = screen.getByRole('group', { name: 'Seus perfis' });
    expect(within(lista).getAllByRole('button', { name: /^Abrir perfil de/ })).toHaveLength(30);
    expect(within(lista).queryByRole('button', { name: 'Criar novo perfil de artista' })).toBeNull();
    expect(within(lista).queryByRole('button', { name: 'Tela inicial' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Criar novo perfil de artista' })).toBeInTheDocument();
  });
});
