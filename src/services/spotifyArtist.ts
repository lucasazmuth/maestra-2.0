import { artistService } from './artist';
import { albumsService } from './albums';
import { querySearch } from './search';
import { supabase } from '../lib/supabase';
import type {
  SpotifyProfile,
  SpotifyCatalogAlbum,
  SpotifyCatalogTrack,
} from '../interfaces/maestra';

// Constrói o perfil + catálogo do artista a partir da Spotify Web API.
// Observação: a API (estado Feb/2026) removeu followers, popularity e /top-tracks do
// Development Mode. Usamos a Edge Function `spotify-artist-stats` como fallback para obter
// seguidores e popularidade via scraping da página pública do Spotify.

export interface SpotifyArtistSearchResult {
  id: string;
  name: string;
  image?: string;
  followers?: number;
  genres?: string[];
}

/** Busca artistas por nome (para o modal de criação). */
export const searchSpotifyArtists = async (
  query: string
): Promise<SpotifyArtistSearchResult[]> => {
  if (!query.trim()) return [];
  const { data } = await querySearch({ q: query, type: 'artist', limit: 8 });
  return (data.artists?.items || []).map((a) => ({
    id: a.id,
    name: a.name,
    image: a.images?.[a.images.length - 1]?.url || a.images?.[0]?.url,
    followers: a.followers?.total,
    genres: a.genres,
  }));
};

/**
 * Busca followers e popularity via token do embed player do Spotify.
 * Necessário porque o Dev Mode da Web API removeu esses campos em Feb/2026.
 *
 * Estratégia:
 * 1. Pede à Edge Function um token anônimo do embed player (Extended Quota)
 * 2. Usa esse token client-side para chamar a API e obter followers/popularity
 *
 * O token do embed pertence ao web player oficial (Extended Quota) e retorna todos os campos.
 * A chamada à API é feita client-side pois IPs de datacenter são bloqueados pelo Spotify.
 */
const fetchArtistStats = async (
  artistId: string
): Promise<{ followers?: number; popularity?: number }> => {
  try {
    // Pedir token anônimo via Edge Function (que busca do embed page)
    const { data: tokenData, error: tokenError } = await supabase.functions.invoke(
      'spotify-artist-stats',
      { body: { artist_id: artistId, action: 'get_token' } }
    );

    const embedToken = tokenError ? null : tokenData?.embed_token;

    if (embedToken) {
      // Usar o token client-side para chamar a API (não passa pelo axios cache/interceptors)
      const resp = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
        headers: { Authorization: `Bearer ${embedToken}` },
      });
      if (resp.ok) {
        const artist = await resp.json();
        const result: { followers?: number; popularity?: number } = {};
        if (typeof artist.followers?.total === 'number') result.followers = artist.followers.total;
        if (typeof artist.popularity === 'number') result.popularity = artist.popularity;
        if (result.followers != null || result.popularity != null) return result;
      }
    }

    // Fallback: chamar a Edge Function para tentar server-side (pode falhar por IP)
    const { data, error } = await supabase.functions.invoke('spotify-artist-stats', {
      body: { artist_id: artistId },
    });
    if (!error && data) {
      const result: { followers?: number; popularity?: number } = {};
      if (typeof data.followers === 'number') result.followers = data.followers;
      if (typeof data.popularity === 'number') result.popularity = data.popularity;
      if (result.followers != null || result.popularity != null) return result;
    }
  } catch {
    // Tudo falhou
  }

  return {};
};

const MAX_ALBUMS = 10;
const MAX_ALBUMS_FOR_TRACKS = 8;

export const buildSpotifyProfileAndCatalog = async (
  spotifyArtistId: string
): Promise<{
  profile: SpotifyProfile;
  catalog: { albums: SpotifyCatalogAlbum[]; tracks: SpotifyCatalogTrack[] };
}> => {
  const { data: artist } = await artistService.fetchArtist(spotifyArtistId);

  const { data: albumsPage } = await artistService.fetchArtistAlbums(spotifyArtistId, {
    include_groups: 'album',
    limit: MAX_ALBUMS,
  });

  // Tenta também singles (endpoint aceita um grupo por vez na prática); ignora erros.
  let singles: any[] = [];
  try {
    const res = await artistService.fetchArtistAlbums(spotifyArtistId, {
      include_groups: 'single',
      limit: MAX_ALBUMS,
    });
    singles = res.data.items || [];
  } catch {
    singles = [];
  }

  const rawAlbums = [...(albumsPage.items || []), ...singles];

  // Dedupe por id
  const seen = new Set<string>();
  const albums: SpotifyCatalogAlbum[] = [];
  for (const al of rawAlbums) {
    if (seen.has(al.id)) continue;
    seen.add(al.id);
    albums.push({
      id: al.id,
      name: al.name,
      image: al.images?.[0]?.url,
      release_date: al.release_date,
      total_tracks: al.total_tracks,
      spotify_url: al.external_urls?.spotify,
    });
  }

  // Faixas dos primeiros álbuns (respeitando rate limit)
  const tracks: SpotifyCatalogTrack[] = [];
  const trackSeen = new Set<string>();
  for (const al of albums.slice(0, MAX_ALBUMS_FOR_TRACKS)) {
    try {
      const { data: tracksPage } = await albumsService.fetchAlbumTracks(al.id, { limit: 20 });
      for (const t of tracksPage.items || []) {
        const key = t.name.toLowerCase();
        if (trackSeen.has(key)) continue;
        trackSeen.add(key);
        tracks.push({
          id: t.id,
          name: t.name,
          album: al.name,
          album_image: al.image,
          duration_ms: t.duration_ms,
          preview_url: (t as any).preview_url ?? null,
          spotify_url: t.external_urls?.spotify,
        });
      }
    } catch {
      // ignora álbum que falhar
    }
  }

  const profile: SpotifyProfile = {
    spotify_artist_id: artist.id,
    name: artist.name,
    image: artist.images?.[0]?.url,
    followers: artist.followers?.total,
    popularity: artist.popularity,
    genres: artist.genres,
    track_count: tracks.length,
    fetched_at: new Date().toISOString(),
  };

  // Desde Feb/2026, Dev Mode não retorna followers/popularity na Web API.
  // Usa a Edge Function como fallback para buscar esses dados via scraping.
  if (profile.followers == null || profile.popularity == null) {
    const stats = await fetchArtistStats(spotifyArtistId);
    if (stats.followers != null && profile.followers == null) {
      profile.followers = stats.followers;
    }
    if (stats.popularity != null && profile.popularity == null) {
      profile.popularity = stats.popularity;
    }
  }

  return { profile, catalog: { albums, tracks } };
};
