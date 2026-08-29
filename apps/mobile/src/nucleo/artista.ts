import { useEffect } from 'react';

import type { Artist } from '@maestra/core/interfaces/maestra';
import { artistsActions } from '@maestra/core/store/slices/artists';
import { useAppDispatch, useAppSelector } from '@maestra/core/store/store';
import { useSessao } from '@/nucleo/sessao';

/**
 * O artista da rota, buscando-o se ele ainda não estiver carregado.
 *
 * As telas de perfil liam direto do store, o que só funciona para quem chegou pela lista — ela é
 * que dispara a busca. Entrando por deep link, o store está vazio e a tela mostra "Perfil" e
 * nenhum dado, como se o artista não existisse.
 *
 * Não é caso raro: é o caminho de todo link externo e, em breve, o de toda notificação push
 * tocada. Quem chega por ali não passou pela lista.
 */
export const useArtistaDaRota = (id: string | undefined): Artist | undefined => {
  const dispatch = useAppDispatch();
  const { sessao } = useSessao();
  const artista = useAppSelector((s) => s.artists.items.find((a) => a.id === id));
  const jaBuscou = useAppSelector((s) => s.artists.loaded);

  const usuario = sessao?.user.id;
  useEffect(() => {
    // Só busca se ainda não houve NENHUMA busca. Sem essa trava, um id que de fato não pertence
    // à pessoa dispararia uma busca a cada render, para sempre.
    if (usuario && !artista && !jaBuscou) dispatch(artistsActions.fetchArtists(usuario));
  }, [usuario, artista, jaBuscou, dispatch]);

  return artista;
};
