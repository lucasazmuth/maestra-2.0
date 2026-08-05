import { FC, ReactNode, useEffect, useMemo, useState } from 'react';
import { Button, message } from 'antd';
import { FiRefreshCw, FiLock, FiMoreVertical } from 'react-icons/fi';
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
import { CATALOG_STATUS, formatMs, isActiveCatalogStatus } from '../../constants/maestra';
import * as catalogDb from '../../services/db/catalog';
import * as genresDb from '../../services/db/genres';
import * as membersDb from '../../services/db/members';
import type { CatalogItem, MusicGenre, ArtistMember } from '../../interfaces/maestra';
import styles from './Catalog.module.scss';

type Tab = 'spotify' | 'manual';
type SortOption = 'updated-desc' | 'created-desc' | 'title-asc' | 'release-asc';

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
      {currentCount}/{maxTracks} faixas
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
  const [genres, setGenres] = useState<MusicGenre[]>([]);
  const [members, setMembers] = useState<ArtistMember[]>([]);
  const [loading, setLoading] = useState(false);
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

  // O player vive no Layout para continuar tocando durante a navegação entre módulos.
  const setPlayerOpen = useLocalPlayerStore((s) => s.setOpen);
  const setPlayerTracks = useLocalPlayerStore((s) => s.setTracks);
  const playerCurrentId = useLocalPlayerStore((s) => s.currentId);
  const setPlayerCurrentId = useLocalPlayerStore((s) => s.setCurrentId);

  // Estado do player (reflete o <audio>) pra a LINHA mostrar play/pause em sincronia; `togglePlayer`
  // é a função do player que controla o mesmo <audio> (pausar/retomar a faixa atual).
  const playerPlaying = useLocalPlayerStore((s) => s.playing);
  const togglePlayer = useLocalPlayerStore((s) => s.toggle);

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
  const localTracks: LocalTrack[] = items
    .filter((i) => !!i.audio_file)
    .map((i) => ({
      id: i.id,
      title: i.title,
      subtitle: i.genre || undefined,
      cover: i.cover_image,
      url: i.audio_file as string,
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
    catalogDb
      .listCatalogItems(artistId)
      .then(setItems)
      .catch(() => message.error('Erro ao carregar catálogo'))
      .finally(() => setLoading(false));
    genresDb.listGenres().then(setGenres).catch(() => {});
    membersDb.listMembers(artistId).then(setMembers).catch(() => {});
  }, [artistId]);

  // Responsáveis possíveis: você (dono/usuário atual) + membros ativos da equipe.
  const currentUserName =
    (user?.user_metadata as any)?.full_name || user?.email || 'Você';
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

  const draftCount = items.filter((item) => item.status !== 'released').length;
  const productionCount = items.filter((item) => ['recording', 'production', 'mixing', 'mastering'].includes(item.status)).length;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setGenreFilter('all');
    setAssigneeFilter('all');
    setAudioFilter('all');
    setSortBy('updated-desc');
  };

  // Se não houver catálogo Spotify, abre na aba manual.
  useEffect(() => {
    if (artist && !spotifyCatalog?.tracks?.length) setTab('manual');
  }, [artist, spotifyCatalog]);

  if (!artist) return <Spinner loading>{null as any}</Spinner>;

  const onSaved = (saved: CatalogItem) => {
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
      searchPlaceholder="Buscar no catálogo"
      searchPlacement="popover"
      title="Filtros do catálogo"
      subtitle="Busque e refine o catálogo"
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
          {Object.entries(CATALOG_STATUS).map(([value, config]) => (
            <FilterChip
              key={value}
              selected={statusFilter === value}
              onClick={() => setStatusFilter(value)}
            >
              {config.label}
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
          <p>CATÁLOGO DO ARTISTA</p>
          <h1>Faixas e rascunhos</h1>
          <span>Organize as músicas em preparação e acompanhe cada etapa antes do lançamento.</span>
        </div>
        {tab === 'manual' && canEditCatalog && (
          <div className='catalog-heading-actions'>
            {maxTracks !== Infinity && <TrackCounter currentCount={currentCount} maxTracks={maxTracks} />}
            <button
              className='catalog-add-btn'
              onClick={() => {
                if (!canAdd) {
                  setUpsellOpen(true);
                  return;
                }
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <AddIcon size={18} /> Nova faixa
            </button>
          </div>
        )}
        {tab === 'spotify' && (
          <button className='catalog-refresh-btn' onClick={() => artistId && dispatch(artistsActions.refreshSpotifyProfile({ id: artistId, force: true }))} disabled={refreshing}>
            <FiRefreshCw /> {refreshing ? 'Atualizando…' : 'Atualizar do Spotify'}
          </button>
        )}
      </div>
      <section className='catalog-summary' aria-label='Resumo do catálogo'>
        <span><b>{String(draftCount).padStart(2, '0')}</b>Rascunhos ativos</span>
        <span><b>{String(productionCount).padStart(2, '0')}</b>Em produção</span>
        <span><b>{String(items.length).padStart(2, '0')}</b>Faixas visíveis</span>
      </section>
      <div className='catalog-tabs'>
        <TabButton id='manual' label='Faixas / Rascunho' />
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
              aria-label="Catálogo em modo somente leitura"
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
                  Catálogo em modo somente leitura
                </div>
                <div style={{ color: '#b3b3b3', fontSize: 13 }}>
                  Seu perfil possui mais de {maxTracks} faixas ativas. As faixas existentes continuam acessíveis, mas a edição e adição de novas faixas estão bloqueadas até que o total de faixas ativas seja reduzido para {maxTracks} ou menos.
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
              {canEditCatalog ? 'Nenhuma faixa no catálogo ainda. Cadastre a primeira.' : 'Nenhuma faixa no catálogo ainda.'}
            </div>
          ) : !filteredItems.length ? (
            <div className={styles.noResults}>
              <strong>Nenhuma faixa encontrada</strong>
              <span>Ajuste os filtros ou limpe a busca para visualizar o catálogo.</span>
              <Button onClick={clearFilters}>Limpar filtros</Button>
            </div>
          ) : (
            <div className='catalog-track-table'>
              <header><span>Faixa</span><span>Tipo</span><span>Status</span><span>Próximo marco</span><span /></header>
              {filteredItems.map((it) => (
                <article
                  key={it.id}
                  className='catalog-track-row'
                  role='button'
                  tabIndex={0}
                  title={it.audio_file ? 'Ouvir aqui' : (canEditTracks ? 'Sem áudio — clique para editar' : 'Sem áudio')}
                  onClick={() => {
                    if (it.audio_file) {
                      openLocal(playerCurrentId === it.id ? null : it.id);
                    } else if (canEditTracks) {
                      setEditing(it);
                      setModalOpen(true);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      if (it.audio_file) openLocal(playerCurrentId === it.id ? null : it.id);
                      else if (canEditTracks) { setEditing(it); setModalOpen(true); }
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
                        title={!it.audio_file ? 'Sem áudio' : isPlaying ? 'Pausar' : 'Tocar'}
                        disabled={!it.audio_file}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!it.audio_file) return;
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
                    <strong>{it.title}<small>Versão principal · Maestra Studio</small></strong>
                  </span>
                  <span>{it.genre || '—'}</span>
                  <span><StatusBadge status={it.status} /></span>
                  <span>{it.release_date ? new Date(`${it.release_date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—'}</span>
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
          onClose={() => setModalOpen(false)}
          onSaved={onSaved}
          onDelete={onDelete}
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
      {/* Espaço para o player fixo não cobrir as últimas linhas */}
      {playingTrackId && <div style={{ height: 110 }} />}
    </div>
  );
};

export default Catalog;
