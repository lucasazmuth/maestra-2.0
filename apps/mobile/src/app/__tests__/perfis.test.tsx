import { render, userEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';

import { WIZARD_TOTAL_STEPS, WIZARD_VERSION } from '@maestra/core/constants/maestra';
import { store } from '@maestra/core/store/store';
import Perfis from '../perfis';
import { comDiagnostico, semDiagnostico } from './fixtures';

// Um perfil que TERMINOU o wizard na versao atual — e o unico caso que abre dentro do app. Os
// fixtures nao carregam `step`/`wizardVersion` porque as outras telas nao olham para eles.
const pronto = {
  ...comDiagnostico,
  content: { ...comDiagnostico.content, step: WIZARD_TOTAL_STEPS, wizardVersion: WIZARD_VERSION },
};

// O `RefreshControl` nao publica `refreshing` na arvore renderizada — o no nativo sai com a
// prop `undefined`. Para verificar o valor que a tela PASSA, ele e capturado aqui.
const refreshingRecebido: boolean[] = [];
jest.mock('react-native/Libraries/Components/RefreshControl/RefreshControl', () => {
  const { View } = jest.requireActual('react-native');
  const Falso = (props: { refreshing: boolean }) => {
    refreshingRecebido.push(props.refreshing);
    return <View />;
  };
  // O modulo e ESM: devolver a funcao crua faz o React receber `undefined` como tipo.
  return { __esModule: true, default: Falso, RefreshControl: Falso };
});

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  Redirect: () => null,
}));

// A sessao vem do Supabase; aqui interessa a tela, nao o login.
jest.mock('@/nucleo/sessao', () => ({
  useSessao: () => ({
    sessao: { user: { id: 'u-1', email: 'artista@exemplo.com' } },
    carregando: false,
  }),
}));

// Semear pelo `fulfilled` do thunk real, e nao por um estado inventado: assim o teste passa
// pelo mesmo reducer que producao usa para guardar o resultado da busca.
const semearPerfis = (perfis: unknown[]) =>
  store.dispatch({ type: 'artists/fetchArtists/fulfilled', payload: perfis });

// `render` do RNTL 14 e assincrono.
//
// O provedor de margem segura entra aqui porque o menu do sistema le a margem de cima para
// abrir ABAIXO do cabecalho, em vez de num `top` fixo. Fora de um aparelho ele precisa das
// medidas na mao, senao o hook levanta.
const MEDIDAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montar = () => render(
  <Provider store={store}>
    <SafeAreaProvider initialMetrics={MEDIDAS}><Perfis /></SafeAreaProvider>
  </Provider>,
);



describe('lista de perfis', () => {
  beforeEach(() => {
    mockPush.mockClear();
    semearPerfis([comDiagnostico, semDiagnostico]);
  });

  // Para onde um perfil abre e regra do NUCLEO (`artistEntryRoute`), a mesma da web: sem
  // planejamento vai pro wizard, e so o resto abre a home. O app mandava tudo pra home — quem
  // tinha um perfil recem-criado caia numa tela vazia sem saber o que fazer.
  describe('a porta de entrada de cada perfil', () => {
    it('perfil pronto abre a home dele, dentro do app', async () => {
      semearPerfis([pronto]);
      const tela = await montar();
      await userEvent.setup().press(tela.getByLabelText(pronto.name));

      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/artista/[id]', params: { id: pronto.id },
      });
    });

    // O wizard passou a existir no app; antes esta linha abria o navegador.
    it('perfil sem planejamento vai pro wizard do app', async () => {
      const abrirUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
      const tela = await montar();
      await userEvent.setup().press(tela.getByLabelText(semDiagnostico.name));

      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/wizard/[id]', params: { id: semDiagnostico.id },
      });
      expect(abrirUrl).not.toHaveBeenCalled();
      abrirUrl.mockRestore();
    });
  });

  it('mostra os perfis do usuario', async () => {
    const tela = await montar();
    expect(tela.getByText('Marina Sol')).toBeTruthy();
    expect(tela.getByText('Coletivo Norte')).toBeTruthy();
  });

  // O cartao diz o ESTADO do perfil, e nao o selo R·E·A·L: e o que a web mostra aqui, e o REAL
  // ja e a primeira coisa dentro do perfil. Na ordem que importa — cobranca em aberto trava
  // tudo; sem plano, o proximo passo e o planejamento.
  it('diz o que falta em cada perfil', async () => {
    const tela = await montar();
    expect(tela.getAllByText('Planejamento não iniciado').length).toBeGreaterThan(0);
  });

  it('o papel de cada um aparece embaixo do nome', async () => {
    const tela = await montar();
    expect(tela.getAllByText('Administrador').length).toBeGreaterThan(0);
  });

  it('perfil sem foto cai na inicial do nome, nao numa imagem quebrada', async () => {
    const tela = await montar();
    expect(tela.getByText('C')).toBeTruthy(); // Coletivo Norte
  });

  // O cartao ja chegou a perder o estilo INTEIRO, sem erro nenhum: o `<Link asChild>` monta o
  // filho pelo Slot do Radix, que funde `style` como OBJETO, e estilo de `Pressable` e uma
  // FUNCAO — espalhar funcao em objeto da `{}`. Nenhum teste de texto pegava isso; so aparecia
  // com dado real na tela.
  //
  // O que se verifica aqui e o desenho ATUAL, que e o da web: cartao alto e centrado, com a
  // foto grande no meio. Era uma linha com miniatura a esquerda ate a copia da folha mobile.
  it('o cartao mantem o desenho centrado, e nao perde o estilo', async () => {
    const tela = await montar();
    const cartao = tela.getByLabelText('Marina Sol');
    const estilo = StyleSheet.flatten(cartao.props.style);
    expect(estilo.minHeight).toBe(300);
    expect(estilo.borderRadius).toBe(10);
    expect(estilo.justifyContent).toBe('center');
  });

  // O spinner de "puxar para atualizar" chegou a disparar sozinho ao voltar para a lista: ele
  // estava ligado ao `loading` do store, que fica true em QUALQUER busca — inclusive na que roda
  // sozinha ao montar. O resultado era um spinner sem ninguem ter puxado, empurrando a lista
  // para baixo com o conteudo ja na tela.
  it('nao mostra o spinner de puxar quando a busca e automatica', async () => {
    // Reproduz a condicao REAL: a lista ja carregou (`loaded`) e uma nova busca esta em voo
    // (`pending` => `loading`). E o estado de voltar para a tela, quando o efeito refaz a busca
    // sozinho — e era exatamente ai que o spinner aparecia sem ninguem ter puxado.
    store.dispatch({ type: 'artists/fetchArtists/pending' });
    const { loading, loaded } = store.getState().artists;
    expect([loading, loaded]).toEqual([true, true]);

    refreshingRecebido.length = 0;
    await montar();

    expect(refreshingRecebido.length).toBeGreaterThan(0);
    expect(refreshingRecebido).not.toContain(true);
  });

  it('lista vazia nao vira tela em branco', async () => {
    semearPerfis([]);
    const tela = await montar();
    expect(tela.getByText('Nenhum perfil ainda.')).toBeTruthy();
  });
});
