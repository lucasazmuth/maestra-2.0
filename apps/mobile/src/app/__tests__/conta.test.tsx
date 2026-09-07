import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { render, userEvent, waitFor } from '@testing-library/react-native';
import { Alert, Share } from 'react-native';

import Conta from '../conta';

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  Redirect: () => null,
  router: { push: (...a: unknown[]) => mockPush(...a), back: jest.fn(), replace: jest.fn() },
  useRouter: () => ({ back: jest.fn(), replace: mockReplace }),
}));

// O seletor de arquivos e o player sao modulos NATIVOS: importa-los aqui derruba a suite antes
// de qualquer teste rodar. O que a Conta faz com eles (escolher a foto e enviar) e o que os
// testes abaixo verificam pelo mock.
const mockEscolherImagem = jest.fn();
const mockEnviar = jest.fn();
jest.mock('@/nucleo/arquivos', () => ({
  escolherImagem: () => mockEscolherImagem(),
  enviarEscolhido: (...a: unknown[]) => mockEnviar(...a),
  enviarParaOCatalogo: jest.fn(),
  escolherAudio: jest.fn(),
  duracaoDoAudio: jest.fn(),
}));

jest.mock('@/nucleo/sessao', () => ({
  useSessao: () => ({
    sessao: {
      user: {
        id: 'u-1',
        email: 'artista@exemplo.com',
        user_metadata: { full_name: 'Lucas Andrade' },
      },
    },
    carregando: false,
  }),
}));

// O espião da folha de partilha nasce no `beforeEach`: o `restoreAllMocks` do `afterEach` o
// desfaria, e a partir do segundo teste ele não registraria mais nada.
let mockPartilhar: jest.SpyInstance;

// O arquivo temporario da exportacao: aqui interessa QUE arquivo o app oferece, nao o disco.
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'file:///cache' },
  File: class {
    uri: string;
    exists = false;
    constructor(_pasta: unknown, nome?: string) { this.uri = `file:///cache/${nome ?? ''}`; }
    create() {}
    write() {}
    delete() {}
  },
}));

const mockSair = jest.fn();
jest.mock('@/nucleo/entrar', () => ({ sair: () => mockSair() }));

const mockInsert = jest.fn();
const mockAtualizarUsuario = jest.fn();
jest.mock('@maestra/core/lib/supabase', () => ({
  supabase: {
    from: () => ({ insert: (linha: unknown) => mockInsert(linha) }),
    auth: { updateUser: (dados: unknown) => mockAtualizarUsuario(dados) },
    functions: { invoke: () => Promise.resolve({ data: {}, error: null }) },
  },
}));

