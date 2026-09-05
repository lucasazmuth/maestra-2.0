import { render, userEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { store } from '@maestra/core/store/store';

import Desbloquear from '../desbloquear/[id]';
import { semDiagnostico } from './fixtures';

// O checkout do desbloqueio.
//
// O que este teste protege é o CONTRATO com a Asaas: o que sai daqui em `asaas-create-artist-
// charge` é o que a cobrança vai ser. Um `billingType` errado cobra pelo meio errado; um CPF que
// passa vazio volta 400 depois de a pessoa ter digitado o cartão inteiro.

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    replace: (...a: unknown[]) => mockReplace(...a),
    push: (...a: unknown[]) => mockPush(...a),
  },
  Redirect: () => null,
  useLocalSearchParams: () => ({ id: 'a-2' }),
}));

jest.mock('@/nucleo/sessao', () => ({
  useSessao: () => ({
    sessao: { user: { id: 'u-1', email: 'artista@exemplo.com', user_metadata: { full_name: 'Lucas' } } },
    carregando: false,
  }),
}));

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve()) }));

const mockInvocar = jest.fn();
/** O `from` responde por tabela: a config do plano e o estado da compra. */
const mockCompra = { status: 'received', artist_id: 'a-2' };
jest.mock('@maestra/core/lib/supabase', () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => mockInvocar(...a) },
    from: (tabela: string) => {
      if (tabela === 'asaas_plan_config') {
        return {
          select: () => ({ eq: () => ({ limit: () => ({
            maybeSingle: () => Promise.resolve({
              data: {
                name: 'Maestra PRO', monthly_value: 49.9, annual_value: null,
                annual_enabled: false, profile_unlock_value: 199.9, pix_automatic_enabled: false,
              },
              error: null,
            }),
          }) }) }),
        };
      }
      return {
        select: () => ({ eq: () => ({
          maybeSingle: () => Promise.resolve({ data: mockCompra, error: null }),
        }) }),
      };
    },
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }),
    },
  },
}));

const MEDIDAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montar = () => render(
  <SafeAreaProvider initialMetrics={MEDIDAS}>
    <Provider store={store}><Desbloquear /></Provider>
  </SafeAreaProvider>,
);

type Tela = Awaited<ReturnType<typeof montar>>;

const semearPerfis = (perfis: unknown[]) =>
  store.dispatch({ type: 'artists/fetchArtists/fulfilled', payload: perfis });

/** O perfil pendente que esta tela existe para liberar. */
const pendente = { ...semDiagnostico, id: 'a-2', name: 'AZMUTH BEATS', is_locked: true };

const preencherCpf = async (usuario: ReturnType<typeof userEvent.setup>, tela: Tela) => {
  await usuario.type(tela.getByLabelText('CPF ou CNPJ'), '39053344705');
};

