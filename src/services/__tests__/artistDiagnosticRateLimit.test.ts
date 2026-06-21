/**
 * Unit Tests for Edge Function Rate Limit Layer
 * Feature: artist-creation-rate-limit
 *
 * Since the edge function runs on Deno/Supabase and can't be directly imported
 * in Jest, we test the rate limit decision logic as a pure function that
 * replicates the logic from the edge function handler.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.5, 4.6
 */

// ─── Types ────────────────────────────────────────────────────────────────────

interface RateLimitInput {
  pendingCount: number | null;
  pendingError: boolean;
  deletionCount: number | null;
  deletionError: boolean;
  lastCreatedAt: string | null;
  lastError: boolean;
  selfDuplicate: { id: string; name: string; content: any; is_locked: boolean } | null;
}

interface RateLimitResult {
  status: number;
  body: Record<string, any>;
}

// ─── Pure function replicating edge function rate limit logic ──────────────────

function evaluateRateLimit(input: RateLimitInput, hasJwt: boolean): RateLimitResult {
  // 1. No JWT → 401
  if (!hasJwt) {
    return { status: 401, body: { error: 'Não autorizado' } };
  }

  // 2. DB error on pending count → 500 (fail closed)
  if (input.pendingError || input.pendingCount === null) {
    return { status: 500, body: { error: 'Erro ao verificar limites' } };
  }

  // 3. Pending limit → 429
  if (input.pendingCount >= 3) {
    return {
      status: 429,
      body: {
        error: 'Limite de perfis pendentes atingido',
        reason: 'pending_limit',
        pending_count: input.pendingCount,
      },
    };
  }

  // 4. DB error on deletions → 500 (fail closed)
  if (input.deletionError) {
    return { status: 500, body: { error: 'Erro ao verificar limites' } };
  }

  // 5. Cooldown check
  const deletionCount = input.deletionCount ?? 0;
  const cooldownSeconds =
    deletionCount === 0
      ? 0
      : deletionCount === 1
      ? 600
      : deletionCount <= 4
      ? 86400
      : 604800;

  if (cooldownSeconds > 0 && input.lastCreatedAt) {
    if (input.lastError) {
      return { status: 500, body: { error: 'Erro ao verificar limites' } };
    }
    const elapsed = (Date.now() - new Date(input.lastCreatedAt).getTime()) / 1000;
    const remaining = Math.ceil(cooldownSeconds - elapsed);
    if (remaining > 0) {
      return {
        status: 429,
        body: {
          error: 'Cooldown ativo',
          reason: 'cooldown',
          remaining_seconds: remaining,
          deletion_count: deletionCount,
        },
      };
    }
  }

  // 6. Self-duplicate → return existing profile
  if (input.selfDuplicate) {
    return {
      status: 200,
      body: {
        artistId: input.selfDuplicate.id,
        reused: true,
        locked: input.selfDuplicate.is_locked,
      },
    };
  }

  // 7. Pass — no restriction
  return { status: 200, body: { pass: true } };
}

// ─── Default valid input (no restrictions) ────────────────────────────────────

