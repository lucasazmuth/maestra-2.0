import { FC, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Button, Input, Select, message } from 'antd';
import { FiArrowLeft, FiChevronRight, FiDownload, FiEdit2, FiMaximize2, FiMessageCircle, FiMoreVertical, FiStar, FiUpload } from 'react-icons/fi';
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
import { CATALOG_STATUS, CATALOG_STATUS_OPTIONS, MEMORIA_DE_AVISO_BYTES, getVersionStageLabel } from '@maestra/core/constants/maestra';
import type { CatalogProject, CatalogVersion, CatalogVersionStage } from '@maestra/core/interfaces/maestra';
import { useLocalPlayerStore } from '@maestra/core/stores/localPlayerStore';
import styles from './ProjectSpace.module.scss';
import { Spinner } from '../../components/spinner/spinner';
import { projetoVazio, resumoDoProjeto } from '@maestra/core/utils/resumoDaFicha';
import { ehPistaDaMix, pistasDaVersao, stemsDaVersao } from '@maestra/core/audio/pistasDaVersao';
import { enviarPistas, validarPistas, type EnvioDePista, type Recusa } from '@maestra/core/audio/envioDePistas';
import { useMesa } from '@maestra/core/audio/useMesa';
import { BALDE_DO_CATALOGO, caminhoNoBalde, removerArquivo } from '@maestra/core/services/armazenamento';
import type { CatalogVersionFile } from '@maestra/core/interfaces/maestra';
import { AdicionarPista } from './mesa/AdicionarPista';
import { buscarWeb, criarContextoWeb } from './mesa/contextoWeb';
import { BARRAS } from './mesa/MiniOnda';
import { ModalDaPista } from './mesa/ModalDaPista';
import { Pista } from './mesa/Pista';
import { SeletorDeGravacoes } from './mesa/SeletorDeGravacoes';
import { Transporte } from './mesa/Transporte';

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

// Fora daqui: o `VersionRow` — o cartão com play e onda por versão. Ele desenhava as gravações
// como coisas que tocam ao mesmo tempo, e elas são ALTERNATIVAS. Quem toca junto são os stems,
// e é isso que a mesa mostra. O que sobrou dele está em `mesa/SeletorDeGravacoes.tsx` (a fila
// de fichas) e no bloco de identidade da gravação aberta, aqui embaixo.