describe('desbloqueio do perfil', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCompra.status = 'received';
    semearPerfis([pendente]);
    mockInvocar.mockResolvedValue({ data: {}, error: null });
  });

  it('mostra o que está sendo comprado, o preço e o que ele libera', async () => {
    const tela = await montar();

    expect(await tela.findByText(/Comece hoje o planejamento de AZMUTH BEATS/)).toBeTruthy();
    expect(tela.getByText('artista@exemplo.com')).toBeTruthy();
    expect(tela.getByText('Planejamento — AZMUTH BEATS')).toBeTruthy();
    expect(tela.getAllByText('Acesso vitalício ao perfil').length).toBe(2);
    expect(tela.getByText('Plano de ação com metas e cronograma')).toBeTruthy();
    // O preço vem da config (`profile_unlock_value`), não de uma constante da tela.
    await waitFor(() => expect(tela.getAllByText('R$ 199,90').length).toBeGreaterThan(0));
  });

  // O erro mais comum do PIX: a pessoa toca em pagar sem o CPF. O botão continua tocável de
  // propósito — é o toque que revela o que falta.
  it('sem CPF, o toque em pagar diz o que falta e não cobra nada', async () => {
    const usuario = userEvent.setup();
    const tela = await montar();

    await usuario.press(await tela.findByLabelText(/Gerar código PIX/));

    // A mensagem aparece NO campo, uma vez — e não também no botão.
    expect(tela.getAllByText('CPF ou CNPJ é obrigatório')).toHaveLength(1);
    expect(mockInvocar).not.toHaveBeenCalledWith('asaas-create-artist-charge', expect.anything());
  });

  it('no PIX, cria a cobrança e mostra o QR Code', async () => {
    // A compra segue pendente: o PIX só confirma quando o pagamento cair.
    mockCompra.status = 'pending';
    mockInvocar.mockImplementation((fn: string) => {
      if (fn === 'asaas-create-customer') {
        return Promise.resolve({ data: { customerId: 'cus_1' }, error: null });
      }
      if (fn === 'asaas-create-artist-charge') {
        return Promise.resolve({
          data: {
            purchaseId: 'pur_1',
            status: 'pending',
            pixData: { qrCode: 'QUJD', copyPaste: '00020126PIX' },
          },
          error: null,
        });
      }
      return Promise.resolve({ data: {}, error: null });
    });

    const usuario = userEvent.setup();
    const tela = await montar();
    await preencherCpf(usuario, tela);
    await usuario.press(tela.getByLabelText(/Gerar código PIX/));

    expect(await tela.findByLabelText('QR Code do PIX')).toBeTruthy();
    expect(tela.getByText('Aguardando confirmação…')).toBeTruthy();

    const cobranca = mockInvocar.mock.calls.find((c) => c[0] === 'asaas-create-artist-charge');
    expect(cobranca?.[1].body).toMatchObject({
      artistId: 'a-2', customerId: 'cus_1', billingType: 'PIX',
    });
    // PIX é sempre à vista: parcelamento aqui vira cobrança recusada.
    expect(cobranca?.[1].body.installmentCount).toBeUndefined();
  });

  it('no cartão, manda os dados do cartão e o parcelamento escolhido', async () => {
    mockInvocar.mockImplementation((fn: string) => {
      if (fn === 'asaas-create-customer') {
        return Promise.resolve({ data: { customerId: 'cus_1' }, error: null });
      }
      if (fn === 'asaas-create-artist-charge') {
        return Promise.resolve({ data: { purchaseId: 'pur_2', status: 'received' }, error: null });
      }
      return Promise.resolve({ data: {}, error: null });
    });

    const usuario = userEvent.setup();
    const tela = await montar();

    await usuario.press(await tela.findByLabelText('Cartão de crédito'));
    await preencherCpf(usuario, tela);
    await usuario.type(tela.getByLabelText('Número do cartão'), '5162306219378829');
    await usuario.type(tela.getByLabelText('Nome impresso no cartão'), 'LUCAS ANDRADE');
    await usuario.type(tela.getByLabelText('Validade'), '1230');
    await usuario.type(tela.getByLabelText('CVV'), '318');
    await usuario.type(tela.getByLabelText('Celular'), '11999999999');
    await usuario.type(tela.getByLabelText('CEP'), '01310100');

    await usuario.press(tela.getByLabelText(/Concordar e pagar/));

    await waitFor(() => expect(
      mockInvocar.mock.calls.some((c) => c[0] === 'asaas-create-artist-charge'),
    ).toBe(true));
    const cobranca = mockInvocar.mock.calls.find((c) => c[0] === 'asaas-create-artist-charge');
    expect(cobranca?.[1].body).toMatchObject({
      billingType: 'CREDIT_CARD',
      installmentCount: 12,
      creditCard: { holderName: 'LUCAS ANDRADE', expiryMonth: '12', expiryYear: '2030', ccv: '318' },
    });

    // Cartão aprovado na hora vai direto para a tela de sucesso.
    expect(await tela.findByText('Pagamento confirmado!')).toBeTruthy();
  });

  // Um código pode ser cupom OU passe. O passe libera o perfil sem cobrança nenhuma, e a tela
  // de sucesso não pode falar em "pagamento" para quem foi presenteado.
  it('um Pass Access válido libera o perfil sem cobrar', async () => {
    mockInvocar.mockImplementation((fn: string) => (fn === 'redeem-access-pass'
      ? Promise.resolve({ data: { ok: true }, error: null })
      : Promise.resolve({ data: {}, error: null })));

    const usuario = userEvent.setup();
    const tela = await montar();

    await usuario.type(await tela.findByLabelText('Cupom de desconto'), 'PRESENTE');
    await usuario.press(tela.getByLabelText('Aplicar cupom'));

    expect(await tela.findByText('Pass Access confirmado!')).toBeTruthy();
    expect(mockInvocar).not.toHaveBeenCalledWith('asaas-create-artist-charge', expect.anything());
  });

  it('perfil já pago não tem o que desbloquear: abre o perfil', async () => {
    semearPerfis([{ ...pendente, is_locked: false }]);
    await montar();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/artista/[id]', params: { id: 'a-2' },
    }));
  });
});
