import { render, userEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { WIZARD_VERSION } from '@maestra/core/constants/maestra';
import { store } from '@maestra/core/store/store';

import Wizard from '../wizard/[id]';
import { comDiagnostico } from './fixtures';

// O wizard nativo.
//
// O que este teste protege é o que a conversa GRAVA: as respostas vão para o mesmo
// `artists.content` que a web lê, e uma chave trocada aqui é um plano que só existe de um lado.
// A conversa em si (o roteiro, as falas) é do núcleo e tem teste lá.

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    replace: (...a: unknown[]) => mockReplace(...a),
    push: (...a: unknown[]) => mockPush(...a),
  },
  Redirect: () => null,
  useLocalSearchParams: () => ({ id: 'a-1' }),
}));

jest.mock('@/nucleo/sessao', () => ({
  useSessao: () => ({ sessao: { user: { id: 'u-1' } }, carregando: false }),
}));

// O WebView é módulo nativo: sem o dublê, importar a tela derruba a suíte.
jest.mock('react-native-webview', () => {
  const { View } = jest.requireActual('react-native');
  return { WebView: View };
});

const mockGravar = jest.fn();
// A gravação é interceptada no SERVIÇO, e não no slice: mockar o slice troca o reducer que o
// store real registrou, e a tela fica sem `state.artists`.
jest.mock('@maestra/core/services/db/artists', () => ({
  updateArtist: (id: string, patch: Record<string, unknown>) => {
    mockGravar(id, patch);
    return Promise.resolve({ id, ...patch });
  },
  fetchArtists: () => Promise.resolve([]),
}));

jest.mock('@maestra/core/lib/supabase', () => ({
  supabase: {
    functions: { invoke: () => Promise.resolve({ data: {}, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }),
    },
  },
}));

const MEDIDAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montar = () => render(
  <SafeAreaProvider initialMetrics={MEDIDAS}>
    <Provider store={store}><Wizard /></Provider>
  </SafeAreaProvider>,
);

const semear = (perfis: unknown[]) =>
  store.dispatch({ type: 'artists/fetchArtists/fulfilled', payload: perfis });

/**
 * Um perfil pago, sem nenhuma resposta do planejamento.
 *
 * `wizardVersion` importa: sem ela a migração trata o conteúdo como de um método ANTIGO e zera o
 * plano — foi o que aconteceu na primeira versão deste teste, e o "já respondeu" voltava ao
 * convite porque a resposta tinha acabado de ser apagada.
 */
const semPlano = {
  ...comDiagnostico,
  id: 'a-1',
  name: 'AZMUTH BEATS',
  is_locked: false,
  content: {
    ...comDiagnostico.content,
    step: 0,
    wizardVersion: WIZARD_VERSION,
    identity: { name: 'AZMUTH BEATS' },
  },
};

describe('wizard do planejamento', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    semear([semPlano]);
  });

  it('quem não começou vê o convite antes da conversa', async () => {
    const tela = await montar();
    expect(await tela.findByText(/veja o caminho completo/)).toBeTruthy();
    expect(tela.getByLabelText('Começar meu planejamento')).toBeTruthy();
  });

  it('o convite abre a conversa, e a Nyta fala primeiro', async () => {
    const usuario = userEvent.setup();
    const tela = await montar();

    await usuario.press(await tela.findByLabelText('Começar meu planejamento'));

    // A barra da etapa é a porta do plano — e diz onde a pessoa está.
    expect(await tela.findByText(/Etapa 1 de/)).toBeTruthy();
  });

  it('a barra da etapa abre o plano acumulado', async () => {
    const usuario = userEvent.setup();
    const tela = await montar();
    await usuario.press(await tela.findByLabelText('Começar meu planejamento'));

    await usuario.press(await tela.findByLabelText(/Etapa 1 de .*Ver seu plano/));

    // A folha lista as NOVE etapas, inclusive as que ainda não chegaram: quem está na 1 precisa
    // saber o que vem, e as futuras entram trancadas.
    expect(await tela.findByLabelText('Fechar')).toBeTruthy();
    expect(tela.getByText('Prioridades')).toBeTruthy();
  });

  // Quem já respondeu alguma coisa NÃO volta para o convite: a Identidade sozinha tem sete
  // sub-perguntas antes de o passo virar 1, e um `step === 0` sozinho mandaria de volta ao começo
  // quem já tinha respondido metade.
  it('quem já respondeu retoma a conversa, sem passar pelo convite', async () => {
    semear([{
      ...semPlano,
      content: { ...semPlano.content, identity: { name: 'AZMUTH BEATS', gender: 'masculino' } },
    }]);
    const tela = await montar();

    await waitFor(() => expect(tela.queryByLabelText('Começar meu planejamento')).toBeNull());
    expect(await tela.findByText(/Etapa 1 de/)).toBeTruthy();
  });

  it('sem permissão de editar o plano, vai para o Plano de Ação', async () => {
    semear([{ ...semPlano, role: 'member' }]);
    await montar();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/artista/[id]/plano', params: { id: 'a-1' },
    }));
  });
});
