import { supabase } from '../../lib/supabase';
import type { NotificationItem } from '../../interfaces/maestra';

const TABLE = 'notifications';
const PAGE_SIZE = 30;

export interface PaginatedNotifications {
  items: NotificationItem[];
  hasMore: boolean;
}

/**
 * Fetch paginated notifications for a user, ordered by most recent first.
 * Supports offset-based pagination with a page size of 30.
 */
export const listNotificationsPaginated = async (
  userId: string,
  page: number = 0
): Promise<PaginatedNotifications> => {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE; // fetch one extra to check if there are more

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;

  const items = (data || []) as NotificationItem[];
  const hasMore = items.length > PAGE_SIZE;

  return {
    items: hasMore ? items.slice(0, PAGE_SIZE) : items,
    hasMore,
  };
};

/**
 * Legacy: fetch all notifications (no pagination).
 */
export const listNotifications = async (userId: string): Promise<NotificationItem[]> => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as NotificationItem[];
};

/**
 * Fetch artist names for a set of artist IDs (for grouping display).
 */
export const fetchArtistNames = async (
  artistIds: string[]
): Promise<Record<string, string>> => {
  if (!artistIds.length) return {};
  const { data, error } = await supabase
    .from('artists')
    .select('id, name')
    .in('id', artistIds);
  if (error) throw error;
  const map: Record<string, string> = {};
  (data || []).forEach((row: { id: string; name: string }) => {
    map[row.id] = row.name;
  });
  return map;
};

export const markAsRead = async (id: string): Promise<void> => {
  const { error } = await supabase.from(TABLE).update({ read: true }).eq('id', id);
  if (error) throw error;
};

export const markAllAsRead = async (userId: string): Promise<void> => {
  const { error } = await supabase
    .from(TABLE)
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) throw error;
};

export const clearNotifications = async (userId: string): Promise<void> => {
  const { error } = await supabase.from(TABLE).delete().eq('user_id', userId);
  if (error) throw error;
};
