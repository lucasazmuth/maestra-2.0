import { render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';

import { store } from '@maestra/core/store/store';
import type { AgendaEvent } from '@maestra/core/interfaces/maestra';
import Agenda from '../artista/[id]/agenda';
import { comDiagnostico } from './fixtures';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: 'a-1' }),
  useRouter: () => ({ back: jest.fn() }),
}));

const mockListar = jest.fn();
jest.mock('@maestra/core/services/db/events', () => ({
  listEvents: (...args: unknown[]) => mockListar(...args),
}));

// Datas relativas ao dia da RODADA: fixar '2026-03-10' faria o teste passar hoje e falhar em
// março, que e o pior tipo de teste — o que quebra sem ninguem ter mexido.
const emDias = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const evento = (over: Partial<AgendaEvent>): AgendaEvent => ({
  id: 'e-0', artist_id: 'a-1', title: 'Evento', type: 'other',
  date: emDias(1), status: 'scheduled', ...over,
});

const montar = () => render(<Provider store={store}><Agenda /></Provider>);

describe('agenda', () => {
  beforeEach(() => {
    store.dispatch({ type: 'artists/fetchArtists/fulfilled', payload: [comDiagnostico] });
    mockListar.mockReset();
  });

  it('separa o que vem do que ja passou', async () => {
    mockListar.mockResolvedValue([
      evento({ id: 'e-1', title: 'Show no Circo', date: emDias(3) }),
      evento({ id: 'e-2', title: 'Ensaio da semana passada', date: emDias(-7) }),
    ]);
    const tela = await montar();

    await waitFor(() => expect(tela.getByText('Próximos')).toBeTruthy());
    expect(tela.getByText('Já passaram')).toBeTruthy();
    expect(tela.getByText('Show no Circo')).toBeTruthy();
    expect(tela.getByText('Ensaio da semana passada')).toBeTruthy();
  });

  // Evento de HOJE e futuro: quem abre a agenda de manha precisa ver o show da noite.
  it('conta o dia de hoje como proximo, nao como passado', async () => {
    mockListar.mockResolvedValue([evento({ id: 'e-3', title: 'Show de hoje', date: emDias(0) })]);
    const tela = await montar();

    await waitFor(() => expect(tela.getByText('Show de hoje')).toBeTruthy());
    expect(tela.getByText('Próximos')).toBeTruthy();
    expect(tela.queryByText('Já passaram')).toBeNull();
  });

  it('usa os rotulos de tipo do nucleo, os mesmos da web', async () => {
    mockListar.mockResolvedValue([evento({ id: 'e-4', type: 'rehearsal', title: 'Passagem de som' })]);
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Ensaio')).toBeTruthy());
  });

  it('mostra o horario quando ha, com inicio e fim', async () => {
    mockListar.mockResolvedValue([
      evento({ id: 'e-5', start_time: '20:00:00', end_time: '23:30:00' }),
    ]);
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('20:00 – 23:30')).toBeTruthy());
  });

  it('marca o cancelado em vez de escondê-lo', async () => {
    mockListar.mockResolvedValue([
      evento({ id: 'e-6', title: 'Show adiado', status: 'cancelled' }),
    ]);
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Cancelado')).toBeTruthy());
    expect(tela.getByText('Show adiado')).toBeTruthy();
  });

  it('agenda vazia explica de onde vem o conteudo', async () => {
    mockListar.mockResolvedValue([]);
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Nada marcado')).toBeTruthy());
  });

  // Falha de rede nao pode virar tela branca nem "nada marcado", que seria mentira.
  it('erro de carga diz que é indisponibilidade, nao ausencia', async () => {
    mockListar.mockRejectedValue(new Error('sem rede'));
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Agenda indisponível')).toBeTruthy());
    expect(tela.queryByText('Nada marcado')).toBeNull();
  });
});
