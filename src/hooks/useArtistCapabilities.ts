import { useMemo } from 'react';

import type { Artist } from '../interfaces/maestra';
import { PAYWALL_DISABLED } from '../constants/maestra';
import { useEntitlements } from './useEntitlements';

// Capacidades por (usuário, artista), combinando:
//   - eixo CONTA: isPro (assinatura R$39,90/mês);
//   - eixo PERFIL: isPaid (cobrança única R$199,90 confirmada → artist.is_locked === false);
//   - papel: isOwner (dono) vs colaborador (role === 'member').
//
// Regras (ver plano de receita):
//   editar catálogo/agenda        → dono OU PRO
//   editar planejamento / Maestra → perfil pago E (dono OU PRO)
//   gerir tarefas                 → perfil pago E PRO (até o dono precisa de PRO)
//   Nyta Consultora (chat)        → PRO (nível conta)

export interface ArtistCapabilities {
  isPaid: boolean;
  isOwner: boolean;
  canEdit: boolean; // catálogo/agenda
  viewPlanning: boolean;
  editPlanning: boolean;
  manageTasks: boolean;
  useNytaMaestra: boolean;
  useNytaConsultora: boolean;
  maxCatalogTracks: number;
}

export function deriveArtistCapabilities(args: {
  isPro: boolean;
  isPaid: boolean;
  isOwner: boolean;
  maxCatalogTracks: number;
}): ArtistCapabilities {
  const { isPro, isPaid, isOwner, maxCatalogTracks } = args;
  const canEdit = isOwner || isPro;
  return {
    isPaid,
    isOwner,
    canEdit,
    viewPlanning: isPaid,
    editPlanning: isPaid && canEdit,
    manageTasks: isPaid && isPro,
    useNytaMaestra: isPaid && canEdit,
    useNytaConsultora: isPro,
    maxCatalogTracks,
  };
}

export function useArtistCapabilities(artist?: Artist | null): ArtistCapabilities {
  const { isPro, maxCatalogTracks } = useEntitlements();

  return useMemo(() => {
    // is_locked === true ⇒ perfil pendente de pagamento. Qualquer outro valor ⇒ pago/ativo.
    const isPaid = PAYWALL_DISABLED ? true : !!artist && artist.is_locked !== true;
    const isOwner = !artist || artist.role !== 'member';
    return deriveArtistCapabilities({ isPro, isPaid, isOwner, maxCatalogTracks });
  }, [artist, isPro, maxCatalogTracks]);
}

export default useArtistCapabilities;
