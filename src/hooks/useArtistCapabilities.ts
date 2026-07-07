import { useMemo } from 'react';

import type { Artist, AccessLevel } from '../interfaces/maestra';
import { PAYWALL_DISABLED } from '../constants/maestra';
import { useEntitlements, FREE_MAX_CATALOG_TRACKS } from './useEntitlements';

// Capacidades por (usuário, artista), combinando:
//   - eixo CONTA: isPro (assinatura R$39,90/mês);
//   - eixo PERFIL: isPaid (cobrança única R$199,90 confirmada → artist.is_locked === false);
//   - papel: isOwner (dono) vs colaborador (role === 'member') + access_levels concedidos.
//
// Regras:
//   editar catálogo   → dono OU membro com nível 'catalog'/'full'
//   editar agenda     → dono OU membro com nível 'agenda'/'full'
//   gerir equipe      → dono OU membro com nível 'team'/'full'
//   editar planejamento / Maestra / tarefas → perfil pago E (dono OU PRO)  [inalterado]
//   Nyta Consultora (chat)                  → PRO (nível conta)
//   limite de faixas  → POR PERFIL: 10 no grátis, ilimitado se o DONO do perfil é PRO
//
// IMPORTANTE: o gating de front NÃO é segurança — quem protege é o RLS (has_artist_access no
// banco espelha exatamente 'catalog'/'agenda'/'team' + 'full').

export interface ArtistCapabilities {
  isPaid: boolean;
  isOwner: boolean;
  canEditCatalog: boolean;
  canEditAgenda: boolean;
  canManageTeam: boolean;
  viewPlanning: boolean;
  editPlanning: boolean;
  manageTasks: boolean;
  useNytaMaestra: boolean;
  useNytaConsultora: boolean;
  maxCatalogTracks: number;
}

export function deriveArtistCapabilities(args: {
  isPro: boolean; // PRO da conta do usuário atual
  isPaid: boolean; // perfil pago (cobrança única)
  isOwner: boolean;
  accessLevels?: AccessLevel[]; // níveis concedidos ao membro (só quando !isOwner)
  ownerIsPro?: boolean; // PRO do DONO do perfil (só quando !isOwner)
}): ArtistCapabilities {
  const { isPro, isPaid, isOwner, accessLevels = [], ownerIsPro } = args;
  const has = (lvl: AccessLevel) => accessLevels.includes(lvl) || accessLevels.includes('full');

  // Operação (catálogo/agenda/equipe): dono sempre; membro conforme o nível concedido no convite.
  const canEditCatalog = isOwner || has('catalog');
  const canEditAgenda = isOwner || has('agenda');
  const canManageTeam = isOwner || has('team');

  // Planejamento/tarefas seguem a regra atual (dono ou PRO). Fora do escopo desta mudança.
  const canEditPlanning = isOwner || isPro;

  // Limite de faixas é do PERFIL: o dono PRO libera ilimitado pra todos que editam.
  const profilePro = PAYWALL_DISABLED ? true : isOwner ? isPro : !!ownerIsPro;

  return {
    isPaid,
    isOwner,
    canEditCatalog,
    canEditAgenda,
    canManageTeam,
    viewPlanning: isPaid,
    editPlanning: isPaid && canEditPlanning,
    manageTasks: isPaid && canEditPlanning,
    useNytaMaestra: isPaid && canEditPlanning,
    useNytaConsultora: isPro,
    maxCatalogTracks: profilePro ? Infinity : FREE_MAX_CATALOG_TRACKS,
  };
}

export function useArtistCapabilities(artist?: Artist | null): ArtistCapabilities {
  const { isPro } = useEntitlements();

  return useMemo(() => {
    // is_locked === true ⇒ perfil pendente de pagamento. Qualquer outro valor ⇒ pago/ativo.
    const isPaid = PAYWALL_DISABLED ? true : !!artist && artist.is_locked !== true;
    const isOwner = !artist || artist.role !== 'member';
    return deriveArtistCapabilities({
      isPro,
      isPaid,
      isOwner,
      accessLevels: artist?.access_levels,
      ownerIsPro: artist?.owner_is_pro,
    });
  }, [artist, isPro]);
}

export default useArtistCapabilities;
