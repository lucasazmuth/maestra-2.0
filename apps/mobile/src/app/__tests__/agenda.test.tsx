import { render, userEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';

import { store } from '@maestra/core/store/store';
import type { AgendaEvent } from '@maestra/core/interfaces/maestra';
import Agenda from '../artista/[id]/agenda';
import { comDiagnostico } from './fixtures';

// A Agenda tem TRÊS visões e cria compromisso — não é uma lista de leitura.
//
// Ela já foi uma lista agrupada por "Próximos / Já passaram" aqui, e os testes deste arquivo
// guardavam aquilo. A web é um calendário: a grade de horas do dia, a grade do mês e os doze
// meses do ano. Tocar numa faixa vazia é o caminho normal de criar — abre o formulário já com o
// dia e a hora daquela faixa, e sobra só o título.

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'a-1' }),
}));

const mockListar = jest.fn();
const mockCriar = jest.fn();
const mockAtualizar = jest.fn();
const mockExcluir = jest.fn();
jest.mock('@maestra/core/services/db/events', () => ({
  listEvents: (...a: unknown[]) => mockListar(...a),
  createEvent: (...a: unknown[]) => mockCriar(...a),
  updateEvent: (...a: unknown[]) => mockAtualizar(...a),
  deleteEvent: (...a: unknown[]) => mockExcluir(...a),
}));

// Datas relativas ao dia da RODADA: fixar '2026-03-10' faria o teste passar hoje e falhar em
// março, que é o pior tipo de teste — o que quebra sem ninguém ter mexido.
const emDias = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const evento = (over: Partial<AgendaEvent>): AgendaEvent => ({
  id: 'e-0', artist_id: 'a-1', title: 'Evento', type: 'other',
  date: emDias(0), status: 'scheduled', ...over,
});

const montar = () => render(<Provider store={store}><Agenda /></Provider>);

