import { render, userEvent, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { Provider } from 'react-redux';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { CTX_API, QUIZ, TRANSICOES } from '@maestra/core/constants/quizDoDiagnostico';
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
// `useLocalSearchParams` devolve o `refazer` da rota. Vazio aqui: estes testes são da CRIAÇÃO.
const mockParams: { refazer?: string } = {};
jest.mock('expo-router', () => ({
  router: {
    replace: (...a: unknown[]) => mockReplace(...a),
    push: (...a: unknown[]) => mockPush(...a),
  },
  useLocalSearchParams: () => mockParams,
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

/** A pergunta está na tela? */
const estaNaTela = (tela: Tela, p: (typeof QUIZ)[number]) => {
  const fixo = p.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return !!tela.queryByText(new RegExp(`^${fixo}`));
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
  if (pergunta.type === 'tabela') {
    // Uma escolha por linha. Na tabela expansível a linha abre primeiro; na outra as pílulas já
    // estão à vista. O índice 1 é a segunda coluna da primeira linha aberta.
    if (pergunta.tabela?.expansivel) {
      await usuario.press(tela.getByLabelText(pergunta.tabela.linhas[0].label));
    }
    await usuario.press(tela.getAllByRole('radio')[1]);
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
        atual = QUIZ.find((p) => estaNaTela(tela, p));
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
    const imprensa = body.quizV4.imprensaMatrix;
    if (imprensa) {
      expect(Array.isArray(imprensa)).toBe(true);
      expect(imprensa[0]).toEqual(expect.objectContaining({ tipo: expect.any(String), porte: expect.any(String) }));
    }

    // ⚠️ O SALDO VAI EM ÍNDICE DE FAIXA, e não em reais (v4.5, §3.2). Quem responde a faixa não
    // manda parcela nenhuma: o caminho direto é o saldo e mais nada.
    expect(body.quizV4.saldoFaixa).toBe(0);
    expect(body.quizV4).not.toHaveProperty('cacheFaixa');
    expect(body.quizV4).not.toHaveProperty('outrasFaixa');
    // E nada de dinheiro digitado chega à edge.
    expect(body.quizV4).not.toHaveProperty('cacheByType');
    expect(body.quizV4).not.toHaveProperty('revenueSources');
    expect(body.quizV4).not.toHaveProperty('custoPorShow');
    expect(body.quizV4).not.toHaveProperty('aliquota');
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


// AS TRANSIÇÕES DE BLOCO (Quiz v4.2, §2).
//
// O roteiro é do núcleo e tem teste próprio (`quizDoDiagnostico.test.ts`); estes casos são o
// outro lado: provar que a TELA desenha a frase, e no lugar certo. A web tem o par deles em
// `src/pages/ArtistCreate/__tests__/transicoesDoQuiz.test.tsx`, e as duas superfícies precisam
// continuar mostrando as mesmas frases nos mesmos pontos.
describe('criar perfil · as transições de bloco', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPodeCriar.mockReturnValue({
      canCreate: true, reason: null, pendingCount: 0, cooldownRemainingSeconds: 0,
      loading: false, error: null, retry: jest.fn(),
    });
    mockBuscar.mockResolvedValue([ARTISTA]);
    mockRpc.mockResolvedValue({ data: false });
    mockInvocar.mockImplementation((_fn: string, opts: any) => Promise.resolve(
      opts?.body?.preview
        ? { data: { preview: true, api: {} }, error: null }
        : { data: null, error: null },
    ));
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  });

  /** Entra no quiz e para na primeira pergunta, o vínculo. */
  const abrirOQuiz = async (usuario: ReturnType<typeof userEvent.setup>, tela: Tela) => {
    await escolherOArtista(usuario, tela);
    await usuario.press(await tela.findByLabelText('Começar diagnóstico'));
    await tela.findByText(QUIZ[0].q);
  };

  /** Responde o que estiver na tela até a pergunta pedida aparecer. */
  const andarAte = async (
    usuario: ReturnType<typeof userEvent.setup>, tela: Tela, chave: string,
  ) => {
    for (let volta = 0; volta < QUIZ.length; volta += 1) {
      const atual = QUIZ.find((p) => estaNaTela(tela, p));
      if (!atual || atual.key === chave) return;
      // eslint-disable-next-line no-await-in-loop
      await responderAPergunta(usuario, tela, atual);
      // eslint-disable-next-line no-await-in-loop
      await waitFor(() => expect(QUIZ.find((p) => estaNaTela(tela, p))).toBeTruthy());
    }
  };

  // ════════ O desvio do detalhamento (v4.5, §3.2) ════════
  //
  // ⚠️ ESTE É O CAMINHO QUE NINGUÉM PERCORRE POR ACIDENTE. O passeio normal do quiz responde a
  // primeira opção de cada pergunta, e a primeira opção da faixa de saldo é uma resposta — ou
  // seja, o caminho direto. O detalhamento inteiro, sete a dezasseis perguntas, só existe para
  // quem toca num botão que não é opção nenhuma.
  describe('o desvio do detalhamento', () => {
    it('o botão abre a conta, e a faixa de saldo não é respondida', async () => {
      const usuario = userEvent.setup();
      const tela = await montar();
      await abrirOQuiz(usuario, tela);
      await andarAte(usuario, tela, 'saldoFaixa');

      await usuario.press(tela.getByLabelText('Me ajude a calcular'));

      // QD.0 abre o detalhamento, e a primeira pergunta é a do palco.
      expect(await tela.findByText(TRANSICOES.detalhe!)).toBeTruthy();
      expect(tela.getByText(QUIZ.find((q) => q.key === 'cacheFaixa')!.q)).toBeTruthy();
    });

    it('e o quiz chega à edge com as parcelas em faixa, e sem faixa de saldo', async () => {
      const usuario = userEvent.setup();
      const tela = await montar();
      await abrirOQuiz(usuario, tela);
      await andarAte(usuario, tela, 'saldoFaixa');
      await usuario.press(tela.getByLabelText('Me ajude a calcular'));
      await tela.findByText(TRANSICOES.detalhe!);
      await responderOQuiz(usuario, tela);

      await waitFor(() => expect(mockInvocar).toHaveBeenCalledTimes(2));
      const [, { body }] = mockInvocar.mock.calls[1] as [string, { body: any }];

      // ⚠️ A AUSÊNCIA DA FAIXA DE SALDO É A RESPOSTA. É ela que manda o motor somar as parcelas.
      expect(body.quizV4).not.toHaveProperty('saldoFaixa');
      expect(body.quizV4._detalhar).toBe(true);
      // As parcelas vão em ÍNDICE de faixa, nunca em reais.
      expect(typeof body.quizV4.cacheFaixa).toBe('number');
      expect(typeof body.quizV4.outrasFaixa).toBe('number');
      expect(typeof body.quizV4.fixoFaixa).toBe('number');
      expect(typeof body.quizV4.lancFaixa).toBe('number');
    });

    // ⚠️ AS NOVE FONTES GRAVAM NA MESMA CHAVE, cada uma na sua. Nenhum outro teste as percorre:
    // elas só existem para quem detalhou E tocou num link, e uma superfície a escrever
    // `respostas[key] = valor` em vez de respeitar a `sub` gravaria a última por cima das outras
    // oito — o artista perderia oito respostas sem ver nada acontecer na tela.
    it('o link separa fonte por fonte, e cada uma grava na sua chave', async () => {
      const usuario = userEvent.setup();
      const tela = await montar();
      await abrirOQuiz(usuario, tela);
      await andarAte(usuario, tela, 'saldoFaixa');
      await usuario.press(tela.getByLabelText('Me ajude a calcular'));
      await andarAte(usuario, tela, 'outrasFaixa');

      await usuario.press(tela.getByLabelText('Se quiser, a gente separa fonte por fonte.'));
      await responderOQuiz(usuario, tela);

      await waitFor(() => expect(mockInvocar).toHaveBeenCalledTimes(2));
      const [, { body }] = mockInvocar.mock.calls[1] as [string, { body: any }];
      const porFonte = body.quizV4.outrasPorFonteFaixa;

      expect(Object.keys(porFonte)).toHaveLength(9);
      expect(porFonte).toHaveProperty('distribuidora');
      expect(porFonte).toHaveProperty('outras');
      // E a faixa única de QD.2 não foi respondida: quem separou fonte por fonte saltou-a.
      expect(body.quizV4).not.toHaveProperty('outrasFaixa');
    });

    // O "Voltar" não limpa nada: é a presença da faixa que apaga o detalhamento.
    it('voltar e escolher uma faixa fecha o detalhamento', async () => {
      const usuario = userEvent.setup();
      const tela = await montar();
      await abrirOQuiz(usuario, tela);
      await andarAte(usuario, tela, 'saldoFaixa');
      await usuario.press(tela.getByLabelText('Me ajude a calcular'));
      await tela.findByText(QUIZ.find((q) => q.key === 'cacheFaixa')!.q);

      await usuario.press(tela.getByLabelText('Voltar para a pergunta anterior'));
      const saldo = QUIZ.find((q) => q.key === 'saldoFaixa')!;
      await tela.findByText(saldo.q);
      await usuario.press(tela.getByLabelText(saldo.options![5].label));

      // A pergunta seguinte é a do CNPJ, e não a do cachê: o detalhamento desapareceu sozinho.
      expect(await tela.findByText(QUIZ.find((q) => q.key === 'temCnpj')!.q)).toBeTruthy();
    });
  });

  it('o vínculo abre o quiz sem transição, e os shows chegam com a dela', async () => {
    const usuario = userEvent.setup();
    const tela = await montar();
    await abrirOQuiz(usuario, tela);

    Object.values(TRANSICOES).forEach((t) => expect(tela.queryByText(t!)).toBeNull());

    await responderAPergunta(usuario, tela, QUIZ[0]);

    expect(await tela.findByText(TRANSICOES.shows!)).toBeTruthy();
  });

  // A transição abre o bloco; ela não acompanha as perguntas dele.
  it('some na segunda pergunta do mesmo bloco', async () => {
    const usuario = userEvent.setup();
    const tela = await montar();
    await abrirOQuiz(usuario, tela);
    await responderAPergunta(usuario, tela, QUIZ[0]);
    await tela.findByText(TRANSICOES.shows!);

    await andarAte(usuario, tela, 'pagantePct');

    expect(tela.queryByText(TRANSICOES.shows!)).toBeNull();
  });

  // O pedido de dinheiro é o momento mais sensível do quiz, e a v4.5 abre-o prometendo ajuda:
  // "onde você não souber, eu te ajudo a calcular". A promessa é o botão da pergunta seguinte.
  it('a do dinheiro abre o bloco, na contagem de shows', async () => {
    const usuario = userEvent.setup();
    const tela = await montar();
    await abrirOQuiz(usuario, tela);

    await andarAte(usuario, tela, 'showsPerYear');

    expect(await tela.findByText(TRANSICOES.numeros!)).toBeTruthy();
  });

  // ⚠️ E NÃO SAI DUAS VEZES. O detalhamento parte o bloco do dinheiro ao meio, e o `temCnpj` do
  // outro lado tem o `lancFaixa` por vizinho — outro bloco. Com o recuo contíguo que a v4.2
  // usava, a abertura QE.0 saía outra vez ali, a meio do bloco.
  it('e não volta a sair no fim do bloco, depois do detalhamento', async () => {
    const usuario = userEvent.setup();
    const tela = await montar();
    await abrirOQuiz(usuario, tela);

    await andarAte(usuario, tela, 'temCnpj');

    expect(tela.queryByText(TRANSICOES.numeros!)).toBeNull();
  });

  // A razão de a transição ser do BLOCO e não da primeira pergunta: no bloco digital some
  // justamente a que abre. Presa ao Instagram, ela sumiria com ele, e o artista veria "E no
  // TikTok, quantos seguidores?" sem nada explicando por que a máquina está perguntando o que
  // devia ter buscado sozinha.
  it('a do bloco digital acompanha a primeira pergunta que sobrou', async () => {
    mockInvocar.mockImplementation((_fn: string, opts: any) => Promise.resolve(
      opts?.body?.preview
        ? { data: { preview: true, api: { igFollowers: 9000 } }, error: null }
        : { data: null, error: null },
    ));
    const usuario = userEvent.setup();
    const tela = await montar();
    await abrirOQuiz(usuario, tela);

    await andarAte(usuario, tela, 'tiktokFollowersSelf');

    expect(tela.getByText(QUIZ.find((p) => p.key === 'tiktokFollowersSelf')!.q)).toBeTruthy();
    expect(await tela.findByText(TRANSICOES.digital!)).toBeTruthy();
  });
});


// REFAZER — a mesma tela sobre um perfil que já existe.
//
// A edge recalcula o índice com `redoArtistId`, sem criar perfil nem tocar em plano. O que este
// bloco guarda é o que muda AQUI: a busca do artista é pulada (ele já está escolhido), as
// respostas da última vez voltam pré-carregadas, e o corpo que sai para a edge é outro. Mandar
// `name`/`spotifyArtistId` num refazer criaria um perfil novo.
describe('criar perfil · refazer', () => {
  const PERFIL = {
    id: 'a-7',
    user_id: 'u-1',
    name: 'AZMUTH BEATS',
    content: {
      spotifyProfile: { spotify_artist_id: 'sp-1', followers: 1234, image: ARTISTA.image },
      quizDiagnostic: { answers: { showsPerYear: 12 } },
    },
  };

  beforeEach(() => {
    mockParams.refazer = PERFIL.id;
    store.dispatch({ type: 'artists/fetchArtists/fulfilled', payload: [PERFIL] });
  });

  afterEach(() => { delete mockParams.refazer; });

  it('pula a busca do artista e entra direto no quiz', async () => {
    const tela = await montar();
    // A primeira pergunta do roteiro, e não o campo de busca do Spotify.
    expect(await tela.findByText(QUIZ[0].q)).toBeTruthy();
    expect(tela.queryByLabelText('Nome do artista ou link do Spotify')).toBeNull();
  });

  it('manda redoArtistId para a edge, e não um perfil novo', async () => {
    mockInvocar.mockImplementation(() => Promise.resolve(
      { data: { artistId: PERFIL.id, redo: true, realIndex: null, chartmetric: null }, error: null },
    ));
    const usuario = userEvent.setup();
    const tela = await montar();
    await tela.findByText(QUIZ[0].q);

    await responderOQuiz(usuario, tela);

    await waitFor(() => expect(mockInvocar).toHaveBeenCalled());
    const [, { body }] = mockInvocar.mock.calls[mockInvocar.mock.calls.length - 1] as [string, { body: any }];
    expect(body.redoArtistId).toBe(PERFIL.id);
    expect(body.name).toBeUndefined();
    expect(body.spotifyArtistId).toBeUndefined();
    expect(body.quizV4).toBeTruthy();
  });
});
