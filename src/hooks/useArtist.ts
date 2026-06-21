import { useEffect } from 'react';
import { useParams } from 'react-router-dom';

import { useAppDispatch, useAppSelector } from '../store/store';
import { artistsActions } from '../store/slices/artists';
import type { Artist } from '../interfaces/maestra';

/**
 * Hook usado por páginas no escopo de um artista (/artists/:id/...).
 * Garante que a lista esteja carregada, marca o artista atual e revalida o perfil Spotify
 * (se estiver "velho", > 6h) ao acessar.
 */
export const useArtist = (): { artist?: Artist; loading: boolean } => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();

  const user = useAppSelector((s) => s.auth.user);
  const artists = useAppSelector((s) => s.artists.items);
  const loading = useAppSelector((s) => s.artists.loading);
  const artist = artists.find((a) => a.id === id);

  useEffect(() => {
    if (user?.id && !artists.length) dispatch(artistsActions.fetchArtists(user.id));
  }, [user?.id, artists.length, dispatch]);

  useEffect(() => {
    if (id) dispatch(artistsActions.setCurrentArtist(id));
  }, [id, dispatch]);

  // Revalida o perfil Spotify ao abrir o artista (a thunk decide se está velho).
  useEffect(() => {
    if (id && artist?.content?.spotifyProfile?.spotify_artist_id) {
      dispatch(artistsActions.refreshSpotifyProfile({ id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, artist?.content?.spotifyProfile?.spotify_artist_id]);

  return { artist, loading };
};
