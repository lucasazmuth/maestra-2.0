import { render, userEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { CHAMADA_DO_PLANEJAMENTO, LEVAR_O_DIAGNOSTICO } from '@maestra/core/constants/realNarrative';
import { store } from '@maestra/core/store/store';

import Desbloquear from '../desbloquear/[id]';
import { comDiagnostico, semDiagnostico } from './fixtures';

// O desbloqueio do perfil, no app.
//
// A cobrança NÃO acontece aqui: a 3.1.1 alcança o desbloqueio do mesmo jeito que a assinatura,
// então o app mostra o que o perfil libera e manda para o checkout da web pelo repasse
// autenticado. O checkout continua no arquivo, atrás de `VENDE_DESBLOQUEIO_NO_APP`, para a web e
// o Android — e é por isso que o teste também exige que a chave esteja DESLIGADA: religá-la é um
// ato deliberado, não um efeito colateral.
//
// O resgate de código continua sendo daqui, porque não é compra: é uma cortesia que libera o
// perfil sem cobrança.

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

const mockCheckout = jest.fn();
jest.mock('@/nucleo/loja', () => ({
  ...jest.requireActual('@/nucleo/loja'),
  irParaOCheckout: (...a: unknown[]) => mockCheckout(...a),
}));

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

const semearPerfis = (perfis: unknown[]) =>
  store.dispatch({ type: 'artists/fetchArtists/fulfilled', payload: perfis });

/** O perfil pendente que esta tela existe para liberar. */
const pendente = { ...semDiagnostico, id: 'a-2', name: 'AZMUTH BEATS', is_locked: true };
/** O mesmo perfil, com o diagnóstico salvo: é o que faz a etapa do relatório existir. */
const pendenteComReal = { ...comDiagnostico, id: 'a-2', name: 'AZMUTH BEATS', is_locked: true };

describe('desbloqueio do perfil', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCompra.status = 'received';
    semearPerfis([pendente]);
    mockInvocar.mockResolvedValue({ data: {}, error: null });
  });

  // Quem ABRE um perfil bloqueado cai aqui, e não no diagnóstico: não houve convite nenhum
  // antes, e é esta tela que explica o que o desbloqueio libera.
  it('cobra o desbloqueio aqui dentro, com o formulário completo', async () => {
    const tela = await montar();

    expect(await tela.findByText(/Comece hoje o planejamento de AZMUTH BEATS/)).toBeTruthy();
    expect(tela.getByText('Plano de ação com metas e cronograma')).toBeTruthy();

    // O checkout de verdade: CPF, os dois meios e o preço.
    expect(tela.getByLabelText('CPF ou CNPJ')).toBeTruthy();
    expect(tela.getByLabelText('Cartão de crédito')).toBeTruthy();
    expect(tela.getByLabelText('PIX')).toBeTruthy();
    expect(tela.getAllByText('R$ 199,90').length).toBeGreaterThan(0);
  });

  // O pagamento único acontece AQUI: nenhum caminho desta tela sai para o navegador.
  it('não manda ninguém para o checkout da web', async () => {
    const tela = await montar();
    await tela.findByText(/Comece hoje o planejamento de AZMUTH BEATS/);

    expect(mockCheckout).not.toHaveBeenCalled();
    expect(tela.queryByLabelText('Liberar este perfil')).toBeNull();
  });

  // A etapa do relatório terminava sem saída: a pessoa lia o diagnóstico inteiro e o texto
  // simplesmente acabava, sem dizer qual era o próximo passo nem como dá-lo.
  describe('a etapa do diagnóstico', () => {
    const voltarAoDiagnostico = async () => {
      semearPerfis([pendenteComReal]);
      const usuario = userEvent.setup();
      const tela = await montar();
      await usuario.press(await tela.findByLabelText('Voltar ao diagnóstico'));
      return { tela, usuario };
    };

    // A entrega tem nome próprio. O header dizia só "Diagnóstico", que é o rótulo curto que a
    // web usa por falta de espaço — aqui cabe o nome do produto.
    it('o header diz o nome completo da entrega', async () => {
      const { tela } = await voltarAoDiagnostico();

      expect(tela.getByLabelText('Etapa 2 de 3: Diagnóstico REAL')).toBeTruthy();
    });

    it('termina convidando para o planejamento, com a copy do núcleo', async () => {
      const { tela } = await voltarAoDiagnostico();

      expect(tela.getByText(CHAMADA_DO_PLANEJAMENTO.titulo)).toBeTruthy();
      expect(tela.getByText(CHAMADA_DO_PLANEJAMENTO.apoio)).toBeTruthy();
      // O que tira o medo de clicar: seguir adiante não perde o diagnóstico.
      expect(tela.getByText(CHAMADA_DO_PLANEJAMENTO.nota)).toBeTruthy();
    });

    // A ordem importa: quem acabou de ler o retrato da carreira decide o próximo passo
    // primeiro, e só depois pensa em guardar o documento. Ler na ordem inversa é despedir-se
    // antes de convidar. Na web os dois vivem no mesmo bloco, com o convite em cima.
    it('o convite vem ANTES de "leve seu diagnóstico"', async () => {
      const { tela } = await voltarAoDiagnostico();
      const arvore = JSON.stringify(tela.toJSON());

      const convite = arvore.indexOf(CHAMADA_DO_PLANEJAMENTO.titulo);
      const levar = arvore.indexOf(LEVAR_O_DIAGNOSTICO.titulo);

      expect(convite).toBeGreaterThan(-1);
      expect(levar).toBeGreaterThan(-1);
      expect(convite).toBeLessThan(levar);
    });

    // Com a cobrança dentro do app, o convite leva ao FORMULÁRIO — não há para onde pular:
    // é essa tela que cobra. O atalho para o navegador só valia quando a compra acontecia lá.
    it('o convite leva ao formulário de pagamento, aqui mesmo', async () => {
      const { tela, usuario } = await voltarAoDiagnostico();

      await usuario.press(tela.getByLabelText(CHAMADA_DO_PLANEJAMENTO.botao));

      expect(await tela.findByLabelText('CPF ou CNPJ')).toBeTruthy();
      expect(mockCheckout).not.toHaveBeenCalled();
    });
  });

  // O passe libera o perfil sem cobrança nenhuma, e a tela de sucesso não pode falar em
  // "pagamento" para quem foi presenteado.
  it('um código de acesso válido libera o perfil sem cobrar', async () => {
    mockInvocar.mockImplementation((fn: string) => (fn === 'redeem-access-pass'
      ? Promise.resolve({ data: { ok: true }, error: null })
      : Promise.resolve({ data: {}, error: null })));

    const usuario = userEvent.setup();
    const tela = await montar();

    // Um campo só para cupom e passe: quem tem um código na mão não precisa saber qual dos
    // dois é. O rótulo é o do cupom porque esse é o caso comum.
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

  // Duas compras, dois caminhos. Trocar qualquer um dos dois é decisão de produto com a
  // diretriz relida na mão — nunca efeito colateral de outra mudança.
  //
  // ⚠️ E OS DOIS DEIXARAM DE ANDAR JUNTOS na submissão à App Store: a assinatura parou de sair do
  // app (`'nenhuma'`, e as telas que a vendiam vão para `/planos`), e o pagamento único continua
  // cobrado aqui dentro, com a exposição à 3.1.1 escrita em `nucleo/loja.ts` e assumida. Este
  // caso existe para que nenhuma das duas se mexa por acidente.
  it('o pagamento único é cobrado no app; a assinatura não é vendida aqui', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { VENDE_DESBLOQUEIO_NO_APP, MODO_DE_VENDA } = jest.requireActual('@/nucleo/loja');

    expect(VENDE_DESBLOQUEIO_NO_APP).toBe(true);
    expect(MODO_DE_VENDA).toBe('nenhuma');
  });
});
