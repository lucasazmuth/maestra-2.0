import { FC, useEffect } from 'react';
import { Navigate, Outlet, useParams } from 'react-router-dom';

import { useAppDispatch, useAppSelector } from '../store/store';
import { artistsActions } from '../store/slices/artists';
import { Spinner } from './spinner/spinner';

// Trava qualquer tela do artista enquanto o perfil estiver NÃO-PAGO (is_locked).
// O perfil nasce no diagnóstico (antes do pagamento); até pagar, tudo redireciona
// pra tela de desbloqueio (que mostra o diagnóstico salvo + pagamento).
export const RequireArtistPaid: FC = () => {
  const { id } = useParams();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const artist = useAppSelector((s) => s.artists.items.find((a) => a.id === id));
  const loaded = useAppSelector((s) => s.artists.loaded);
  const loading = useAppSelector((s) => s.artists.loading);

  // Garante que a lista de artistas seja carregada mesmo em acesso direto por URL
  // (ex.: refresh em /artists/:id). Sem isso, o componente fica em spinner infinito
  // porque os filhos (que normalmente disparam fetchArtists via useArtist) nunca montam.
  useEffect(() => {
    if (user?.id && !loaded && !loading) {
      dispatch(artistsActions.fetchArtists(user.id));
    }
  }, [user?.id, loaded, loading, dispatch]);

  if (!loaded) {
    return <Spinner loading>{null as any}</Spinner>;
  }
  if (!artist) {
    return <Navigate to="/artists" replace />;
  }
  // Membros (não-donos) só entram em perfis já ativos; o estado de pagamento é do dono.
  if (artist.role !== 'member' && artist.is_locked) {
    return <Navigate to={`/artists/${id}/desbloquear`} replace />;
  }
  return <Outlet />;
};

export default RequireArtistPaid;
