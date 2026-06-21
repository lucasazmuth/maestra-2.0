/**
 * Unit tests for Catalog page integration with track limit feature.
 * Tests: TrackCounter display, Nova Faixa button states, UpsellModal trigger, counter update.
 *
 * Validates: Requirements 2, 3, 4, 5 from catalog-track-limit spec.
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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
  useEntitlements: () => ({
    plan: mockMaxCatalogTracks === Infinity ? 'pro' : 'free',
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

  describe('5.1: Free user with 5 tracks sees counter "5/10 faixas" and enabled button', () => {
    it('shows counter with correct count and enabled button style', async () => {
      mockCatalogItems = Array.from({ length: 5 }, (_, i) =>
        makeCatalogItem({ id: `track-${i}`, title: `Track ${i}` })
      );

      renderCatalog();

      // Wait for items to load and the manual tab to become active
      // (component auto-switches to manual when no spotify tracks)
      await waitFor(() => {
        expect(screen.getByText('5/10 faixas')).toBeInTheDocument();
      });

      // Counter should not be in red (not at limit)
      const counter = screen.getByText('5/10 faixas');
      expect(counter).toHaveStyle({ color: '#b3b3b3' });

      // Nova faixa button should be enabled (full opacity, pointer cursor)
      const button = screen.getByRole('button', { name: /nova faixa/i });
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
        expect(screen.getByText('10/10 faixas')).toBeInTheDocument();
      });

      // Counter should be red
      const counter = screen.getByText('10/10 faixas');
      expect(counter).toHaveStyle({ color: '#e53e3e' });

      // Button should have disabled style
      const button = screen.getByRole('button', { name: /nova faixa/i });
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
        expect(screen.getByRole('button', { name: /nova faixa/i })).toBeInTheDocument();
      });

      // Counter should NOT be visible (maxTracks === Infinity)
      expect(screen.queryByText(/\d+\/\d+ faixas/i)).not.toBeInTheDocument();

      // Button should be fully enabled
      const button = screen.getByRole('button', { name: /nova faixa/i });
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
        expect(screen.getByText('5/10 faixas')).toBeInTheDocument();
      });

      // Open the TrackModal by clicking the button
      const button = screen.getByRole('button', { name: /nova faixa/i });
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
        expect(screen.getByText('6/10 faixas')).toBeInTheDocument();
      });
    });
  });
});
