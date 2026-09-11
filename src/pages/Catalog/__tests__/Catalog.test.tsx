/**
 * Unit tests for Catalog page integration with track limit feature.
 * Tests: TrackCounter display, Nova Música button states, UpsellModal trigger, counter update.
 *
 * Validates: Requirements 2, 3, 4, 5 from catalog-track-limit spec.
 */

import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';

import type { CatalogItem } from '@maestra/core/interfaces/maestra';

// ⚠️ ESTE FICHEIRO PRECISA DE MAIS DO QUE OS 5 s DE OMISSÃO, e não é lentidão a esconder um
// defeito: cada caso monta a página do catálogo inteira com dez músicas, e o mais pesado leva
// 4,3 s SOZINHO nesta máquina. Com a suíte toda a correr em paralelo, o que sobra desse
// orçamento é ruído — e a partir de certo ponto um caso falhava por um segundo de diferença na
// carga da máquina, sem nada ter mudado no produto. Um teste que muda de resultado conforme o
// que corre ao lado não diz nada sobre o código.
jest.setTimeout(20000);

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock useArtist hook
const mockArtist = {
  id: 'artist-1',
  user_id: 'user-1',
  name: 'Test Artist',
  content: { step: 9, wizardVersion: 2, spotifyCatalog: { albums: [], tracks: [] } },
};

jest.mock('@maestra/core/hooks/useArtist', () => ({
  useArtist: () => ({ artist: mockArtist, loading: false }),
}));

// Mock useEntitlements with controllable return value
let mockMaxCatalogTracks = 10;
jest.mock('@maestra/core/hooks/useEntitlements', () => ({
  FREE_MAX_CATALOG_TRACKS: 10,
  useEntitlements: () => ({
    plan: mockMaxCatalogTracks === Infinity ? 'pro' : 'free',
    // isPro governa o limite (o hook de capacidades deriva maxCatalogTracks de isPro).
    isPro: mockMaxCatalogTracks === Infinity,
    maxArtists: mockMaxCatalogTracks === Infinity ? Infinity : 1,
    maxCatalogTracks: mockMaxCatalogTracks,
    planning: mockMaxCatalogTracks === Infinity,
    team: mockMaxCatalogTracks === Infinity,
    nyta: mockMaxCatalogTracks === Infinity,
  }),
}));

// Mock catalog DB service
let mockCatalogItems: CatalogItem[] = [];
const mockListCatalogItems = jest.fn();
const mockDeleteCatalogItem = jest.fn();
const mockSalvarProjeto = jest.fn();
const mockExcluirMusica = jest.fn().mockResolvedValue(undefined);
jest.mock('@maestra/core/services/db/catalog', () => ({
  __esModule: true,
  listCatalogItems: (...args: any[]) => mockListCatalogItems(...args),
  deleteCatalogItem: (...args: any[]) => mockDeleteCatalogItem(...args),
  saveCatalogProjectFromForm: (...args: any[]) => mockSalvarProjeto(...args),
  excluirMusica: (...args: any[]) => mockExcluirMusica(...args),
}));

// Para onde a tela leva depois de criar: é metade do que "Nova música" faz agora.
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// O aviso padrão do produto e o store do player: é aqui que se vê se o clique numa música sem
// guia avisou em vez de abrir uma barra que não toca.
const mockWarning = jest.fn();
jest.mock('antd', () => {
  const real = jest.requireActual('antd');
  return { ...real, message: { ...real.message, warning: (...args: any[]) => mockWarning(...args) } };
});

const mockSetPlayerOpen = jest.fn();
jest.mock('@maestra/core/stores/localPlayerStore', () => {
  const estado = {
    open: false, currentId: null, tracks: [], playing: false,
    setOpen: (...args: any[]) => mockSetPlayerOpen(...args),
    setTracks: jest.fn(), setCurrentId: jest.fn(), toggle: jest.fn(),
  };
  return { useLocalPlayerStore: (seletor: any) => (seletor ? seletor(estado) : estado) };
});

// Mock genres DB service
const mockListGenres = jest.fn();
jest.mock('@maestra/core/services/db/genres', () => ({
  __esModule: true,
  listGenres: (...args: any[]) => mockListGenres(...args),
}));

// Mock UpsellModal to capture when it renders open
jest.mock('../../../components/UpsellModal', () => ({
  UpsellModal: ({ open, context }: { open: boolean; context: string }) =>
    open ? <div data-testid="upsell-modal" data-context={context}>UpsellModal</div> : null,
}));

