import { useMemo } from 'react';

import type { Artist } from '../interfaces/maestra';
import { useArtistCapabilities } from './useArtistCapabilities';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CanAddTrackResult {
  /** Se true, o usuário pode criar novas faixas manuais */
  canAdd: boolean;
  /** Contagem atual de faixas manuais (passada como input) */
  currentCount: number;
  /** Limite máximo de faixas do plano (10 para free, Infinity para pro) */
  maxTracks: number;
  /** Se deve exibir o modal de upsell ao tentar criar */
  shouldShowUpsell: boolean;
  /**
   * Modo somente leitura pós-downgrade: conta não é PRO e o perfil tem mais de
   * 10 faixas ativas (cenário de downgrade). As faixas existentes ficam acessíveis
   * para visualização mas não podem ser editadas/excluídas; novas faixas são bloqueadas.
   */
  isReadOnlyMode: boolean;
}

// ─── Pure Derivation Function ─────────────────────────────────────────────────

/**
 * Função pura que deriva se o usuário pode adicionar faixas ao catálogo.
 * Extraída do hook para facilitar testes unitários e property-based tests.
 *
 * @param currentCount - Número atual de faixas manuais do artista
 * @param maxCatalogTracks - Limite máximo de faixas do plano
 */
export function deriveCanAddTrack(
  currentCount: number,
  maxCatalogTracks: number
): CanAddTrackResult {
  // Modo somente leitura pós-downgrade: conta não é PRO (maxCatalogTracks é finito)
  // e o perfil tem mais faixas ativas que o limite permitido.
  // Isso acontece quando o usuário tinha PRO, adicionou faixas > 10, e depois cancelou.
  const isReadOnlyMode =
    maxCatalogTracks !== Infinity && currentCount > maxCatalogTracks;

  if (currentCount < maxCatalogTracks) {
    return {
      canAdd: true,
      currentCount,
      maxTracks: maxCatalogTracks,
      shouldShowUpsell: false,
      isReadOnlyMode: false,
    };
  }
  return {
    canAdd: false,
    currentCount,
    maxTracks: maxCatalogTracks,
    shouldShowUpsell: true,
    isReadOnlyMode,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook que verifica se o usuário pode adicionar novas faixas manuais ao catálogo.
 * Considera o limite do plano (10 sem PRO / ∞ com PRO) E a permissão de edição do
 * artista (colaborador sem PRO não adiciona, mesmo abaixo do limite).
 *
 * Também expõe `isReadOnlyMode` para o cenário de downgrade: conta não-PRO com
 * mais de 10 faixas ativas — as faixas ficam acessíveis somente-leitura.
 *
 * @param currentCount - Número atual de faixas manuais do artista
 * @param artist - Artista em contexto (para checar permissão de edição)
 */
export function useCanAddTrack(currentCount: number, artist?: Artist | null): CanAddTrackResult {
  const { maxCatalogTracks, canEdit } = useArtistCapabilities(artist);

  return useMemo(() => {
    const base = deriveCanAddTrack(currentCount, maxCatalogTracks);
    if (!canEdit) {
      // Somente-leitura: não pode adicionar, e não é caso de upsell de limite.
      return { ...base, canAdd: false, shouldShowUpsell: false };
    }
    return base;
  }, [currentCount, maxCatalogTracks, canEdit]);
}
