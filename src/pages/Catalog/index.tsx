import { FC, ReactNode, useEffect, useState } from 'react';
import { message, Popconfirm } from 'antd';
import { FiPlus, FiRefreshCw, FiEdit2, FiTrash2, FiLock } from 'react-icons/fi';
import { FaSpotify } from 'react-icons/fa6';
import { useNavigate } from 'react-router-dom';

import { useArtist } from '../../hooks/useArtist';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { artistsActions } from '../../store/slices/artists';
import { useCanAddTrack } from '../../hooks/useCanAddTrack';
import { useArtistCapabilities } from '../../hooks/useArtistCapabilities';
import { UpsellModal } from '../../components/UpsellModal';
import { Spinner } from '../../components/spinner/spinner';
import { SpotifyEmbedPlayer } from '../../components/SpotifyEmbedPlayer';
import { LocalPlayerBar, type LocalTrack } from '../../components/LocalPlayerBar';
import { TrackModal } from '../../components/TrackModal';
import { CATALOG_STATUS, formatMs, isActiveCatalogStatus } from '../../constants/maestra';
import * as catalogDb from '../../services/db/catalog';
import * as genresDb from '../../services/db/genres';
import * as membersDb from '../../services/db/members';
import type { CatalogItem, MusicGenre, ArtistMember } from '../../interfaces/maestra';

type Tab = 'spotify' | 'manual';

