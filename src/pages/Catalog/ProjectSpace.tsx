import { FC, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Button, DatePicker, Input, Select, message } from 'antd';
import dayjs from 'dayjs';
import { FiArrowLeft, FiChevronRight, FiDownload, FiEdit2, FiMaximize2, FiMessageCircle, FiMoreVertical, FiPause, FiPlay, FiStar, FiUpload } from 'react-icons/fi';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppSelector } from '@maestra/core/store/store';
import { useArtist } from '@maestra/core/hooks/useArtist';
import { useArtistCapabilities } from '@maestra/core/hooks/useArtistCapabilities';
import { VersionModal } from '../../components/VersionModal';
import { TrackModal } from '../../components/TrackModal';
import * as genresDb from '@maestra/core/services/db/genres';
import * as membersDb from '@maestra/core/services/db/members';
import type { MusicGenre, ArtistMember } from '@maestra/core/interfaces/maestra';
import * as catalogDb from '@maestra/core/services/db/catalog';
import { CATALOG_STATUS, CATALOG_STATUS_OPTIONS, getVersionStageLabel } from '@maestra/core/constants/maestra';
import type { CatalogProject, CatalogVersion, CatalogVersionStage } from '@maestra/core/interfaces/maestra';
import { useLocalPlayerStore } from '@maestra/core/stores/localPlayerStore';
import type { LocalTrack } from '@maestra/core/stores/localPlayerStore';
import WaveSurferWaveform from './WaveSurferWaveform';
import styles from './ProjectSpace.module.scss';
import { Spinner } from '../../components/spinner/spinner';
import { fichaVazia, resumoDaFicha } from '@maestra/core/utils/resumoDaFicha';

const getStageLabel = (stage: CatalogVersionStage) => getVersionStageLabel(stage);

// A pílula de status era amarela fixa e não acompanhava o status, ao contrário do chip da lista
// de Músicas. Aqui ela recebe a cor do próprio status (CATALOG_STATUS), com o texto escolhido
// pela luminância — o roxo da Masterização pede letra clara; o amarelo do fallback, escura.
const hexToRgb = (hex: string) => {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
};

const statusStyle = (status?: string | null) => {
  const color = CATALOG_STATUS[status as keyof typeof CATALOG_STATUS]?.color || '#edc663';
  const [r, g, b] = hexToRgb(color);
  // Luminância relativa simplificada (ITU-R BT.601): o suficiente para decidir preto ou branco.
  const light = (r * 299 + g * 587 + b * 114) / 1000 > 165;
  return {
    '--status-bg': color,
    '--status-ink': light ? '#181818' : '#fff',
    '--status-shadow': `rgba(${r}, ${g}, ${b}, .28)`,
  } as CSSProperties;
};
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Data indisponível';
const initials = (value?: string | null) => (value || '?').trim().slice(0, 1).toUpperCase();

type VersionRowProps = {
  version: CatalogVersion;
  isPrimary: boolean;
  isPlaying: boolean;
  currentTime: number;
  onPlay: (version: CatalogVersion) => void;
  onSeek: (version: CatalogVersion, time: number) => void;
  onExpand: (version: CatalogVersion) => void;
  onEdit: (version: CatalogVersion) => void;
  onTogglePrimary: (version: CatalogVersion) => void;
};


