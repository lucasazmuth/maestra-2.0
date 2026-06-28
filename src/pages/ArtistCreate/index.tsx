import { FC, Fragment, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Input, InputNumber, Spin } from 'antd';
import { FiAlertCircle, FiCheck } from 'react-icons/fi';
import { useDebounce } from 'use-debounce';

import { DiagnosticoIcon } from '../../components/Icons/system';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { supabase } from '../../lib/supabase';
import { artistsActions } from '../../store/slices/artists';
import { searchSpotifyArtists, type SpotifyArtistSearchResult } from '../../services/spotifyArtist';
import { ARTISTS_DEFAULT_IMAGE } from '../../constants/spotify';
import { SpotifyLottie } from '../../components/SpotifyLottie';
import type { RealIndex } from '../../interfaces/maestra';
import { useCanCreateArtist } from '../../hooks/useCanCreateArtist';
import { useEntitlements } from '../../hooks/useEntitlements';
import { formatRemainingTime } from '../../utils/rateLimitCalc';
import { DiagnosticReport, type Chartmetric } from './DiagnosticReport';
import styles from './ArtistCreate.module.scss';

type Step = 'perfil' | 'intro' | 'quiz' | 'analisando' | 'diagnostico';

const REDUCE_MOTION =
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Roteiro do Diagnóstico REAL v2 (autorrelato). As chaves casam com os campos de RealInputsV2
// consumidos pelo motor (src/services/realEngine). Campos abertos (inteiro/monetário) + selects
// cujos `value` já são os enums/níveis que o motor espera.
type QuizFieldType = 'int' | 'currency' | 'select';
interface QuizDef {
  key: 'showsPerMonth' | 'avgAudience' | 'cache' | 'faturamentoForaShows' | 'fonteRenda' | 'investimento' | 'cnpj' | 'empresario' | 'premios' | 'imprensa';
  q: string;
  type: QuizFieldType;
  placeholder?: string;
  options?: { label: string; value: string | number }[];
  // Pula a pergunta quando a condição é verdadeira (ex.: cachê só se faz shows).
  skipIf?: (a: Record<string, string | number>) => boolean;
}
// Receita do E = (shows × cachê) + renda fora shows (híbrido c). Sem pergunta de faixa de faturamento.
const QUIZ: QuizDef[] = [
  { key: 'showsPerMonth', type: 'int', q: 'Quantos shows você costuma fazer por mês?', placeholder: 'Ex: 4' },
  { key: 'avgAudience', type: 'int', q: 'Qual o público médio dos seus shows?', placeholder: 'Ex: 300' },
  { key: 'cache', type: 'currency', q: 'Qual o seu cachê médio por show?', placeholder: 'R$ 0', skipIf: (a) => Number(a.showsPerMonth) <= 0 },
  { key: 'faturamentoForaShows', type: 'currency', q: 'Qual sua renda mensal média com música, FORA os shows? (streaming, direitos, aulas, publi…)', placeholder: 'R$ 0' },
  { key: 'fonteRenda', type: 'select', q: 'Qual é a sua principal fonte de renda hoje?', options: [
    { label: 'Shows', value: 'musical' },
    { label: 'Publicidade / patrocínio', value: 'musical' },
    { label: 'Venda de produtos', value: 'musical' },
    { label: 'Direitos (autorais, conexos, fonográficos)', value: 'musical' },
    { label: 'Editais', value: 'musical' },
    { label: 'Aulas e cursos', value: 'musical' },
    { label: 'Uma fonte fora da música', value: 'nao_musical' },
  ] },
  { key: 'investimento', type: 'currency', q: 'Nos últimos 12 meses, quanto você investiu na sua carreira?', placeholder: 'R$ 0' },
  { key: 'cnpj', type: 'select', q: 'Você tem CNPJ para suas atividades musicais?', options: [
    { label: 'Não, atuo como pessoa física', value: 'pf' },
    { label: 'Sim, MEI', value: 'mei' },
    { label: 'Sim, outra modalidade (LTDA, EIRELI…)', value: 'ltda' },
  ] },
  { key: 'empresario', type: 'select', q: 'Você tem empresário/a?', options: [
    { label: 'Não tenho', value: 'nao' },
    { label: 'Eu mesma cumpro esse papel', value: 'proprio' },
    { label: 'Sim, alguém da família ou de amizade', value: 'parente' },
    { label: 'Sim, um profissional do mercado', value: 'mercado' },
  ] },
  { key: 'premios', type: 'select', q: 'Qual o maior reconhecimento em premiações que você já teve?', options: [
    { label: 'Nunca fui indicada nem premiada', value: 0 },
    { label: 'Já fui indicada (sem ganhar)', value: 1 },
    { label: 'Já ganhei prêmio local/regional', value: 2 },
    { label: 'Já ganhei prêmio nacional', value: 3 },
    { label: 'Já ganhei prêmio internacional', value: 4 },
  ] },
  { key: 'imprensa', type: 'select', q: 'Qual o maior alcance de imprensa e TV que o seu trabalho já teve?', options: [
    { label: 'Nunca apareci na mídia', value: 0 },
    { label: 'Repercussão local/regional', value: 1 },
    { label: 'Repercussão nacional', value: 2 },
    { label: 'Repercussão internacional', value: 3 },
  ] },
];

