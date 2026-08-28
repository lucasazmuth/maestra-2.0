import { useEffect, useRef, useMemo } from 'react';

import { useAppSelector, useAppDispatch } from '../store/store';
import { fetchSubscriptionStatus } from '../store/slices/subscription';
import { useEntitlements } from './useEntitlements';
import { PAYWALL_DISABLED } from '../constants/maestra';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SubscriptionGuardResult {
  hasAccess: boolean;
  reason: string;
  shouldShowBanner: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POLLING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos

// ─── Cache para fallback ──────────────────────────────────────────────────────

interface CachedStatus {
  hasAccess: boolean;
  reason: string;
  shouldShowBanner: boolean;
  timestamp: number;
}

let lastKnownGoodStatus: CachedStatus | null = null;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSubscriptionGuard(): SubscriptionGuardResult {
  const dispatch = useAppDispatch();
  const { plan } = useEntitlements();

  const status = useAppSelector((state) => state.subscription.status);
  const loading = useAppSelector((state) => state.subscription.loading);
  const error = useAppSelector((state) => state.subscription.error);

  const hasInitialLoadRef = useRef(false);

  // Marca que o carregamento inicial aconteceu
  useEffect(() => {
    if (!loading && !hasInitialLoadRef.current) {
      hasInitialLoadRef.current = true;
    }
  }, [loading]);

  // Buscar status na montagem do componente
  useEffect(() => {
    if (PAYWALL_DISABLED) return;
    dispatch(fetchSubscriptionStatus());
  }, [dispatch]);

  // Polling a cada 5 minutos
  useEffect(() => {
    if (PAYWALL_DISABLED) return;
    const interval = setInterval(() => {
      dispatch(fetchSubscriptionStatus());
    }, POLLING_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [dispatch]);

  // Computar resultado de acesso via useEntitlements
  const result = useMemo((): SubscriptionGuardResult => {
    if (PAYWALL_DISABLED) {
      return { hasAccess: true, reason: 'Paywall desativado (dev)', shouldShowBanner: false };
    }

    // Se houve erro e não temos status confiável, usar cache
    if (error && !hasInitialLoadRef.current) {
      if (lastKnownGoodStatus) {
        const cacheAge = Date.now() - lastKnownGoodStatus.timestamp;
        if (cacheAge < CACHE_TTL_MS) {
          return {
            hasAccess: lastKnownGoodStatus.hasAccess,
            reason: lastKnownGoodStatus.reason,
            shouldShowBanner: lastKnownGoodStatus.shouldShowBanner,
          };
        }
      }

      // Cache expirado ou indisponível - bloquear acesso
      return {
        hasAccess: false,
        reason: 'Indisponibilidade temporária - tente novamente',
        shouldShowBanner: false,
      };
    }

    return {
      hasAccess: plan === 'pro',
      reason: plan === 'pro' ? 'Assinatura ativa' : 'Plano gratuito',
      shouldShowBanner: status === 'overdue' && plan === 'pro', // grace period
    };
  }, [plan, status, error]);

  // Atualizar cache quando temos um resultado bem-sucedido
  useEffect(() => {
    if (!error && hasInitialLoadRef.current) {
      lastKnownGoodStatus = {
        hasAccess: result.hasAccess,
        reason: result.reason,
        shouldShowBanner: result.shouldShowBanner,
        timestamp: Date.now(),
      };
    }
  }, [result, error]);

  return result;
}

export default useSubscriptionGuard;
