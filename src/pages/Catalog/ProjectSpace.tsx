import { FC, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Modal, Select, Spin, message } from 'antd';
import { FiArrowLeft, FiDownload, FiEdit2, FiFilter, FiMaximize2, FiMessageCircle, FiMoreVertical, FiPause, FiPlay, FiSend, FiUpload } from 'react-icons/fi';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppSelector } from '../../store/store';
import { useArtist } from '../../hooks/useArtist';
import { useArtistCapabilities } from '../../hooks/useArtistCapabilities';
import { VersionModal } from '../../components/VersionModal';
import { supabase } from '../../lib/supabase';
import * as catalogDb from '../../services/db/catalog';
import { CATALOG_STATUS, CATALOG_STATUS_OPTIONS } from '../../constants/maestra';
import type { CatalogProject, CatalogProjectMessage, CatalogVersion, CatalogVersionStage } from '../../interfaces/maestra';
import { useLocalPlayerStore } from '../../stores/localPlayerStore';
import type { LocalTrack } from '../../components/LocalPlayerBar';
import WaveSurferWaveform from './WaveSurferWaveform';
import styles from './ProjectSpace.module.scss';
import { Spinner } from '../../components/spinner/spinner';

const stages: { value: CatalogVersionStage; label: string }[] = [
  { value: 'guia', label: 'Guia' }, { value: 'beat', label: 'Beat' }, { value: 'instrumental', label: 'Instrumental' },
  { value: 'voz', label: 'Voz' }, { value: 'stems', label: 'Stems' }, { value: 'mix', label: 'Mixagem' },
  { value: 'master', label: 'Masterização' }, { value: 'referencia', label: 'Referência' },
];

const getStageLabel = (stage: CatalogVersionStage) => stages.find((item) => item.value === stage)?.label || stage;
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
};

type ProjectDetailsDraft = Pick<CatalogProject, 'title' | 'status' | 'bpm' | 'key' | 'genre'>;