// Mock TrackModal to capture open state and onSaved
let mockOnSaved: ((item: CatalogItem) => void) | null = null;
jest.mock('../../../components/TrackModal', () => ({
  TrackModal: ({ open, onSaved }: { open: boolean; onSaved: (item: CatalogItem) => void }) => {
    mockOnSaved = onSaved;
    return open ? <div data-testid="track-modal">TrackModal</div> : null;
  },
}));

// Mock other components that aren't relevant to these tests
jest.mock('../../../components/SpotifyEmbedPlayer', () => ({
  SpotifyEmbedPlayer: () => null,
}));

jest.mock('../../../components/LocalPlayerBar', () => ({
  LocalPlayerBar: () => null,
}));

jest.mock('../../../components/spinner/spinner', () => ({
  Spinner: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@maestra/core/services/db/members', () => ({
  listMembers: () => Promise.resolve([]),
}));

// Mock PAYWALL_DISABLED to false for tests
jest.mock('@maestra/core/constants/maestra', () => {
  const actual = jest.requireActual('@maestra/core/constants/maestra');
  return { ...actual, PAYWALL_DISABLED: false };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createTestStore() {
  return configureStore({
    reducer: {
      auth: (state = { user: { id: 'user-1' }, session: {} }) => state,
      artists: (state = { items: [mockArtist], loading: false, loaded: true, refreshing: false, currentArtistId: 'artist-1' }) => state,
      subscription: (state = { status: 'none', gracePeriodEndsAt: null, loading: false, error: null, asaasCustomerId: null, asaasSubscriptionId: null, nextDueDate: null, value: null, pixData: null }) => state,
      ui: (state = {}) => state,
      language: (state = {}) => state,
    },
  });
}

function makeCatalogItem(overrides: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id: `track-${Math.random().toString(36).slice(2)}`,
    artist_id: 'artist-1',
    title: 'Test Track',
    status: 'composition',
    genre: 'Pop',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function renderCatalog() {
  const store = createTestStore();
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/artists/artist-1/catalog']}>
        <Routes>
          <Route path="/artists/:id/catalog" element={<Catalog />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

// ─── Import component after mocks ────────────────────────────────────────────

import Catalog from '../index';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Catalog Page - Track Limit Integration', () => {
  beforeEach(() => {
    mockMaxCatalogTracks = 10;
    mockCatalogItems = [];
    mockSalvarProjeto.mockReset();
    mockSalvarProjeto.mockResolvedValue(
      makeCatalogItem({ id: 'versao-nova', project_id: 'projeto-novo', title: 'Rascunho' }),
    );
    mockNavigate.mockClear();
    mockOnSaved = null;
    mockListCatalogItems.mockImplementation(() => Promise.resolve(mockCatalogItems));
    mockDeleteCatalogItem.mockImplementation(() => Promise.resolve());
    mockListGenres.mockImplementation(() => Promise.resolve([]));
  });

  describe('5.1: Free user with 5 tracks sees counter "5/10 músicas" and enabled button', () => {
    it('shows counter with correct count and enabled button style', async () => {
      mockCatalogItems = Array.from({ length: 5 }, (_, i) =>
        makeCatalogItem({ id: `track-${i}`, title: `Track ${i}` })
      );

      renderCatalog();

      // Wait for items to load and the manual tab to become active
      // (component auto-switches to manual when no spotify tracks)
      // ⚠️ O CONTADOR MUDOU DE SÍTIO: era "5/10 músicas" solto no cabeçalho, e passou a ser o
      // sufixo do rótulo da aba — "Músicas 5/10". Perdeu a palavra porque o rótulo ao lado já
      // a diz, e ganhou a proximidade da lista que conta.
      await waitFor(() => {
        expect(screen.getByText('5/10')).toBeInTheDocument();
      });

      // Longe do limite, sem cor de alarme: quem pinta é a aba.
      const counter = screen.getByText('5/10');
      expect(counter).not.toHaveStyle({ color: '#e53e3e' });
      // E mora DENTRO da aba, e não ao lado do título.
      expect(counter.closest('button')).toHaveAttribute('aria-pressed', 'true');

      // Nova música button should be enabled (full opacity, pointer cursor)
      const button = screen.getByRole('button', { name: /nova música/i });
      expect(button).toHaveStyle({ opacity: 1, cursor: 'pointer' });
    });
  });

  describe('5.2: Free user with 10 tracks sees counter in red, disabled button, UpsellModal opens on click', () => {
    it('shows counter in red, button disabled style, and opens UpsellModal on click', async () => {
      mockCatalogItems = Array.from({ length: 10 }, (_, i) =>
        makeCatalogItem({ id: `track-${i}`, title: `Track ${i}` })
      );

      renderCatalog();

      // Wait for counter to appear
      await waitFor(() => {
        expect(screen.getByText('10/10')).toBeInTheDocument();
      });

      // ⚠️ VERMELHO NO LIMITE: é o único aviso que chega ANTES de a pessoa tentar criar.
      const counter = screen.getByText('10/10');
      expect(counter).toHaveStyle({ color: '#e53e3e' });

      // Button should have disabled style
      const button = screen.getByRole('button', { name: /nova música/i });
      expect(button).toHaveStyle({ opacity: 0.5, cursor: 'not-allowed' });

      // Clicking the button should open UpsellModal, not TrackModal
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId('upsell-modal')).toBeInTheDocument();
      });
      expect(screen.getByTestId('upsell-modal')).toHaveAttribute('data-context', 'catalog-limit');
      expect(screen.queryByTestId('track-modal')).not.toBeInTheDocument();
    });
  });

  describe('5.3: Pro user sees no counter and enabled button regardless of track count', () => {
    it('hides counter and keeps button enabled for pro user with many tracks', async () => {
      mockMaxCatalogTracks = Infinity;
      mockCatalogItems = Array.from({ length: 50 }, (_, i) =>
        makeCatalogItem({ id: `track-${i}`, title: `Track ${i}` })
      );

      renderCatalog();

      // Wait for content to load (manual tab auto-activates)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /nova música/i })).toBeInTheDocument();
      });

      // Counter should NOT be visible (maxTracks === Infinity)
      expect(screen.queryByText(/\d+\/\d+/)).not.toBeInTheDocument();

      // Button should be fully enabled
      const button = screen.getByRole('button', { name: /nova música/i });
      expect(button).toHaveStyle({ opacity: 1, cursor: 'pointer' });

      // ⚠️ NÃO ABRE FICHA NENHUMA: "Nova música" passou a criar um rascunho e a abrir o
      // editor. O que este caso guarda é que quem tem plano não esbarra no muro do upsell.
      fireEvent.click(button);

      await waitFor(() => expect(mockSalvarProjeto).toHaveBeenCalled());
      expect(mockSalvarProjeto.mock.calls[0][0]).toMatchObject({ title: 'Rascunho' });
      expect(screen.queryByTestId('upsell-modal')).not.toBeInTheDocument();
      // Este caso monta 50 faixas e leva ~4s de trabalho real, contra os 5s padrao do jest —
      // margem estreita demais. Passava sozinho e caia quando a maquina tinha outra coisa
      // rodando em paralelo, que e o pior tipo de teste: o que falha sem ninguem ter mexido.
    }, 20_000);
  });

  // ⚠️ ESTE CASO MUDOU DE ASSUNTO com o fluxo. Ele guardava "o contador sobe de 5/10 para
  // 6/10 depois de gravar" — mas gravar deixou de acontecer aqui: "Nova música" cria um
  // rascunho e SAI desta tela para o editor, e um contador que ninguém vai ver não é o que
  // importa proteger. O que importa é que a música nasce com o nome certo e que a pessoa é
  // levada para dentro dela.
  describe('5.4: "Nova música" cria um rascunho e abre o Espaço Jam', () => {
    it('cria com o título Rascunho e navega para o editor da música criada', async () => {
      mockCatalogItems = Array.from({ length: 5 }, (_, i) =>
        makeCatalogItem({ id: `track-${i}`, title: `Track ${i}` })
      );
      mockSalvarProjeto.mockResolvedValue(
        makeCatalogItem({ id: 'versao-nova', project_id: 'projeto-novo', title: 'Rascunho' }),
      );

      renderCatalog();

      await waitFor(() => {
        expect(screen.getByText('5/10')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /nova música/i }));

      await waitFor(() => expect(mockSalvarProjeto).toHaveBeenCalled());
      expect(mockSalvarProjeto.mock.calls[0][0]).toMatchObject({
        artist_id: 'artist-1',
        title: 'Rascunho',
      });

      // Pelo PROJETO, e não pela versão: é o projeto que o editor abre.
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/artists/artist-1/catalog/projects/projeto-novo');
      });

      // E não passa por ficha nenhuma no caminho.
      expect(screen.queryByTestId('track-modal')).not.toBeInTheDocument();
    });
  });

  describe('Catalog filters', () => {
    // A busca por texto saiu do popover e foi para o campo do topo (ela vivia escondida atrás
    // de "Filtros" e ninguém achava). O popover ficou só com os filtros estruturados, e é isso
    // que este teste passa a cobrir — a busca em si é exercitada pelo store, não por aqui.
    it('deixa no popover apenas os filtros estruturados, sem campo de busca', async () => {
      mockCatalogItems = [
        makeCatalogItem({ id: 'track-samba', title: 'Meu Samba', genre: 'Samba', status: 'composition' }),
        makeCatalogItem({ id: 'track-rock', title: 'Noite Rock', genre: 'Rock', status: 'released' }),
      ];

      renderCatalog();

      await waitFor(() => {
        expect(screen.getByText('Meu Samba')).toBeInTheDocument();
        expect(screen.getByText('Noite Rock')).toBeInTheDocument();
      });

      expect(screen.queryByPlaceholderText('Buscar em Músicas')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));

      const filters = screen.getByRole('dialog', { name: 'Filtros de Músicas' });
      expect(within(filters).queryByPlaceholderText('Buscar em Músicas')).not.toBeInTheDocument();
      expect(within(filters).getByText('Status')).toBeInTheDocument();
      expect(within(filters).getByText('Áudio')).toBeInTheDocument();
      expect(within(filters).getByText('Ordenar')).toBeInTheDocument();

      fireEvent.click(within(filters).getByRole('button', { name: 'Lançado' }));
      expect(screen.queryByText('Meu Samba')).not.toBeInTheDocument();
      expect(screen.getByText('Noite Rock')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Filtros 1' })).toBeInTheDocument();

      fireEvent.click(within(filters).getByRole('button', { name: 'Limpar' }));

      expect(screen.getByText('Meu Samba')).toBeInTheDocument();
      expect(screen.getByText('Noite Rock')).toBeInTheDocument();
    });
  });

  // ⚠️ O PLAY NÃO PODE DESTACAR QUEM NÃO TEM O QUE TOCAR. A folha antiga acinzenta o botão
  // por `button[title="Tocar"]` — um seletor pelo TEXTO do title —, e a música sem guia, que
  // tinha outro title, escapava e ficava com o azul cheio. A lista dava o botão mais aceso
  // justamente à linha que não responde.
  describe('o play de uma música sem faixa guia', () => {
    beforeEach(() => {
      mockWarning.mockClear();
      mockSetPlayerOpen.mockClear();
      mockCatalogItems = [
        makeCatalogItem({ id: 'com-audio', title: 'Tem guia', audio_file: 'https://exemplo/guia.mp3' }),
        makeCatalogItem({ id: 'sem-audio', title: 'Sem guia', audio_file: null }),
      ];
      mockListCatalogItems.mockResolvedValue(mockCatalogItems);
    });

    const playDe = async (titulo: string) => {
      await waitFor(() => expect(screen.getByText(titulo)).toBeInTheDocument());
      const linha = screen.getByText(titulo).closest('.catalog-track-row') as HTMLElement;
      return within(linha).getAllByRole('button')[0];
    };

    it('não fica azul: apagado como o das músicas que tocam', async () => {
      renderCatalog();
      const play = await playDe('Sem guia');
      // O jsdom normaliza para `rgb(...)`; o azul da marca é o que ele NÃO pode ter.
      expect(play.style.background).not.toBe('rgb(51, 97, 255)');
      expect(play.style.background).toBe('rgb(238, 243, 251)');
    });

    it('avisa o que falta, e não abre um player que não toca', async () => {
      renderCatalog();
      fireEvent.click(await playDe('Sem guia'));

      expect(mockWarning).toHaveBeenCalledTimes(1);
      expect(mockWarning.mock.calls[0][0]).toContain('faixa guia');
      // Sem isto o aviso seria enfeite: a barra continuaria a abrir por baixo dele.
      expect(mockSetPlayerOpen).not.toHaveBeenCalledWith(true);
    });

    it('quem tem guia continua a tocar, sem aviso nenhum', async () => {
      renderCatalog();
      fireEvent.click(await playDe('Tem guia'));

      expect(mockWarning).not.toHaveBeenCalled();
      expect(mockSetPlayerOpen).toHaveBeenCalledWith(true);
    });
  });
});
