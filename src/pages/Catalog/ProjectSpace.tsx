import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';

import { ID_DA_MIX, NOME_DA_MIX, montagemDaVersao, pistasDaGravacao } from '@maestra/core/audio/pistasDaVersao';
import { useMesa } from '@maestra/core/audio/useMesa';
import { useArtist } from '@maestra/core/hooks/useArtist';
import { useArtistCapabilities } from '@maestra/core/hooks/useArtistCapabilities';
import { CATALOG_STATUS, CATALOG_STATUS_OPTIONS } from '@maestra/core/constants/maestra';
import { LIMITE_DA_PISTA_BYTES, MAXIMO_DE_PISTAS } from '@maestra/core/constants/maestra';
import type {
  ArtistMember, CatalogProject, CatalogTrack, CatalogVersion, MusicGenre,
} from '@maestra/core/interfaces/maestra';
import * as catalogDb from '@maestra/core/services/db/catalog';
import * as genresDb from '@maestra/core/services/db/genres';
import * as membersDb from '@maestra/core/services/db/members';
import {
  BALDE_DO_CATALOGO, enviarArquivo, gravarEmCaminhoFixo, tipoDoCatalogo, tituloDoArquivo,
} from '@maestra/core/services/armazenamento';
import { useLocalPlayerStore } from '@maestra/core/stores/localPlayerStore';
import { useAppSelector } from '@maestra/core/store/store';

import { TrackModal } from '../../components/TrackModal';
import { Spinner } from '../../components/spinner/spinner';
import { EditorDaGravacao, type AcoesDoEditor } from './daw/EditorDaGravacao';
import { buscarWeb, criarContextoWeb } from './daw/contextoWeb';
import { duracaoDoArquivo } from './daw/duracao';
import { caminhoDaGuia, criarOfflineWeb, paraMp3 } from './daw/guia';
import { DS } from './daw/tokens';

// O ESPAÇO JAM: a música aberta num editor.
//
// ─── Por que esta tela mudou de forma ────────────────────────────────────────
//
// Quem chegava aqui não percebia o modelo — que o Espaço JAM é a MÚSICA e que cada versão é uma
// GRAVAÇÃO dela. A pilha de cartões, cada um com o seu play e a sua onda, dizia o contrário.
// Depois veio uma mesa de mistura: melhor, mas ainda um tocador de camadas, porque tudo
// começava no segundo zero.
//
// O que o dono do produto pediu, e deixou um projeto inteiro como referência, foi um EDITOR:
// Ableton, Logic, Pro Tools. Linha do tempo horizontal, clipes que se arrastam, tesoura, régua
// em segundos, agulha. A tela é `daw/EditorDaGravacao.tsx`, com a folha da referência; este
// arquivo é quem lhe dá os dados e guarda o que ela muda.
//
// ⚠️ AS GRAVAÇÕES NÃO SÃO PISTAS. V1, V2 e V3 são alternativas — ouve-se uma de cada vez —, e
// por isso são um menu no topo, e não faixas empilhadas. Quem toca junto são os clipes das
// pistas de UMA gravação.

const ESPERA = 650;

