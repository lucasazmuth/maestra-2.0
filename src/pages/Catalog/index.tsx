import { FC, FormEvent, MouseEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Button, message } from 'antd';
import { FiArrowLeft, FiRefreshCw, FiLock, FiMoreVertical, FiSend, FiSettings } from 'react-icons/fi';
import { AddIcon } from '../../components/Icons/system';
import { FaSpotify } from 'react-icons/fa6';
import { useLocation, useNavigate } from 'react-router-dom';

import { useArtist } from '../../hooks/useArtist';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { artistsActions } from '../../store/slices/artists';
import { useCanAddTrack } from '../../hooks/useCanAddTrack';
import { useArtistCapabilities } from '../../hooks/useArtistCapabilities';
import { UpsellModal } from '../../components/UpsellModal';
import { Spinner } from '../../components/spinner/spinner';
import { SpotifyEmbedPlayer } from '../../components/SpotifyEmbedPlayer';
import type { LocalTrack } from '../../components/LocalPlayerBar';
import { useLocalPlayerStore } from '../../stores/localPlayerStore';
import { TrackModal } from '../../components/TrackModal';
import {
  FilterChip,
  FilterChips,
  FilterSection,
  FilterSortList,
  FilterSortOption,
  FilterToolbar,
} from '../../components/FilterToolbar';
import { CATALOG_STATUS, CATALOG_STATUS_OPTIONS, formatMs, isActiveCatalogStatus } from '../../constants/maestra';
import * as catalogDb from '../../services/db/catalog';
import * as genresDb from '../../services/db/genres';
import * as membersDb from '../../services/db/members';
import type { CatalogItem, CatalogProject, MusicGenre, ArtistMember } from '../../interfaces/maestra';
import styles from './Catalog.module.scss';

type Tab = 'spotify' | 'manual';
type SortOption = 'updated-desc' | 'created-desc' | 'title-asc' | 'release-asc';

type TrackRoomComment = {
  id: string;
  author: string;
  avatar?: string;
  createdAt: string;
  time?: string;
  text: string;
  timeSeconds?: number;
};

const formatTrackSeconds = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const secs = String(Math.floor(seconds % 60)).padStart(2, '0');
  return `${minutes}:${secs}`;
};