const STEP_INDEX: Record<Step, number> = {
  perfil: 0, intro: 1, quiz: 1, analisando: 2, diagnostico: 2,
};

// Macro-fluxo exibido no header (orienta o usuário na jornada inteira da criação):
// Criar perfil → Diagnóstico REAL → Planejamento Estratégico. O passo interno 'perfil' = fase 0;
// todo o resto (intro/quiz/análise/diagnóstico) = fase 1; o Planejamento (fase 2) é fora desta tela.
const FLOW_PHASES = ['Criar perfil', 'Diagnóstico REAL', 'Planejamento Estratégico'] as const;

const ArtistCreate: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const artists = useAppSelector((s) => s.artists.items);
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

  const [step, setStep] = useState<Step>('perfil');
  const [line, setLine] = useState('');     // fala atual da Maestra
  const [typed, setTyped] = useState('');   // efeito de digitação
  const [typing, setTyping] = useState(false);

  // Perfil / busca (Spotify obrigatório)
  const [query, setQuery] = useState('');
  const [debounced] = useDebounce(query, 400);
  const [results, setResults] = useState<SpotifyArtistSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  // Aviso inline quando o artista buscado já existe (mesmo usuário).
  const [notice, setNotice] = useState<{ name: string } | null>(null);
  const chosen = useRef<{ name: string; spotifyArtistId: string | null; followers: number | null; image: string | null }>({ name: '', spotifyArtistId: null, followers: null, image: null });
  // Caminho "ainda estou iniciando": cria o perfil sem Spotify (artista em começo de carreira).
  const [noSpotify, setNoSpotify] = useState(false);
  const [manualName, setManualName] = useState('');
  const introLineRef = useRef('');

  // Quiz
  const [quizIndex, setQuizIndex] = useState(0);
  const answers = useRef<Record<string, string | number>>({});
  const [fieldVal, setFieldVal] = useState<number | null>(null); // valor do campo aberto atual

  // Ao trocar de pergunta: pré-carrega a resposta anterior (modo redo) ou zera (criação).
  useEffect(() => {
    const cur = step === 'quiz' ? QUIZ[quizIndex] : null;
    if (cur && cur.type !== 'select') {
      const prev = answers.current[cur.key];
      setFieldVal(typeof prev === 'number' ? prev : null);
    } else {
      setFieldVal(null);
    }
  }, [quizIndex, step]);

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
    if (!debounced.trim()) { setResults([]); return; }
    setSearching(true);
    searchSpotifyArtists(debounced)
      .then((r) => active && setResults(r))
      .catch(() => active && setResults([]))
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
            ? { redoArtistId, quizV2: answers.current }
            : {
                name: chosen.current.name,
                spotifyArtistId: chosen.current.spotifyArtistId,
                spotify: { followers: chosen.current.followers, image: chosen.current.image },
                quizV2: answers.current,
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
  const selectArtist = (name: string, spotifyArtistId: string | null, followers: number | null, image: string | null = null) => {
    chosen.current = { name, spotifyArtistId, followers, image };
    setStep('intro');
    say(`Boa! Vamos criar o diagnóstico de ${name}. Vou te fazer algumas perguntas rápidas pra entender a sua realidade de hoje.`);
  };

  // Começa o quiz de fato (botão da transição).
  const beginQuiz = () => {
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
    say('Sem problema nenhum — todo mundo começa em algum lugar. Vou montar seu diagnóstico com a sua realidade de hoje, e o Spotify a gente conecta depois. Como é o seu nome artístico?');
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
  const nextQuizIndex = (from: number) => {
    let i = from;
    while (i < QUIZ.length && QUIZ[i].skipIf?.(answers.current)) i += 1;
    return i;
  };

  const answerQuiz = (value: string | number) => {
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
  const dotIndex = STEP_INDEX[step];
  // A identidade do Diagnóstico REAL (verde + "Maestra REAL" + estrela) só entra DEPOIS de selecionar
  // o perfil. No 1º passo ('perfil') é o ambiente neutro da Maestra, pra não parecer que já começou o diagnóstico.
  const realEnv = step !== 'perfil';
  // Fase do macro-fluxo do header: 0 = Criar perfil, 1 = Diagnóstico REAL (Pagamento fica fora desta tela).
  const macroPhase = step === 'perfil' ? 0 : 1;

  return (
    <div className={`${styles.page} ${realEnv ? styles.pageReal : ''}`}>
      {/* Ícone do REAL grande e translúcido no fundo — só no ambiente do diagnóstico. */}
      {realEnv && <span className={styles.pageGlyph} aria-hidden><DiagnosticoIcon size={300} /></span>}

      <button className={styles.back} onClick={() => navigate(redo ? `/artists/${redoArtistId}/diagnostico` : '/artists')}>{redo ? 'Voltar' : 'Sair'}</button>

      {redo ? (
        // Refazer diagnóstico (PRO): não passa por Criar perfil nem Pagamento — mantém a pílula + dots.
        <>
          <div className={styles.pillWrap}>
            <div className={styles.pill}>
              <span className={styles.pillText}>Diagnóstico <span className={styles.pillReal}>REAL</span></span>
            </div>
          </div>
          <div className={styles.progress}>
            {[0, 1, 2].map((i) => (
              <span key={i} className={`${styles.dot} ${i === dotIndex ? styles.dotOn : i < dotIndex ? styles.dotDone : ''}`} />
            ))}
          </div>
        </>
      ) : (
        // Header do macro-fluxo (estilo Spotify, abas de texto): Criar perfil · Diagnóstico REAL · Pagamento.
        <nav className={styles.flow} aria-label="Etapas da criação">
          {FLOW_PHASES.map((label, i) => {
            const state = i < macroPhase ? 'done' : i === macroPhase ? 'current' : 'upcoming';
            return (
              <Fragment key={label}>
                {i > 0 && <span className={styles.flowSep} aria-hidden>·</span>}
                <span className={`${styles.flowSeg} ${state === 'done' ? styles.flowDone : state === 'current' ? styles.flowCurrent : ''}`}>
                  {state === 'done' && <FiCheck className={styles.flowCheck} size={13} />}
                  {label === 'Diagnóstico REAL'
                    ? <>Diagnóstico&nbsp;<span className={styles.flowReal}>REAL</span></>
                    : label}
                </span>
              </Fragment>
            );
          })}
        </nav>
      )}

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

                {/* Modo busca no Spotify (padrão) */}
                {!noSpotify && (
                  <>
                    <Input
                      autoFocus
                      size='large'
                      style={{ height: 56, fontSize: 16, borderRadius: 14, background: '#1a1a1a' }}
                      placeholder='Busque o artista no Spotify…'
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
                              <div style={{ color: '#fff', fontWeight: 600 }}>{r.name}</div>
                              {r.followers != null && <div style={{ color: '#b3b3b3', fontSize: 12 }}>{r.followers.toLocaleString('pt-BR')} seguidores</div>}
                            </div>
                          </button>
                        ))}
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
                {noSpotify && (
                  <>
                    <Input
                      autoFocus
                      size='large'
                      style={{ height: 56, fontSize: 16, borderRadius: 14, background: '#1a1a1a' }}
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
                <button className={styles.cta} onClick={beginQuiz}>Começar diagnóstico</button>
              </div>
            )}

            {/* QUIZ */}
            {step === 'quiz' && (
              QUIZ[quizIndex].type === 'select' ? (
                <div className={styles.options}>
                  {QUIZ[quizIndex].options!.map((o) => (
                    <button key={o.label} className={styles.option} onClick={() => answerQuiz(o.value)}>{o.label}</button>
                  ))}
                </div>
              ) : (
                <div>
                  <InputNumber
                    autoFocus
                    size='large'
                    min={0}
                    precision={0}
                    controls={false}
                    style={{ width: '100%', height: 56, fontSize: 16, borderRadius: 14, background: '#1a1a1a', display: 'flex', alignItems: 'center' }}
                    value={fieldVal}
                    onChange={(v) => setFieldVal((v as number | null) ?? null)}
                    placeholder={QUIZ[quizIndex].placeholder}
                    onPressEnter={() => { if (fieldVal != null) answerQuiz(fieldVal); }}
                    {...(QUIZ[quizIndex].type === 'currency'
                      ? {
                          prefix: 'R$',
                          formatter: (val?: string | number) => `${val ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
                          parser: ((val?: string) => (val ? Number(val.replace(/\D/g, '')) : 0)) as any,
                        }
                      : {})}
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
              )
            )}

            {/* ANALISANDO */}
            {step === 'analisando' && (
              <div className={styles.analyzing}><Spin size='large' /> Analisando o perfil e cruzando os dados do quiz…</div>
            )}

            {/* DIAGNÓSTICO (Índice REAL) */}
            {step === 'diagnostico' && (
              realIndex ? (
                <DiagnosticReport
                  realIndex={realIndex}
                  chartmetric={chartmetric}
                  artistName={chosen.current.name}
                  artistImage={chosen.current.image}
                  noSpotify={!chosen.current.spotifyArtistId}
                  onContinue={goToUnlock}
                  showPlanningCta={!redo}
                  enableStickyCta={!redo}
                />
              ) : (
                <div className={styles.diagWrap} style={{ textAlign: 'center' }}>
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
    </div>
  );
};

export default ArtistCreate;