const VersionRow: FC<VersionRowProps> = ({ version, isPrimary, isPlaying, currentTime, onPlay, onSeek, onExpand, onEdit }) => {
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
          {isPrimary && <em>Principal</em>}
        </div>
      </div>

      <div className={styles.versionPlayback}>
        <button
          type='button'
          className={styles.play}
          disabled={!version.audio_file}
          onClick={() => onPlay(version)}
          aria-label={version.audio_file ? (isPlaying ? `Pausar V${version.version_number}` : `Tocar V${version.version_number}`) : 'Áudio pendente'}
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
        ) : <div className={styles.waveOpen}><em>Áudio pendente</em></div>}
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
  const { canCollaborateJam, canEditCatalog } = useArtistCapabilities(artist);
  const canUpdateProject = canEditCatalog || canCollaborateJam;

  useEffect(() => {
    document.body.classList.add('jam-project-space');
    return () => document.body.classList.remove('jam-project-space');
  }, []);
  const [project, setProject] = useState<CatalogProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [versionModal, setVersionModal] = useState(false);
  const [editingVersion, setEditingVersion] = useState<CatalogVersion | null>(null);
  const [projectModal, setProjectModal] = useState(false);
  const [projectDraft, setProjectDraft] = useState<ProjectDetailsDraft | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [chatMessages, setChatMessages] = useState<CatalogProjectMessage[]>([]);
  const [chatText, setChatText] = useState('');
  const [chatLoading, setChatLoading] = useState(true);
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const lastSavedSignature = useRef('');

  const setPlayerOpen = useLocalPlayerStore((state) => state.setOpen);
  const setPlayerTracks = useLocalPlayerStore((state) => state.setTracks);
  const setPlayerCurrentId = useLocalPlayerStore((state) => state.setCurrentId);
  const playerCurrentId = useLocalPlayerStore((state) => state.currentId);
  const playerPlaying = useLocalPlayerStore((state) => state.playing);
  const playerTime = useLocalPlayerStore((state) => state.time);
  const togglePlayer = useLocalPlayerStore((state) => state.toggle);
  const seekPlayer = useLocalPlayerStore((state) => state.seek);

  const projectSignature = (value: CatalogProject) => JSON.stringify({ title: value.title, status: value.status, genre: value.genre || '', bpm: value.bpm || '', key: value.key || '' });
  const refresh = useCallback(() => {
    if (!projectId) return Promise.resolve();
    setLoading(true);
    return catalogDb.getCatalogProject(projectId)
      .then((next) => { setProject(next); lastSavedSignature.current = projectSignature(next); })
      .catch(() => message.error('Erro ao carregar Espaço JAM'))
      .finally(() => setLoading(false));
  }, [projectId]);
  const loadChat = useCallback(() => {
    if (!projectId) return Promise.resolve();
    setChatLoading(true);
    return catalogDb.listCatalogProjectMessages(projectId)
      .then(setChatMessages)
      .catch(() => setChatError('Não foi possível carregar o chat.'))
      .finally(() => setChatLoading(false));
  }, [projectId]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { void loadChat(); }, [loadChat]);
  useEffect(() => {
    if (!projectId) return undefined;
    const channel = supabase
      .channel(`jam-project-chat:${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catalog_project_messages', filter: `project_id=eq.${projectId}` }, () => { void loadChat(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadChat, projectId]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ block: 'end' }); }, [chatMessages]);
  useEffect(() => { document.body.classList.add('jam-space-open'); return () => document.body.classList.remove('jam-space-open'); }, []);

  const versions = useMemo(() => (project?.versions || []).slice().sort((a, b) => b.version_number - a.version_number), [project]);
  const saveProject = useCallback(async (value: CatalogProject) => {
    if (!value.title.trim() || projectSignature(value) === lastSavedSignature.current || !canUpdateProject) return;
    setSaveState('saving');
    try {
      const saved = await catalogDb.updateCatalogProject(value.id, { title: value.title, status: value.status, genre: value.genre, bpm: value.bpm, key: value.key });
      lastSavedSignature.current = projectSignature(saved);
      setProject((current) => current ? { ...current, ...saved } : current);
      setSaveState('saved');
    } catch { setSaveState('error'); }
  }, [canUpdateProject]);
  useEffect(() => {
    if (!project || projectSignature(project) === lastSavedSignature.current) return;
    const timer = window.setTimeout(() => { void saveProject(project); }, 650);
    return () => window.clearTimeout(timer);
  }, [project, saveProject]);


  // Os campos da versão moram no VersionModal; aqui só dizemos QUAL versão abrir.
  const openVersionEditor = (version: CatalogVersion) => {
    if (!canCollaborateJam) {
      message.error('Você não tem permissão para editar esta versão');
      return;
    }
    setEditingVersion(version);
  };


  const localTracks: LocalTrack[] = useMemo(() => versions.filter((version) => version.audio_file).map((version) => ({
    id: version.id,
    title: project ? project.title : 'Música',
    subtitle: `V${version.version_number} · ${getStageLabel(version.stage)}`,
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

  const openProjectEditor = () => {
    if (!project || !canUpdateProject) return;
    setProjectDraft({
      title: project.title,
      status: project.status,
      bpm: project.bpm,
      key: project.key,
      genre: project.genre,
    });
    setProjectModal(true);
  };

  const applyProjectDetails = () => {
    if (!project || !projectDraft) return;
    const title = projectDraft.title.trim();
    if (!title) {
      message.error('Informe o nome do Espaço JAM');
      return;
    }
    setProject({ ...project, ...projectDraft, title });
    setProjectModal(false);
  };

  const sendChat = async (event: FormEvent) => {
    event.preventDefault();
    const text = chatText.trim();
    if (!project || !text || chatSending || !canCollaborateJam) return;
    setChatSending(true); setChatError('');
    try {
      const metadata = (user?.user_metadata || {}) as Record<string, any>;
      const sent = await catalogDb.createCatalogProjectMessage({
        project_id: project.id, author_id: user?.id || null,
        author_name: metadata.full_name || metadata.name || user?.email || 'Você',
        author_avatar: metadata.avatar_url || metadata.picture || null, text,
      });
      setChatMessages((current) => current.some((item) => item.id === sent.id) ? current : [...current, sent]);
      setChatText('');
    } catch { setChatError('Não foi possível enviar. Tente novamente.'); }
    finally { setChatSending(false); }
  };

  if (loading) return <div className={styles.loading}><Spinner loading>{null as any}</Spinner></div>;
  if (!project) return <div className={styles.empty}>Espaço JAM não encontrado.</div>;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button className={styles.back} onClick={() => navigate(`/artists/${artistId}/catalog`)} aria-label='Voltar para Músicas'><FiArrowLeft /></button>
        <div className={styles.titleBlock}>
          <div className={styles.titleLine}>
            <h1>{project.title}</h1>
            <span>Espaço JAM</span>
          </div>
        </div>
        {canUpdateProject && <span className={`${styles.autosave} ${styles[`autosave${saveState}`]}`} aria-live='polite'>{saveState === 'saving' ? 'Salvando…' : saveState === 'error' ? 'Falha ao salvar' : saveState === 'saved' ? 'Salvo automaticamente' : ''}</span>}
        {canUpdateProject ? <Select className={styles.statusPill} value={project.status} options={CATALOG_STATUS_OPTIONS.map((entry) => ({ value: entry.id, label: entry.label }))} onChange={(status) => setProject({ ...project, status })} /> : <span className={styles.statusReadOnly}>{CATALOG_STATUS[project.status as keyof typeof CATALOG_STATUS]?.label || project.status}</span>}
        {canUpdateProject && <button type='button' className={styles.editProject} onClick={openProjectEditor} aria-label='Editar informações do Espaço JAM' title='Editar informações'><FiEdit2 /></button>}
      </header>

      <section className={styles.content}>
        <div className={styles.workspace}>
          <div className={styles.metaStrip}>
            <label><span>BPM</span><Input disabled={!canUpdateProject} value={project.bpm || ''} placeholder='—' onChange={(event) => setProject({ ...project, bpm: event.target.value })} /></label>
            <label><span>Tom</span><Input disabled={!canUpdateProject} value={project.key || ''} placeholder='—' onChange={(event) => setProject({ ...project, key: event.target.value })} /></label>
            <label><span>Gênero</span><Input disabled={!canUpdateProject} value={project.genre || ''} placeholder='—' onChange={(event) => setProject({ ...project, genre: event.target.value })} /></label>
          </div>

          <div className={styles.sectionHeader}>
            {canCollaborateJam && <Button className={styles.uploadButton} type='primary' icon={<FiUpload />} onClick={() => setVersionModal(true)}>Upload</Button>}
            <button type='button' className={styles.filterButton} aria-label='Filtrar versões' title='Filtrar versões'><FiFilter /></button>
          </div>

          <div className={styles.versionList}>
            {versions.length ? versions.map((version) => <VersionRow key={version.id} version={version} isPrimary={version.id === project.primary_version_id} isPlaying={playerCurrentId === version.id && playerPlaying} currentTime={playerCurrentId === version.id ? playerTime : 0} onPlay={playVersion} onSeek={seekVersion} onExpand={openVersion} onEdit={openVersionEditor} />) : <div className={styles.emptyVersions}><strong>Este Espaço JAM ainda não tem uploads.</strong><span>Envie a primeira guia, beat ou mix para começar a colaboração.</span></div>}
          </div>
        </div>

        <aside className={styles.collabPanel} aria-label='Chat do projeto'>
          <div className={styles.chatHeader}>
            <div><strong>Chat do projeto</strong></div>
            <small>{chatMessages.length} {chatMessages.length === 1 ? 'mensagem' : 'mensagens'}</small>
          </div>
          <div className={styles.chatMessages} aria-live='polite'>
            {chatLoading ? <Spin size='small' /> : chatMessages.length ? chatMessages.map((chat) => <article key={chat.id} className={styles.chatMessage}>
              {chat.author_avatar ? <img src={chat.author_avatar} alt={chat.author_name} /> : <i>{initials(chat.author_name)}</i>}
              <div><strong>{chat.author_name}</strong><small>{formatDate(chat.created_at)}</small><p>{chat.text}</p></div>
            </article>) : <div className={styles.chatEmpty}><FiMessageCircle /><strong>Comece a conversa</strong><span>Alinhe decisões do projeto sem misturar com os comentários marcados no áudio.</span></div>}
            <div ref={chatEndRef} />
          </div>
          {canCollaborateJam ? <form className={styles.chatComposer} onSubmit={sendChat}>
            <Input value={chatText} maxLength={5000} placeholder='Escreva uma mensagem…' onChange={(event) => setChatText(event.target.value)} disabled={chatSending} />
            <button type='submit' disabled={!chatText.trim() || chatSending} aria-label='Enviar mensagem'>{chatSending ? <Spin size='small' /> : <FiSend />}</button>
          </form> : <p className={styles.chatAccess}>Somente membros ativos podem participar do chat.</p>}
          {chatError && <p className={styles.chatError}>{chatError}</p>}
        </aside>
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
          inherit={{ bpm: project.bpm, key: project.key, genre: project.genre }}
          author={{
            id: user?.id || null,
            name: (user?.user_metadata as any)?.full_name || (user?.user_metadata as any)?.name || user?.email || 'Você',
            avatar: (user?.user_metadata as any)?.avatar_url || (user?.user_metadata as any)?.picture || null,
          }}
          onClose={() => setVersionModal(false)}
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
          onClose={() => setEditingVersion(null)}
          onSaved={refresh}
        />
      )}

      <Modal open={projectModal} title='Editar Espaço JAM' okText='Concluir' cancelText='Cancelar' onCancel={() => setProjectModal(false)} onOk={applyProjectDetails}>
        {projectDraft && <div className={styles.form}>
          <label>Nome do projeto<Input value={projectDraft.title} maxLength={120} onChange={(event) => setProjectDraft({ ...projectDraft, title: event.target.value })} /></label>
          <label>Status<Select value={projectDraft.status} options={CATALOG_STATUS_OPTIONS.map((entry) => ({ value: entry.id, label: entry.label }))} onChange={(status) => setProjectDraft({ ...projectDraft, status })} /></label>
          <label>BPM<Input value={projectDraft.bpm || ''} placeholder='Ex.: 120' onChange={(event) => setProjectDraft({ ...projectDraft, bpm: event.target.value })} /></label>
          <label>Tom<Input value={projectDraft.key || ''} placeholder='Ex.: D#m' onChange={(event) => setProjectDraft({ ...projectDraft, key: event.target.value })} /></label>
          <label>Gênero<Input value={projectDraft.genre || ''} placeholder='Ex.: Pop' onChange={(event) => setProjectDraft({ ...projectDraft, genre: event.target.value })} /></label>
        </div>}
      </Modal>
    </main>
  );
};

export default ProjectSpace;