// As duas funções que a mesa precisa, fora do componente: aqui dentro seriam objetos novos a
// cada render.
const DEPENDENCIAS_DA_MESA = { criarContexto: criarContextoWeb, buscar: buscarWeb };

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

  /** Qual gravação está aberta no editor. É ela que a mesa carrega e que o cabeçalho edita. */
  const [openId, setOpenId] = useState<string | null>(null);
  const [trackSheet, setTrackSheet] = useState<CatalogVersionFile | null>(null);
  const [uploads, setUploads] = useState<EnvioDePista[]>([]);
  const [rejected, setRejected] = useState<Recusa[]>([]);

  // Só o que fecha a barra global: dentro do editor ela não existe (ver o efeito abaixo).
  const setPlayerOpen = useLocalPlayerStore((state) => state.setOpen);
  const setPlayerCurrentId = useLocalPlayerStore((state) => state.setCurrentId);

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

  // ⚠️ A BARRA GLOBAL SOME AQUI DENTRO. Dois motores de áudio na mesma tela é o bug óbvio: a
  // barra tocando a V2 por baixo da mesa tocando a V1, cada uma com o seu play, e nenhuma
  // sabendo da outra. Dentro do editor quem toca é a mesa — sempre.
  useEffect(() => {
    setPlayerOpen(false);
    setPlayerCurrentId(null);
  }, [setPlayerOpen, setPlayerCurrentId]);

  // Gêneros e equipe alimentam o modal da música (mesmo do catálogo). Falha aqui não impede
  // trabalhar no Espaço Jam — só deixa os dois selects vazios.
  useEffect(() => {
    if (!artistId) return;
    genresDb.listGenres().then(setGenres).catch(() => {});
    membersDb.listMembers(artistId).then(setMembers).catch(() => {});
  }, [artistId]);

  const versions = useMemo(() => (project?.versions || []).slice().sort((a, b) => b.version_number - a.version_number), [project]);

  // Abre a principal — e, sem principal, a mais recente. Também conserta o caso de a gravação
  // aberta ter sido excluída: sem isto, o editor ficaria a apontar para nada.
  useEffect(() => {
    if (!versions.length) { setOpenId(null); return; }
    if (openId && versions.some((v) => v.id === openId)) return;
    setOpenId(versions.find((v) => v.id === project?.primary_version_id)?.id ?? versions[0].id);
  }, [versions, project?.primary_version_id, openId]);

  /** A gravação ABERTA: é dela o BPM e o tom do cabeçalho, e são dela as pistas da mesa. */
  const open = useMemo(() => versions.find((v) => v.id === openId) ?? null, [versions, openId]);
  const stems = useMemo(() => stemsDaVersao(open), [open]);
  const pistas = useMemo(() => pistasDaVersao(open), [open]);
  const mesa = useMesa(pistas, DEPENDENCIAS_DA_MESA);

  // Edita a gravação aberta DENTRO do projeto, e não em estado à parte: assim continua a haver
  // uma fonte de verdade só, e a fila de fichas e o cabeçalho nunca discordam sobre o mesmo
  // número.
  const changeOpen = useCallback((part: Partial<CatalogVersion>) => setProject((current) => (current ? { ...current, versions: (current.versions || []).map((v) => (v.id === openId ? { ...v, ...part } : v)) } : current)), [openId]);

  // Renomear uma pista ou mudar um volume não pode chamar `refresh()`: a resposta vinha com um
  // objeto novo, a mesa via pistas "diferentes" e baixaria tudo de novo para mostrar um nome
  // trocado. Esta costura remenda só o que mudou.
  const patchStem = useCallback((id: string, part: Partial<CatalogVersionFile>) => setProject((current) => (current ? { ...current, versions: (current.versions || []).map((v) => ({ ...v, files: (v.files || []).map((f) => (f.id === id ? { ...f, ...part } : f)) })) } : current)), []);

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
  // ⚠️ Trocar de gravação não é uma EDIÇÃO, e a marca tem de ser posta DENTRO deste efeito.
  // Num efeito à parte, a ordem decidia: este corre primeiro, vê a assinatura da gravação
  // anterior, agenda a gravação, e a marca chegava tarde demais para a impedir. O resultado era
  // uma escrita à toa a cada troca de ficha — que atropelaria quem estivesse a editar a mesma
  // gravação noutro lugar.
  const versaoMarcada = useRef<string | null>(null);
  useEffect(() => {
    if (open && versaoMarcada.current !== open.id) {
      versaoMarcada.current = open.id;
      lastSavedVersionSignature.current = versionSignature(open);
      return undefined;
    }
    if (!open || !canUpdateProject || versionSignature(open) === lastSavedVersionSignature.current) return undefined;
    const timer = window.setTimeout(async () => {
      setSaveState('saving');
      try {
        await catalogDb.updateCatalogVersion(open.id, { bpm: open.bpm, key: open.key });
        lastSavedVersionSignature.current = versionSignature(open);
        setSaveState('saved');
      } catch { setSaveState('error'); }
    }, 650);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, canUpdateProject]);


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


  // O `playVersion`/`seekVersion` da barra global saíram: dentro do editor quem toca é a mesa.
  // A barra continua a servir a LISTA de músicas, que é onde faz sentido — ouvir uma faixa
  // enquanto se navega por outras.

  // ─── As pistas ─────────────────────────────────────────────────────────
  //
  // O fader mexe no som na hora e no banco depois: gravar a cada pixel do arrasto seriam
  // dezenas de escritas para um gesto só. Um relógio por pista — arrastar duas seguidas não
  // pode fazer a segunda cancelar a gravação da primeira.
  /** Já avisei nesta abertura de tela? O aviso ensina uma vez; repetido, vira obstáculo. */
  const warnedAboutMix = useRef(false);

  /**
   * Mutar e desmutar — com um aviso, e só um, ao acender a Mix.
   *
   * ⚠️ A Mix já é a SOMA dos stems. Acesa junto com eles, cada instrumento soa duas vezes: uma
   * pela camada e outra pela mistura, com o desfasamento do processamento que a mix levou e as
   * camadas não. Não dá para impedir — é o que a pessoa pediu —, mas é quase sempre engano.
   */
  const toggleMute = (id: string, muda: boolean) => {
    mesa.mudar(id, muda);
    const acendendoAMix = !muda && ehPistaDaMix(id);
    const haCamadasNoAr = mesa.estado.pistas.some((p) => !ehPistaDaMix(p.id) && !p.muda);
    if (acendendoAMix && haCamadasNoAr && !warnedAboutMix.current) {
      warnedAboutMix.current = true;
      message.warning('A mix já é a soma das pistas: com as duas acesas você ouve cada instrumento duas vezes. Para comparar, use o S da mix.', 6);
    }
  };

  const gainTimers = useRef<Record<string, number>>({});
  useEffect(() => () => { Object.values(gainTimers.current).forEach(window.clearTimeout); }, []);

  const changeGain = (id: string, value: number) => {
    mesa.ganho(id, value);
    // A Mix não tem linha no banco: ela é o `audio_file` da gravação, e o volume dela é só
    // desta sessão de escuta.
    if (ehPistaDaMix(id)) return;
    window.clearTimeout(gainTimers.current[id]);
    gainTimers.current[id] = window.setTimeout(() => {
      const rounded = Number(value.toFixed(3));
      catalogDb.updateVersionFile(id, { gain: rounded })
        .then(() => patchStem(id, { gain: rounded }))
        .catch(() => { /* o valor real volta no próximo carregamento */ });
    }, 650);
  };

  const uploadStems = async (files: File[]) => {
    if (!open || !project || !artistId || !canCollaborateJam) return;
    const chosen = files.map((file) => ({ nome: file.name, tamanho: file.size, tipo: file.type, arquivo: file }));
    const { aceites, recusados } = validarPistas(chosen, stems.length);
    setRejected(recusados);
    if (!aceites.length) return;

    await enviarPistas({
      artistaId: artistId,
      projetoId: project.id,
      versaoId: open.id,
      // Na web o `File` JÁ é o corpo da requisição: não há bytes para ler antes da hora, e por
      // isso o `dados` preguiçoso do núcleo aqui é só uma promessa resolvida.
      arquivos: aceites.map((entry) => ({ nome: entry.nome, tipo: entry.tipo, tamanho: entry.tamanho, dados: () => Promise.resolve(entry.arquivo as Blob) })),
      jaExistem: stems.length,
      aoMudar: setUploads,
    });
    // Só aqui é que a mesa recarrega, e tem de recarregar: há áudio novo para descodificar.
    setUploads([]);
    await refresh();
  };

  const renameStem = async (name: string) => {
    if (!trackSheet) return;
    await catalogDb.updateVersionFile(trackSheet.id, { name });
    patchStem(trackSheet.id, { name });
  };

  const moveStem = async (direction: -1 | 1) => {
    if (!trackSheet) return;
    const order = stems.map((entry) => entry.id);
    const from = order.indexOf(trackSheet.id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to], order[from]];
    await catalogDb.reorderVersionFiles(order);
    // A ordem é assunto da tela: a mesa toca tudo junto e não precisa de saber. Por isso aqui
    // se remenda a posição de cada linha em vez de recarregar a gravação.
    order.forEach((id, position) => patchStem(id, { position }));
    setTrackSheet(null);
  };

  const removeStem = async () => {
    if (!trackSheet) return;
    const target = trackSheet;
    await catalogDb.deleteVersionFile(target.id);
    // O arquivo sai do balde junto: um stem são dezenas de MB, e um órfão no armazenamento é
    // custo que ninguém volta a olhar.
    const path = caminhoNoBalde(target.file_url, BALDE_DO_CATALOGO);
    if (path) await removerArquivo(BALDE_DO_CATALOGO, path);
    setTrackSheet(null);
    await refresh();
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
          {/* BPM e tom voltaram para cá, editáveis em linha. O que confundia antes não era
              editar na tela — era não se saber de QUEM era o número. Agora são da gravação
              ABERTA, e o rótulo abaixo diz qual é. */}
          <label className={styles.headerField}>
            <Input disabled={!canUpdateProject || !open} value={open?.bpm || ''} placeholder='—' maxLength={3} onChange={(event) => changeOpen({ bpm: event.target.value })} aria-label='Andamento da gravação, em BPM' />
            <span>BPM</span>
          </label>
          <label className={styles.headerField}>
            <Input disabled={!canUpdateProject || !open} value={open?.key || ''} placeholder='—' maxLength={6} onChange={(event) => changeOpen({ key: event.target.value })} aria-label='Tom da gravação' />
            <span>Tom</span>
          </label>
          {canUpdateProject && <span className={`${styles.autosave} ${styles[`autosave${saveState}`]}`} aria-live='polite'>{saveState === 'saving' ? 'Salvando…' : saveState === 'error' ? 'Falha ao salvar' : saveState === 'saved' ? 'Salvo' : ''}</span>}
        </div>
        <p className={`${styles.fieldOwner} ${open ? '' : styles.fieldOwnerAlert}`}>
          {open
            ? `de V${open.version_number}${open.title ? ` · ${open.title}` : ''}${open.id === project.primary_version_id ? ' ★' : ''}`
            : 'envie uma gravação para registrar andamento e tom'}
        </p>
      </header>

      <section className={styles.content}>
        <div className={styles.workspace}>
          {/* O que sobrou da ficha na tela é o que é da MÚSICA e não muda de gravação para
              gravação. BPM e tom subiram para o cabeçalho; gênero e data continuam a editar-se
              onde sempre se editaram, na ficha que o lápis abre. */}
          {(() => {
            const dados = { genero: project.genre, lancamento: project.release_date };
            const vazia = projetoVazio(dados);
            return (
              <button type='button' className={`${styles.fichaResumo} ${vazia ? styles.fichaResumoVazia : ''}`} onClick={openProjectEditor} aria-label={vazia ? 'Adicionar gênero e data' : 'Editar as informações da música'}>
                <span>{resumoDoProjeto(dados)}</span>
                <FiChevronRight aria-hidden />
              </button>
            );
          })()}

          <div className={styles.sectionHeader}>
            {canCollaborateJam && <Button className={styles.uploadButton} type='primary' icon={<FiUpload />} onClick={startUpload}>Enviar gravação</Button>}
            <input ref={uploadRef} type='file' accept='audio/*' style={{ display: 'none' }} onChange={onUploadPicked} />
          </div>

          {versions.length === 0 ? (
            <div className={styles.emptyVersions}>
              <strong>Este Espaço JAM ainda não tem uploads.</strong>
              <span>Envie a primeira guia, beat ou mix para começar a colaboração.</span>
            </div>
          ) : (
            // Espaço alterna a reprodução, como em qualquer editor de áudio — menos quando se
            // está a escrever num campo, senão digitar o BPM tocaria a música.
            <div
              className={styles.editor}
              onKeyDown={(evento) => {
                if (evento.key !== ' ' && evento.key !== 'Spacebar') return;
                const alvo = evento.target as HTMLElement;
                if (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'BUTTON') return;
                evento.preventDefault();
                mesa.alternar();
              }}
              tabIndex={-1}
            >
              <SeletorDeGravacoes versoes={versions} abertaId={openId} principalId={project.primary_version_id} aoAbrir={(versao) => setOpenId(versao.id)} />

              {!!open && (
                <>
                  <div className={styles.openIdentity}>
                    {open.author_avatar ? <img src={open.author_avatar} alt={open.author_name || 'Autor da gravação'} /> : <i>{initials(open.author_name)}</i>}
                    <div>
                      <strong>{open.title || `Versão ${open.version_number}`}</strong>
                      <small>{open.author_name || 'Autor não identificado'} · {formatDate(open.created_at)}</small>
                    </div>
                    {/* Estrela em vez de etiqueta: além de dizer qual é a principal, marca
                        outra sem abrir o modal de edição. */}
                    <button
                      type='button'
                      className={`${styles.primaryStar} ${open.id === project.primary_version_id ? styles.primaryStarOn : ''}`}
                      onClick={() => togglePrimary(open)}
                      aria-pressed={open.id === project.primary_version_id}
                      aria-label={open.id === project.primary_version_id ? `Desmarcar V${open.version_number} como gravação principal` : `Tornar V${open.version_number} a gravação principal`}
                    >
                      <FiStar />
                    </button>
                  </div>

                  {/* UM transporte para a gravação inteira. É ele que diz, sem uma palavra, que
                      as pistas abaixo tocam JUNTAS. */}
                  <Transporte
                    tocando={mesa.estado.tocando}
                    posicao={mesa.estado.posicao}
                    duracao={mesa.estado.duracao}
                    carregando={mesa.estado.carregando}
                    prontas={mesa.estado.pistas.filter((p) => p.carga === 'pronta').length}
                    aoAlternar={mesa.alternar}
                    aoBuscar={mesa.irPara}
                  />

                  {/* O aviso de peso vem ANTES de descodificar, da soma dos tamanhos dos
                      ficheiros: depois de descodificar já não há o que avisar. */}
                  {stems.reduce((soma, entry) => soma + (entry.size_bytes || 0), 0) > MEMORIA_DE_AVISO_BYTES && (
                    <p className={styles.weightWarning}>
                      São muitas pistas grandes. Em máquinas com pouca memória, o navegador pode
                      recarregar a aba sozinho — deixe menos pistas nesta gravação.
                    </p>
                  )}

                  {/* A ordem das linhas é a das PISTAS (posição no banco), e não a da mesa —
                      para ela, que toca tudo ao mesmo tempo, ordem nenhuma significa nada. */}
                  <div className={styles.pistas}>
                    {pistas.map((pista, indice) => {
                      const estado = mesa.estado.pistas.find((entry) => entry.id === pista.id);
                      if (!estado) return null;
                      const stem = stems.find((entry) => entry.id === pista.id);
                      return (
                        <Pista
                          key={pista.id}
                          pista={estado}
                          indice={indice}
                          picos={mesa.picos(pista.id, BARRAS)}
                          progresso={estado.duracao ? Math.min(mesa.estado.posicao / estado.duracao, 1) : 0}
                          haSolo={mesa.estado.pistas.some((entry) => entry.solo)}
                          aoMudar={() => toggleMute(pista.id, !estado.muda)}
                          aoSolar={() => mesa.solar(pista.id, !estado.solo)}
                          aoGanho={(valor) => changeGain(pista.id, valor)}
                          // A Mix não se renomeia, não se move e não se apaga: ela é o áudio da
                          // própria gravação, e mexer nela é mexer na gravação.
                          aoAbrirOpcoes={stem && canCollaborateJam ? () => setTrackSheet(stem) : undefined}
                        />
                      );
                    })}
                  </div>

                  {canCollaborateJam && (
                    <AdicionarPista
                      quantas={stems.length}
                      envios={uploads}
                      recusados={rejected}
                      aoEscolher={(arquivos) => { void uploadStems(arquivos); }}
                      aoLimparRecusas={() => setRejected([])}
                    />
                  )}

                  {/* As ações da gravação ficam no rodapé do editor, longe dos controles de
                      escuta: aqui se baixa, se comenta, se abre em tela cheia e se edita. */}
                  <div className={styles.openActions}>
                    {open.audio_file && <a href={open.audio_file} download={open.audio_file_name || true} aria-label={`Baixar V${open.version_number}`} title='Baixar gravação'><FiDownload /></a>}
                    <button type='button' className={styles.commentCount} onClick={() => openVersion(open)} aria-label={`Abrir ${open.comments?.length || 0} comentários de V${open.version_number}`} title='Abrir comentários'><FiMessageCircle /> {open.comments?.length || 0}</button>
                    <button type='button' onClick={() => openVersion(open)} aria-label={`Abrir visualização completa de V${open.version_number}`} title='Visualização completa'><FiMaximize2 /></button>
                    <button type='button' onClick={() => openVersionEditor(open)} aria-label={`Mais ações para V${open.version_number}`} title='Editar gravação'><FiMoreVertical /></button>
                  </div>
                </>
              )}
            </div>
          )}
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
          inherit={{ bpm: open?.bpm, key: open?.key, genre: project.genre }}
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

      <ModalDaPista
        pista={trackSheet}
        primeira={stems[0]?.id === trackSheet?.id}
        ultima={stems[stems.length - 1]?.id === trackSheet?.id}
        aoFechar={() => setTrackSheet(null)}
        aoRenomear={renameStem}
        aoMover={moveStem}
        aoRemover={removeStem}
      />

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
