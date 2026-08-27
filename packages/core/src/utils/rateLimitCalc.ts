/**
 * Pure utility functions for artist creation rate limit calculations.
 *
 * All functions are deterministic, side-effect free, and depend only on their arguments.
 * These encapsulate the business logic for cooldown, pending limits, and restriction priority.
 */

/**
 * Computes the cooldown duration in seconds based on the number of pending profile
 * deletions in the last 30 days.
 *
 * - 0 deletions → 0 seconds (no cooldown)
 * - 1 deletion → 600 seconds (10 minutes)
 * - 2–4 deletions → 86400 seconds (24 hours)
 * - 5+ deletions → 604800 seconds (7 days)
 */
export function computeCooldown(deletionCount: number): number {
  if (deletionCount <= 0) return 0;
  if (deletionCount === 1) return 600;
  if (deletionCount <= 4) return 86400;
  return 604800;
}

/**
 * Computes the remaining seconds of an active cooldown.
 *
 * Returns max(0, cooldownSeconds - elapsed), where elapsed is the time in seconds
 * between `lastCreatedAt` and `now`.
 *
 * If cooldownSeconds is 0, always returns 0 (no cooldown active).
 */
export function computeRemainingSeconds(
  lastCreatedAt: Date,
  cooldownSeconds: number,
  now: Date
): number {
  if (cooldownSeconds === 0) return 0;
  const elapsedMs = now.getTime() - lastCreatedAt.getTime();
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  return Math.max(0, cooldownSeconds - elapsedSeconds);
}

/**
 * Determines whether the user can create a new artist profile.
 *
 * Creation is allowed only when:
 * - pendingCount is less than 3 (the pending limit)
 * - remainingSeconds is exactly 0 (no active cooldown)
 */
export function canCreate(pendingCount: number, remainingSeconds: number): boolean {
  return pendingCount < 3 && remainingSeconds === 0;
}

/**
 * Determines which restriction has priority when multiple restrictions apply.
 *
 * - If pending limit is reached → 'pending_limit' (highest priority)
 * - Else if cooldown is active → 'cooldown'
 * - Else → null (no restriction)
 */
export function getRestrictionPriority(
  pendingBlocked: boolean,
  cooldownBlocked: boolean
): 'pending_limit' | 'cooldown' | null {
  if (pendingBlocked) return 'pending_limit';
  if (cooldownBlocked) return 'cooldown';
  return null;
}

/**
 * Formats remaining cooldown seconds into a human-readable Portuguese string.
 *
 * - >= 86400 seconds → format as days (e.g., "2 dias", "1 dia")
 * - >= 3600 seconds → format as hours (e.g., "3 horas", "1 hora")
 * - < 3600 seconds → format as minutes (e.g., "10 minutos", "1 minuto")
 *
 * Uses ceiling (rounds up) so the user always sees at least 1 unit.
 */
export function formatRemainingTime(seconds: number): string {
  if (seconds >= 86400) {
    const days = Math.ceil(seconds / 86400);
    return days === 1 ? '1 dia' : `${days} dias`;
  }
  if (seconds >= 3600) {
    const hours = Math.ceil(seconds / 3600);
    return hours === 1 ? '1 hora' : `${hours} horas`;
  }
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? '1 minuto' : `${minutes} minutos`;
}
