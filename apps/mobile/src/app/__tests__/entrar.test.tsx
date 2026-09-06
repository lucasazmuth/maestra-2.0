import { render, userEvent, waitFor } from '@testing-library/react-native';

import Entrar from '../entrar';

const mockRedirect = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  Redirect: (props: { href: string }) => {
    mockRedirect(props.href);
    return null;
  },
  useRouter: () => ({ push: mockPush }),
}));

let mockSessao: unknown = null;
jest.mock('@/nucleo/sessao', () => ({
  useSessao: () => ({ sessao: mockSessao, carregando: false }),
}));

const mockEmail = jest.fn();
jest.mock('@/nucleo/entrar', () => ({
  appleDisponivel: () => Promise.resolve(false),
  entrarComApple: jest.fn(),
  entrarComGoogle: jest.fn(),
  entrarComEmail: (...a: unknown[]) => mockEmail(...a),
}));

const montar = () => render(<Entrar />);

describe('tela de entrada', () => {
  beforeEach(() => {
    mockSessao = null;
    mockRedirect.mockClear();
    mockEmail.mockReset().mockResolvedValue(undefined);
  });

  it('sem sessão, mostra o formulário', async () => {
    const tela = await montar();
    expect(tela.getByPlaceholderText('E-mail')).toBeTruthy();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  // O bug que motivou este teste: a tela NÃO tinha navegação nenhuma. O login dava certo, a
  // sessão era criada, e a tela ficava parada — sem erro e sem carregando. Só entrava quem
  // reiniciava o app.
  it('com sessão, sai da tela em vez de ficar parada', async () => {
    mockSessao = { user: { id: 'u-1', email: 'a@b.c' } };
    await montar();
    expect(mockRedirect).toHaveBeenCalledWith('/perfis');
  });

  it('credencial errada mostra o motivo, e não silêncio', async () => {
    mockEmail.mockRejectedValue(new Error('E-mail ou senha incorretos.'));
    const tela = await montar();
    const usuario = userEvent.setup();

    await usuario.type(tela.getByPlaceholderText('E-mail'), 'a@b.c');
    await usuario.type(tela.getByPlaceholderText('Senha'), 'errada');
    await usuario.press(tela.getByText('Entrar'));

    await waitFor(() => expect(tela.getByText('E-mail ou senha incorretos.')).toBeTruthy());
  });

  it('não deixa entrar com campo vazio', async () => {
    const tela = await montar();
    await userEvent.setup().press(tela.getByText('Entrar'));
    expect(mockEmail).not.toHaveBeenCalled();
  });
});
