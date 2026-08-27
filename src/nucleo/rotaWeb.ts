import { useLocation, useParams } from 'react-router-dom';

import { configurarRota, type Rota } from '@maestra/core/nucleo/rota';

/** A rota da web, lida do react-router. */
export const useRotaDoNavegador = (): Rota => {
  const { pathname } = useLocation();
  const parametros = useParams();
  return { caminho: pathname, parametros };
};

// O registro mora no próprio módulo para que importar este arquivo baste — quem esquecesse de
// chamar `configurarRota` teria uma tela que não sabe em que artista está, sem erro nenhum.
configurarRota(useRotaDoNavegador);
