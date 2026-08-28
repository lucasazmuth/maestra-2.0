import { useMemo } from 'react';

import { useAppSelector } from '../store/store';
import { PAYWALL_DISABLED } from '../constants/maestra';
import type { SubscriptionState } from '../store/slices/subscription';

// ─── Types ────────────────────────────────────────────────────────────────────
// Eixo CONTA (assinatura PRO R$39,90/mês). O eixo PERFIL (cobrança única R$199,90)
// e o papel do usuário (dono/colaborador) ficam em useArtistCapabilities.

export type Plan = 'free' | 'pro';

export interface Entitlements {
  plan: Plan;
  isPro: boolean; // assinatura PRO ativa (ou em carência)
  maxCatalogTracks: number; // 10 (sem PRO) | Infinity (PRO) — por perfil, mas o gate é a conta
}

// ─── Pure Derivation Function ─────────────────────────────────────────────────

export const FREE_MAX_CATALOG_TRACKS = 10;

export function deriveEntitlements(
  status: SubscriptionState['status'],
  gracePeriodEndsAt: string | null,
  now: number = Date.now()
): Entitlements {
  if (PAYWALL_DISABLED) {
    return { plan: 'pro', isPro: true, maxCatalogTracks: Infinity };
  }

  const isPro =
    status === 'active' ||
    (status === 'overdue' &&
      gracePeriodEndsAt !== null &&
      now <= new Date(gracePeriodEndsAt).getTime());

  return {
    plan: isPro ? 'pro' : 'free',
    isPro,
    maxCatalogTracks: isPro ? Infinity : FREE_MAX_CATALOG_TRACKS,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useEntitlements(): Entitlements {
  const status = useAppSelector((state) => state.subscription.status);
  const gracePeriodEndsAt = useAppSelector((state) => state.subscription.gracePeriodEndsAt);

  return useMemo(
    () => deriveEntitlements(status, gracePeriodEndsAt),
    [status, gracePeriodEndsAt]
  );
}