const defaultInput: RateLimitInput = {
  pendingCount: 0,
  pendingError: false,
  deletionCount: 0,
  deletionError: false,
  lastCreatedAt: null,
  lastError: false,
  selfDuplicate: null,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Edge Function Rate Limit Layer', () => {
  // ─── Requirement 4.6: JWT ausente → 401 ──────────────────────────────────

  describe('HTTP 401 — No JWT', () => {
    test('returns 401 when JWT is absent', () => {
      const result = evaluateRateLimit(defaultInput, false);
      expect(result.status).toBe(401);
      expect(result.body.error).toBe('Não autorizado');
    });

    test('returns 401 regardless of other input state', () => {
      const input: RateLimitInput = {
        pendingCount: 5,
        pendingError: true,
        deletionCount: 10,
        deletionError: true,
        lastCreatedAt: new Date().toISOString(),
        lastError: true,
        selfDuplicate: { id: 'abc', name: 'Artist', content: {}, is_locked: false },
      };
      const result = evaluateRateLimit(input, false);
      expect(result.status).toBe(401);
    });
  });

  // ─── Requirement 4.2: Pending limit → 429 ────────────────────────────────

  describe('HTTP 429 — pending_limit', () => {
    test('returns 429 with reason "pending_limit" when pendingCount >= 3', () => {
      const input: RateLimitInput = { ...defaultInput, pendingCount: 3 };
      const result = evaluateRateLimit(input, true);

      expect(result.status).toBe(429);
      expect(result.body.reason).toBe('pending_limit');
      expect(result.body.pending_count).toBe(3);
      expect(result.body.error).toBe('Limite de perfis pendentes atingido');
    });

    test('returns 429 when pendingCount is well above the limit', () => {
      const input: RateLimitInput = { ...defaultInput, pendingCount: 10 };
      const result = evaluateRateLimit(input, true);

      expect(result.status).toBe(429);
      expect(result.body.reason).toBe('pending_limit');
      expect(result.body.pending_count).toBe(10);
    });

    test('does NOT return 429 when pendingCount is 2 (below limit)', () => {
      const input: RateLimitInput = { ...defaultInput, pendingCount: 2 };
      const result = evaluateRateLimit(input, true);

      expect(result.status).not.toBe(429);
    });
  });

  // ─── Requirement 4.3: Cooldown → 429 ─────────────────────────────────────

  describe('HTTP 429 — cooldown', () => {
    test('returns 429 with reason "cooldown" when within cooldown window (1 deletion)', () => {
      // 1 deletion → 600s cooldown; created 1 minute ago → still active
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
      const input: RateLimitInput = {
        ...defaultInput,
        deletionCount: 1,
        lastCreatedAt: oneMinuteAgo,
      };
      const result = evaluateRateLimit(input, true);

      expect(result.status).toBe(429);
      expect(result.body.reason).toBe('cooldown');
      expect(result.body.remaining_seconds).toBeGreaterThan(0);
      expect(result.body.remaining_seconds).toBeLessThanOrEqual(540); // ~9 min
      expect(result.body.deletion_count).toBe(1);
    });

    test('returns 429 with reason "cooldown" when within 24h window (3 deletions)', () => {
      // 3 deletions → 86400s cooldown; created 1 hour ago → still active
      const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
      const input: RateLimitInput = {
        ...defaultInput,
        deletionCount: 3,
        lastCreatedAt: oneHourAgo,
      };
      const result = evaluateRateLimit(input, true);

      expect(result.status).toBe(429);
      expect(result.body.reason).toBe('cooldown');
      expect(result.body.remaining_seconds).toBeGreaterThan(0);
      expect(result.body.deletion_count).toBe(3);
    });

    test('returns 429 with reason "cooldown" when within 7-day window (5+ deletions)', () => {
      // 5 deletions → 604800s cooldown; created 1 day ago → still active
      const oneDayAgo = new Date(Date.now() - 86400 * 1000).toISOString();
      const input: RateLimitInput = {
        ...defaultInput,
        deletionCount: 5,
        lastCreatedAt: oneDayAgo,
      };
      const result = evaluateRateLimit(input, true);

      expect(result.status).toBe(429);
      expect(result.body.reason).toBe('cooldown');
      expect(result.body.remaining_seconds).toBeGreaterThan(0);
      expect(result.body.deletion_count).toBe(5);
    });

    test('does NOT trigger cooldown when elapsed time exceeds cooldown', () => {
      // 1 deletion → 600s cooldown; created 11 minutes ago → cooldown expired
      const elevenMinutesAgo = new Date(Date.now() - 11 * 60 * 1000).toISOString();
      const input: RateLimitInput = {
        ...defaultInput,
        deletionCount: 1,
        lastCreatedAt: elevenMinutesAgo,
      };
      const result = evaluateRateLimit(input, true);

      expect(result.status).toBe(200);
      expect(result.body.pass).toBe(true);
    });

    test('does NOT trigger cooldown when deletionCount is 0', () => {
      const justNow = new Date(Date.now() - 1000).toISOString();
      const input: RateLimitInput = {
        ...defaultInput,
        deletionCount: 0,
        lastCreatedAt: justNow,
      };
      const result = evaluateRateLimit(input, true);

      expect(result.status).toBe(200);
    });
  });

  // ─── Requirement 1.2 (via edge function): Auto-duplicidade ────────────────

  describe('HTTP 200 — self-duplicate (reused profile)', () => {
    test('returns existing profile when self-duplicate is found', () => {
      const input: RateLimitInput = {
        ...defaultInput,
        selfDuplicate: {
          id: 'artist-uuid-123',
          name: 'Test Artist',
          content: { realIndex: 75 },
          is_locked: true,
        },
      };
      const result = evaluateRateLimit(input, true);

      expect(result.status).toBe(200);
      expect(result.body.artistId).toBe('artist-uuid-123');
      expect(result.body.reused).toBe(true);
      expect(result.body.locked).toBe(true);
    });

    test('returns locked: false for an unlocked duplicate', () => {
      const input: RateLimitInput = {
        ...defaultInput,
        selfDuplicate: {
          id: 'paid-artist-456',
          name: 'Paid Artist',
          content: { realIndex: 90 },
          is_locked: false,
        },
      };
      const result = evaluateRateLimit(input, true);

      expect(result.status).toBe(200);
      expect(result.body.reused).toBe(true);
      expect(result.body.locked).toBe(false);
    });
  });

  // ─── Requirement 4.5: DB indisponível → 500 (fail closed) ────────────────

  describe('HTTP 500 — DB unavailable', () => {
    test('returns 500 when pending count query has error flag', () => {
      const input: RateLimitInput = { ...defaultInput, pendingError: true };
      const result = evaluateRateLimit(input, true);

      expect(result.status).toBe(500);
      expect(result.body.error).toBe('Erro ao verificar limites');
    });

    test('returns 500 when pending count is null (DB returned no data)', () => {
      const input: RateLimitInput = { ...defaultInput, pendingCount: null };
      const result = evaluateRateLimit(input, true);

      expect(result.status).toBe(500);
      expect(result.body.error).toBe('Erro ao verificar limites');
    });

    test('returns 500 when deletion count query has error', () => {
      const input: RateLimitInput = { ...defaultInput, deletionError: true };
      const result = evaluateRateLimit(input, true);

      expect(result.status).toBe(500);
      expect(result.body.error).toBe('Erro ao verificar limites');
    });

    test('returns 500 when lastCreatedAt query fails during active cooldown', () => {
      const recentCreation = new Date(Date.now() - 60 * 1000).toISOString();
      const input: RateLimitInput = {
        ...defaultInput,
        deletionCount: 2,
        lastCreatedAt: recentCreation,
        lastError: true,
      };
      const result = evaluateRateLimit(input, true);

      expect(result.status).toBe(500);
      expect(result.body.error).toBe('Erro ao verificar limites');
    });
  });

  // ─── Happy path: no restrictions → 200 pass ──────────────────────────────

  describe('HTTP 200 — pass (no restrictions)', () => {
    test('returns 200 with pass: true when all checks clear', () => {
      const result = evaluateRateLimit(defaultInput, true);

      expect(result.status).toBe(200);
      expect(result.body.pass).toBe(true);
    });

    test('returns 200 with pass: true when pendingCount is 2 and no cooldown', () => {
      const input: RateLimitInput = { ...defaultInput, pendingCount: 2 };
      const result = evaluateRateLimit(input, true);

      expect(result.status).toBe(200);
      expect(result.body.pass).toBe(true);
    });
  });

  // ─── Priority order verification ─────────────────────────────────────────

  describe('Priority order', () => {
    test('401 takes priority over all other checks', () => {
      const input: RateLimitInput = {
        pendingCount: 5,
        pendingError: true,
        deletionCount: 10,
        deletionError: true,
        lastCreatedAt: new Date().toISOString(),
        lastError: true,
        selfDuplicate: { id: 'x', name: 'X', content: {}, is_locked: true },
      };
      const result = evaluateRateLimit(input, false);
      expect(result.status).toBe(401);
    });

    test('500 (pending error) takes priority over 429 pending_limit', () => {
      const input: RateLimitInput = {
        ...defaultInput,
        pendingCount: 5,
        pendingError: true,
      };
      const result = evaluateRateLimit(input, true);
      expect(result.status).toBe(500);
    });

    test('429 pending_limit takes priority over cooldown', () => {
      const recentCreation = new Date(Date.now() - 60 * 1000).toISOString();
      const input: RateLimitInput = {
        ...defaultInput,
        pendingCount: 3,
        deletionCount: 5,
        lastCreatedAt: recentCreation,
      };
      const result = evaluateRateLimit(input, true);
      expect(result.status).toBe(429);
      expect(result.body.reason).toBe('pending_limit');
    });

    test('429 cooldown takes priority over self-duplicate check', () => {
      const recentCreation = new Date(Date.now() - 60 * 1000).toISOString();
      const input: RateLimitInput = {
        ...defaultInput,
        deletionCount: 2,
        lastCreatedAt: recentCreation,
        selfDuplicate: { id: 'dup', name: 'Dup', content: {}, is_locked: true },
      };
      const result = evaluateRateLimit(input, true);
      expect(result.status).toBe(429);
      expect(result.body.reason).toBe('cooldown');
    });
  });
});
