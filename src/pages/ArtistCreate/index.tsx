import { FC, KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from 'react';
import { MaestraBrand } from '../../components/MaestraBrand';
import { useNavigate, useParams } from 'react-router-dom';
import { Input, InputNumber, Spin } from 'antd';
import { FiAlertCircle, FiArrowLeft, FiX } from 'react-icons/fi';
import { useDebounce } from 'use-debounce';

import { useAppDispatch, useAppSelector } from '@maestra/core/store/store';
import { supabase } from '@maestra/core/lib/supabase';
import { artistsActions } from '@maestra/core/store/slices/artists';
import { searchSpotifyArtists, type SpotifyArtistSearchResult } from '@maestra/core/services/spotifyArtist';
import { ARTISTS_DEFAULT_IMAGE } from '@maestra/core/constants/spotify';
import { SpotifyLottie } from '../../components/SpotifyLottie';
import type { RealIndex } from '@maestra/core/interfaces/maestra';
// O roteiro do quiz mora no núcleo: o app nativo faz as MESMAS perguntas, na mesma ordem, com
// as mesmas chaves — é o que a edge `artist-diagnostic` lê dos dois lados.
import {
  IMPRENSA_PORTES, IMPRENSA_TIPOS, IMPRENSA_NUNCA, QUIZ, REVENUE_SOURCES, CHAVES_DO_BLOCO_R,
  TIPOS_DE_CONTRATANTE_QUIZ, NAO_SEI, CTX_API, ORIENTACAO_SPOTIFY, totalDaTrilha,
  perguntaAnterior, proximaPergunta,
} from '@maestra/core/constants/quizDoDiagnostico';
import { useCanCreateArtist } from '@maestra/core/hooks/useCanCreateArtist';
import { useEntitlements } from '@maestra/core/hooks/useEntitlements';
import { formatRemainingTime } from '@maestra/core/utils/rateLimitCalc';
import { DiagnosticReport, type Chartmetric } from './DiagnosticReport';
import { FlowHeader } from './FlowHeader';
import { AnalyzingSteps } from './AnalyzingSteps';
import realStar from '../../assets/feature-real.png';
import styles from './ArtistCreate.module.scss';

type Step = 'perfil' | 'intro' | 'quiz' | 'analisando' | 'diagnostico';

const REDUCE_MOTION =
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const ArtistCreate: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const artists = useAppSelector((s) => s.artists.items);
  const artistsLoaded = useAppSelector((s) => s.artists.loaded);
  const { canCreate: allowed, reason: rateLimitReason, pendingCount, cooldownRemainingSeconds, loading: rlLoading, error: rlError, retry: rlRetry } = useCanCreateArtist();

  // Modo "Refazer diagnóstico" (PRO): rota própria /artists/:id/diagnostico/refazer. Pula a busca
  // do Spotify, pré-carrega os dados salvos do artista + as respostas anteriores do quiz e recalcula
  // no edge (redoArtistId), sem criar perfil nem mexer no plano. Em /criar-artista, :id é undefined.
  const { id: redoArtistId } = useParams();
  const redo = !!redoArtistId;
  const redoArtist = redoArtistId ? artists.find((a) => a.id === redoArtistId) : undefined;
  const { isPro } = useEntitlements();
  const subInitialized = useAppSelector((s) => s.subscription.initialized);

  // Refazer diagnóstico é recurso PRO — o edge também valida (403). Aqui evitamos o beco sem saída
  // de rodar o quiz todo pra só barrar no fim: não-PRO é mandado pra /assinatura na entrada. Só
  // age após o status carregar (`initialized`), senão um PRO seria expulso no load inicial.
  useEffect(() => {
    if (redo && subInitialized && !isPro) navigate('/assinatura', { replace: true });
  }, [redo, subInitialized, isPro, navigate]);

  // Mesma ideia para quem NÃO é dono do perfil. O botão já não aparece para colaborador, mas a
  // rota continua alcançável por URL (link salvo, histórico) — e ali o quiz rodava inteiro para
  // terminar num 404 do edge exibido como "Não consegui gerar seu diagnóstico agora", que soa
  // como falha temporária. `artistsLoaded` evita expulsar o dono antes da lista chegar.
  useEffect(() => {
    if (!redo || !artistsLoaded || !redoArtist || !user?.id) return;
    if (redoArtist.user_id !== user.id) navigate(`/artists/${redoArtistId}/diagnostico`, { replace: true });
  }, [redo, artistsLoaded, redoArtist, user?.id, redoArtistId, navigate]);

  const [step, setStep] = useState<Step>('perfil');
  const [line, setLine] = useState('');     // fala atual da Maestra
  const [typed, setTyped] = useState('');   // efeito de digitação
  const [typing, setTyping] = useState(false);

  // Perfil / busca (Spotify obrigatório)
  const [query, setQuery] = useState('');
  // 600ms (era 400): o limite do Spotify é POR APP numa janela de 30s, e a busca vai direto do
  // navegador de cada usuário. Com muita gente digitando ao mesmo tempo, todo mundo divide a
  // mesma cota — cada request a menos por pessoa conta. Ver docs/RISCO-SPOTIFY-ESCALA.md.
  const [debounced] = useDebounce(query, 600);
  const [results, setResults] = useState<SpotifyArtistSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  // A busca no Spotify falhou (queda/instabilidade da API deles). Sem isto, o catch abaixo
  // zerava os resultados e a tela ficava idêntica a "nenhum artista com esse nome" — o usuário
  // não tinha como saber que era falha temporária e que valia tentar de novo.
  // null = sem falha | 'instavel' = queda momentânea (vale tentar de novo) | 'bloqueado' = o
  // Spotify recusou a chamada (403), insistir não adianta.
  const [searchFailed, setSearchFailed] = useState<null | 'instavel' | 'bloqueado'>(null);
  // Aviso inline quando o artista buscado já existe (mesmo usuário).
  const [notice, setNotice] = useState<{ name: string } | null>(null);
  const chosen = useRef<{ name: string; spotifyArtistId: string | null; followers: number | null; image: string | null }>({ name: '', spotifyArtistId: null, followers: null, image: null });
  // Caminho "ainda estou iniciando": cria o perfil sem Spotify (artista em começo de carreira).
  const [noSpotify, setNoSpotify] = useState(false);
  const [manualName, setManualName] = useState('');
  const introLineRef = useRef('');

  // Quiz
  const [quizIndex, setQuizIndex] = useState(0);
  const answers = useRef<Record<string, any>>({});
  const [fieldVal, setFieldVal] = useState<number | null>(null);        // campo aberto (int/currency)
  // Receita: R$ por fonte, ou a string "não sei" (§4 — conta zero e sinaliza no relatório).
  const [revenueVal, setRevenueVal] = useState<Record<string, number | typeof NAO_SEI>>({});
  // Cachê médio por tipo de contratante (§3.2) — seis linhas de R$, zero é resposta válida.
  const [cacheVal, setCacheVal] = useState<Record<string, number>>({});
  // Imprensa: UM porte por tipo, o maior (§9.3). `undefined` na chave = ainda não respondeu.
  const [matrixVal, setMatrixVal] = useState<Record<string, string>>({});

  // Ao trocar de pergunta: pré-carrega a resposta anterior (modo redo) ou zera (criação).
  useEffect(() => {
    const cur = step === 'quiz' ? QUIZ[quizIndex] : null;
    if (!cur) { setFieldVal(null); return; }
    const prev = answers.current[cur.key];
    if (cur.type === 'int' || cur.type === 'currency') {
      setFieldVal(typeof prev === 'number' ? prev : null);
    } else if (cur.type === 'revenue') {
      setRevenueVal(prev && typeof prev === 'object' && !Array.isArray(prev) ? { ...prev } : {});
    } else if (cur.type === 'cache') {
      setCacheVal(prev && typeof prev === 'object' && !Array.isArray(prev) ? { ...prev } : {});
    } else if (cur.type === 'matrix') {
      setMatrixVal(Array.isArray(prev)
        ? Object.fromEntries(prev.map((c: any) => [c.tipo, c.porte]))
        : {});
    } else {
      setFieldVal(null);
    }
  }, [quizIndex, step]);

  // Escolha única por tipo: marcar um porte substitui o anterior. Reclicar o mesmo desmarca.
  const marcarPorte = (tipo: string, porte: string) =>
    setMatrixVal((prev) => ({ ...prev, [tipo]: prev[tipo] === porte ? '' : porte }));

  // Refazer diagnóstico: semeia os dados salvos do artista + as respostas anteriores e começa no
  // quiz (pula o "perfil"). Só age enquanto está no perfil; ao achar o artista, troca pra quiz.
  // Se a lista vier vazia (deep-link), dispara o fetch e re-tenta quando carregar.
  useEffect(() => {
    if (!redo || step !== 'perfil') return;
    if (!redoArtist) { if (user?.id) dispatch(artistsActions.fetchArtists(user.id)); return; }
    chosen.current = {
      name: redoArtist.name,
      spotifyArtistId: redoArtist.content?.spotifyProfile?.spotify_artist_id ?? null,
      followers: redoArtist.content?.spotifyProfile?.followers ?? null,
      image: redoArtist.content?.spotifyProfile?.image ?? null,
    };
    answers.current = { ...(redoArtist.content?.quizDiagnostic?.answers || {}) };
    setQuizIndex(0);
    setStep('quiz');
    say(QUIZ[0].q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redo, redoArtist, step]);

  // Diagnóstico (Índice REAL)
  const [realIndex, setRealIndex] = useState<RealIndex | null>(null);
  const [chartmetric, setChartmetric] = useState<Chartmetric | null>(null);
  const [diagError, setDiagError] = useState(false);
  const createdRef = useRef<{ artistId: string; locked: boolean } | null>(null);

  const say = (text: string) => setLine(text);

  // Typewriter da fala da Maestra (igual /welcome).
  useEffect(() => {
    if (!line) return;
    if (REDUCE_MOTION) { setTyped(line); setTyping(false); return; }
    setTyping(true);
    setTyped('');
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setTyped(line.slice(0, i));
      if (i >= line.length) { window.clearInterval(id); setTyping(false); }
    }, 18);
    return () => window.clearInterval(id);
  }, [line]);

  // Saudação inicial (só na criação — no modo "Refazer diagnóstico" o seeding leva direto ao quiz).
  const intro = useRef(false);
  useEffect(() => {
    if (intro.current || redo) return;
    intro.current = true;
    const hasArtists = artists.some((a) => a.role !== 'member');
    introLineRef.current = hasArtists
      ? 'Bora criar outro perfil de artista. Qual a gente vai trabalhar? Busca no Spotify que eu já trago os dados.'
      : 'Vamos criar um perfil de artista. Qual a gente vai trabalhar? Busca no Spotify que eu já trago os dados.';
    say(introLineRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Busca Spotify
  useEffect(() => {
    let active = true;
    // Mínimo de 3 caracteres: 1 ou 2 letras devolvem resultado inútil e eram justamente as
    // buscas mais frequentes (dispara a cada tecla no começo do nome). Como a cota do Spotify é
    // por app e compartilhada por todos os usuários, cortar essas é o ganho mais barato que
    // existe. Ver docs/RISCO-SPOTIFY-ESCALA.md.
    if (debounced.trim().length < 3) { setResults([]); setSearchFailed(null); return; }
    setSearching(true);
    setSearchFailed(null);
    searchSpotifyArtists(debounced)
      .then((r) => { if (active) { setResults(r); setSearchFailed(null); } })
      .catch((e) => {
        if (!active) return;
        // O axios já reteve 502/503/504 duas vezes (ver src/axios.ts); chegar aqui significa
        // que a API do Spotify seguiu fora do ar. Marca a falha para a tela poder dizer isso.
        const status = e?.response?.status;
        console.error('[Spotify] busca de artista falhou:', status || e?.message || e);
        setResults([]);
        // 403 não é instabilidade: é bloqueio do lado do Spotify (ex.: o app perdeu o Premium
        // exigido pelo Development Mode). Mandar "tente de novo em instantes" seria mentira —
        // insistir não resolve. Ver docs/RISCO-SPOTIFY-ESCALA.md §0.
        setSearchFailed(status === 403 ? 'bloqueado' : 'instavel');
      })
      .finally(() => active && setSearching(false));
    return () => { active = false; };
  }, [debounced]);

  // Roda o diagnóstico ao entrar em "analisando": cria (ou retorna) o artista no banco,
  // já com quiz + Chartmetric + diagnóstico salvos no content (nunca regerar).
  useEffect(() => {
    if (step !== 'analisando') return;
    let active = true;
    (async () => {
      try {
        // Redo (PRO): recalcula no edge reusando o Chartmetric salvo. Criação: cria/reusa o perfil.
        const { data, error } = await supabase.functions.invoke('artist-diagnostic', {
          body: redo
            ? { redoArtistId, quizV4: answers.current }
            : {
                name: chosen.current.name,
                spotifyArtistId: chosen.current.spotifyArtistId,
                spotify: { followers: chosen.current.followers, image: chosen.current.image },
                quizV4: answers.current,
              },
        });
        if (error) throw error;
        const d = data as { artistId: string; locked?: boolean; reused?: boolean; realIndex: RealIndex | null; chartmetric: Chartmetric | null };
        if (!active) return;
        createdRef.current = { artistId: d.artistId, locked: d.locked !== false };
        // Atualiza a lista pra refletir o perfil (novo/pendente na criação, atualizado no redo).
        if (user?.id) dispatch(artistsActions.fetchArtists(user.id));
        // Perfil reaproveitado já PAGO → segue direto pro app (sem mostrar diagnóstico de novo).
        if (d.reused && d.locked === false) {
          navigate(`/artists/${d.artistId}`, { replace: true });
          return;
        }
        setRealIndex(d?.realIndex || null);
        setChartmetric(d?.chartmetric || null);
        setDiagError(!d?.realIndex);
      } catch {
        // A função pode concluir a gravação e a resposta falhar depois (por exemplo, por
        // uma segunda tentativa cair no cooldown). Antes de exibir erro, confirma no banco.
        if (!redo && user?.id) {
          try {
            const refreshedArtists = await dispatch(artistsActions.fetchArtists(user.id)).unwrap();
            const savedArtist = refreshedArtists.find((artist) => {
              const savedSpotifyId = artist.content?.spotifyProfile?.spotify_artist_id;
              return chosen.current.spotifyArtistId
                ? savedSpotifyId === chosen.current.spotifyArtistId
                : artist.name.trim().toLocaleLowerCase() === chosen.current.name.trim().toLocaleLowerCase();
            });

            if (active && savedArtist?.content?.realIndex) {
              createdRef.current = { artistId: savedArtist.id, locked: savedArtist.is_locked !== false };
              navigate(`/artists/${savedArtist.id}/desbloquear`, { replace: true, state: { skipDiagnostic: true } });
              return;
            }
          } catch {
            // A mensagem de erro abaixo permanece como fallback quando a reconciliação falha.
          }
        }
        if (active) setDiagError(true);
      }
      if (active) setStep('diagnostico');
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ─── Handlers de fluxo ──────────────────────────────────────────────────────
  // Após escolher o artista, entra na transição ('intro'): aqui o ambiente já vira o do Diagnóstico
  // REAL e a Maestra confirma de quem é o diagnóstico antes de começar as perguntas.
  // Consulta prévia à Chartmetric (§3.1, passo 2): é ela que decide quais perguntas de
  // autodeclaração de R o quiz mostra. Dispara ao escolher o perfil e roda enquanto o artista lê a
  // tela de orientação, então na prática nunca faz ninguém esperar.
  //
  // Rede de segurança (§3.1, passo 6): qualquer falha deixa `_api` vazio e o quiz pergunta os três
  // campos. Perguntar demais é recuperável; calcular o alcance sobre nada não é.
  const previewRef = useRef<Promise<unknown> | null>(null);
  const buscarPreview = (spotifyArtistId: string | null) => {
    delete answers.current[CTX_API];
    if (!spotifyArtistId) { previewRef.current = null; return; }
    previewRef.current = supabase.functions
      .invoke('artist-diagnostic', { body: { preview: true, spotifyArtistId } })
      .then(({ data }) => { if (data?.api) answers.current[CTX_API] = data.api; })
      .catch(() => { /* sem preview, o quiz pergunta tudo */ });
  };

  const selectArtist = (name: string, spotifyArtistId: string | null, followers: number | null, image: string | null = null) => {
    chosen.current = { name, spotifyArtistId, followers, image };
    buscarPreview(spotifyArtistId);
    setStep('intro');
    say(`Boa! Vamos criar o diagnóstico de ${name}. Vou te fazer algumas perguntas rápidas pra entender a sua realidade de hoje.`);
  };

  // Começa o quiz de fato (botão da transição).
  const [preparando, setPreparando] = useState(false);
  const beginQuiz = async () => {
    // Espera o preview para não abrir o quiz com perguntas que já sabemos que vão sumir.
    if (previewRef.current) { setPreparando(true); await previewRef.current; setPreparando(false); }
    setQuizIndex(0);
    setStep('quiz');
    say(QUIZ[0].q);
  };

  const handleSelectSpotify = async (r: SpotifyArtistSearchResult) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (userId) {
        const { data: isDuplicate } = await supabase.rpc('check_self_duplicate', {
          p_user_id: userId,
          p_spotify_id: r.id,
        });
        if (isDuplicate) {
          setNotice({ name: r.name });
          setResults([]);
          return;
        }
      }
    } catch { /* backend revalida via constraint */ }
    setNotice(null);
    setQuery('');
    setResults([]);
    selectArtist(r.name, r.id, r.followers ?? null, r.image ?? null);
  };

  // Entra no modo "ainda estou iniciando" (sem Spotify): pede só o nome artístico.
  const chooseNoSpotify = () => {
    setNoSpotify(true);
    setQuery('');
    setResults([]);
    setNotice(null);
    say('Sem problema nenhum, todo mundo começa em algum lugar. Vou montar seu diagnóstico com a sua realidade de hoje, e o Spotify a gente conecta depois. Como é o seu nome artístico?');
  };

  // Volta ao modo de busca no Spotify.
  const backToSpotify = () => {
    setNoSpotify(false);
    setManualName('');
    say(introLineRef.current);
  };

  // Confirma o nome digitado e segue pro quiz, sem Spotify (spotifyArtistId = null).
  const confirmManualName = () => {
    const n = manualName.trim();
    if (!n) return;
    selectArtist(n, null, null, null);
  };

  // Próximo índice pulando perguntas condicionais (ex.: cachê quando shows = 0).
  const nextQuizIndex = (from: number) => proximaPergunta(from, answers.current);

  const answerQuiz = (value: unknown) => {
    answers.current[QUIZ[quizIndex].key] = value;
    const next = nextQuizIndex(quizIndex + 1);
    if (next < QUIZ.length) {
      setQuizIndex(next);
      say(QUIZ[next].q);
    } else {
      setStep('analisando');
      say(`Deixa eu cruzar esses dados e montar um diagnóstico de ${chosen.current.name}…`);
    }
  };

  // Índice ANTERIOR pulando as perguntas condicionais que não se aplicam (espelha o nextQuizIndex).
  const prevQuizIndex = (from: number) => perguntaAnterior(from, answers.current);

  const goBackQuiz = () => {
    const prev = prevQuizIndex(quizIndex - 1);
    if (prev < 0) return;
    setQuizIndex(prev);
    say(QUIZ[prev].q);
  };

  const goToUnlock = () => {
    // Redo: o perfil já é pago — volta pro diagnóstico atualizado (nada de desbloqueio).
    if (redo) { navigate(`/artists/${redoArtistId}/diagnostico`); return; }
    const created = createdRef.current;
    // O artista já viu o diagnóstico aqui no chat → abre o desbloqueio direto no pagamento.
    if (created) navigate(`/artists/${created.artistId}/desbloquear`, { state: { skipDiagnostic: true } });
    else navigate('/artists');
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  const showInteraction = !typing;
  // A identidade do Diagnóstico REAL (verde + "Maestra REAL" + estrela) só entra DEPOIS de selecionar
  // o perfil. No 1º passo ('perfil') é o ambiente neutro da Maestra, pra não parecer que já começou o diagnóstico.
  const realEnv = step !== 'perfil';
  // Fase do macro-fluxo do header: 0 = Criar perfil, 1 = Diagnóstico REAL (Pagamento fica fora desta tela).
  const macroPhase = step === 'perfil' ? 0 : 1;

  // Progresso do quiz: baseado na posição ABSOLUTA na trilha (quizIndex / QUIZ.length), não na
  // contagem de perguntas visíveis — esta muda conforme as respostas abrem/fecham perguntas
  // condicionais (o antigo "de 9" virava "de 13" e a barra até recuava). Como o índice só avança
  // (pulando os skips) ou volta pelo "Voltar", a barra é monotônica; na última pergunta, 100%.
  const isLastQuiz = step === 'quiz' && nextQuizIndex(quizIndex + 1) >= QUIZ.length;
  // O denominador desconta o bloco R que a consulta prévia já respondeu: sem isso a barra pararia
  // em 82% num quiz que terminou, porque três perguntas nunca apareceram.
  const trilha = totalDaTrilha(answers.current);
  const posicao = QUIZ.filter((p, i) => i <= quizIndex && !(CHAVES_DO_BLOCO_R.includes(p.key) && p.skipIf?.(answers.current))).length;
  const quizPct = step === 'quiz'
    ? (isLastQuiz ? 100 : Math.round((posicao / trilha) * 100))
    : 0;
  const canGoBack = step === 'quiz' && prevQuizIndex(quizIndex - 1) >= 0;

  return (
    <div className={`${styles.page} ${realEnv ? styles.pageReal : ''}`}>
      {/* Barra de progresso do quiz no topo absoluto da página (só durante as perguntas). */}
      {step === 'quiz' && (
        <div className={styles.topProgress} aria-hidden>
          <span className={styles.topProgressFill} style={{ width: `${quizPct}%` }} />
        </div>
      )}

      {/* Ícone do REAL grande e translúcido no fundo — só no ambiente do diagnóstico. */}
      {realEnv && <span className={styles.pageGlyph} aria-hidden><img src={realStar} alt="" width={340} height={340} /></span>}

      {/* Cabeçalho numa ÚNICA linha: marca à esquerda (aparece em prints), progresso enxuto e X. */}
      <div className={styles.topBar}>
        <a
          className={styles.brand}
          href='/artists'
          onClick={(event) => {
            event.preventDefault();
            navigate('/artists');
          }}
          aria-label='Voltar para seus perfis'
        >
          <MaestraBrand variant='lockup' tone='dark' />
        </a>
        {/* O mesmo header do /desbloquear tambem no refazer: antes o slot ficava vago e o
            "Diagnóstico REAL" era uma pilula solta acima da pergunta — que na tela final, com o
            relatorio em largura cheia, sobrava perdida no topo. Fase 1 e justamente a do
            diagnostico, entao o rotulo sai pronto e com o "REAL" no mesmo estilo. */}
        <FlowHeader phase={redo ? 1 : macroPhase} />
        {/* X nos dois modos. No refazer o destino continua sendo a pagina do diagnostico, mas a
            acao e a mesma dos dois lados: sair do fluxo. Com a seta, o rotulo dizia "Voltar" —
            um X anunciado como "Voltar" e contraditorio para quem usa leitor de tela. */}
        <button
          className={styles.back}
          onClick={() => navigate(redo ? `/artists/${redoArtistId}/diagnostico` : '/artists')}
          aria-label='Sair'
          title='Sair'
        >
          <FiX size={20} />
        </button>
      </div>


      <div className={`${styles.step} ${step === 'diagnostico' ? styles.stepWide : ''}`} key={`${step}-${quizIndex}`}>
        {step !== 'diagnostico' && (
          <p className={styles.line}>
            {typed}
            {typing && <span className={styles.caret} aria-hidden />}
          </p>
        )}

        {(showInteraction || step === 'diagnostico') && (
          <div className={`${styles.interaction} ${step === 'diagnostico' ? styles.interactionWide : ''}`}>
            {/* PERFIL — Spotify obrigatório (o diagnóstico REAL precisa dos dados da API) */}
            {step === 'perfil' && (
              <>
                {rlLoading && (
                  <div style={{ textAlign: 'center', padding: 16 }}><Spin /></div>
                )}

                {!rlLoading && !allowed && rateLimitReason === 'pending_limit' && (
                  <div className={styles.dupeNotice}>
                    <FiAlertCircle className={styles.dupeNoticeIcon} />
                    <div className={styles.dupeNoticeText}>
                      Você tem {pendingCount} perfis pendentes. Pague ou exclua antes de criar outro.
                    </div>
                    <button className={styles.dupeNoticeBtn} onClick={() => navigate('/artists')}>Ver meus perfis</button>
                  </div>
                )}

                {!rlLoading && !allowed && rateLimitReason === 'cooldown' && (
                  <div className={styles.dupeNotice}>
                    <FiAlertCircle className={styles.dupeNoticeIcon} />
                    <div className={styles.dupeNoticeText}>
                      Aguarde {formatRemainingTime(cooldownRemainingSeconds)} para criar outro perfil.
                    </div>
                  </div>
                )}

                {rlError && (
                  <div className={styles.dupeNotice}>
                    <FiAlertCircle className={styles.dupeNoticeIcon} />
                    <div className={styles.dupeNoticeText}>
                      Erro ao verificar limites. Verifique sua conexão e tente novamente.
                    </div>
                    <button className={styles.dupeNoticeBtn} onClick={rlRetry}>Tentar novamente</button>
                  </div>
                )}

                {/* Modo busca no Spotify (padrão) — só quando pode criar; senão fica só o aviso acima. */}
                {allowed && !noSpotify && (
                  <>
                    <Input
                      autoFocus
                      size='large'
                      className={styles.searchInput}
                      placeholder='Nome do artista ou link do Spotify…'
                      value={query}
                      onChange={(e) => { setQuery(e.target.value); if (notice) setNotice(null); }}
                      prefix={<SpotifyLottie size={24} style={{ marginRight: 4 }} />}
                      disabled={!allowed || rlLoading}
                    />
                    {(searching || results.length > 0) && (
                      <div className={styles.results}>
                        {searching && <div style={{ textAlign: 'center', padding: 16 }}><Spin /></div>}
                        {!searching && results.map((r) => (
                          <button key={r.id} className={styles.resultItem} onClick={() => handleSelectSpotify(r)}>
                            <img src={r.image || ARTISTS_DEFAULT_IMAGE} alt={r.name} />
                            <div>
                              <div className={styles.resultName}>{r.name}</div>
                              {r.followers != null && <div className={styles.resultFollowers}>{r.followers.toLocaleString('pt-BR')} seguidores</div>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Buscou e não achou. Acontece muito com nome curto ou comum ("BEA"), que
                        afunda na ordenação por relevância do Spotify. É o momento certo de
                        contar que dá pra colar o link do perfil, que acha de forma exata.

                        `!notice` porque escolher um perfil que já existe LIMPA os resultados e
                        mantém o termo digitado: sem isto, os dois avisos apareciam juntos, e o
                        "não achei esse artista" contradizia o "você já tem esse artista" logo
                        abaixo dele. */}
                    {!searching && !searchFailed && !notice && debounced.trim().length >= 3 && results.length === 0 && (
                      <div className={styles.dupeNotice}>
                        <FiAlertCircle className={styles.dupeNoticeIcon} />
                        <div className={styles.dupeNoticeText}>
                          Não achei esse artista pelo nome. Abra o perfil dele no Spotify, copie o link e cole aqui.
                        </div>
                      </div>
                    )}

                    {/* Falha na API do Spotify: sem isto a tela ficava igual a "não achei ninguém"
                        e o usuário não sabia que era temporário. Oferece o caminho sem Spotify,
                        que segue funcionando mesmo com a busca fora do ar. */}
                    {searchFailed && !searching && (
                      <div className={styles.dupeNotice}>
                        <FiAlertCircle className={styles.dupeNoticeIcon} />
                        <div className={styles.dupeNoticeText}>
                          {searchFailed === 'bloqueado'
                            ? 'A busca do Spotify está indisponível no momento. Já estamos resolvendo. Você pode seguir criando o perfil sem ele e conectar depois.'
                            : 'Não consegui falar com o Spotify agora. Isso costuma ser passageiro: espere alguns instantes e escreva o nome de novo.'}
                        </div>
                        <button className={styles.dupeNoticeBtn} onClick={chooseNoSpotify}>Criar sem o Spotify</button>
                      </div>
                    )}

                    {notice && (
                      <div className={styles.dupeNotice}>
                        <FiAlertCircle className={styles.dupeNoticeIcon} />
                        <div className={styles.dupeNoticeText}>
                          Você já tem <strong>{notice.name}</strong> nos seus perfis. Não dá pra criar de novo, mas você pode abrir o que já existe.
                        </div>
                        <button className={styles.dupeNoticeBtn} onClick={() => navigate('/artists')}>Ver meus perfis</button>
                      </div>
                    )}

                    {allowed && !rlLoading && (
                      <button className={styles.linkBtn} onClick={chooseNoSpotify}>
                        Ainda estou iniciando, não tenho perfil no Spotify
                      </button>
                    )}
                  </>
                )}

                {/* Modo sem Spotify: só o nome artístico */}
                {allowed && noSpotify && (
                  <>
                    <Input
                      autoFocus
                      size='large'
                      className={styles.searchInput}
                      placeholder='Seu nome artístico'
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      onPressEnter={confirmManualName}
                      disabled={!allowed || rlLoading}
                    />
                    <button
                      disabled={!manualName.trim() || !allowed || rlLoading}
                      onClick={confirmManualName}
                      className={styles.cta}
                      style={{ marginTop: 12, width: '100%' }}
                    >
                      Continuar
                    </button>
                    <button className={styles.linkBtn} onClick={backToSpotify}>
                      Tenho Spotify, quero buscar
                    </button>
                  </>
                )}
              </>
            )}

            {/* TRANSIÇÃO — confirma de quem é o diagnóstico antes de começar o quiz */}
            {step === 'intro' && (
              <div className={styles.intro}>
                {chosen.current.image && (
                  <img src={chosen.current.image} alt={chosen.current.name} className={styles.introAvatar} />
                )}
                <div className={styles.introName}>{chosen.current.name}</div>
                {chosen.current.spotifyArtistId && (
                  <p className={styles.introOrientacao}>{ORIENTACAO_SPOTIFY}</p>
                )}
                <button className={styles.cta} disabled={preparando} onClick={beginQuiz}>
                  {preparando ? 'Preparando as perguntas…' : 'Começar diagnóstico'}
                </button>
              </div>
            )}

            {/* QUIZ */}
            {step === 'quiz' && (() => {
              const cur = QUIZ[quizIndex];
              // Só dígitos: o parser limpa o que for colado e o onKeyDown bloqueia a digitação de
              // qualquer caractere não-numérico (letras, símbolos, espaço) — teclas de controle
              // (Backspace, setas, Tab, Enter, Delete) e atalhos (Ctrl/Cmd+V etc.) seguem livres.
              // inputMode='numeric' ainda abre o teclado numérico no mobile. Vale p/ TODO campo de valor.
              const stripNonDigits = ((val?: string) => (val ? val.replace(/[^\d]/g, '') : '')) as any;
              const blockNonNumericKey = (e: ReactKeyboardEvent) => {
                if (e.key.length === 1 && !/[0-9]/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault();
              };
              const numProps = { inputMode: 'numeric' as const, parser: stripNonDigits, onKeyDown: blockNonNumericKey };
              const currencyProps = {
                ...numProps,
                prefix: 'R$',
                formatter: (val?: string | number) => `${val ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
              };

              // Várias perguntas da v4 trazem instrução própria ("deixe em zero o que não se
              // aplica", "esse número aparece no YouTube Studio"). Sem ela o artista responde outra
              // coisa, e o que entra no índice deixa de ser o que a metodologia pediu.
              const ajuda = cur.ajuda ? <p className={styles.quizAjuda}>{cur.ajuda}</p> : null;

              // Sim/Não e selects (níveis/enums): botões de opção.
              if (cur.type === 'select') {
                return (
                  <div className={styles.options}>
                    {ajuda}
                    {cur.options!.map((o) => (
                      <button key={String(o.value)} className={styles.option} onClick={() => answerQuiz(o.value)}>{o.label}</button>
                    ))}
                  </div>
                );
              }

              // Receita fora dos shows: nove fontes, cada uma em R$ ou "não sei" (§3.2).
              //
              // O "não sei" é uma resposta de verdade, não um campo vazio: conta zero no saldo e
              // vira sinalização no relatório (§4, §11.3.4). Quem não sabe quanto a própria
              // distribuidora paga está dizendo algo sobre a gestão da carreira, e é isso que o
              // diagnóstico devolve. Por isso a linha marcada trava o campo, em vez de escondê-lo.
              if (cur.type === 'revenue') {
                return (
                  <div className={styles.revenueForm}>
                    {ajuda}
                    <p className={styles.revenuePrefixo}>Quanto você recebeu nos últimos 12 meses...</p>
                    {REVENUE_SOURCES.map((s) => {
                      const naoSei = revenueVal[s.key] === NAO_SEI;
                      return (
                        <div key={s.key} className={styles.revenueRow}>
                          <span className={styles.revenueLabel}>{s.label}</span>
                          <div className={styles.revenueControls}>
                            <InputNumber
                              size='large'
                              min={0}
                              precision={0}
                              controls={false}
                              disabled={naoSei}
                              className={styles.revenueInput}
                              value={naoSei ? null : ((revenueVal[s.key] as number) ?? null)}
                              onChange={(v) => setRevenueVal((p) => ({ ...p, [s.key]: Math.max(0, Number(v) || 0) }))}
                              placeholder={naoSei ? 'Não sei' : '0'}
                              {...currencyProps}
                            />
                            <button
                              type='button'
                              aria-pressed={naoSei}
                              className={`${styles.naoSeiChip} ${naoSei ? styles.naoSeiChipOn : ''}`}
                              onClick={() => setRevenueVal((p) => ({ ...p, [s.key]: naoSei ? 0 : NAO_SEI }))}
                            >
                              Não sei
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    <button className={styles.cta} style={{ marginTop: 14, width: '100%' }} onClick={() => answerQuiz({ ...revenueVal })}>
                      Continuar
                    </button>
                  </div>
                );
              }

              // Cachê médio por tipo de contratante (§3.2). Seis linhas de R$; zero é resposta
              // válida e significa "não atendi esse tipo" — o motor tira os zeros da média.
              if (cur.type === 'cache') {
                return (
                  <div className={styles.revenueForm}>
                    {ajuda}
                    {TIPOS_DE_CONTRATANTE_QUIZ.map((t) => (
                      <div key={t.key} className={styles.revenueRow}>
                        <span className={styles.revenueLabel}>{t.label}</span>
                        <InputNumber
                          size='large'
                          min={0}
                          precision={0}
                          controls={false}
                          className={styles.revenueInput}
                          value={cacheVal[t.key] ?? null}
                          onChange={(v) => setCacheVal((p) => ({ ...p, [t.key]: Math.max(0, Number(v) || 0) }))}
                          placeholder='0'
                          {...currencyProps}
                        />
                      </div>
                    ))}
                    <button className={styles.cta} style={{ marginTop: 14, width: '100%' }} onClick={() => answerQuiz({ ...cacheVal })}>
                      Continuar
                    </button>
                  </div>
                );
              }

              // Imprensa: uma escolha por tipo de veículo, o MAIOR porte (§9.3).
              //
              // A v3 deixava marcar vários portes no mesmo tipo, o que não significava nada: o
              // motor agrega pelo máximo, porque a matriz mede o TETO de legitimação alcançado.
              // Marcar "pequeno" além de "grande" nunca mudou a nota e só confundia. Agora a
              // pergunta é a que a metodologia faz, com "Nunca" explícito em vez de deixar em branco.
              if (cur.type === 'matrix') {
                const opcoes = [{ key: IMPRENSA_NUNCA, label: 'Nunca' }, ...IMPRENSA_PORTES];
                return (
                  <div className={styles.matrixWrap}>
                    {ajuda}
                    <div className={styles.matrixList}>
                      {IMPRENSA_TIPOS.map((t) => (
                        <div key={t.key} className={styles.matrixTypeRow}>
                          <span className={styles.matrixTypeName}>{t.label}</span>
                          <div className={styles.porteChips}>
                            {opcoes.map((p) => {
                              const marcado = p.key === IMPRENSA_NUNCA
                                ? !matrixVal[t.key]
                                : matrixVal[t.key] === p.key;
                              return (
                                <button
                                  key={p.key}
                                  type='button'
                                  aria-pressed={marcado}
                                  className={`${styles.porteChip} ${marcado ? styles.porteChipOn : ''}`}
                                  onClick={() => marcarPorte(t.key, p.key === IMPRENSA_NUNCA ? '' : p.key)}
                                >
                                  {p.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      className={styles.cta}
                      style={{ marginTop: 16, width: '100%' }}
                      onClick={() => answerQuiz(
                        Object.entries(matrixVal)
                          .filter(([, porte]) => !!porte)
                          .map(([tipo, porte]) => ({ tipo, porte })),
                      )}
                    >
                      Continuar
                    </button>
                  </div>
                );
              }

              // int / currency: campo numérico aberto.
              return (
                <div>
                  {ajuda}
                  <InputNumber
                    autoFocus
                    size='large'
                    min={0}
                    precision={0}
                    controls={false}
                    style={{ width: '100%', height: 56, fontSize: 16, borderRadius: 14, display: 'flex', alignItems: 'center' }}
                    value={fieldVal}
                    onChange={(v) => setFieldVal((v as number | null) ?? null)}
                    placeholder={cur.placeholder}
                    onPressEnter={() => { if (fieldVal != null) answerQuiz(fieldVal); }}
                    {...(cur.type === 'currency' ? currencyProps : numProps)}
                  />
                  <button
                    disabled={fieldVal == null}
                    onClick={() => { if (fieldVal != null) answerQuiz(fieldVal); }}
                    className={styles.cta}
                    style={{ marginTop: 12, width: '100%' }}
                  >
                    Continuar
                  </button>
                </div>
              );
            })()}

            {/* ANALISANDO — lista "pensante" (passos que sobem em loop, foco no centro). */}
            {step === 'analisando' && <AnalyzingSteps light />}

            {/* DIAGNÓSTICO (Índice REAL) */}
            {step === 'diagnostico' && (
              realIndex ? (
                <DiagnosticReport
                  realIndex={realIndex}
                  chartmetric={chartmetric}
                  artistId={createdRef.current?.artistId}
                  vinculo={typeof answers.current.vinculo === 'string' ? answers.current.vinculo : undefined}
                  artistName={chosen.current.name}
                  artistImage={chosen.current.image}
                  noSpotify={!chosen.current.spotifyArtistId}
                  onContinue={goToUnlock}
                  showPlanningCta={!redo}
                  enableStickyCta={!redo}
                />
              ) : (
                <div
                  className={styles.diagWrap}
                  style={{
                    margin: '64px auto',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                  }}
                >
                  <p style={{ color: '#cfcfd4', marginBottom: 18 }}>
                    {diagError ? 'Não consegui gerar seu diagnóstico agora. Tente novamente em instantes.' : 'Carregando…'}
                  </p>
                  {diagError && (
                    <button className={styles.cta} onClick={() => { setDiagError(false); setStep('analisando'); }}>
                      Tentar de novo
                    </button>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Voltar pra pergunta anterior — sutil, no rodapé (só durante o quiz e se houver anterior). */}
      {canGoBack && (
        <div className={styles.quizBackWrap}>
          <button className={styles.quizBackBtn} onClick={goBackQuiz}>
            <FiArrowLeft size={15} /> Voltar
          </button>
        </div>
      )}
    </div>
  );
};

export default ArtistCreate;
