import { render } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';

import { store } from '@maestra/core/store/store';
import Nyta from '../artista/[id]/nyta';

// A Nyta é do plano PRO, e o que este arquivo guarda é o que acontece quando NÃO se tem o plano.
//
// Sem a trava, o app deixava escrever, mandava a pergunta e o servidor respondia 403: a mensagem
// sumia e nada na tela dizia por quê. Passei um bom tempo procurando defeito no streaming por
// causa disso — e quem usasse o app teria a mesma impressão, sem poder investigar.

let mockPro = false;

jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'a-1' }) }));

jest.mock('@maestra/core/hooks/useEntitlements', () => ({
  useEntitlements: () => ({ plan: mockPro ? 'pro' : 'free', isPro: mockPro, maxCatalogTracks: 5 }),
}));

jest.mock('@maestra/core/constants/maestra', () => ({
  ...jest.requireActual('@maestra/core/constants/maestra'),
  PAYWALL_DISABLED: false,
}));

jest.mock('@maestra/core/hooks/useNytaChat', () => ({
  useNytaChat: () => ({
    messages: [], isStreaming: false, pendingToolCalls: [], rateLimitInfo: null,
    loadingHistory: false, hasMoreHistory: false, error: null, unavailableModules: [],
    conversationId: null,
    loadOlderMessages: jest.fn(), sendMessage: jest.fn(), confirmTool: jest.fn(),
    cancelTool: jest.fn(), dismissError: jest.fn(),
  }),
}));

// `requireActual` dentro da fábrica: o `jest.mock` é içado para antes dos imports, então uma
// referência a um símbolo importado aqui em cima ainda estaria por inicializar.
jest.mock('@/nucleo/artista', () => ({
  useArtistaDaRota: () => jest.requireActual('./fixtures').comDiagnostico,
}));

const MEDIDAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montar = () => render(
  <Provider store={store}>
    <SafeAreaProvider initialMetrics={MEDIDAS}>
      <Nyta />
    </SafeAreaProvider>
  </Provider>,
);

describe('a Nyta', () => {
  it('sem PRO, explica o bloqueio em vez de deixar perguntar', async () => {
    mockPro = false;
    const tela = await montar();

    expect(tela.getByText('Nyta Assistente')).toBeTruthy();
    expect(tela.getByText(/Assine o PRO/)).toBeTruthy();
    // O ponto todo: não existe campo pra escrever numa pergunta que o servidor vai recusar.
    expect(tela.queryByLabelText('Pergunte algo à Nyta')).toBeNull();
  });

  it('com PRO, abre a conversa com a saudação e o campo', async () => {
    mockPro = true;
    const tela = await montar();

    expect(tela.getByText(/Oi! Eu sou a Nyta/)).toBeTruthy();
    expect(tela.getByLabelText('Pergunte algo à Nyta')).toBeTruthy();
    expect(tela.queryByText('Nyta Assistente')).toBeNull();
  });
});
