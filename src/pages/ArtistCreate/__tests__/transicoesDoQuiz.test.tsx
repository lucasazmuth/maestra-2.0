import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import { QUIZ, TRANSICOES } from '@maestra/core/constants/quizDoDiagnostico';

// As transições de bloco do Quiz v4.2, na WEB.
//
// O roteiro é do núcleo e tem teste próprio (`quizDoDiagnostico.test.ts`); este arquivo é o
// outro lado: provar que a tela DESENHA a transição, e no lugar certo. Sem ele, apagar o
// parágrafo do `index.tsx` deixaria a suíte inteira verde — o app nativo continuaria mostrando
// as frases e a web voltaria a abrir cada bloco sem uma palavra de contexto.
//
// A entrada é o "Refazer diagnóstico": ele semeia o artista e cai direto na primeira pergunta,
// sem passar pela busca no Spotify.

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: 'a-7' }),
}));

jest.mock('@maestra/core/lib/supabase', () => ({
  supabase: {
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    rpc: () => Promise.resolve({ data: false }),
    auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
  },
}));

jest.mock('@maestra/core/services/spotifyArtist', () => ({ searchSpotifyArtists: jest.fn() }));

// Refazer é recurso PRO, e sem isso a tela redireciona para /assinatura na entrada.
jest.mock('@maestra/core/hooks/useEntitlements', () => ({ useEntitlements: () => ({ isPro: true }) }));

jest.mock('@maestra/core/hooks/useCanCreateArtist', () => ({
  useCanCreateArtist: () => ({
    canCreate: true, reason: null, pendingCount: 0, cooldownRemainingSeconds: 0,
    loading: false, error: null, retry: jest.fn(),
  }),
}));

jest.mock('../../../components/SpotifyLottie', () => ({ SpotifyLottie: () => null }));

// ─── Cenário ──────────────────────────────────────────────────────────────────

const PERFIL = {
  id: 'a-7',
  user_id: 'u-1',
  name: 'AZMUTH BEATS',
  content: { spotifyProfile: { spotify_artist_id: 'sp-1' }, quizDiagnostic: { answers: {} } },
};

const perguntaDe = (chave: string) => QUIZ.find((p) => p.key === chave)!;

// A página inteira, com antd junto, leva alguns segundos só para carregar. Carregada uma vez
// aqui, e não dentro do primeiro `it`, o custo sai de dentro do relógio de um teste — que a 5s
// de padrão estourava quando a suíte roda em paralelo com as outras 62.
let ArtistCreate: React.ComponentType;

jest.setTimeout(20000);

beforeAll(() => {
  // A fala é escrita letra a letra, e a interação só entra quando ela termina. Quem pediu menos
  // movimento recebe a frase inteira de uma vez, e é esse caminho que o teste usa — senão cada
  // pergunta custaria segundos de relógio. O `REDUCE_MOTION` é lido quando o módulo CARREGA,
  // então o `matchMedia` precisa existir antes do import: por isso o require aqui, e não no topo.
  window.matchMedia = ((consulta: string) => ({
    matches: consulta.includes('reduce'), media: consulta, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as any;

  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  ArtistCreate = require('../index').default;
});

const montar = () => {
  const store = configureStore({
    reducer: {
      auth: (state = { user: { id: 'u-1' } }) => state,
      artists: (state = { items: [PERFIL], loading: false, loaded: true, currentArtistId: 'a-7' }) => state,
      subscription: (state = { initialized: true }) => state,
    },
  });

  return render(<Provider store={store}><ArtistCreate /></Provider>);
};

/** Responde a pergunta que está na tela: os selects por clique, os números pelo campo. */
const responder = async (chave: string, valor = '10') => {
  const p = perguntaDe(chave);
  if (p.type === 'select') {
    fireEvent.click(screen.getByText(p.options![0].label));
    return;
  }
  const campo = document.querySelector('input.ant-input-number-input') as HTMLInputElement;
  fireEvent.change(campo, { target: { value: valor } });
  fireEvent.click(screen.getByText('Continuar'));
};

describe('as transições de bloco na web', () => {
  it('abre o quiz com a transição dos shows acima da primeira pergunta', async () => {
    montar();

    expect(await screen.findByText(perguntaDe('vinculo').q)).toBeInTheDocument();
    // O vínculo abre o quiz e não tem transição: nenhuma das cinco pode estar na tela.
    Object.values(TRANSICOES).forEach((t) => expect(screen.queryByText(t!)).not.toBeInTheDocument());

    await responder('vinculo');

    expect(await screen.findByText(TRANSICOES.shows!)).toBeInTheDocument();
    expect(screen.getByText(perguntaDe('showsPerYear').q)).toBeInTheDocument();
  });

  // A transição é a abertura do bloco, não um rodapé que acompanha as perguntas dele.
  it('some na segunda pergunta do mesmo bloco', async () => {
    montar();
    await screen.findByText(perguntaDe('vinculo').q);
    await responder('vinculo');
    await screen.findByText(TRANSICOES.shows!);

    await responder('showsPerYear', '12');

    expect(await screen.findByText(perguntaDe('fazBilheteria').q)).toBeInTheDocument();
    expect(screen.queryByText(TRANSICOES.shows!)).not.toBeInTheDocument();
  });

  // O pedido de dinheiro é o momento mais sensível do quiz, e a transição é o que o antecede.
  // A pergunta seguinte retoma o número de shows que a pessoa deu lá no primeiro bloco.
  it('a do dinheiro chega junto com o cachê, que retoma o número de shows', async () => {
    montar();
    await screen.findByText(perguntaDe('vinculo').q);
    await responder('vinculo');
    await screen.findByText(TRANSICOES.shows!);
    await responder('showsPerYear', '12');
    await screen.findByText(perguntaDe('fazBilheteria').q);

    // Daqui até o cachê: bilheteria (sim) e pagante, as três redes, o bloco do reconhecimento e
    // o da estrutura. O caminho é o de quem responde tudo.
    for (const chave of [
      'fazBilheteria', 'pagantePct',
      'igFollowersSelf', 'tiktokFollowersSelf', 'youtubeViews28dSelf',
      'imprensaRepercussao', 'imprensaMatrix', 'imprensaFrequencia', 'premios',
      'temCnpj', 'aliquota', 'temEmpresario',
    ]) {
      if (chave === 'imprensaMatrix') {
        // A matriz não tem "próxima" por clique: só o Continuar, com a resposta vazia (nenhum
        // veículo marcado), que é uma resposta válida.
        // eslint-disable-next-line no-await-in-loop
        await waitFor(() => expect(screen.getByText('Continuar')).toBeInTheDocument());
        fireEvent.click(screen.getByText('Continuar'));
      } else {
        // eslint-disable-next-line no-await-in-loop
        await waitFor(() => expect(screen.getByText(perguntaDe(chave).q)).toBeInTheDocument());
        // eslint-disable-next-line no-await-in-loop
        await responder(chave);
      }
    }

    expect(await screen.findByText(TRANSICOES.numeros!)).toBeInTheDocument();
    expect(screen.getByText(/fez 12 shows no último ano/)).toBeInTheDocument();
  });
});