const StatusBadge: FC<{ status: string }> = ({ status }) => {
  const cfg = (CATALOG_STATUS as any)[status] || { label: status, color: '#6b7280' };
  return (
    <span
      style={{
        background: `${cfg.color}22`,
        color: cfg.color,
        padding: '2px 10px',
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {cfg.label}
    </span>
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
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const refreshing = useAppSelector((s) => s.artists.refreshing);
  const user = useAppSelector((s) => s.auth.user);

  const [tab, setTab] = useState<Tab>('spotify');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [genres, setGenres] = useState<MusicGenre[]>([]);
  const [members, setMembers] = useState<ArtistMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [localTrackId, setLocalTrackId] = useState<string | null>(null);

  const { canAdd, currentCount, maxTracks, isReadOnlyMode } = useCanAddTrack(
    items.filter((i) => isActiveCatalogStatus(i.status)).length,
    artist
  );
  // Colaborador sem PRO entra em somente-leitura (não edita catálogo).
  const { canEdit } = useArtistCapabilities(artist);
  // Se isReadOnlyMode (pós-downgrade: faixas > 10 sem PRO), edição e exclusão ficam bloqueadas.
  const canEditTracks = canEdit && !isReadOnlyMode;
  const [upsellOpen, setUpsellOpen] = useState(false);

  const artistId = artist?.id;
  const spotifyCatalog = artist?.content?.spotifyCatalog;

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
    setLocalTrackId(null);
    setPlayingTrackId(id);
  };
  const openLocal = (id: string | null) => {
    setPlayingTrackId(null);
    setLocalTrackId(id);
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

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'SpotifyMixUITitle', fontWeight: 800, fontSize: 32, color: '#fff', margin: 0 }}>
          Catálogo
        </h1>
        {tab === 'manual' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {maxTracks !== Infinity && <TrackCounter currentCount={currentCount} maxTracks={maxTracks} />}
            <button
              onClick={() => {
                if (!canAdd) {
                  setUpsellOpen(true);
                  return;
                }
                setEditing(null);
                setModalOpen(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: '#af2896',
                border: 'none',
                color: '#fff',
                padding: '10px 20px',
                borderRadius: 9999,
                cursor: canAdd ? 'pointer' : 'not-allowed',
                fontWeight: 700,
                opacity: canAdd ? 1 : 0.5,
              }}
            >
              <FiPlus /> Nova faixa
            </button>
          </div>
        )}
        {tab === 'spotify' && (
          <button
            onClick={() => artistId && dispatch(artistsActions.refreshSpotifyProfile({ id: artistId, force: true }))}
            disabled={refreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#fff',
              padding: '10px 20px',
              borderRadius: 9999,
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            <FiRefreshCw /> {refreshing ? 'Atualizando…' : 'Atualizar do Spotify'}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <TabButton id='spotify' label='Lançamentos' icon={<FaSpotify color='#af2896' />} />
        <TabButton id='manual' label='Faixas / Rascunho' />
      </div>

      {tab === 'spotify' ? (
        <div>
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
                    background: playingTrackId === t.id ? 'rgba(175, 40, 150,0.08)' : 'transparent',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background =
                      playingTrackId === t.id ? 'rgba(175, 40, 150,0.08)' : 'transparent')
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
                      background: '#af2896',
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
                  background: '#af2896',
                  border: 'none',
                  color: '#fff',
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
          {!items.length ? (
            <div style={{ color: '#b3b3b3', padding: 32, textAlign: 'center' }}>
              Nenhuma faixa no catálogo ainda. Cadastre a primeira.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {items.map((it) => (
                <div
                  key={it.id}
                  title={it.audio_file ? 'Ouvir aqui' : (canEditTracks ? 'Sem áudio — clique para editar' : 'Sem áudio')}
                  onClick={() => {
                    if (it.audio_file) {
                      openLocal(localTrackId === it.id ? null : it.id);
                    } else if (canEditTracks) {
                      setEditing(it);
                      setModalOpen(true);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: 8,
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: localTrackId === it.id ? 'rgba(175, 40, 150,0.08)' : 'transparent',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background =
                      localTrackId === it.id ? 'rgba(175, 40, 150,0.08)' : 'transparent')
                  }
                >
                  <button
                    title={it.audio_file ? 'Tocar' : 'Sem áudio'}
                    disabled={!it.audio_file}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (it.audio_file) openLocal(localTrackId === it.id ? null : it.id);
                    }}
                    style={{
                      width: 36,
                      height: 36,
                      minWidth: 36,
                      borderRadius: '50%',
                      border: 'none',
                      background: it.audio_file ? '#af2896' : '#2a2a2a',
                      cursor: it.audio_file ? 'pointer' : 'not-allowed',
                      opacity: it.audio_file ? 1 : 0.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'transform .1s',
                    }}
                    onMouseDown={(e) => it.audio_file && (e.currentTarget.style.transform = 'scale(0.92)')}
                    onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    <svg viewBox='0 0 16 16' style={{ width: 16, height: 16, fill: '#000' }}>
                      <path d='M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288V1.713z' />
                    </svg>
                  </button>
                  <img
                    src={it.cover_image || `${process.env.PUBLIC_URL}/images/playlist.png`}
                    alt=''
                    style={{ width: 44, height: 44, borderRadius: 4, objectFit: 'cover' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#fff', fontWeight: 600 }}>{it.title}</div>
                    <div style={{ color: '#b3b3b3', fontSize: 13 }}>{it.genre || '—'}</div>
                  </div>
                  {it.assignee?.name && (
                    <span
                      title={`Responsável: ${it.assignee.name}`}
                      style={{ color: '#b3b3b3', fontSize: 12, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {it.assignee.name}
                    </span>
                  )}
                  <StatusBadge status={it.status} />
                  {canEditTracks && (
                    <>
                      <button
                        title='Editar'
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(it);
                          setModalOpen(true);
                        }}
                        style={{ background: 'transparent', border: 'none', color: '#b3b3b3', cursor: 'pointer' }}
                      >
                        <FiEdit2 />
                      </button>
                      <Popconfirm title='Excluir faixa?' onConfirm={() => onDelete(it.id)} okText='Sim' cancelText='Não'>
                        <button
                          title='Excluir'
                          onClick={(e) => e.stopPropagation()}
                          style={{ background: 'transparent', border: 'none', color: '#b3b3b3', cursor: 'pointer' }}
                        >
                          <FiTrash2 />
                        </button>
                      </Popconfirm>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
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
      {localTrackId && (
        <LocalPlayerBar
          tracks={localTracks}
          currentId={localTrackId}
          onChangeTrack={setLocalTrackId}
          onClose={() => setLocalTrackId(null)}
        />
      )}
      {/* Espaço para o player fixo não cobrir as últimas linhas */}
      {(playingTrackId || localTrackId) && <div style={{ height: 110 }} />}
    </div>
  );
};

export default Catalog;
