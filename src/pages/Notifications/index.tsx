import { FC, useEffect, useMemo, useState, useCallback } from 'react';
import { message } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

import { useAppSelector } from '../../store/store';
import { Spinner } from '../../components/spinner/spinner';
import * as notifsDb from '../../services/db/notifications';
import type { NotificationItem } from '../../interfaces/maestra';
import { supabase } from '../../lib/supabase';

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Main Component ──────────────────────────────────────────────────────────

const Notifications: FC = () => {
  const user = useAppSelector((s) => s.auth.user);
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [artistNames, setArtistNames] = useState<Record<string, string>>({});

  const loadFirstPage = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setPage(0);
    try {
      const result = await notifsDb.listNotificationsPaginated(user.id, 0);
      setItems(result.items);
      setHasMore(result.hasMore);
      const artistIds = Array.from(
        new Set(result.items.map((n) => n.artist_id).filter(Boolean) as string[])
      );
      setArtistNames(artistIds.length ? await notifsDb.fetchArtistNames(artistIds) : {});
    } catch {
      message.error('Erro ao carregar notificações');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  // Mantém a lista viva enquanto a tela está aberta. O RLS da tabela continua
  // limitando os eventos ao próprio usuário.
  useEffect(() => {
    if (!user?.id) return undefined;
    const channel = supabase
      .channel(`notifications-page:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        async (payload) => {
          const notification = payload.new as NotificationItem;
          setItems((prev) => (prev.some((item) => item.id === notification.id) ? prev : [notification, ...prev]));
          if (notification.artist_id) {
            const names = await notifsDb.fetchArtistNames([notification.artist_id]);
            setArtistNames((prev) => ({ ...prev, ...names }));
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
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
    try {
      await notifsDb.markAsRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch {
      message.error('Não foi possível marcar a notificação como lida');
    }
  };

  const markAll = async () => {
    if (!user?.id) return;
    try {
      await notifsDb.markAllAsRead(user.id);
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      message.error('Não foi possível marcar as notificações como lidas');
    }
  };

  const clearAll = async () => {
    if (!user?.id) return;
    if (!window.confirm('Limpar todas as notificações? Esta ação não pode ser desfeita.')) return;
    try {
      await notifsDb.clearNotifications(user.id);
      setItems([]);
      setArtistNames({});
      setHasMore(false);
    } catch {
      message.error('Não foi possível limpar as notificações');
    }
  };

  const openNotification = async (notification: NotificationItem) => {
    if (!notification.read) await markRead(notification.id);
    if (notification.link?.startsWith('/')) navigate(notification.link);
  };

  // Group notifications by artist
  const groups = useMemo(() => groupByArtist(items, artistNames), [items, artistNames]);

  return (
    <div className="rail-page page-view notifications-page">
      <header>
        <div>
          <p>CENTRAL DO USUÁRIO</p>
          <h1>Notificações</h1>
          <span>Acompanhe avisos da sua conta, agenda e atividades recentes.</span>
        </div>
        {!!items.length && (
          <div className="notifications-actions">
            <button type="button" onClick={markAll}>Marcar tudo como lido</button>
            <button type="button" className="notifications-clear" onClick={clearAll}>Limpar</button>
          </div>
        )}
      </header>

      <Spinner loading={loading && !items.length}>
        {!items.length ? (
          <div className="notifications-empty">Nenhuma notificação.</div>
        ) : (
          <div className="notifications-groups">
            {groups.map((group) => (
              <section key={group.artistId} aria-label={`Notificações de ${group.artistName}`}>
                <header className="notifications-group-heading">
                  <h2>{group.artistName}</h2>
                  <span>{group.notifications.length} {group.notifications.length === 1 ? 'lembrete' : 'lembretes'}</span>
                </header>
                <div className="notifications-list">
                  {group.notifications.map((n) => (
                    <button
                      type="button"
                      key={n.id}
                      className={n.read ? 'is-read' : 'is-unread'}
                      onClick={() => void openNotification(n)}
                      aria-label={`${n.title}${n.read ? '' : ', não lida'}`}
                    >
                      <i aria-hidden="true">♟</i>
                      <div>
                        <h3>{n.title}</h3>
                        {n.message && <p>{n.message}</p>}
                      </div>
                      <time>{n.created_at ? dayjs(n.created_at).format('DD/MM/YYYY HH:mm') : 'Agora'}</time>
                      {!n.read && <b>Novo</b>}
                    </button>
                  ))}
                </div>
              </section>
            ))}

            {hasMore && (
              <div className="notifications-more">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
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

export default Notifications;
