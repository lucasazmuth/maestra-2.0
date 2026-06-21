import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CanCreateArtistResult {
  canCreate: boolean;
  reason: 'pending_limit' | 'cooldown' | 'error' | null;
  pendingCount: number;
  pendingLimit: number;
  cooldownRemainingSeconds: number;
  cooldownTotalSeconds: number;
  deletions30d: number;
  loading: boolean;
  error: boolean;
  retry: () => void;
}

// ─── RPC response shape ───────────────────────────────────────────────────────

interface RateLimitRpcResponse {
  can_create: boolean;
  pending_count: number;
  pending_limit: number;
  cooldown_remaining_seconds: number;
  cooldown_total_seconds: number;
  deletions_30d: number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook que verifica se o usuário autenticado pode criar um novo perfil de artista.
 * Chama a RPC `check_artist_rate_limit` no mount e expõe estado reativo com:
 * - Timer de countdown que decrementa cooldownRemainingSeconds a cada 60s
 * - Auto-refresh quando cooldown expira
 * - Função retry() para erro de rede
 */
export function useCanCreateArtist(): CanCreateArtistResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [reason, setReason] = useState<CanCreateArtistResult['reason']>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingLimit, setPendingLimit] = useState(3);
  const [cooldownRemainingSeconds, setCooldownRemainingSeconds] = useState(0);
  const [cooldownTotalSeconds, setCooldownTotalSeconds] = useState(0);
  const [deletions30d, setDeletions30d] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // ─── Determine reason from state ─────────────────────────────────────────────

  const computeReason = useCallback(
    (pending: number, limit: number, remaining: number): CanCreateArtistResult['reason'] => {
      if (pending >= limit) return 'pending_limit';
      if (remaining > 0) return 'cooldown';
      return null;
    },
    []
  );

  // ─── Fetch RPC ────────────────────────────────────────────────────────────────

  const fetchRateLimit = useCallback(async () => {
    if (!mountedRef.current) return;

    setLoading(true);
    setError(false);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      if (!userId) {
        setError(true);
        setCanCreate(false);
        setReason('error');
        setLoading(false);
        return;
      }

      const { data, error: rpcError } = await supabase.rpc('check_artist_rate_limit', {
        p_user_id: userId,
      });

      if (!mountedRef.current) return;

      if (rpcError || !data) {
        setError(true);
        setCanCreate(false);
        setReason('error');
        setLoading(false);
        return;
      }

      const result = data as unknown as RateLimitRpcResponse;

      setPendingCount(result.pending_count);
      setPendingLimit(result.pending_limit);
      setCooldownRemainingSeconds(result.cooldown_remaining_seconds);
      setCooldownTotalSeconds(result.cooldown_total_seconds);
      setDeletions30d(result.deletions_30d);

      const newReason = computeReason(
        result.pending_count,
        result.pending_limit,
        result.cooldown_remaining_seconds
      );
      setReason(newReason);
      setCanCreate(result.pending_count < result.pending_limit && result.cooldown_remaining_seconds === 0);
      setLoading(false);
    } catch {
      if (!mountedRef.current) return;
      setError(true);
      setCanCreate(false);
      setReason('error');
      setLoading(false);
    }
  }, [computeReason]);

  // ─── Countdown timer (every 60s) ─────────────────────────────────────────────

  useEffect(() => {
    // Only start timer if there's an active cooldown and no pending_limit blocking
    if (cooldownRemainingSeconds <= 0 || reason !== 'cooldown' || loading) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setCooldownRemainingSeconds((prev) => {
        const next = Math.max(0, prev - 60);
        if (next === 0) {
          // Cooldown expired — auto-refresh
          fetchRateLimit();
        }
        return next;
      });
    }, 60_000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [cooldownRemainingSeconds, reason, loading, fetchRateLimit]);

  // ─── Initial fetch on mount ───────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    fetchRateLimit();

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Retry function for network errors ────────────────────────────────────────

  const retry = useCallback(() => {
    fetchRateLimit();
  }, [fetchRateLimit]);

  return {
    canCreate,
    reason,
    pendingCount,
    pendingLimit,
    cooldownRemainingSeconds,
    cooldownTotalSeconds,
    deletions30d,
    loading,
    error,
    retry,
  };
}

export default useCanCreateArtist;