const parseTrackTime = (time?: string): number | null => {
  if (!time) return null;
  const parts = time.split(':').map((value) => Number(value));
  if (parts.some((value) => !Number.isFinite(value))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
};

const parseTrackDuration = (duration?: string | null): number => {
  if (!duration) return 222;
  const parts = duration.split(':').map((value) => Number(value) || 0);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  const numeric = Number(duration);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 222;
};

const StatusBadge: FC<{ status: string }> = ({ status }) => {
  const cfg = (CATALOG_STATUS as any)[status] || { label: status, color: '#6b7280' };
  return (
    <em
      style={{
        background: `${cfg.color}22`,
        color: cfg.color,
      }}
    >
      {cfg.label}
    </em>
  );
};

const TrackCounter: FC<{ currentCount: number; maxTracks: number }> = ({ currentCount, maxTracks }) => {
  const atLimit = currentCount >= maxTracks;
  return (
    <span
      style={{
        color: atLimit ? '#e53e3e' : '#b3b3b3',
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      {currentCount}/{maxTracks} músicas
    </span>
  );
};

const Catalog: FC = () => {
  const { artist } = useArtist();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const refreshing = useAppSelector((s) => s.artists.refreshing);
  const user = useAppSelector((s) => s.auth.user);

  // O catálogo abre primeiro nas faixas/rascunhos, que é a área de trabalho principal.
  const [tab, setTab] = useState<Tab>('manual');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [projects, setProjects] = useState<CatalogProject[]>([]);
  const [genres, setGenres] = useState<MusicGenre[]>([]);
  const [members, setMembers] = useState<ArtistMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [catalogReload, setCatalogReload] = useState(0);
  // Já nasce true quando a URL trouxe a versão a abrir, senão a lista aparece no primeiro frame.
  const [openingVersionRoom, setOpeningVersionRoom] = useState(
    () => new URLSearchParams(window.location.search).has('versionId'),
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [genreFilter, setGenreFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [audioFilter, setAudioFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('updated-desc');
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<CatalogItem | null>(null);
  const [trackProgress, setTrackProgress] = useState(34);
  const [virtualPlaying, setVirtualPlaying] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [timelineCommentText, setTimelineCommentText] = useState('');
  const [timelineComposer, setTimelineComposer] = useState<{
    left: number;
    top: number;
    time: string;
  } | null>(null);
  const [trackComments, setTrackComments] = useState<Record<string, TrackRoomComment[]>>({});

  // O player vive no Layout para continuar tocando durante a navegação entre módulos.
  const setPlayerOpen = useLocalPlayerStore((s) => s.setOpen);
  const setPlayerTracks = useLocalPlayerStore((s) => s.setTracks);
  const playerCurrentId = useLocalPlayerStore((s) => s.currentId);
  const setPlayerCurrentId = useLocalPlayerStore((s) => s.setCurrentId);

  // Estado do player (reflete o <audio>) pra a LINHA mostrar play/pause em sincronia; `togglePlayer`
  // é a função do player que controla o mesmo <audio> (pausar/retomar a faixa atual).
  const playerPlaying = useLocalPlayerStore((s) => s.playing);
  const playerTime = useLocalPlayerStore((s) => s.time);
  const playerDuration = useLocalPlayerStore((s) => s.duration);
  const togglePlayer = useLocalPlayerStore((s) => s.toggle);
  const seekPlayer = useLocalPlayerStore((s) => s.seek);

  const { canAdd, currentCount, maxTracks, isReadOnlyMode } = useCanAddTrack(
    items.filter((i) => isActiveCatalogStatus(i.status)).length,
    artist
  );
  // Colaborador sem PRO entra em somente-leitura (não edita catálogo).
  const { canEditCatalog } = useArtistCapabilities(artist);
  // Se isReadOnlyMode (pós-downgrade: faixas > 10 sem PRO), edição e exclusão ficam bloqueadas.
  const canEditTracks = canEditCatalog && !isReadOnlyMode;
  const [upsellOpen, setUpsellOpen] = useState(false);

  useEffect(() => {
    if (location.state?.catalogTab === 'manual') setTab('manual');
    if (location.state?.catalogTab === 'spotify') setTab('spotify');
  }, [location.state]);

  const artistId = artist?.id;
  const spotifyCatalog = artist?.content?.spotifyCatalog;

  useEffect(() => {
    setSearch('');
    setStatusFilter('all');
    setGenreFilter('all');
    setAssigneeFilter('all');
    setAudioFilter('all');
    setSortBy('updated-desc');
  }, [artistId]);

  // Fila do player local: faixas cadastradas que têm áudio.
  const localTracks: LocalTrack[] = items.map((i) => ({
    id: i.id,
    title: i.title,
    subtitle: i.audio_file ? i.genre || 'Música em Músicas' : 'Áudio pendente',
    cover: i.cover_image,
    url: i.audio_file || '',
  }));

  // Os dois players são mutuamente exclusivos.
  const openEmbed = (id: string | null) => {
    setPlayerOpen(false);
    setPlayerCurrentId(null);
    setPlayingTrackId(id);
  };
  const openLocal = (id: string | null) => {
    setPlayingTrackId(null);
    if (id) {
      setPlayerTracks(localTracks);
      setPlayerCurrentId(id);
      setPlayerOpen(true);
    } else {
      setPlayerOpen(false);
      setPlayerCurrentId(null);
    }
  };

  useEffect(() => {
    if (!artistId) return;
    setLoading(true);
    const listProjects = (catalogDb as any).listCatalogProjectItems || catalogDb.listCatalogItems;
    listProjects(artistId)
      .then((next: CatalogItem[]) => {
        setItems(next);
        setProjects(next.map((item) => ({
          id: item.project_id || item.id,
          artist_id: item.artist_id,
          title: item.title,
          status: item.status,
          genre: item.genre,
          bpm: item.bpm,
          key: item.key,
          cover_image: item.cover_image,
          assignee: item.assignee,
          release_date: item.release_date,
          primary_version_id: item.version_id || item.id,
          created_at: item.created_at,
          updated_at: item.updated_at,
          versions: [item.version_id ? {
            id: item.version_id,
            project_id: item.project_id || item.id,
            version_number: item.version_number || 1,
            stage: item.version_stage || 'guia',
            status: item.version_status || item.status,
            audio_file: item.audio_file,
            audio_file_name: item.audio_file_name,
            duration: item.duration,
            bpm: item.bpm,
            key: item.key,
            genre: item.genre,
            author_id: item.version_author_id,
            author_name: item.version_author_name,
            created_at: item.version_created_at || item.created_at,
          } : undefined].filter(Boolean) as any,
        })));
      })
      .catch(() => message.error('Erro ao carregar músicas'))
      .finally(() => setLoading(false));
    genresDb.listGenres().then(setGenres).catch(() => {});
    membersDb.listMembers(artistId).then(setMembers).catch(() => {});
    // `catalogReload` existe para o caso de uma versão ser anexada pelo modal da música: ela já
    // está no banco antes de "Salvar", e a lista mostra a versão principal de cada música.
  }, [artistId, catalogReload]);

  // Responsáveis possíveis: você (dono/usuário atual) + membros ativos da equipe.
  const currentUserName =
    (user?.user_metadata as any)?.full_name || user?.email || 'Você';
  const currentUserAvatar =
    (user?.user_metadata as any)?.avatar_url ||
    (user?.user_metadata as any)?.picture ||
    `${process.env.PUBLIC_URL}/images/default-artist.svg`;
  const assigneeOptions = [
    ...(user ? [{ id: user.id, name: `${currentUserName} (você)` }] : []),
    ...members
      .filter((m) => m.status === 'active')
      .map((m) => ({ id: (m.user_id || m.id) as string, name: m.name || m.email })),
  ];

  const availableGenres = useMemo(() => (
    Array.from(new Set(items.map((item) => item.genre?.trim()).filter((value): value is string => !!value)))
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
  ), [items]);

  const availableAssignees = useMemo(() => {
    const entries = items
      .filter((item) => !!item.assignee?.id)
      .map((item) => [item.assignee!.id, item.assignee!.name] as const);
    return Array.from(new Map(entries).entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('pt-BR');
    const timestamp = (item: CatalogItem, field: 'updated' | 'created') => {
      const value = field === 'updated' ? item.updated_at || item.created_at : item.created_at;
      return value ? Date.parse(value) || 0 : 0;
    };

    return items
      .filter((item) => {
        const searchable = [
          item.title,
          item.genre,
          item.isrc,
          item.upc,
          item.assignee?.name,
        ].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR');
        const matchesSearch = !normalized || searchable.includes(normalized);
        const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
        const matchesGenre = genreFilter === 'all' || item.genre === genreFilter;
        const matchesAssignee = assigneeFilter === 'all' || item.assignee?.id === assigneeFilter;
        const matchesAudio =
          audioFilter === 'all' ||
          (audioFilter === 'with-audio' ? !!item.audio_file : !item.audio_file);
        return matchesSearch && matchesStatus && matchesGenre && matchesAssignee && matchesAudio;
      })
      .sort((a, b) => {
        if (sortBy === 'title-asc') return a.title.localeCompare(b.title, 'pt-BR');
        if (sortBy === 'created-desc') return timestamp(b, 'created') - timestamp(a, 'created');
        if (sortBy === 'release-asc') {
          if (!a.release_date) return 1;
          if (!b.release_date) return -1;
          return a.release_date.localeCompare(b.release_date);
        }
        return timestamp(b, 'updated') - timestamp(a, 'updated');
      });
  }, [assigneeFilter, audioFilter, genreFilter, items, search, sortBy, statusFilter]);

  const activeFilterCount = [
    statusFilter !== 'all',
    genreFilter !== 'all',
    assigneeFilter !== 'all',
    audioFilter !== 'all',
    sortBy !== 'updated-desc',
  ].filter(Boolean).length;

  const draftCount = projects.filter((item) => item.status !== 'released').length;
  const productionCount = projects.filter((item) => ['recording', 'production', 'mixing', 'mastering'].includes(item.status)).length;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setGenreFilter('all');
    setAssigneeFilter('all');
    setAudioFilter('all');
    setSortBy('updated-desc');
  };

  const getTrackComments = (track: CatalogItem | null) => {
    if (!track) return [];
    if (Object.prototype.hasOwnProperty.call(trackComments, track.id)) return trackComments[track.id];
    return [
      {
        id: `${track.id}-seed`,
        author: 'Maestra Studio',
        createdAt: 'Agora',
        text: 'Espaço aberto para alinhar versões, arquivos, referências e decisões da equipe sobre esta música.',
      },
    ];
  };

  useEffect(() => {
    if (!selectedTrack) return;
    const versionId = selectedTrack.version_id || selectedTrack.id;
    catalogDb.listVersionComments(versionId)
      .then((rows) => setTrackComments((previous) => ({
        ...previous,
        [selectedTrack.id]: rows.map((row) => ({
          id: row.id,
          author: row.author_name,
          avatar: row.author_avatar || undefined,
          createdAt: row.created_at ? new Date(row.created_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Agora',
          time: row.time_seconds == null ? undefined : formatTrackSeconds(Number(row.time_seconds)),
          timeSeconds: row.time_seconds == null ? undefined : Number(row.time_seconds),
          text: row.text,
        })),
      })))
      .catch(() => {
        // Compatibilidade com ambientes onde a migration ainda não foi aplicada.
      });
  }, [selectedTrack]);

  const detailTrackIsCurrent = selectedTrack ? playerCurrentId === selectedTrack.id : false;
  const detailTrackIsPlaying = selectedTrack?.audio_file
    ? detailTrackIsCurrent && playerPlaying
    : virtualPlaying;
  const detailTrackComments = getTrackComments(selectedTrack);
  const detailTrackCommenters = detailTrackComments
    .filter((comment) => comment.author !== 'Maestra Studio')
    .reduce<TrackRoomComment[]>((acc, comment) => {
      if (!acc.some((item) => item.author === comment.author)) acc.push(comment);
      return acc;
    }, [])
    .slice(0, 5);
  const detailTrackFallbackDuration = parseTrackDuration(selectedTrack?.duration);
  const detailTrackDurationSeconds =
    selectedTrack?.audio_file && detailTrackIsCurrent && playerDuration > 0
      ? playerDuration
      : detailTrackFallbackDuration;
  const detailTrackProgress =
    selectedTrack?.audio_file && detailTrackIsCurrent && playerDuration > 0
      ? Math.min(100, Math.max(0, (playerTime / playerDuration) * 100))
      : trackProgress;
  const detailTrackTime =
    selectedTrack?.audio_file && detailTrackIsCurrent
      ? formatTrackSeconds(playerTime)
      : formatTrackSeconds((detailTrackFallbackDuration * trackProgress) / 100);
  const detailTrackDuration = formatTrackSeconds(detailTrackDurationSeconds);
  const detailTrackCurrentSeconds =
    selectedTrack?.audio_file && detailTrackIsCurrent
      ? playerTime
      : (detailTrackFallbackDuration * trackProgress) / 100;
  const detailTrackTimelinePins = detailTrackComments
    .map((comment, index) => {
      const seconds = parseTrackTime(comment.time);
      if (seconds == null) return null;
      return {
        ...comment,
        number: index + 1,
        progress: Math.min(100, Math.max(0, (seconds / detailTrackDurationSeconds) * 100)),
        seconds,
      };
    })
    .filter(Boolean) as Array<TrackRoomComment & { number: number; progress: number; seconds: number }>;

  useEffect(() => {
    if (!selectedTrack || selectedTrack.audio_file || !detailTrackIsPlaying) return undefined;
    const timer = window.setInterval(() => {
      setTrackProgress((value) => (value >= 99 ? 0 : value + 1));
    }, 900);
    return () => window.clearInterval(timer);
  }, [detailTrackIsPlaying, selectedTrack]);

  const openTrackRoom = (track: CatalogItem) => {
    setSelectedTrack(track);
    setTrackProgress(track.audio_file ? 0 : 34);
    setCommentText('');
    setTimelineCommentText('');
    setTimelineComposer(null);
  };

  const closeTrackRoom = () => {
    setSelectedTrack(null);
    setVirtualPlaying(false);
    setCommentText('');
    setTimelineCommentText('');
    setTimelineComposer(null);
  };

  const toggleTrackRoomPlayer = () => {
    if (!selectedTrack) return;
    if (selectedTrack.audio_file) {
      if (detailTrackIsCurrent) togglePlayer?.();
      else openLocal(selectedTrack.id);
      return;
    }
    setVirtualPlaying((value) => !value);
  };

  const seekTrackRoomToProgress = (nextProgress: number) => {
    const bounded = Math.min(100, Math.max(0, nextProgress));
    setTimelineComposer(null);
    if (selectedTrack?.audio_file && detailTrackIsCurrent && playerDuration > 0) {
      seekPlayer?.((bounded / 100) * playerDuration);
    } else {
      setTrackProgress(bounded);
    }
  };

  const openTimelineComposer = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setTimelineComposer({
      left: rect.left + rect.width / 2,
      top: Math.max(90, rect.top - 76),
      time: formatTrackSeconds(detailTrackCurrentSeconds),
    });
    setTimelineCommentText('');
  };

  const submitTrackRoomComment = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTrack) return;
    const text = commentText.trim();
    if (!text) return;
    const nextComment: TrackRoomComment = {
      id: `${selectedTrack.id}-${Date.now()}`,
      author: currentUserName,
      avatar: currentUserAvatar,
      createdAt: new Date().toLocaleString('pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
      text,
    };
    setTrackComments((prev) => ({
      ...prev,
      [selectedTrack.id]: [...getTrackComments(selectedTrack), nextComment],
    }));
    catalogDb.createVersionComment({
      version_id: selectedTrack.version_id || selectedTrack.id,
      author_id: user?.id || null,
      author_name: currentUserName,
      author_avatar: currentUserAvatar,
      text,
      time_seconds: null,
    }).catch(() => message.error('Comentário exibido localmente, mas não foi persistido.'));
    setCommentText('');
  };

  const submitTimelineComment = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTrack || !timelineComposer) return;
    const text = timelineCommentText.trim();
    if (!text) return;
    const nextComment: TrackRoomComment = {
      id: `${selectedTrack.id}-timeline-${Date.now()}`,
      author: currentUserName,
      avatar: currentUserAvatar,
      createdAt: new Date().toLocaleString('pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
      time: timelineComposer.time,
      text,
    };
    setTrackComments((prev) => ({
      ...prev,
      [selectedTrack.id]: [...getTrackComments(selectedTrack), nextComment],
    }));
    catalogDb.createVersionComment({
      version_id: selectedTrack.version_id || selectedTrack.id,
      author_id: user?.id || null,
      author_name: currentUserName,
      author_avatar: currentUserAvatar,
      text,
      time_seconds: parseTrackTime(timelineComposer.time),
    }).catch(() => message.error('Comentário exibido localmente, mas não foi persistido.'));
    setTimelineCommentText('');
    setTimelineComposer(null);
  };

  // Se não houver catálogo Spotify, abre na aba manual.
  useEffect(() => {
    if (artist && !spotifyCatalog?.tracks?.length) setTab('manual');
  }, [artist, spotifyCatalog]);

  // Deep-link do Espaço JAM (?projectId&versionId): a sala da versão é um overlay POR CIMA
  // desta página, então quem vinha do Jam via a lista de Músicas piscar antes de a sala abrir —
  // parecia que a navegação tinha errado o destino. Enquanto o link está sendo resolvido a lista
  // não é montada: sai do Jam, passa por um carregamento e chega na sala.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const projectId = params.get('projectId');
    const versionId = params.get('versionId');
    if (!projectId || !versionId) { setOpeningVersionRoom(false); return; }
    setOpeningVersionRoom(true);
    catalogDb.getCatalogProject(projectId)
      .then((project) => {
        const version = project.versions?.find((entry) => entry.id === versionId);
        if (version) openTrackRoom(catalogDb.catalogProjectToItem(project, version));
      })
      .catch(() => message.error('Não foi possível abrir a versão'))
      .finally(() => setOpeningVersionRoom(false));
  }, [location.search]);

  if (!artist) return <Spinner loading>{null as any}</Spinner>;
  if (openingVersionRoom && !selectedTrack) return <Spinner loading>{null as any}</Spinner>;

  const onSaved = (saved: CatalogItem) => {
    Promise.resolve((catalogDb as any).syncCatalogItemToProject?.(saved, {
      id: user?.id || null,
      name: currentUserName,
      avatar: currentUserAvatar,
    })).catch(() => {
      // A migration pode ainda não ter sido aplicada; o modal legado continua funcional.
    });
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === saved.id);
      if (idx === -1) return [saved, ...prev];
      const next = prev.slice();
      next[idx] = saved;
      return next;
    });
  };

  const onDelete = async (id: string) => {
    try {
      await catalogDb.deleteCatalogItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      message.error('Erro ao excluir');
    }
  };

  const TabButton: FC<{ id: Tab; label: string; icon?: ReactNode }> = ({ id, label, icon }) => (
    <button
      onClick={() => setTab(id)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        background: tab === id ? '#fff' : 'rgba(255,255,255,0.1)',
        color: tab === id ? '#000' : '#fff',
        border: 'none',
        borderRadius: 9999,
        padding: '6px 16px',
        cursor: 'pointer',
        fontWeight: 700,
        fontSize: 14,
      }}
    >
      {icon}{label}
    </button>
  );

  const catalogFilterControls = (
    <FilterToolbar
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Buscar em Músicas"
      searchPlacement="popover"
      title="Filtros de Músicas"
      subtitle="Busque e refine suas músicas"
      activeCount={activeFilterCount}
      onClear={clearFilters}
      open={filterPopoverOpen}
      onOpenChange={setFilterPopoverOpen}
    >
      <FilterSection label="Status">
        <FilterChips>
          <FilterChip selected={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
            Todos
          </FilterChip>
          {/* CATALOG_STATUS_OPTIONS e não o mapa inteiro: filtrar por um status que já não se
              pode escolher (Produção) só confunde — "Todos" continua trazendo as músicas
              antigas que ainda estão nele. */}
          {CATALOG_STATUS_OPTIONS.map((option) => (
            <FilterChip
              key={option.id}
              selected={statusFilter === option.id}
              onClick={() => setStatusFilter(option.id)}
            >
              {option.label}
            </FilterChip>
          ))}
        </FilterChips>
      </FilterSection>

      {!!availableGenres.length && (
        <FilterSection label="Gênero">
          <FilterChips>
            <FilterChip selected={genreFilter === 'all'} onClick={() => setGenreFilter('all')}>
              Todos
            </FilterChip>
            {availableGenres.map((genre) => (
              <FilterChip
                key={genre}
                selected={genreFilter === genre}
                onClick={() => setGenreFilter(genre)}
              >
                {genre}
              </FilterChip>
            ))}
          </FilterChips>
        </FilterSection>
      )}

      {!!availableAssignees.length && (
        <FilterSection label="Responsável">
          <FilterChips>
            <FilterChip selected={assigneeFilter === 'all'} onClick={() => setAssigneeFilter('all')}>
              Todos
            </FilterChip>
            {availableAssignees.map((assignee) => (
              <FilterChip
                key={assignee.id}
                selected={assigneeFilter === assignee.id}
                onClick={() => setAssigneeFilter(assignee.id)}
              >
                {assignee.name}
              </FilterChip>
            ))}
          </FilterChips>
        </FilterSection>
      )}

      <FilterSection label="Áudio">
        <FilterChips>
          {[
            { value: 'all', label: 'Todos' },
            { value: 'with-audio', label: 'Com áudio' },
            { value: 'without-audio', label: 'Sem áudio' },
          ].map((option) => (
            <FilterChip
              key={option.value}
              selected={audioFilter === option.value}
              onClick={() => setAudioFilter(option.value)}
            >
              {option.label}
            </FilterChip>
          ))}
        </FilterChips>
      </FilterSection>

      <FilterSection label="Ordenar">
        <FilterSortList>
          {[
            { value: 'updated-desc', label: 'Atualizadas recentemente' },
            { value: 'created-desc', label: 'Criadas recentemente' },
            { value: 'title-asc', label: 'Título de A–Z' },
            { value: 'release-asc', label: 'Data de lançamento' },
          ].map((option) => (
            <FilterSortOption
              key={option.value}
              selected={sortBy === option.value}
              onClick={() => setSortBy(option.value as SortOption)}
            >
              {option.label}
            </FilterSortOption>
          ))}
        </FilterSortList>
      </FilterSection>
    </FilterToolbar>
  );

  return (
    <div className='catalog-page catalog-reference-page'>
      <div className='catalog-page-heading'>
        <div>
          <p>MÚSICAS DO ARTISTA</p>
          <h1>Músicas</h1>
          <span>Organize as músicas em preparação e acompanhe cada etapa antes do lançamento.</span>
        </div>
        {tab === 'manual' && canEditCatalog && (
          <div className='catalog-heading-actions'>
            {maxTracks !== Infinity && <TrackCounter currentCount={currentCount} maxTracks={maxTracks} />}
            <button
              className='catalog-add-btn'
              style={{ opacity: canAdd ? 1 : 0.5, cursor: canAdd ? 'pointer' : 'not-allowed' }}
              onClick={() => {
                if (!canAdd) {
                  setUpsellOpen(true);
                  return;
                }
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <AddIcon size={18} /> Nova música
            </button>
          </div>
        )}
        {tab === 'spotify' && (
          <button className='catalog-refresh-btn' onClick={() => artistId && dispatch(artistsActions.refreshSpotifyProfile({ id: artistId, force: true }))} disabled={refreshing}>
            <FiRefreshCw /> {refreshing ? 'Atualizando…' : 'Atualizar do Spotify'}
          </button>
        )}
      </div>
      <section className='catalog-summary' aria-label='Resumo de Músicas'>
        <span><b>{String(draftCount).padStart(2, '0')}</b>Rascunhos ativos</span>
        <span><b>{String(productionCount).padStart(2, '0')}</b>Em produção</span>
        <span><b>{String(items.length).padStart(2, '0')}</b>Músicas visíveis</span>
      </section>
      <div className='catalog-tabs'>
        <TabButton id='manual' label='Músicas / Rascunho' />
        <TabButton id='spotify' label='Lançamentos' icon={<FaSpotify color='#9A4FD1' />} />
        {tab === 'manual' && !!items.length && catalogFilterControls}
      </div>
      {tab === 'spotify' ? (
        <div className='catalog-reference-list'>
          {!spotifyCatalog?.tracks?.length ? (
            <div style={{ color: '#b3b3b3', padding: 32, textAlign: 'center' }}>
              Nenhum lançamento publicado no Spotify vinculado a este artista.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {spotifyCatalog.tracks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => openEmbed(playingTrackId === t.id ? null : t.id)}
                  title='Ouvir prévia aqui'
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: 8,
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: playingTrackId === t.id ? 'rgba(154, 79, 209,0.08)' : 'transparent',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background =
                      playingTrackId === t.id ? 'rgba(154, 79, 209,0.08)' : 'transparent')
                  }
                >
                  <button
                    title='Abrir no Spotify'
                    onClick={(e) => {
                      e.stopPropagation();
                      if (t.spotify_url) window.open(t.spotify_url, '_blank', 'noopener');
                    }}
                    style={{
                      width: 36,
                      height: 36,
                      minWidth: 36,
                      borderRadius: '50%',
                      border: 'none',
                      background: '#9A4FD1',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'transform .1s',
                    }}
                    onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.92)')}
                    onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    <svg viewBox='0 0 16 16' style={{ width: 16, height: 16, fill: '#000' }}>
                      <path d='M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288V1.713z' />
                    </svg>
                  </button>
                  <img
                    src={t.album_image}
                    alt=''
                    style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.name}
                    </div>
                    <div style={{ color: '#b3b3b3', fontSize: 13 }}>{t.album}</div>
                  </div>
                  <span style={{ color: '#b3b3b3', fontSize: 13 }}>{formatMs(t.duration_ms)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <Spinner loading={loading && !items.length}>
          {isReadOnlyMode && (
            <div
              role="alert"
              aria-label="Músicas em modo somente leitura"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: 'rgba(251, 191, 36, 0.1)',
                border: '1px solid rgba(251, 191, 36, 0.3)',
                borderRadius: 8,
                padding: '12px 16px',
                marginBottom: 16,
              }}
            >
              <FiLock style={{ color: '#fbbf24', flexShrink: 0, fontSize: 18 }} />
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fbbf24', fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
                  Músicas em modo somente leitura
                </div>
                <div style={{ color: '#b3b3b3', fontSize: 13 }}>
                  Seu perfil possui mais de {maxTracks} músicas ativas. As músicas existentes continuam acessíveis, mas a edição e adição de novas músicas estão bloqueadas até que o total de músicas ativas seja reduzido para {maxTracks} ou menos.
                </div>
              </div>
              <button
                onClick={() => navigate('/assinatura')}
                style={{
                  background: '#9A4FD1',
                  border: 'none',
                  color: '#FFFFFF',
                  padding: '8px 16px',
                  borderRadius: 9999,
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                }}
              >
                Assinar PRO
              </button>
            </div>
          )}
          <div className='catalog-reference-list'>
          {!items.length ? (
            <div style={{ color: '#b3b3b3', padding: 32, textAlign: 'center' }}>
              {canEditCatalog ? 'Nenhuma música cadastrada ainda. Cadastre a primeira.' : 'Nenhuma música cadastrada ainda.'}
            </div>
          ) : !filteredItems.length ? (
            <div className={styles.noResults}>
              <strong>Nenhuma música encontrada</strong>
              <span>Ajuste os filtros ou limpe a busca para visualizar suas músicas.</span>
              <Button onClick={clearFilters}>Limpar filtros</Button>
            </div>
          ) : (
            <div className='catalog-track-table'>
              <header><span>Música</span><span>Tipo</span><span>Status</span><span>Próximo marco</span><span>Colaboração</span><span /></header>
              {filteredItems.map((it) => (
                <article
                  key={it.id}
                  className='catalog-track-row'
                  role='button'
                  tabIndex={0}
                  title='Abrir espaço do projeto'
                  onClick={() => navigate(`/artists/${artist.id}/catalog/projects/${it.project_id || it.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/artists/${artist.id}/catalog/projects/${it.project_id || it.id}`);
                    }
                  }}
                >
                  <span>
                  {(() => {
                    // Espelha o player: se ESTA faixa é a do player, mostra pausar/tocar conforme
                    // o estado e o clique pausa/retoma; senão, o clique inicia esta faixa.
                    const isCurrent = playerCurrentId === it.id;
                    const isPlaying = isCurrent && playerPlaying;
                    return (
                      <button
                        className='catalog-track-play'
                        title={!it.audio_file ? 'Abrir player — áudio pendente' : isPlaying ? 'Pausar' : 'Tocar'}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isCurrent) togglePlayer?.(); // já no player → pausa/retoma
                          else openLocal(it.id); // começa esta faixa
                        }}
                      >
                        {isPlaying ? (
                          <svg viewBox='0 0 16 16'>
                            <path d='M2.7 1a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7H2.7zm8 0a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7h-2.6z' />
                          </svg>
                        ) : (
                          <svg viewBox='0 0 16 16'>
                            <path d='M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288V1.713z' />
                          </svg>
                        )}
                      </button>
                    );
                  })()}
                    <strong>{it.title}<small>V{it.version_number || 1} · {it.version_stage || 'Guia'} · versão principal</small></strong>
                  </span>
                  <span>{it.genre || '—'}</span>
                  <span><StatusBadge status={it.status} /></span>
                  <span>{it.release_date ? new Date(`${it.release_date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—'}</span>
                  {/* A linha inteira já abre o Espaço Jam, mas isso não se descobre olhando —
                      o botão nomeia o destino. `stopPropagation` porque o clique dele e o da
                      linha levariam ao mesmo lugar e disparariam duas navegações. */}
                  <span>
                    <button
                      className='catalog-track-jam'
                      type='button'
                      title='Abrir o Espaço Jam desta música'
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/artists/${artist.id}/catalog/projects/${it.project_id || it.id}`);
                      }}
                    >
                      Espaço Jam
                    </button>
                  </span>
                  {canEditTracks ? (
                    <button
                      className='catalog-track-more'
                      title='Editar'
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(it);
                        setModalOpen(true);
                      }}
                    >
                      <FiMoreVertical size={18} />
                    </button>
                  ) : (
                    <span className='catalog-track-more-placeholder' aria-hidden='true' />
                  )}
                </article>
              ))}
            </div>
          )}
          </div>
        </Spinner>
      )}

      {artistId && (
        <TrackModal
          open={modalOpen}
          artistId={artistId}
          item={editing}
          genres={genres}
          assigneeOptions={assigneeOptions}
          currentUserName={currentUserName}
          currentUserId={user?.id || null}
          currentUserAvatar={currentUserAvatar}
          onClose={() => setModalOpen(false)}
          onSaved={onSaved}
          onDelete={onDelete}
          onVersionsChanged={() => setCatalogReload((value) => value + 1)}
        />
      )}

      <UpsellModal
        open={upsellOpen}
        context="catalog-limit"
        onClose={() => setUpsellOpen(false)}
      />

      {playingTrackId && (
        <SpotifyEmbedPlayer trackId={playingTrackId} onClose={() => setPlayingTrackId(null)} />
      )}
      {selectedTrack && (
        <div className='track-detail-backdrop' role='dialog' aria-modal='true' aria-label={`Espaço da versão ${selectedTrack.title}`}>
          <section className='track-detail-modal'>
            <header className='track-detail-header'>
              <button type='button' aria-label='Voltar para Músicas' onClick={closeTrackRoom}>
                <FiArrowLeft />
              </button>
              <div className='track-detail-title'>
                <strong>{selectedTrack.title}</strong>
                <small>
                  <span>Espaço da versão</span>
                  <span>{selectedTrack.genre || 'Sem categoria'}</span>
                  <span>{CATALOG_STATUS[selectedTrack.status as keyof typeof CATALOG_STATUS]?.label || selectedTrack.status || 'Rascunho'}</span>
                </small>
              </div>
              <button
                type='button'
                aria-label='Editar música'
                onClick={() => {
                  setEditing(selectedTrack);
                  setModalOpen(true);
                }}
              >
                <FiSettings />
              </button>
            </header>

            <div className='track-detail-layout'>
              <section
                className={`track-player ${detailTrackIsPlaying ? 'is-playing' : ''}`}
                style={{ '--track-color': '#8e3cff' } as CSSProperties}
              >
                <div className='track-meta-strip'>
                  <span>
                    <small>BPM</small>
                    <strong>{selectedTrack.bpm || '—'}</strong>
                  </span>
                  <span>
                    <small>TOM</small>
                    <strong>{selectedTrack.key || '—'}</strong>
                  </span>
                  <span>
                    <small>GÊNERO</small>
                    <strong>{selectedTrack.genre || '—'}</strong>
                  </span>
                </div>

                <div className='track-waveform' aria-hidden='true'>
                  <svg viewBox='0 0 327 327'>
                    <path
                      className='track-wave-path track-wave-path-one'
                      d='M149.091 51.0449C158.028 48.1411 167.655 48.1411 176.593 51.0449L217.228 64.248C226.166 67.152 233.955 72.8114 239.478 80.4141L264.592 114.98C270.115 122.583 273.091 131.739 273.091 141.137V183.863C273.091 193.261 270.115 202.417 264.592 210.02L239.478 244.586C233.955 252.189 226.166 257.848 217.228 260.752L176.593 273.955C167.655 276.859 158.028 276.859 149.091 273.955L108.455 260.752C99.5175 257.848 91.7286 252.189 86.205 244.586L61.0917 210.02C55.568 202.417 52.5927 193.261 52.5927 183.863V141.137C52.5927 131.739 55.568 122.583 61.0917 114.98L86.205 80.4141C91.7286 72.8114 99.5175 67.152 108.455 64.248L149.091 51.0449Z'
                    />
                    <path
                      className='track-wave-path track-wave-path-two'
                      d='M229.205 75.9546C238.687 80.376 246.307 87.9968 250.729 97.4785L269.967 138.735C274.388 148.217 275.328 158.954 272.62 169.059L260.838 213.03C258.13 223.135 251.948 231.964 243.378 237.964L206.09 264.074C197.52 270.075 187.109 272.865 176.687 271.953L131.34 267.985C120.917 267.073 111.149 262.518 103.751 255.121L71.5628 222.932C64.165 215.534 59.6107 205.767 58.6988 195.344L54.7303 149.996C53.8185 139.574 56.6085 129.164 62.6093 120.593L88.7191 83.3053C94.7198 74.7354 103.548 68.553 113.654 65.8452L157.624 54.0633C167.73 51.3555 178.466 52.2949 187.948 56.7163L229.205 75.9546Z'
                    />
                  </svg>
                </div>

                <div className='track-cover-empty'>
                  {selectedTrack.cover_image ? (
                    <img src={selectedTrack.cover_image} alt='' />
                  ) : null}
                </div>

                {detailTrackCommenters.length > 0 && (
                  <div className='track-commenters' aria-label='Comentários da equipe na música'>
                    {detailTrackCommenters.map((comment, index) => {
                      const commenterAngles = [-48, 42, 132, -138, 180];
                      const angle = commenterAngles[index] ?? index * 72;
                      return (
                        <div
                          key={comment.id}
                          className='track-commenter'
                          style={{ '--commenter-angle': `${angle}deg` } as CSSProperties}
                        >
                          {comment.avatar ? (
                            <img className='avatar' src={comment.avatar} alt={comment.author} />
                          ) : (
                            <span className='avatar'>{comment.author.slice(0, 1).toUpperCase()}</span>
                          )}
                          <span>{comment.author}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className='track-player-controls'>
                  <span>{detailTrackTime}</span>
                  <button
                    type='button'
                    className={`track-play-button ${detailTrackIsPlaying ? 'is-pause' : 'is-play'}`}
                    aria-label={detailTrackIsPlaying ? 'Pausar música' : 'Tocar música'}
                    onClick={toggleTrackRoomPlayer}
                  >
                    {detailTrackIsPlaying ? 'Ⅱ' : '▶'}
                  </button>
                  <span>{detailTrackDuration}</span>
                </div>

                <div
                  className='track-progress-wrap'
                  style={{ '--progress': `${detailTrackProgress}%` } as CSSProperties}
                  onPointerDown={(event) => {
                    if ((event.target as HTMLElement).closest('.track-comment-marker, .track-comment-pin')) return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    seekTrackRoomToProgress(((event.clientX - rect.left) / rect.width) * 100);
                  }}
                >
                  <input
                    className='track-progress'
                    type='range'
                    min={0}
                    max={100}
                    value={detailTrackProgress}
                    aria-label='Progresso da música'
                    onChange={(event) => seekTrackRoomToProgress(Number(event.target.value))}
                  />
                  {detailTrackTimelinePins.map((pin) => (
                    <button
                      key={`${pin.id}-pin`}
                      type='button'
                      className='track-comment-pin'
                      style={{ '--pin-progress': `${pin.progress}%` } as CSSProperties}
                      aria-label={`Ir para comentário marcado em ${pin.time}`}
                      title={`${pin.author} · ${pin.time}: ${pin.text}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        seekTrackRoomToProgress(pin.progress);
                      }}
                    >
                      <span>{pin.number}</span>
                      <span className='track-comment-pin-tooltip' role='tooltip'>
                        <strong>{pin.author}</strong>
                        <small>{pin.time}</small>
                        <em>{pin.text}</em>
                      </span>
                    </button>
                  ))}
                  <button
                    type='button'
                    className='track-comment-marker'
                    aria-label='Comentar neste ponto da música'
                    onClick={openTimelineComposer}
                  >
                    <span className='track-comment-icon' />
                  </button>
                </div>

                {timelineComposer && (
                  <form
                    className='timeline-comment-composer'
                    style={{
                      left: timelineComposer.left,
                      top: timelineComposer.top,
                    }}
                    onSubmit={submitTimelineComment}
                  >
                    <span>{timelineComposer.time}</span>
                    <input
                      autoFocus
                      value={timelineCommentText}
                      placeholder='Comente neste ponto...'
                      onChange={(event) => setTimelineCommentText(event.target.value)}
                    />
                    <button className='timeline-comment-cancel' type='button' aria-label='Cancelar comentário' onClick={() => setTimelineComposer(null)}>
                      ×
                    </button>
                    <button className='timeline-comment-send' type='submit' aria-label='Enviar comentário neste ponto'>
                      <FiSend />
                    </button>
                  </form>
                )}

              </section>

              <aside className='track-comments'>
                <header>
                  <div>
                    <span>CONVERSA DA EQUIPE</span>
                    <h3>Comentários <b>{detailTrackComments.length}</b></h3>
                  </div>
                </header>

                <div className='track-comment-list'>
                  {detailTrackComments.map((comment) => (
                    <article key={comment.id} className={comment.time ? 'has-track-time' : undefined}>
                      {comment.avatar ? (
                        <img className='avatar' src={comment.avatar} alt={comment.author} />
                      ) : (
                        <span className='avatar'>{comment.author.slice(0, 1).toUpperCase()}</span>
                      )}
                      <div>
                        <strong>{comment.author}</strong>
                        <small>
                          {comment.createdAt}
                          {comment.time ? <span className='track-comment-time'>Marcado em {comment.time}</span> : null}
                        </small>
                        <p>{comment.text}</p>
                      </div>
                    </article>
                  ))}
                </div>

                <form className='track-comment-form' onSubmit={submitTrackRoomComment}>
                  <img className='avatar' src={currentUserAvatar} alt='' />
                  <input
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    placeholder='Comente sobre essa versão…'
                  />
                  <button type='submit' aria-label='Enviar comentário'>
                    <FiSend />
                  </button>
                </form>
              </aside>
            </div>
          </section>
        </div>
      )}
      {/* Espaço para o player fixo não cobrir as últimas linhas */}
      {playingTrackId && <div style={{ height: 110 }} />}
    </div>
  );
};

export default Catalog;