const VersionRow: FC<VersionRowProps> = ({ version, isPrimary, isPlaying, currentTime, onPlay, onSeek, onExpand, onEdit, onTogglePrimary }) => {
  const stageLabel = getStageLabel(version.stage);
  const versionTitle = version.title || stageLabel;
  const commentsCount = version.comments?.length || 0;

  return (
    <article className={`${styles.version} ${isPrimary ? styles.primary : ''} ${!version.audio_file ? styles.pending : ''}`}>
      <div className={styles.versionIdentity}>
        {version.author_avatar ? <img src={version.author_avatar} alt={version.author_name || 'Autor da versão'} /> : <i>{initials(version.author_name)}</i>}
        <div className={styles.versionTitle}>
          <strong>{versionTitle}</strong>
        </div>
        <div className={styles.versionBadges}>
          <small>V{version.version_number}</small>
          {/* Estrela em vez de etiqueta: além de dizer qual é a principal, marca outra sem
              abrir o modal de edição. */}
          <button
            type='button'
            className={`${styles.primaryStar} ${isPrimary ? styles.primaryStarOn : ''}`}
            onClick={() => onTogglePrimary(version)}
            aria-pressed={isPrimary}
            aria-label={isPrimary ? `Desmarcar V${version.version_number} como versão principal` : `Tornar V${version.version_number} a versão principal`}
            title={isPrimary ? 'Desmarcar como principal' : 'Tornar principal'}
          >
            <FiStar />
          </button>
        </div>
      </div>

      <div className={styles.versionPlayback}>
        <button
          type='button'
          className={styles.play}
          disabled={!version.audio_file}
          onClick={() => onPlay(version)}
          aria-label={version.audio_file ? (isPlaying ? `Pausar V${version.version_number}` : `Tocar V${version.version_number}`) : 'Nenhum áudio anexado'}
        >
          {isPlaying ? <FiPause /> : <FiPlay />}
        </button>
        {version.audio_file ? (
          <WaveSurferWaveform
            audioUrl={version.audio_file}
            currentTime={currentTime}
            onSeek={(time) => onSeek(version, time)}
            className={styles.waveOpen}
          />
        ) : <div className={styles.waveOpen}><em>Nenhum áudio anexado</em></div>}
      </div>

      <div className={styles.versionFooter}>
        <span>{version.author_name || 'Autor não identificado'} · {formatDate(version.created_at)}</span>
        <div className={styles.versionActions}>
          {version.audio_file && <a href={version.audio_file} download={version.audio_file_name || true} aria-label={`Baixar V${version.version_number}`} title='Baixar versão'><FiDownload /></a>}
          <button type='button' className={styles.commentCount} onClick={() => onExpand(version)} aria-label={`Abrir ${commentsCount} comentários de V${version.version_number}`} title='Abrir comentários'><FiMessageCircle /> {commentsCount}</button>
          <button type='button' onClick={() => onExpand(version)} aria-label={`Abrir visualização completa de V${version.version_number}`} title='Visualização completa'><FiMaximize2 /></button>
          <button type='button' onClick={() => onEdit(version)} aria-label={`Mais ações para V${version.version_number}`} title='Editar versão'><FiMoreVertical /></button>
        </div>
      </div>
    </article>
  );
};

