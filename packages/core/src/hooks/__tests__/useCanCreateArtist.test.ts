/**
 * Unit Tests for useCanCreateArtist hook
 * Feature: artist-creation-rate-limit, Task 7.1
 *
 * Tests loading state, canCreate true/false, retry, countdown timer,
 * and auto-refresh when cooldown expires.
 *
 * Validates: Requirements 5.1, 5.2, 5.4, 5.5
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useCanCreateArtist } from '../useCanCreateArtist';
import { supabase } from '../../lib/supabase';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
    rpc: jest.fn(),
  },
}));

const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockSession = (userId = 'user-123') => {
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: userId } } },
  });
};

const mockRpcSuccess = (overrides: Partial<{
  can_create: boolean;
  pending_count: number;
  pending_limit: number;
  cooldown_remaining_seconds: number;
  cooldown_total_seconds: number;
  deletions_30d: number;
}> = {}) => {
  mockRpc.mockResolvedValue({
    data: {
      can_create: true,
      pending_count: 0,
      pending_limit: 3,
      cooldown_remaining_seconds: 0,
      cooldown_total_seconds: 0,
      deletions_30d: 0,
      ...overrides,
    },
    error: null,
  });
};

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useCanCreateArtist', () => {
  describe('loading state', () => {
    test('shows loading: true initially, then loading: false after RPC resolves', async () => {
      mockSession();
      mockRpcSuccess();

      const { result } = renderHook(() => useCanCreateArtist());

      // Initially loading
      expect(result.current.loading).toBe(true);

      // After RPC resolves
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('canCreate: true (no restrictions)', () => {
    test('canCreate is true when RPC returns can_create=true with no cooldown or pending limit', async () => {
      mockSession();
      mockRpcSuccess({
        can_create: true,
        pending_count: 1,
        pending_limit: 3,
        cooldown_remaining_seconds: 0,
        cooldown_total_seconds: 0,
        deletions_30d: 0,
      });

      const { result } = renderHook(() => useCanCreateArtist());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.canCreate).toBe(true);
      expect(result.current.reason).toBeNull();
      expect(result.current.pendingCount).toBe(1);
      expect(result.current.pendingLimit).toBe(3);
      expect(result.current.error).toBe(false);
    });
  });

  describe('canCreate: false with reason=pending_limit', () => {
    test('canCreate is false when pending_count >= pending_limit', async () => {
      mockSession();
      mockRpcSuccess({
        can_create: false,
        pending_count: 3,
        pending_limit: 3,
        cooldown_remaining_seconds: 0,
        cooldown_total_seconds: 0,
        deletions_30d: 2,
      });

      const { result } = renderHook(() => useCanCreateArtist());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.canCreate).toBe(false);
      expect(result.current.reason).toBe('pending_limit');
      expect(result.current.pendingCount).toBe(3);
    });
  });

  describe('canCreate: false with reason=cooldown', () => {
    test('canCreate is false when cooldown_remaining_seconds > 0', async () => {
      mockSession();
      mockRpcSuccess({
        can_create: false,
        pending_count: 1,
        pending_limit: 3,
        cooldown_remaining_seconds: 300,
        cooldown_total_seconds: 600,
        deletions_30d: 1,
      });

      const { result } = renderHook(() => useCanCreateArtist());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.canCreate).toBe(false);
      expect(result.current.reason).toBe('cooldown');
      expect(result.current.cooldownRemainingSeconds).toBe(300);
      expect(result.current.cooldownTotalSeconds).toBe(600);
      expect(result.current.deletions30d).toBe(1);
    });
  });

  describe('canCreate: false with reason=error', () => {
    test('canCreate is false and error is true when RPC call fails', async () => {
      mockSession();
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Network error' },
      });

      const { result } = renderHook(() => useCanCreateArtist());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.canCreate).toBe(false);
      expect(result.current.reason).toBe('error');
      expect(result.current.error).toBe(true);
    });

    test('canCreate is false when session has no userId', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
      });

      const { result } = renderHook(() => useCanCreateArtist());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.canCreate).toBe(false);
      expect(result.current.reason).toBe('error');
      expect(result.current.error).toBe(true);
    });
  });

  describe('retry()', () => {
    test('retry re-triggers the RPC call', async () => {
      mockSession();
      // First call: error
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Network error' },
      });

      const { result } = renderHook(() => useCanCreateArtist());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe(true);
      expect(result.current.canCreate).toBe(false);

      // Setup success for retry
      mockRpcSuccess({ can_create: true, pending_count: 0 });

      // Call retry
      await act(async () => {
        result.current.retry();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe(false);
      expect(result.current.canCreate).toBe(true);
      expect(result.current.reason).toBeNull();
      // getSession called twice (initial + retry), rpc called twice
      expect(mockGetSession).toHaveBeenCalledTimes(2);
      expect(mockRpc).toHaveBeenCalledTimes(2);
    });
  });

  describe('countdown timer', () => {
    test('decrements cooldownRemainingSeconds every 60 seconds', async () => {
      mockSession();
      mockRpcSuccess({
        can_create: false,
        pending_count: 1,
        pending_limit: 3,
        cooldown_remaining_seconds: 180,
        cooldown_total_seconds: 600,
        deletions_30d: 1,
      });

      const { result } = renderHook(() => useCanCreateArtist());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.cooldownRemainingSeconds).toBe(180);

      // Advance 60 seconds
      act(() => {
        jest.advanceTimersByTime(60_000);
      });

      expect(result.current.cooldownRemainingSeconds).toBe(120);

      // Advance another 60 seconds
      act(() => {
        jest.advanceTimersByTime(60_000);
      });

      expect(result.current.cooldownRemainingSeconds).toBe(60);
    });
  });

  describe('auto-refresh when countdown reaches 0', () => {
    test('re-calls RPC when cooldown expires', async () => {
      mockSession();
      mockRpcSuccess({
        can_create: false,
        pending_count: 1,
        pending_limit: 3,
        cooldown_remaining_seconds: 60,
        cooldown_total_seconds: 600,
        deletions_30d: 1,
      });

      const { result } = renderHook(() => useCanCreateArtist());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.cooldownRemainingSeconds).toBe(60);

      // Prepare next RPC response (after cooldown expires, server says can_create=true)
      mockRpcSuccess({
        can_create: true,
        pending_count: 1,
        pending_limit: 3,
        cooldown_remaining_seconds: 0,
        cooldown_total_seconds: 0,
        deletions_30d: 1,
      });

      // Advance timer to trigger countdown reaching 0
      act(() => {
        jest.advanceTimersByTime(60_000);
      });

      // The countdown should reach 0 and trigger fetchRateLimit
      expect(result.current.cooldownRemainingSeconds).toBe(0);

      // Wait for the auto-refresh RPC call to resolve
      await waitFor(() => {
        expect(result.current.canCreate).toBe(true);
      });

      expect(result.current.reason).toBeNull();
      // Initial call + auto-refresh call
      expect(mockRpc).toHaveBeenCalledTimes(2);
    });
  });
});
