import { render, userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Provider } from 'react-redux';

import { store } from '@maestra/core/store/store';
import Plano from '../artista/[id]/plano';
import { comDiagnostico, semDiagnostico } from './fixtures';

let mockIdNaRota = comDiagnostico.id;
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: mockIdNaRota }),
  useRouter: () => ({ back: jest.fn() }),
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

const montar = () => render(<Provider store={store}><Plano /></Provider>);

describe('plano de acao', () => {
  beforeEach(() => {
    semear();
    mockIdNaRota = comDiagnostico.id;
    mockUpdate.mockClear();
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

  it('conta o progresso somando as tarefas de TODAS as estrategias', async () => {
    const tela = await montar();
    expect(tela.getByText('1 de 3 tarefas concluídas')).toBeTruthy();
  });

  // A caixa marcada precisa ser legivel por leitor de tela, nao so visualmente riscada.
  it('expoe o estado de cada tarefa para acessibilidade', async () => {
    const tela = await montar();
    const feita = tela.getByLabelText('Mapear três casas na cidade vizinha');
    const aberta = tela.getByLabelText('Montar proposta com cachê e rider');
    expect(feita.props.accessibilityState.checked).toBe(true);
    expect(aberta.props.accessibilityState.checked).toBe(false);
  });

  it('tocar numa tarefa manda gravar o conteudo com o status virado', async () => {
    const tela = await montar();
    const usuario = userEvent.setup();

    await usuario.press(tela.getByLabelText('Montar proposta com cachê e rider'));

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const [, dados] = mockUpdate.mock.calls[0];
    const estrategia = dados.content.strategies.find((e: { id: string }) => e.id === 's-1');
    const alvo = estrategia.tasks.find((t: { id: string }) => t.id === 't-2');
    expect(alvo.status).toBe('done');
    // E a tarefa vizinha, na mesma estrategia, nao pode ter sido tocada.
    expect(estrategia.tasks.find((t: { id: string }) => t.id === 't-1').status).toBe('done');
  });

  it('perfil sem plano explica onde ele e feito, em vez de tela vazia', async () => {
    mockIdNaRota = semDiagnostico.id;
    const tela = await montar();
    expect(tela.getByText('Nenhum plano ainda')).toBeTruthy();
  });
});