/** `3:46` — o formato que a lista de Músicas mostra. */
const relogioCurto = (segundos: number) => {
  const s = Math.max(0, Math.round(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// Fora do componente: são as mesmas duas funções para sempre, e cá dentro seriam objetos novos
// a cada render.
const DEPENDENCIAS_DA_MESA = { criarContexto: criarContextoWeb, buscar: buscarWeb };

/** Um campo do cabeçalho, vestido com a folha do editor. */
const CampoDoTopo: FC<{
  rotulo: string; valor: string; largura: number;
  aoMudar: (v: string) => void; travado?: boolean; limite: number;
}> = ({ rotulo, valor, largura, aoMudar, travado, limite }) => (
  <label style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    color: DS.color.textoFraco, fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
  }}>
    <input
      value={valor}
      onChange={(e) => aoMudar(e.target.value)}
      disabled={travado}
      maxLength={limite}
      placeholder='—'
      aria-label={rotulo}
      style={{
        width: largura, height: 26, padding: '0 8px',
        background: DS.color.bgCampo,
        border: `1px solid ${DS.color.borda}`,
        borderRadius: DS.raio.medio,
        color: DS.color.texto,
        fontSize: 12, fontWeight: 700, textAlign: 'center',
        fontFamily: DS.font.mono, outline: 'none',
      }}
    />
    {rotulo}
  </label>
);

const ProjectSpace: FC = () => {
  const { id: artistId, projectId } = useParams();
  const navigate = useNavigate();
  const { artist } = useArtist();
  const user = useAppSelector((state) => state.auth.user);
  const userMeta = (user?.user_metadata || {}) as Record<string, any>;
  const currentUserName = userMeta.full_name || userMeta.name || user?.email || 'Você';
  const { canCollaborateJam, canEditCatalog } = useArtistCapabilities(artist);
  const podeEditar = canEditCatalog || canCollaborateJam;

  const [project, setProject] = useState<CatalogProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'parado' | 'salvando' | 'salvo' | 'erro'>('parado');
  const [projectModal, setProjectModal] = useState(false);
  /** Onde vai o lote. Sem isto, enviar dez stems é olhar para uma tela parada durante um minuto. */
  const [envio, setEnvio] = useState<{ feitos: number; total: number } | null>(null);
  const [genres, setGenres] = useState<MusicGenre[]>([]);
  const [members, setMembers] = useState<ArtistMember[]>([]);

  // ⚠️ A BARRA GLOBAL SOME AQUI DENTRO. Dois motores de áudio na mesma tela é o bug óbvio: a
  // barra tocando a V2 por baixo do editor tocando a V1, cada uma com o seu play e nenhuma
  // sabendo da outra. Dentro do editor quem toca é a mesa — sempre.
  const setPlayerOpen = useLocalPlayerStore((state) => state.setOpen);
  const setPlayerCurrentId = useLocalPlayerStore((state) => state.setCurrentId);
  useEffect(() => { setPlayerOpen(false); setPlayerCurrentId(null); }, [setPlayerOpen, setPlayerCurrentId]);

  useEffect(() => {
    document.body.classList.add('jam-space-open');
    return () => document.body.classList.remove('jam-space-open');
  }, []);

  const refresh = useCallback(() => {
    if (!projectId) return Promise.resolve();
    return catalogDb.getCatalogProject(projectId)
      .then((next) => { setProject(next); })
      .catch(() => message.error('Erro ao carregar Espaço JAM'))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!artistId) return;
    genresDb.listGenres().then(setGenres).catch(() => {});
    membersDb.listMembers(artistId).then(setMembers).catch(() => {});
  }, [artistId]);

  const versions = useMemo(
    () => (project?.versions || []).slice().sort((a, b) => b.version_number - a.version_number),
    [project],
  );

  // Abre a principal — e, sem principal, a mais recente. Também conserta o caso de a gravação
  // aberta ter sido excluída: sem isto, o editor ficaria a apontar para nada.
  useEffect(() => {
    if (!versions.length) { setOpenId(null); return; }
    if (openId && versions.some((v) => v.id === openId)) return;
    setOpenId(versions.find((v) => v.id === project?.primary_version_id)?.id ?? versions[0].id);
  }, [versions, project?.primary_version_id, openId]);

  const open = useMemo(() => versions.find((v) => v.id === openId) ?? null, [versions, openId]);
  const doBanco = useMemo(() => pistasDaGravacao(open), [open]);
  const montagem = useMemo(() => montagemDaVersao(open), [open]);
  const mesa = useMesa(montagem, DEPENDENCIAS_DA_MESA);

  /**
   * As faixas que a tela desenha.
   *
   * ⚠️ TODA GRAVAÇÃO QUE JÁ EXISTE tem um `audio_file` e nenhuma pista montada. Sem esta
   * ponte, quem abrisse qualquer música de hoje veria um editor vazio — com o áudio a tocar e
   * nada na tela, que é a pior combinação possível. A mix aparece como uma faixa que toca e se
   * desenha, mas não se arrasta nem se corta: não há linha no banco para guardar a mudança.
   * Quem quiser editar carrega em "montar em pistas", e aí ela vira uma pista de verdade.
   */
  const pistas: CatalogTrack[] = useMemo(() => {
    if (doBanco.length) return doBanco;
    if (!open?.audio_file) return [];
    return [{
      id: ID_DA_MIX,
      version_id: open.id,
      name: NOME_DA_MIX,
      position: 0,
      gain: 1,
      muted: false,
      color_index: 0,
      clips: [{
        id: `${ID_DA_MIX}:${open.id}`,
        track_id: ID_DA_MIX,
        file_id: '',
        start_seconds: 0,
        offset_seconds: 0,
        // A duração real só se sabe depois de descodificar; até lá o clipe não tem largura.
        duration_seconds: mesa.estado.duracao,
      }],
    }];
  }, [doBanco, open, mesa.estado.duracao]);

  const porMontar = !doBanco.length && Boolean(open?.audio_file);

  // O Master é da GRAVAÇÃO: trocar de gravação traz o dela. Sem isto, a mesa ficaria com o
  // volume geral da anterior, e a pessoa ouviria a nova mais alta ou mais baixa sem saber por quê.
  const mestreAplicado = useRef<string | null>(null);
  useEffect(() => {
    if (!open || mestreAplicado.current === open.id) return;
    mestreAplicado.current = open.id;
    mesa.mestreEm(Number(open.master_gain ?? 0.8));
  }, [open, mesa]);

  // ─── Salvamento automático ────────────────────────────────────────────────
  //
  // Duas coisas diferentes: o título e o status são da MÚSICA, o BPM e o tom são da GRAVAÇÃO
  // ABERTA. Cada um compara com o que já está gravado antes de disparar — é o que impede de
  // regravar no primeiro render aquilo que acabou de voltar do servidor.
  const daMusica = (v: CatalogProject) => JSON.stringify({ title: v.title, status: v.status });
  const daGravacao = (v?: CatalogVersion | null) => JSON.stringify({ id: v?.id || '', bpm: v?.bpm || '', key: v?.key || '' });
  const musicaGravada = useRef('');
  const gravacaoMarcada = useRef<string | null>(null);
  const gravacaoGravada = useRef('');

  useEffect(() => { if (project && !musicaGravada.current) musicaGravada.current = daMusica(project); }, [project]);

  useEffect(() => {
    if (!project || !podeEditar || daMusica(project) === musicaGravada.current) return undefined;
    const conta = window.setTimeout(async () => {
      setSaveState('salvando');
      try {
        await catalogDb.updateCatalogProject(project.id, { title: project.title, status: project.status });
        musicaGravada.current = daMusica(project);
        setSaveState('salvo');
      } catch { setSaveState('erro'); }
    }, ESPERA);
    return () => window.clearTimeout(conta);
  }, [project, podeEditar]);

  // ⚠️ Trocar de gravação não é uma EDIÇÃO, e a marca tem de ser posta DENTRO deste efeito. Num
  // efeito à parte, a ordem decidia: este corria primeiro, via a assinatura da gravação
  // anterior, agendava a gravação, e a marca chegava tarde demais para a impedir.
  useEffect(() => {
    if (open && gravacaoMarcada.current !== open.id) {
      gravacaoMarcada.current = open.id;
      gravacaoGravada.current = daGravacao(open);
      return undefined;
    }
    if (!open || !podeEditar || daGravacao(open) === gravacaoGravada.current) return undefined;
    const conta = window.setTimeout(async () => {
      setSaveState('salvando');
      try {
        await catalogDb.updateCatalogVersion(open.id, { bpm: open.bpm, key: open.key });
        gravacaoGravada.current = daGravacao(open);
        setSaveState('salvo');
      } catch { setSaveState('erro'); }
    }, ESPERA);
    return () => window.clearTimeout(conta);
  }, [open, podeEditar]);

  // O "Salvo" vai embora sozinho; o erro fica, que é a única forma de saber que não pegou.
  useEffect(() => {
    if (saveState !== 'salvo') return undefined;
    const conta = window.setTimeout(() => setSaveState('parado'), 2000);
    return () => window.clearTimeout(conta);
  }, [saveState]);

  // ─── Remendos locais ──────────────────────────────────────────────────────
  //
  // Arrastar um clipe não pode chamar `refresh()`: a resposta vinha com objetos novos, a mesa
  // via uma montagem "diferente" e reagendaria tudo a cada pixel. Estas costuras mexem só no
  // que mudou, e o banco recebe a versão final com atraso.
  const mudarGravacao = (parte: Partial<CatalogVersion>) => setProject((atual) => (atual ? {
    ...atual,
    versions: (atual.versions || []).map((v) => (v.id === openId ? { ...v, ...parte } : v)),
  } : atual));

  const mudarPistaLocal = (pistaId: string, parte: Partial<CatalogTrack>) => setProject((atual) => (atual ? {
    ...atual,
    versions: (atual.versions || []).map((v) => ({
      ...v,
      tracks: (v.tracks || []).map((t) => (t.id === pistaId ? { ...t, ...parte } : t)),
    })),
  } : atual));

  const mudarClipeLocal = (clipeId: string, parte: Partial<{ start_seconds: number; duration_seconds: number; offset_seconds: number }>) =>
    setProject((atual) => (atual ? {
      ...atual,
      versions: (atual.versions || []).map((v) => ({
        ...v,
        tracks: (v.tracks || []).map((t) => ({
          ...t,
          clips: (t.clips || []).map((c) => (c.id === clipeId ? { ...c, ...parte } : c)),
        })),
      })),
    } : atual));

  /** Um relógio por alvo: mexer em dois clipes seguidos não pode cancelar a gravação do primeiro. */
  const relogios = useRef<Record<string, number>>({});
  useEffect(() => () => { Object.values(relogios.current).forEach(window.clearTimeout); }, []);

  const adiar = (chave: string, gravar: () => Promise<unknown>) => {
    window.clearTimeout(relogios.current[chave]);
    relogios.current[chave] = window.setTimeout(() => {
      gravar().catch(() => setSaveState('erro'));
    }, ESPERA);
  };

  // ─── As ações do editor ───────────────────────────────────────────────────

  /**
   * Transforma a mix numa pista editável.
   *
   * Ela passa a existir na biblioteca (uma linha em `catalog_version_files` a apontar para o
   * mesmo ficheiro que a gravação já usa) e ganha uma pista com um clipe do princípio ao fim.
   * O `audio_file` da gravação não muda — ele continua a ser o que o catálogo toca e o que o
   * certificado assina.
   */
  const montarAMix = async () => {
    if (!open?.audio_file || !podeEditar) return;
    const duracao = mesa.estado.duracao;
    if (!duracao) { message.warning('Espere o áudio carregar para montar.'); return; }

    setSaveState('salvando');
    try {
      const linha = await catalogDb.addVersionFile({
        version_id: open.id,
        name: open.title || 'Mix',
        file_url: open.audio_file,
        file_type: null,
        kind: 'stem',
        position: 0,
        duration_seconds: duracao,
      });
      await catalogDb.criarPistaComArquivo({
        versionId: open.id,
        arquivo: linha,
        nome: open.title || 'Mix',
        position: 0,
        colorIndex: 0,
        duracao,
      });
      await refresh();
      setSaveState('salvo');
    } catch {
      setSaveState('erro');
      message.error('Não consegui montar esta gravação');
    }
  };

  const enviarPistas = async (arquivos: File[], inicio: number, pistaAlvo?: string) => {
    if (!open || !project || !artistId || !podeEditar) return;

    // ⚠️ A MIX É MONTADA ANTES do primeiro stem entrar. Assim que existe uma pista de verdade,
    // a mix deixa de ser montada na hora (ela é a soma das camadas, e tocá-la junto dobra tudo)
    // — e sem esta linha, quem juntasse um stem a uma gravação por montar veria a própria
    // gravação desaparecer da tela. Montada primeiro, ela fica como pista, e quem quiser calá-la
    // carrega no M.
    if (porMontar) await montarAMix();

    const recusados: string[] = [];
    const aceites: File[] = [];
    for (const arquivo of arquivos) {
      if (!tipoDoCatalogo(arquivo.name)) { recusados.push(`${arquivo.name}: use MP3 ou WAV`); continue; }
      if (arquivo.size > LIMITE_DA_PISTA_BYTES) {
        recusados.push(`${arquivo.name}: maior que ${Math.round(LIMITE_DA_PISTA_BYTES / 1024 / 1024)} MB`);
        continue;
      }
      if (pistas.length + aceites.length >= MAXIMO_DE_PISTAS) {
        recusados.push(`${arquivo.name}: o limite é ${MAXIMO_DE_PISTAS} pistas`);
        continue;
      }
      aceites.push(arquivo);
    }
    if (recusados.length) message.warning(recusados.join(' · '));
    if (!aceites.length) return;

    setSaveState('salvando');
    setEnvio({ feitos: 0, total: aceites.length });
    const pasta = `${artistId}/${project.id}/versions/${open.id}/stems`;
    try {
      for (let i = 0; i < aceites.length; i += 1) {
        setEnvio({ feitos: i, total: aceites.length });
        const arquivo = aceites[i];
        // A duração vem dos metadados, antes de subir: é o tamanho do clipe que vai nascer, e
        // sem ela a tela teria de descodificar 40 MB só para desenhar um retângulo.
        const duracao = await duracaoDoArquivo(arquivo);
        if (!duracao) { message.warning(`${arquivo.name}: não consegui ler a duração`); continue; }

        const enviado = await enviarArquivo(BALDE_DO_CATALOGO, pasta, {
          nome: arquivo.name, tipo: arquivo.type, dados: arquivo,
        });
        const linha = await catalogDb.addVersionFile({
          version_id: open.id,
          name: tituloDoArquivo(arquivo.name),
          file_url: enviado.url,
          file_type: arquivo.type || null,
          kind: 'stem',
          position: pistas.length + i,
          size_bytes: arquivo.size,
          duration_seconds: duracao,
        });
        if (pistaAlvo) {
          // Com pista de destino, o ficheiro vira mais um CLIPE nela — é assim que se junta um
          // take novo à mesma faixa em vez de encher a montagem de pistas de uma linha só.
          await catalogDb.createClip({
            track_id: pistaAlvo,
            file_id: linha.id,
            start_seconds: inicio,
            offset_seconds: 0,
            duration_seconds: duracao,
          });
        } else {
          await catalogDb.criarPistaComArquivo({
            versionId: open.id,
            arquivo: linha,
            nome: tituloDoArquivo(arquivo.name),
            position: pistas.length + i,
            colorIndex: (pistas.length + i) % 6,
            duracao,
            inicio,
          });
        }
      }
      sujo.current = true;
      // Só aqui é que a montagem recarrega, e tem de recarregar: há áudio novo para descodificar.
      await refresh();
      setSaveState('salvo');
    } catch {
      setSaveState('erro');
      message.error('Não consegui enviar as pistas');
    } finally {
      setEnvio(null);
    }
  };

  // ─── A guia ───────────────────────────────────────────────────────────────
  //
  // A lista de Músicas toca UMA coisa por música. Antes era a "gravação principal" — fazia
  // sentido quando uma música era várias gravações alternativas e uma delas era a boa. Com o
  // editor, uma música é uma MONTAGEM: bateria, piano, voz, tocando juntas. Eleger uma
  // principal entre elas não quer dizer nada.
  //
  // ⚠️ QUANDO: ao SAIR, e só se a montagem mudou. Renderizar a cada edição daria o mesmo
  // resultado final depois de trinta renders e trinta envios de 4 MB — o mesmo arquivo, trinta
  // vezes, para ninguém ouvir vinte e nove deles.
  //
  // ⚠️ ONDE: num caminho FIXO por música, regravado por cima. Se cada render criasse um arquivo
  // novo, uma música editada trinta vezes guardaria trinta guias mortas; com mil músicas, isso
  // são centenas de gigabytes que ninguém volta a abrir.
  const sujo = useRef(false);
  const gerando = useRef(false);

  const gerarGuia = useCallback(async () => {
    const gravacao = openRef.current;
    if (!sujo.current || gerando.current || !gravacao || !artistId || !projectId) return;
    const mesaViva = mesaRef.current;
    if (!mesaViva) return;

    gerando.current = true;
    try {
      const rendido = await mesaViva.renderizar(criarOfflineWeb);
      if (!rendido) return;
      const mp3 = await paraMp3(rendido);
      const gravado = await gravarEmCaminhoFixo(
        BALDE_DO_CATALOGO, caminhoDaGuia(artistId, projectId), mp3, 'audio/mpeg',
      );

      // ⚠️ A guia tem CAMINHO PRÓPRIO, e o que muda é para onde a gravação aponta. Escrever por
      // cima do ficheiro original seria um laço: a pista da mix aponta para esse mesmo endereço,
      // e a guia seguinte teria a guia anterior dentro dela, cada vez mais dobrada. E o áudio
      // que a pessoa enviou um dia desapareceria sem forma de voltar atrás.
      await catalogDb.updateCatalogVersion(gravacao.id, {
        audio_file: gravado.url,
        audio_file_name: 'guia.mp3',
        duration: relogioCurto(rendido.duration),
      });
      sujo.current = false;
    } catch {
      // Falhar a guia não pode estragar a saída: a montagem está salva, e a próxima saída
      // tenta de novo.
    } finally {
      gerando.current = false;
    }
  }, [artistId, projectId]);

  // Sair da tela é o gatilho. `openRef` e `mesaRef` existem porque este efeito corre uma vez e
  // precisa dos valores do INSTANTE da saída, não dos da montagem.
  const openRef = useRef<CatalogVersion | null>(null);
  const mesaRef = useRef<typeof mesa | null>(null);
  openRef.current = open;
  mesaRef.current = mesa;
  useEffect(() => () => { void gerarGuia(); }, [gerarGuia]);

  const acoes: AcoesDoEditor = {
    aoSair: () => navigate(`/artists/${artistId}/catalog`),
    aoRenomear: (nome) => setProject((atual) => (atual ? { ...atual, title: nome } : atual)),
    aoAdicionarArquivos: (arquivos, inicio, pistaAlvo) => { void enviarPistas(arquivos, inicio, pistaAlvo); },

    aoMoverClipe: (clipeId, inicio) => {
      sujo.current = true;
      mudarClipeLocal(clipeId, { start_seconds: inicio });
      adiar(`clipe:${clipeId}`, () => catalogDb.updateClip(clipeId, { start_seconds: inicio }));
    },

    // ⚠️ Cortar não toca no ficheiro: o clipe da esquerda encolhe, e nasce um da direita sobre
    // o MESMO áudio com o recorte deslocado. É por isso que a operação é instantânea.
    aoCortarClipe: (clipeId, emSegundo) => {
      const pista = pistas.find((p) => (p.clips || []).some((c) => c.id === clipeId));
      const clipe = (pista?.clips || []).find((c) => c.id === clipeId);
      if (!pista || !clipe) return;

      const inicio = Number(clipe.start_seconds) || 0;
      const duracao = Number(clipe.duration_seconds) || 0;
      const recorte = Number(clipe.offset_seconds) || 0;
      const dentro = emSegundo - inicio;
      if (dentro <= 0.05 || dentro >= duracao - 0.05) return;

      sujo.current = true;
      setSaveState('salvando');
      void (async () => {
        try {
          await catalogDb.updateClip(clipeId, { duration_seconds: dentro });
          await catalogDb.createClip({
            track_id: pista.id,
            file_id: clipe.file_id,
            start_seconds: emSegundo,
            offset_seconds: recorte + dentro,
            duration_seconds: duracao - dentro,
          });
          await refresh();
          setSaveState('salvo');
        } catch { setSaveState('erro'); }
      })();
    },

    aoApagarClipe: (clipeId) => {
      sujo.current = true;
      setSaveState('salvando');
      void catalogDb.deleteClip(clipeId)
        .then(refresh)
        .then(() => setSaveState('salvo'))
        .catch(() => setSaveState('erro'));
    },

    aoMudarPista: (pistaId, parte) => {
      sujo.current = true;
      mudarPistaLocal(pistaId, parte);
      // O som muda AGORA; o banco recebe depois. O contrário faria o fader responder com meio
      // segundo de atraso, e ninguém mistura assim.
      if (parte.muted !== undefined) mesa.mudar(pistaId, parte.muted);
      if (parte.gain !== undefined) mesa.ganho(pistaId, parte.gain);
      if (parte.pan !== undefined) mesa.panoramar(pistaId, parte.pan);
      adiar(`pista:${pistaId}`, () => catalogDb.updateTrack(pistaId, parte));
    },

    aoApagarPista: (pistaId) => {
      sujo.current = true;
      setSaveState('salvando');
      // O FICHEIRO fica na biblioteca da gravação: apagar a pista é desfazer a montagem, não
      // deitar fora o que foi enviado.
      void catalogDb.deleteTrack(pistaId)
        .then(refresh)
        .then(() => setSaveState('salvo'))
        .catch(() => setSaveState('erro'));
    },

    aoSolar: (pistaId, solo) => mesa.solar(pistaId, solo),

    // O Master é o fader que fica depois de todos os outros: muda o som na hora e vai para o
    // banco com atraso, como os outros faders.
    aoMestre: (valor) => {
      mesa.mestreEm(valor);
      if (!open) return;
      mudarGravacao({ master_gain: valor });
      adiar('mestre', () => catalogDb.updateCatalogVersion(open.id, { master_gain: valor }));
    },
  };

  if (loading) return <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: DS.color.bgBase }}><Spinner loading>{null as any}</Spinner></div>;
  if (!project) return <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: DS.color.bgBase, color: DS.color.textoFraco }}>Espaço JAM não encontrado.</div>;

  const rotuloDoStatus = CATALOG_STATUS[project.status as keyof typeof CATALOG_STATUS]?.label || project.status;

  return (
    <>
      <EditorDaGravacao
        titulo={project.title}
        selo={saveState}
        envio={envio}
        pistas={pistas}
        pistaFixaId={porMontar ? ID_DA_MIX : null}
        aoMontar={porMontar && podeEditar ? () => { void montarAMix(); } : undefined}
        estado={mesa.estado}
        picos={mesa.picos}
        transporte={{
          alternar: mesa.alternar,
          // Parar é pausar E voltar ao início — é o que o quadrado faz em qualquer editor.
          parar: () => { mesa.pausar(); mesa.irPara(0); },
          irPara: mesa.irPara,
        }}
        podeEditar={podeEditar}
        acoes={acoes}
        ficha={(
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {/* O status é da MÚSICA; o BPM e o tom são da GRAVAÇÃO ABERTA — e é o rótulo
                por baixo que resolve a confusão de quem não sabia de quem era o número. */}
            <select
              value={project.status}
              onChange={(e) => setProject({ ...project, status: e.target.value })}
              disabled={!podeEditar}
              aria-label={`Status: ${rotuloDoStatus}`}
              style={{
                height: 26, padding: '0 8px',
                background: DS.color.bgCampo,
                border: `1px solid ${DS.color.borda}`,
                borderRadius: DS.raio.medio,
                color: DS.color.textoApoio,
                fontSize: 11, fontWeight: 600, fontFamily: DS.font.display,
                outline: 'none', cursor: podeEditar ? 'pointer' : 'default',
              }}
            >
              {CATALOG_STATUS_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>

            <CampoDoTopo
              rotulo='BPM'
              valor={open?.bpm || ''}
              largura={48}
              limite={3}
              travado={!podeEditar || !open}
              aoMudar={(v) => mudarGravacao({ bpm: v })}
            />
            <CampoDoTopo
              rotulo='TOM'
              valor={open?.key || ''}
              largura={52}
              limite={6}
              travado={!podeEditar || !open}
              aoMudar={(v) => mudarGravacao({ key: v })}
            />

            <button
              type='button'
              onClick={() => setProjectModal(true)}
              title='Editar as informações da música'
              aria-label='Editar as informações da música'
              style={{
                height: 26, padding: '0 10px',
                background: 'transparent', border: `1px solid ${DS.color.borda}`,
                borderRadius: DS.raio.medio, color: DS.color.textoFraco,
                fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', cursor: 'pointer',
              }}
            >
              FICHA
            </button>
          </div>
        )}
      />

      {project && artistId && (
        <TrackModal
          open={projectModal}
          artistId={artistId}
          item={catalogDb.catalogProjectToItem(project, open ?? undefined)}
          genres={genres}
          assigneeOptions={[
            ...(user ? [{ id: user.id, name: `${currentUserName} (você)` }] : []),
            ...members.filter((m) => m.status === 'active')
              .map((m) => ({ id: (m.user_id || m.id) as string, name: m.name || m.email })),
          ]}
          currentUserName={currentUserName}
          currentUserId={user?.id || null}
          currentUserAvatar={userMeta.avatar_url || userMeta.picture || null}
          onClose={() => setProjectModal(false)}
          onSaved={() => { void refresh(); }}
          onVersionsChanged={() => { void refresh(); }}
        />
      )}
    </>
  );
};

export default ProjectSpace;