const ProjectSpace: FC = () => {
  const { id: artistId, projectId } = useParams();
  const navigate = useNavigate();
  const { artist } = useArtist();
  const user = useAppSelector((state) => state.auth.user);
  const userMeta = (user?.user_metadata || {}) as Record<string, any>;
  const currentUserName = userMeta.full_name || userMeta.name || user?.email || 'Você';
  const currentUserAvatar = userMeta.avatar_url || userMeta.picture || null;
  const { canCollaborateJam, canEditCatalog } = useArtistCapabilities(artist);
  const canUpdateProject = canEditCatalog || canCollaborateJam;

  useEffect(() => {
    document.body.classList.add('jam-project-space');
    return () => document.body.classList.remove('jam-project-space');
  }, []);
  const [project, setProject] = useState<CatalogProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [versionModal, setVersionModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [editingVersion, setEditingVersion] = useState<CatalogVersion | null>(null);
  const [projectModal, setProjectModal] = useState(false);
  // O modal da música pede gênero e responsável; o Espaço Jam não carregava nenhum dos dois.
  const [genres, setGenres] = useState<MusicGenre[]>([]);
  const [members, setMembers] = useState<ArtistMember[]>([]);
  // Mesma lista do catálogo: você primeiro, depois a equipe ativa.
  const assigneeOptions = [
    ...(user ? [{ id: user.id, name: `${currentUserName} (você)` }] : []),
    ...members
      .filter((m) => m.status === 'active')
      .map((m) => ({ id: (m.user_id || m.id) as string, name: m.name || m.email })),
  ];
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const lastSavedSignature = useRef('');
  const lastSavedVersionSignature = useRef('');

  const setPlayerOpen = useLocalPlayerStore((state) => state.setOpen);
  const setPlayerTracks = useLocalPlayerStore((state) => state.setTracks);
  const setPlayerCurrentId = useLocalPlayerStore((state) => state.setCurrentId);
  const playerCurrentId = useLocalPlayerStore((state) => state.currentId);
  const playerPlaying = useLocalPlayerStore((state) => state.playing);
  const playerTime = useLocalPlayerStore((state) => state.time);
  const togglePlayer = useLocalPlayerStore((state) => state.toggle);
  const seekPlayer = useLocalPlayerStore((state) => state.seek);

  const projectSignature = (value: CatalogProject) => JSON.stringify({ title: value.title, status: value.status, genre: value.genre || '', release_date: value.release_date || '' });
  // ⚠️ BPM e tom são da VERSÃO FAVORITA, e têm salvamento próprio. Saíram do projeto porque são
  // da GRAVAÇÃO: um acústico não anda no mesmo andamento do original, e um remix quase nunca
  // fica no mesmo tom. O id entra na assinatura porque trocar de favorita muda o que a ficha
  // mostra — sem ele, o efeito acharia que o valor da nova é uma edição da anterior.
  const versionSignature = (value?: CatalogVersion | null) => JSON.stringify({ id: value?.id || '', bpm: value?.bpm || '', key: value?.key || '' });
  const refresh = useCallback(() => {
    if (!projectId) return Promise.resolve();
    setLoading(true);
    return catalogDb.getCatalogProject(projectId)
      .then((next) => {
        setProject(next);
        lastSavedSignature.current = projectSignature(next);
        lastSavedVersionSignature.current = versionSignature((next.versions || []).find((v) => v.id === next.primary_version_id));
      })
      .catch(() => message.error('Erro ao carregar Espaço JAM'))
      .finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { document.body.classList.add('jam-space-open'); return () => document.body.classList.remove('jam-space-open'); }, []);

  // Gêneros e equipe alimentam o modal da música (mesmo do catálogo). Falha aqui não impede
  // trabalhar no Espaço Jam — só deixa os dois selects vazios.
  useEffect(() => {
    if (!artistId) return;
    genresDb.listGenres().then(setGenres).catch(() => {});
    membersDb.listMembers(artistId).then(setMembers).catch(() => {});
  }, [artistId]);

  const versions = useMemo(() => (project?.versions || []).slice().sort((a, b) => b.version_number - a.version_number), [project]);
  /** A favorita: é dela que a ficha técnica mostra o BPM e o tom. */
  const favorite = useMemo(() => versions.find((v) => v.id === project?.primary_version_id) ?? null, [versions, project?.primary_version_id]);

  // Edita a favorita DENTRO do projeto, e não em estado à parte: assim continua a haver uma
  // fonte de verdade só, e a lista de versões e a ficha nunca discordam sobre o mesmo número.
  const changeFavorite = useCallback((part: Partial<CatalogVersion>) => setProject((current) => (current ? { ...current, versions: (current.versions || []).map((v) => (v.id === current.primary_version_id ? { ...v, ...part } : v)) } : current)), []);

  const saveProject = useCallback(async (value: CatalogProject) => {
    if (!value.title.trim() || projectSignature(value) === lastSavedSignature.current || !canUpdateProject) return;
    setSaveState('saving');
    try {
      const saved = await catalogDb.updateCatalogProject(value.id, { title: value.title, status: value.status, genre: value.genre, release_date: value.release_date });
      lastSavedSignature.current = projectSignature(saved);
      setProject((current) => current ? { ...current, ...saved } : current);
      setSaveState('saved');
    } catch { setSaveState('error'); }
  }, [canUpdateProject]);
  useEffect(() => {
    if (!favorite || !canUpdateProject || versionSignature(favorite) === lastSavedVersionSignature.current) return undefined;
    const timer = window.setTimeout(async () => {
      setSaveState('saving');
      try {
        await catalogDb.updateCatalogVersion(favorite.id, { bpm: favorite.bpm, key: favorite.key });
        lastSavedVersionSignature.current = versionSignature(favorite);
        setSaveState('saved');
      } catch { setSaveState('error'); }
    }, 650);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favorite, canUpdateProject]);

  useEffect(() => {
    if (!project || projectSignature(project) === lastSavedSignature.current) return;
    const timer = window.setTimeout(() => { void saveProject(project); }, 650);
    return () => window.clearTimeout(timer);
  }, [project, saveProject]);


  // Os campos da versão moram no VersionModal; aqui só dizemos QUAL versão abrir. Versões
  // antigas não tinham título (o nome vinha da etapa); abre com esse nome já preenchido para
  // a pessoa não encarar um campo obrigatório vazio.
  const openVersionEditor = (version: CatalogVersion) => {
    if (!canCollaborateJam) {
      message.error('Você não tem permissão para editar esta versão');
      return;
    }
    setEditingVersion({ ...version, title: version.title || getStageLabel(version.stage) });
  };

  // Alterna nos dois sentidos: clicar na estrela acesa desmarca, e a música fica sem versão
  // principal até outra ser escolhida.
  const togglePrimary = async (version: CatalogVersion) => {
    if (!project || !canCollaborateJam) return;
    const jaEra = version.id === project.primary_version_id;
    try {
      await catalogDb.setPrimaryVersion(project.id, jaEra ? null : version.id);
      await refresh();
    } catch { message.error('Não foi possível alterar a versão principal'); }
  };

  // Excluir a versão principal deixaria a música sem faixa principal (o banco zera o ponteiro),
  // e ela apareceria muda no catálogo. Promove a mais recente que sobrou.
  const handleVersionDeleted = async () => {
    if (!project) return;
    try {
      const next = await catalogDb.getCatalogProject(project.id);
      const remaining = (next.versions || []).slice().sort((a, b) => b.version_number - a.version_number);
      if (!next.primary_version_id && remaining.length) {
        await catalogDb.setPrimaryVersion(next.id, remaining[0].id);
      }
    } catch { /* o refresh abaixo mostra o estado real de qualquer jeito */ }
    await refresh();
  };

  // O botão Upload abre direto os arquivos do dispositivo: escolher o áudio é o que a pessoa
  // veio fazer. O modal só aparece depois, já com título e duração vindos do arquivo — resta
  // conferir e enviar.
  const startUpload = () => uploadRef.current?.click();
  const onUploadPicked = (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    // Zera o input para que escolher o MESMO arquivo de novo continue disparando o change.
    event.target.value = '';
    if (!chosen) return;
    setUploadFile(chosen);
    setVersionModal(true);
  };


  const localTracks: LocalTrack[] = useMemo(() => versions.filter((version) => version.audio_file).map((version) => ({
    id: version.id,
    title: project ? project.title : 'Música',
    subtitle: `V${version.version_number}`,
    cover: project?.cover_image,
    url: version.audio_file || '',
    fullViewUrl: `/artists/${artistId}/catalog?projectId=${project?.id}&versionId=${version.id}`,
  })), [artistId, project, versions]);

  const playVersion = (version: CatalogVersion) => {
    if (!version.audio_file) return;
    if (playerCurrentId === version.id) {
      // A versão pode continuar selecionada após voltar ao Espaço JAM; nesse
      // caso reabrimos o player antes de alternar a reprodução.
      setPlayerOpen(true);
      togglePlayer?.();
      return;
    }
    setPlayerTracks(localTracks); setPlayerCurrentId(version.id); setPlayerOpen(true);
  };
  const seekVersion = (version: CatalogVersion, time: number) => {
    if (playerCurrentId !== version.id) {
      if (!version.audio_file) return;
      setPlayerTracks(localTracks);
      setPlayerCurrentId(version.id);
      setPlayerOpen(true);
      // O elemento de áudio é montado pelo player global após a troca de
      // faixa. Aguarda esse ciclo para posicionar a reprodução no ponto
      // escolhido na waveform real.
      window.setTimeout(() => useLocalPlayerStore.getState().seek?.(time), 80);
      return;
    }
    setPlayerOpen(true);
    seekPlayer?.(time);
  };
  const openVersion = (version: CatalogVersion) => navigate(`/artists/${artistId}/catalog?projectId=${project?.id}&versionId=${version.id}`);

  // O rascunho local morreu com o modal artesanal: o TrackModal lê do próprio projeto e grava
  // no banco, e o refresh traz o resultado de volta.
  const openProjectEditor = () => {
    if (!project || !canUpdateProject) return;
    setProjectModal(true);
  };

  if (loading) return <div className={styles.loading}><Spinner loading>{null as any}</Spinner></div>;
  if (!project) return <div className={styles.empty}>Espaço JAM não encontrado.</div>;

  return (
    <main className={styles.page}>
      {/* O cabeçalho é o TÍTULO: voltar de um lado, editar do outro, o nome da música com a
          largura toda. O kicker "Espaço JAM" saiu (a seta e a origem já dizem onde se está), e
          o status desceu para uma segunda linha como um chip — na fila do título ele lhe roubava
          a largura, e em 375px sobravam ~104px para 7 a 9 caracteres. */}
      <header className={styles.header}>
        <button className={styles.back} onClick={() => navigate(`/artists/${artistId}/catalog`)} aria-label='Voltar para Músicas'><FiArrowLeft /></button>
        <div className={styles.titleBlock}>
          <h1>{project.title}</h1>
        </div>
        {canUpdateProject && <button type='button' className={styles.editProject} onClick={openProjectEditor} aria-label='Editar informações do Espaço JAM' title='Editar informações'><FiEdit2 /></button>}
        <div className={styles.secondLine}>
          {canUpdateProject ? <Select className={styles.statusPill} style={statusStyle(project.status)} value={project.status} options={CATALOG_STATUS_OPTIONS.map((entry) => ({ value: entry.id, label: entry.label }))} onChange={(status) => setProject({ ...project, status })} /> : <span className={styles.statusReadOnly} style={statusStyle(project.status)}>{CATALOG_STATUS[project.status as keyof typeof CATALOG_STATUS]?.label || project.status}</span>}
          {canUpdateProject && <span className={`${styles.autosave} ${styles[`autosave${saveState}`]}`} aria-live='polite'>{saveState === 'saving' ? 'Salvando…' : saveState === 'error' ? 'Falha ao salvar' : saveState === 'saved' ? 'Salvo' : ''}</span>}
        </div>
      </header>

      <section className={styles.content}>
        <div className={styles.workspace}>
          <div className={styles.metaStrip}>
            {/* BPM e Tom saem da versão FAVORITA, e é nela que são gravados. Sem favorita não
                há o que mostrar nem onde guardar, e o campo fica travado em vez de aceitar uma
                digitação que se perderia. */}
            <label><span>BPM</span><Input disabled={!canUpdateProject || !favorite} value={favorite?.bpm || ''} placeholder='—' onChange={(event) => changeFavorite({ bpm: event.target.value })} /></label>
            <label><span>Tom</span><Input disabled={!canUpdateProject || !favorite} value={favorite?.key || ''} placeholder='—' onChange={(event) => changeFavorite({ key: event.target.value })} /></label>
            {/* Mesma lista de gêneros da ficha da música: aqui era um campo livre, então cada
                pessoa escrevia de um jeito ("Trap", "trap", "Hip Hop/Trap") e o mesmo gênero
                virava três nos filtros. */}
            <label><span>Gênero</span><Select disabled={!canUpdateProject} value={project.genre || undefined} placeholder='—' allowClear showSearch optionFilterProp='label' suffixIcon={null} options={genres.map((genre) => ({ value: genre.name, label: genre.name }))} onChange={(genre) => setProject({ ...project, genre: genre || null })} /></label>
            {/* A data de lançamento também vive na ficha da música (TrackModal); aqui ela fica à
                mão junto de BPM, tom e gênero, e usa o mesmo autosave da faixa. */}
            <label><span>Lançamento</span><DatePicker disabled={!canUpdateProject} value={project.release_date ? dayjs(project.release_date) : null} format='DD/MM/YYYY' placeholder='—' suffixIcon={null} allowClear onChange={(date) => setProject({ ...project, release_date: date ? date.format('YYYY-MM-DD') : null })} /></label>
          </div>

          {/* No celular a faixa de quatro colunas some (CSS) e entra esta LINHA, que abre a
              mesma ficha do lápis. A grelha custava 153px e quase sempre mostrava quatro
              traços; a linha ocupa o que tem para dizer, e quando não tem nada, convida.
              A deteção de BPM/tom mudou-se para dentro da ficha, ao lado dos campos que
              preenche. */}
          {(() => {
            const dados = { bpm: favorite?.bpm, tom: favorite?.key, genero: project.genre, lancamento: project.release_date };
            const vazia = fichaVazia(dados);
            return (
              <button type='button' className={`${styles.fichaResumo} ${vazia ? styles.fichaResumoVazia : ''}`} onClick={openProjectEditor} aria-label={vazia ? 'Adicionar BPM, tom e gênero' : 'Editar a ficha técnica'}>
                <span>{resumoDaFicha(dados)}</span>
                <FiChevronRight aria-hidden />
              </button>
            );
          })()}

          <div className={styles.sectionHeader}>
            {canCollaborateJam && <Button className={styles.uploadButton} type='primary' icon={<FiUpload />} onClick={startUpload}>Upload</Button>}
            <input ref={uploadRef} type='file' accept='audio/*' style={{ display: 'none' }} onChange={onUploadPicked} />
            {/* O filtro de versões volta quando existir de verdade — o botão não fazia nada. */}
          </div>

          <div className={styles.versionList}>
            {versions.length ? versions.map((version) => <VersionRow key={version.id} version={version} isPrimary={version.id === project.primary_version_id} isPlaying={playerCurrentId === version.id && playerPlaying} currentTime={playerCurrentId === version.id ? playerTime : 0} onPlay={playVersion} onSeek={seekVersion} onExpand={openVersion} onEdit={openVersionEditor} onTogglePrimary={togglePrimary} />) : <div className={styles.emptyVersions}><strong>Este Espaço JAM ainda não tem uploads.</strong><span>Envie a primeira guia, beat ou mix para começar a colaboração.</span></div>}
          </div>
        </div>

      </section>

      {/* Enviar nova versão e editar versão usam o MESMO componente — a diferença é só existir
          uma `version`. Antes eram dois <Modal> soltos com os campos repetidos à mão. */}
      {project && artistId && (
        <VersionModal
          open={versionModal}
          artistId={artistId}
          projectId={project.id}
          projectTitle={project.title}
          nextVersionNumber={versions.length ? Math.max(...versions.map((v) => v.version_number)) + 1 : 1}
          initialFile={uploadFile}
          inherit={{ bpm: favorite?.bpm, key: favorite?.key, genre: project.genre }}
          author={{
            id: user?.id || null,
            name: (user?.user_metadata as any)?.full_name || (user?.user_metadata as any)?.name || user?.email || 'Você',
            avatar: (user?.user_metadata as any)?.avatar_url || (user?.user_metadata as any)?.picture || null,
          }}
          onClose={() => { setVersionModal(false); setUploadFile(null); }}
          onSaved={refresh}
        />
      )}

      {project && artistId && (
        <VersionModal
          open={Boolean(editingVersion)}
          artistId={artistId}
          projectId={project.id}
          projectTitle={project.title}
          version={editingVersion}
          isPrimary={Boolean(editingVersion && editingVersion.id === project.primary_version_id)}
          onClose={() => setEditingVersion(null)}
          onSaved={refresh}
          onDeleted={handleVersionDeleted}
        />
      )}

      {/* Editar a "ficha" daqui é editar a MÚSICA — o Espaço Jam É o projeto. Antes havia um
          modal próprio ("Editar Espaço JAM") com um subconjunto dos campos e outro visual, o
          que fazia parecer uma entidade diferente da que o catálogo edita. É o mesmo modal. */}
      {project && artistId && (
        <TrackModal
          open={projectModal}
          artistId={artistId}
          item={catalogDb.catalogProjectToItem(project, project.versions?.find((v) => v.id === project.primary_version_id))}
          genres={genres}
          assigneeOptions={assigneeOptions}
          currentUserName={currentUserName}
          currentUserId={user?.id || null}
          currentUserAvatar={currentUserAvatar}
          onClose={() => setProjectModal(false)}
          onSaved={() => { void refresh(); }}
          onVersionsChanged={() => { void refresh(); }}
        />
      )}
    </main>
  );
};

export default ProjectSpace;
