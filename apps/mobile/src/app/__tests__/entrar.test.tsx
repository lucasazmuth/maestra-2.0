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

  // ⚠️ ESTA TELA NÃO DECIDE PARA ONDE SE VAI DEPOIS DO LOGIN, E A ASSERÇÃO É AO CONTRÁRIO.
  //
  // O bug de origem era a tela NÃO ter navegação nenhuma: o login dava certo, a sessão era
  // criada, e a tela ficava parada — sem erro e sem carregando. Só entrava quem reiniciava o
  // app. A correção de então foi um `<Redirect href="/perfis" />` aqui, e ela trouxe um bug
  // pior: um `<Redirect>` vale outra vez A CADA RENDER da tela que o contém, e este afirmava
  // `/perfis` enquanto o `PortaoDoConsentimento` afirmava `/consentimento` para quem ainda não
  // declarou idade. Um desfazia o outro, e o app inteiro travava — a tela desenhada com todos
  // os toques engolidos. Era o que acontecia a quem entrava pela Apple.
  //
  // A saída continua a ser obrigatória, e continua a ter teste: mudou de dono. Quem leva daqui
  // aos perfis é o `PortaoDaSessao`, num efeito que corre uma vez por mudança de rota — ver
  // "com sessão, tira de /entrar e leva aos perfis" em `nucleo/__tests__/PortaoDaSessao`.
  it('com sessão, não tenta navegar por conta própria', async () => {
    mockSessao = { user: { id: 'u-1', email: 'a@b.c' } };
    await montar();
    expect(mockRedirect).not.toHaveBeenCalled();
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
