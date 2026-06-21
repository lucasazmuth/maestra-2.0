import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { resolveModuleFromPath, ActiveModuleContext } from '../utils/moduleMapping';
import { useNytaModalStore } from '../stores/nytaModalStore';
import { useAppSelector } from '../store/store';

/**
 * Deriva o contexto do módulo ativo a partir da rota atual.
 * Observa mudanças no pathname e sincroniza com o nytaModalStore.
 */
export function useActiveModuleContext(): ActiveModuleContext {
  const { pathname } = useLocation();
  const artists = useAppSelector((s) => s.artists.items);

  const context = useMemo<ActiveModuleContext>(() => {
    const { module, artistId, rawPath } = resolveModuleFromPath(pathname);
    const artist = artistId ? artists.find((a) => a.id === artistId) : null;
    const artistName = artist?.name ?? null;
    return { module, artistId, artistName, rawPath };
  }, [pathname, artists]);

  useEffect(() => {
    const current = useNytaModalStore.getState().moduleContext;
    // Só atualiza se realmente mudou para evitar loop de re-renders
    if (
      current.module !== context.module ||
      current.artistId !== context.artistId ||
      current.rawPath !== context.rawPath
    ) {
      useNytaModalStore.getState().setModuleContext(context);
    }
  }, [context]);

  return context;
}
