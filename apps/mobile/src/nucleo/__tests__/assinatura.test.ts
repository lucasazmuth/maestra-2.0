import { renderHook, waitFor } from '@testing-library/react-native';

import { useOfertaDoPro, useTomDoSelo } from '@/nucleo/assinatura';

// O que o cabeçalho diz sobre o plano, e quando cabe convidar a assinar.
//
// Dois casos justificam este arquivo sozinhos:
//
// · convidar a assinar quem JÁ assina, ou quem já pagou e espera a confirmação;
// · e o `pending` FANTASMA — uma linha de cobrança que nunca virou assinatura. Ela não tem id
//   de assinatura, e mostrar "Pendente" para ela prometeria um acesso que não está a caminho.

const mockDespachos: unknown[] = [];

type Assinatura = {
  status: string;
  initialized: boolean;
  asaasSubscriptionId: string | null;
  gracePeriodEndsAt: string | null;
};

let mockEstado: { subscription: Assinatura } = {
  subscription: {
    status: 'none', initialized: false, asaasSubscriptionId: null, gracePeriodEndsAt: null,
  },
};

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

const DIA = 24 * 60 * 60 * 1000;
const amanha = () => new Date(Date.now() + DIA).toISOString();
const ontem = () => new Date(Date.now() - DIA).toISOString();

const comEstado = (assinatura: Partial<Assinatura>) => {
  mockEstado = {
    subscription: {
      status: 'none',
      initialized: true,
      asaasSubscriptionId: null,
      gracePeriodEndsAt: null,
      ...assinatura,
    },
  };
};

const selo = (assinatura: Partial<Assinatura>) => {
  comEstado(assinatura);
  return renderHook(() => useTomDoSelo());
};

const oferta = (assinatura: Partial<Assinatura>) => {
  comEstado(assinatura);
  return renderHook(() => useOfertaDoPro());
};

beforeEach(() => { mockDespachos.length = 0; });

describe('o selo do plano', () => {
  it('diz PRO com a assinatura ativa', async () => {
    expect((await selo({ status: 'active' })).result.current).toBe('pro');
  });

  it('não diz nada para quem não paga', async () => {
    expect((await selo({ status: 'none' })).result.current).toBeNull();
  });

  // Um selo que pisca na tela de quem não assina é pior do que um selo que chega um instante
  // depois — e o padrão do status é `none`, então antes da resposta não se afirma nada.
  it('não diz nada enquanto a resposta do servidor não chegou', async () => {
    expect((await selo({ status: 'active', initialized: false })).result.current).toBeNull();
  });

  describe('pendente', () => {
    it('aparece com o pagamento em confirmação de uma assinatura de verdade', async () => {
      const { result } = await selo({ status: 'pending', asaasSubscriptionId: 'sub_1' });
      expect(result.current).toBe('pending');
    });

    // A linha `pending` SEM id de assinatura é uma cobrança que nunca virou assinatura. Dizer
    // "Pendente" para ela prometeria um acesso que não está a caminho.
    it('NÃO aparece para o `pending` fantasma, sem id de assinatura', async () => {
      const { result } = await selo({ status: 'pending', asaasSubscriptionId: null });
      expect(result.current).toBeNull();
    });

    it('aparece com a cobrança vencida DENTRO da tolerância', async () => {
      const { result } = await selo({ status: 'overdue', gracePeriodEndsAt: amanha() });
      expect(result.current).toBe('pending');
    });

    // Passado o prazo o acesso acabou: não há mais nada pendente, há uma assinatura vencida.
    it('some quando a tolerância termina', async () => {
      const { result } = await selo({ status: 'overdue', gracePeriodEndsAt: ontem() });
      expect(result.current).toBeNull();
    });

    it('some quando não há tolerância nenhuma registrada', async () => {
      const { result } = await selo({ status: 'overdue', gracePeriodEndsAt: null });
      expect(result.current).toBeNull();
    });
  });
});

describe('a oferta do PRO', () => {
  it('aparece para quem não paga', async () => {
    expect((await oferta({ status: 'none' })).result.current).toBe(true);
  });

  it('não aparece para quem já assina', async () => {
    expect((await oferta({ status: 'active' })).result.current).toBe(false);
  });

  // Continua aparecendo ao lado do selo "Pendente", e isso é de propósito: enquanto a
  // confirmação não chega a pessoa ainda não tem o PRO, e o caminho para resolver não pode
  // sumir justamente de quem está tentando pagar.
  it('aparece para quem está com o pagamento em confirmação', async () => {
    const { result } = await oferta({ status: 'pending', asaasSubscriptionId: 'sub_1' });
    expect(result.current).toBe(true);
  });

  it('também aparece com a cobrança vencida dentro da tolerância', async () => {
    const { result } = await oferta({ status: 'overdue', gracePeriodEndsAt: amanha() });
    expect(result.current).toBe(true);
  });

  it('não aparece enquanto a resposta do servidor não chegou', async () => {
    expect((await oferta({ status: 'none', initialized: false })).result.current).toBe(false);
  });
});

describe('a busca do status', () => {
  it('acontece quando ninguém buscou ainda', async () => {
    await selo({ initialized: false });
    await waitFor(() => expect(mockDespachos.length).toBeGreaterThan(0));
  });

  it('não se repete quando o status já veio', async () => {
    await selo({ initialized: true });
    expect(mockDespachos).toHaveLength(0);
  });
});
