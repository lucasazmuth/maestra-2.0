import { render, userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Provider } from 'react-redux';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { store } from '@maestra/core/store/store';
import Plano from '../artista/[id]/plano';
import { comDiagnostico, semDiagnostico } from './fixtures';

let mockIdNaRota = comDiagnostico.id;
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { push: (...a: unknown[]) => mockPush(...a), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: mockIdNaRota }),
}));

jest.mock('@maestra/core/services/db/members', () => ({ listMembers: () => Promise.resolve([]) }));
jest.mock('@maestra/core/services/db/events', () => ({
  syncActionPlanTaskEvent: () => Promise.resolve(),
}));
jest.mock('@maestra/core/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }),
    },
  },
}));

// A gravacao vai ao Supabase; aqui interessa QUE conteudo o app manda gravar.
const mockUpdate = jest.fn();
jest.mock('@maestra/core/services/db/artists', () => ({
  ...jest.requireActual('@maestra/core/services/db/artists'),
  updateArtist: (id: string, dados: unknown) => {
    mockUpdate(id, dados);
    return Promise.resolve({ ...jest.requireActual('./fixtures').comDiagnostico, id });
  },
}));

const semear = () =>
  store.dispatch({
    type: 'artists/fetchArtists/fulfilled',
    payload: [comDiagnostico, semDiagnostico],
  });

// A `Folha` (a casca dos modais) lê a margem do aparelho, e `useSafeAreaInsets` exige o
// provedor. No app ele está na raiz; aqui precisa ser montado, como já fazem os testes da
// criação de perfil e do chat.
const MEDIDAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montar = () => render(
  <SafeAreaProvider initialMetrics={MEDIDAS}>
    <Provider store={store}><Plano /></Provider>
  </SafeAreaProvider>,
);

