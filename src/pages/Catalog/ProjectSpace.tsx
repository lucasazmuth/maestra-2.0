import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ID_DA_MIX, NOME_DA_MIX, montagemDaVersao, pistasDaGravacao } from '@maestra/core/audio/pistasDaVersao';
import { useMesa } from '@maestra/core/audio/useMesa';
import { useAnaliseDaVersao } from '@maestra/core/hooks/useAnaliseDaVersao';
import { useArtist } from '@maestra/core/hooks/useArtist';
import { useArtistCapabilities } from '@maestra/core/hooks/useArtistCapabilities';
import { CATALOG_STATUS, CATALOG_STATUS_OPTIONS } from '@maestra/core/constants/maestra';
import { LIMITE_DA_PISTA_BYTES, MAXIMO_DE_PISTAS } from '@maestra/core/constants/maestra';
import type {
  ArtistMember, CatalogItem, CatalogProject, CatalogTrack, CatalogVersion, MusicGenre,
} from '@maestra/core/interfaces/maestra';
import {
  bpmLegivel, outroAndamento, podeOuvirSozinho,
} from '@maestra/core/services/db/audioJobs';
import * as catalogDb from '@maestra/core/services/db/catalog';
import * as genresDb from '@maestra/core/services/db/genres';
import * as membersDb from '@maestra/core/services/db/members';
import {
  BALDE_DO_CATALOGO, enviarArquivo, gravarEmCaminhoFixo, tipoDoCatalogo, tituloDoArquivo,
} from '@maestra/core/services/armazenamento';
import { useLocalPlayerStore } from '@maestra/core/stores/localPlayerStore';
import { useAppSelector } from '@maestra/core/store/store';

import { ConfigProvider, Input, message, theme } from 'antd';

import { CamposDaFicha, CamposDosSplits } from '../../components/ficha/campos';
import { Spinner } from '../../components/spinner/spinner';
import { EditorDaGravacao, type AcoesDoEditor } from './daw/EditorDaGravacao';
import { TelaDeExportar } from './daw/TelaDeExportar';
import { buscarWeb, criarContextoWeb } from './daw/contextoWeb';
import { duracaoDoArquivo } from './daw/duracao';
import {
  baixarArquivo, nomeDoArquivoDaPista, paraWav, paraZip, type StemExportado,
} from './daw/exportar';
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
/**
 * Um campo do rodapé do editor: o andamento e o tom da gravação aberta.
 *
 * Exportado para o teste: é aqui que a proveniência do número aparece, e "aparece" é a única
 * coisa que uma leitura do código-fonte não consegue provar.
 */
