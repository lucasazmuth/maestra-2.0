import { render, userEvent, waitFor } from '@testing-library/react-native';

import type { NotificationItem } from '@maestra/core/interfaces/maestra';
import Notificacoes from '../notificacoes';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  Redirect: () => null,
  useRouter: () => ({ back: jest.fn(), push: mockPush }),
}));

jest.mock('@/nucleo/sessao', () => ({
  useSessao: () => ({ sessao: { user: { id: 'u-1' } }, carregando: false }),
}));

const mockListar = jest.fn();
const mockLer = jest.fn();
const mockLerTudo = jest.fn();
const mockNomes = jest.fn();
jest.mock('@maestra/core/services/db/notifications', () => ({
  listNotificationsPaginated: (...a: unknown[]) => mockListar(...a),
  markAsRead: (...a: unknown[]) => mockLer(...a),
  markAllAsRead: (...a: unknown[]) => mockLerTudo(...a),
  fetchArtistNames: (...a: unknown[]) => mockNomes(...a),
}));

const aviso = (over: Partial<NotificationItem>): NotificationItem => ({
  id: 'n-0', user_id: 'u-1', type: 'info', title: 'Aviso', read: false,
  created_at: '2026-03-04T15:30:00.000Z', artist_id: 'a-1', ...over,
});

const montar = () => render(<Notificacoes />);

describe('notificações', () => {
  beforeEach(() => {
    mockListar.mockReset();
    mockLer.mockReset().mockResolvedValue(undefined);
    mockLerTudo.mockReset().mockResolvedValue(undefined);
    mockNomes.mockReset().mockResolvedValue({ 'a-1': 'Marina Sol', 'a-2': 'Coletivo Norte' });
    mockPush.mockClear();
  });

  it('agrupa por artista e conta os lembretes, como a web', async () => {
    mockListar.mockResolvedValue({
      items: [
        aviso({ id: 'n-1', title: 'Tarefa vence hoje' }),
        aviso({ id: 'n-2', title: 'Nova versão enviada' }),
        aviso({ id: 'n-3', title: 'Diagnóstico pronto', artist_id: 'a-2' }),
      ],
      hasMore: false,
    });
    const tela = await montar();

    await waitFor(() => expect(tela.getByText('Marina Sol')).toBeTruthy());
    expect(tela.getByText('2 lembretes')).toBeTruthy();
    expect(tela.getByText('Coletivo Norte')).toBeTruthy();
    expect(tela.getByText('1 lembrete')).toBeTruthy();
  });

  // A web usa `DD/MM/YYYY HH:mm`. Um "há 2 horas" aqui pareceria outro produto.
  it('formata a data como a web', async () => {
    mockListar.mockResolvedValue({ items: [aviso({ id: 'n-1' })], hasMore: false });
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('04/03/2026 12:30')).toBeTruthy());
  });

  // "NOVO", em maiusculas: na web e uma palavra roxa ao lado do aviso, e nao um selo azul.
  it('marca a não lida com o NOVO, e a lida sem nada', async () => {
    mockListar.mockResolvedValue({
      items: [aviso({ id: 'n-1', title: 'Fresca' }), aviso({ id: 'n-2', title: 'Velha', read: true })],
      hasMore: false,
    });
    const tela = await montar();

    await waitFor(() => expect(tela.getByText('Fresca')).toBeTruthy());
    expect(tela.getAllByText('NOVO')).toHaveLength(1);
    expect(tela.getByLabelText('Fresca, não lida')).toBeTruthy();
    expect(tela.getByLabelText('Velha')).toBeTruthy();
  });

  it('abrir marca como lida e leva ao perfil da notificação', async () => {
    mockListar.mockResolvedValue({ items: [aviso({ id: 'n-1', title: 'Fresca' })], hasMore: false });
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Fresca')).toBeTruthy());

    await userEvent.setup().press(tela.getByLabelText('Fresca, não lida'));

    expect(mockLer).toHaveBeenCalledWith('n-1');
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/artista/[id]', params: { id: 'a-1' } });
  });

  // Os nomes vêm numa consulta só: uma por item seria N requisições para desenhar cabeçalho.
  it('busca os nomes dos perfis de uma vez, sem repetir id', async () => {
    mockListar.mockResolvedValue({
      items: [aviso({ id: 'n-1' }), aviso({ id: 'n-2' }), aviso({ id: 'n-3', artist_id: 'a-2' })],
      hasMore: false,
    });
    await montar();

    await waitFor(() => expect(mockNomes).toHaveBeenCalledTimes(1));
    expect(mockNomes).toHaveBeenCalledWith(['a-1', 'a-2']);
  });

  it('caixa vazia explica o que chega aqui', async () => {
    mockListar.mockResolvedValue({ items: [], hasMore: false });
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Nada por aqui')).toBeTruthy());
  });

  it('erro de carga diz indisponibilidade, não ausência', async () => {
    mockListar.mockRejectedValue(new Error('sem rede'));
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Notificações indisponíveis')).toBeTruthy());
    expect(tela.queryByText('Nada por aqui')).toBeNull();
  });
});
