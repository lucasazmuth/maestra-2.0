import { renderHook, waitFor } from '@testing-library/react-native';

import { useOfertaDoPro } from '@/nucleo/assinatura';

// Quando cabe oferecer o PRO.
//
// O caso que este arquivo existe para travar é o do ASSINANTE: convidar a assinar quem já
// assina é o defeito mais visível que o menu poderia ter. E o segundo, mais sorrateiro: com o
// status ainda em branco o padrão é `none`, então oferecer por padrão mostraria o convite a um
// assinante e o tiraria um segundo depois.

const mockDespachos: unknown[] = [];
let mockEstado = { subscription: { status: 'none', initialized: false } };

jest.mock('@maestra/core/constants/maestra', () => ({
  ...jest.requireActual('@maestra/core/constants/maestra'),
  PAYWALL_DISABLED: false,
}));

jest.mock('@maestra/core/store/slices/subscription', () => ({
  fetchSubscriptionStatus: () => ({ type: 'subscription/fetchStatus' }),
}));

jest.mock('@maestra/core/store/store', () => ({
  useAppDispatch: () => (acao: unknown) => { mockDespachos.push(acao); return acao; },
  useAppSelector: (seletor: (s: typeof mockEstado) => unknown) => seletor(mockEstado),
}));

const comEstado = (status: string, initialized: boolean) => {
  mockEstado = { subscription: { status, initialized } };
  return renderHook(() => useOfertaDoPro());
};

beforeEach(() => { mockDespachos.length = 0; });

describe('oferta do PRO', () => {
  it('não oferece a quem já assina', async () => {
    const { result } = await comEstado('active', true);
    expect(result.current).toBe(false);
  });

  it('oferece a quem não assina', async () => {
    const { result } = await comEstado('none', true);
    expect(result.current).toBe(true);
  });

  // O erro barato: aparecer um instante atrasado para quem não assina, em vez de piscar um
  // convite na cara de quem paga.
  it('não oferece enquanto a resposta do servidor não chegou', async () => {
    const { result } = await comEstado('none', false);
    expect(result.current).toBe(false);
  });

  it('busca o status quando ninguém buscou ainda', async () => {
    await comEstado('none', false);
    await waitFor(() => expect(mockDespachos).toHaveLength(1));
  });

  it('não busca de novo quando o status já veio', async () => {
    await comEstado('none', true);
    expect(mockDespachos).toHaveLength(0);
  });
});
