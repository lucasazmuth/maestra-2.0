import { render, userEvent } from '@testing-library/react-native';
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
let mockConversas: { id: string; title: string | null; updatedAt: string; userId: string }[] = [];

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'a-1' }),
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@maestra/core/hooks/useNytaConversations', () => ({
  useNytaConversations: () => ({
    conversations: mockConversas, loading: false,
    refresh: jest.fn(), rename: jest.fn(), remove: jest.fn().mockResolvedValue(true),
  }),
}));

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
    selectConversation: jest.fn(), startNewConversation: jest.fn(), clearConversation: jest.fn(),
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

  // A navegação em dois níveis: a lista de conversas é o nível de trás, e o "voltar" do
  // cabeçalho do chat leva até ela — não para fora da Nyta. Um "voltar" que saísse da tela
  // deixaria o histórico inalcançável, que foi como o app viveu até agora.
  describe('o histórico de conversas', () => {
    beforeEach(() => { mockPro = true; });

    it('o voltar do chat leva à lista, e não para fora da Nyta', async () => {
      mockConversas = [
        { id: 'c-1', title: 'Lançamento do single', updatedAt: '2026-08-29T09:00:00', userId: 'u-1' },
      ];
      const tela = await montar();

      await userEvent.setup().press(tela.getByLabelText('Voltar para as conversas'));

      expect(tela.getByText('CONVERSAS')).toBeTruthy();
      expect(tela.getByText('Lançamento do single')).toBeTruthy();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('é de dentro da lista que se sai para o perfil', async () => {
      mockConversas = [];
      const tela = await montar();
      const usuario = userEvent.setup();

      await usuario.press(tela.getByLabelText('Voltar para as conversas'));
      await usuario.press(tela.getByLabelText('Voltar para o perfil'));

      expect(mockPush).toHaveBeenCalledWith('/artista/a-1');
    });

    it('sem conversas, a lista diz o que vai aparecer ali', async () => {
      mockConversas = [];
      const tela = await montar();

      await userEvent.setup().press(tela.getByLabelText('Voltar para as conversas'));

      expect(tela.getByText('Suas conversas com a Nyta aparecem aqui.')).toBeTruthy();
    });

    // Conversa sem título é o estado normal até o servidor batizar a primeira: a linha existe no
    // banco, e uma lista com um item em branco não diz o que ele é.
    it('conversa sem título aparece como "Nova conversa"', async () => {
      mockConversas = [
        { id: 'c-2', title: null, updatedAt: '2026-08-29T09:00:00', userId: 'u-1' },
      ];
      const tela = await montar();

      await userEvent.setup().press(tela.getByLabelText('Voltar para as conversas'));

      expect(tela.getByLabelText('Abrir conversa: Nova conversa')).toBeTruthy();
    });
  });
});