export const CampoDoTopo: FC<{
  rotulo: string; valor: string; largura: number;
  aoMudar: (v: string) => void; travado?: boolean; limite: number;
  /**
   * O que está ali foi OUVIDO do áudio, e não escrito por ninguém.
   *
   * ⚠️ A PROVENIÊNCIA TEM DE SER VISÍVEL. Um número que aparece sozinho num campo é
   * indistinguível de um número que a pessoa escreveu e esqueceu — e é sobre esse que ela
   * depois vai confiar para registar a obra. A borda muda de cor e o rótulo diz de onde veio.
   */
  ouvido?: boolean;
}> = ({ rotulo, valor, largura, aoMudar, travado, limite, ouvido }) => (
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
      aria-label={ouvido ? `${rotulo} ouvido do áudio` : rotulo}
      title={ouvido ? 'Ouvi este andamento no áudio. Escreva por cima se não for.' : undefined}
      style={{
        width: largura, height: 26, padding: '0 8px',
        background: DS.color.bgCampo,
        border: `1px solid ${ouvido ? DS.color.primaria : DS.color.borda}`,
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

  // ─── A ficha, dentro do editor ────────────────────────────────────────────
  //
  // Os MESMOS campos do modal de sempre (`components/ficha/campos.tsx`), montados aqui em vez
  // de flutuarem por cima. O rascunho autosalva: mudanças na ficha gravam sozinhas, como em tudo
  // um controlo de som: escrever um ISRC a meio não pode gravar meio ISRC.
  const [rascunho, setRascunho] = useState<Partial<CatalogItem>>({});
  // Autosave da ficha: serializa o rascunho e compara com o que foi gravado
  const [enviandoCapa, setEnviandoCapa] = useState<'cover' | 'audio' | null>(null);
  const fichaCarregada = useRef<string | null>(null);
  const rascunhoGravado = useRef('');
  const contaFicha = useRef<number | null>(null);
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
  const daBanco = useCallback((r: Partial<CatalogItem>) => JSON.stringify({
    title: r.title, status: r.status, genre: r.genre, release_date: r.release_date, isrc: r.isrc,
    upc: r.upc, bpm: r.bpm, key: r.key, duration: r.duration, lyrics: r.lyrics, details: r.details,
    cover_image: r.cover_image, cover_image_name: r.cover_image_name,
    composition_splits: r.composition_splits, recording_splits: r.recording_splits, assignee: r.assignee,
  }), []);
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

  // ─── O andamento, ouvido sozinho ──────────────────────────────────────────
  //
  // O detector de BPM existe desde sempre e vivia escondido na ficha, atrás de um botão que era
  // preciso descobrir. Aqui ele acontece por conta própria na primeira gravação do projeto —
  // porque o andamento é o que faz a régua contar compassos, e pedir a alguém que digite um
  // número que a máquina consegue ouvir é trabalho que não devia existir.
  //
  // As regras de QUANDO (uma vez por gravação, só com o campo vazio, só para quem edita) vivem
  // no núcleo, em `podeOuvirSozinho`: elas guardam cota e guardam trabalho de gente.
  const analiseDoJam = useAnaliseDaVersao(openId);
  /**
   * Estamos à espera de um andamento que ainda vai chegar?
   *
   * ⚠️ É ELE QUE IMPEDE O CAMPO DE SE ENCHER SOZINHO OUTRA VEZ. Sem esta memória, quem apagou o
   * BPM de propósito reencontrava-o preenchido na recarga seguinte — a análise antiga continua
   * no banco, e "campo vazio + análise existe" descreve tanto o primeiro envio como o gesto
   * deliberado de o esvaziar. Só se preenche o que se pediu, ou o que já estava a correr quando
   * esta tela abriu.
   */
  const esperandoOAndamento = useRef(false);
  const ouviuNestaVersao = useRef<string | null>(null);
  const [ouvido, setOuvido] = useState<number | null>(null);

  useEffect(() => {
    if (!openId || analiseDoJam.carregando) return;
    if (ouviuNestaVersao.current === openId) return;
    ouviuNestaVersao.current = openId;
    // Já havia um a correr quando esta tela abriu: não se pede outro, mas espera-se por ele.
    if (analiseDoJam.emCurso('bpm_tom')) { esperandoOAndamento.current = true; return; }
    if (!podeOuvirSozinho({
      temAudio: Boolean(open?.audio_file),
      bpmEscrito: open?.bpm,
      analise: analiseDoJam.analise,
      trabalhos: analiseDoJam.trabalhos,
      podeEditar,
    })) return;
    esperandoOAndamento.current = true;
    void analiseDoJam.pedir('bpm_tom');
  }, [openId, open?.audio_file, open?.bpm, podeEditar, analiseDoJam]);

  useEffect(() => {
    if (!esperandoOAndamento.current || !openId) return;
    const detectado = bpmLegivel(analiseDoJam.analise?.bpm);
    if (!detectado) return;
    esperandoOAndamento.current = false;
    // ⚠️ E MESMO ASSIM, SÓ SE AINDA ESTIVER VAZIO. A análise demora minutos, e nesses minutos a
    // pessoa pode ter escrito o andamento à mão — que é a resposta certa por definição, porque
    // o andamento da obra é o que o autor diz que é.
    if (bpmLegivel(open?.bpm)) return;
    setOuvido(Number(detectado));
    mudarGravacao({ bpm: detectado });
    message.info(`Ouvi ${detectado} BPM neste áudio. Escreva por cima se não for.`);
  }, [analiseDoJam.analise, openId, open?.bpm]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * O outro andamento possível, enquanto o que está no campo for o que a máquina ouviu.
   *
   * ⚠️ NÃO É "FALTA DE CONFIANÇA", é ambiguidade real: um trap a 140 e o mesmo trap contado em
   * meio-tempo a 70 têm exatamente as mesmas batidas, e a máquina escolhe uma delas com toda a
   * certeza do mundo. Por isso a troca aparece sempre que existe uma alternativa plausível, e
   * não só quando o número vem inseguro.
   */
  const alternativa = ouvido !== null && Number(bpmLegivel(open?.bpm)) === ouvido
    ? outroAndamento(ouvido)
    : null;

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

  // Autosave da ficha com debounce: título, status, gênero, atribuição, ISRC/UPC, BPM, tom, datas,
  // letra, detalhes, capa e créditos — tudo o que é editável na ficha salva sozinho.
  useEffect(() => {
    if (!project || !artistId || !podeEditar || !rascunho.title?.trim()) return undefined;
    const assinatura = daBanco(rascunho);
    if (assinatura === rascunhoGravado.current) return undefined;

    if (contaFicha.current) window.clearTimeout(contaFicha.current);
    contaFicha.current = window.setTimeout(async () => {
      try {
        await catalogDb.saveCatalogProjectFromForm(
          {
            artist_id: artistId,
            title: rascunho.title,
            status: rascunho.status || 'composition',
            genre: rascunho.genre || null,
            release_date: rascunho.release_date || null,
            isrc: rascunho.isrc || null,
            upc: rascunho.upc || null,
            bpm: rascunho.bpm || null,
            key: rascunho.key || null,
            duration: rascunho.duration || null,
            lyrics: rascunho.lyrics || null,
            details: rascunho.details || null,
            cover_image: rascunho.cover_image || null,
            cover_image_name: rascunho.cover_image_name || null,
            composition_splits: rascunho.composition_splits || [],
            recording_splits: rascunho.recording_splits || [],
            assignee: rascunho.assignee || null,
            id: project.id,
            versionId: open?.id,
          } as never,
          { id: user?.id || null, name: currentUserName, avatar: userMeta.avatar_url || null },
        );
        rascunhoGravado.current = assinatura;
      } catch {
        /* silencioso */
      }
    }, ESPERA);
    return () => { if (contaFicha.current) window.clearTimeout(contaFicha.current); };
  }, [rascunho, project, artistId, podeEditar, open?.id, user?.id, currentUserName, userMeta.avatar_url, daBanco]);

  const adiar = (chave: string, gravar: () => Promise<unknown>) => {
    window.clearTimeout(relogios.current[chave]);
    relogios.current[chave] = window.setTimeout(() => {
      gravar().catch(() => setSaveState('erro'));
    }, ESPERA);
  };

  /**
   * Esquece uma escrita adiada que já não faz sentido.
   *
   * ⚠️ APAGAR TEM DE CANCELAR O QUE ESTAVA A CAMINHO. Tocar num clipe agenda a gravação da
   * posição dele; carregar em REMOVER logo a seguir apagava a linha e, meio segundo depois, a
   * escrita adiada chegava a um `id` que já não existia. O clipe sumia (porque foi mesmo
   * removido) e a tela dizia "Falha ao salvar" — um erro vermelho para a única operação da
   * sequência que tinha corrido bem.
   */
  const esquecer = (chave: string) => {
    window.clearTimeout(relogios.current[chave]);
    delete relogios.current[chave];
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
    // ⚠️ CONTAR O QUE ENTROU DE FACTO. Um ficheiro pode ser aceite na triagem e ainda assim não
    // chegar ao fim — o `continue` de baixo salta os que não têm duração legível. Sem esta
    // conta, o selo dizia "Salvo" depois de não salvar nada: a gaveta fechava, o aviso passava,
    // e ficava um "Salvo" verde por cima de uma montagem que continuava vazia.
    let entraram = 0;
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
        entraram += 1;
      }

      if (!entraram) {
        // Nada entrou: não há o que recarregar, e sobretudo não há o que comemorar.
        setSaveState('erro');
        return;
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
  const [gerando, setGerando] = useState(false);

  const gerarGuia = async (gravacao: CatalogVersion | null) => {
    if (!sujo.current || !gravacao || !artistId || !projectId) return;

    setGerando(true);
    try {
      const rendido = await mesa.renderizar(criarOfflineWeb);
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
      // Falhar a guia não pode prender a pessoa na tela: a montagem está salva, e a próxima
      // saída tenta de novo.
    } finally {
      setGerando(false);
    }
  };

  // ─── Exportar: stems (ZIP) e guia (WAV/MP3) ────────────────────────────────
  //
  // Sai daqui, e não da tela: é aqui que mora a mesa (os buffers já carregados) e a URL da guia
  // já salva. A tela de Exportar é pura — só mostra o que há e dispara estes callbacks.
  const [exportandoEm, setExportandoEm] = useState<'stems' | 'guia-wav' | 'guia-mp3' | null>(null);

  const baixarStems = async () => {
    if (exportandoEm || !pistas.length) return;
    setExportandoEm('stems');
    try {
      const stems: StemExportado[] = [];
      // Sequencial, e não `Promise.all`: cada `renderizar` já percorre todo o buffer decodificado
      // — em paralelo, um projeto de dez pistas tentaria segurar dez montagens offline ao mesmo
      // tempo, e é isso que trava a aba, não o tempo total de espera.
      for (const pista of pistas) {
        // eslint-disable-next-line no-await-in-loop
        const rendido = await mesa.renderizar(criarOfflineWeb, pista.id);
        if (!rendido) continue;
        stems.push({ nome: nomeDoArquivoDaPista(pista.name, 'wav'), dados: paraWav(rendido) });
      }
      if (!stems.length) { message.warning('Nenhuma pista pôde ser exportada.'); return; }
      const zip = await paraZip(stems);
      baixarArquivo(zip, `${project?.title || 'stems'}.zip`);
    } catch {
      message.error('Não consegui preparar os stems.');
    } finally {
      setExportandoEm(null);
    }
  };

  const baixarGuiaWav = async () => {
    if (exportandoEm || !pistas.length) return;
    setExportandoEm('guia-wav');
    try {
      const rendido = await mesa.renderizar(criarOfflineWeb);
      if (!rendido) { message.warning('Espere o áudio carregar para exportar a guia.'); return; }
      baixarArquivo(paraWav(rendido), `${project?.title || 'guia'}.wav`);
    } catch {
      message.error('Não consegui gerar a guia em WAV.');
    } finally {
      setExportandoEm(null);
    }
  };

  const baixarGuiaMp3 = async () => {
    if (exportandoEm || !open?.audio_file) return;
    setExportandoEm('guia-mp3');
    try {
      // Busca o próprio arquivo em vez de um link direto: só assim o nome do download é o
      // título da música, e não `guia.mp3` — o mesmo endereço fixo para toda gravação.
      const resposta = await fetch(open.audio_file);
      const blob = await resposta.blob();
      baixarArquivo(blob, `${project?.title || 'guia'}.mp3`);
    } catch {
      message.error('Não consegui baixar a guia.');
    } finally {
      setExportandoEm(null);
    }
  };

  // O rascunho parte do que está no banco, e recarrega quando a gravação aberta muda.
  useEffect(() => {
    if (!project) return;
    const chave = `${project.id}:${openId ?? ''}`;
    if (fichaCarregada.current === chave) return;
    fichaCarregada.current = chave;
    setRascunho(catalogDb.catalogProjectToItem(project, open ?? undefined));
  }, [project, open, openId]);

  /** A capa sobe na hora — é um ficheiro, e ficheiro não cabe num rascunho. */
  const enviarCapa = async (arquivo: File) => {
    if (!artistId) return;
    setEnviandoCapa('cover');
    try {
      const enviado = await enviarArquivo(BALDE_DO_CATALOGO, `${artistId}/covers`, {
        nome: arquivo.name, tipo: arquivo.type, dados: arquivo,
      });
      setRascunho((atual) => ({ ...atual, cover_image: enviado.url, cover_image_name: arquivo.name }));
    } catch {
      message.error('Não consegui enviar a capa');
    } finally {
      setEnviandoCapa(null);
    }
  };

  const mexerNaFicha = (parte: Partial<CatalogItem>) =>
    setRascunho((atual) => ({ ...atual, ...parte }));

  const acoes: AcoesDoEditor = {
    // ⚠️ A GUIA É GERADA ANTES DE SAIR, e não na limpeza do efeito, porque a limpeza chega
    // tarde: o `useMesa` descarta a mesa primeiro — é ele quem está declarado antes — e a
    // renderização encontraria a gaveta de buffers já vazia. Foi assim que a primeira versão
    // falhou, em silêncio, sem gravar nada.
    aoSair: async () => {
      await gerarGuia(open);
      navigate(`/artists/${artistId}/catalog`);
    },
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
      esquecer(`clipe:${clipeId}`);
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
      // A pista leva os clipes dela: as escritas adiadas de cada um também deixam de fazer
      // sentido, e cada uma delas daria a mesma falha inventada.
      esquecer(`pista:${pistaId}`);
      (pistas.find((p) => p.id === pistaId)?.clips || []).forEach((c) => esquecer(`clipe:${c.id}`));
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
        gerando={gerando}
        pistas={pistas}
        pistaFixaId={porMontar ? ID_DA_MIX : null}
        aoMontar={porMontar && podeEditar ? () => { void montarAMix(); } : undefined}
        estado={mesa.estado}
        picos={mesa.picos}
        transporte={{
          alternar: mesa.alternar,
          loopar: mesa.loopar,
          irPara: mesa.irPara,
        }}
        podeEditar={podeEditar}
        acoes={acoes}
        bpm={open?.bpm}
        numeros={(
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {/* O andamento e o tom são da GRAVAÇÃO ABERTA, e não da obra — por isso descem
                para a barra dos controlos, junto do que governa o som. */}
            <CampoDoTopo
              rotulo='BPM'
              valor={open?.bpm || ''}
              largura={48}
              limite={3}
              travado={!podeEditar || !open}
              aoMudar={(v) => mudarGravacao({ bpm: v })}
              ouvido={ouvido !== null && Number(bpmLegivel(open?.bpm)) === ouvido}
            />
            {/* A troca de oitava. Um toque, e volta com outro: é um interruptor entre as duas
                leituras da mesma batida, não uma correção que se faz uma vez. */}
            {alternativa !== null && (
              <button
                type='button'
                onClick={() => {
                  setOuvido(alternativa);
                  mudarGravacao({ bpm: String(alternativa) });
                }}
                title={`Também pode ser ${alternativa} BPM: a mesma batida, contada em dobro ou em meio-tempo.`}
                aria-label={`Trocar para ${alternativa} BPM`}
                style={{
                  height: 26, padding: '0 8px', marginLeft: -4,
                  background: 'transparent',
                  border: `1px dashed ${DS.color.borda}`,
                  borderRadius: DS.raio.medio,
                  color: DS.color.textoApoio,
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  fontFamily: DS.font.mono, whiteSpace: 'nowrap',
                }}
              >
                ou {alternativa}?
              </button>
            )}
            <CampoDoTopo
              rotulo='TOM'
              valor={open?.key || ''}
              largura={52}
              limite={6}
              travado={!podeEditar || !open}
              aoMudar={(v) => mudarGravacao({ key: v })}
            />
          </div>
        )}
        fichaCompleta={(
          // ⚠️ O antd inteiro em modo escuro, e só AQUI DENTRO: os campos são os mesmos do
          // modal claro, e pintá-los à mão seria reescrever meia biblioteca. O `algorithm`
          // recalcula os tokens todos — fundos, bordas, foco, estados desabilitados — a partir
          // das cores desta tela.
          <ConfigProvider
            theme={{
              algorithm: theme.darkAlgorithm,
              token: {
                colorPrimary: DS.color.primaria,
                colorBgContainer: DS.color.bgCampo,
                colorBgElevated: DS.color.bgPainel,
                colorBorder: DS.color.borda,
                colorText: DS.color.texto,
                colorTextPlaceholder: DS.color.textoInerte,
                borderRadius: DS.raio.medio,
              },
              // ⚠️ AS LISTAS QUE ABREM PRECISAM DE SER DITAS À PARTE, e isto não é zelo a mais.
              // O `ConfigProvider` da aplicação (`App.tsx`) trava `Select` e `DatePicker` em
              // branco por token de COMPONENTE — foi como se tirou o antd do design escuro
              // antigo. Token de componente vence o token global de um provedor de dentro, e o
              // resultado era o campo escuro abrindo uma lista branca por cima do editor.
              components: {
                Select: {
                  colorBgElevated: DS.color.bgPainel,
                  colorText: DS.color.texto,
                  colorTextPlaceholder: DS.color.textoInerte,
                  optionSelectedBg: DS.color.bgPista,
                  optionSelectedColor: DS.color.texto,
                  optionActiveBg: DS.color.bgHover,
                  boxShadowSecondary: '0 14px 34px rgba(0, 0, 0, .5)',
                },
                DatePicker: {
                  colorBgElevated: DS.color.bgPainel,
                  colorText: DS.color.texto,
                  colorTextHeading: DS.color.texto,
                  colorTextDisabled: DS.color.textoInerte,
                  colorIcon: DS.color.textoFraco,
                  colorIconHover: DS.color.primaria,
                  colorSplit: DS.color.borda,
                  cellHoverBg: DS.color.bgHover,
                  boxShadowSecondary: '0 14px 34px rgba(0, 0, 0, .5)',
                },
              },
            }}
          >
          <div style={{ display: 'grid', gap: 20 }}>
            <CamposDaFicha
              draft={rascunho}
              set={mexerNaFicha}
              genres={genres}
              assigneeOptions={[
                ...(user ? [{ id: user.id, name: `${currentUserName} (você)` }] : []),
                ...members.filter((m) => m.status === 'active')
                  .map((m) => ({ id: (m.user_id || m.id) as string, name: m.name || m.email })),
              ]}
              uploading={enviandoCapa}
              aoEnviarCapa={(arquivo) => { void enviarCapa(arquivo); }}
              versionId={open?.id}
            />
            <CamposDosSplits draft={rascunho} set={mexerNaFicha} />
          </div>
          </ConfigProvider>
        )}
        exportar={(
          <TelaDeExportar
            pistas={pistas.map((p) => ({ id: p.id, nome: p.name }))}
            temStems={!porMontar && pistas.length > 0}
            temGuia={!!open?.audio_file}
            emCurso={exportandoEm}
            aoBaixarStems={() => { void baixarStems(); }}
            aoBaixarGuiaWav={() => { void baixarGuiaWav(); }}
            aoBaixarGuiaMp3={() => { void baixarGuiaMp3(); }}
          />
        )}
        letra={(
          <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: {
            colorPrimary: DS.color.primaria, colorBgContainer: DS.color.bgCampo,
            colorBorder: DS.color.borda, colorText: DS.color.texto,
            colorTextPlaceholder: DS.color.textoInerte, borderRadius: DS.raio.medio,
          } }}>
          <Input.TextArea
            rows={12}
            placeholder='Letra da música…'
            value={rascunho.lyrics || ''}
            onChange={(e) => mexerNaFicha({ lyrics: e.target.value })}
          />
          </ConfigProvider>
        )}
        ficha={(
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {/* O status é da MÚSICA: é o estado da obra, e anda com o nome dela no topo. */}
            {/* Status minimalista: sem borda, sem fundo — só texto. Permite trocar rápido. */}
            <select
              value={project.status}
              onChange={(e) => setProject({ ...project, status: e.target.value })}
              disabled={!podeEditar}
              aria-label={`Status: ${rotuloDoStatus}`}
              style={{
                height: 26, padding: '0 8px',
                background: 'transparent',
                border: 'none',
                borderRadius: 0,
                color: DS.color.textoApoio,
                fontSize: 12, fontWeight: 600, fontFamily: DS.font.display,
                outline: 'none', cursor: podeEditar ? 'pointer' : 'default',
              }}
            >
              {CATALOG_STATUS_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>


            {/* O botão FICHA saiu: a aba do rodapé é a porta, e duas portas para a mesma sala
                fazem a pessoa perguntar qual é a diferença — não há. */}
          </div>
        )}
      />

    </>
  );
};

export default ProjectSpace;
