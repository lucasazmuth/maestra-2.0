import { render, userEvent, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { Provider } from 'react-redux';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { CTX_API, QUIZ, REVENUE_SOURCES, TIPOS_DE_CONTRATANTE_QUIZ } from '@maestra/core/constants/quizDoDiagnostico';
import { store } from '@maestra/core/store/store';

import CriarArtista from '../criar-artista';

// A criação de perfil — o fluxo inteiro, do nome no Spotify ao diagnóstico.
//
// O que este teste protege não é o desenho, é o CONTRATO com a edge `artist-diagnostic`: ela é
// a mesma para a web e para o app, e lê `quizV4` com as chaves do roteiro do núcleo. Uma
// resposta gravada no formato errado (a matriz de imprensa é o caso: a web manda
// `{ tipo, porte }`, não `"tipo:porte"`) não quebra nada aqui — quebra o diagnóstico, depois,
// sem erro nenhum na tela.

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    replace: (...a: unknown[]) => mockReplace(...a),
    push: (...a: unknown[]) => mockPush(...a),
  },
  Redirect: () => null,
}));

jest.mock('@/nucleo/sessao', () => ({
  useSessao: () => ({ sessao: { user: { id: 'u-1' } }, carregando: false }),
}));

const mockBuscar = jest.fn();
jest.mock('@maestra/core/services/spotifyArtist', () => ({
  searchSpotifyArtists: (...a: unknown[]) => mockBuscar(...a),
}));

const mockPodeCriar = jest.fn();
jest.mock('@maestra/core/hooks/useCanCreateArtist', () => ({
  useCanCreateArtist: () => mockPodeCriar(),
}));

const mockInvocar = jest.fn();
const mockRpc = jest.fn();
jest.mock('@maestra/core/lib/supabase', () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => mockInvocar(...a) },
    rpc: (...a: unknown[]) => mockRpc(...a),
    from: () => ({
      select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
    }),
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
    <Provider store={store}><CriarArtista /></Provider>
  </SafeAreaProvider>,
);

const ARTISTA = { id: 'sp-1', name: 'AZMUTH BEATS', image: 'https://i.invalid/a.jpg', followers: 1234 };

/** Escolhe o artista no Spotify e para na transição. */
type Tela = Awaited<ReturnType<typeof montar>>;

const escolherOArtista = async (usuario: ReturnType<typeof userEvent.setup>, tela: Tela) => {
  await usuario.type(
    await tela.findByLabelText('Nome do artista ou link do Spotify'), 'azmuth',
  );
  await waitFor(() => expect(tela.queryByText('AZMUTH BEATS')).toBeTruthy(), { timeout: 3000 });
  await usuario.press(tela.getByLabelText('AZMUTH BEATS'));
};

/** Responde a pergunta que está na tela, conforme o tipo dela. */
const responderAPergunta = async (
  usuario: ReturnType<typeof userEvent.setup>,
  tela: Tela,
  pergunta: (typeof QUIZ)[number],
) => {
  if (pergunta.type === 'select') {
    await usuario.press(tela.getByLabelText(pergunta.options![0].label));
    return;
  }
  if (pergunta.type === 'matrix') {
    // Uma escolha por tipo: as pílulas são radio, e a primeira de cada linha é "Nunca".
    await usuario.press(tela.getAllByRole('radio')[1]);
  } else if (pergunta.type === 'revenue') {
    await usuario.type(tela.getByLabelText(REVENUE_SOURCES[0].label), '10');
    // Uma fonte marcada "não sei": é o caminho que o motor conta como zero e sinaliza (§4).
    await usuario.press(tela.getByLabelText(`Não sei: ${REVENUE_SOURCES[1].label}`));
  } else if (pergunta.type === 'cache') {
    await usuario.type(tela.getByLabelText(TIPOS_DE_CONTRATANTE_QUIZ[0].label), '3000');
  } else {
    await usuario.type(tela.getByLabelText(pergunta.q), '10');
  }
  await usuario.press(tela.getByLabelText('Continuar'));
};

/**
 * Responde o quiz inteiro, do jeito que uma pessoa responderia: espera a Maestra terminar de
 * falar, responde o que está na tela e segue até a análise começar.
 */
const responderOQuiz = async (usuario: ReturnType<typeof userEvent.setup>, tela: Tela) => {
  for (let volta = 0; volta < QUIZ.length + 2; volta += 1) {
    let atual: (typeof QUIZ)[number] | undefined;
    try {
      await waitFor(() => {
        atual = QUIZ.find((p) => tela.queryByText(p.q));
        expect(atual).toBeTruthy();
      }, { timeout: 2000 });
    } catch {
      return; // não há mais pergunta na tela: o quiz acabou
    }
    await responderAPergunta(usuario, tela, atual!);
  }
};

