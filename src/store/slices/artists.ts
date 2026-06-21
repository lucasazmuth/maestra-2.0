import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

import type { RootState } from '../store';
import type { Artist, ArtistContent, SpotifyProfile } from '../../interfaces/maestra';
import * as artistsDb from '../../services/db/artists';
import { buildSpotifyProfileAndCatalog } from '../../services/spotifyArtist';
import { artistService } from '../../services/artist';

interface ArtistsState {
  items: Artist[];
  currentArtistId?: string;
  loading: boolean;
  /** true após a primeira busca concluir (sucesso ou falha) — evita redirects prematuros. */
  loaded: boolean;
  refreshing: boolean;
}

const initialState: ArtistsState = {
  items: [],
  loading: false,
  loaded: false,
  refreshing: false,
};

// Revalida o perfil Spotify se a última coleta tiver mais de 6h.
const STALE_MS = 6 * 60 * 60 * 1000;

export const fetchArtists = createAsyncThunk<Artist[], string>(
  'artists/fetchArtists',
  async (userId) => artistsDb.listArtists(userId)
);

export const createArtist = createAsyncThunk<
  Artist,
  { userId: string; name: string; spotifyArtistId?: string }
>('artists/createArtist', async ({ userId, name, spotifyArtistId }) => {
  let content: ArtistContent = { step: 0, phase: 1, language: 'pt' };

  // Apenas buscar dados básicos do perfil (rápido, 1 request).
  // O catálogo completo (álbuns, faixas) é carregado em background via refreshSpotifyProfile.
  if (spotifyArtistId) {
    try {
      const { data: artist } = await artistService.fetchArtist(spotifyArtistId);
      const profile: SpotifyProfile = {
        spotify_artist_id: artist.id,
        name: artist.name,
        image: artist.images?.[0]?.url,
        followers: artist.followers?.total,
        popularity: artist.popularity,
        genres: artist.genres,
        track_count: 0,
        fetched_at: '1970-01-01T00:00:00.000Z', // Força refresh imediato no background
      };
      content = { ...content, spotifyProfile: profile };
    } catch {
      // Segue sem dados do Spotify; o refresh posterior tentará de novo
      content = {
        ...content,
        spotifyProfile: {
          spotify_artist_id: spotifyArtistId,
          name,
          fetched_at: '1970-01-01T00:00:00.000Z',
        } as SpotifyProfile,
      };
    }
  }
  return artistsDb.createArtist({ userId, name, content, spotifyArtistId });
});

export const updateArtistContent = createAsyncThunk<
  Artist,
  { id: string; content: ArtistContent; name?: string }
>('artists/updateArtistContent', async ({ id, content, name }) =>
  artistsDb.updateArtist(id, { content, name })
);

export const deleteArtist = createAsyncThunk<string, string>(
  'artists/deleteArtist',
  async (id) => {
    await artistsDb.deleteArtist(id);
    return id;
  }
);

/** Revalida stats + catálogo do Spotify e persiste no content. */
export const refreshSpotifyProfile = createAsyncThunk<
  Artist | null,
  { id: string; force?: boolean },
  { state: RootState }
>('artists/refreshSpotifyProfile', async ({ id, force }, { getState }) => {
  const artist = getState().artists.items.find((a) => a.id === id);
  const sp = artist?.content?.spotifyProfile;
  if (!sp?.spotify_artist_id) return null;

  const fresh = sp.fetched_at ? Date.now() - new Date(sp.fetched_at).getTime() < STALE_MS : false;
  if (fresh && !force) return null;

  const { profile, catalog } = await buildSpotifyProfileAndCatalog(sp.spotify_artist_id);

  // O fetch do Spotify acima leva vários segundos. Releia o content MAIS RECENTE do banco
  // antes de gravar e sobreponha apenas os campos do Spotify — caso contrário um snapshot
  // antigo (capturado no início) sobrescreveria tarefas/estratégias/objetivos editados nesse
  // meio-tempo (clobber). Fonte de verdade é o servidor, não o estado em memória.
  const latest = await artistsDb.getArtist(id);
  if (!latest) return null;
  const content: ArtistContent = {
    ...latest.content,
    spotifyProfile: profile,
    spotifyCatalog: catalog,
  };
  return artistsDb.updateArtist(id, { content });
});

const upsert = (items: Artist[], artist: Artist): Artist[] => {
  const idx = items.findIndex((a) => a.id === artist.id);
  if (idx === -1) return [artist, ...items];
  const next = items.slice();
  next[idx] = { ...next[idx], ...artist };
  return next;
};

const artistsSlice = createSlice({
  name: 'artists',
  initialState,
  reducers: {
    setCurrentArtist(state, action: PayloadAction<string | undefined>) {
      state.currentArtistId = action.payload;
    },
    // Atualização otimista do content em memória (feedback instantâneo na UI).
    // A persistência segue via thunk updateArtistContent; em caso de falha, refaz o fetch.
    setArtistContentLocal(state, action: PayloadAction<{ id: string; content: ArtistContent }>) {
      const idx = state.items.findIndex((a) => a.id === action.payload.id);
      if (idx !== -1) state.items[idx] = { ...state.items[idx], content: action.payload.content };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchArtists.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchArtists.fulfilled, (state, action) => {
        state.items = action.payload;
        state.loading = false;
        state.loaded = true;
      })
      .addCase(fetchArtists.rejected, (state) => {
        state.loading = false;
        state.loaded = true;
      })
      .addCase(createArtist.fulfilled, (state, action) => {
        state.items = upsert(state.items, action.payload);
      })
      .addCase(updateArtistContent.fulfilled, (state, action) => {
        state.items = upsert(state.items, action.payload);
      })
      .addCase(deleteArtist.fulfilled, (state, action) => {
        state.items = state.items.filter((a) => a.id !== action.payload);
        if (state.currentArtistId === action.payload) state.currentArtistId = undefined;
      })
      .addCase(refreshSpotifyProfile.pending, (state) => {
        state.refreshing = true;
      })
      .addCase(refreshSpotifyProfile.fulfilled, (state, action) => {
        state.refreshing = false;
        if (action.payload) state.items = upsert(state.items, action.payload);
      })
      .addCase(refreshSpotifyProfile.rejected, (state) => {
        state.refreshing = false;
      });
  },
});

export const selectCurrentArtist = (state: RootState): Artist | undefined =>
  state.artists.items.find((a) => a.id === state.artists.currentArtistId);

export const artistsActions = {
  ...artistsSlice.actions,
  fetchArtists,
  createArtist,
  updateArtistContent,
  deleteArtist,
  refreshSpotifyProfile,
};

export default artistsSlice.reducer;
