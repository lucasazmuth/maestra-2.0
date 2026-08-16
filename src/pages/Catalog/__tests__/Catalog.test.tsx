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

import type { CatalogItem } from '../../../interfaces/maestra';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock useArtist hook
const mockArtist = {
  id: 'artist-1',
  user_id: 'user-1',
  name: 'Test Artist',
  content: { step: 9, wizardVersion: 2, spotifyCatalog: { albums: [], tracks: [] } },
};

jest.mock('../../../hooks/useArtist', () => ({
  useArtist: () => ({ artist: mockArtist, loading: false }),
}));

// Mock useEntitlements with controllable return value
let mockMaxCatalogTracks = 10;
jest.mock('../../../hooks/useEntitlements', () => ({
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
jest.mock('../../../services/db/catalog', () => ({
  __esModule: true,
  listCatalogItems: (...args: any[]) => mockListCatalogItems(...args),
  deleteCatalogItem: (...args: any[]) => mockDeleteCatalogItem(...args),
}));

// Mock genres DB service
const mockListGenres = jest.fn();
jest.mock('../../../services/db/genres', () => ({
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

// Keep this integration test focused on catalog behavior. CRA's Jest SVG
// transform and icon bundles emit legacy React elements under React 19.
jest.mock('../../../components/Icons/system', () => ({
  AddIcon: () => <span aria-hidden="true">+</span>,
}));

jest.mock('react-icons/fi', () => ({
  FiRefreshCw: () => null,
  FiLock: () => null,
  FiMoreVertical: () => null,
  FiCheck: () => null,
  FiSearch: () => null,
  FiSliders: () => null,
}));

jest.mock('react-icons/fa6', () => ({
  FaSpotify: () => null,
}));

jest.mock('../../../components/spinner/spinner', () => ({
  Spinner: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../../../services/db/members', () => ({
  listMembers: () => Promise.resolve([]),
}));

// Mock PAYWALL_DISABLED to false for tests
jest.mock('../../../constants/maestra', () => {
  const actual = jest.requireActual('../../../constants/maestra');
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
      await waitFor(() => {
        expect(screen.getByText('5/10 músicas')).toBeInTheDocument();
      });

      // Counter should not be in red (not at limit)
      const counter = screen.getByText('5/10 músicas');
      expect(counter).toHaveStyle({ color: '#b3b3b3' });

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
        expect(screen.getByText('10/10 músicas')).toBeInTheDocument();
      });

      // Counter should be red
      const counter = screen.getByText('10/10 músicas');
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
      expect(screen.queryByText(/\d+\/\d+ músicas/i)).not.toBeInTheDocument();

      // Button should be fully enabled
      const button = screen.getByRole('button', { name: /nova música/i });
      expect(button).toHaveStyle({ opacity: 1, cursor: 'pointer' });

      // Clicking should open TrackModal, not UpsellModal
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId('track-modal')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('upsell-modal')).not.toBeInTheDocument();
    });
  });

  describe('5.4: After creating a track (onSaved), counter updates to reflect new count', () => {
    it('updates the counter from 5/10 to 6/10 after onSaved', async () => {
      mockCatalogItems = Array.from({ length: 5 }, (_, i) =>
        makeCatalogItem({ id: `track-${i}`, title: `Track ${i}` })
      );

      renderCatalog();

      // Wait for initial counter
      await waitFor(() => {
        expect(screen.getByText('5/10 músicas')).toBeInTheDocument();
      });

      // Open the TrackModal by clicking the button
      const button = screen.getByRole('button', { name: /nova música/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId('track-modal')).toBeInTheDocument();
      });

      // Simulate saving a new track via the onSaved callback
      const newTrack = makeCatalogItem({ id: 'new-track', title: 'Brand New Track' });
      act(() => {
        mockOnSaved!(newTrack);
      });

      // Counter should update to 6/10
      await waitFor(() => {
        expect(screen.getByText('6/10 músicas')).toBeInTheDocument();
      });
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
});
