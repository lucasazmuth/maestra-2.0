import { render, userEvent } from '@testing-library/react-native';
import { Provider } from 'react-redux';

import { store } from '@maestra/core/store/store';
import Plano from '../plano/[id]';
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

  it('lista as estrategias e as tarefas de cada uma', async () => {
    const tela = await montar();
    expect(tela.getByText('Levar o show para uma segunda praça')).toBeTruthy();
    expect(tela.getByText('Mapear três casas na cidade vizinha')).toBeTruthy();
    expect(tela.getByText('Abrir catálogo em uma segunda distribuidora')).toBeTruthy();
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
