/**
 * Política única de "frescor" do enriquecimento Chartmetric (front).
 * Espelha o guard da edge function `artist-enrich-chartmetric`.
 *
 * Cada chamada ao Chartmetric custa crédito. Dados profundos (gênero/similares/audiência) mudam
 * devagar, então só re-enriquecemos a cada 30 dias OU quando faltam dados — e nunca em loop a
 * cada entrada de tela. Não há refresh manual pelo usuário (evita cliques repetidos gerarem custo);
 * o `force` existe só para uso interno/admin. A atualização é automática (lazy, no acesso) e
 * guardada no backend.
 */

export const CHARTMETRIC_TTL_DAYS = 30;

export interface ChartmetricProfileLite {
  cm_artist_id?: number | null;
  enriched?: boolean;
  enriched_at?: string;
  fetched_at?: string;
  cm_not_found?: boolean;
  cm_not_found_at?: string;
}

const NOT_FOUND_TTL_MS = 7 * 86400_000;

/**
 * Decide se vale disparar o enrich profundo.
 * - `force` (botão manual): sempre true.
 * - sem perfil, ou ainda não enriquecido (só diagnóstico básico): true.
 * - enriquecido há > 30 dias: true.
 * - marcado como cm_not_found há < 7 dias: false (não re-tenta).
 * - caso contrário (enriquecido e fresco): false.
 */
export function shouldEnrichChartmetric(
  cm: ChartmetricProfileLite | undefined | null,
  opts?: { force?: boolean },
): boolean {
  if (opts?.force) return true;
  if (!cm) return true;
  if (cm.cm_not_found && cm.cm_not_found_at &&
    Date.now() - new Date(cm.cm_not_found_at).getTime() < NOT_FOUND_TTL_MS) {
    return false;
  }
  if (!cm.enriched || !cm.enriched_at) return true;
  return Date.now() - new Date(cm.enriched_at).getTime() > CHARTMETRIC_TTL_DAYS * 86400_000;
}