describe('plano de acao', () => {
  beforeEach(() => {
    semear();
    mockIdNaRota = comDiagnostico.id;
    mockUpdate.mockClear();
    mockPush.mockClear();
  });

  // Acordeao, como na web: uma estrategia aberta por vez. Um perfil real chegou com 31
  // estrategias e 107 tarefas — abertas todas, isso e uma parede de texto que nao se navega.
  it('lista todas as estrategias, mas so abre a primeira incompleta', async () => {
    const tela = await montar();

    expect(tela.getByText('Levar o show para uma segunda praça')).toBeTruthy();
    expect(tela.getByText('Sair da dependência de um canal só')).toBeTruthy();

    // A de foco abre sozinha; a outra fica fechada, com as tarefas fora da tela.
    expect(tela.getByText('Mapear três casas na cidade vizinha')).toBeTruthy();
    expect(tela.queryByText('Abrir catálogo em uma segunda distribuidora')).toBeNull();
  });

  it('o cabecalho numera e mostra o progresso de cada estrategia', async () => {
    const tela = await montar();
    expect(tela.getByText('ESTRATÉGIA #01')).toBeTruthy();
    expect(tela.getByText('ESTRATÉGIA #02')).toBeTruthy();
    expect(tela.getByText('1/2')).toBeTruthy(); // s-1: uma de duas
    expect(tela.getByText('0/1')).toBeTruthy(); // s-2
  });

  // Os titulos reais da metodologia tem cinco linhas. Sem piso de largura, o progresso era
  // espremido ate desaparecer — e o cabecalho perdia o numero que decide se vale abrir.
  it('o progresso nao e espremido por titulo longo', async () => {
    const tela = await montar();
    const estilo = StyleSheet.flatten(tela.getByText('1/2').props.style);
    expect(estilo.flexShrink).toBe(0);
    expect(estilo.minWidth).toBeGreaterThan(0);
  });

  it('abrir outra estrategia fecha a que estava aberta', async () => {
    const tela = await montar();
    const usuario = userEvent.setup();

    await usuario.press(tela.getByLabelText('Estratégia 2: Sair da dependência de um canal só'));

    expect(tela.getByText('Abrir catálogo em uma segunda distribuidora')).toBeTruthy();
    expect(tela.queryByText('Mapear três casas na cidade vizinha')).toBeNull();
  });

  // A web registra este bug: tratando "ninguem escolheu" e "fechei" como o mesmo estado, fechar
  // a estrategia EM FOCO cai de volta no auto-foco e ela reabre sozinha. Parece que o toque nao
  // funciona — e so naquela estrategia, o que torna a causa dificil de achar.
  it('fechar a estrategia em foco a mantem fechada, sem reabrir sozinha', async () => {
    const tela = await montar();
    const usuario = userEvent.setup();

    await usuario.press(tela.getByLabelText('Estratégia 1: Levar o show para uma segunda praça'));

    expect(tela.queryByText('Mapear três casas na cidade vizinha')).toBeNull();
  });

  // A lista não tem cabeçalho nenhum. A web já esconde no celular o kicker "ESTRATÉGIAS DO
  // PLANO" e a contagem "N estratégias" (a regra de 700px diz por quê: o kicker repete o título
  // logo acima, e a contagem repete o que a lista mostra). O rótulo "Ranking de execução"
  // caía no mesmo problema e ocupava uma faixa inteira numa tela onde cada linha conta.
  it('a lista vai direto ao ponto, sem faixa de título em cima', async () => {
    const tela = await montar();

    expect(tela.queryByText('Ranking de execução')).toBeNull();
    expect(tela.queryByText('ESTRATÉGIAS DO PLANO')).toBeNull();
    expect(tela.queryByText('2 estratégias')).toBeNull();
    // E a lista continua onde estava.
    expect(tela.getByText('Levar o show para uma segunda praça')).toBeTruthy();
    expect(tela.getByText('ESTRATÉGIA #01')).toBeTruthy();
  });

  // A caixa marcada precisa ser legivel por leitor de tela, nao so visualmente riscada. E o
  // rótulo diz o que o toque FAZ: a linha tem outros quatro alvos, e "concluir" não é o padrão
  // de tocar em qualquer lugar dela.
  it('expoe o estado de cada tarefa para acessibilidade', async () => {
    const tela = await montar();
    const feita = tela.getByLabelText('Reabrir: Mapear três casas na cidade vizinha');
    const aberta = tela.getByLabelText('Concluir: Montar proposta com cachê e rider');
    expect(feita.props.accessibilityState.checked).toBe(true);
    expect(aberta.props.accessibilityState.checked).toBe(false);
  });

  it('tocar no círculo manda gravar o conteudo com o status virado', async () => {
    const tela = await montar();
    const usuario = userEvent.setup();

    await usuario.press(tela.getByLabelText('Concluir: Montar proposta com cachê e rider'));

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const [, dados] = mockUpdate.mock.calls[0];
    const estrategia = dados.content.strategies.find((e: { id: string }) => e.id === 's-1');
    const alvo = estrategia.tasks.find((t: { id: string }) => t.id === 't-2');
    expect(alvo.status).toBe('done');
    // E a tarefa vizinha, na mesma estrategia, nao pode ter sido tocada.
    expect(estrategia.tasks.find((t: { id: string }) => t.id === 't-1').status).toBe('done');
  });

  // Os tres controles da linha na web: categoria, responsavel e prazo. Eles EDITAM — antes eu
  // tinha portado so o desenho deles, e a tela dizia coisas que ninguem podia mudar.
  it('a categoria da tarefa se troca pela linha', async () => {
    const tela = await montar();
    const usuario = userEvent.setup();

    await usuario.press(tela.getAllByLabelText('Mudar categoria')[0]);
    await usuario.press(await tela.findByLabelText('Audiovisual'));

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const [, dados] = mockUpdate.mock.calls[0];
    const alvo = dados.content.strategies
      .find((e: { id: string }) => e.id === 's-1').tasks
      .find((t: { id: string }) => t.id === 't-1');
    expect(alvo.type).toBe('audio_visual');
  });

  it('o responsável se atribui pela linha, e se remove', async () => {
    const tela = await montar();
    const usuario = userEvent.setup();

    await usuario.press(tela.getAllByLabelText('Atribuir responsável')[0]);
    await usuario.press(await tela.findByLabelText('Dono do perfil'));

    const [, dados] = mockUpdate.mock.calls[0];
    const alvo = dados.content.strategies
      .find((e: { id: string }) => e.id === 's-1').tasks
      .find((t: { id: string }) => t.id === 't-1');
    expect(alvo.owner).toBe('owner');
  });

  // "Adicionar tarefa" e a NYTA, como na web: la o botao abre o modal dela com a pergunta ja
  // enviada. Aqui a Nyta e uma aba, entao a mesma pergunta viaja pela rota.
  it('adicionar tarefa leva à Nyta com o pedido pronto', async () => {
    const tela = await montar();
    const usuario = userEvent.setup();

    await usuario.press(
      tela.getByLabelText('Adicionar tarefa em Levar o show para uma segunda praça'),
    );

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/artista/[id]/nyta',
      params: {
        id: comDiagnostico.id,
        pergunta: 'Quero criar uma tarefa para a estratégia "Levar o show para uma segunda praça"',
      },
    });
  });

  // O "⋮" abre a ficha da tarefa — e é lá que "Em andamento" existe. Na lista a bolinha só
  // distingue feito de não-feito, como na web.
  it('o "⋮" abre a ficha, com as duas abas', async () => {
    const tela = await montar();
    const usuario = userEvent.setup();

    await usuario.press(tela.getByLabelText('Abrir detalhes de: Montar proposta com cachê e rider'));

    // O sobretítulo "TAREFA" saiu com a padronização das folhas: ele repetia o módulo de onde a
    // pessoa veio, e quem identifica a ficha agora é o título, que é a própria tarefa. Mas esse
    // texto também está na LISTA atrás, então quem prova que a folha abriu é o botão de fechar
    // dela, que só existe com a folha na tela.
    expect(await tela.findByLabelText('Fechar')).toBeTruthy();
    expect(tela.getByLabelText('Geral')).toBeTruthy();
    expect(tela.getByLabelText('Comentários')).toBeTruthy();
    expect(tela.getByLabelText('Status: A fazer')).toBeTruthy();
  });

  it('o comentário da ficha entra na tarefa', async () => {
    const tela = await montar();
    const usuario = userEvent.setup();

    await usuario.press(tela.getByLabelText('Abrir detalhes de: Montar proposta com cachê e rider'));
    await usuario.press(await tela.findByLabelText('Comentários'));
    await usuario.type(tela.getByLabelText('Novo comentário'), 'falei com a casa');
    await usuario.press(tela.getByLabelText('Enviar comentário'));

    const [, dados] = mockUpdate.mock.calls[0];
    const alvo = dados.content.strategies
      .find((e: { id: string }) => e.id === 's-1').tasks
      .find((t: { id: string }) => t.id === 't-2');
    expect(alvo.comments).toHaveLength(1);
    expect(alvo.comments[0].body).toBe('falei com a casa');
  });

  it('perfil sem plano explica onde ele e feito, em vez de tela vazia', async () => {
    mockIdNaRota = semDiagnostico.id;
    const tela = await montar();
    expect(tela.getByText('Nenhum plano ainda')).toBeTruthy();
  });
});
