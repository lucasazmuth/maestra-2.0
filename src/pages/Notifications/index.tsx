import { FC, useEffect, useMemo, useState, useCallback } from 'react';
import { message } from 'antd';
import dayjs from 'dayjs';

import { useAppSelector } from '../../store/store';
import { Spinner } from '../../components/spinner/spinner';
import * as notifsDb from '../../services/db/notifications';
import type { NotificationItem, NotificationSource } from '../../interfaces/maestra';

// ─── Constants ────────────────────────────────────────────────────────────────

const typeColor: Record<string, string> = {
  info: '#3b82f6',
  success: '#af2896',
  warning: '#f59e0b',
  error: '#e91429',
};

/** Icons/labels for automated reminder sources */
const sourceConfig: Record<string, { icon: string; label: string; color: string }> = {
  auto_task: { icon: '📋', label: 'Tarefa', color: '#f59e0b' },
  auto_event: { icon: '📅', label: 'Evento', color: '#8b5cf6' },
  auto_metric: { icon: '📊', label: 'Métrica', color: '#06b6d4' },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ArtistGroup {
  artistId: string;
  artistName: string;
  notifications: NotificationItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Groups notifications by artist_id. Items without artist_id go to a "general" group.
 * Within each group, items are already ordered most-recent-first (from the API).
 */
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

  // Sort groups: general first, then by most recent notification in each group
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

// ─── Source Badge Component ───────────────────────────────────────────────────

const SourceBadge: FC<{ source?: NotificationSource }> = ({ source }) => {
  if (!source || source === 'manual') return null;
  const config = sourceConfig[source];
  if (!config) return null;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        fontWeight: 600,
        color: config.color,
        background: `${config.color}1a`,
        borderRadius: 4,
        padding: '2px 6px',
      }}
      aria-label={`Lembrete: ${config.label}`}
    >
      <span aria-hidden="true">{config.icon}</span>
      {config.label}
    </span>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

const Notifications: FC = () => {
  const user = useAppSelector((s) => s.auth.user);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [artistNames, setArtistNames] = useState<Record<string, string>>({});

  // Fetch first page
  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    setPage(0);
    notifsDb
      .listNotificationsPaginated(user.id, 0)
      .then(async (result) => {
        setItems(result.items);
        setHasMore(result.hasMore);
        // Fetch artist names for grouping
        const artistIds = Array.from(
          new Set(result.items.map((n) => n.artist_id).filter(Boolean) as string[])
        );
        if (artistIds.length) {
          const names = await notifsDb.fetchArtistNames(artistIds);
          setArtistNames(names);
        }
      })
      .catch(() => message.error('Erro ao carregar notificações'))
      .finally(() => setLoading(false));
  }, [user?.id]);

  // Load more
  const loadMore = useCallback(async () => {
    if (!user?.id || loadingMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const result = await notifsDb.listNotificationsPaginated(user.id, nextPage);
      setItems((prev) => [...prev, ...result.items]);
      setHasMore(result.hasMore);
      setPage(nextPage);
      // Fetch new artist names if needed
      const existingIds = new Set(Object.keys(artistNames));
      const newArtistIds = Array.from(
        new Set(
          result.items
            .map((n) => n.artist_id)
            .filter((id): id is string => !!id && !existingIds.has(id))
        )
      );
      if (newArtistIds.length) {
        const names = await notifsDb.fetchArtistNames(newArtistIds);
        setArtistNames((prev) => ({ ...prev, ...names }));
      }
    } catch {
      message.error('Erro ao carregar mais notificações');
    } finally {
      setLoadingMore(false);
    }
  }, [user?.id, page, loadingMore, artistNames]);

  const markRead = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await notifsDb.markAsRead(id).catch(() => {});
  };

  const markAll = async () => {
    if (!user?.id) return;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await notifsDb.markAllAsRead(user.id).catch(() => {});
  };

  const clearAll = async () => {
    if (!user?.id) return;
    setItems([]);
    await notifsDb.clearNotifications(user.id).catch(() => {});
  };

  // Group notifications by artist
  const groups = useMemo(() => groupByArtist(items, artistNames), [items, artistNames]);

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <h1
          style={{
            fontFamily: 'SpotifyMixUITitle',
            fontWeight: 800,
            fontSize: 32,
            color: '#fff',
            margin: 0,
          }}
        >
          Notificações
        </h1>
        {!!items.length && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={markAll} style={ghostBtn}>
              Marcar todas como lidas
            </button>
            <button onClick={clearAll} style={{ ...ghostBtn, color: '#e91429' }}>
              Limpar
            </button>
          </div>
        )}
      </div>

      <Spinner loading={loading && !items.length}>
        {!items.length ? (
          <div style={{ color: '#b3b3b3', padding: 32, textAlign: 'center' }}>
            Nenhuma notificação.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {groups.map((group) => (
              <section key={group.artistId} aria-label={`Notificações de ${group.artistName}`}>
                {/* Group header (only show if there are automated notifications) */}
                {group.artistId !== '__general__' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 10,
                      paddingBottom: 6,
                      borderBottom: '1px solid #282828',
                    }}
                  >
                    <span style={{ fontSize: 18 }} aria-hidden="true">
                      🎤
                    </span>
                    <h2
                      style={{
                        color: '#fff',
                        fontSize: 16,
                        fontWeight: 700,
                        margin: 0,
                      }}
                    >
                      {group.artistName}
                    </h2>
                    <span
                      style={{
                        color: '#6b7280',
                        fontSize: 12,
                        marginLeft: 'auto',
                      }}
                    >
                      {group.notifications.length}{' '}
                      {group.notifications.length === 1 ? 'lembrete' : 'lembretes'}
                    </span>
                  </div>
                )}

                {/* General group header */}
                {group.artistId === '__general__' && groups.length > 1 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 10,
                      paddingBottom: 6,
                      borderBottom: '1px solid #282828',
                    }}
                  >
                    <span style={{ fontSize: 18 }} aria-hidden="true">
                      🔔
                    </span>
                    <h2
                      style={{
                        color: '#fff',
                        fontSize: 16,
                        fontWeight: 700,
                        margin: 0,
                      }}
                    >
                      Geral
                    </h2>
                  </div>
                )}

                {/* Notification items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {group.notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => !n.read && markRead(n.id)}
                      role={n.read ? undefined : 'button'}
                      tabIndex={n.read ? undefined : 0}
                      onKeyDown={(e) => {
                        if (!n.read && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          markRead(n.id);
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                        padding: 14,
                        borderRadius: 8,
                        background: n.read ? '#141414' : '#1f1f1f',
                        cursor: n.read ? 'default' : 'pointer',
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: typeColor[n.type] || '#3b82f6',
                          marginTop: 6,
                          flexShrink: 0,
                        }}
                        aria-hidden="true"
                      />
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            flexWrap: 'wrap',
                          }}
                        >
                          <span style={{ color: '#fff', fontWeight: 700 }}>{n.title}</span>
                          <SourceBadge source={n.source} />
                        </div>
                        {n.message && (
                          <div style={{ color: '#b3b3b3', fontSize: 13, marginTop: 2 }}>
                            {n.message}
                          </div>
                        )}
                        {n.created_at && (
                          <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
                            {dayjs(n.created_at).format('DD/MM/YYYY HH:mm')}
                          </div>
                        )}
                      </div>
                      {!n.read && (
                        <span style={{ color: '#af2896', fontSize: 11, fontWeight: 700 }}>
                          NOVO
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {/* Pagination: Load More */}
            {hasMore && (
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  style={{
                    ...ghostBtn,
                    opacity: loadingMore ? 0.5 : 1,
                    cursor: loadingMore ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loadingMore ? 'Carregando...' : 'Carregar mais'}
                </button>
              </div>
            )}
          </div>
        )}
      </Spinner>
    </div>
  );
};

const ghostBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.1)',
  border: 'none',
  color: '#fff',
  borderRadius: 9999,
  padding: '8px 16px',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 13,
};

export default Notifications;
