import { FC } from 'react';
import { Navigate, Outlet, useParams } from 'react-router-dom';

import { useAppSelector } from '../store/store';
import { isOnboardingComplete } from '../constants/maestra';
import { Spinner } from './spinner/spinner';

// Trava as telas do artista (dashboard, catálogo, agenda, plano, equipe) até o
// planejamento estratégico estar CONCLUÍDO. Enquanto não estiver, redireciona pro
// Wizard. O perfil só nasce após o pagamento, então aqui já é sempre um perfil pago.
export const RequirePlanningComplete: FC = () => {
  const { id } = useParams();
  const artist = useAppSelector((s) => s.artists.items.find((a) => a.id === id));
  const loaded = useAppSelector((s) => s.artists.loaded);

  if (!loaded) {
    return <Spinner loading>{null as any}</Spinner>;
  }
  if (!artist) {
    return <Navigate to="/artists" replace />;
  }
  if (!isOnboardingComplete(artist)) {
    return <Navigate to={`/artists/${id}/wizard`} replace />;
  }
  return <Outlet />;
};

export default RequirePlanningComplete;
