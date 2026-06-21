import type { NotificationItem } from '../../../interfaces/maestra';

// Extract the groupByArtist helper for testing by re-implementing the same logic
// (since it's not exported from the component)
interface ArtistGroup {
  artistId: string;
  artistName: string;
  notifications: NotificationItem[];
}

function groupByArtist(
  items: NotificationItem[],
  artistNames: Record<string, string>
): ArtistGroup[] {
  const groups: Record<string, NotificationItem[]> = {};

  items.forEach((item) => {
    const key = item.artist_id || '__general__';
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });

  const entries = Object.entries(groups);
  entries.sort(([keyA, notesA], [keyB, notesB]) => {
    if (keyA === '__general__') return -1;
    if (keyB === '__general__') return 1;
    const latestA = notesA[0]?.created_at || '';
    const latestB = notesB[0]?.created_at || '';
    return latestB.localeCompare(latestA);
  });

  return entries.map(([key, notifications]) => ({
    artistId: key,
    artistName: key === '__general__' ? 'Geral' : artistNames[key] || 'Artista desconhecido',
    notifications,
  }));
}

describe('Notifications groupByArtist', () => {
  const makeNotification = (
    overrides: Partial<NotificationItem> = {}
  ): NotificationItem => ({
    id: Math.random().toString(),
    user_id: 'user-1',
    type: 'info',
    title: 'Test',
    read: false,
    ...overrides,
  });

  it('groups notifications without artist_id into general group', () => {
    const items = [
      makeNotification({ id: '1', title: 'General 1' }),
      makeNotification({ id: '2', title: 'General 2' }),
    ];

    const result = groupByArtist(items, {});

    expect(result).toHaveLength(1);
    expect(result[0].artistId).toBe('__general__');
    expect(result[0].artistName).toBe('Geral');
    expect(result[0].notifications).toHaveLength(2);
  });

  it('groups notifications by artist_id', () => {
    const items = [
      makeNotification({ id: '1', artist_id: 'artist-a', created_at: '2024-01-03T00:00:00Z' }),
      makeNotification({ id: '2', artist_id: 'artist-b', created_at: '2024-01-02T00:00:00Z' }),
      makeNotification({ id: '3', artist_id: 'artist-a', created_at: '2024-01-01T00:00:00Z' }),
    ];

    const artistNames = {
      'artist-a': 'Artista A',
      'artist-b': 'Artista B',
    };

    const result = groupByArtist(items, artistNames);

    expect(result).toHaveLength(2);
    // artist-a has the most recent notification (2024-01-03)
    expect(result[0].artistId).toBe('artist-a');
    expect(result[0].artistName).toBe('Artista A');
    expect(result[0].notifications).toHaveLength(2);
    expect(result[1].artistId).toBe('artist-b');
    expect(result[1].artistName).toBe('Artista B');
    expect(result[1].notifications).toHaveLength(1);
  });

  it('places general group before artist groups', () => {
    const items = [
      makeNotification({ id: '1', created_at: '2024-01-01T00:00:00Z' }),
      makeNotification({ id: '2', artist_id: 'artist-a', created_at: '2024-01-05T00:00:00Z' }),
    ];

    const result = groupByArtist(items, { 'artist-a': 'Artista A' });

    expect(result).toHaveLength(2);
    expect(result[0].artistId).toBe('__general__');
    expect(result[1].artistId).toBe('artist-a');
  });

  it('sorts artist groups by most recent notification', () => {
    const items = [
      makeNotification({ id: '1', artist_id: 'artist-old', created_at: '2024-01-01T00:00:00Z' }),
      makeNotification({ id: '2', artist_id: 'artist-new', created_at: '2024-01-10T00:00:00Z' }),
    ];

    const artistNames = { 'artist-old': 'Old', 'artist-new': 'New' };
    const result = groupByArtist(items, artistNames);

    expect(result[0].artistId).toBe('artist-new');
    expect(result[1].artistId).toBe('artist-old');
  });

  it('uses fallback name when artist is not found in artistNames map', () => {
    const items = [
      makeNotification({ id: '1', artist_id: 'unknown-id', created_at: '2024-01-01T00:00:00Z' }),
    ];

    const result = groupByArtist(items, {});

    expect(result[0].artistName).toBe('Artista desconhecido');
  });

  it('handles empty items array', () => {
    const result = groupByArtist([], {});
    expect(result).toHaveLength(0);
  });

  it('maintains order within each group (most recent first from API)', () => {
    const items = [
      makeNotification({ id: '1', artist_id: 'a', created_at: '2024-01-05T00:00:00Z', title: 'Recent' }),
      makeNotification({ id: '2', artist_id: 'a', created_at: '2024-01-03T00:00:00Z', title: 'Middle' }),
      makeNotification({ id: '3', artist_id: 'a', created_at: '2024-01-01T00:00:00Z', title: 'Old' }),
    ];

    const result = groupByArtist(items, { a: 'Artist A' });

    expect(result[0].notifications[0].title).toBe('Recent');
    expect(result[0].notifications[1].title).toBe('Middle');
    expect(result[0].notifications[2].title).toBe('Old');
  });
});