describe('agenda', () => {
  beforeEach(() => {
    store.dispatch({ type: 'artists/fetchArtists/fulfilled', payload: [comDiagnostico] });
    [mockListar, mockCriar, mockAtualizar, mockExcluir].forEach((m) => m.mockReset());
    mockListar.mockResolvedValue([]);
  });

  it('abre no dia de hoje, com a grade de horas', async () => {
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('08:00')).toBeTruthy());
    expect(tela.getByText('23:00')).toBeTruthy();
    expect(tela.getByText('Dia todo')).toBeTruthy();
  });

  it('o evento do dia aparece na faixa do horário dele', async () => {
    mockListar.mockResolvedValue([
      evento({ id: 'e-1', title: 'Ensaio geral', start_time: '14:00' }),
    ]);
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Ensaio geral')).toBeTruthy());
  });

  // O compromisso sem horário não some: ele é o "Dia todo", no topo da grade.
  it('evento sem horário vira o "dia todo"', async () => {
    mockListar.mockResolvedValue([evento({ id: 'e-2', title: 'Viagem para o festival' })]);
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Viagem para o festival')).toBeTruthy());
  });

  it('as três visões trocam, e o mês mostra os dias', async () => {
    const tela = await montar();
    const usuario = userEvent.setup();

    await waitFor(() => expect(tela.getByText('08:00')).toBeTruthy());
    await usuario.press(tela.getByText('Mês'));
    expect(tela.getByText('Dom')).toBeTruthy();
    expect(tela.queryByText('08:00')).toBeNull();

    await usuario.press(tela.getByText('Ano'));
    // Doze meses, um cartao cada.
    expect(tela.getAllByText(/compromissos?$/)).toHaveLength(12);
  });

  // O caminho normal de criar: a faixa vazia leva o dia e a hora consigo, e o formulário abre
  // com os dois preenchidos — em branco, seriam dois campos a digitar antes do título.
  it('tocar numa faixa vazia abre o formulário com o dia e a hora dela', async () => {
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('08:00')).toBeTruthy());

    await userEvent.setup().press(tela.getByLabelText('Novo compromisso às 10:00'));

    expect(tela.getByText('Novo compromisso')).toBeTruthy();
    expect(tela.getByLabelText('Início').props.value).toBe('10:00');
    // Uma hora de duração como palpite, como na web.
    expect(tela.getByLabelText('Fim').props.value).toBe('11:00');
  });

  // O padrao precisa nascer aceso no lugar certo: um formulario que abre com "Cancelado"
  // marcado cria compromissos cancelados sem ninguem pedir.
  it('o formulario abre com Agendado e Outro, e nao com o ultimo de cada lista', async () => {
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('08:00')).toBeTruthy());
    await userEvent.setup().press(tela.getByLabelText('Novo compromisso às 10:00'));

    const aceso = (texto: string) =>
      tela.getByText(texto).parent?.props.accessibilityState?.selected;

    expect(aceso('Agendado')).toBe(true);
    expect(aceso('Cancelado')).toBe(false);
    expect(aceso('Outro')).toBe(true);
  });

  it('salvar cria o evento e ele aparece na grade', async () => {
    mockCriar.mockResolvedValue(evento({ id: 'e-novo', title: 'Reunião', start_time: '10:00' }));
    const tela = await montar();
    const usuario = userEvent.setup();
    await waitFor(() => expect(tela.getByText('08:00')).toBeTruthy());

    await usuario.press(tela.getByLabelText('Novo compromisso às 10:00'));
    await usuario.type(tela.getByLabelText('Título'), 'Reunião');
    await usuario.press(tela.getByText('Salvar'));

    await waitFor(() => expect(mockCriar).toHaveBeenCalled());
    expect(mockCriar.mock.calls[0][0]).toMatchObject({
      title: 'Reunião', artist_id: 'a-1', start_time: '10:00',
    });
    await waitFor(() => expect(tela.getByText('Reunião')).toBeTruthy());
  });

  // Título vazio não pode virar um compromisso sem nome na grade.
  it('não salva sem título', async () => {
    const tela = await montar();
    const usuario = userEvent.setup();
    await waitFor(() => expect(tela.getByText('08:00')).toBeTruthy());

    await usuario.press(tela.getByLabelText('Novo compromisso às 09:00'));
    await usuario.press(tela.getByText('Salvar'));

    expect(mockCriar).not.toHaveBeenCalled();
    expect(tela.getByText('Informe o título.')).toBeTruthy();
  });

  it('tocar num evento abre o formulário para editar', async () => {
    mockListar.mockResolvedValue([
      evento({ id: 'e-3', title: 'Estúdio', start_time: '11:00', location: 'Sala 2' }),
    ]);
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Estúdio')).toBeTruthy());

    await userEvent.setup().press(tela.getByLabelText('Estúdio'));

    expect(tela.getByText('Editar compromisso')).toBeTruthy();
    expect(tela.getByLabelText('Local').props.value).toBe('Sala 2');
  });

  // Prazo de tarefa se apaga no Plano de Ação, onde a tarefa vive: excluir por aqui deixaria a
  // tarefa sem prazo sem que ninguém tenha pedido isso.
  it('prazo vindo do plano não oferece excluir', async () => {
    mockListar.mockResolvedValue([
      evento({ id: 'e-4', title: 'Entregar o rider', start_time: '09:00', source: 'action_plan' }),
    ]);
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Entregar o rider')).toBeTruthy());

    await userEvent.setup().press(tela.getByLabelText('Entregar o rider'));

    expect(tela.getByText('Editar compromisso')).toBeTruthy();
    expect(tela.queryByLabelText('Excluir evento')).toBeNull();
  });

  it('agenda indisponível explica em vez de ficar em branco', async () => {
    mockListar.mockRejectedValue(new Error('sem rede'));
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Agenda indisponível')).toBeTruthy());
  });
});
