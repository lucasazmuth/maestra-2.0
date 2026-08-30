import { render, userEvent, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { Provider } from 'react-redux';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { QUIZ, REVENUE_SOURCES } from '@maestra/core/constants/quizDoDiagnostico';
import { store } from '@maestra/core/store/store';

import CriarArtista from '../criar-artista';

// A criação de perfil — o fluxo inteiro, do nome no Spotify ao diagnóstico.
//
// O que este teste protege não é o desenho, é o CONTRATO com a edge `artist-diagnostic`: ela é
// a mesma para a web e para o app, e lê `quizV3` com as chaves do roteiro do núcleo. Uma
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
    await usuario.press(tela.getAllByRole('checkbox')[0]);
  } else if (pergunta.type === 'revenue') {
    await usuario.type(tela.getByLabelText(REVENUE_SOURCES[0].label), '10');
    await usuario.type(tela.getByLabelText(REVENUE_SOURCES[1].label), '20');
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
    mockInvocar.mockResolvedValue({
      data: { artistId: 'a-9', locked: true, realIndex: null, chartmetric: null }, error: null,
    });
    const usuario = userEvent.setup();
    const tela = await montar();

    await escolherOArtista(usuario, tela);
    await usuario.press(tela.getByLabelText('Começar diagnóstico'));

    await responderOQuiz(usuario, tela);

    await waitFor(() => expect(mockInvocar).toHaveBeenCalledTimes(1));
    const [nome, { body }] = mockInvocar.mock.calls[0] as [string, { body: any }];
    expect(nome).toBe('artist-diagnostic');
    expect(body.name).toBe('AZMUTH BEATS');
    expect(body.spotifyArtistId).toBe('sp-1');
    expect(body.spotify).toEqual({ followers: 1234, image: ARTISTA.image });

    // Toda pergunta que apareceu deixou resposta, e nenhuma chave inventada foi junto.
    const chaves = Object.keys(body.quizV3);
    expect(chaves.length).toBeGreaterThan(0);
    chaves.forEach((chave) => expect(QUIZ.map((p) => p.key)).toContain(chave));

    // A imprensa vai em objetos, não em "tipo:porte" — é o formato que o motor lê.
    const imprensa = body.quizV3[QUIZ.find((p) => p.type === 'matrix')!.key];
    if (imprensa) {
      expect(Array.isArray(imprensa)).toBe(true);
      expect(imprensa[0]).toEqual(expect.objectContaining({ tipo: expect.any(String), porte: expect.any(String) }));
    }
  });

  // Um perfil que já existe e já foi pago não repete o diagnóstico: entra direto.
  it('perfil reaproveitado e pago vai direto para o artista', async () => {
    mockInvocar.mockResolvedValue({
      data: { artistId: 'a-7', locked: false, reused: true, realIndex: null, chartmetric: null },
      error: null,
    });
    const usuario = userEvent.setup();
    const tela = await montar();

    await escolherOArtista(usuario, tela);
    await usuario.press(tela.getByLabelText('Começar diagnóstico'));
    await responderOQuiz(usuario, tela);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/artista/[id]', params: { id: 'a-7' },
    }));
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
