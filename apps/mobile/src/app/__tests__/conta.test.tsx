import { render, userEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import Conta from '../conta';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  Redirect: () => null,
  useRouter: () => ({ back: jest.fn(), replace: mockReplace }),
}));

jest.mock('@/nucleo/sessao', () => ({
  useSessao: () => ({
    sessao: { user: { id: 'u-1', email: 'artista@exemplo.com' } },
    carregando: false,
  }),
}));

const mockSair = jest.fn();
jest.mock('@/nucleo/entrar', () => ({ sair: () => mockSair() }));

const mockInsert = jest.fn();
jest.mock('@maestra/core/lib/supabase', () => ({
  supabase: { from: () => ({ insert: (linha: unknown) => mockInsert(linha) }) },
}));

let mockStatus = 'none';
const mockCancelar = jest.fn();
jest.mock('@maestra/core/store/slices/subscription', () => ({
  fetchSubscriptionStatus: () => ({ type: 'subscription/fetch' }),
  cancelSubscription: () => ({ type: 'subscription/cancel' }),
}));
jest.mock('@maestra/core/store/store', () => ({
  useAppSelector: (fn: (s: unknown) => unknown) => fn({ subscription: { status: mockStatus } }),
  useAppDispatch: () => (acao: { type: string }) => {
    if (acao.type === 'subscription/cancel') return { unwrap: () => mockCancelar() };
    return { unwrap: () => Promise.resolve() };
  },
}));

/** Aperta o botão destrutivo do Alert, que é onde a exclusão realmente começa. */
const confirmarNoAlerta = () => {
  const [, , botoes] = (Alert.alert as jest.Mock).mock.calls.at(-1)!;
  return (botoes as { style?: string; onPress?: () => void }[])
    .find((b) => b.style === 'destructive')!
    .onPress!();
};

describe('conta', () => {
  beforeEach(() => {
    mockStatus = 'none';
    mockInsert.mockReset().mockResolvedValue({ error: null });
    mockCancelar.mockReset().mockResolvedValue(undefined);
    mockSair.mockReset().mockResolvedValue(undefined);
    mockReplace.mockClear();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  // O texto importa tanto quanto o código: a tela não pode prometer um "apagado agora" que não
  // acontece, nem esconder que o prazo existe.
  it('diz que a exclusão tem prazo, em vez de prometer apagar na hora', async () => {
    const tela = await montar();
    expect(tela.getByText(/30 dias/)).toBeTruthy();
  });

  it('pede confirmação antes de qualquer coisa', async () => {
    const tela = await montar();
    await userEvent.setup().press(tela.getByLabelText('Excluir minha conta'));

    expect(Alert.alert).toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('confirmado, registra o pedido e encerra a sessão', async () => {
    const tela = await montar();
    await userEvent.setup().press(tela.getByLabelText('Excluir minha conta'));
    await confirmarNoAlerta();

    await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1));
    expect(mockInsert.mock.calls[0][0]).toMatchObject({ user_id: 'u-1', email: 'artista@exemplo.com' });
    expect(mockSair).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/entrar');
  });

  // Pedido de exclusão com cobrança viva seguiria cobrando uma conta que a pessoa pediu para
  // apagar. A assinatura sai ANTES.
  it('com assinatura, cancela antes de registrar o pedido', async () => {
    mockStatus = 'active';
    const tela = await montar();
    await userEvent.setup().press(tela.getByLabelText('Excluir minha conta'));
    await confirmarNoAlerta();

    await waitFor(() => expect(mockCancelar).toHaveBeenCalled());
    expect(mockInsert).toHaveBeenCalled();
  });

  it('se o cancelamento falha, NAO registra o pedido nem desloga', async () => {
    mockStatus = 'active';
    mockCancelar.mockRejectedValue(new Error('asaas fora'));
    const tela = await montar();
    await userEvent.setup().press(tela.getByLabelText('Excluir minha conta'));
    await confirmarNoAlerta();

    await waitFor(() => expect(tela.getByText(/Cancele a assinatura/)).toBeTruthy());
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockSair).not.toHaveBeenCalled();
  });
});

const montar = () => render(<Conta />);