describe('criar perfil', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPodeCriar.mockReturnValue({
      canCreate: true, reason: null, pendingCount: 0, cooldownRemainingSeconds: 0,
      loading: false, error: null, retry: jest.fn(),
    });
    mockBuscar.mockResolvedValue([ARTISTA]);
    mockRpc.mockResolvedValue({ data: false });
    // Toda escolha de perfil dispara a consulta prévia (§3.1, passo 2). O padrão devolve vazio,
    // que é a rede de segurança: o quiz então pergunta os três campos de R.
    mockInvocar.mockImplementation((_fn: string, opts: any) => Promise.resolve(
      opts?.body?.preview
        ? { data: { preview: true, api: {} }, error: null }
        : { data: null, error: null },
    ));
    // A fala é escrita letra a letra; quem pediu menos movimento recebe a frase inteira, e é
    // esse caminho que o teste usa — senão cada pergunta custaria dois segundos de relógio.
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  });

  it('busca no Spotify e leva o artista escolhido para a transição', async () => {
    const usuario = userEvent.setup();
    const tela = await montar();

    expect(await tela.findByText(/Vamos criar um perfil de artista|Bora criar outro perfil/)).toBeTruthy();
    await escolherOArtista(usuario, tela);

    expect(await tela.findByLabelText('Começar diagnóstico')).toBeTruthy();
    expect(mockRpc).toHaveBeenCalledWith('check_self_duplicate', {
      p_user_id: 'u-1', p_spotify_id: 'sp-1',
    });
  });

  // O aviso existe porque a constraint do banco recusaria depois — e o "depois" seria no fim do
  // quiz, com treze perguntas respondidas à toa.
  it('avisa quando o perfil já existe nesta conta, e não avança', async () => {
    mockRpc.mockResolvedValue({ data: true });
    const usuario = userEvent.setup();
    const tela = await montar();

    await escolherOArtista(usuario, tela);

    expect(await tela.findByText(/Você já tem AZMUTH BEATS nos seus perfis/)).toBeTruthy();
    expect(tela.queryByLabelText('Começar diagnóstico')).toBeNull();
    // Escolher o duplicado limpa os resultados e mantém o termo digitado. O aviso de "não
    // achei" olha para essas duas coisas, e aparecia junto — dizendo o contrário do aviso de
    // cima, na mesma tela.
    expect(tela.queryByText(/Não achei esse artista pelo nome/)).toBeNull();
  });

  it('quem ainda não tem Spotify entra só com o nome artístico', async () => {
    const usuario = userEvent.setup();
    const tela = await montar();

    await usuario.press(
      await tela.findByLabelText('Ainda estou iniciando, não tenho perfil no Spotify'),
    );
    await usuario.type(await tela.findByLabelText('Seu nome artístico'), 'Bruna');
    await usuario.press(tela.getByLabelText('Continuar'));

    expect(await tela.findByText('Bruna')).toBeTruthy();
    expect(tela.getByLabelText('Começar diagnóstico')).toBeTruthy();
  });

  it('o quiz inteiro chega na edge com as chaves do roteiro', async () => {
    // Duas chamadas: a consulta prévia (§3.1, passo 2) e o diagnóstico. Aqui o preview volta vazio,
    // então as três perguntas de autodeclaração de R aparecem — é a rede de segurança do §3.1.6.
    mockInvocar.mockImplementation((_fn: string, opts: any) => Promise.resolve(
      opts?.body?.preview
        ? { data: { preview: true, api: {} }, error: null }
        : { data: { artistId: 'a-9', locked: true, realIndex: null, chartmetric: null }, error: null },
    ));
    const usuario = userEvent.setup();
    const tela = await montar();

    await escolherOArtista(usuario, tela);
    await usuario.press(tela.getByLabelText('Começar diagnóstico'));

    await responderOQuiz(usuario, tela);

    await waitFor(() => expect(mockInvocar).toHaveBeenCalledTimes(2));
    const [previewFn, previewOpts] = mockInvocar.mock.calls[0] as [string, { body: any }];
    expect(previewFn).toBe('artist-diagnostic');
    expect(previewOpts.body).toEqual({ preview: true, spotifyArtistId: 'sp-1' });
    const [nome, { body }] = mockInvocar.mock.calls[1] as [string, { body: any }];
    expect(nome).toBe('artist-diagnostic');
    expect(body.name).toBe('AZMUTH BEATS');
    expect(body.spotifyArtistId).toBe('sp-1');
    expect(body.spotify).toEqual({ followers: 1234, image: ARTISTA.image });

    // Toda pergunta que apareceu deixou resposta, e nenhuma chave inventada foi junto. O `_api`
    // é o contexto da consulta prévia, não uma resposta: a edge ignora, mas não pode surpreender.
    const chaves = Object.keys(body.quizV4).filter((c) => c !== CTX_API);
    expect(chaves.length).toBeGreaterThan(0);
    chaves.forEach((chave) => expect(QUIZ.map((p) => p.key)).toContain(chave));

    // A imprensa vai em objetos, não em "tipo:porte" — é o formato que o motor lê.
    const imprensa = body.quizV4[QUIZ.find((p) => p.type === 'matrix')!.key];
    if (imprensa) {
      expect(Array.isArray(imprensa)).toBe(true);
      expect(imprensa[0]).toEqual(expect.objectContaining({ tipo: expect.any(String), porte: expect.any(String) }));
    }

    // A receita carrega o "não sei" até o motor: virar zero aqui apagaria a diferença entre
    // "não recebi" e "não sei quanto recebi", que é justamente o que o relatório devolve.
    expect(body.quizV4.revenueSources[REVENUE_SOURCES[1].key]).toBe('nao_sei');
    // Base ANUAL: o cachê vem por tipo de contratante, não mais um número só.
    expect(body.quizV4.cacheByType[TIPOS_DE_CONTRATANTE_QUIZ[0].key]).toBe(3000);
  });

  // Um perfil que já existe e já foi pago não repete o diagnóstico: entra direto.
  it('perfil reaproveitado e pago vai direto para o artista', async () => {
    mockInvocar.mockImplementation((_fn: string, opts: any) => Promise.resolve(
      opts?.body?.preview
        ? { data: { preview: true, api: {} }, error: null }
        : { data: { artistId: 'a-7', locked: false, reused: true, realIndex: null, chartmetric: null }, error: null },
    ));
    const usuario = userEvent.setup();
    const tela = await montar();

    await escolherOArtista(usuario, tela);
    await usuario.press(tela.getByLabelText('Começar diagnóstico'));
    await responderOQuiz(usuario, tela);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/artista/[id]', params: { id: 'a-7' },
    }));
  });

  // A falha do diagnóstico precisa DIZER o que houve: um "não consegui gerar" sem causa não se
  // investiga. Já aconteceu uma vez em que a requisição nem chegou ao servidor, e não havia
  // nada — nem no aparelho, nem no log da edge — para saber por quê.
  it('quando a edge falha, a causa vai para o log e as respostas continuam de pé', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockInvocar.mockImplementation((_fn: string, opts: any) => (opts?.body?.preview
      ? Promise.resolve({ data: { preview: true, api: {} }, error: null })
      : Promise.reject(new Error('Failed to send a request to the Edge Function'))));
    const usuario = userEvent.setup();
    const tela = await montar();

    await escolherOArtista(usuario, tela);
    await usuario.press(tela.getByLabelText('Começar diagnóstico'));
    await responderOQuiz(usuario, tela);

    expect(await tela.findByText(/Não consegui gerar seu diagnóstico agora/)).toBeTruthy();
    expect(log).toHaveBeenCalledWith(
      '[criar-artista] o diagnóstico falhou:',
      'Failed to send a request to the Edge Function',
      expect.any(Error),
    );

    // Tentar de novo repete a MESMA chamada: quem respondeu o quiz inteiro não o responde
    // outra vez por causa de uma falha de rede. (A chamada 0 é a consulta prévia.)
    mockInvocar.mockResolvedValue({
      data: { artistId: 'a-9', locked: true, realIndex: null, chartmetric: null }, error: null,
    });
    await usuario.press(tela.getByLabelText('Tentar de novo'));
    await waitFor(() => expect(mockInvocar).toHaveBeenCalledTimes(3));
    expect(mockInvocar.mock.calls[2][1]).toEqual(mockInvocar.mock.calls[1][1]);
  });

  it('não deixa criar quando há perfis pendentes', async () => {
    mockPodeCriar.mockReturnValue({
      canCreate: false, reason: 'pending_limit', pendingCount: 2, cooldownRemainingSeconds: 0,
      loading: false, error: null, retry: jest.fn(),
    });
    const tela = await montar();

    expect(await tela.findByText(/Você tem 2 perfis pendentes/)).toBeTruthy();
    expect(tela.queryByLabelText('Nome do artista ou link do Spotify')).toBeNull();
  });
});