jest.mock('@maestra/core/services/db/platformReviews', () => ({
  getMyPlatformReview: () => Promise.resolve(null),
  savePlatformReview: jest.fn(),
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
  // Tela folha: um botão só, o de voltar, no mesmo círculo branco do sino. Aqui já viveu um
  // "‹ Perfis" em texto solto, que era o único lugar do app com aquele desenho.
  it('tem o cabeçalho de voltar, e nada além dele', async () => {
    const tela = await montar();

    expect(tela.getByLabelText('Voltar')).toBeTruthy();
    expect(tela.queryByText(/‹\s*Perfis/)).toBeNull();
    // Nem a marca nem o menu: quem chegou aqui veio de um lugar e quer voltar para ele.
    expect(tela.queryByLabelText('Maestra. Ir para os perfis')).toBeNull();
    expect(tela.queryByLabelText('Menu do sistema')).toBeNull();
  });

  beforeEach(() => {
    mockStatus = 'none';
    mockInsert.mockReset().mockResolvedValue({ error: null });
    mockCancelar.mockReset().mockResolvedValue(undefined);
    mockSair.mockReset().mockResolvedValue(undefined);
    mockReplace.mockClear();
    mockPush.mockClear();
    mockEscolherImagem.mockReset();
    mockEnviar.mockReset();
    mockAtualizarUsuario.mockReset();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockPartilhar = jest.spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction' } as never);
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

  // O perfil era so leitura: o nome e a foto so se mudavam na web. Sao os dois campos que
  // aparecem em todo lugar do produto — o cabecalho, os comentarios, a lista de responsaveis.
  it('edita o nome do perfil e grava', async () => {
    mockAtualizarUsuario.mockResolvedValue({ error: null });
    const usuario = userEvent.setup();
    const tela = await montar();

    expect(tela.getByText('Lucas Andrade')).toBeTruthy();
    await usuario.press(tela.getByLabelText('Editar perfil'));

    const campo = await tela.findByLabelText('Seu nome');
    await usuario.clear(campo);
    await usuario.type(campo, 'Lucas A.');
    await usuario.press(tela.getByLabelText('Salvar perfil'));

    await waitFor(() => expect(mockAtualizarUsuario).toHaveBeenCalled());
    expect(mockAtualizarUsuario.mock.calls[0][0].data.full_name).toBe('Lucas A.');
  });

  // A foto sobe pro balde `avatars` na ESCOLHA; so a URL fica guardada ate salvar. E o mesmo
  // desenho da web, e e o que permite desistir sem deixar o perfil pela metade.
  it('a foto sobe na escolha, e so entra no perfil ao salvar', async () => {
    mockEscolherImagem.mockResolvedValue({ nome: 'eu.jpg', uri: 'file:///eu.jpg', tipo: 'image/jpeg' });
    mockEnviar.mockResolvedValue({ url: 'https://exemplo.invalid/eu.jpg', path: 'u-1/eu.jpg', name: 'eu.jpg' });
    mockAtualizarUsuario.mockResolvedValue({ error: null });
    const usuario = userEvent.setup();
    const tela = await montar();

    await usuario.press(tela.getByLabelText('Editar perfil'));
    await usuario.press(await tela.findByLabelText('Trocar a foto'));

    await waitFor(() => expect(mockEnviar).toHaveBeenCalled());
    // Vai pro balde de AVATARES, na pasta do proprio usuario — nao pro do catalogo.
    expect(mockEnviar.mock.calls[0][0]).toBe('avatars');
    expect(mockEnviar.mock.calls[0][1]).toBe('u-1');
    // E ainda NAO gravou no perfil: isso e do "Salvar".
    expect(mockAtualizarUsuario).not.toHaveBeenCalled();

    await usuario.press(tela.getByLabelText('Salvar perfil'));
    await waitFor(() => expect(mockAtualizarUsuario).toHaveBeenCalled());
    expect(mockAtualizarUsuario.mock.calls[0][0].data.avatar_url)
      .toBe('https://exemplo.invalid/eu.jpg');
  });

  // A secao de notificacoes existe porque a web tem, e o texto e o dela. O interruptor NAO
  // aparece: o push do app ainda nao esta configurado, e um botao que nao liga nada seria pior
  // do que a ausencia dele. A web faz o mesmo quando o navegador nao suporta.
  it('mostra a seção de notificações e explica por que não há interruptor', async () => {
    const tela = await montar();
    expect(tela.getByText('Notificações no dispositivo')).toBeTruthy();
    expect(tela.getByText(/Os avisos no aparelho ainda não estão disponíveis/)).toBeTruthy();
  });

  it('leva ao histórico de pagamentos', async () => {
    const usuario = userEvent.setup();
    const tela = await montar();
    await usuario.press(tela.getByLabelText('Histórico de pagamentos'));
    expect(mockPush).toHaveBeenCalledWith('/pagamentos');
  });

  // "Baixar meus dados" era um link pra web. E o mesmo `account-data-export` da web; o que muda
  // e o destino — arquivo mais folha de partilha, que e o download do celular.
  it('exporta os dados sem sair do app', async () => {
    const usuario = userEvent.setup();
    const tela = await montar();
    await usuario.press(tela.getByLabelText('Baixar meus dados'));
    await waitFor(() => expect(mockPartilhar).toHaveBeenCalled());
    expect(String(mockPartilhar.mock.calls[0][0].url)).toContain('maestra-meus-dados-');
  });
});

// A barra do sistema lê a margem segura (o menu dela abre abaixo do cabeçalho). Fora de um
// aparelho, o provedor precisa das medidas na mão — senão o hook levanta.
const MEDIDAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montar = () => render(
  <SafeAreaProvider initialMetrics={MEDIDAS}><Conta /></SafeAreaProvider>,
);
