import { render, userEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';

import { store } from '@maestra/core/store/store';
import { IDADE_MINIMA } from '@maestra/core/utils/age';

import Cadastro from '../cadastro';

// O CADASTRO NATIVO.
//
// A conta nascia na web: o botão abria o navegador, e quem baixou o app para conhecer a Maestra
// terminava em outro aplicativo. O que este arquivo guarda são as REGRAS, que são as mesmas da
// web e não podem afrouxar num porto: a idade mínima, o aceite, o tamanho da senha e o caso do
// e-mail que já tem conta.

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  Redirect: () => null,
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

jest.mock('@/nucleo/sessao', () => ({ useSessao: () => ({ sessao: null, carregando: false }) }));

const mockSignUp = jest.fn();
const mockVerify = jest.fn();
jest.mock('@maestra/core/store/slices/auth', () => {
  const real = jest.requireActual('@maestra/core/store/slices/auth');
  return {
    ...real,
    authActions: {
      ...real.authActions,
      signUp: (a: unknown) => mockSignUp(a),
      verifySignupOtp: (a: unknown) => mockVerify(a),
      signOut: () => respondendo(true)(),
      resendSignupOtp: () => respondendo(true)(),
    },
  };
});

/**
 * Um thunk falso.
 *
 * A tela faz `dispatch(acao).unwrap()`, e é o `redux-thunk` que executa a ação e devolve o que
 * ela retorna — então o `unwrap` tem que estar no RESULTADO da ação, não na ação.
 */
const respondendo = (valor: unknown) => () => () =>
  Object.assign(Promise.resolve(valor), { unwrap: () => Promise.resolve(valor) });

const MEDIDAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montar = () => render(
  <Provider store={store}>
    <SafeAreaProvider initialMetrics={MEDIDAS}><Cadastro /></SafeAreaProvider>
  </Provider>,
);

/** Preenche tudo, com a data que o teste quiser. */
const preencher = async (tela: Awaited<ReturnType<typeof montar>>, nascimento: string) => {
  const usuario = userEvent.setup();
  await usuario.type(tela.getByLabelText('Nome'), 'Lucas');
  await usuario.type(tela.getByLabelText('E-mail'), 'lucas@exemplo.com');
  await usuario.type(tela.getByLabelText('Senha'), 'segredo123');
  await usuario.type(tela.getByLabelText('Data de nascimento'), nascimento);
  return usuario;
};

const maiorDeIdade = `01011990`;
const menorDeIdade = `0101${new Date().getFullYear() - 10}`;

beforeEach(() => {
  mockReplace.mockClear();
  mockSignUp.mockReset();
  mockVerify.mockReset();
});

describe('cadastro', () => {
  it('recusa quem não tem a idade mínima, e diz qual é', async () => {
    const tela = await montar();
    const usuario = await preencher(tela, menorDeIdade);
    await usuario.press(tela.getByText(/Li e aceito/));
    await usuario.press(tela.getByLabelText('Criar conta'));

    expect(tela.getByText(new RegExp(`maiores de ${IDADE_MINIMA} anos`))).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('não cria conta sem o aceite dos termos', async () => {
    const tela = await montar();
    const usuario = await preencher(tela, maiorDeIdade);
    await usuario.press(tela.getByLabelText('Criar conta'));

    expect(tela.getByText(/aceitar os Termos/)).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('exige senha de ao menos seis caracteres', async () => {
    const tela = await montar();
    const usuario = userEvent.setup();
    await usuario.type(tela.getByLabelText('Nome'), 'Lucas');
    await usuario.type(tela.getByLabelText('E-mail'), 'lucas@exemplo.com');
    await usuario.type(tela.getByLabelText('Senha'), '123');
    await usuario.press(tela.getByLabelText('Criar conta'));

    expect(tela.getByText(/ao menos 6 caracteres/)).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('com tudo certo, pede o código do e-mail', async () => {
    mockSignUp.mockImplementation(respondendo({ user: { identities: [{}] } }));
    const tela = await montar();
    const usuario = await preencher(tela, maiorDeIdade);
    await usuario.press(tela.getByText(/Li e aceito/));
    await usuario.press(tela.getByLabelText('Criar conta'));

    await waitFor(() => expect(tela.getByLabelText('Código de confirmação')).toBeTruthy());
    expect(tela.getByText(/lucas@exemplo.com/)).toBeTruthy();
  });

  // Anti-enumeração do Supabase: com e-mail já cadastrado o `signUp` "passa", devolve um usuário
  // SEM identidades e não manda código nenhum. Sem esta conferência, a tela pediria um código
  // que nunca chegaria.
  it('e-mail que já tem conta não vira um código que nunca chega', async () => {
    mockSignUp.mockImplementation(respondendo({ user: { identities: [] } }));
    const tela = await montar();
    const usuario = await preencher(tela, maiorDeIdade);
    await usuario.press(tela.getByText(/Li e aceito/));
    await usuario.press(tela.getByLabelText('Criar conta'));

    await waitFor(() => expect(tela.getByText(/já tem uma conta/)).toBeTruthy());
    expect(tela.queryByLabelText('Código de confirmação')).toBeNull();
  });

  // Conta nova não tem perfil: o próximo passo é criar o primeiro, que é onde o diagnóstico
  // gratuito acontece. É a mesma decisão que a `/welcome` da web toma.
  // Não vai direto para a criação do perfil: quem decide o destino é a tela de boas-vindas, que
  // é a mesma decisão da `/welcome` da web — quem foi convidado para a equipe de alguém não tem
  // perfil nenhum e não veio criar um.
  it('confirmado o código, segue para as boas-vindas', async () => {
    mockSignUp.mockImplementation(respondendo({ user: { identities: [{}] } }));
    mockVerify.mockImplementation(respondendo({ session: {} }));
    const tela = await montar();
    const usuario = await preencher(tela, maiorDeIdade);
    await usuario.press(tela.getByText(/Li e aceito/));
    await usuario.press(tela.getByLabelText('Criar conta'));
    await waitFor(() => expect(tela.getByLabelText('Código de confirmação')).toBeTruthy());

    await usuario.type(tela.getByLabelText('Código de confirmação'), '123456');

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/bem-vindo'));
  });
});
